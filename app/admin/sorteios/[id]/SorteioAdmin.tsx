'use client';

// Painel de um sorteio ao vivo. O sorteio é a página (rascunho → publicado
// → encerrado) e tem vários itens, cada um com as próprias inscrições
// (em breve → abertas → encerradas) e sorteado na sua hora. Três abas:
//  - Configurar: textos, link, regras antifraude e os itens;
//  - Itens e sorteio (privada): abrir/encerrar cada item, sortear, testar,
//    histórico e participantes (IP escondido, suspeitos, desclassificar, CSV);
//  - Telão (vai na live): só nomes curtos e e-mails mascarados, tela cheia,
//    Espaço = sortear e "Testar roleta" (ensaio que não grava nada).
// Visual em ../sorteios-admin.css (painel) e app/sorteio/sorteio.css (telão).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  DURACAO_ANIMACAO_MS,
  ESPERA_INICIO_MS,
  NOME_STATUS,
  NOME_STATUS_ITEM,
  ORDEM_STATUS,
  mascararIp,
  montarRoleta,
  proximoStatus,
  type StatusItem,
  type StatusSorteio
} from '@/lib/sorteio/regras';
import type { EstadoPublico, SorteioPublico } from '@/lib/sorteio/estado';
import { ListaPremios, PainelAoVivo, quando, useEstadoSorteio } from '@/app/sorteio/AoVivo';
import {
  apagarPremioAction,
  apagarSorteioAction,
  avancarStatusAction,
  dadosControleAction,
  desclassificarAction,
  estadoTelaoAction,
  mudarStatusItemAction,
  refazerSorteioAction,
  salvarPremioAction,
  salvarSorteioAction,
  sortearAction,
  type DadosControle
} from '../actions';

type Aba = 'configurar' | 'itens' | 'telao';
type Aviso = { tipo: 'ok' | 'erro'; texto: string; id: number } | null;
type Resposta = { ok: true } | { ok: false; erro: string };
type Premio = DadosControle['premios'][number];

const SITE = 'xanswitch.com.br';

