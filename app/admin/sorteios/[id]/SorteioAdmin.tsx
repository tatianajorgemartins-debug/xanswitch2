'use client';

// Painel de um sorteio ao vivo. Em cima, a "jornada" (em que passo o
// sorteio está e o botão do próximo passo). Três abas:
//  - Configurar: textos, link, regras antifraude e prêmios;
//  - Controle (privada): números, sortear/re-sortear, modo de teste,
//    histórico e participantes (IP escondido, suspeitos, desclassificar, CSV);
//  - Telão (vai na live): só nomes curtos e e-mails mascarados, tela cheia
//    e Espaço = sortear o próximo.
// Visual em ../sorteios-admin.css (painel) e app/sorteio/sorteio.css (telão).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { NOME_STATUS, ORDEM_STATUS, mascararIp, proximoStatus, proximaVaga, type StatusSorteio } from '@/lib/sorteio/regras';
import { ListaPremios, PainelAoVivo, useEstadoSorteio } from '@/app/sorteio/AoVivo';
import {
  apagarPremioAction,
  apagarSorteioAction,
  avancarStatusAction,
  dadosControleAction,
  desclassificarAction,
  estadoTelaoAction,
  gerarTesteAction,
  modoTesteAction,
  refazerSorteioAction,
  resetarAction,
  salvarPremioAction,
  salvarSorteioAction,
  sortearAction,
  type DadosControle
} from '../actions';

type Aba = 'configurar' | 'controle' | 'telao';
type Aviso = { tipo: 'ok' | 'erro'; texto: string; id: number } | null;
type Resposta = { ok: true } | { ok: false; erro: string };

const SITE = 'xanswitch.com.br';

// O que cada passo significa e o botão que leva pro próximo.
const PASSOS: Record<StatusSorteio, { curto: string; explica: string; acao?: string; confirma?: string }> = {
  rascunho: {
    curto: 'Rascunho',
    explica: 'Só você vê. Preencha a aba Configurar e cadastre os prêmios. Dá pra ensaiar tudo com o modo de teste (aba Controle).',
    acao: 'Abrir inscrições',
    confirma: 'Abrir as inscrições? O link fica público e as pessoas já podem confirmar presença.'
  },
  abertas: {
    curto: 'Inscrições',
    explica: 'O link está no ar: divulgue! As pessoas entram com a conta da loja, colocam o @ do Instagram e confirmam presença.',
    acao: 'Encerrar inscrições',
    confirma: 'Encerrar as inscrições? Ninguém mais consegue entrar no sorteio.'
  },
  encerradas: {
    curto: 'Encerradas',
    explica: 'Ninguém mais entra. Antes de sortear, confira os suspeitos na aba Controle e desclassifique quem precisar.',
    acao: 'Começar a sortear',
    confirma: 'Começar a sortear? A página pública vira a tela ao vivo da roleta.'
  },
  sorteando: {
    curto: 'Sorteando',
    explica: 'Abra a aba Telão (a que vai na live), ponha em tela cheia e aperte Espaço pra sortear cada prêmio.',
    acao: 'Finalizar sorteio',
    confirma: 'Finalizar o sorteio? Não dá pra sortear mais depois disso.'
  },
  finalizado: { curto: 'Finalizado', explica: 'Sorteio encerrado. A página pública continua mostrando os ganhadores.' }
};

// ISO → "2026-12-11T21:00" no horário de Brasília (campo datetime-local).
function paraCampo(iso: string | null): string {
  return iso ? new Date(Date.parse(iso) - 3 * 3600_000).toISOString().slice(0, 16) : '';
}
const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function Insta({ arroba }: { arroba: string | null }) {
  if (!arroba) return <span className="adm-muted">—</span>;
  return (
    <a className="sa-insta" href={`https://instagram.com/${arroba}`} target="_blank" rel="noreferrer">
      @{arroba}
    </a>
  );
}

