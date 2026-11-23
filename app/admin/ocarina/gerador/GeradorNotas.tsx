'use client';

// "Gerar notas do áudio": janela do editor do Zelda Tour que analisa um
// áudio (o da música ou um MP3/WAV/OGG enviado aqui) no navegador e cria um
// chart base. A análise pesada roda num Web Worker (worker.ts); gerar as
// notas com outras configurações é instantâneo ("Regerar" só analisa de
// novo quando muda o instrumento ou a faixa). "Abrir no editor" entrega as
// notas no formato que o editor já usa.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DIFICULDADES, ORDEM_DIFICULDADES, PISTAS, type Dificuldade } from '@/app/games-interativos/ocarina-hero/ocarina';
import {
  FOCOS,
  gerarNotas,
  type Caracteristicas,
  type Foco,
  type ModoPistas,
  type NotaGerada,
  type Parametros,
  type Quantizacao
} from './analise';
import type { PedidoAnalise, RespostaAnalise } from './worker';
import './gerador.css';

const TAXA_ANALISE = 22050;

export type GeradoParaEditor = {
  notas: Partial<Record<Dificuldade, { t: number; pista: string; dur?: number }[]>>;
  bpm: number | null;
  inicioBatida: number | null;
  // arquivo enviado aqui que deve virar o áudio da música
  arquivoAudio: File | null;
};

type Fonte = { tipo: 'musica' } | { tipo: 'arquivo'; arquivo: File };

const QUANTIZACOES: { v: Quantizacao; nome: string }[] = [
  { v: 0, nome: 'Sem quantizar' },
  { v: 1, nome: '1/4 (batida)' },
  { v: 2, nome: '1/8' },
  { v: 4, nome: '1/16' }
];

// Envelope de energia a 100 Hz (pra alinhar dois arquivos da mesma música).
function envelope100(dados: Float32Array, taxa: number): Float32Array {
  const por = Math.max(1, Math.round(taxa / 100));
  const out = new Float32Array(Math.floor(dados.length / por));
  let ant = 0;
  for (let i = 0; i < out.length; i++) {
    let e = 0;
    for (let j = i * por; j < (i + 1) * por; j++) e += dados[j] * dados[j];
    const v = Math.sqrt(e / por);
    out[i] = Math.max(0, v - ant);
    ant = v;
  }
  return out;
}

// Quanto o arquivo B está atrasado em relação ao A (s), até ±1,5 s.
function alinhar(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length, 100 * 90);
  let melhor = 0;
  let melhorV = -Infinity;
  for (let lag = -150; lag <= 150; lag++) {
    let s = 0;
    for (let i = Math.max(0, -lag); i < n && i + lag < n; i++) s += a[i] * b[i + lag];
    if (s > melhorV) {
      melhorV = s;
      melhor = lag;
    }
  }
  return melhor / 100;
}

function misturarMono(buf: AudioBuffer): Float32Array {
  const out = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) out[i] += d[i] / buf.numberOfChannels;
  }
  return out;
}

