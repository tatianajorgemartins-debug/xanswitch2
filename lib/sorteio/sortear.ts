// O sorteio de um ganhador, separado do banco (as funções de carregar e
// gravar vêm de fora — o painel usa lib/sorteioDb.ts, os testes usam
// versões falsas). Assim dá pra testar que só o admin sorteia, que ninguém
// ganha duas vezes e o que acontece quando dois cliques chegam juntos.
import {
  DURACAO_ANIMACAO_MS,
  ESPERA_INICIO_MS,
  elegiveis,
  montarRoleta,
  proximaVaga,
  type PremioBasico,
  type SorteioBasico,
  type StatusItem,
  type StatusSorteio
} from './regras.ts';

export type EntradaSorteavel = { id: number; premioId: number; desclassificado: boolean; nomeExibicao: string };
export type SorteioCarregado = SorteioBasico & { fimAnimacao: number };

export type DadosParaSortear = {
  status: StatusSorteio;
  premios: (PremioBasico & { status: StatusItem })[];
  sorteios: SorteioCarregado[];
  entradas: EntradaSorteavel[];
};

export type NovoSorteio = {
  premioId: number;
  vaga: number;
  entradaId: number;
  inicio: number; // ms
  duracao: number;
  roleta: string[];
  refazer: { sorteioId: number; motivo: string } | null;
};

export type DepsSorteio = {
  ehAdmin: () => Promise<boolean>;
  carregar: () => Promise<DadosParaSortear>;
  // 'conflito' = outro sorteio gravou antes (vaga ou ganhador já usados)
  gravar: (s: NovoSorteio) => Promise<'ok' | 'conflito'>;
  agora: () => number;
  aleatorio: (n: number) => number; // inteiro de 0 a n-1, criptograficamente seguro
};

export type ResultadoSorteio = { ok: true; sorteio: NovoSorteio } | { ok: false; erro: string };

const TENTATIVAS = 3;

export async function dispararSorteio(
  deps: DepsSorteio,
  opcoes: { premioId?: number; refazer?: { sorteioId: number; motivo: string } } = {}
): Promise<ResultadoSorteio> {
  if (!(await deps.ehAdmin())) return { ok: false, erro: 'Só o admin pode sortear.' };
  const motivo = opcoes.refazer?.motivo.trim() ?? '';
  if (opcoes.refazer && !motivo) return { ok: false, erro: 'Escreva o motivo do novo sorteio.' };

  for (let tentativa = 0; tentativa < TENTATIVAS; tentativa++) {
    const d = await deps.carregar();
    if (d.status !== 'abertas') return { ok: false, erro: d.status === 'rascunho' ? 'Publique a página do sorteio antes de sortear.' : 'Este sorteio já foi encerrado.' };
    const agora = deps.agora();
    if (d.sorteios.some((s) => !s.anulado && s.fimAnimacao > agora)) {
      return { ok: false, erro: 'Espere a animação do sorteio anterior terminar.' };
    }

    // Re-sortear: a vaga do anulado fica livre pro novo ganhador.
    let sorteios = d.sorteios;
    let premioId = opcoes.premioId;
    if (opcoes.refazer) {
      const antigo = d.sorteios.find((s) => s.id === opcoes.refazer!.sorteioId);
      if (!antigo || antigo.anulado) return { ok: false, erro: 'Esse sorteio não existe ou já foi refeito.' };
      sorteios = d.sorteios.map((s) => (s.id === antigo.id ? { ...s, anulado: true } : s));
      premioId = antigo.premioId;
    }

    // Sem item escolhido: o primeiro com inscrições encerradas e vaga livre.
    const prontos = d.premios.filter((p) => p.status === 'encerradas');
    if (premioId !== undefined) {
      const item = d.premios.find((p) => p.id === premioId);
      if (!item) return { ok: false, erro: 'Esse item não existe.' };
      if (item.status !== 'encerradas') return { ok: false, erro: `Encerre as inscrições de "${item.nome ?? 'este item'}" antes de sortear.` };
    }
    const vaga = proximaVaga(prontos, sorteios, premioId);
    if (!vaga) {
      return {
        ok: false,
        erro: premioId !== undefined ? 'Esse item já tem todos os ganhadores.' : 'Nenhum item pronto pra sortear: encerre as inscrições de um item primeiro.'
      };
    }
    // Elegíveis contam também o anulado (quem foi re-sorteado não volta).
    const candidatos = elegiveis(d.entradas, d.sorteios, vaga.premio.id);
    if (!candidatos.length) return { ok: false, erro: 'Ninguém (que ainda não ganhou) está inscrito neste item.' };

    const ganhador = candidatos[deps.aleatorio(candidatos.length)];
    const novo: NovoSorteio = {
      premioId: vaga.premio.id,
      vaga: vaga.vaga,
      entradaId: ganhador.id,
      inicio: agora + ESPERA_INICIO_MS,
      duracao: DURACAO_ANIMACAO_MS,
      roleta: montarRoleta(
        candidatos.filter((c) => c.id !== ganhador.id).map((c) => c.nomeExibicao),
        ganhador.nomeExibicao,
        deps.aleatorio
      ),
      refazer: opcoes.refazer ? { sorteioId: opcoes.refazer.sorteioId, motivo } : null
    };
    if ((await deps.gravar(novo)) === 'ok') return { ok: true, sorteio: novo };
  }
  return { ok: false, erro: 'Outro sorteio foi feito ao mesmo tempo. Confira a tela e tente de novo.' };
}