export default function SorteioAdmin({ inicial }: { inicial: DadosControle }) {
  const id = inicial.sorteio.id;
  const [dados, setDados] = useState(inicial);
  const [aba, setAba] = useState<Aba>(inicial.sorteio.status === 'rascunho' && !inicial.sorteio.teste ? 'configurar' : 'controle');
  const [aviso, setAviso] = useState<Aviso>(null);
  const [ocupado, setOcupado] = useState(false);

  const recarregar = useCallback(async () => {
    const d = await dadosControleAction(id).catch(() => null);
    if (d) setDados(d);
  }, [id]);

  // Controle: participantes e sorteios atualizam sozinhos.
  useEffect(() => {
    if (aba !== 'controle') return;
    const t = window.setInterval(recarregar, 4000);
    return () => window.clearInterval(t);
  }, [aba, recarregar]);

  // O aviso some sozinho.
  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), aviso.tipo === 'erro' ? 7000 : 3500);
    return () => window.clearTimeout(t);
  }, [aviso]);

  // Roda uma ação, mostra o resultado e recarrega.
  const executar = useCallback(
    async (acao: () => Promise<Resposta>, sucesso?: string) => {
      setOcupado(true);
      const r = await acao().catch(() => ({ ok: false as const, erro: 'A conexão falhou. Tente de novo.' }));
      setOcupado(false);
      setAviso(r.ok ? (sucesso ? { tipo: 'ok', texto: sucesso, id: Date.now() } : null) : { tipo: 'erro', texto: r.erro, id: Date.now() });
      await recarregar();
      return r.ok;
    },
    [recarregar]
  );

  const s = dados.sorteio;
  const [copiado, setCopiado] = useState(false);
  const linkPublico = `https://www.${SITE}/sorteio/${s.slug}`;

  return (
    <div className="sorteios-adm">
      <header className="sa-topo">
        <Link href="/admin#sorteios" className="sa-voltar">
          ← Sorteios
        </Link>
        <div className="sa-titulo">
          <span className="sa-rotulo">Sorteio ao vivo</span>
          <h1>{s.titulo}</h1>
        </div>
        <div className="sa-link">
          <code>
            {SITE}/sorteio/<b>{s.slug}</b>
          </code>
          <button
            type="button"
            className="btn ghost"
            onClick={() =>
              navigator.clipboard
                ?.writeText(linkPublico)
                .then(() => {
                  setCopiado(true);
                  window.setTimeout(() => setCopiado(false), 1800);
                })
                .catch(() => {})
            }
          >
            {copiado ? '✓ Copiado' : 'Copiar link'}
          </button>
          <a className="btn ghost" href={`/sorteio/${s.slug}`} target="_blank" rel="noreferrer">
            Abrir ↗
          </a>
        </div>
      </header>

      <Jornada dados={dados} executar={executar} ocupado={ocupado} irPara={setAba} />

      <nav className="sa-abas" role="tablist">
        {(
          [
            ['configurar', '⚙️', 'Configurar', 'textos, regras e prêmios'],
            ['controle', '🎛️', 'Controle', 'sortear e participantes'],
            ['telao', '📺', 'Telão', 'o que vai na live']
          ] as [Aba, string, string, string][]
        ).map(([a, icone, nome, dica]) => (
          <button key={a} type="button" role="tab" aria-selected={aba === a} className={aba === a ? 'is-on' : ''} onClick={() => setAba(a)}>
            <span aria-hidden="true">{icone}</span>
            <span>
              <b>{nome}</b>
              <small>{dica}</small>
            </span>
          </button>
        ))}
      </nav>

      <div className="sa-aba" key={aba}>
        {aba === 'configurar' && <Configurar dados={dados} executar={executar} ocupado={ocupado} />}
        {aba === 'controle' && <Controle dados={dados} executar={executar} ocupado={ocupado} irPara={setAba} />}
        {aba === 'telao' && <Telao id={id} />}
      </div>

      {aviso && (
        <p key={aviso.id} className={`sa-aviso is-${aviso.tipo}`} role="status" onClick={() => setAviso(null)}>
          {aviso.tipo === 'ok' ? '✓ ' : '⚠ '}
          {aviso.texto}
        </p>
      )}
    </div>
  );
}

type PropsAba = {
  dados: DadosControle;
  executar: (acao: () => Promise<Resposta>, sucesso?: string) => Promise<boolean>;
  ocupado: boolean;
  irPara?: (a: Aba) => void;
};

// ---------- Jornada (passos + próximo passo) ----------