export default function GeradorNotas({
  audioUrlMusica,
  bpmAtual,
  inicioAtual,
  dificuldadeAtual,
  notasExistentes,
  onAbrir,
  onFechar
}: {
  audioUrlMusica: string | null;
  bpmAtual: number;
  inicioAtual: number;
  dificuldadeAtual: Dificuldade;
  notasExistentes: (d: Dificuldade) => number;
  onAbrir: (r: GeradoParaEditor) => void;
  onFechar: () => void;
}) {
  // ---------- Áudio ----------
  const [fonte, setFonte] = useState<Fonte | null>(null);
  const [usarComoAudio, setUsarComoAudio] = useState(!audioUrlMusica);
  const [estado, setEstado] = useState<{ tipo: 'livre' | 'carregando' | 'analisando' | 'erro'; texto?: string; p?: number }>({ tipo: 'livre' });
  const ctx = useRef<AudioContext | null>(null);
  const original = useRef<AudioBuffer | null>(null);
  const canais = useRef<{ L: Float32Array; R: Float32Array | null } | null>(null);
  const [picos, setPicos] = useState<Float32Array | null>(null);
  const [duracao, setDuracao] = useState(0);
  const [estereo, setEstereo] = useState(false);
  const [defasagem, setDefasagem] = useState<number | null>(null);
  const [arrastando, setArrastando] = useState(false);

  // ---------- Análise ----------
  const worker = useRef<Worker | null>(null);
  const pedido = useRef(0);
  const [caract, setCaract] = useState<{ chave: string; c: Caracteristicas } | null>(null);

  // ---------- Controles ----------
  const [foco, setFoco] = useState<Foco>('melodia');
  const [faixaManual, setFaixaManual] = useState(false);
  const [faixa, setFaixa] = useState<[number, number]>(FOCOS.melodia.faixa);
  const [sensibilidade, setSensibilidade] = useState(55);
  const [intervaloMinMs, setIntervaloMinMs] = useState(100);
  const [quantizacao, setQuantizacao] = useState<Quantizacao>(2);
  const [dificuldade, setDificuldade] = useState<Dificuldade | 'todas'>(dificuldadeAtual);
  const [modo, setModo] = useState<ModoPistas>('ocarina');
  const [offsetMs, setOffsetMs] = useState(0);
  const [notaLongaMs, setNotaLongaMs] = useState(700);
  const [bpm, setBpm] = useState<number | null>(null);
  const [inicioBatida, setInicioBatida] = useState<number | null>(null);
  const [aplicarBpm, setAplicarBpm] = useState(true);

  const chaveAnalise = `${foco}|${faixaManual ? faixa.join('-') : 'auto'}`;
  const desatualizada = caract !== null && caract.chave !== chaveAnalise;

  useEffect(() => {
    worker.current = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    return () => {
      worker.current?.terminate();
      ctx.current?.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!faixaManual) setFaixa(FOCOS[foco].faixa);
  }, [foco, faixaManual]);

  const garantirCtx = () => (ctx.current ??= new AudioContext());

  // Analisa (no worker) com o instrumento e a faixa atuais.
  const analisar = useCallback(() => {
    const ch = canais.current;
    if (!ch || !worker.current) return;
    const id = ++pedido.current;
    const chave = chaveAnalise;
    setEstado({ tipo: 'analisando', p: 0 });
    worker.current.onmessage = (e: MessageEvent<RespostaAnalise>) => {
      const r = e.data;
      if (r.id !== pedido.current) return;
      if (r.tipo === 'progresso') setEstado({ tipo: 'analisando', p: r.p });
      else if (r.tipo === 'erro') setEstado({ tipo: 'erro', texto: `A análise falhou: ${r.erro}` });
      else {
        setCaract({ chave, c: r.c });
        setBpm((atual) => atual ?? r.c.bpm);
        setInicioBatida((atual) => atual ?? r.c.inicioBatida);
        setEstado({ tipo: 'livre' });
      }
    };
    const msg: PedidoAnalise = { id, L: ch.L.slice(), R: ch.R ? ch.R.slice() : null, taxa: TAXA_ANALISE, foco, faixa: faixaManual ? faixa : null };
    worker.current.postMessage(msg, [msg.L.buffer, ...(msg.R ? [msg.R.buffer] : [])]);
  }, [chaveAnalise, foco, faixa, faixaManual]);

  // Carrega o áudio escolhido: decodifica, reamostra pra 22 050 Hz (mantendo
  // o estéreo) e já analisa.
  async function carregar(f: Fonte) {
    pararTocar();
    setFonte(f);
    setCaract(null);
    setBpm(null);
    setInicioBatida(null);
    setDefasagem(null);
    setEstado({ tipo: 'carregando', texto: 'Lendo o áudio…' });
    try {
      const bytes = f.tipo === 'arquivo' ? await f.arquivo.arrayBuffer() : await fetch(audioUrlMusica as string).then((r) => r.arrayBuffer());
      const buf = await garantirCtx().decodeAudioData(bytes);
      original.current = buf;
      setDuracao(buf.duration);
      const nCanais = Math.min(2, buf.numberOfChannels);
      const off = new OfflineAudioContext(nCanais, Math.ceil(buf.duration * TAXA_ANALISE), TAXA_ANALISE);
      const src = off.createBufferSource();
      src.buffer = buf;
      src.connect(off.destination);
      src.start();
      const r = await off.startRendering();
      canais.current = { L: r.getChannelData(0).slice(), R: nCanais > 1 ? r.getChannelData(1).slice() : null };
      setEstereo(nCanais > 1);
      // Forma de onda (pico a cada 10 ms).
      const mono = misturarMono(r);
      const por = Math.round(TAXA_ANALISE / 100);
      const p = new Float32Array(Math.ceil(mono.length / por));
      for (let i = 0; i < p.length; i++) {
        let m = 0;
        for (let j = i * por; j < Math.min(mono.length, (i + 1) * por); j++) m = Math.max(m, Math.abs(mono[j]));
        p[i] = m;
      }
      setPicos(p);
      // Arquivo diferente do áudio da música: mede a diferença de começo.
      if (f.tipo === 'arquivo' && audioUrlMusica && !usarComoAudio) {
        try {
          const bufMusica = await garantirCtx().decodeAudioData(await fetch(audioUrlMusica).then((x) => x.arrayBuffer()));
          const d = alinhar(envelope100(misturarMono(bufMusica), bufMusica.sampleRate), envelope100(misturarMono(buf), buf.sampleRate));
          setDefasagem(d);
          if (Math.abs(d) >= 0.01) setOffsetMs(Math.round(-d * 1000));
        } catch {
          // sem alinhamento automático
        }
      }
      setEstado({ tipo: 'livre' });
    } catch {
      setEstado({ tipo: 'erro', texto: 'Não consegui ler esse áudio. Use MP3, WAV ou OGG.' });
      canais.current = null;
    }
  }

  // Analisa assim que o áudio carrega.
  const carregou = picos !== null && canais.current !== null;
  useEffect(() => {
    if (carregou && !caract && estado.tipo === 'livre') analisar();
  }, [carregou, caract, estado.tipo, analisar]);

  // ---------- Notas (instantâneo) ----------
  const parametrosBase = useMemo(
    (): Omit<Parametros, 'dificuldade'> => ({
      sensibilidade,
      intervaloMinMs,
      quantizacao,
      modo,
      offsetMs,
      notaLongaMs,
      bpm: bpm ?? bpmAtual,
      inicioBatida: inicioBatida ?? inicioAtual
    }),
    [sensibilidade, intervaloMinMs, quantizacao, modo, offsetMs, notaLongaMs, bpm, inicioBatida, bpmAtual, inicioAtual]
  );
  const difsAlvo: Dificuldade[] = dificuldade === 'todas' ? ORDEM_DIFICULDADES : [dificuldade];
  const resultados = useMemo(() => {
    if (!caract) return null;
    return Object.fromEntries(difsAlvo.map((d) => [d, gerarNotas(caract.c, { ...parametrosBase, dificuldade: d })])) as Partial<
      Record<Dificuldade, ReturnType<typeof gerarNotas>>
    >;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caract, parametrosBase, dificuldade]);
  const difPrevia: Dificuldade = dificuldade === 'todas' ? 'dificil' : dificuldade;
  const previa = resultados?.[difPrevia] ?? resultados?.[difsAlvo[0]] ?? null;

  // ---------- Tocar a prévia ----------
  const [tocando, setTocando] = useState(false);
  const [ouvirNotas, setOuvirNotas] = useState(true);
  const tocar = useRef<{ fonte: AudioBufferSourceNode; inicioCtx: number; pos: number; bipes: OscillatorNode[] } | null>(null);
  const [agulha, setAgulha] = useState(0);
  const agulhaRef = useRef(0);

  function pararTocar() {
    const t = tocar.current;
    if (!t) return;
    try {
      t.fonte.stop();
    } catch {}
    t.bipes.forEach((b) => {
      try {
        b.stop();
      } catch {}
    });
    tocar.current = null;
    setTocando(false);
  }

  function comecar(de: number) {
    const buf = original.current;
    if (!buf) return;
    pararTocar();
    const c = garantirCtx();
    c.resume().catch(() => {});
    const fonte = c.createBufferSource();
    fonte.buffer = buf;
    fonte.connect(c.destination);
    const inicioCtx = c.currentTime + 0.05;
    fonte.start(inicioCtx, de);
    const bipes: OscillatorNode[] = [];
    if (ouvirNotas && previa) {
      for (const n of previa.notas) {
        if (n.t < de) continue;
        const o = c.createOscillator();
        const g = c.createGain();
        const i = PISTAS.findIndex((p) => p.id === n.pista);
        o.frequency.value = 880 * Math.pow(2, (i * 3) / 12);
        o.type = 'triangle';
        const quando = inicioCtx + (n.t - de);
        g.gain.setValueAtTime(0.0001, quando);
        g.gain.exponentialRampToValueAtTime(0.25, quando + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, quando + 0.07);
        o.connect(g).connect(c.destination);
        o.start(quando);
        o.stop(quando + 0.08);
        bipes.push(o);
        if (bipes.length > 4000) break;
      }
    }
    fonte.onended = () => {
      if (tocar.current?.fonte === fonte) {
        tocar.current = null;
        setTocando(false);
      }
    };
    tocar.current = { fonte, inicioCtx, pos: de, bipes };
    setTocando(true);
  }

  useEffect(() => {
    if (!tocando) return;
    let raf = 0;
    const passo = () => {
      const t = tocar.current;
      if (t && ctx.current) {
        const p = Math.max(0, t.pos + ctx.current.currentTime - t.inicioCtx);
        agulhaRef.current = p;
        setAgulha(p);
      }
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [tocando]);

  // Regerar enquanto toca: recomeça do ponto atual com os bipes novos.
  useEffect(() => {
    if (tocar.current) comecar(agulhaRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previa, ouvirNotas]);

  useEffect(() => () => pararTocar(), []);

  // ---------- Desenho da prévia ----------
  const PX_POR_S = 90;
  const ALT_ONDA = 54;
  const ALT_PISTA = 22;
  const alturaCanvas = ALT_ONDA + ALT_PISTA * 5 + 6;
  const larguraCanvas = Math.max(600, Math.ceil(duracao * PX_POR_S) + 20);
  const canvas = useRef<HTMLCanvasElement>(null);
  const rolagem = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = larguraCanvas * dpr;
    cv.height = alturaCanvas * dpr;
    const g = cv.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#100a20';
    g.fillRect(0, 0, larguraCanvas, alturaCanvas);
    // batidas
    const b = bpm ?? bpmAtual;
    const ini = inicioBatida ?? inicioAtual;
    if (b > 0 && duracao) {
      for (let t = ini, i = 0; t < duracao; t += 60 / b, i++) {
        const x = 10 + t * PX_POR_S;
        g.fillStyle = i % 4 === 0 ? 'rgba(185,165,255,0.35)' : 'rgba(185,165,255,0.12)';
        g.fillRect(x, 0, 1, alturaCanvas);
      }
    }
    // onda
    if (picos) {
      g.fillStyle = 'rgba(164,99,255,0.55)';
      for (let i = 0; i < picos.length; i++) {
        const x = 10 + (i / 100) * PX_POR_S;
        const h = Math.min(1, picos[i] * 1.4) * (ALT_ONDA - 6);
        g.fillRect(x, ALT_ONDA / 2 - h / 2, Math.max(1, PX_POR_S / 100), h);
      }
    }
    // pistas
    PISTAS.forEach((p, i) => {
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)';
      g.fillRect(0, ALT_ONDA + i * ALT_PISTA, larguraCanvas, ALT_PISTA);
    });
    // notas
    for (const n of previa?.notas ?? []) {
      const i = PISTAS.findIndex((p) => p.id === n.pista);
      const x = 10 + n.t * PX_POR_S;
      const y = ALT_ONDA + i * ALT_PISTA + ALT_PISTA / 2;
      g.fillStyle = PISTAS[i].cor;
      if (n.dur) {
        g.globalAlpha = 0.45;
        g.fillRect(x, y - 3, n.dur * PX_POR_S, 6);
        g.globalAlpha = 1;
      }
      g.beginPath();
      g.arc(x, y, 6, 0, Math.PI * 2);
      g.fill();
    }
    // agulha
    g.fillStyle = '#ffd23e';
    g.fillRect(10 + agulha * PX_POR_S, 0, 2, alturaCanvas);
  }, [picos, previa, agulha, duracao, larguraCanvas, alturaCanvas, bpm, inicioBatida, bpmAtual, inicioAtual]);

  // Rola junto com a agulha.
  useEffect(() => {
    const r = rolagem.current;
    if (!r || !tocando) return;
    const x = 10 + agulha * PX_POR_S;
    if (x < r.scrollLeft + 40 || x > r.scrollLeft + r.clientWidth - 80) r.scrollLeft = x - 80;
  }, [agulha, tocando]);

  // ---------- Abrir no editor ----------
  const totalNotas = previa?.notas.length ?? 0;
  function abrir() {
    if (!resultados) return;
    const notas: GeradoParaEditor['notas'] = {};
    for (const d of difsAlvo) {
      const r = resultados[d];
      if (r) notas[d] = r.notas.map((n: NotaGerada) => ({ t: n.t, pista: n.pista, ...(n.dur ? { dur: n.dur } : {}) }));
    }
    const ocupadas = difsAlvo.filter((d) => notasExistentes(d) > 0);
    if (
      ocupadas.length &&
      !window.confirm(
        `Trocar as notas que já existem em ${ocupadas.map((d) => DIFICULDADES[d].nome).join(', ')} pelas geradas? Na dificuldade aberta, Ctrl+Z desfaz.`
      )
    ) {
      return;
    }
    pararTocar();
    onAbrir({
      notas,
      bpm: aplicarBpm ? (bpm ?? null) : null,
      inicioBatida: aplicarBpm ? (inicioBatida ?? null) : null,
      arquivoAudio: fonte?.tipo === 'arquivo' && usarComoAudio ? fonte.arquivo : null
    });
  }

  const ocupado = estado.tipo === 'carregando' || estado.tipo === 'analisando';
  const jsonAmostra = previa ? JSON.stringify(previa.notas.slice(0, 8).map((n) => ({ t: n.t, pista: n.pista, ...(n.dur ? { dur: n.dur } : {}) })), null, 1) : '';

  return (
    <div className="gn-fundo" role="dialog" aria-modal="true" aria-label="Gerar notas do áudio" onClick={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="gn-janela">
        <header className="gn-topo">
          <div>
            <h2>✨ Gerar notas do áudio</h2>
            <p className="adm-help">Analisa o áudio aqui no navegador e cria um chart base pra você ajustar no editor.</p>
          </div>
          <button type="button" className="btn ghost" onClick={onFechar}>
            Fechar
          </button>
        </header>

        {/* 1. Áudio */}
        <section className="gn-bloco">
          <h3>1. Áudio</h3>
          <div
            className={`gn-soltar${arrastando ? ' is-sobre' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastando(false);
              const f = e.dataTransfer.files?.[0];
              if (f) carregar({ tipo: 'arquivo', arquivo: f });
            }}
          >
            <p>
              <b>Arraste um MP3, WAV ou OGG aqui</b>
              <br />
              <span className="adm-help">Arquivo original em estéreo separa melhor os instrumentos.</span>
            </p>
            <div className="gn-linha">
              <label className="btn primary gn-arquivo">
                Escolher arquivo
                <input
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/aac,audio/mp4,.mp3,.wav,.ogg,.m4a,.aac"
                  disabled={ocupado}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) carregar({ tipo: 'arquivo', arquivo: f });
                  }}
                />
              </label>
              {audioUrlMusica && (
                <button type="button" className="btn ghost" disabled={ocupado} onClick={() => carregar({ tipo: 'musica' })}>
                  Usar o áudio desta música
                </button>
              )}
            </div>
          </div>
          {fonte && (
            <p className="gn-info">
              {fonte.tipo === 'arquivo' ? `📄 ${fonte.arquivo.name}` : '🎵 Áudio da música (mono, compactado: sem separação por estéreo)'}
              {duracao ? ` · ${Math.floor(duracao / 60)}:${String(Math.round(duracao % 60)).padStart(2, '0')}` : ''}
              {fonte.tipo === 'arquivo' ? (estereo ? ' · estéreo' : ' · mono') : ''}
            </p>
          )}
          {fonte?.tipo === 'arquivo' && (
            <label className="gn-check">
              <input type="checkbox" checked={usarComoAudio} onChange={(e) => setUsarComoAudio(e.target.checked)} />
              {audioUrlMusica ? 'Trocar o áudio da música por este arquivo ao abrir no editor' : 'Usar este arquivo como o áudio da música (ao abrir no editor)'}
            </label>
          )}
          {defasagem !== null && Math.abs(defasagem) >= 0.01 && (
            <p className="gn-info">
              ⏱ Este arquivo começa {Math.abs(Math.round(defasagem * 1000))} ms {defasagem > 0 ? 'depois' : 'antes'} do áudio da música. O
              ajuste já entrou no &quot;Atraso&quot;.
            </p>
          )}
          {estado.tipo !== 'livre' && (
            <div className={`gn-estado is-${estado.tipo}`}>
              {estado.tipo === 'analisando' ? (
                <>
                  <span>Analisando… {Math.round((estado.p ?? 0) * 100)}%</span>
                  <span className="gn-barra">
                    <i style={{ width: `${Math.round((estado.p ?? 0) * 100)}%` }} />
                  </span>
                </>
              ) : (
                <span>{estado.texto}</span>
              )}
            </div>
          )}
        </section>

        {/* 2. Configurações */}
        <section className="gn-bloco">
          <h3>2. Como gerar</h3>
          <div className="gn-campos">
            <label className="gn-campo is-largo">
              <span>Instrumento em foco</span>
              <select value={foco} onChange={(e) => setFoco(e.target.value as Foco)}>
                {(Object.keys(FOCOS) as Foco[]).map((f) => (
                  <option key={f} value={f}>
                    {FOCOS[f].nome}
                  </option>
                ))}
              </select>
              <small>
                {FOCOS[foco].dica}
                {caract && !caract.c.usouEstereo && FOCOS[foco].fonte !== 'mix' ? ' (Este áudio é mono: a separação por estéreo não foi usada.)' : ''}
              </small>
            </label>
            <div className="gn-campo is-largo">
              <span>
                Faixa da melodia (Hz){' '}
                <label className="gn-check is-inline">
                  <input type="checkbox" checked={faixaManual} onChange={(e) => setFaixaManual(e.target.checked)} /> ajustar
                </label>
              </span>
              <div className="gn-linha">
                <input type="number" min={20} max={8000} value={faixa[0]} disabled={!faixaManual} onChange={(e) => setFaixa([Number(e.target.value) || 20, faixa[1]])} />
                <span>até</span>
                <input type="number" min={100} max={11000} value={faixa[1]} disabled={!faixaManual} onChange={(e) => setFaixa([faixa[0], Number(e.target.value) || 2000])} />
              </div>
              <small>Ignora o que está fora (ex: baixo e bateria). Sobe o mínimo pra cortar graves.</small>
            </div>
            <label className="gn-campo">
              <span>Sensibilidade: {sensibilidade}</span>
              <input type="range" min={0} max={100} value={sensibilidade} onChange={(e) => setSensibilidade(Number(e.target.value))} />
              <small>Mais alto = pega notas mais fracas.</small>
            </label>
            <label className="gn-campo">
              <span>Intervalo mínimo: {intervaloMinMs} ms</span>
              <input type="range" min={40} max={600} step={10} value={intervaloMinMs} onChange={(e) => setIntervaloMinMs(Number(e.target.value))} />
            </label>
            <label className="gn-campo">
              <span>Quantização</span>
              <select value={quantizacao} onChange={(e) => setQuantizacao(Number(e.target.value) as Quantizacao)}>
                {QUANTIZACOES.map((q) => (
                  <option key={q.v} value={q.v}>
                    {q.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="gn-campo">
              <span>Dificuldade</span>
              <select value={dificuldade} onChange={(e) => setDificuldade(e.target.value as Dificuldade | 'todas')}>
                {ORDEM_DIFICULDADES.map((d) => (
                  <option key={d} value={d}>
                    {DIFICULDADES[d].nome}
                  </option>
                ))}
                <option value="todas">As 4 de uma vez</option>
              </select>
              <small>Fácil: 1 nota a cada 2 batidas · Médio: 1 por batida · Difícil: 1/2 batida · Insano: livre.</small>
            </label>
            <label className="gn-campo">
              <span>Pistas</span>
              <select value={modo} onChange={(e) => setModo(e.target.value as ModoPistas)}>
                <option value="ocarina">Ocarina (Ré Fá Lá Si Ré)</option>
                <option value="relativo">Relativo (extensão em 5 faixas)</option>
              </select>
            </label>
            <label className="gn-campo">
              <span>Atraso: {offsetMs} ms</span>
              <input type="range" min={-500} max={500} step={5} value={offsetMs} onChange={(e) => setOffsetMs(Number(e.target.value))} />
              <small>Empurra todas as notas (latência).</small>
            </label>
            <label className="gn-campo">
              <span>Nota longa acima de: {notaLongaMs ? `${notaLongaMs} ms` : 'nunca'}</span>
              <input type="range" min={0} max={1500} step={50} value={notaLongaMs} onChange={(e) => setNotaLongaMs(Number(e.target.value))} />
            </label>
            <div className="gn-campo">
              <span>BPM e 1ª batida (detectados)</span>
              <div className="gn-linha">
                <input type="number" step="0.1" min={30} max={300} value={bpm ?? ''} placeholder={String(bpmAtual)} onChange={(e) => setBpm(Number(e.target.value) || null)} />
                <input type="number" step="0.001" min={0} value={inicioBatida ?? ''} placeholder={String(inicioAtual)} onChange={(e) => setInicioBatida(e.target.value === '' ? null : Number(e.target.value))} />
              </div>
              <label className="gn-check">
                <input type="checkbox" checked={aplicarBpm} onChange={(e) => setAplicarBpm(e.target.checked)} /> Usar no editor (grade)
              </label>
            </div>
          </div>
          <div className="gn-linha gn-acoes">
            <button type="button" className="btn primary" disabled={!carregou || ocupado} onClick={analisar}>
              {desatualizada ? '↻ Regerar (instrumento mudou)' : '↻ Regerar'}
            </button>
            <span className="adm-help">Sensibilidade, quantização, dificuldade, pistas e atraso mudam a prévia na hora.</span>
          </div>
        </section>

        {/* 3. Prévia */}
        <section className="gn-bloco">
          <h3>3. Prévia</h3>
          {previa && caract ? (
            <>
              <p className="gn-resumo">
                <b>{totalNotas}</b> notas{dificuldade === 'todas' ? ` no ${DIFICULDADES[difPrevia].nome}` : ''} · <b>{caract.c.bpm}</b> BPM detectado · 1ª
                batida em <b>{caract.c.inicioBatida.toFixed(3)} s</b> · {previa.comAltura} com altura ·{' '}
                {previa.notas.filter((n) => n.dur).length} longas
                {dificuldade === 'todas' && resultados ? (
                  <>
                    {' '}
                    ·{' '}
                    {ORDEM_DIFICULDADES.map((d) => `${DIFICULDADES[d].nome} ${resultados[d]?.notas.length ?? 0}`).join(' · ')}
                  </>
                ) : null}
              </p>
              <div className="gn-linha">
                <button type="button" className="btn ghost" onClick={() => (tocando ? pararTocar() : comecar(agulha >= duracao - 0.2 ? 0 : agulha))}>
                  {tocando ? '⏸ Pausar' : '▶ Tocar'}
                </button>
                <label className="gn-check">
                  <input type="checkbox" checked={ouvirNotas} onChange={(e) => setOuvirNotas(e.target.checked)} /> Bipe em cada nota
                </label>
              </div>
            </>
          ) : (
            <p className="adm-help">Escolha um áudio pra ver as notas geradas.</p>
          )}
          <div className="gn-rolagem" ref={rolagem}>
            <canvas
              ref={canvas}
              style={{ width: larguraCanvas, height: alturaCanvas }}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const t = Math.max(0, (e.clientX - r.left - 10) / PX_POR_S);
                agulhaRef.current = t;
                setAgulha(t);
                if (tocar.current) comecar(t);
              }}
            />
          </div>
          {previa && (
            <details className="gn-json">
              <summary>Ver um trecho do JSON</summary>
              <pre>{jsonAmostra}</pre>
            </details>
          )}
        </section>

        <footer className="gn-rodape">
          <span className="adm-help">
            {dificuldade === 'todas' ? 'Preenche as 4 dificuldades.' : `Preenche o ${DIFICULDADES[dificuldade].nome}.`} Nada é salvo até você clicar em Salvar no
            editor.
          </span>
          <button type="button" className="btn primary" disabled={!previa || ocupado || desatualizada} onClick={abrir}>
            Abrir no editor →
          </button>
        </footer>
      </div>
    </div>
  );
}
