'use client';

// Editor de músicas do Zelda Tour (admin). Linha do tempo na horizontal:
// em cima a régua (compassos) e a forma de onda do áudio; embaixo as 5
// pistas coloridas. Como usar (também aparece na tela, em "Atalhos"):
//  - clicar numa pista: põe uma nota (no tempo da grade);
//  - clicar e arrastar pra direita: nota longa (de segurar);
//  - notas em pistas diferentes no mesmo tempo = acorde;
//  - arrastar uma nota: move (tempo e pista); puxar a ponta: muda a duração;
//  - botão direito: apaga; Shift+arrastar no vazio (ou a ferramenta
//    "Selecionar"): seleciona várias; arrastar na forma de onda: seleciona
//    o trecho inteiro;
//  - Ctrl+C / Ctrl+X / Ctrl+V / Ctrl+D: copiar, recortar, colar no
//    ponto da agulha e duplicar logo em seguida (pra repetir partes);
//  - Espaço toca/pausa; com "Gravar ao vivo" ligado, as teclas 1–5 (ou
//    A S J K L) gravam as notas no ritmo enquanto a música toca;
//  - E: liga/desliga a Triforce nas notas selecionadas;
//  - T: testa no jogo a partir da agulha (ou da seleção).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { DIFICULDADES, FADE_FIM, ORDEM_DIFICULDADES, PISTAS, TECLAS_PADRAO, formatarDuracao, sequenciasEstrela, type Chart, type Dificuldade, type NotaChart } from '@/app/games-interativos/ocarina-hero/ocarina';
import { type MotorOcarina } from '@/app/games-interativos/ocarina-hero/motor';
import { SomOcarina, tocarClique } from '@/app/games-interativos/ocarina-hero/som';
import Palco from '@/app/games-interativos/ocarina-hero/Palco';
import '@/app/games-interativos/ocarina-hero/ocarina.css';
import { uploadAudioToSignedTicket, uploadToSignedTicket } from '@/lib/supabaseBrowser';
import { compressImageFile } from '@/lib/imageCompression';
import {
  apagarMusicaAction,
  autorizarAudioAction,
  confirmarAudioAction,
  autorizarFundoAction,
  definirFundoAction,
  publicarMusicaAction,
  salvarMusicaAction
} from '../actions';
import { compactarAudio, formatarBytes } from '../compactarAudio';
import type { OcarinaNota } from '@/lib/ocarinaDb';
import type { GeradoParaEditor } from '../gerador/GeradorNotas';

// Gerador automático de notas (só baixa quando abre).
const GeradorNotas = dynamic(() => import('../gerador/GeradorNotas'), { ssr: false });

export type MusicaEditor = {
  id: number;
  titulo: string;
  jogo: string;
  // a dificuldade aberta primeiro
  dificuldade: Dificuldade;
  bpm: number;
  inicioBatida: number;
  audioUrl: string | null;
  duracao: number | null;
  bytes: number | null;
  // notas de cada dificuldade e as que aparecem pros jogadores
  charts: Record<string, OcarinaNota[]>;
  liberadas: Dificuldade[];
  publicada: boolean;
  ativaDesde: string | null;
  // onde a música termina no jogo (null = até o fim do áudio)
  fimEm: number | null;
  // imagem de fundo do jogo nesta música (null = cenário padrão)
  fundo: string | null;
};

type NotaEd = { id: number; t: number; p: number; d: number; e?: boolean };
// Trecho copiado: notas com o tempo relativo à 1ª nota copiada, e o
// tamanho do trecho (inteiro, em compassos ou batidas).
type Copia = { notas: { t: number; p: number; d: number; e?: boolean }[]; tam: number; unidade: number };

// Geometria da linha do tempo (px)
const ESQ = 74;
const REGUA = 24;
const ONDA = 58;
const TOPO_PISTAS = REGUA + ONDA;
const PISTA_H = 44;
const ALTURA = TOPO_PISTAS + PISTA_H * PISTAS.length + 8;
const RAIO = 11;
const PICOS_POR_SEG = 200;

const GRADES = [
  { v: 1, nome: '1 batida' },
  { v: 2, nome: '1/2 batida' },
  { v: 3, nome: '1/3 (tercina)' },
  { v: 4, nome: '1/4 batida' },
  { v: 6, nome: '1/6' },
  { v: 8, nome: '1/8 batida' },
  { v: 0, nome: 'Livre (sem grade)' }
];
const TECLAS_PISTA: Record<string, number> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
  Digit5: 4,
  ...Object.fromEntries(PISTAS.map((p, i) => [TECLAS_PADRAO[p.id], i]))
};

let proximoId = 1;
const novaId = () => proximoId++;

const paraEditor = (lista: OcarinaNota[] = []): NotaEd[] =>
  lista.map((n) => ({ id: novaId(), t: n.t, p: Math.max(0, PISTAS.findIndex((x) => x.id === n.pista)), d: n.dur ?? 0, e: n.estrela === true }));

// Pista sempre válida (0 a 4). Tocar na sobra embaixo da última pista dava
// uma pista "6" que não existe e derrubava o editor.
const pistaOk = (p: number) => Math.max(0, Math.min(PISTAS.length - 1, Math.floor(p) || 0));
const pistaDe = (p: number) => PISTAS[pistaOk(p)];

const paraSalvar = (lista: NotaEd[]): OcarinaNota[] =>
  [...lista]
    .sort((a, b) => a.t - b.t || a.p - b.p)
    .map((n) => ({ t: Math.round(n.t * 1000) / 1000, pista: pistaDe(n.p).id, ...(n.d > 0 ? { dur: Math.round(n.d * 1000) / 1000 } : {}), ...(n.e ? { estrela: true } : {}) }));

