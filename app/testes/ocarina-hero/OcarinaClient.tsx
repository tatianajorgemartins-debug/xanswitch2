'use client';

// Tela do "Ocarina Hero": menu (Música do Dia + modo livre), a partida em
// tela cheia, o resultado, configurar teclas e calibrar o atraso do som.
// ?editor=1 abre o modo gravar (Editor.tsx).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { diaEm, formatarContador, msAteProximoDia } from '@/lib/jogos/dia';
import { numeroDoDia, sortearDoDia } from '@/lib/jogos/sorteio';
import { ler, gravar } from '@/lib/jogos/armazenamento';
import { registrarDiario, resultadoDoDia, sequenciaGeralHoje } from '@/lib/jogos/progresso';
import { compartilharTexto } from '@/lib/jogos/compartilhar';
import { guardarPublicavel, registrarJogada } from '@/lib/jogos/registro';
import { normalizar } from '@/lib/jogos/respostas';
import {
  DIFICULDADES,
  INICIO,
  JOGO,
  JOGO_ORIGINAIS,
  duracaoMusica,
  ehNova,
  formatarDuracao,
  PISTAS,
  PRECISAO_PADRAO,
  PRECISOES,
  ehPrecisao,
  TECLAS_ALTERNATIVAS,
  TECLAS_PADRAO,
  desenhoEstrelas,
  migrarTeclas,
  nomeTecla,
  pistaDaTecla,
  textoCompartilhar,
  type Chart,
  type MapaTeclas,
  type PistaId,
  type Precisao,
  type ResultadoMusica
} from './ocarina';
import { SomOcarina } from './som';
import { MotorOcarina, carregarImagensOcarina } from './motor';
import Palco from './Palco';
import { OC_FONTES } from './fontes';
import './ocarina.css';

const Editor = dynamic(() => import('./Editor'), { ssr: false });

type Tela =
  | { tipo: 'menu' }
  | { tipo: 'jogo'; chart: Chart; diario: boolean; rodada: number; audio: AudioBuffer | null }
  | { tipo: 'resultado'; chart: Chart; diario: boolean; r: ResultadoMusica; recorde: boolean }
  | { tipo: 'teclas' }
  | { tipo: 'calibrar' };

type Recordes = Record<string, ResultadoMusica>;

export const CHAVE_TECLAS = 'ocarina_teclas';
export const CHAVE_LATENCIA = 'ocarina_latencia';
export const CHAVE_PRECISAO = 'ocarina_precisao';
const CHAVE_RECORDES = 'ocarina_recordes';

export function lerTeclas(): MapaTeclas {
  const t = ler<Record<string, string>>(CHAVE_TECLAS, {});
  return { ...TECLAS_PADRAO, ...migrarTeclas(t) };
}