function Jornada({ dados, executar, ocupado, irPara }: PropsAba) {
  const s = dados.sorteio;
  const atual = ORDEM_STATUS.indexOf(s.status);
  const proximo = proximoStatus(s.status);
  const passo = PASSOS[s.status];
  const semPremio = s.status === 'rascunho' && dados.premios.length === 0;
  return (
    <section className="sa-jornada">
      <ol className="sa-passos">
        {ORDEM_STATUS.map((st, i) => (
          <li key={st} className={i < atual ? 'is-feito' : i === atual ? 'is-atual' : undefined}>
            <span>{i < atual ? '✓' : i + 1}</span>
            {PASSOS[st].curto}
          </li>
        ))}
      </ol>
      <div className="sa-proximo">
        <div>
          <span className="sa-rotulo">
            Agora: {NOME_STATUS[s.status]}
            {s.teste && <em className="sa-chip is-ouro">Modo de teste</em>}
          </span>
          <p>{passo.explica}</p>
          {semPremio && <p className="sa-alerta">Cadastre pelo menos um prêmio (aba Configurar) antes de abrir as inscrições.</p>}
        </div>
        <div className="sa-proximo-acoes">
          {s.status === 'sorteando' && irPara && (
            <button type="button" className="btn ghost" onClick={() => irPara('telao')}>
              📺 Abrir telão
            </button>
          )}
          {proximo && passo.acao && (
            <button
              type="button"
              className="btn primary sa-botao-grande"
              disabled={ocupado || semPremio}
              onClick={() => window.confirm(passo.confirma ?? 'Continuar?') && executar(() => avancarStatusAction(s.id, s.status), `Agora: ${NOME_STATUS[proximo]}.`)}
            >
              {passo.acao} →
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------- Configurar ----------

function Configurar({ dados, executar, ocupado }: PropsAba) {
  const s = dados.sorteio;
  const [slug, setSlug] = useState(s.slug);
  const [bannerNovo, setBannerNovo] = useState<string | null>(null);
  useEffect(() => () => void (bannerNovo && URL.revokeObjectURL(bannerNovo)), [bannerNovo]);

  return (
    <div className="sa-config">
      <form
        className="sa-form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          executar(() => salvarSorteioAction(s.id, form), 'Alterações salvas.');
        }}
      >
        <section className="adm-card sa-bloco">
          <h3>
            <span className="sa-num">1</span> A página do sorteio
          </h3>
          <label className="sa-campo">
            <span>Título</span>
            <input name="titulo" defaultValue={s.titulo} maxLength={120} required placeholder="ex: Sorteio da live do TGA" />
          </label>
          <label className="sa-campo">
            <span>Link</span>
            <span className="sa-prefixo">
              <b>{SITE}/sorteio/</b>
              <input
                name="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                maxLength={60}
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
              />
            </span>
            <small>Só letras minúsculas, números e traço. Mudar o link depois de divulgar quebra o link antigo.</small>
          </label>
          <label className="sa-campo">
            <span>Descrição</span>
            <textarea name="descricao" defaultValue={s.descricao} rows={3} maxLength={2000} placeholder="Uma ou duas frases chamando a galera pra participar." />
          </label>
          <div className="sa-duas">
            <label className="sa-campo">
              <span>Data da live (horário de Brasília)</span>
              <input type="datetime-local" name="data" defaultValue={paraCampo(s.data)} />
            </label>
            <div className="sa-campo">
              <span>Banner (opcional)</span>
              <label className="sa-upload">
                {bannerNovo || s.banner ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={bannerNovo ?? s.banner ?? ''} alt="" />
                ) : (
                  <span>🖼️ Escolher imagem</span>
                )}
                <input
                  type="file"
                  name="banner"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setBannerNovo(f ? URL.createObjectURL(f) : null);
                  }}
                />
              </label>
              {s.banner && (
                <label className="sa-check">
                  <input type="checkbox" name="removerBanner" value="1" /> Remover o banner atual
                </label>
              )}
            </div>
          </div>
          <label className="sa-campo">
            <span>Mensagem pro ganhador</span>
            <textarea
              name="mensagemGanhador"
              defaultValue={s.mensagemGanhador}
              rows={2}
              maxLength={2000}
              placeholder="ex: Chama a gente no direct do Instagram em até 48 h pra receber o prêmio."
            />
            <small>Aparece só na tela de quem ganhou, junto com &quot;Você ganhou!&quot;.</small>
          </label>
        </section>

        <section className="adm-card sa-bloco">
          <h3>
            <span className="sa-num">2</span> Regulamento
          </h3>
          <label className="sa-campo">
            <span>Texto do regulamento</span>
            <textarea name="regulamento" defaultValue={s.regulamento} rows={7} maxLength={20000} placeholder="Quem pode participar, como é o sorteio, prazo pra resgatar o prêmio…" />
            <small>A pessoa precisa marcar que aceita antes de confirmar presença.</small>
          </label>
        </section>

        <section className="adm-card sa-bloco">
          <h3>
            <span className="sa-num">3</span> Antifraude
          </h3>
          <p className="adm-help">Todas as regras são checadas no servidor. Cada conta e cada @ do Instagram só participa uma vez.</p>
          <label className="sa-campo">
            <span>Máximo de participações pela mesma internet (IP)</span>
            <input type="number" name="limitePorIp" min={1} max={1000} defaultValue={s.limitePorIp ?? ''} placeholder="sem limite" className="sa-curto" />
            <small>3 é um bom número (uma casa com algumas pessoas). Vazio = sem limite.</small>
          </label>
          <label className="sa-chave">
            <input type="checkbox" name="bloquearDispositivo" value="1" defaultChecked={s.bloquearDispositivo} />
            <span className="sa-chave-trilho" aria-hidden="true" />
            <span>
              <b>Bloquear o mesmo aparelho em contas diferentes</b>
              <small>Evita alguém trocar de conta no mesmo celular pra participar de novo.</small>
            </span>
          </label>
          <label className="sa-campo">
            <span>Só contas criadas antes de (horário de Brasília)</span>
            <input type="datetime-local" name="contasCriadasAntes" defaultValue={paraCampo(s.contasCriadasAntes)} className="sa-curto" />
            <small>Ponha o horário de início da live: ninguém cria conta nova durante a live pra participar duas vezes. Vazio = qualquer conta.</small>
          </label>
        </section>

        <div className="sa-salvar">
          <button type="submit" className="btn primary sa-botao-grande" disabled={ocupado}>
            {ocupado ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </form>

      <Premios dados={dados} executar={executar} ocupado={ocupado} />

      {(s.status === 'rascunho' || s.teste) && (
        <section className="adm-card sa-perigo">
          <div>
            <h3>Apagar sorteio</h3>
            <p className="adm-help">Apaga o sorteio, os prêmios e os participantes de vez.</p>
          </div>
          <button
            type="button"
            className="btn ghost adm-danger"
            disabled={ocupado}
            onClick={async () => {
              if (!window.confirm(`Apagar o sorteio "${s.titulo}" de vez?`)) return;
              if (await executar(() => apagarSorteioAction(s.id))) window.location.href = '/admin#sorteios';
            }}
          >
            Apagar sorteio
          </button>
        </section>
      )}
    </div>
  );
}