export default function EditorMusica({ musica, jogos }: { musica: MusicaEditor; jogos: string[] }) {
  const router = useRouter();
  // ---------- Dados ----------
  const [titulo, setTitulo] = useState(musica.titulo);
  const [jogo, setJogo] = useState(musica.jogo);
  const [dificuldade, setDificuldade] = useState<Dificuldade>(musica.dificuldade);
  const [bpm, setBpm] = useState(musica.bpm);
  const [inicioBatida, setInicioBatida] = useState(musica.inicioBatida);
  const [fimEm, setFimEm] = useState<number | null>(musica.fimEm);
  const fimRef = useRef(fimEm);
  fimRef.current = fimEm;
  const [notas, setNotas] = useState<NotaEd[]>(() => paraEditor(musica.charts[musica.dificuldade]));
  // Notas das outras dificuldades, enquanto não estão abertas.
  const outras = useRef<Partial<Record<Dificuldade, NotaEd[]>>>(
    Object.fromEntries(ORDEM_DIFICULDADES.filter((d) => d !== musica.dificuldade).map((d) => [d, paraEditor(musica.charts[d])]))
  );
  const [liberadas, setLiberadas] = useState<Dificuldade[]>(musica.liberadas);
  const [origemCopia, setOrigemCopia] = useState<Dificuldade>(musica.dificuldade);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [sujo, setSujo] = useState(false);
  const passado = useRef<NotaEd[][]>([]);
  const futuro = useRef<NotaEd[][]>([]);
  const notasRef = useRef(notas);
  notasRef.current = notas;
  const selRef = useRef(sel);
  selRef.current = sel;

  const [audioUrl, setAudioUrl] = useState(musica.audioUrl);
  const [duracao, setDuracao] = useState(musica.duracao ?? 0);
  const [bytes, setBytes] = useState(musica.bytes ?? 0);
  const [publicada, setPublicada] = useState(musica.publicada);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro' | 'info'; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [envio, setEnvio] = useState<string | null>(null);
  const [fundo, setFundo] = useState<string | null>(musica.fundo);
  const [envioFundo, setEnvioFundo] = useState<string | null>(null);

  // ---------- Visual / tocar ----------
  const [grade, setGrade] = useState(4);
  const [zoom, setZoom] = useState(180); // px por segundo
  const [vista, setVista] = useState(0); // segundo na borda esquerda
  const [largura, setLargura] = useState(900);
  const [tocando, setTocando] = useState(false);
  const [velocidade, setVelocidade] = useState(1);
  const [metronomo, setMetronomo] = useState(false);
  const [palmas, setPalmas] = useState(true);
  // 'mao' (só no celular): arrastar com um dedo rola a linha do tempo.
  const [ferramenta, setFerramenta] = useState<'notas' | 'selecionar' | 'mao'>('notas');
  // Celular: layout próprio (abas, barra fixa embaixo, toque).
  const [celular, setCelular] = useState(false);
  const [aba, setAba] = useState<'editar' | 'musica' | 'ritmo'>('editar');
  const [opcoes, setOpcoes] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const f = () => setCelular(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  // Coluna das cores à esquerda (no celular, só a bolinha) e folga do toque.
  const esq = celular ? 34 : ESQ;
  const folga = celular ? 8 : 0;
  const [copia, setCopia] = useState<Copia | null>(null);
  const copiaRef = useRef<Copia | null>(null);
  copiaRef.current = copia;
  const [gravandoVivo, setGravandoVivo] = useState(false);
  const [gerador, setGerador] = useState(false);
  const [posTexto, setPosTexto] = useState(0);
  const pos = useRef(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const ctxAudio = useRef<AudioContext | null>(null);
  const buffer = useRef<AudioBuffer | null>(null);
  const [picos, setPicos] = useState<Float32Array | null>(null);
  const tocar = useRef<{ fonte: AudioBufferSourceNode | null; ctxInicio: number; posInicio: number; agendado: number } | null>(null);
  const mouse = useRef<{ x: number; y: number } | null>(null);
  const [testando, setTestando] = useState<number | null>(null);

  const batida = 60 / Math.max(1, bpm);
  const passo = grade ? batida / grade : 0;
  const duracaoTotal = Math.max(duracao, ...notas.map((n) => n.t + n.d + 2), 10);

  const encaixar = useCallback(
    (t: number) => (passo ? inicioBatida + Math.round((t - inicioBatida) / passo) * passo : Math.round(t * 1000) / 1000),
    [passo, inicioBatida]
  );
  const xDe = useCallback((t: number) => esq + (t - vista) * zoom, [vista, zoom, esq]);
  const tDe = useCallback((x: number) => vista + (x - esq) / zoom, [vista, zoom, esq]);

  // ---------- Histórico (desfazer/refazer) ----------
  const guardarHistorico = useCallback(() => {
    passado.current.push(notasRef.current);
    if (passado.current.length > 200) passado.current.shift();
    futuro.current = [];
    setSujo(true);
  }, []);
  const mudar = useCallback(
    (fn: (n: NotaEd[]) => NotaEd[]) => {
      guardarHistorico();
      setNotas((n) => fn(n));
    },
    [guardarHistorico]
  );
  const desfazer = useCallback(() => {
    const a = passado.current.pop();
    if (!a) return;
    futuro.current.push(notasRef.current);
    setNotas(a);
    setSujo(true);
  }, []);
  const refazer = useCallback(() => {
    const a = futuro.current.pop();
    if (!a) return;
    passado.current.push(notasRef.current);
    setNotas(a);
    setSujo(true);
  }, []);

  // ---------- Áudio ----------
  const garantirCtx = useCallback(() => {
    if (!ctxAudio.current) ctxAudio.current = new AudioContext();
    return ctxAudio.current;
  }, []);

  useEffect(() => {
    if (!audioUrl) return;
    let vivo = true;
    setAviso({ tipo: 'info', texto: 'Carregando o áudio…' });
    fetch(audioUrl)
      .then((r) => r.arrayBuffer())
      .then((b) => garantirCtx().decodeAudioData(b))
      .then((buf) => {
        if (!vivo) return;
        buffer.current = buf;
        setDuracao(buf.duration);
        // Forma de onda: pico de cada 5 ms.
        const d = buf.getChannelData(0);
        const por = Math.max(1, Math.floor(buf.sampleRate / PICOS_POR_SEG));
        const p = new Float32Array(Math.ceil(d.length / por));
        for (let i = 0; i < p.length; i++) {
          let m = 0;
          for (let j = i * por, f = Math.min(d.length, j + por); j < f; j++) {
            const v = Math.abs(d[j]);
            if (v > m) m = v;
          }
          p[i] = m;
        }
        setPicos(p);
        setAviso(null);
      })
      .catch(() => vivo && setAviso({ tipo: 'erro', texto: 'Não consegui carregar o áudio. Envie de novo.' }));
    return () => {
      vivo = false;
    };
  }, [audioUrl, garantirCtx]);

  const clique = useCallback((quando: number, forte: boolean, tipo: 'metro' | 'palma') => {
    const ctx = ctxAudio.current;
    if (!ctx) return;
    if (tipo === 'palma') {
      // clique seco e curtinho em cada nota
      tocarClique(ctx, ctx.destination, quando, 0.55);
      return;
    }
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = forte ? 1600 : 1100;
    g.gain.setValueAtTime(forte ? 0.12 : 0.07, quando);
    g.gain.exponentialRampToValueAtTime(0.0008, quando + 0.05);
    o.connect(g).connect(ctx.destination);
    o.start(quando);
    o.stop(quando + 0.06);
  }, []);

  const pararTocar = useCallback(() => {
    const t = tocar.current;
    if (t?.fonte) {
      try {
        t.fonte.stop();
      } catch {
        // já parou
      }
    }
    tocar.current = null;
    setTocando(false);
  }, []);

  const comecarTocar = useCallback(
    (desde: number) => {
      const ctx = garantirCtx();
      ctx.resume();
      pararTocar();
      let fonte: AudioBufferSourceNode | null = null;
      if (buffer.current) {
        fonte = ctx.createBufferSource();
        fonte.buffer = buffer.current;
        fonte.playbackRate.value = velocidade;
        // fade nos últimos FADE_FIM s antes do fim marcado (igual no jogo)
        const fade = ctx.createGain();
        fonte.connect(fade).connect(ctx.destination);
        const tIni = ctx.currentTime + 0.03;
        const fim = fimRef.current;
        if (fim && desde < fim) {
          const tFim = tIni + (fim - desde) / velocidade;
          fade.gain.setValueAtTime(1, Math.max(tIni, tFim - FADE_FIM / velocidade));
          fade.gain.linearRampToValueAtTime(0, tFim);
        }
        fonte.start(tIni, Math.max(0, desde));
        fonte.onended = () => {
          if (tocar.current?.fonte === fonte) pararTocar();
        };
      }
      tocar.current = { fonte, ctxInicio: ctx.currentTime + 0.03, posInicio: desde, agendado: desde };
      setTocando(true);
    },
    [garantirCtx, pararTocar, velocidade]
  );

  const irPara = useCallback(
    (t: number) => {
      pos.current = Math.max(0, Math.min(duracaoTotal, t));
      setPosTexto(pos.current);
      if (tocar.current) comecarTocar(pos.current);
    },
    [comecarTocar, duracaoTotal]
  );

  // ---------- Desenho ----------
  const desenhar = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(largura * dpr)) {
      c.width = Math.round(largura * dpr);
      c.height = Math.round(ALTURA * dpr);
    }
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#0d0a1a';
    g.fillRect(0, 0, largura, ALTURA);
    const tFim = tDe(largura);

    // Pistas
    PISTAS.forEach((p, i) => {
      const y = TOPO_PISTAS + i * PISTA_H;
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.045)';
      g.fillRect(esq, y, largura - esq, PISTA_H);
      g.fillStyle = p.cor + '22';
      g.fillRect(0, y, esq, PISTA_H);
      g.beginPath();
      g.arc(20, y + PISTA_H / 2, 9, 0, Math.PI * 2);
      g.fillStyle = p.cor;
      g.fill();
      if (!celular) {
        g.fillStyle = '#d9d0f5';
        g.font = '700 11px system-ui, sans-serif';
        g.textBaseline = 'middle';
        g.fillText(`${i + 1} · ${TECLAS_PADRAO[p.id].slice(3)}`, 35, y + PISTA_H / 2);
      }
    });

    // Grade: compassos, batidas e subdivisões
    const sub = grade || 1;
    const p0 = batida / sub;
    let k = Math.floor((vista - inicioBatida) / p0);
    g.font = '700 10px system-ui, sans-serif';
    for (let t = inicioBatida + k * p0; t <= tFim; k++, t = inicioBatida + k * p0) {
      if (t < 0) continue;
      const x = xDe(t);
      if (x < esq) continue;
      const ehBatida = k % sub === 0;
      const ehCompasso = k % (sub * 4) === 0;
      if (!ehBatida && zoom * p0 < 7) continue;
      g.strokeStyle = ehCompasso ? 'rgba(200,170,255,0.55)' : ehBatida ? 'rgba(200,170,255,0.22)' : 'rgba(200,170,255,0.08)';
      g.lineWidth = ehCompasso ? 1.5 : 1;
      g.beginPath();
      g.moveTo(x + 0.5, ehCompasso ? 0 : REGUA);
      g.lineTo(x + 0.5, ALTURA);
      g.stroke();
      if (ehCompasso) {
        g.fillStyle = '#cbb8ff';
        g.textBaseline = 'top';
        g.fillText(String(Math.floor(k / (sub * 4)) + 1), x + 4, 4);
      }
    }
    // Tempo (mm:ss) na régua, à direita dos números de compasso
    g.fillStyle = 'rgba(220,210,255,0.45)';
    g.textBaseline = 'top';
    for (let s = Math.ceil(vista); s <= tFim; s++) {
      if (zoom < 60 && s % 5) continue;
      const x = xDe(s);
      if (x > esq + 10) g.fillText(formatarDuracao(s), x + 2, 13);
    }

    // Forma de onda
    if (picos) {
      const meio = REGUA + ONDA / 2;
      // todas as colunas num caminho só e um fill (bem mais leve que um
      // fillRect por pixel, já que isso roda a cada quadro tocando)
      g.fillStyle = 'rgba(160, 120, 255, 0.55)';
      g.beginPath();
      for (let x = esq; x < largura; x++) {
        const a = Math.floor(tDe(x) * PICOS_POR_SEG);
        if (a >= picos.length) break;
        const b = Math.max(a + 1, Math.floor(tDe(x + 1) * PICOS_POR_SEG));
        let m = 0;
        for (let i = Math.max(0, a); i < Math.min(picos.length, b); i++) if (picos[i] > m) m = picos[i];
        const h = Math.max(1, m * (ONDA - 8));
        g.rect(x, meio - h / 2, 1, h);
      }
      g.fill();
    } else {
      g.fillStyle = 'rgba(220,210,255,0.4)';
      g.font = '700 12px system-ui, sans-serif';
      g.textBaseline = 'middle';
      g.fillText(
        audioUrl ? 'Carregando o áudio…' : celular ? 'Envie o áudio na aba Música' : 'Envie o áudio da música (ao lado) pra ver a forma de onda',
        esq + 12,
        REGUA + ONDA / 2
      );
    }
    g.fillStyle = 'rgba(255,255,255,0.06)';
    g.fillRect(0, REGUA + ONDA - 1, largura, 1);
    // Fim marcado: faixa do fade (FADE_FIM s antes), linha vermelha e o
    // resto escurecido
    if (fimEm) {
      const xf = xDe(fimEm);
      const xa = xDe(fimEm - FADE_FIM);
      if (xf > esq && xa < largura) {
        const gr = g.createLinearGradient(xa, 0, xf, 0);
        gr.addColorStop(0, 'rgba(255,77,94,0)');
        gr.addColorStop(1, 'rgba(255,77,94,0.28)');
        g.fillStyle = gr;
        g.fillRect(Math.max(esq, xa), REGUA, xf - Math.max(esq, xa), ALTURA - REGUA);
      }
      if (xf < largura) {
        g.fillStyle = 'rgba(0,0,0,0.55)';
        g.fillRect(Math.max(esq, xf), REGUA, largura - Math.max(esq, xf), ALTURA - REGUA);
      }
      if (xf > esq && xf < largura) {
        g.strokeStyle = '#ff4d5e';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(xf, 0);
        g.lineTo(xf, ALTURA);
        g.stroke();
        g.fillStyle = '#ff4d5e';
        g.font = '900 10px system-ui, sans-serif';
        g.textBaseline = 'top';
        g.fillText('FIM', xf + 4, REGUA + 3);
      }
      if (xa > esq && xa < largura) {
        g.fillStyle = '#ff8a95';
        g.font = '900 10px system-ui, sans-serif';
        g.textBaseline = 'top';
        g.fillText('fade', xa + 4, REGUA + 3);
      }
    }
    // Fim do áudio
    if (duracao) {
      const x = xDe(duracao);
      if (x > esq && x < largura) {
        g.fillStyle = 'rgba(0,0,0,0.45)';
        g.fillRect(x, REGUA, largura - x, ALTURA - REGUA);
      }
    }

    // Notas
    const s = selRef.current;
    for (const n of notasRef.current) {
      const x = xDe(n.t);
      const x2 = xDe(n.t + n.d);
      if (x2 < esq - RAIO || x > largura + RAIO) continue;
      const y = TOPO_PISTAS + pistaOk(n.p) * PISTA_H + PISTA_H / 2;
      const cor = pistaDe(n.p).cor;
      const marcada = s.has(n.id);
      if (n.d > 0) {
        g.fillStyle = cor + (marcada ? 'cc' : '88');
        g.beginPath();
        g.roundRect(x, y - 6, Math.max(2, x2 - x), 12, 6);
        g.fill();
        // ponta (puxar muda a duração)
        g.fillStyle = marcada ? '#ffffff' : cor;
        g.beginPath();
        g.roundRect(x2 - 4, y - 9, 8, 18, 3);
        g.fill();
      } else if (marcada) {
        g.fillStyle = 'rgba(255,255,255,0.55)';
        g.beginPath();
        g.roundRect(x + RAIO + 3, y - 7, 7, 14, 3);
        g.fill();
      }
      g.beginPath();
      g.arc(x, y, RAIO, 0, Math.PI * 2);
      g.fillStyle = cor;
      g.fill();
      g.lineWidth = marcada ? 3 : 1.5;
      g.strokeStyle = marcada ? '#ffffff' : 'rgba(0,0,0,0.45)';
      g.stroke();
      g.beginPath();
      g.arc(x, y, RAIO * 0.45, 0, Math.PI * 2);
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = 2;
      g.stroke();
      if (n.e) {
        // nota Triforce
        g.beginPath();
        g.moveTo(x, y - RAIO - 3);
        g.lineTo(x + RAIO + 3, y + RAIO);
        g.lineTo(x - RAIO - 3, y + RAIO);
        g.closePath();
        g.fillStyle = '#ffd23e';
        g.fill();
        g.lineWidth = 1.5;
        g.strokeStyle = '#3a2a00';
        g.stroke();
      }
    }

    // Fantasma (onde o clique vai pôr a nota)
    const m = mouse.current;
    if (m && !arrasto.current && m.y > TOPO_PISTAS && m.x > esq) {
      const p = Math.floor((m.y - TOPO_PISTAS) / PISTA_H);
      if (p >= 0 && p < PISTAS.length && !acharNota(m.x, m.y)) {
        const t = encaixar(tDe(m.x));
        g.globalAlpha = 0.35;
        g.beginPath();
        g.arc(xDe(t), TOPO_PISTAS + p * PISTA_H + PISTA_H / 2, RAIO, 0, Math.PI * 2);
        g.fillStyle = PISTAS[p].cor;
        g.fill();
        g.globalAlpha = 1;
      }
    }

    // Caixa de seleção
    const a = arrasto.current;
    if (a?.modo === 'caixa') {
      g.fillStyle = 'rgba(164,99,255,0.15)';
      g.strokeStyle = '#a463ff';
      g.lineWidth = 1;
      const x0 = Math.min(a.x0, a.x1);
      const y0 = Math.min(a.y0, a.y1);
      g.fillRect(x0, y0, Math.abs(a.x1 - a.x0), Math.abs(a.y1 - a.y0));
      g.strokeRect(x0 + 0.5, y0 + 0.5, Math.abs(a.x1 - a.x0), Math.abs(a.y1 - a.y0));
    }
    if (a?.modo === 'faixa' && a.mexeu) {
      const x0 = Math.min(a.x0, a.x1);
      g.fillStyle = 'rgba(255,210,62,0.12)';
      g.fillRect(x0, REGUA, Math.abs(a.x1 - a.x0), ALTURA - REGUA);
      g.strokeStyle = 'rgba(255,210,62,0.8)';
      g.lineWidth = 1;
      g.strokeRect(x0 + 0.5, REGUA + 0.5, Math.abs(a.x1 - a.x0), ALTURA - REGUA - 1);
    }
    // Trecho das notas selecionadas (faixa na forma de onda)
    if (s.size > 1) {
      let ini = Infinity;
      let fim = -Infinity;
      for (const n of notasRef.current)
        if (s.has(n.id)) {
          ini = Math.min(ini, n.t);
          fim = Math.max(fim, n.t + n.d);
        }
      const xa = Math.max(esq, xDe(ini));
      const xb = Math.min(largura, xDe(fim));
      if (xb > xa - 1) {
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.fillRect(xa - RAIO, REGUA, xb - xa + RAIO * 2, ONDA);
      }
    }

    // Agulha
    const xp = xDe(pos.current);
    if (xp >= esq - 1 && xp <= largura) {
      g.strokeStyle = gravandoVivo && tocando ? '#ff4d5e' : '#ffd23e';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(xp, 0);
      g.lineTo(xp, ALTURA);
      g.stroke();
      g.fillStyle = g.strokeStyle;
      g.beginPath();
      g.moveTo(xp - 6, 0);
      g.lineTo(xp + 6, 0);
      g.lineTo(xp, 9);
      g.fill();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [largura, vista, zoom, grade, batida, inicioBatida, picos, duracao, audioUrl, gravandoVivo, tocando, xDe, tDe, encaixar, notas, sel, fimEm, esq, celular]);

  useEffect(() => {
    desenhar();
  }, [desenhar]);

  // Largura do quadro
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setLargura(Math.max(celular ? 240 : 400, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [celular]);

  // Laço enquanto toca: anda a agulha, rola a tela, metrônomo e palmas.
  useEffect(() => {
    if (!tocando) return;
    let raf = 0;
    let ultimoTexto = 0;
    const loop = (agoraMs: number) => {
      const t = tocar.current;
      const ctx = ctxAudio.current;
      if (!t || !ctx) return;
      const p = t.posInicio + Math.max(0, ctx.currentTime - t.ctxInicio) * velocidade;
      pos.current = p;
      // agenda cliques até 150 ms à frente
      const ate = p + 0.15 * velocidade;
      const quando = (tt: number) => t.ctxInicio + (tt - t.posInicio) / velocidade;
      if (metronomo) {
        let kk = Math.ceil((t.agendado - inicioBatida) / batida - 1e-6);
        for (let tb = inicioBatida + kk * batida; tb <= ate; kk++, tb = inicioBatida + kk * batida) {
          if (tb >= t.agendado && tb >= 0) clique(quando(tb), kk % 4 === 0, 'metro');
        }
      }
      if (palmas && !gravandoVivo) {
        let feitos: Set<number> | null = null; // acorde = um clique só
        for (const n of notasRef.current) {
          if (n.t < t.agendado || n.t >= ate) continue;
          const ms = Math.round(n.t * 1000);
          feitos ??= new Set<number>();
          if (!feitos.has(ms)) {
            feitos.add(ms);
            clique(quando(n.t), false, 'palma');
          }
        }
      }
      t.agendado = Math.max(t.agendado, ate);
      // rola junto
      const larg = (largura - esq) / zoom;
      if (p > vista + larg * 0.85 || p < vista) setVista(Math.max(0, p - larg * 0.15));
      if (agoraMs - ultimoTexto > 90) {
        setPosTexto(p);
        ultimoTexto = agoraMs;
      }
      if (duracao && p > duracao + 0.5) pararTocar();
      if (fimRef.current && p > fimRef.current + 0.3 && t.posInicio < fimRef.current) pararTocar();
      desenhar();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tocando, velocidade, metronomo, palmas, gravandoVivo, inicioBatida, batida, largura, zoom, vista, duracao, clique, desenhar, pararTocar, esq]);

  // ---------- Mouse ----------
  type Arrasto =
    | { modo: 'buscar' }
    | { modo: 'criar'; id: number; t0: number }
    | { modo: 'mover'; xIni: number; pIni: number; originais: Map<number, NotaEd>; mexeu: boolean }
    | { modo: 'esticar'; id: number; mexeu: boolean }
    | { modo: 'caixa'; x0: number; y0: number; x1: number; y1: number; somar: boolean }
    | { modo: 'faixa'; x0: number; x1: number; mexeu: boolean; somar: boolean }
    // toque: um dedo rolando (ferramenta Mover) e dois dedos (pinça/rolar)
    | { modo: 'rolar'; x0: number; vista0: number }
    | { modo: 'pinca'; dist0: number; zoom0: number; tCentro: number }
    | { modo: 'nada' };
  const arrasto = useRef<Arrasto | null>(null);
  const dedos = useRef(new Map<number, { x: number; y: number }>());

  // Segundo dedo encostou: desfaz o que o primeiro começou e vira pinça.
  function comecarPinca() {
    const a = arrasto.current;
    if (a && (a.modo === 'criar' || a.modo === 'mover' || a.modo === 'esticar')) {
      const antes = passado.current.pop();
      if (antes) {
        notasRef.current = antes;
        setNotas(antes);
      }
    }
    const [p1, p2] = [...dedos.current.values()];
    const cx = (p1.x + p2.x) / 2;
    arrasto.current = { modo: 'pinca', dist0: Math.max(20, Math.hypot(p1.x - p2.x, p1.y - p2.y)), zoom0: zoom, tCentro: tDe(cx) };
  }

  function acharNota(x: number, y: number): { n: NotaEd; parte: 'corpo' | 'ponta' } | null {
    const p = Math.floor((y - TOPO_PISTAS) / PISTA_H);
    if (p < 0 || p >= PISTAS.length) return null;
    const lista = notasRef.current;
    // pontas primeiro (notas longas e a alça das selecionadas)
    for (const n of lista) {
      if (n.p !== p) continue;
      const xa = n.d > 0 ? xDe(n.t + n.d) : selRef.current.has(n.id) ? xDe(n.t) + RAIO + 6 : NaN;
      if (Math.abs(x - xa) <= 7 + folga / 2) return { n, parte: 'ponta' };
    }
    let melhor: NotaEd | null = null;
    let dist = Infinity;
    for (const n of lista) {
      if (n.p !== p) continue;
      const dx = Math.abs(x - xDe(n.t));
      const naBarra = n.d > 0 && x >= xDe(n.t) && x <= xDe(n.t + n.d);
      if ((dx <= RAIO + 2 + folga || naBarra) && dx < dist) {
        melhor = n;
        dist = dx;
      }
    }
    return melhor ? { n: melhor, parte: 'corpo' } : null;
  }

  function coord(e: React.PointerEvent | React.MouseEvent) {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function aoApertar(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.button === 2) return;
    canvas.current?.setPointerCapture(e.pointerId);
    if (e.pointerType !== 'touch') canvas.current?.focus();
    const { x, y } = coord(e);
    if (e.pointerType === 'touch') {
      dedos.current.set(e.pointerId, { x, y });
      if (dedos.current.size === 2) {
        comecarPinca();
        return;
      }
      if (dedos.current.size > 2) return;
    }
    if (ferramenta === 'mao' && y >= TOPO_PISTAS && x >= esq) {
      // Mover: tocar numa nota só seleciona; arrastar rola.
      const achou = acharNota(x, y);
      if (achou) setSel(new Set([achou.n.id]));
      arrasto.current = { modo: 'rolar', x0: x, vista0: vista };
      return;
    }
    if (y >= REGUA && y < TOPO_PISTAS && x >= esq) {
      // forma de onda: clique = agulha; arrastar = seleciona o trecho todo
      arrasto.current = { modo: 'faixa', x0: x, x1: x, mexeu: false, somar: e.shiftKey || e.ctrlKey || e.metaKey };
      irPara(tDe(x));
      return;
    }
    if (y < TOPO_PISTAS || x < esq) {
      arrasto.current = { modo: 'buscar' };
      irPara(tDe(Math.max(esq, x)));
      return;
    }
    const achou = acharNota(x, y);
    if (achou) {
      const { n, parte } = achou;
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        setSel((s) => {
          const ns = new Set(s);
          if (ns.has(n.id)) ns.delete(n.id);
          else ns.add(n.id);
          return ns;
        });
        return;
      }
      const s = selRef.current.has(n.id) ? selRef.current : new Set([n.id]);
      setSel(s);
      selRef.current = s;
      guardarHistorico();
      if (parte === 'ponta') {
        arrasto.current = { modo: 'esticar', id: n.id, mexeu: false };
      } else {
        const originais = new Map(notasRef.current.filter((x) => s.has(x.id)).map((x) => [x.id, { ...x }]));
        arrasto.current = { modo: 'mover', xIni: x, pIni: n.p, originais, mexeu: false };
      }
      return;
    }
    if (e.shiftKey || e.ctrlKey || e.metaKey || ferramenta === 'selecionar') {
      arrasto.current = { modo: 'caixa', x0: x, y0: y, x1: x, y1: y, somar: e.shiftKey || e.ctrlKey || e.metaKey };
      return;
    }
    // Nota nova (a sobra embaixo da última pista conta como a última)
    const p = pistaOk((y - TOPO_PISTAS) / PISTA_H);
    const t = Math.max(0, encaixar(tDe(x)));
    const nova: NotaEd = { id: novaId(), t, p, d: 0 };
    mudar((l) => [...l.filter((o) => !(o.p === p && Math.abs(o.t - t) < 0.001)), nova]);
    setSel(new Set([nova.id]));
    arrasto.current = { modo: 'criar', id: nova.id, t0: t };
  }

  function aoMover(e: React.PointerEvent<HTMLCanvasElement>) {
    const { x, y } = coord(e);
    if (e.pointerType === 'touch') {
      if (!dedos.current.has(e.pointerId)) return;
      dedos.current.set(e.pointerId, { x, y });
    } else mouse.current = { x, y };
    const a = arrasto.current;
    if (a?.modo === 'nada') return;
    if (a?.modo === 'pinca') {
      if (dedos.current.size < 2) return;
      const [p1, p2] = [...dedos.current.values()];
      const cx = (p1.x + p2.x) / 2;
      const novo = Math.max(30, Math.min(1200, (a.zoom0 * Math.hypot(p1.x - p2.x, p1.y - p2.y)) / a.dist0));
      setZoom(novo);
      setVista(Math.max(0, Math.min(duracaoTotal, a.tCentro - (cx - esq) / novo)));
      return;
    }
    if (a?.modo === 'rolar') {
      setVista(Math.max(0, Math.min(duracaoTotal, a.vista0 - (x - a.x0) / zoom)));
      return;
    }
    if (!a) {
      if (e.pointerType === 'touch') return;
      const achou = y > TOPO_PISTAS ? acharNota(x, y) : null;
      canvas.current!.style.cursor =
        y < REGUA ? 'col-resize' : y < TOPO_PISTAS ? 'text' : achou?.parte === 'ponta' ? 'ew-resize' : achou ? 'grab' : ferramenta === 'selecionar' ? 'cell' : 'crosshair';
      desenhar();
      return;
    }
    if (a.modo === 'buscar') {
      irPara(tDe(Math.max(esq, x)));
    } else if (a.modo === 'criar') {
      const fim = encaixar(tDe(x));
      const d = fim - a.t0;
      const minimo = passo || 0.05;
      setNotas((l) => l.map((n) => (n.id === a.id ? { ...n, d: d >= minimo * 0.99 ? d : 0 } : n)));
    } else if (a.modo === 'esticar') {
      a.mexeu = true;
      setNotas((l) =>
        l.map((n) => {
          if (n.id !== a.id) return n;
          const d = encaixar(tDe(x)) - n.t;
          return { ...n, d: d >= (passo || 0.05) * 0.99 ? d : 0 };
        })
      );
    } else if (a.modo === 'mover') {
      const dt = (x - a.xIni) / zoom;
      const dp = Math.floor((y - TOPO_PISTAS) / PISTA_H) - a.pIni;
      if (Math.abs(x - a.xIni) > 3 || dp) a.mexeu = true;
      if (!a.mexeu) return;
      setNotas((l) =>
        l.map((n) => {
          const o = a.originais.get(n.id);
          if (!o) return n;
          return { ...n, t: Math.max(0, encaixar(o.t + dt)), p: Math.max(0, Math.min(PISTAS.length - 1, o.p + dp)) };
        })
      );
    } else if (a.modo === 'caixa') {
      a.x1 = x;
      a.y1 = y;
      desenhar();
    } else if (a.modo === 'faixa') {
      a.x1 = Math.max(esq, x);
      if (Math.abs(a.x1 - a.x0) > 4) a.mexeu = true;
      desenhar();
    }
  }

  function aoSoltar(e?: React.PointerEvent<HTMLCanvasElement>) {
    if (e?.pointerType === 'touch') {
      dedos.current.delete(e.pointerId);
      // Saiu um dos dois dedos da pinça: o outro não faz mais nada até soltar.
      if (arrasto.current?.modo === 'pinca' || arrasto.current?.modo === 'nada') {
        arrasto.current = dedos.current.size ? { modo: 'nada' } : null;
        return;
      }
    }
    const a = arrasto.current;
    arrasto.current = null;
    if (!a) return;
    if ((a.modo === 'mover' || a.modo === 'esticar') && !a.mexeu) {
      // só clicou: desfaz o histórico guardado à toa
      passado.current.pop();
    }
    if (a.modo === 'caixa') {
      const t0 = tDe(Math.min(a.x0, a.x1));
      const t1 = tDe(Math.max(a.x0, a.x1));
      const p0 = Math.floor((Math.min(a.y0, a.y1) - TOPO_PISTAS) / PISTA_H);
      const p1 = Math.floor((Math.max(a.y0, a.y1) - TOPO_PISTAS) / PISTA_H);
      const dentro = notasRef.current.filter((n) => n.t >= t0 && n.t <= t1 && n.p >= p0 && n.p <= p1).map((n) => n.id);
      setSel((s) => new Set([...(a.somar ? s : []), ...dentro]));
    }
    if (a.modo === 'faixa' && a.mexeu) {
      const t0 = tDe(Math.min(a.x0, a.x1));
      const t1 = tDe(Math.max(a.x0, a.x1));
      const dentro = notasRef.current.filter((n) => n.t >= t0 - 0.001 && n.t <= t1 + 0.001).map((n) => n.id);
      setSel((s) => new Set([...(a.somar ? s : []), ...dentro]));
      irPara(Math.max(0, encaixar(t0)));
      setAviso({
        tipo: 'info',
        texto: celular
          ? `${dentro.length} notas selecionadas no trecho. Use Copiar ou Repetir na barra de baixo.`
          : `${dentro.length} notas selecionadas no trecho. Ctrl+C copia, Ctrl+D duplica logo depois.`
      });
    }
    desenhar();
  }

  function apagarSelecionadas() {
    if (!selRef.current.size) return;
    const s = selRef.current;
    mudar((l) => l.filter((n) => !s.has(n.id)));
    setSel(new Set());
  }

  // ---------- Copiar / colar / duplicar ----------
  // O trecho copiado é arredondado pra compassos inteiros (ou batidas, se
  // for curtinho), contados a partir do 1º tempo da grade. Assim, colar ou
  // duplicar mantém as notas no mesmo lugar do compasso.
  function trechoDe(lista: NotaEd[]): { ini: number; tam: number; unidade: number } {
    const ini = Math.min(...lista.map((n) => n.t));
    const fim = Math.max(...lista.map((n) => n.t + Math.max(n.d, 0.001)));
    const unidade = fim - ini > batida * 2 ? batida * 4 : batida;
    const a = inicioBatida + Math.floor((ini - inicioBatida) / unidade + 1e-6) * unidade;
    let b = inicioBatida + Math.ceil((fim - inicioBatida) / unidade - 1e-6) * unidade;
    if (b <= a + 1e-6) b = a + unidade;
    return { ini: a, tam: b - a, unidade };
  }
  const nomeTrecho = (c: Copia) => {
    const n = Math.round(c.tam / c.unidade);
    return c.unidade > batida * 2 ? `${n} compasso${n > 1 ? 's' : ''}` : `${n} batida${n > 1 ? 's' : ''}`;
  };

  function copiar(): Copia | null {
    const lista = notasRef.current.filter((n) => selRef.current.has(n.id));
    if (!lista.length) {
      setAviso({ tipo: 'info', texto: 'Selecione as notas primeiro (arraste na forma de onda pra pegar um trecho inteiro).' });
      return null;
    }
    const { tam, unidade } = trechoDe(lista);
    // tempos contados a partir da 1ª nota copiada: ela é que vai pra agulha
    const primeira = Math.min(...lista.map((n) => n.t));
    const c: Copia = { notas: lista.map((n) => ({ t: n.t - primeira, p: n.p, d: n.d, e: n.e })), tam, unidade };
    setCopia(c);
    copiaRef.current = c;
    setAviso({ tipo: 'info', texto: `Copiadas ${lista.length} notas (${nomeTrecho(c)}). Ponha a agulha onde quer que a 1ª nota fique e aperte Colar.` });
    return c;
  }

  // Cola com a 1ª nota do trecho exatamente na agulha (encaixada na grade);
  // depois a agulha anda o tamanho do trecho — Colar de novo continua.
  function colar(em: number, c: Copia | null = copiaRef.current) {
    if (!c || !c.notas.length) return;
    const destino = Math.max(0, encaixar(em));
    const novas = c.notas.map((n) => ({ id: novaId(), t: Math.round((destino + n.t) * 1000) / 1000, p: n.p, d: n.d, e: n.e }));
    const ocupa = new Set(novas.map((n) => `${n.p}:${Math.round(n.t * 1000)}`));
    mudar((l) => [...l.filter((o) => !ocupa.has(`${o.p}:${Math.round(o.t * 1000)}`)), ...novas]);
    setSel(new Set(novas.map((n) => n.id)));
    irPara(destino + c.tam);
    const larg = (largura - esq) / zoom;
    if (destino + c.tam > vista + larg || destino < vista) setVista(Math.max(0, destino - larg * 0.2));
  }

  // Duplica o que está selecionado logo depois dele (pra repetir uma parte).
  function duplicar() {
    const lista = notasRef.current.filter((n) => selRef.current.has(n.id));
    if (!lista.length) {
      setAviso({ tipo: 'info', texto: 'Selecione as notas que quer repetir.' });
      return;
    }
    const c = copiar();
    if (!c) return;
    const primeira = Math.min(...lista.map((n) => n.t));
    colar(primeira + c.tam, c);
    setAviso({ tipo: 'ok', texto: `Repetido logo em seguida (${nomeTrecho(c)}). Ctrl+D de novo repete mais uma vez.` });
  }

  function recortar() {
    if (copiar()) apagarSelecionadas();
  }

  // ---------- Dificuldades ----------
  const notasDe = (d: Dificuldade) => (d === dificuldade ? notas : (outras.current[d] ?? []));

  function trocarDificuldade(d: Dificuldade) {
    if (d === dificuldade) return;
    pararTocar();
    outras.current[dificuldade] = notasRef.current;
    const proximas = outras.current[d] ?? [];
    passado.current = [];
    futuro.current = [];
    notasRef.current = proximas;
    setNotas(proximas);
    setSel(new Set());
    setOrigemCopia(dificuldade);
    setDificuldade(d);
  }

  // Traz as notas (com as Triforces) de outra dificuldade pra aberta agora.
  // Ctrl+Z desfaz.
  function copiarDeOutraDificuldade() {
    const fonte = notasDe(origemCopia);
    if (origemCopia === dificuldade || !fonte.length) {
      setAviso({ tipo: 'info', texto: 'Escolha uma dificuldade que já tenha notas.' });
      return;
    }
    const nomeOrigem = DIFICULDADES[origemCopia].nome;
    const nomeDestino = DIFICULDADES[dificuldade].nome;
    if (notasRef.current.length && !window.confirm(`Trocar as ${notasRef.current.length} notas do ${nomeDestino} pelas ${fonte.length} notas do ${nomeOrigem}?`)) return;
    mudar(() => fonte.map((n) => ({ ...n, id: novaId() })));
    setSel(new Set());
    setAviso({ tipo: 'ok', texto: `${fonte.length} notas copiadas do ${nomeOrigem} pro ${nomeDestino}. Edite e clique em Salvar.` });
  }

  function alternarLiberada() {
    setLiberadas((l) => (l.includes(dificuldade) ? l.filter((d) => d !== dificuldade) : [...l, dificuldade]));
    setSujo(true);
  }

  // ---------- Notas Triforce ----------
  // Liga nas selecionadas; se todas já forem Triforce, desliga.
  function alternarEstrela() {
    const s = selRef.current;
    const lista = notasRef.current.filter((n) => s.has(n.id));
    if (!lista.length) {
      setAviso({ tipo: 'info', texto: 'Selecione as notas que vão virar Triforce.' });
      return;
    }
    const ligar = lista.some((n) => !n.e);
    mudar((l) => l.map((n) => (s.has(n.id) ? { ...n, e: ligar } : n)));
  }

  // ---------- Testar no jogo ----------
  // A partir da 1ª nota selecionada ou da agulha, com 1 s de folga.
  function pontoDoTeste() {
    const sels = notasRef.current.filter((n) => selRef.current.has(n.id));
    const ponto = sels.length ? Math.min(...sels.map((n) => n.t)) : pos.current;
    return Math.max(0, ponto - 1);
  }
  function testarDaqui() {
    pararTocar();
    setTestando(pontoDoTeste());
  }

  // Rodinha: rola; Ctrl+rodinha: zoom no ponto do mouse.
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const tMouse = vista + (e.clientX - r.left - esq) / zoom;
        const novo = Math.max(30, Math.min(1200, zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
        setZoom(novo);
        setVista(Math.max(0, tMouse - (e.clientX - r.left - esq) / novo));
      } else {
        const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / zoom;
        setVista((v) => Math.max(0, Math.min(duracaoTotal, v + d)));
      }
    };
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => c.removeEventListener('wheel', onWheel);
  }, [vista, zoom, duracaoTotal, esq]);

  // ---------- Teclado ----------
  const abertasVivo = useRef(new Map<number, number>()); // pista → id da nota sendo gravada
  useEffect(() => {
    const desce = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)) return;
      // Com o gerador de notas aberto, os atalhos do editor ficam desligados.
      if (gerador) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.code === 'Space') {
        e.preventDefault();
        if (tocar.current) pararTocar();
        else comecarTocar(pos.current);
        return;
      }
      if (ctrl && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) refazer();
        else desfazer();
        return;
      }
      if (ctrl && e.code === 'KeyY') {
        e.preventDefault();
        refazer();
        return;
      }
      if (ctrl && e.code === 'KeyS') {
        e.preventDefault();
        document.getElementById('oc-ed-salvar')?.click();
        return;
      }
      if (ctrl && e.code === 'KeyA') {
        e.preventDefault();
        setSel(new Set(notasRef.current.map((n) => n.id)));
        return;
      }
      if (ctrl && e.code === 'KeyC') {
        e.preventDefault();
        copiar();
        return;
      }
      if (ctrl && e.code === 'KeyX') {
        e.preventDefault();
        recortar();
        return;
      }
      if (ctrl && e.code === 'KeyV') {
        e.preventDefault();
        colar(pos.current);
        return;
      }
      if (ctrl && e.code === 'KeyD') {
        e.preventDefault();
        duplicar();
        return;
      }
      if (!ctrl && !e.altKey && e.code === 'KeyT') {
        e.preventDefault();
        if (notasRef.current.length) testarDaqui();
        return;
      }
      if (!ctrl && !e.altKey && e.code === 'KeyE') {
        e.preventDefault();
        alternarEstrela();
        return;
      }
      if (!ctrl && !e.altKey && e.code === 'KeyQ') {
        setFerramenta((f) => (f === 'notas' ? 'selecionar' : 'notas'));
        return;
      }
      if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault();
        apagarSelecionadas();
        return;
      }
      if (e.code === 'Escape') {
        setSel(new Set());
        return;
      }
      if (e.code === 'Home') {
        irPara(0);
        setVista(0);
        return;
      }
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
        const dir = e.code === 'ArrowLeft' ? -1 : 1;
        const p = (passo || batida / 4) * (e.shiftKey ? (grade || 4) * 4 : 1);
        if (e.altKey && selRef.current.size) {
          mudar((l) => l.map((n) => (selRef.current.has(n.id) ? { ...n, t: Math.max(0, n.t + dir * p) } : n)));
        } else {
          irPara(encaixar(pos.current) + dir * p);
          const larg = (largura - esq) / zoom;
          if (pos.current < vista || pos.current > vista + larg) setVista(Math.max(0, pos.current - larg / 2));
        }
        return;
      }
      if ((e.code === 'ArrowUp' || e.code === 'ArrowDown') && e.altKey && selRef.current.size) {
        e.preventDefault();
        const dir = e.code === 'ArrowUp' ? -1 : 1;
        mudar((l) => l.map((n) => (selRef.current.has(n.id) ? { ...n, p: Math.max(0, Math.min(4, n.p + dir)) } : n)));
        return;
      }
      if (e.code === 'Equal' || e.code === 'NumpadAdd') setZoom((z) => Math.min(1200, z * 1.25));
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') setZoom((z) => Math.max(30, z / 1.25));

      const pista = TECLAS_PISTA[e.code];
      if (pista === undefined || ctrl || e.altKey || e.repeat) return;
      e.preventDefault();
      if (tocar.current && gravandoVivo) {
        // Gravar ao vivo: nota começa agora (no tempo da grade).
        const t = Math.max(0, encaixar(pos.current));
        const nova: NotaEd = { id: novaId(), t, p: pista, d: 0 };
        mudar((l) => [...l.filter((o) => !(o.p === pista && Math.abs(o.t - t) < 0.001)), nova]);
        abertasVivo.current.set(pista, nova.id);
      } else {
        // Parado: liga/desliga a nota dessa pista na posição da agulha
        // (várias teclas = acorde).
        const t = Math.max(0, encaixar(pos.current));
        const existe = notasRef.current.find((o) => o.p === pista && Math.abs(o.t - t) < 0.001);
        if (existe) mudar((l) => l.filter((o) => o.id !== existe.id));
        else {
          const nova = { id: novaId(), t, p: pista, d: 0 };
          mudar((l) => [...l, nova]);
          setSel(new Set([nova.id]));
        }
      }
    };
    const sobe = (e: KeyboardEvent) => {
      const pista = TECLAS_PISTA[e.code];
      if (pista === undefined) return;
      const id = abertasVivo.current.get(pista);
      if (id === undefined) return;
      abertasVivo.current.delete(pista);
      // Segurou mais que um passo da grade: vira nota longa.
      const fim = encaixar(pos.current);
      setNotas((l) =>
        l.map((n) => {
          if (n.id !== id) return n;
          const d = fim - n.t;
          return { ...n, d: d >= Math.max(passo, batida / 2) * 0.99 ? d : 0 };
        })
      );
    };
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    return () => {
      window.removeEventListener('keydown', desce);
      window.removeEventListener('keyup', sobe);
    };
  });

  // Aviso ao sair com coisa não salva.
  useEffect(() => {
    if (!sujo) return;
    const f = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [sujo]);

  useEffect(() => () => pararTocar(), [pararTocar]);

  // Avisos somem sozinhos (os de erro ficam até o próximo aviso).
  useEffect(() => {
    if (!aviso || aviso.tipo === 'erro') return;
    const t = window.setTimeout(() => setAviso((a) => (a === aviso ? null : a)), 6000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  // ---------- Ações ----------
  const notasParaSalvar = useCallback((): OcarinaNota[] => paraSalvar(notasRef.current), []);

  async function salvar() {
    setSalvando(true);
    const charts = Object.fromEntries(ORDEM_DIFICULDADES.map((d) => [d, d === dificuldade ? notasParaSalvar() : paraSalvar(outras.current[d] ?? [])]));
    const r = await salvarMusicaAction(musica.id, { titulo, jogo, bpm, inicioBatida, fimEm, charts, liberadas }).catch(() => ({
      ok: false as const,
      erro: 'A conexão falhou.'
    }));
    setSalvando(false);
    if (r.ok) {
      setSujo(false);
      setAviso({ tipo: 'ok', texto: 'Salvo!' + (publicada ? ' Já vale no jogo.' : '') });
      router.refresh();
    } else setAviso({ tipo: 'erro', texto: r.erro });
  }

  // Notas vindas do "Gerar notas do áudio": troca as da(s) dificuldade(s)
  // escolhida(s). Na aberta, Ctrl+Z desfaz.
  function aplicarGerado(r: GeradoParaEditor) {
    let total = 0;
    for (const d of ORDEM_DIFICULDADES) {
      const lista = r.notas[d];
      if (!lista) continue;
      const ed: NotaEd[] = lista.map((n) => ({ id: novaId(), t: n.t, p: Math.max(0, PISTAS.findIndex((x) => x.id === n.pista)), d: n.dur ?? 0 }));
      total += ed.length;
      if (d === dificuldade) mudar(() => ed);
      else outras.current[d] = ed;
    }
    if (r.bpm) setBpm(r.bpm);
    if (r.inicioBatida !== null) setInicioBatida(r.inicioBatida);
    setSel(new Set());
    setSujo(true);
    setGerador(false);
    const difs = ORDEM_DIFICULDADES.filter((d) => r.notas[d]).map((d) => DIFICULDADES[d].nome);
    setAviso({ tipo: 'ok', texto: `${total} notas geradas (${difs.join(', ')}). Revise, libere as dificuldades e clique em Salvar.` });
    if (r.arquivoAudio) enviarAudio(r.arquivoAudio);
  }

  async function enviarAudio(arquivo: File) {
    try {
      pararTocar();
      setEnvio('Compactando… 0%');
      const c = await compactarAudio(arquivo, (p) => setEnvio(`Compactando… ${Math.round(p * 100)}%`));
      setEnvio(`Enviando ${formatarBytes(c.arquivo.size)}…`);
      const tk = await autorizarAudioAction(musica.id, c.ext);
      if (!tk.ok) throw new Error(tk.erro);
      await uploadAudioToSignedTicket(tk.path, tk.token, c.arquivo, c.tipo);
      const ok = await confirmarAudioAction(musica.id, tk.publicUrl, c.duracao, c.arquivo.size);
      if (!ok.ok) throw new Error(ok.erro);
      setBytes(c.arquivo.size);
      setPicos(null);
      buffer.current = null;
      setAudioUrl(tk.publicUrl);
      setEnvio(null);
      setAviso({
        tipo: 'ok',
        texto: c.compactou
          ? `Áudio enviado: ${formatarBytes(arquivo.size)} → ${formatarBytes(c.arquivo.size)} (${formatarDuracao(c.duracao)}).`
          : `Áudio enviado sem compactar (${formatarBytes(c.arquivo.size)}) — este navegador não tem o compactador. Use o Chrome ou o Edge pra arquivos menores.`
      });
      router.refresh();
    } catch (err) {
      setEnvio(null);
      setAviso({ tipo: 'erro', texto: err instanceof Error ? err.message : 'Falha ao enviar o áudio.' });
    }
  }

  // Fundo do jogo: comprime em webp aqui (até 1920 px) e sobe direto.
  async function enviarFundo(arquivo: File) {
    if (!arquivo.type.startsWith('image/')) {
      setAviso({ tipo: 'erro', texto: 'Escolha uma imagem (jpg, png ou webp).' });
      return;
    }
    try {
      setEnvioFundo('Preparando…');
      const img = await compressImageFile(arquivo, 1920, 82);
      setEnvioFundo('Enviando…');
      const tk = await autorizarFundoAction(musica.id);
      if (!tk.ok) throw new Error(tk.erro);
      await uploadToSignedTicket(tk.path, tk.token, img);
      const ok = await definirFundoAction(musica.id, tk.publicUrl);
      if (!ok.ok) throw new Error(ok.erro);
      setFundo(tk.publicUrl);
      setAviso({ tipo: 'ok', texto: 'Fundo trocado! Já vale no jogo (e no 🎮 teste).' });
      router.refresh();
    } catch (err) {
      setAviso({ tipo: 'erro', texto: err instanceof Error ? err.message : 'Falha ao enviar a imagem.' });
    } finally {
      setEnvioFundo(null);
    }
  }

  async function tirarFundo() {
    if (!window.confirm('Tirar a imagem de fundo e voltar pro cenário padrão?')) return;
    setEnvioFundo('Tirando…');
    const r = await definirFundoAction(musica.id, null).catch(() => ({ ok: false as const, erro: 'A conexão falhou.' }));
    setEnvioFundo(null);
    if (r.ok) {
      setFundo(null);
      setAviso({ tipo: 'ok', texto: 'Voltou pro cenário padrão.' });
      router.refresh();
    } else setAviso({ tipo: 'erro', texto: r.erro });
  }

  async function alternarPublicada() {
    if (sujo) await salvar();
    const r = await publicarMusicaAction(musica.id, !publicada).catch(() => ({ ok: false as const, erro: 'A conexão falhou.' }));
    if (r.ok) {
      setPublicada(!publicada);
      setAviso({ tipo: 'ok', texto: !publicada ? 'Publicada! Já aparece na lista de músicas do jogo.' : 'Virou rascunho: saiu do jogo.' });
      router.refresh();
    } else setAviso({ tipo: 'erro', texto: r.erro });
  }

  async function apagar() {
    if (!window.confirm(`Apagar "${titulo}" de vez (com o áudio)?`)) return;
    const r = await apagarMusicaAction(musica.id);
    if (r.ok) router.push('/admin#ocarina');
    else setAviso({ tipo: 'erro', texto: r.erro });
  }

  // Tap tempo: toque no ritmo pra descobrir o bpm.
  const toquesTap = useRef<number[]>([]);
  function tap() {
    const agora = performance.now();
    const l = toquesTap.current.filter((t) => agora - t < 2500);
    l.push(agora);
    toquesTap.current = l;
    if (l.length >= 4) {
      const media = (l[l.length - 1] - l[0]) / (l.length - 1);
      setBpm(Math.round((60000 / media) * 10) / 10);
      setSujo(true);
    }
  }

  // ---------- Selecionada (ajuste fino) ----------
  const selecionadas = useMemo(() => notas.filter((n) => sel.has(n.id)), [notas, sel]);
  const uma = selecionadas.length === 1 ? selecionadas[0] : null;
  function ajustarUma(campo: 't' | 'd' | 'p', valor: number) {
    if (!uma || !Number.isFinite(valor)) return;
    mudar((l) => l.map((n) => (n.id === uma.id ? { ...n, [campo]: campo === 'p' ? pistaOk(valor) : Math.max(0, valor) } : n)));
  }

  const estatisticas = useMemo(() => {
    const porTempo = new Map<number, number>();
    for (const n of notas) porTempo.set(Math.round(n.t * 1000), (porTempo.get(Math.round(n.t * 1000)) ?? 0) + 1);
    const acordes = [...porTempo.values()].filter((v) => v > 1).length;
    const longas = notas.filter((n) => n.d > 0).length;
    const ultima = Math.max(0, ...notas.map((n) => n.t));
    const primeira = notas.length ? Math.min(...notas.map((n) => n.t)) : 0;
    const nps = notas.length > 1 ? notas.length / Math.max(1, ultima - primeira) : 0;
    const marcadas = notas.map((n) => ({ t: n.t, pista: pistaDe(n.p).id, estrela: n.e }));
    const sequencias = new Set(sequenciasEstrela(marcadas).filter((s) => s >= 0)).size;
    return { acordes, longas, nps, sequencias };
  }, [notas]);

  // ---------- Testar no jogo ----------
  const chartTeste = useMemo<Chart>(
    () => ({
      id: `teste-${musica.id}`,
      titulo,
      jogo,
      bpm,
      dificuldade,
      notas: notasParaSalvar() as NotaChart[],
      ...(duracao ? { duracaoAudio: duracao } : {}),
      ...(fimEm ? { fimEm } : {}),
      ...(fundo ? { fundo } : {})
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [testando]
  );

  return (
    <div className={`oc-ed${opcoes ? ' com-opcoes' : ''}`} data-aba={aba}>
      <header className="oc-ed-topo">
        <Link href="/admin#ocarina" className="btn ghost">
          ← Músicas
        </Link>
        <h1>{titulo || 'Sem título'}</h1>
        <span className={`oc-ed-status${publicada ? ' is-pub' : ''}`}>{publicada ? 'Publicada' : 'Rascunho'}</span>
        {sujo && <span className="oc-ed-sujo">• alterações não salvas</span>}
        <div className="oc-ed-topo-acoes">
          <button type="button" className="btn ghost" onClick={alternarPublicada}>
            {publicada ? 'Voltar pra rascunho' : 'Publicar no jogo'}
          </button>
          <button type="button" id="oc-ed-salvar" className="btn primary" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar (Ctrl+S)'}
          </button>
        </div>
      </header>
      {aviso && <p className={`oc-ed-aviso is-${aviso.tipo}`}>{aviso.texto}</p>}
      {celular && (
        <nav className="oc-ed-abas" role="tablist" aria-label="Partes do editor">
          {(
            [
              ['editar', '✏️ Notas'],
              ['musica', '🎵 Música'],
              ['ritmo', '🥁 Ritmo']
            ] as const
          ).map(([v, nome]) => (
            <button key={v} type="button" role="tab" aria-selected={aba === v} className={aba === v ? 'is-on' : ''} onClick={() => setAba(v)}>
              {nome}
            </button>
          ))}
        </nav>
      )}

      <div className="oc-ed-grade">
        <section className="adm-card oc-ed-dados">
          <div className="oc-ed-grupo" data-grupo="musica">
          {celular && (
            <div className="oc-ed-pub">
              <span className={`oc-ed-status${publicada ? ' is-pub' : ''}`}>{publicada ? 'Publicada' : 'Rascunho'}</span>
              <button type="button" className="btn ghost" onClick={alternarPublicada}>
                {publicada ? 'Voltar pra rascunho' : 'Publicar no jogo'}
              </button>
            </div>
          )}
          <h3>Música</h3>
          <label>
            Nome
            <input
              value={titulo}
              maxLength={80}
              onChange={(e) => {
                setTitulo(e.target.value);
                setSujo(true);
              }}
            />
          </label>
          <label>
            Jogo (agrupa na lista &quot;Por jogo&quot;)
            <input
              value={jogo}
              maxLength={60}
              list="oc-ed-jogos"
              placeholder="ex: Ocarina of Time"
              onChange={(e) => {
                setJogo(e.target.value);
                setSujo(true);
              }}
            />
            <datalist id="oc-ed-jogos">
              {jogos.map((j) => (
                <option key={j} value={j} />
              ))}
            </datalist>
          </label>
          <h3>Áudio</h3>
          <p className="adm-help">
            {audioUrl ? `${formatarDuracao(duracao)} · ${formatarBytes(bytes)}` : 'Nenhum áudio ainda.'} Envie um mp3: ele é
            compactado aqui no navegador antes de subir.
          </p>
          <label className="btn ghost oc-ed-arquivo">
            {envio ?? (audioUrl ? 'Trocar o áudio' : 'Enviar o áudio (mp3)')}
            <input
              type="file"
              accept="audio/mpeg,audio/mp3,audio/aac,audio/mp4,audio/x-m4a,.mp3,.m4a,.aac"
              disabled={Boolean(envio)}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) enviarAudio(f);
              }}
            />
          </label>
          <button
            type="button"
            className="btn primary oc-ed-gerar"
            onClick={() => {
              pararTocar();
              setGerador(true);
            }}
          >
            ✨ Gerar notas do áudio
          </button>
          <p className="adm-help">Analisa o áudio (ou um mp3 que você enviar) e cria um chart base pra ajustar aqui.</p>
          <h3>Fundo do jogo</h3>
          <div className={`oc-ed-fundo${fundo ? '' : ' is-padrao'}`} style={fundo ? { backgroundImage: `url("${fundo}")` } : undefined}>
            {!fundo && <span>Cenário padrão (floresta)</span>}
          </div>
          <p className="adm-help">Imagem que aparece atrás da pista só nesta música. Deitada (paisagem) fica melhor; é cortada pra cobrir a tela.</p>
          <div className="oc-ed-linha">
            <label className="btn ghost oc-ed-arquivo">
              {envioFundo ?? (fundo ? 'Trocar a imagem' : '🖼️ Escolher imagem')}
              <input
                type="file"
                accept="image/*"
                disabled={Boolean(envioFundo)}
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  ev.target.value = '';
                  if (f) enviarFundo(f);
                }}
              />
            </label>
            {fundo && (
              <button type="button" className="btn ghost" onClick={tirarFundo} disabled={Boolean(envioFundo)}>
                Tirar
              </button>
            )}
          </div>
          </div>
          <div className="oc-ed-grupo" data-grupo="fim">
          <h3>Fim da música</h3>
          <p className="adm-help">
            {fimEm
              ? `Termina em ${formatarDuracao(Math.floor(fimEm))}.${String(Math.round((fimEm % 1) * 1000)).padStart(3, '0')}, com fade de ${FADE_FIM} s antes. Notas depois disso não entram.`
              : 'Toca o áudio até o fim. Marque um ponto pra música parar antes (com fade de 2 s).'}
          </p>
          <div className="oc-ed-linha">
            <label>
              Termina em (s)
              <input
                type="number"
                step="0.1"
                min={0}
                value={fimEm ?? ''}
                placeholder={duracao ? String(Math.round(duracao * 10) / 10) : '—'}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setFimEm(e.target.value === '' || !Number.isFinite(v) || v <= 0 ? null : v);
                  setSujo(true);
                }}
              />
            </label>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setFimEm(Math.round(pos.current * 1000) / 1000);
                setSujo(true);
              }}
              title="A música termina onde está a agulha"
            >
              Usar agulha
            </button>
          </div>
          <div className="oc-ed-linha">
            <button type="button" className="btn ghost" disabled={!fimEm} onClick={() => fimEm && comecarTocar(Math.max(0, fimEm - FADE_FIM - 3))}>
              ▶ Ouvir o final
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={!fimEm}
              onClick={() => {
                setFimEm(null);
                setSujo(true);
              }}
            >
              Até o fim do áudio
            </button>
          </div>
          </div>
          <div className="oc-ed-grupo" data-grupo="ritmo">
          <h3>Ritmo (grade)</h3>
          <div className="oc-ed-linha">
            <label>
              BPM
              <input
                type="number"
                step="0.1"
                min={30}
                max={400}
                value={bpm}
                onChange={(e) => {
                  setBpm(Number(e.target.value) || 120);
                  setSujo(true);
                }}
              />
            </label>
            <button type="button" className="btn ghost" onClick={tap} title="Toque no ritmo da música, 4 vezes ou mais">
              Tap
            </button>
          </div>
          <div className="oc-ed-linha">
            <label>
              1º tempo em (s)
              <input
                type="number"
                step="0.001"
                min={0}
                value={inicioBatida}
                onChange={(e) => {
                  setInicioBatida(Math.max(0, Number(e.target.value) || 0));
                  setSujo(true);
                }}
              />
            </label>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setInicioBatida(Math.round(pos.current * 1000) / 1000);
                setSujo(true);
              }}
              title="Põe o 1º tempo do compasso onde está a agulha"
            >
              Usar agulha
            </button>
          </div>
          <p className="adm-help">
            Ligue o metrônomo e toque: se os cliques baterem com a música, a grade está certa e as notas encaixam no tempo.
          </p>
          {celular && (
            <>
              <label className="oc-ed-check">
                <input type="checkbox" checked={metronomo} onChange={(e) => setMetronomo(e.target.checked)} /> Metrônomo
              </label>
              <p className="adm-help">
                A agulha fica onde você tocou por último na linha do tempo (aba Notas). O tempo dela aparece na barra de baixo.
              </p>
            </>
          )}
          </div>
          <div className="oc-ed-grupo" data-grupo="resumo">
          <h3>Resumo</h3>
          <p className="adm-help">
            {notas.length} notas · {estatisticas.longas} longas · {estatisticas.acordes} acordes · {estatisticas.nps.toFixed(1).replace('.', ',')}{' '}
            notas/s
          </p>
          <h3>Notas Triforce</h3>
          <p className="adm-help">
            {estatisticas.sequencias
              ? `${estatisticas.sequencias} sequência${estatisticas.sequencias > 1 ? 's' : ''} de Triforces. Cada uma enche meia barra de especial.`
              : celular
                ? 'Nenhuma marcada: esta música fica sem Triforces. Selecione as notas e toque em 🔺 na barra de baixo.'
                : 'Nenhuma marcada: esta música fica sem Triforces. Selecione as notas e aperte E.'}
          </p>
          <button type="button" className="btn ghost adm-danger" onClick={apagar}>
            Apagar música
          </button>
          </div>
        </section>

        <section className="oc-ed-palco">
          <div className="oc-ed-difs">
            <div className="oc-ed-difs-abas" role="tablist" aria-label="Dificuldade que está sendo editada">
              {ORDEM_DIFICULDADES.map((d) => (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  aria-selected={d === dificuldade}
                  className={d === dificuldade ? 'is-on' : ''}
                  style={{ '--dif': DIFICULDADES[d].cor } as React.CSSProperties}
                  onClick={() => trocarDificuldade(d)}
                >
                  <strong>{DIFICULDADES[d].nome}</strong>
                  <small>
                    {notasDe(d).length} notas{liberadas.includes(d) && notasDe(d).length ? ' · no jogo' : ''}
                  </small>
                </button>
              ))}
            </div>
            <div className="oc-ed-difs-acoes">
              <label>
                Copiar notas de
                <select value={origemCopia} onChange={(e) => setOrigemCopia(e.target.value as Dificuldade)}>
                  {ORDEM_DIFICULDADES.filter((d) => d !== dificuldade).map((d) => (
                    <option key={d} value={d} disabled={!notasDe(d).length}>
                      {DIFICULDADES[d].nome} ({notasDe(d).length})
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="btn primary" onClick={copiarDeOutraDificuldade} disabled={origemCopia === dificuldade || !notasDe(origemCopia).length}>
                ⧉ Copiar para {DIFICULDADES[dificuldade].nome}
              </button>
              <label className="oc-ed-check">
                <input type="checkbox" checked={liberadas.includes(dificuldade)} onChange={alternarLiberada} disabled={!notas.length} /> Mostrar {DIFICULDADES[dificuldade].nome} no jogo
              </label>
            </div>
          </div>
          <div className="oc-ed-barra">
            <button type="button" className="btn primary oc-ed-so-pc" onClick={() => (tocando ? pararTocar() : comecarTocar(pos.current))}>
              {tocando ? '❚❚ Pausar' : '▶ Tocar'}
            </button>
            <button type="button" className="btn ghost oc-ed-so-pc" onClick={() => { irPara(0); setVista(0); }} title="Voltar ao começo (Home)">
              ⏮
            </button>
            <span className="oc-ed-tempo oc-ed-so-pc">
              {formatarDuracao(Math.floor(posTexto))}.{String(Math.floor((posTexto % 1) * 1000)).padStart(3, '0')}
            </span>
            <span className="oc-ed-ferramentas" role="group" aria-label="Ferramenta do mouse">
              <button
                type="button"
                className={`btn ${ferramenta === 'notas' ? 'primary' : 'ghost'}`}
                onClick={() => setFerramenta('notas')}
                title="Clique põe nota, arrastar faz nota longa (Q troca)"
              >
                ✏️ Notas
              </button>
              <button
                type="button"
                className={`btn ${ferramenta === 'selecionar' ? 'primary' : 'ghost'}`}
                onClick={() => setFerramenta('selecionar')}
                title="Arraste um retângulo pra selecionar várias notas (Q troca)"
              >
                ⬚ Selecionar
              </button>
              {celular && (
                <button type="button" className={`btn ${ferramenta === 'mao' ? 'primary' : 'ghost'}`} onClick={() => setFerramenta('mao')}>
                  ✋ Mover
                </button>
              )}
            </span>
            {celular && (
              <span className="oc-ed-zoom-cel" role="group" aria-label="Zoom">
                <button type="button" className="btn ghost" onClick={() => setZoom((z) => Math.max(30, z / 1.35))} aria-label="Afastar">
                  −
                </button>
                <button type="button" className="btn ghost" onClick={() => setZoom((z) => Math.min(1200, z * 1.35))} aria-label="Aproximar">
                  +
                </button>
                <button type="button" className={`btn ${opcoes ? 'primary' : 'ghost'}`} onClick={() => setOpcoes((o) => !o)} aria-expanded={opcoes} aria-label="Mais opções">
                  ⚙
                </button>
              </span>
            )}
            <button type="button" className="btn green oc-ed-so-pc" onClick={testarDaqui} disabled={!notas.length} title="Testa no jogo a partir da agulha ou da 1ª nota selecionada (T)">
              🎮 Testar daqui
            </button>
            <span className="oc-ed-opcoes">
            <label>
              Velocidade
              <select value={velocidade} onChange={(e) => { setVelocidade(Number(e.target.value)); if (tocar.current) setTimeout(() => comecarTocar(pos.current)); }}>
                <option value={0.5}>50%</option>
                <option value={0.75}>75%</option>
                <option value={1}>100%</option>
              </select>
            </label>
            <label>
              Grade
              <select value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
                {GRADES.map((g) => (
                  <option key={g.v} value={g.v}>
                    {g.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="oc-ed-check">
              <input type="checkbox" checked={metronomo} onChange={(e) => setMetronomo(e.target.checked)} /> Metrônomo
            </label>
            <label className="oc-ed-check">
              <input type="checkbox" checked={palmas} onChange={(e) => setPalmas(e.target.checked)} /> 🔊 Clique em cada nota
            </label>
            <label className={`oc-ed-check oc-ed-gravar oc-ed-so-pc${gravandoVivo ? ' is-on' : ''}`}>
              <input type="checkbox" checked={gravandoVivo} onChange={(e) => setGravandoVivo(e.target.checked)} /> ● Gravar ao vivo
            </label>
            <label className="oc-ed-so-pc">
              Zoom
              <input type="range" min={30} max={1200} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
            </label>
            </span>
          </div>

          <div ref={caixa} className="oc-ed-quadro">
            <canvas
              ref={canvas}
              tabIndex={0}
              style={{ width: largura, height: ALTURA }}
              onPointerDown={aoApertar}
              onPointerMove={aoMover}
              onPointerUp={aoSoltar}
              onPointerCancel={aoSoltar}
              onPointerLeave={() => {
                mouse.current = null;
                desenhar();
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                // no celular, segurar o dedo abre isso: não apaga nada
                if (celular) return;
                const { x, y } = coord(e);
                const achou = acharNota(x, y);
                if (achou) {
                  mudar((l) => l.filter((n) => n.id !== achou.n.id));
                  setSel((s) => {
                    const ns = new Set(s);
                    ns.delete(achou.n.id);
                    return ns;
                  });
                }
              }}
            />
          </div>
          <input
            className="oc-ed-rolagem"
            type="range"
            min={0}
            max={Math.max(0, duracaoTotal - (largura - esq) / zoom)}
            step={0.01}
            value={Math.min(vista, Math.max(0, duracaoTotal - (largura - esq) / zoom))}
            onChange={(e) => setVista(Number(e.target.value))}
            aria-label="Rolar a linha do tempo"
          />

          <div className="oc-ed-baixo">
            <div className="adm-card oc-ed-sel">
              <h3>{selecionadas.length ? `${selecionadas.length} selecionada${selecionadas.length > 1 ? 's' : ''}` : 'Nenhuma nota selecionada'}</h3>
              {uma ? (
                <div className="oc-ed-linha">
                  <label>
                    Tempo (ms)
                    <input type="number" step={1} value={Math.round(uma.t * 1000)} onChange={(e) => ajustarUma('t', Number(e.target.value) / 1000)} />
                  </label>
                  <label>
                    Duração (ms, 0 = normal)
                    <input type="number" step={10} min={0} value={Math.round(uma.d * 1000)} onChange={(e) => ajustarUma('d', Number(e.target.value) / 1000)} />
                  </label>
                  <label>
                    Cor
                    <select value={uma.p} onChange={(e) => ajustarUma('p', Number(e.target.value))}>
                      {PISTAS.map((p, i) => (
                        <option key={p.id} value={i}>
                          {p.rotulo}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
              <div className="oc-ed-linha oc-ed-copia oc-ed-so-pc">
                <button type="button" className="btn ghost" onClick={copiar} disabled={!selecionadas.length} title="Ctrl+C">
                  📋 Copiar
                </button>
                <button type="button" className="btn ghost" onClick={recortar} disabled={!selecionadas.length} title="Ctrl+X">
                  ✂️ Recortar
                </button>
                <button type="button" className="btn ghost" onClick={() => colar(pos.current)} disabled={!copia} title="Ctrl+V — cola com a 1ª nota na agulha">
                  📥 Colar na agulha
                </button>
                <button type="button" className="btn primary" onClick={duplicar} disabled={!selecionadas.length} title="Ctrl+D — repete logo depois do trecho">
                  ⧉ Repetir em seguida
                </button>
              </div>
              <p className="adm-help">
                {copia
                  ? `Copiado: ${copia.notas.length} notas (${nomeTrecho(copia)}). Colar põe a 1ª nota exatamente na agulha; colar de novo continua logo depois.`
                  : celular
                    ? 'Dica: arraste o dedo na forma de onda pra selecionar um trecho inteiro, depois toque em "Repetir" quantas vezes precisar.'
                    : 'Dica: arraste na forma de onda pra selecionar um trecho inteiro, depois "Repetir em seguida" (Ctrl+D) quantas vezes precisar.'}
              </p>
              {selecionadas.length > 0 && (
                <div className="oc-ed-linha oc-ed-so-pc">
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => mudar((l) => l.map((n) => (sel.has(n.id) ? { ...n, d: n.d > 0 ? 0 : Math.max(batida, passo) } : n)))}
                  >
                    Longa ⇄ normal
                  </button>
                  <button type="button" className="btn ghost" onClick={alternarEstrela} title="E">
                    🔺 Triforce
                  </button>
                  <button type="button" className="btn ghost" onClick={() => mudar((l) => l.map((n) => (sel.has(n.id) ? { ...n, t: encaixar(n.t) } : n)))}>
                    Encaixar na grade
                  </button>
                  <button type="button" className="btn ghost adm-danger" onClick={apagarSelecionadas}>
                    Apagar
                  </button>
                </div>
              )}
              {celular && (
                <button type="button" className="btn ghost" onClick={() => { pararTocar(); setTestando(0); }} disabled={!notas.length}>
                  🎮 Testar do começo
                </button>
              )}
              <div className="oc-ed-linha oc-ed-so-pc">
                <button type="button" className="btn ghost" onClick={desfazer} disabled={!passado.current.length}>
                  ↶ Desfazer
                </button>
                <button type="button" className="btn ghost" onClick={refazer} disabled={!futuro.current.length}>
                  ↷ Refazer
                </button>
                <button type="button" className="btn ghost" onClick={() => { pararTocar(); setTestando(0); }} disabled={!notas.length}>
                  🎮 Testar do começo
                </button>
                <button type="button" className="btn green" onClick={testarDaqui} disabled={!notas.length}>
                  ▶ Testar daqui ({formatarDuracao(selecionadas.length ? Math.min(...selecionadas.map((n) => n.t)) : posTexto)})
                </button>
              </div>
            </div>
            {celular && (
              <details className="adm-card oc-ed-ajuda">
                <summary>Como editar no celular</summary>
                <ul>
                  <li><b>Toque</b> numa pista: põe nota · <b>toque e arraste →</b>: nota longa</li>
                  <li><b>Arraste a nota</b>: move (tempo e cor) · <b>puxe a ponta</b>: muda a duração</li>
                  <li><b>Dois dedos</b>: abrir/fechar dá zoom, arrastar rola a música</li>
                  <li><b>✋ Mover</b>: um dedo rola a linha do tempo sem criar notas</li>
                  <li><b>⬚ Selecionar</b>: arraste um retângulo pra pegar várias notas</li>
                  <li><b>Arrastar na forma de onda</b>: seleciona o trecho inteiro; tocar nela põe a agulha ali</li>
                  <li>Apagar, copiar, repetir, Triforce e desfazer ficam na <b>barra de baixo</b></li>
                </ul>
              </details>
            )}
            <details className="adm-card oc-ed-ajuda oc-ed-so-pc" open>
              <summary>Atalhos</summary>
              <ul>
                <li><b>Clique</b> numa pista: põe nota · <b>clique e arraste →</b>: nota longa</li>
                <li><b>Arraste a nota</b>: move (tempo e cor) · <b>puxe a ponta</b>: muda a duração</li>
                <li><b>Botão direito</b>: apaga · <b>Shift+arrastar</b> ou ferramenta <b>Selecionar</b> (Q): seleciona várias</li>
                <li><b>Arrastar na forma de onda</b>: seleciona o trecho inteiro (todas as cores)</li>
                <li><b>Ctrl+C / X / V</b>: copiar, recortar, colar com a 1ª nota na agulha · <b>Ctrl+D</b>: repetir logo em seguida</li>
                <li><b>E</b>: liga/desliga a Triforce nas selecionadas (Triforces seguidas formam uma sequência)</li>
                <li><b>Espaço</b>: toca/pausa · <b>← →</b>: anda 1 passo (Shift: 1 compasso) · <b>T</b>: testar no jogo daqui</li>
                <li><b>1 a 5</b> (ou A S J K L): parado, põe/tira nota na agulha (várias = acorde); com <b>Gravar ao vivo</b>, grava tocando (segurar = longa)</li>
                <li><b>Alt+← → ↑ ↓</b>: move as selecionadas · <b>Delete</b>: apaga · <b>Ctrl+Z / Y</b>: desfazer/refazer</li>
                <li><b>Ctrl+rodinha</b> ou <b>+ −</b>: zoom · <b>rodinha</b>: rola</li>
              </ul>
            </details>
          </div>
        </section>
      </div>

      {celular && (
        <div className="oc-ed-cel-barra">
          {aba === 'editar' && (
            <div className="oc-ed-cel-acoes" role="toolbar" aria-label="Ações nas notas">
              <button type="button" onClick={desfazer} disabled={!passado.current.length}>
                <span>↶</span>Desfazer
              </button>
              <button type="button" onClick={refazer} disabled={!futuro.current.length}>
                <span>↷</span>Refazer
              </button>
              <button type="button" className="is-perigo" onClick={apagarSelecionadas} disabled={!selecionadas.length}>
                <span>🗑</span>Apagar
              </button>
              <button type="button" onClick={duplicar} disabled={!selecionadas.length}>
                <span>⧉</span>Repetir
              </button>
              <button type="button" onClick={copiar} disabled={!selecionadas.length}>
                <span>📋</span>Copiar
              </button>
              <button type="button" onClick={() => colar(pos.current)} disabled={!copia}>
                <span>📥</span>Colar
              </button>
              <button
                type="button"
                onClick={() => mudar((l) => l.map((n) => (sel.has(n.id) ? { ...n, d: n.d > 0 ? 0 : Math.max(batida, passo) } : n)))}
                disabled={!selecionadas.length}
              >
                <span>⇄</span>Longa
              </button>
              <button type="button" onClick={alternarEstrela} disabled={!selecionadas.length}>
                <span>🔺</span>Triforce
              </button>
              <button type="button" onClick={() => mudar((l) => l.map((n) => (sel.has(n.id) ? { ...n, t: encaixar(n.t) } : n)))} disabled={!selecionadas.length}>
                <span>⌖</span>Encaixar
              </button>
              <button type="button" onClick={() => setSel(new Set(notasRef.current.map((n) => n.id)))} disabled={!notas.length}>
                <span>☰</span>Tudo
              </button>
              <button type="button" onClick={() => setSel(new Set())} disabled={!selecionadas.length}>
                <span>✕</span>Soltar
              </button>
            </div>
          )}
          <div className="oc-ed-cel-transporte">
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                irPara(0);
                setVista(0);
              }}
              aria-label="Voltar ao começo"
            >
              ⏮
            </button>
            <button type="button" className="btn primary oc-ed-cel-play" onClick={() => (tocando ? pararTocar() : comecarTocar(pos.current))}>
              {tocando ? '❚❚' : '▶'}
            </button>
            <span className="oc-ed-tempo">
              {formatarDuracao(Math.floor(posTexto))}.{String(Math.floor((posTexto % 1) * 1000)).padStart(3, '0')}
              {selecionadas.length > 0 && <small>{selecionadas.length} sel.</small>}
            </span>
            <button type="button" className="btn green" onClick={testarDaqui} disabled={!notas.length} aria-label="Testar no jogo daqui">
              🎮
            </button>
            <button type="button" className={`btn primary oc-ed-cel-salvar${sujo ? ' is-sujo' : ''}`} onClick={salvar} disabled={salvando}>
              {salvando ? '…' : sujo ? '💾 Salvar' : '✓ Salvo'}
            </button>
          </div>
        </div>
      )}

      {gerador && (
        <GeradorNotas
          audioUrlMusica={audioUrl}
          bpmAtual={bpm}
          inicioAtual={inicioBatida}
          dificuldadeAtual={dificuldade}
          notasExistentes={(d) => notasDe(d).length}
          onAbrir={aplicarGerado}
          onFechar={() => setGerador(false)}
        />
      )}

      {testando !== null && (
        <TesteNoJogo
          chart={chartTeste}
          audioUrl={audioUrl}
          comecarEm={testando}
          clique={palmas}
          onFechar={() => {
            setTestando(null);
            desenhar();
          }}
        />
      )}
    </div>
  );
}

// Joga a música do jeito que está (sem salvar) numa janela por cima, com o
// mesmo visual do jogo. Começa de "comecarEm" (agulha ou seleção).
function TesteNoJogo({
  chart,
  audioUrl,
  comecarEm,
  clique,
  onFechar
}: {
  chart: Chart;
  audioUrl: string | null;
  comecarEm: number;
  clique: boolean;
  onFechar: () => void;
}) {
  const [som, setSom] = useState<SomOcarina | null>(null);
  const [audio, setAudio] = useState<AudioBuffer | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [res, setRes] = useState<string | null>(null);
  const [rodada, setRodada] = useState(0);
  const [comCliques, setComCliques] = useState(clique);
  const motor = useRef<MotorOcarina | null>(null);

  useEffect(() => {
    let vivo = true;
    const s = new SomOcarina();
    (async () => {
      await s.destravar();
      const a = audioUrl ? await s.carregarAudio(audioUrl).catch(() => null) : null;
      if (!vivo) return;
      if (audioUrl && !a) setErro('Não consegui carregar o áudio — testando sem ele.');
      setAudio(a);
      setSom(s);
    })();
    return () => {
      vivo = false;
      s.fechar();
    };
  }, [audioUrl]);

  const deNovo = () => {
    setRes(null);
    setRodada((r) => r + 1);
  };

  return (
    <div className="oc-ed-teste oc-jogo" role="dialog" aria-label="Testar a música">
      {som ? (
        <Palco
          key={`${rodada}-${comCliques}`}
          chart={chart}
          som={som}
          audio={audio}
          teclas={TECLAS_PADRAO}
          latencia={0}
          comecarEm={comecarEm}
          clique={comCliques}
          etiqueta={`Teste · a partir de ${formatarDuracao(comecarEm)}`}
          capturarTeclado
          motorRef={motor}
          onFim={(r) => setRes(`${r.precisao}% de precisão · combo ${r.maiorCombo} · ${r.perfeitos} perfeitos, ${r.bons} bons, ${r.erros} erros`)}
          onPausa={onFechar}
        />
      ) : (
        <p className="oc-ed-teste-msg">Carregando o áudio…</p>
      )}
      <div className="oc-ed-teste-barra">
        <span>A S J K L ou 1–5 · Espaço: especial · Esc fecha</span>
        <label className="oc-ed-check">
          <input type="checkbox" checked={comCliques} onChange={(e) => setComCliques(e.target.checked)} /> 🔊 Clique em cada nota
        </label>
        <button type="button" className="btn ghost" onClick={deNovo}>
          ↺ De novo daqui
        </button>
        <button type="button" className="btn ghost" onClick={onFechar}>
          Fechar
        </button>
      </div>
      {(res || erro) && (
        <div className="oc-ed-teste-fim">
          {erro && <p>{erro}</p>}
          {res && (
            <>
              <p>
                <strong>Fim do teste:</strong> {res}
              </p>
              <div className="oc-ed-linha">
                <button type="button" className="btn primary" onClick={deNovo}>
                  ↺ Testar de novo daqui
                </button>
                <button type="button" className="btn ghost" onClick={onFechar}>
                  Voltar ao editor
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