export default function OcarinaClient({ charts }: { charts: Chart[] }) {
  const [dia, setDia] = useState<string | null>(null);
  const [restante, setRestante] = useState(0);
  const [editor, setEditor] = useState(false);
  const [tela, setTela] = useState<Tela>({ tipo: 'menu' });
  const [teclas, setTeclas] = useState<MapaTeclas>(TECLAS_PADRAO);
  const [latencia, setLatencia] = useState(0); // ms
  const [precisaoJogo, setPrecisaoJogo] = useState<Precisao>(PRECISAO_PADRAO);
  const [recordes, setRecordes] = useState<Recordes>({});
  const [versao, setVersao] = useState(0);
  const [marco, setMarco] = useState<number | null>(null);
  const som = useRef<SomOcarina | null>(null);
  const [liberado, setLiberado] = useState(false);

  useEffect(() => {
    setEditor(new URLSearchParams(window.location.search).get('editor') === '1');
    setTeclas(lerTeclas());
    setLatencia(ler<number>(CHAVE_LATENCIA, 0));
    const pr = ler<string>(CHAVE_PRECISAO, PRECISAO_PADRAO);
    if (ehPrecisao(pr)) setPrecisaoJogo(pr);
    setRecordes(ler<Recordes>(CHAVE_RECORDES, {}));
    carregarImagensOcarina();
    const tick = () => {
      const d = diaEm();
      setDia((a) => (a === d ? a : d));
      setRestante(msAteProximoDia());
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(t);
      som.current?.fechar();
    };
  }, []);

  useEffect(() => {
    if (marco === null) return;
    const t = window.setTimeout(() => setMarco(null), 6000);
    return () => window.clearTimeout(t);
  }, [marco]);

  // Destrava o som (celular só toca depois de um toque na tela).
  const liberar = useCallback(async () => {
    if (!som.current) som.current = new SomOcarina();
    await som.current.destravar();
    setLiberado(true);
    return som.current;
  }, []);

  const ativos = useMemo(
    () => (dia ? charts.filter((c) => c.ativo !== false && (!c.ativo_desde || c.ativo_desde <= dia)) : charts),
    [charts, dia]
  );
  const doDia = useMemo(() => {
    if (!dia) return null;
    const id = sortearDoDia(charts.map((c) => ({ id: c.id, ativo: c.ativo, ativo_desde: c.ativo_desde })), null, dia, INICIO, JOGO)?.id;
    return charts.find((c) => c.id === id) ?? null;
  }, [charts, dia]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const feitoHoje = useMemo(() => (dia ? resultadoDoDia(JOGO, 'dia', dia) : null), [dia, versao]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geral = useMemo(() => (dia ? sequenciaGeralHoje(dia) : { atual: 0, melhor: 0 }), [dia, versao]);

  // Música com áudio: baixa e prepara antes de começar.
  const [carregando, setCarregando] = useState<string | null>(null);
  const [erroAudio, setErroAudio] = useState<string | null>(null);
  async function jogar(chart: Chart, diario: boolean) {
    const s = await liberar();
    let audio: AudioBuffer | null = null;
    if (chart.audio) {
      setErroAudio(null);
      setCarregando(chart.titulo);
      try {
        audio = await s.carregarAudio(chart.audio);
      } catch {
        setCarregando(null);
        setErroAudio(`Não deu pra carregar "${chart.titulo}". Confira a internet e tente de novo.`);
        return;
      }
      setCarregando(null);
    }
    setTela((t) => ({ tipo: 'jogo', chart, diario, audio, rodada: (t.tipo === 'jogo' ? t.rodada : 0) + 1 }));
  }

  function aoTerminar(chart: Chart, diario: boolean, r: ResultadoMusica) {
    const anterior = recordes[chart.id];
    const recorde = !anterior || r.pontos > anterior.pontos;
    if (recorde) {
      const novos = { ...recordes, [chart.id]: r };
      setRecordes(novos);
      gravar(CHAVE_RECORDES, novos);
    }
    const nomeDif = DIFICULDADES[chart.dificuldade].nome;
    registrarJogada({
      jogo: JOGO,
      modo: diario ? 'dia' : 'livre',
      dia: diario ? dia : null,
      venceu: r.completou,
      pontos: r.pontos,
      resumo: `${chart.titulo} (${nomeDif}) · ${r.completou ? `${r.estrelas}★` : 'não completou'} · ${r.precisao}% · combo ${r.maiorCombo}`,
      detalhes: { musica: chart.id, ...r }
    });
    const linhas = textoCompartilhar({ numero: diario && dia ? numeroDoDia(dia, INICIO) : null, chart, r, sequencia: 1 }).split('\n');
    if (diario && dia) {
      const salvo = registrarDiario(JOGO, 'dia', {
        dia,
        venceu: r.completou,
        tentativas: r.completou ? r.estrelas : 0,
        detalhe: { musica: chart.id, ...r }
      });
      setVersao((v) => v + 1);
      if (salvo.marco) setMarco(salvo.marco);
      guardarPublicavel({ id: `${JOGO}:dia:${dia}`, jogo: JOGO, modo: 'dia', titulo: linhas[0], resultado: `${linhas[1]}\n${linhas[2]}` });
    } else {
      guardarPublicavel({
        id: `${JOGO}:${chart.id}:${Date.now()}`,
        jogo: JOGO,
        modo: 'livre',
        titulo: `Ocarina Hero · ${chart.titulo}`,
        resultado: `${linhas[1]}\n${linhas[2]}`
      });
    }
    setTela({ tipo: 'resultado', chart, diario, r, recorde: recorde && Boolean(anterior) });
  }

  if (editor) {
    return (
      <main className="page-content oc-page">
        <Editor charts={charts} teclas={teclas} latencia={latencia / 1000} liberar={liberar} />
      </main>
    );
  }

  return (
    <main className="page-content oc-page">
      <div className="oc-topo">
        <Link href="/testes" className="oc-voltar">
          <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Jogos
        </Link>
        <p className={`oc-seq${geral.atual > 0 ? ' is-acesa' : ''}`} title="Sequência XAN: dias seguidos jogando algum desafio diário">
          <span aria-hidden="true">🔥</span>
          <strong>{geral.atual}</strong>
          <span className="oc-seq-rotulo">{geral.atual === 1 ? 'dia seguido' : 'dias seguidos'}</span>
        </p>
      </div>

      <header className="oc-cabeca">
        <p className="oc-kicker">Jogo de ritmo</p>
        <h1 className="oc-titulo">
          Ocarina <em>Hero</em>
        </h1>
        <p className="oc-sub">As notas descem pela pista: toque no momento em que elas cruzam o círculo. Músicas originais, som de ocarina.</p>
      </header>

      {marco !== null && (
        <div className="oc-marco" role="status">
          🔥 <strong>{marco} dias seguidos!</strong> Continue voltando todo dia.
        </div>
      )}

      {carregando && (
        <div className="oc-carregando" role="status">
          <span className="oc-carregando-icone" aria-hidden="true">
            ♪
          </span>
          Carregando “{carregando}”…
        </div>
      )}
      {erroAudio && (
        <p className="oc-erro" role="alert">
          {erroAudio}
        </p>
      )}

      {tela.tipo === 'menu' && (
        <Menu
          charts={ativos}
          doDia={doDia}
          dia={dia}
          feitoHoje={feitoHoje}
          restante={restante}
          recordes={recordes}
          liberado={liberado}
          teclas={teclas}
          latencia={latencia}
          precisao={precisaoJogo}
          onPrecisao={(p) => {
            setPrecisaoJogo(p);
            gravar(CHAVE_PRECISAO, p);
          }}
          onLiberar={liberar}
          onJogar={jogar}
          onTela={(t) => setTela({ tipo: t })}
        />
      )}

      {tela.tipo === 'jogo' && som.current && (
        <Partida
          key={`${tela.chart.id}-${tela.rodada}`}
          chart={tela.chart}
          diario={tela.diario}
          som={som.current}
          audio={tela.audio}
          teclas={teclas}
          latencia={latencia / 1000}
          precisao={precisaoJogo}
          onFim={(r) => aoTerminar(tela.chart, tela.diario, r)}
          onReiniciar={() => jogar(tela.chart, false)}
          onSair={() => setTela({ tipo: 'menu' })}
        />
      )}

      {tela.tipo === 'resultado' && (
        <Resultado
          chart={tela.chart}
          diario={tela.diario}
          r={tela.r}
          recorde={tela.recorde}
          numero={dia ? numeroDoDia(dia, INICIO) : null}
          dia={dia}
          sequencia={geral.atual}
          restante={restante}
          onDeNovo={() => jogar(tela.chart, false)}
          onMenu={() => setTela({ tipo: 'menu' })}
        />
      )}

      {tela.tipo === 'teclas' && (
        <ConfigTeclas
          teclas={teclas}
          onSalvar={(t) => {
            setTeclas(t);
            gravar(CHAVE_TECLAS, t);
          }}
          onVoltar={() => setTela({ tipo: 'menu' })}
        />
      )}

      {tela.tipo === 'calibrar' && (
        <Calibrar
          liberar={liberar}
          teclas={teclas}
          atual={latencia}
          onSalvar={(ms) => {
            setLatencia(ms);
            gravar(CHAVE_LATENCIA, ms);
          }}
          onVoltar={() => setTela({ tipo: 'menu' })}
        />
      )}
    </main>
  );
}

// ---------- Menu ----------

function Menu({
  charts,
  doDia,
  dia,
  feitoHoje,
  restante,
  recordes,
  liberado,
  teclas,
  latencia,
  precisao,
  onPrecisao,
  onLiberar,
  onJogar,
  onTela
}: {
  charts: Chart[];
  doDia: Chart | null;
  dia: string | null;
  feitoHoje: ReturnType<typeof resultadoDoDia>;
  restante: number;
  recordes: Recordes;
  liberado: boolean;
  teclas: MapaTeclas;
  latencia: number;
  precisao: Precisao;
  onPrecisao: (p: Precisao) => void;
  onLiberar: () => void;
  onJogar: (c: Chart, diario: boolean) => void;
  onTela: (t: 'teclas' | 'calibrar') => void;
}) {
  const r = feitoHoje?.detalhe as Partial<ResultadoMusica> | undefined;
  return (
    <>
      {!liberado && (
        <button type="button" className="oc-tocar" onClick={onLiberar}>
          <span className="oc-tocar-icone" aria-hidden="true">
            ▶
          </span>
          <span>
            <strong>Tocar</strong>
            <small>Liga o som da ocarina (precisa de um toque no celular)</small>
          </span>
        </button>
      )}

      {doDia && dia && (
        <section className="oc-dia" style={{ '--dif': DIFICULDADES[doDia.dificuldade].cor } as React.CSSProperties}>
          <p className="oc-dia-kicker">Música do Dia · #{numeroDoDia(dia, INICIO)}</p>
          <h2>{doDia.titulo}</h2>
          <p className="oc-dia-info">
            <span className="oc-dif">{DIFICULDADES[doDia.dificuldade].nome}</span> {doDia.bpm} bpm · {doDia.notas.length} notas
          </p>
          {feitoHoje ? (
            <>
              <p className="oc-dia-feito">
                ✓ Feita hoje: {feitoHoje.venceu ? `${desenhoEstrelas(r?.estrelas ?? 0)} ${r?.precisao ?? 0}%` : `não completou (${r?.precisao ?? 0}%)`}
              </p>
              <button type="button" className="oc-botao" onClick={() => onJogar(doDia, false)}>
                Tocar de novo (modo livre)
              </button>
            </>
          ) : (
            <button type="button" className="oc-botao is-principal" onClick={() => onJogar(doDia, true)}>
              ▶ Tocar a Música do Dia
            </button>
          )}
          <p className="oc-dia-proxima">
            Próxima música em <strong>{formatarContador(restante)}</strong>
          </p>
        </section>
      )}

      <ListaMusicas charts={charts} recordes={recordes} onJogar={(c) => onJogar(c, false)} />

      <section className="oc-precisao" aria-label="Precisão">
        <p>
          🎯 Precisão <small>— quanto o toque pode sair do tempo e ainda valer</small>
        </p>
        <div role="radiogroup">
          {(Object.keys(PRECISOES) as Precisao[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={precisao === k} className={precisao === k ? 'is-on' : ''} onClick={() => onPrecisao(k)}>
              <strong>{PRECISOES[k].nome}</strong>
              <small>{PRECISOES[k].dica}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="oc-ajustes">
        <button type="button" className="oc-botao" onClick={() => onTela('teclas')}>
          ⌨️ Teclas: {PISTAS.map((p) => nomeTecla(teclas[p.id])).join(' ')}
        </button>
        <button type="button" className="oc-botao" onClick={() => onTela('calibrar')}>
          🎚️ Calibrar atraso do som ({latencia} ms)
        </button>
      </section>
      <p className="oc-dica">
        No computador: teclas {PISTAS.map((p) => nomeTecla(teclas[p.id])).join(' ')} (ou setas + espaço). No celular: toque nos
        botões embaixo da pista — dá pra apertar dois de uma vez. Jogar com o celular deitado fica melhor.
      </p>
    </>
  );
}

// ---------- Lista de músicas (Todas / Novas / Por jogo) ----------

type Aba = 'todas' | 'novas' | 'jogos';

function ListaMusicas({ charts, recordes, onJogar }: { charts: Chart[]; recordes: Recordes; onJogar: (c: Chart) => void }) {
  const [aba, setAba] = useState<Aba>('todas');
  const [busca, setBusca] = useState('');
  const [agora, setAgora] = useState(0);
  useEffect(() => setAgora(Date.now()), []);
  const novas = useMemo(() => (agora ? charts.filter((c) => ehNova(c, agora)) : []), [charts, agora]);
  const filtradas = useMemo(() => {
    const q = normalizar(busca);
    const base = aba === 'novas' ? novas : charts;
    return q ? base.filter((c) => normalizar(`${c.titulo} ${c.jogo ?? ''}`).includes(q)) : base;
  }, [aba, busca, charts, novas]);
  const porJogo = useMemo(() => {
    const m = new Map<string, Chart[]>();
    for (const c of filtradas) {
      const j = c.jogo || JOGO_ORIGINAIS;
      m.set(j, [...(m.get(j) ?? []), c]);
    }
    // Originais por último; o resto em ordem alfabética.
    return [...m.entries()].sort(([a], [b]) => (a === JOGO_ORIGINAIS ? 1 : b === JOGO_ORIGINAIS ? -1 : a.localeCompare(b, 'pt-BR')));
  }, [filtradas]);

  const cartao = (c: Chart) => {
    const rec = recordes[c.id];
    return (
      <li key={c.id}>
        <button type="button" className="oc-musica" onClick={() => onJogar(c)} style={{ '--dif': DIFICULDADES[c.dificuldade].cor } as React.CSSProperties}>
          <span className="oc-musica-topo">
            <span className="oc-dif">{DIFICULDADES[c.dificuldade].nome}</span>
            {agora > 0 && ehNova(c, agora) && <span className="oc-nova">Nova</span>}
            <span className="oc-musica-dur">{formatarDuracao(duracaoMusica(c))}</span>
          </span>
          <span className="oc-musica-titulo">{c.titulo}</span>
          <span className="oc-musica-jogo">{c.jogo || JOGO_ORIGINAIS}</span>
          <span className="oc-musica-recorde">
            {rec ? `🏆 ${rec.pontos.toLocaleString('pt-BR')} · ${desenhoEstrelas(rec.estrelas)}` : 'Ainda não jogada'}
          </span>
        </button>
      </li>
    );
  };

  return (
    <section className="oc-livre">
      <div className="oc-livre-topo">
        <h2>Músicas</h2>
        <input className="oc-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar música ou jogo" aria-label="Buscar música" />
      </div>
      <div className="oc-abas" role="tablist">
        {(
          [
            ['todas', `Todas (${charts.length})`],
            ['novas', `Novas (${novas.length})`],
            ['jogos', 'Por jogo']
          ] as [Aba, string][]
        ).map(([id, nome]) => (
          <button key={id} type="button" role="tab" aria-selected={aba === id} className={aba === id ? 'is-on' : ''} onClick={() => setAba(id)}>
            {nome}
          </button>
        ))}
      </div>
      {filtradas.length === 0 ? (
        <p className="oc-dica">{aba === 'novas' && !busca ? 'Nenhuma música nova nos últimos 14 dias.' : 'Nenhuma música encontrada.'}</p>
      ) : aba === 'jogos' ? (
        porJogo.map(([j, lista]) => (
          <div key={j} className="oc-grupo">
            <h3>
              {j} <span>{lista.length}</span>
            </h3>
            <ul>{lista.map(cartao)}</ul>
          </div>
        ))
      ) : (
        <ul>{filtradas.map(cartao)}</ul>
      )}
    </section>
  );
}

// ---------- Partida (tela cheia) ----------

function Partida({
  chart,
  diario,
  som,
  audio,
  teclas,
  latencia,
  precisao,
  onFim,
  onReiniciar,
  onSair
}: {
  chart: Chart;
  diario: boolean;
  som: SomOcarina;
  audio: AudioBuffer | null;
  teclas: MapaTeclas;
  latencia: number;
  precisao: Precisao;
  onFim: (r: ResultadoMusica) => void;
  onReiniciar: () => void;
  onSair: () => void;
}) {
  const motor = useRef<MotorOcarina | null>(null);
  const [pausado, setPausado] = useState(false);

  const pausar = useCallback(() => {
    motor.current?.pausar();
    setPausado(true);
  }, []);
  const continuar = useCallback(() => {
    motor.current?.continuar();
    setPausado(false);
  }, []);

  // Pausa automática quando a aba perde o foco.
  useEffect(() => {
    const perdeuFoco = () => {
      if (!pausado) pausar();
    };
    const visibilidade = () => {
      if (document.hidden) perdeuFoco();
    };
    window.addEventListener('blur', perdeuFoco);
    document.addEventListener('visibilitychange', visibilidade);
    return () => {
      window.removeEventListener('blur', perdeuFoco);
      document.removeEventListener('visibilitychange', visibilidade);
    };
  }, [pausado, pausar]);

  return (
    <div className={`oc-jogo ${OC_FONTES}`}>
      <Palco
        chart={chart}
        som={som}
        audio={audio}
        teclas={teclas}
        latencia={latencia}
        precisao={precisao}
        etiqueta={diario ? 'Música do Dia' : undefined}
        motorRef={motor}
        onFim={onFim}
        onPausa={() => (pausado ? continuar() : pausar())}
      />
      {pausado && (
        <div className="oc-pausa" role="dialog" aria-label="Pausado">
          <p>Pausado</p>
          <button type="button" className="oc-botao is-principal" onClick={continuar} autoFocus>
            ▶ Continuar
          </button>
          {!diario && (
            <button type="button" className="oc-botao" onClick={onReiniciar}>
              ↺ Recomeçar
            </button>
          )}
          <button type="button" className="oc-botao" onClick={onSair}>
            Sair{diario ? ' (o desafio do dia continua disponível)' : ''}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Resultado ----------

function Resultado({
  chart,
  diario,
  r,
  recorde,
  numero,
  dia,
  sequencia,
  restante,
  onDeNovo,
  onMenu
}: {
  chart: Chart;
  diario: boolean;
  r: ResultadoMusica;
  recorde: boolean;
  numero: number | null;
  dia: string | null;
  sequencia: number;
  restante: number;
  onDeNovo: () => void;
  onMenu: () => void;
}) {
  const [aviso, setAviso] = useState<string | null>(null);
  async function compartilhar() {
    const texto = textoCompartilhar({ numero: diario ? numero : null, chart, r, sequencia: Math.max(1, sequencia) });
    const como = await compartilharTexto(texto);
    setAviso(como === 'copiado' ? 'Resultado copiado! Cole no Instagram ou no WhatsApp.' : como === 'falhou' ? 'Não deu pra copiar.' : null);
  }
  const idPublicar = diario && dia ? `${JOGO}:dia:${dia}` : '';
  return (
    <section className="oc-resultado">
      <p className="oc-resultado-kicker">{diario ? `Música do Dia #${numero}` : 'Modo livre'}</p>
      <h2>{r.completou ? (r.estrelas >= 4 ? 'Que show!' : 'Música completa!') : 'A Navi cansou…'}</h2>
      <p className="oc-resultado-musica">
        {chart.titulo} · {DIFICULDADES[chart.dificuldade].nome}
      </p>
      <p className="oc-triforces" aria-label={`${r.estrelas} de 5 estrelas`}>
        {Array.from({ length: 5 }, (_, i) => (
          <svg key={i} viewBox="0 0 100 87" className={i < r.estrelas ? 'is-on' : ''} style={{ '--i': i } as React.CSSProperties} aria-hidden="true">
            <path d="M50 0 75 43.3H25ZM25 43.3 50 86.6H0ZM75 43.3 100 86.6H50Z" />
          </svg>
        ))}
      </p>
      {recorde && <p className="oc-recorde">🏆 Novo recorde!</p>}
      <dl className="oc-numeros">
        <div>
          <dt>Pontos</dt>
          <dd>{r.pontos.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>Precisão</dt>
          <dd>{r.precisao}%</dd>
        </div>
        <div>
          <dt>Maior combo</dt>
          <dd>{r.maiorCombo}</dd>
        </div>
      </dl>
      <p className="oc-detalhe">
        {r.perfeitos} perfeitos · {r.bons} bons · {r.erros} erros
      </p>
      <div className="oc-acoes">
        <button type="button" className="oc-botao is-principal" onClick={compartilhar}>
          Compartilhar
        </button>
        <Link className="oc-botao" href={`/testes/feed${idPublicar ? `?publicar=${encodeURIComponent(idPublicar)}` : ''}`}>
          📣 Publicar no feed
        </Link>
        <button type="button" className="oc-botao" onClick={onDeNovo}>
          ↺ Tocar de novo
        </button>
        <button type="button" className="oc-botao" onClick={onMenu}>
          Outras músicas
        </button>
      </div>
      {aviso && <p className="oc-aviso">{aviso}</p>}
      {diario && (
        <p className="oc-dia-proxima">
          Próxima Música do Dia em <strong>{formatarContador(restante)}</strong>
        </p>
      )}
      <Link className="oc-loja" href="/franquia/Legend%20Of%20Zelda">
        Ver jogos de Zelda na loja →
      </Link>
    </section>
  );
}

// ---------- Configurar teclas ----------

function ConfigTeclas({ teclas, onSalvar, onVoltar }: { teclas: MapaTeclas; onSalvar: (t: MapaTeclas) => void; onVoltar: () => void }) {
  const [esperando, setEsperando] = useState<PistaId | null>(null);
  useEffect(() => {
    if (!esperando) return;
    const pega = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.code === 'Escape') {
        setEsperando(null);
        return;
      }
      // Se a tecla já era de outra pista, as duas trocam.
      const novo = { ...teclas };
      const dono = (Object.keys(novo) as PistaId[]).find((k) => novo[k] === e.code);
      if (dono) novo[dono] = teclas[esperando];
      novo[esperando] = e.code;
      onSalvar(novo);
      setEsperando(null);
    };
    window.addEventListener('keydown', pega);
    return () => window.removeEventListener('keydown', pega);
  }, [esperando, teclas, onSalvar]);

  return (
    <section className="oc-config">
      <h2>Configurar teclas</h2>
      <p>Clique numa pista e aperte a tecla que você quer usar. As setas e o espaço sempre funcionam também.</p>
      <ul>
        {PISTAS.map((p) => (
          <li key={p.id}>
            <span className="oc-config-pista" style={{ '--cor': p.cor } as React.CSSProperties} title={p.rotulo}>
              {p.rotulo.charAt(0)}
            </span>
            <button type="button" className={`oc-botao${esperando === p.id ? ' is-principal' : ''}`} onClick={() => setEsperando(p.id)}>
              {esperando === p.id ? 'Aperte uma tecla…' : nomeTecla(teclas[p.id])}
            </button>
            <span className="oc-config-alt">ou {nomeTecla(TECLAS_ALTERNATIVAS[p.id])}</span>
          </li>
        ))}
      </ul>
      <div className="oc-acoes">
        <button type="button" className="oc-botao" onClick={() => onSalvar(TECLAS_PADRAO)}>
          Voltar ao padrão (A S J K L)
        </button>
        <button type="button" className="oc-botao is-principal" onClick={onVoltar}>
          Pronto
        </button>
      </div>
    </section>
  );
}

// ---------- Calibrar o atraso do som ----------

const CAL_BPM = 100;
const CAL_BATIDAS = 16;
const CAL_IGNORAR = 4;

function Calibrar({
  liberar,
  teclas,
  atual,
  onSalvar,
  onVoltar
}: {
  liberar: () => Promise<SomOcarina>;
  teclas: MapaTeclas;
  atual: number;
  onSalvar: (ms: number) => void;
  onVoltar: () => void;
}) {
  const [fase, setFase] = useState<'pronto' | 'tocando' | 'feito'>('pronto');
  const [batida, setBatida] = useState(-1);
  const [medido, setMedido] = useState<number | null>(null);
  const dados = useRef<{ som: SomOcarina; inicio: number; toques: number[] } | null>(null);

  async function comecar() {
    const som = await liberar();
    const b = 60 / CAL_BPM;
    const inicio = som.agora + 0.6;
    for (let k = 0; k < CAL_BATIDAS; k++) som.tick(inicio + k * b, k % 4 === 0, 0.25);
    dados.current = { som, inicio, toques: [] };
    setFase('tocando');
    setMedido(null);
  }

  const tocar = useCallback(() => {
    const d = dados.current;
    if (!d || fase !== 'tocando') return;
    d.toques.push(d.som.agora - d.inicio);
  }, [fase]);

  useEffect(() => {
    if (fase !== 'tocando') return;
    const d = dados.current!;
    const b = 60 / CAL_BPM;
    let raf = 0;
    const loop = () => {
      const t = d.som.agora - d.inicio;
      setBatida(Math.floor(t / b + 0.0001));
      if (t > CAL_BATIDAS * b) {
        // Atraso = mediana de (toque − batida mais próxima), ignorando as primeiras.
        const difs = d.toques
          .map((x) => ({ x, k: Math.round(x / b) }))
          .filter(({ k }) => k >= CAL_IGNORAR && k < CAL_BATIDAS)
          .map(({ x, k }) => x - k * b)
          .sort((a, c) => a - c);
        setMedido(difs.length >= 4 ? Math.round(difs[Math.floor(difs.length / 2)] * 1000) : null);
        setFase('feito');
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const tecla = (e: KeyboardEvent) => {
      if (pistaDaTecla(e.code, teclas) >= 0 && !e.repeat) {
        e.preventDefault();
        tocar();
      }
    };
    window.addEventListener('keydown', tecla);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', tecla);
    };
  }, [fase, teclas, tocar]);

  return (
    <section className="oc-config">
      <h2>Calibrar o atraso do som</h2>
      <p>
        Fones bluetooth e alguns celulares atrasam o som. Aperte <strong>Começar</strong> e toque no botão grande (ou em
        qualquer tecla do jogo) junto com cada “tique” do metrônomo. As 4 primeiras batidas são só pra pegar o ritmo.
      </p>
      <button
        type="button"
        className={`oc-cal-alvo${fase === 'tocando' && batida >= 0 && batida % 1 === 0 ? ' is-batida' : ''}`}
        key={batida}
        onPointerDown={(e) => {
          e.preventDefault();
          tocar();
        }}
        disabled={fase !== 'tocando'}
      >
        {fase === 'tocando' ? (batida < CAL_IGNORAR ? `Pegue o ritmo… ${Math.max(0, CAL_IGNORAR - batida)}` : 'Toque!') : '●'}
      </button>
      {fase === 'feito' && (
        <p className="oc-cal-resultado">
          {medido === null ? 'Não deu pra medir (poucos toques). Tente de novo.' : `Seu atraso: ${medido} ms`}
        </p>
      )}
      <p className="oc-detalhe">Atraso salvo agora: {atual} ms</p>
      <div className="oc-acoes">
        {fase !== 'tocando' && (
          <button type="button" className="oc-botao" onClick={comecar}>
            {fase === 'feito' ? 'Medir de novo' : 'Começar'}
          </button>
        )}
        {fase === 'feito' && medido !== null && (
          <button
            type="button"
            className="oc-botao is-principal"
            onClick={() => {
              onSalvar(Math.max(-150, Math.min(400, medido)));
              onVoltar();
            }}
          >
            Usar {medido} ms
          </button>
        )}
        <button type="button" className="oc-botao" onClick={() => onSalvar(0)}>
          Zerar
        </button>
        <button type="button" className="oc-botao" onClick={onVoltar}>
          Voltar
        </button>
      </div>
    </section>
  );
}