function Premios({ dados, executar, ocupado }: PropsAba) {
  const s = dados.sorteio;
  const [editando, setEditando] = useState<number | 'novo' | null>(null);
  const [imagemNova, setImagemNova] = useState<string | null>(null);
  const premio = typeof editando === 'number' ? dados.premios.find((p) => p.id === editando) : null;
  const abrir = (v: number | 'novo' | null) => {
    setImagemNova(null);
    setEditando(v);
  };

  return (
    <section className="adm-card sa-bloco">
      <h3>
        <span className="sa-num">4</span> Prêmios
      </h3>
      <p className="adm-help">Saem na ordem da lista (o de cima primeiro). Um prêmio pode ter mais de um ganhador.</p>
      <ul className="sa-premios">
        {dados.premios.map((p, i) => (
          <li key={p.id} className={editando === p.id ? 'is-editando' : undefined}>
            <span className="sa-premio-ordem">{i + 1}º</span>
            <span className="sa-premio-foto">
              {p.imagem ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imagem} alt="" />
              ) : (
                '🎁'
              )}
            </span>
            <span className="sa-premio-info">
              <b>{p.nome}</b>
              <small>{p.ganhadores === 1 ? '1 ganhador' : `${p.ganhadores} ganhadores`}</small>
            </span>
            <button type="button" className="btn ghost" onClick={() => abrir(p.id)}>
              Editar
            </button>
            <button
              type="button"
              className="btn ghost adm-danger"
              disabled={ocupado}
              onClick={() => window.confirm(`Apagar o prêmio "${p.nome}"?`) && executar(() => apagarPremioAction(s.id, p.id), 'Prêmio apagado.')}
            >
              Apagar
            </button>
          </li>
        ))}
      </ul>

      {editando === null ? (
        <button type="button" className="sa-adicionar" onClick={() => abrir('novo')}>
          ＋ Adicionar prêmio
        </button>
      ) : (
        <form
          key={String(editando)}
          className="sa-premio-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            if (await executar(() => salvarPremioAction(s.id, premio?.id ?? null, form), 'Prêmio salvo.')) abrir(null);
          }}
        >
          <h4>{premio ? `Editar: ${premio.nome}` : 'Novo prêmio'}</h4>
          <div className="sa-premio-form-grade">
            <label className="sa-upload is-quadrado">
              {imagemNova || premio?.imagem ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagemNova ?? premio?.imagem ?? ''} alt="" />
              ) : (
                <span>🖼️ Foto</span>
              )}
              <input
                type="file"
                name="imagem"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setImagemNova(f ? URL.createObjectURL(f) : null);
                }}
              />
            </label>
            <div className="sa-premio-form-campos">
              <label className="sa-campo">
                <span>Nome do prêmio</span>
                <input name="nome" defaultValue={premio?.nome} maxLength={120} required placeholder="ex: Gift card Nintendo R$ 100" autoFocus />
              </label>
              <label className="sa-campo">
                <span>Descrição (opcional)</span>
                <textarea name="descricao" defaultValue={premio?.descricao} rows={2} maxLength={1000} />
              </label>
              <div className="sa-duas">
                <label className="sa-campo">
                  <span>Quantos ganhadores</span>
                  <input type="number" name="ganhadores" min={1} max={100} defaultValue={premio?.ganhadores ?? 1} required />
                </label>
                <label className="sa-campo">
                  <span>Posição na fila</span>
                  <input type="number" name="ordem" defaultValue={premio?.ordem ?? dados.premios.length + 1} />
                </label>
              </div>
              {premio?.imagem && (
                <label className="sa-check">
                  <input type="checkbox" name="removerImagem" value="1" /> Remover a foto atual
                </label>
              )}
            </div>
          </div>
          <div className="sa-linha">
            <button type="submit" className="btn primary" disabled={ocupado}>
              Salvar prêmio
            </button>
            <button type="button" className="btn ghost" onClick={() => abrir(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

// ---------- Controle (privado) ----------

type Part = DadosControle['participacoes'][number];

// Suspeito: mesmo IP ou mesmo aparelho que outra participação.
function useSuspeitas(participacoes: Part[]) {
  return useMemo(() => {
    const ips = new Map<string, number>();
    const aparelhos = new Map<string, number>();
    for (const p of participacoes) {
      if (p.teste) continue;
      if (p.ip) ips.set(p.ip, (ips.get(p.ip) ?? 0) + 1);
      if (p.dispositivo) aparelhos.set(p.dispositivo, (aparelhos.get(p.dispositivo) ?? 0) + 1);
    }
    return (p: Part) => {
      const m: string[] = [];
      const nIp = p.ip ? (ips.get(p.ip) ?? 0) : 0;
      const nAp = p.dispositivo ? (aparelhos.get(p.dispositivo) ?? 0) : 0;
      if (nIp > 1) m.push(`mesma internet de ${nIp} contas`);
      if (nAp > 1) m.push(`mesmo aparelho de ${nAp} contas`);
      return m;
    };
  }, [participacoes]);
}

function Controle({ dados, executar, ocupado, irPara }: PropsAba) {
  const s = dados.sorteio;
  const [premioEscolhido, setPremioEscolhido] = useState<string>('');
  const [quantosTeste, setQuantosTeste] = useState(50);
  const premioDe = (pid: number) => dados.premios.find((p) => p.id === pid)?.nome ?? 'Prêmio';
  const sorteiosParaRegras = dados.sorteios.map((x) => ({ id: x.id, premioId: x.premioId, entradaId: x.entradaId, vaga: x.vaga, anulado: x.anulado }));
  const vagaLivre = proximaVaga(dados.premios, sorteiosParaRegras);
  const suspeitas = useSuspeitas(dados.participacoes);
  const validos = dados.participacoes.filter((p) => !p.desclassificado).length;
  const desclassificados = dados.participacoes.length - validos;
  const suspeitos = dados.participacoes.filter((p) => !p.desclassificado && suspeitas(p).length > 0).length;
  const totalVagas = dados.premios.reduce((n, p) => n + p.ganhadores, 0);
  const valendo = dados.sorteios.filter((x) => !x.anulado).length;
  const testes = dados.participacoes.filter((p) => p.teste).length;

  return (
    <div className="sa-controle">
      <div className="sa-numeros">
        <div>
          <b>{validos.toLocaleString('pt-BR')}</b>
          <span>participantes</span>
        </div>
        <div className={suspeitos ? 'is-alerta' : undefined}>
          <b>{suspeitos}</b>
          <span>suspeitos</span>
        </div>
        <div>
          <b>{desclassificados}</b>
          <span>desclassificados</span>
        </div>
        <div>
          <b>
            {valendo}/{totalVagas}
          </b>
          <span>prêmios sorteados</span>
        </div>
      </div>

      <section className="adm-card sa-sortear">
        <div>
          <h3>🎲 Sortear</h3>
          {s.status === 'sorteando' ? (
            <p className="adm-help">
              {vagaLivre ? (
                <>
                  Próximo da fila: <b>{vagaLivre.premio.nome}</b>. Na live, use o <button type="button" className="adm-link" onClick={() => irPara?.('telao')}>Telão</button> e aperte Espaço.
                </>
              ) : (
                'Todos os prêmios já foram sorteados.'
              )}
            </p>
          ) : (
            <p className="adm-help">Libera quando o sorteio estiver em “Sorteando” (botão do próximo passo, lá em cima).</p>
          )}
        </div>
        <div className="sa-linha">
          <select value={premioEscolhido} onChange={(e) => setPremioEscolhido(e.target.value)} aria-label="Qual prêmio sortear">
            <option value="">Próximo da fila</option>
            {dados.premios.map((p) => (
              <option key={p.id} value={p.id} disabled={!proximaVaga(dados.premios, sorteiosParaRegras, p.id)}>
                {p.nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn primary sa-botao-grande"
            disabled={ocupado || s.status !== 'sorteando' || !vagaLivre}
            onClick={() => executar(() => sortearAction(s.id, premioEscolhido ? Number(premioEscolhido) : null), 'Sorteado! A roleta começa em instantes.')}
          >
            Sortear agora
          </button>
        </div>
      </section>

      <section className={`adm-card sa-teste${s.teste ? ' is-on' : ''}`}>
        <div>
          <h3>🧪 Modo de teste {s.teste ? <em className="sa-chip is-ouro">ligado</em> : <em className="sa-chip">desligado</em>}</h3>
          <p className="adm-help">
            {s.teste
              ? `Ensaio: gere participantes fictícios, avance até “Sorteando” e teste o telão. ${testes ? `${testes} fictícios agora.` : ''}`
              : s.status === 'rascunho'
                ? 'Ensaie a live inteira antes de valer: participantes fictícios, roleta e telão. No fim, um botão limpa tudo.'
                : 'O modo de teste só liga com o sorteio em rascunho.'}
          </p>
        </div>
        {s.teste ? (
          <div className="sa-linha">
            <input type="number" min={1} max={500} value={quantosTeste} onChange={(e) => setQuantosTeste(Number(e.target.value))} aria-label="Quantos participantes fictícios" className="sa-curto" />
            <button type="button" className="btn ghost" disabled={ocupado} onClick={() => executar(() => gerarTesteAction(s.id, quantosTeste), 'Participantes fictícios criados.')}>
              Gerar fictícios
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={ocupado}
              onClick={() => window.confirm('Recomeçar o ensaio? Apaga sorteios e participantes e volta pro rascunho (o modo de teste continua ligado).') && executar(() => resetarAction(s.id), 'Ensaio recomeçado.')}
            >
              Recomeçar ensaio
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={ocupado}
              onClick={() =>
                window.confirm('Desligar o modo de teste? Apaga tudo do ensaio (participantes e sorteios) e volta pro rascunho.') &&
                executar(() => modoTesteAction(s.id, false), 'Modo de teste desligado. Pronto pra valer.')
              }
            >
              Terminar ensaio e limpar
            </button>
          </div>
        ) : (
          s.status === 'rascunho' && (
            <button type="button" className="btn ghost" disabled={ocupado} onClick={() => executar(() => modoTesteAction(s.id, true), 'Modo de teste ligado.')}>
              Ligar modo de teste
            </button>
          )
        )}
      </section>

      <section className="adm-card">
        <h3>📜 Histórico de sorteios</h3>
        {dados.sorteios.length === 0 ? (
          <p className="adm-empty">Nenhum sorteio feito ainda.</p>
        ) : (
          <div className="sa-tabela">
            <table className="adm-jogos-tabela">
              <thead>
                <tr>
                  <th>Prêmio</th>
                  <th>Ganhador</th>
                  <th>Instagram</th>
                  <th>Quando</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {dados.sorteios.map((x) => (
                  <tr key={x.id} className={x.anulado ? 'is-anulado' : undefined}>
                    <td>
                      <b>{premioDe(x.premioId)}</b>
                      {x.vaga > 1 && <span className="adm-muted"> #{x.vaga}</span>}
                    </td>
                    <td>
                      <b>{x.ganhador.nome ?? '—'}</b>
                      <br />
                      <span className="adm-muted">{x.ganhador.email}</span>
                    </td>
                    <td>
                      <Insta arroba={x.ganhador.instagram} />
                    </td>
                    <td>{dataHora(x.criadoEm)}</td>
                    <td>
                      {x.anulado ? (
                        <span className="sa-chip">Anulado{x.motivoAnulado ? `: ${x.motivoAnulado}` : ''}</span>
                      ) : (
                        <span className="sa-chip is-verde">{x.refeito ? 'Re-sorteio' : 'Valendo'}</span>
                      )}
                    </td>
                    <td>
                      {!x.anulado && s.status === 'sorteando' && (
                        <button
                          type="button"
                          className="btn ghost"
                          disabled={ocupado}
                          onClick={() => {
                            const motivo = window.prompt('Por que sortear de novo? (ex: não respondeu em 48 h)');
                            if (motivo) executar(() => refazerSorteioAction(s.id, x.id, motivo), 'Novo sorteio feito. O anterior ficou no histórico.');
                          }}
                        >
                          Re-sortear
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Participantes dados={dados} executar={executar} ocupado={ocupado} />
    </div>
  );
}

function Participantes({ dados, executar, ocupado }: PropsAba) {
  const s = dados.sorteio;
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'suspeitos' | 'desclassificados'>('todos');
  const [verIps, setVerIps] = useState(false);
  const suspeitas = useSuspeitas(dados.participacoes);

  const q = busca.trim().toLowerCase().replace(/^@/, '');
  const lista = dados.participacoes.filter((p) => {
    const texto = `${p.nome ?? ''} ${p.email} ${p.instagram ?? ''} ${verIps ? (p.ip ?? '') : ''}`.toLowerCase();
    if (q && !texto.includes(q)) return false;
    if (filtro === 'suspeitos') return suspeitas(p).length > 0;
    if (filtro === 'desclassificados') return p.desclassificado;
    return true;
  });

  function exportarCsv() {
    const campo = (v: string | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const linhas = [
      ['nome', 'email', 'instagram', 'data', 'ip', 'navegador', 'aparelho', 'suspeita', 'ficticio', 'desclassificado', 'motivo'].join(';'),
      ...dados.participacoes.map((p) =>
        [
          p.nome,
          p.email,
          p.instagram ? `@${p.instagram}` : '',
          dataHora(p.criadoEm),
          p.ip,
          p.navegador,
          p.dispositivo,
          suspeitas(p).join(', '),
          p.teste ? 'sim' : 'não',
          p.desclassificado ? 'sim' : 'não',
          p.motivo
        ]
          .map(campo)
          .join(';')
      )
    ];
    const blob = new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `participantes-${s.slug}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section className="adm-card">
      <h3>👥 Participantes</h3>
      <div className="sa-filtros">
        <input type="search" placeholder="Buscar nome, e-mail ou @" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <div className="sa-segmento" role="group" aria-label="Filtrar">
          {(
            [
              ['todos', 'Todos'],
              ['suspeitos', 'Suspeitos'],
              ['desclassificados', 'Desclassificados']
            ] as const
          ).map(([v, nome]) => (
            <button key={v} type="button" className={filtro === v ? 'is-on' : ''} onClick={() => setFiltro(v)}>
              {nome}
            </button>
          ))}
        </div>
        <button type="button" className="btn ghost" onClick={() => setVerIps(!verIps)} aria-pressed={verIps}>
          {verIps ? '🙈 Esconder IPs' : '👁 Mostrar IPs'}
        </button>
        <button type="button" className="btn ghost" onClick={exportarCsv} disabled={!dados.participacoes.length}>
          ⬇ Exportar CSV
        </button>
      </div>
      {lista.length === 0 ? (
        <p className="adm-empty">{dados.participacoes.length ? 'Ninguém com esse filtro.' : 'Ninguém confirmou presença ainda.'}</p>
      ) : (
        <div className="sa-tabela">
          <table className="adm-jogos-tabela">
            <thead>
              <tr>
                <th>Participante</th>
                <th>Instagram</th>
                <th>Quando</th>
                <th>IP</th>
                <th>Alerta</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lista.slice(0, 500).map((p) => {
                const alerta = suspeitas(p);
                return (
                  <tr key={p.id} className={`${p.desclassificado ? 'is-desclassificado' : ''}${alerta.length ? ' is-suspeito' : ''}`}>
                    <td>
                      <b>{p.nome ?? '—'}</b>
                      {p.teste && <span className="sa-chip">fictício</span>}
                      <br />
                      <span className="adm-muted">{p.email}</span>
                    </td>
                    <td>
                      <Insta arroba={p.instagram} />
                    </td>
                    <td>{dataHora(p.criadoEm)}</td>
                    <td className="sa-ip" title={verIps ? undefined : 'Clique em "Mostrar IPs" pra ver completo'}>
                      {verIps ? (p.ip ?? '—') : mascararIp(p.ip)}
                    </td>
                    <td>
                      {p.desclassificado && <span className="sa-chip is-vermelho">Desclassificado{p.motivo ? `: ${p.motivo}` : ''}</span>}
                      {alerta.map((a) => (
                        <span key={a} className="sa-chip is-laranja">
                          ⚠ {a}
                        </span>
                      ))}
                      {!p.desclassificado && !alerta.length && <span className="adm-muted">—</span>}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`btn ghost${p.desclassificado ? '' : ' adm-danger'}`}
                        disabled={ocupado}
                        onClick={() => {
                          if (p.desclassificado) executar(() => desclassificarAction(s.id, p.id, false, ''), 'Participação reativada.');
                          else {
                            const motivo = window.prompt(`Desclassificar ${p.nome ?? p.email}? Escreva o motivo:`);
                            if (motivo !== null) executar(() => desclassificarAction(s.id, p.id, true, motivo), 'Participação desclassificada.');
                          }
                        }}
                      >
                        {p.desclassificado ? 'Reativar' : 'Desclassificar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {lista.length > 500 && <p className="adm-help">Mostrando 500 de {lista.length}. Use a busca ou o CSV.</p>}
        </div>
      )}
    </section>
  );
}

// ---------- Telão (vai na live) ----------

function Telao({ id }: { id: number }) {
  const caixa = useRef<HTMLDivElement>(null);
  const buscar = useCallback(() => estadoTelaoAction(id), [id]);
  const { estado, diferenca } = useEstadoSorteio(buscar, null, 1500);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [sorteando, setSorteando] = useState(false);

  const sortearProximo = useCallback(async () => {
    if (sorteando) return;
    setSorteando(true);
    const r = await sortearAction(id, null).catch(() => ({ ok: false as const, erro: 'A conexão falhou.' }));
    setSorteando(false);
    setMensagem(r.ok ? null : r.erro);
  }, [id, sorteando]);

  // Espaço = sortear o próximo prêmio (fora de campos de texto).
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (e.code !== 'Space' || e.repeat || (alvo && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(alvo.tagName))) return;
      e.preventDefault();
      sortearProximo();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [sortearProximo]);

  if (!estado) return <p className="adm-help">Carregando o telão…</p>;
  return (
    <>
      <div className="sa-telao-controles">
        <button type="button" className="btn primary" onClick={() => caixa.current?.requestFullscreen?.().catch(() => {})}>
          ⛶ Tela cheia
        </button>
        <button type="button" className="btn ghost" onClick={sortearProximo} disabled={sorteando || estado.sorteio.status !== 'sorteando'}>
          🎲 Sortear próximo <kbd>Espaço</kbd>
        </button>
        <span className="adm-help">
          {estado.sorteio.status === 'sorteando'
            ? 'Compartilhe esta tela na live. Só aparecem nomes curtos e e-mails mascarados.'
            : 'O sorteio ainda não está em “Sorteando”: dá pra ver como fica, mas não dá pra sortear.'}
        </span>
        {mensagem && <span className="sa-chip is-vermelho">{mensagem}</span>}
      </div>
      <div ref={caixa} className="sorteio-ui sorteio-telao">
        <div className="sorteio-telao-cabeca">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="XAN Switch" />
            <span className="sorteio-rotulo">Sorteio ao vivo</span>
            <h1 className="sorteio-titulo">{estado.sorteio.titulo}</h1>
          </div>
          <div className="sorteio-contador">
            <strong>{estado.participantes.toLocaleString('pt-BR')}</strong>
            <span>participantes</span>
          </div>
        </div>
        <PainelAoVivo estado={estado} diferenca={diferenca} />
        <div className="sorteio-secao" style={{ marginTop: 28 }}>
          <h2 className="sorteio-titulo-secao">
            <span className="sorteio-rotulo">Em jogo</span>
            Prêmios
          </h2>
          <ListaPremios estado={estado} />
        </div>
        <p className="sorteio-telao-rodape">
          {estado.sorteio.status === 'abertas' ? 'Participe' : 'Acompanhe'} em <strong>{SITE}/sorteio/{estado.sorteio.slug}</strong>
        </p>
      </div>
    </>
  );
}
