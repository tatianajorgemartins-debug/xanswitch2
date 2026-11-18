'use client';

// Modo gravar do Ocarina Hero (/games-interativos/ocarina-hero?editor=1): você toca a
// melodia no teclado (ou nos botões) junto com o metrônomo e o jogo monta o
// arquivo da música (.json) pra você salvar em data/jogos/ocarina/.
// Segurar a tecla vira nota longa. Ver JOGOS-README.md.
import { useEffect, useRef, useState } from 'react';
import { addDias, diaEm } from '@/lib/jogos/dia';
import {
  DIFICULDADES,
  PISTAS,
  frequencia,
  nomeTecla,
  pistaDaTecla,
  validarChart,
  type Chart,
  type Dificuldade,
  type MapaTeclas,
  type NotaChart
} from './ocarina';
import { MotorOcarina } from './motor';
import type { SomOcarina, Voz } from './som';

const ENTRADA_COMPASSOS = 1; // um compasso de metrônomo antes de gravar

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export default function Editor({
  charts,
  teclas,
  latencia,
  liberar
}: {
  charts: Chart[];
  teclas: MapaTeclas;
  latencia: number;
  liberar: () => Promise<SomOcarina>;
}) {
  const [titulo, setTitulo] = useState('Minha música');
  const [bpm, setBpm] = useState(110);
  const [dificuldade, setDificuldade] = useState<Dificuldade>('medio');
  const [grade, setGrade] = useState(4); // 0 = sem ajuste; 2 = meia batida; 4 = 1/4 de batida
  const [gravando, setGravando] = useState(false);
  const [notas, setNotas] = useState<NotaChart[]>([]);
  const [testando, setTestando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const estado = useRef<{ som: SomOcarina; inicio: number; abertas: Map<number, { t: number; voz: Voz }>; ticks: number } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  const id = slug(titulo) || 'minha-musica';
  const repetido = charts.some((c) => c.id === id);

  function ajustar(t: number): number {
    if (!grade) return Math.round(t * 1000) / 1000;
    const passo = 60 / bpm / grade;
    return Math.round(Math.round(t / passo) * passo * 1000) / 1000;
  }

  async function gravar() {
    const som = await liberar();
    const b = 60 / bpm;
    // Música começa depois do compasso de entrada; tempo 0 = início do arquivo.
    const inicio = som.agora + 0.4;
    estado.current = { som, inicio, abertas: new Map(), ticks: 0 };
    setNotas([]);
    setGravando(true);
    setAviso(null);
    for (let k = 0; k < 4 * ENTRADA_COMPASSOS; k++) som.tick(inicio + k * b, k % 4 === 0, 0.2);
  }

  function parar() {
    setGravando(false);
    const e = estado.current;
    if (e) for (const a of e.abertas.values()) a.voz.parar();
  }

  // Metrônomo contínuo enquanto grava.
  useEffect(() => {
    if (!gravando) return;
    const t = window.setInterval(() => {
      const e = estado.current;
      if (!e) return;
      const b = 60 / bpm;
      const ate = e.som.agora + 0.3;
      let k = Math.max(4 * ENTRADA_COMPASSOS, e.ticks);
      for (; e.inicio + k * b <= ate; k++) e.som.tick(e.inicio + k * b, k % 4 === 0, 0.14);
      e.ticks = k;
    }, 100);
    return () => window.clearInterval(t);
  }, [gravando, bpm]);

  function apertar(pista: number) {
    const e = estado.current;
    if (!gravando || !e || e.abertas.has(pista)) return;
    const t = e.som.agora - e.inicio - latencia;
    const voz = e.som.nota(frequencia(PISTAS[pista].nota), e.som.agora, null);
    e.abertas.set(pista, { t, voz });
  }
  function soltar(pista: number) {
    const e = estado.current;
    const a = e?.abertas.get(pista);
    if (!e || !a) return;
    e.abertas.delete(pista);
    a.voz.parar();
    const fim = e.som.agora - e.inicio - latencia;
    const segurou = fim - a.t;
    const nota: NotaChart = { t: ajustar(a.t), pista: PISTAS[pista].id };
    // Segurou mais que ~uma batida: nota longa.
    if (segurou >= (60 / bpm) * 0.9) nota.dur = Math.round(segurou * 1000) / 1000;
    if (nota.t >= 0) setNotas((l) => [...l, nota].sort((x, y) => x.t - y.t));
  }

  useEffect(() => {
    if (!gravando) return;
    const desce = (ev: KeyboardEvent) => {
      const i = pistaDaTecla(ev.code, teclas);
      if (i < 0 || ev.repeat) return;
      ev.preventDefault();
      apertar(i);
    };
    const sobe = (ev: KeyboardEvent) => {
      const i = pistaDaTecla(ev.code, teclas);
      if (i >= 0) soltar(i);
    };
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    return () => {
      window.removeEventListener('keydown', desce);
      window.removeEventListener('keyup', sobe);
    };
  });

  const chart: Chart | null = notas.length
    ? validarChart({ id, titulo, bpm, dificuldade, ativo_desde: addDias(diaEm(), 1), notas })
    : null;
  const json = chart ? JSON.stringify(chart, null, 2) : '';

  async function testar() {
    if (!chart || !canvas.current) return;
    const som = await liberar();
    setTestando(true);
    const m = new MotorOcarina(canvas.current, chart, som, {
      latencia,
      rotulos: PISTAS.map((p) => nomeTecla(teclas[p.id])),
      onFim: (r) => {
        setTestando(false);
        setAviso(`Teste: ${r.precisao}% de precisão, combo ${r.maiorCombo}.`);
      }
    });
    m.iniciar();
    const desce = (ev: KeyboardEvent) => {
      const i = pistaDaTecla(ev.code, teclas);
      if (i >= 0 && !ev.repeat) {
        ev.preventDefault();
        m.pressionar(i);
      }
    };
    const sobe = (ev: KeyboardEvent) => {
      const i = pistaDaTecla(ev.code, teclas);
      if (i >= 0) m.soltar(i);
    };
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    const limpar = window.setInterval(() => {
      if (m.terminou) {
        window.removeEventListener('keydown', desce);
        window.removeEventListener('keyup', sobe);
        window.clearInterval(limpar);
      }
    }, 500);
  }

  function baixar() {
    if (!json) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json + '\n'], { type: 'application/json' }));
    a.download = `${id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section className="oc-editor">
      <h1 className="oc-titulo">
        Modo <em>gravar</em>
      </h1>
      <p className="oc-sub">
        Toque a melodia nas teclas {PISTAS.map((p) => nomeTecla(teclas[p.id])).join(' ')} (ou nos botões) junto com o metrônomo.
        Segure a tecla pra fazer nota longa. Depois baixe o arquivo e coloque em <code>data/jogos/ocarina/</code>.
      </p>

      <div className="oc-editor-campos">
        <label>
          Nome da música
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={40} />
          <small>
            Arquivo: {id}.json{repetido ? ' — já existe uma música com esse nome!' : ''}
          </small>
        </label>
        <label>
          Andamento (bpm)
          <input type="number" min={60} max={220} value={bpm} onChange={(e) => setBpm(Math.max(60, Math.min(220, Number(e.target.value) || 110)))} />
        </label>
        <label>
          Dificuldade
          <select value={dificuldade} onChange={(e) => setDificuldade(e.target.value as Dificuldade)}>
            {(Object.keys(DIFICULDADES) as Dificuldade[]).map((d) => (
              <option key={d} value={d}>
                {DIFICULDADES[d].nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ajustar ao ritmo
          <select value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
            <option value={0}>Não (exatamente como tocou)</option>
            <option value={2}>Meia batida</option>
            <option value={4}>1/4 de batida</option>
          </select>
        </label>
      </div>

      <div className="oc-acoes">
        {!gravando ? (
          <button type="button" className="oc-botao is-principal" onClick={gravar} disabled={testando}>
            ● Gravar
          </button>
        ) : (
          <button type="button" className="oc-botao is-gravando" onClick={parar}>
            ■ Parar
          </button>
        )}
        <button type="button" className="oc-botao" onClick={testar} disabled={!chart || gravando || testando}>
          ▶ Testar
        </button>
        <button type="button" className="oc-botao" onClick={baixar} disabled={!chart}>
          ⬇ Baixar {id}.json
        </button>
        <button type="button" className="oc-botao" onClick={() => navigator.clipboard?.writeText(json).then(() => setAviso('JSON copiado.'))} disabled={!chart}>
          Copiar JSON
        </button>
      </div>
      {gravando && <p className="oc-gravando">● Gravando… o primeiro compasso é só metrônomo.</p>}
      {aviso && <p className="oc-aviso">{aviso}</p>}

      <div className="oc-zonas is-editor">
        {PISTAS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            className="oc-zona"
            style={{ '--cor': p.cor } as React.CSSProperties}
            onPointerDown={(e) => {
              e.preventDefault();
              apertar(i);
            }}
            onPointerUp={() => soltar(i)}
            onPointerLeave={() => soltar(i)}
          >
            {p.rotulo}
          </button>
        ))}
      </div>

      <canvas ref={canvas} className={`oc-canvas oc-editor-canvas${testando ? '' : ' is-escondido'}`} />

      <p className="oc-detalhe">
        {notas.length} notas gravadas{chart ? ` · ${(chart.notas[chart.notas.length - 1].t + 1).toFixed(1)} s` : ''}
      </p>
      {json && <textarea className="oc-editor-json" readOnly value={json} rows={10} />}
    </section>
  );
}