// O que cada passo do sorteio (a página) significa e o botão do próximo.
const PASSOS: Record<StatusSorteio, { curto: string; explica: string; acao?: string; confirma?: string }> = {
  rascunho: {
    curto: 'Rascunho',
    explica: 'Só você vê a página. Preencha a aba Configurar e cadastre os itens. Dá pra testar a roleta a qualquer hora na aba Telão.',
    acao: 'Publicar a página',
    confirma: 'Publicar a página do sorteio? O link fica público. As inscrições de cada item você abre na aba "Itens e sorteio".'
  },
  abertas: {
    curto: 'Publicado',
    explica: 'A página está no ar. Em "Itens e sorteio", abra as inscrições de cada item, encerre na hora e sorteie pelo Telão.',
    acao: 'Encerrar o sorteio',
    confirma: 'Encerrar o sorteio todo? Ninguém mais se inscreve e não dá pra sortear mais nada. A página continua mostrando os ganhadores.'
  },
  finalizado: { curto: 'Encerrado', explica: 'Sorteio encerrado. A página continua no ar mostrando os ganhadores.' }
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

// Quantos ganhadores (valendo) o item já tem.
const sorteadosDo = (dados: DadosControle, premioId: number) => dados.sorteios.filter((x) => x.premioId === premioId && !x.anulado).length;

// estadoTelao: estado do telão já pronto (opcional; sem ele, o telão busca sozinho).
export default function SorteioAdmin({ inicial, estadoTelao = null }: { inicial: DadosControle; estadoTelao?: EstadoPublico | null }) {
  const id = inicial.sorteio.id;
  const [dados, setDados] = useState(inicial);
  const [aba, setAba] = useState<Aba>(inicial.sorteio.status === 'rascunho' ? 'configurar' : 'itens');
  const [aviso, setAviso] = useState<Aviso>(null);
  const [ocupado, setOcupado] = useState(false);
  // "Testar" num item leva pro telão e roda o ensaio daquele item.
  const [pedidoEnsaio, setPedidoEnsaio] = useState<{ premioId: number; vez: number } | null>(null);

  const recarregar = useCallback(async () => {
    const d = await dadosControleAction(id).catch(() => null);
    if (d) setDados(d);
  }, [id]);

  // Itens e participantes atualizam sozinhos.
  useEffect(() => {
    if (aba !== 'itens') return;
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

  const testar = (premioId: number) => {
    setPedidoEnsaio({ premioId, vez: Date.now() });
    setAba('telao');
  };

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
            ['configurar', '⚙️', 'Configurar', 'textos, regras e itens'],
            ['itens', '🎛️', 'Itens e sorteio', 'inscrições, sortear, participantes'],
            ['telao', '📺', 'Telão', 'o que vai na live · testar']
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
        {aba === 'itens' && <Itens dados={dados} executar={executar} ocupado={ocupado} irPara={setAba} testar={testar} />}
        {aba === 'telao' && <Telao id={id} pedidoEnsaio={pedidoEnsaio} inicial={estadoTelao} />}
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
  testar?: (premioId: number) => void;
};

// ---------- Jornada (situação da página) ----------

function Jornada({ dados, executar, ocupado, irPara }: PropsAba) {
  const s = dados.sorteio;
  const atual = ORDEM_STATUS.indexOf(s.status);
  const proximo = proximoStatus(s.status);
  const passo = PASSOS[s.status];
  const semItem = s.status === 'rascunho' && dados.premios.length === 0;
  return (
    <section className="sa-jornada">
      <ol className="sa-passos is-3">
        {ORDEM_STATUS.map((st, i) => (
          <li key={st} className={i < atual ? 'is-feito' : i === atual ? 'is-atual' : undefined}>
            <span>{i < atual ? '✓' : i + 1}</span>
            {PASSOS[st].curto}
          </li>
        ))}
      </ol>
      <div className="sa-proximo">
        <div>
          <span className="sa-rotulo">Página: {NOME_STATUS[s.status]}</span>
          <p>{passo.explica}</p>
          {semItem && <p className="sa-alerta">Cadastre pelo menos um item (aba Configurar) antes de publicar.</p>}
        </div>
        <div className="sa-proximo-acoes">
          {s.status === 'abertas' && irPara && (
            <button type="button" className="btn ghost" onClick={() => irPara('telao')}>
              📺 Abrir telão
            </button>
          )}
          {proximo && passo.acao && (
            <button
              type="button"
              className={`btn ${s.status === 'rascunho' ? 'primary sa-botao-grande' : 'ghost'}`}
              disabled={ocupado || semItem}
              onClick={() => window.confirm(passo.confirma ?? 'Continuar?') && executar(() => avancarStatusAction(s.id, s.status), `Página: ${NOME_STATUS[proximo]}.`)}
            >
              {passo.acao} {s.status === 'rascunho' ? '→' : ''}
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
            <input name="titulo" defaultValue={s.titulo} maxLength={120} required placeholder="ex: Sorteios da live do TGA" />
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
            <small>A pessoa precisa marcar que aceita antes de se inscrever nos itens.</small>
          </label>
        </section>

        <section className="adm-card sa-bloco">
          <h3>
            <span className="sa-num">3</span> Antifraude
          </h3>
          <p className="adm-help">Todas as regras são checadas no servidor. Em cada item, cada conta e cada @ do Instagram só se inscreve uma vez.</p>
          <label className="sa-campo">
            <span>Máximo de contas pela mesma internet (IP) em cada item</span>
            <input type="number" name="limitePorIp" min={1} max={1000} defaultValue={s.limitePorIp ?? ''} placeholder="sem limite" className="sa-curto" />
            <small>3 é um bom número (uma casa com algumas pessoas). Vazio = sem limite.</small>
          </label>
          <label className="sa-chave">
            <input type="checkbox" name="bloquearDispositivo" value="1" defaultChecked={s.bloquearDispositivo} />
            <span className="sa-chave-trilho" aria-hidden="true" />
            <span>
              <b>Bloquear o mesmo aparelho em contas diferentes</b>
              <small>Evita alguém trocar de conta no mesmo celular pra se inscrever de novo no mesmo item.</small>
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

      <EditorItens dados={dados} executar={executar} ocupado={ocupado} />

      <section className="adm-card sa-perigo">
        <div>
          <h3>Apagar sorteio</h3>
          <p className="adm-help">Apaga o sorteio, os itens, as inscrições e os ganhadores de vez.</p>
        </div>
        <button
          type="button"
          className="btn ghost adm-danger"
          disabled={ocupado}
          onClick={async () => {
            const aviso = s.status === 'rascunho' ? '' : ' A página está publicada e as inscrições e ganhadores serão perdidos.';
            if (!window.confirm(`Apagar o sorteio "${s.titulo}" de vez?${aviso}`)) return;
            if (await executar(() => apagarSorteioAction(s.id))) window.location.href = '/admin#sorteios';
          }}
        >
          Apagar sorteio
        </button>
      </section>
    </div>
  );
}

function EditorItens({ dados, executar, ocupado }: PropsAba) {
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
        <span className="sa-num">4</span> Itens do sorteio
      </h3>
      <p className="adm-help">
        Cada item é sorteado na sua hora, com as próprias inscrições: a pessoa escolhe de quais participa, e pode ganhar mais de um. Um item pode ter mais de um ganhador.
      </p>
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
              <small>
                {p.ganhadores === 1 ? '1 ganhador' : `${p.ganhadores} ganhadores`}
                {p.data ? ` · sorteio ${quando(p.data)}` : ''}
              </small>
            </span>
            <button type="button" className="btn ghost" onClick={() => abrir(p.id)}>
              Editar
            </button>
            <button
              type="button"
              className="btn ghost adm-danger"
              disabled={ocupado}
              onClick={() => window.confirm(`Apagar o item "${p.nome}"? As inscrições dele também somem.`) && executar(() => apagarPremioAction(s.id, p.id), 'Item apagado.')}
            >
              Apagar
            </button>
          </li>
        ))}
      </ul>

      {editando === null ? (
        <button type="button" className="sa-adicionar" onClick={() => abrir('novo')}>
          ＋ Adicionar item
        </button>
      ) : (
        <form
          key={String(editando)}
          className="sa-premio-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            if (await executar(() => salvarPremioAction(s.id, premio?.id ?? null, form), 'Item salvo.')) abrir(null);
          }}
        >
          <h4>{premio ? `Editar: ${premio.nome}` : 'Novo item'}</h4>
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
                <span>Nome do item</span>
                <input name="nome" defaultValue={premio?.nome} maxLength={120} required placeholder="ex: Gift card Nintendo R$ 100" autoFocus />
              </label>
              <label className="sa-campo">
                <span>Descrição (opcional)</span>
                <textarea name="descricao" defaultValue={premio?.descricao} rows={2} maxLength={1000} />
              </label>
              <div className="sa-duas">
                <label className="sa-campo">
                  <span>Hora do sorteio (opcional)</span>
                  <input type="datetime-local" name="data" defaultValue={paraCampo(premio?.data ?? null)} />
                  <small>Aparece na página: “Sorteio 11 de dez. · 21h”.</small>
                </label>
                <label className="sa-campo">
                  <span>Quantos ganhadores</span>
                  <input type="number" name="ganhadores" min={1} max={100} defaultValue={premio?.ganhadores ?? 1} required />
                </label>
                <label className="sa-campo">
                  <span>Posição na lista</span>
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
              Salvar item
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

// ---------- Itens e sorteio (privado) ----------

type Part = DadosControle['participacoes'][number];

// Suspeito: mesma internet (IP) ou mesmo aparelho que OUTRA conta. A mesma
// pessoa em vários itens não conta (conta pessoas, não inscrições).
function useSuspeitas(participacoes: Part[]) {
  return useMemo(() => {
    const ips = new Map<string, Set<string>>();
    const aparelhos = new Map<string, Set<string>>();
    const juntar = (m: Map<string, Set<string>>, chave: string, usuario: string) => {
      if (!m.has(chave)) m.set(chave, new Set());
      m.get(chave)!.add(usuario);
    };
    for (const p of participacoes) {
      if (p.teste) continue;
      if (p.ip) juntar(ips, p.ip, p.usuario);
      if (p.dispositivo) juntar(aparelhos, p.dispositivo, p.usuario);
    }
    return (p: Part) => {
      const m: string[] = [];
      const nIp = p.ip ? (ips.get(p.ip)?.size ?? 0) : 0;
      const nAp = p.dispositivo ? (aparelhos.get(p.dispositivo)?.size ?? 0) : 0;
      if (nIp > 1) m.push(`mesma internet de ${nIp} contas`);
      if (nAp > 1) m.push(`mesmo aparelho de ${nAp} contas`);
      return m;
    };
  }, [participacoes]);
}

function Itens({ dados, executar, ocupado, irPara, testar }: PropsAba) {
  const s = dados.sorteio;
  const suspeitas = useSuspeitas(dados.participacoes);
  const pessoas = new Set(dados.participacoes.filter((p) => !p.desclassificado).map((p) => p.usuario)).size;
  const suspeitos = new Set(dados.participacoes.filter((p) => !p.desclassificado && suspeitas(p).length > 0).map((p) => p.usuario)).size;
  const totalVagas = dados.premios.reduce((n, p) => n + p.ganhadores, 0);
  const valendo = dados.sorteios.filter((x) => !x.anulado).length;

  return (
    <div className="sa-controle">
      <div className="sa-numeros">
        <div>
          <b>{pessoas.toLocaleString('pt-BR')}</b>
          <span>pessoas inscritas</span>
        </div>
        <div className={suspeitos ? 'is-alerta' : undefined}>
          <b>{suspeitos}</b>
          <span>suspeitos</span>
        </div>
        <div>
          <b>{dados.premios.length}</b>
          <span>itens</span>
        </div>
        <div>
          <b>
            {valendo}/{totalVagas}
          </b>
          <span>ganhadores sorteados</span>
        </div>
      </div>

      {s.status === 'rascunho' && (
        <p className="sa-faixa">A página ainda é rascunho: as pessoas só conseguem se inscrever depois de “Publicar a página” (lá em cima).</p>
      )}

      {dados.premios.length === 0 ? (
        <section className="adm-card">
          <p className="adm-empty">Nenhum item ainda. Cadastre os itens na aba Configurar.</p>
        </section>
      ) : (
        <ul className="sa-itens">
          {dados.premios.map((p) => (
            <CartaoItem key={p.id} dados={dados} premio={p} executar={executar} ocupado={ocupado} irPara={irPara} testar={testar} />
          ))}
        </ul>
      )}

      <Historico dados={dados} executar={executar} ocupado={ocupado} />
      <Participantes dados={dados} executar={executar} ocupado={ocupado} />
    </div>
  );
}

// Um item: situação, inscritos, ganhadores e os botões do próximo passo.
function CartaoItem({ dados, premio: p, executar, ocupado, irPara, testar }: PropsAba & { premio: Premio }) {
  const s = dados.sorteio;
  const feitos = sorteadosDo(dados, p.id);
  const completo = feitos >= p.ganhadores;
  const ganhadores = dados.sorteios.filter((x) => x.premioId === p.id && !x.anulado);
  const mudar = (de: StatusItem, para: StatusItem, msg: string, confirma?: string) => {
    if (confirma && !window.confirm(confirma)) return;
    executar(() => mudarStatusItemAction(s.id, p.id, de, para), msg);
  };
  const situacao = completo ? 'sorteado' : p.status;

  return (
    <li className={`adm-card sa-item is-${situacao}`}>
      <div className="sa-item-topo">
        <span className="sa-premio-foto">
          {p.imagem ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imagem} alt="" />
          ) : (
            '🎁'
          )}
        </span>
        <div className="sa-item-nome">
          <b>{p.nome}</b>
          <small>
            {p.ganhadores === 1 ? '1 ganhador' : `${p.ganhadores} ganhadores`}
            {p.data ? ` · sorteio ${quando(p.data)}` : ''}
          </small>
        </div>
        <span className={`sa-chip is-${completo ? 'verde' : p.status === 'abertas' ? 'verde' : p.status === 'encerradas' ? 'laranja' : 'cinza'}`}>
          {completo ? '🏆 Sorteado' : NOME_STATUS_ITEM[p.status]}
        </span>
      </div>

      <div className="sa-item-numeros">
        <span>
          <b>{p.participantes}</b> {p.participantes === 1 ? 'inscrito' : 'inscritos'}
        </span>
        <span>
          <b>
            {feitos}/{p.ganhadores}
          </b>{' '}
          sorteados
        </span>
      </div>

      {ganhadores.length > 0 && (
        <ul className="sa-item-ganhadores">
          {ganhadores.map((g) => (
            <li key={g.id}>
              🏆 <b>{g.ganhador.nome ?? g.ganhador.email}</b> <Insta arroba={g.ganhador.instagram} />
            </li>
          ))}
        </ul>
      )}

      <div className="sa-item-acoes">
        {p.status === 'em_breve' && (
          <button
            type="button"
            className="btn primary"
            disabled={ocupado || s.status === 'finalizado'}
            onClick={() => mudar('em_breve', 'abertas', `Inscrições abertas: ${p.nome}.`)}
          >
            Abrir inscrições
          </button>
        )}
        {p.status === 'abertas' && (
          <button
            type="button"
            className="btn primary"
            disabled={ocupado}
            onClick={() => mudar('abertas', 'encerradas', `Inscrições encerradas: ${p.nome}. Já dá pra sortear.`, `Encerrar as inscrições de "${p.nome}"? Ninguém mais entra neste item.`)}
          >
            Encerrar inscrições
          </button>
        )}
        {p.status === 'encerradas' && !completo && (
          <>
            <button
              type="button"
              className="btn primary sa-botao-grande"
              disabled={ocupado || s.status !== 'abertas'}
              onClick={() => executar(() => sortearAction(s.id, p.id), 'Sorteado! A roleta começa em instantes.')}
            >
              🎲 Sortear agora
            </button>
            {irPara && (
              <button type="button" className="btn ghost" onClick={() => irPara('telao')}>
                📺 Sortear pelo telão
              </button>
            )}
          </>
        )}
        {p.status === 'encerradas' && feitos === 0 && (
          <button type="button" className="btn ghost" disabled={ocupado} onClick={() => mudar('encerradas', 'abertas', `Inscrições reabertas: ${p.nome}.`)}>
            Reabrir inscrições
          </button>
        )}
        {testar && (
          <button type="button" className="btn ghost" onClick={() => testar(p.id)} title="Roda a roleta no telão com nomes fictícios. Não grava nada.">
            🧪 Testar
          </button>
        )}
      </div>
      {p.status === 'encerradas' && !completo && s.status === 'rascunho' && <p className="adm-help">Publique a página pra poder sortear.</p>}
    </li>
  );
}

function Historico({ dados, executar, ocupado }: PropsAba) {
  const s = dados.sorteio;
  const premioDe = (pid: number) => dados.premios.find((p) => p.id === pid)?.nome ?? 'Item';
  return (
    <section className="adm-card">
      <h3>📜 Histórico de sorteios</h3>
      {dados.sorteios.length === 0 ? (
        <p className="adm-empty">Nenhum sorteio feito ainda.</p>
      ) : (
        <div className="sa-tabela">
          <table className="adm-jogos-tabela">
            <thead>
              <tr>
                <th>Item</th>
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
                    {!x.anulado && s.status === 'abertas' && (
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
  );
}

function Participantes({ dados, executar, ocupado }: PropsAba) {
  const s = dados.sorteio;
  const [busca, setBusca] = useState('');
  const [item, setItem] = useState<string>('');
  const [filtro, setFiltro] = useState<'todos' | 'suspeitos' | 'desclassificados'>('todos');
  const [verIps, setVerIps] = useState(false);
  const suspeitas = useSuspeitas(dados.participacoes);
  const premioDe = (pid: number | null) => dados.premios.find((p) => p.id === pid)?.nome ?? '—';

  const q = busca.trim().toLowerCase().replace(/^@/, '');
  const lista = dados.participacoes.filter((p) => {
    if (item && String(p.premioId) !== item) return false;
    const texto = `${p.nome ?? ''} ${p.email} ${p.instagram ?? ''} ${verIps ? (p.ip ?? '') : ''}`.toLowerCase();
    if (q && !texto.includes(q)) return false;
    if (filtro === 'suspeitos') return suspeitas(p).length > 0;
    if (filtro === 'desclassificados') return p.desclassificado;
    return true;
  });

  function exportarCsv() {
    const campo = (v: string | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const linhas = [
      ['item', 'nome', 'email', 'instagram', 'data', 'ip', 'navegador', 'aparelho', 'suspeita', 'desclassificado', 'motivo'].join(';'),
      ...lista.map((p) =>
        [
          premioDe(p.premioId),
          p.nome,
          p.email,
          p.instagram ? `@${p.instagram}` : '',
          dataHora(p.criadoEm),
          p.ip,
          p.navegador,
          p.dispositivo,
          suspeitas(p).join(', '),
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
      <h3>👥 Inscrições</h3>
      <div className="sa-filtros">
        <input type="search" placeholder="Buscar nome, e-mail ou @" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select value={item} onChange={(e) => setItem(e.target.value)} aria-label="Filtrar por item" className="sa-filtro-item">
          <option value="">Todos os itens</option>
          {dados.premios.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
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
        <button type="button" className="btn ghost" onClick={exportarCsv} disabled={!lista.length}>
          ⬇ Exportar CSV
        </button>
      </div>
      {lista.length === 0 ? (
        <p className="adm-empty">{dados.participacoes.length ? 'Ninguém com esse filtro.' : 'Ninguém se inscreveu ainda.'}</p>
      ) : (
        <div className="sa-tabela">
          <table className="adm-jogos-tabela">
            <thead>
              <tr>
                <th>Participante</th>
                <th>Item</th>
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
                    <td>{premioDe(p.premioId)}</td>
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
                          if (p.desclassificado) executar(() => desclassificarAction(s.id, p.id, false, ''), 'Inscrição reativada.');
                          else {
                            const motivo = window.prompt(`Desclassificar ${p.nome ?? p.email} de "${premioDe(p.premioId)}"? Escreva o motivo:`);
                            if (motivo !== null) executar(() => desclassificarAction(s.id, p.id, true, motivo), 'Inscrição desclassificada.');
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

const NOMES_ENSAIO = ['Ana S.', 'Bruno L.', 'Carla M.', 'Diego R.', 'Elisa C.', 'Fábio A.', 'Gabi P.', 'Hugo T.', 'Iara G.', 'João V.', 'Kauã B.', 'Lara F.', 'Mateus O.', 'Nina R.'];

// Um sorteio de mentira, só nesta tela: id negativo (não conta como
// ganhador) e nada é gravado.
function sorteioDeEnsaio(premioId: number, agoraServidor: number): SorteioPublico {
  const sortear = (n: number) => Math.floor(Math.random() * n);
  const ganhador = NOMES_ENSAIO[sortear(NOMES_ENSAIO.length)];
  return {
    id: -Date.now(),
    premioId,
    vaga: 1,
    inicio: agoraServidor + ESPERA_INICIO_MS,
    duracao: DURACAO_ANIMACAO_MS,
    roleta: montarRoleta(
      NOMES_ENSAIO.filter((n) => n !== ganhador),
      ganhador,
      sortear
    ),
    ganhador: { codigo: 'ensaio', nome: ganhador, email: 'en***@teste.com', instagram: 'perfil.de.teste' },
    refeito: false
  };
}

function Telao({
  id,
  pedidoEnsaio,
  inicial
}: {
  id: number;
  pedidoEnsaio: { premioId: number; vez: number } | null;
  inicial: EstadoPublico | null;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const buscar = useCallback(() => estadoTelaoAction(id), [id]);
  const { estado, diferenca } = useEstadoSorteio(buscar, inicial, 1500);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [sorteando, setSorteando] = useState(false);
  const [escolhido, setEscolhido] = useState<string>('');
  const [ensaio, setEnsaio] = useState<SorteioPublico | null>(null);

  // Itens prontos pra sortear: inscrições encerradas e vaga livre.
  const prontos = (estado?.premios ?? []).filter(
    (p) => p.status === 'encerradas' && (estado?.sorteios ?? []).filter((x) => x.id > 0 && x.premioId === p.id).length < p.ganhadores
  );
  const alvo = estado?.premios.find((p) => String(p.id) === escolhido) ?? prontos[0] ?? estado?.premios[0];
  const podeSortear = !!alvo && prontos.some((p) => p.id === alvo.id) && estado?.sorteio.status === 'abertas';

  const testarRoleta = useCallback(
    (premioId: number) => {
      setMensagem(null);
      setEnsaio(sorteioDeEnsaio(premioId, Date.now() + diferenca));
    },
    [diferenca]
  );

  // O ensaio some sozinho depois do destaque do ganhador.
  useEffect(() => {
    if (!ensaio) return;
    const t = window.setTimeout(() => setEnsaio(null), ensaio.inicio - (Date.now() + diferenca) + ensaio.duracao + 9000);
    return () => window.clearTimeout(t);
  }, [ensaio, diferenca]);

  // "Testar" num item da outra aba: roda o ensaio assim que o telão carrega.
  const ultimoPedido = useRef<number | null>(null);
  useEffect(() => {
    if (!estado || !pedidoEnsaio || ultimoPedido.current === pedidoEnsaio.vez) return;
    ultimoPedido.current = pedidoEnsaio.vez;
    setEscolhido(String(pedidoEnsaio.premioId));
    testarRoleta(pedidoEnsaio.premioId);
  }, [estado, pedidoEnsaio, testarRoleta]);

  const sortearProximo = useCallback(async () => {
    if (sorteando || !alvo) return;
    if (ensaio) {
      setMensagem('Espere o teste terminar.');
      return;
    }
    setSorteando(true);
    const r = await sortearAction(id, alvo.id).catch(() => ({ ok: false as const, erro: 'A conexão falhou.' }));
    setSorteando(false);
    setMensagem(r.ok ? null : r.erro);
  }, [id, sorteando, alvo, ensaio]);

  // Espaço = sortear o item escolhido (fora de campos e botões).
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.code !== 'Space' || e.repeat || (el && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(el.tagName))) return;
      e.preventDefault();
      sortearProximo();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [sortearProximo]);

  if (!estado) return <p className="adm-help">Carregando o telão…</p>;
  const exibido: EstadoPublico = ensaio ? { ...estado, sorteios: [...estado.sorteios, ensaio] } : estado;

  return (
    <>
      <div className="sa-telao-controles">
        <select value={alvo ? String(alvo.id) : ''} onChange={(e) => setEscolhido(e.target.value)} aria-label="Item a sortear" className="sa-filtro-item">
          {estado.premios.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} {prontos.some((x) => x.id === p.id) ? '· pronto pra sortear' : `· ${NOME_STATUS_ITEM[p.status].toLowerCase()}`}
            </option>
          ))}
        </select>
        <button type="button" className="btn primary" onClick={sortearProximo} disabled={sorteando || !podeSortear}>
          🎲 Sortear <kbd>Espaço</kbd>
        </button>
        <button type="button" className="btn ghost" onClick={() => alvo && testarRoleta(alvo.id)} disabled={!alvo || !!ensaio}>
          🧪 Testar roleta
        </button>
        <button type="button" className="btn ghost" onClick={() => caixa.current?.requestFullscreen?.().catch(() => {})}>
          ⛶ Tela cheia
        </button>
        {mensagem && <span className="sa-chip is-vermelho">{mensagem}</span>}
      </div>
      <p className="adm-help sa-telao-dica">
        {podeSortear
          ? 'Compartilhe esta tela na live. Só aparecem nomes curtos e e-mails mascarados.'
          : alvo
            ? alvo.status === 'encerradas'
              ? estado.sorteio.status !== 'abertas'
                ? 'Publique a página pra poder sortear.'
                : 'Esse item já tem todos os ganhadores.'
              : `Pra sortear "${alvo.nome}", encerre as inscrições dele na aba "Itens e sorteio".`
            : 'Cadastre um item na aba Configurar.'}{' '}
        “Testar roleta” roda tudo com nomes fictícios, só nesta tela, e não grava nada.
      </p>
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
        <PainelAoVivo estado={exibido} diferenca={diferenca} />
        <div className="sorteio-secao" style={{ marginTop: 28 }}>
          <h2 className="sorteio-titulo-secao">
            <span className="sorteio-rotulo">Em jogo</span>
            Itens
          </h2>
          <ListaPremios estado={estado} />
        </div>
        <p className="sorteio-telao-rodape">
          Participe em <strong>
            {SITE}/sorteio/{estado.sorteio.slug}
          </strong>
        </p>
      </div>
    </>
  );
}
