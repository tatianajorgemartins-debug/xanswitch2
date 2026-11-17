'use client';
/* eslint-disable @next/next/no-img-element */

// Palco da partida: cenário da floresta, a pista (canvas, motor.ts) e o
// HUD em HTML por cima — brasão + nome da música, placar, pausa, corações
// (energia), combo com multiplicador e a barra de progresso. Usado no jogo
// (OcarinaClient) e no "Testar no jogo" do editor do admin.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DIFICULDADES, PISTAS, formatarDuracao, nomeTecla, pistaDaTecla, type Chart, type MapaTeclas, type Precisao, type ResultadoMusica } from './ocarina';
import { MotorOcarina, type GeometriaMotor, type HudMotor } from './motor';
import type { SomOcarina } from './som';
import { OC_FONTES } from './fontes';

const UI = '/jogos/ocarina/ui/';
const CORACOES = 3;

export type PropsPalco = {
  chart: Chart;
  som: SomOcarina;
  audio: AudioBuffer | null;
  teclas: MapaTeclas;
  latencia: number;
  comecarEm?: number;
  // clique seco em cada nota (referência, no teste do admin)
  clique?: boolean;
  precisao?: Precisao;
  // texto pequeno acima do nome da música (ex: "Música do Dia #3")
  etiqueta?: string;
  // admin: segura todas as teclas pra não mexer no editor por trás
  capturarTeclado?: boolean;
  onFim: (r: ResultadoMusica) => void;
  // Esc / P / botão de pausa
  onPausa: () => void;
  motorRef?: React.MutableRefObject<MotorOcarina | null>;
  children?: ReactNode;
};

export default function Palco({
  chart,
  som,
  audio,
  teclas,
  latencia,
  comecarEm = 0,
  clique = false,
  precisao,
  etiqueta,
  capturarTeclado = false,
  onFim,
  onPausa,
  motorRef,
  children
}: PropsPalco) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const motor = useRef<MotorOcarina | null>(null);
  const [toque, setToque] = useState(false);
  const [geo, setGeo] = useState<GeometriaMotor | null>(null);
  const fimRef = useRef(onFim);
  fimRef.current = onFim;
  const pausaRef = useRef(onPausa);
  pausaRef.current = onPausa;

  // HUD: atualizado direto no DOM a cada quadro (sem re-renderizar o React).
  const pontosEl = useRef<HTMLSpanElement>(null);
  const comboEl = useRef<HTMLDivElement>(null);
  const comboNum = useRef<HTMLElement>(null);
  const multEl = useRef<HTMLSpanElement>(null);
  const coracoes = useRef<(HTMLSpanElement | null)[]>([]);
  const progBarra = useRef<HTMLElement>(null);
  const progTempo = useRef<HTMLSpanElement>(null);
  const progTotal = useRef<HTMLSpanElement>(null);
  const ultimo = useRef<Partial<HudMotor> & { seg?: number; prog?: number }>({});

  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    setToque(coarse);
    if (!canvas.current) return;
    ultimo.current = {};
    const hud = (h: HudMotor) => {
      const u = ultimo.current;
      if (u.pontos !== h.pontos && pontosEl.current) pontosEl.current.textContent = String(h.pontos).padStart(6, '0').replace(/(\d{3})(\d{3})$/, '$1 $2');
      if (u.combo !== h.combo) {
        if (comboNum.current) comboNum.current.textContent = String(h.combo);
        comboEl.current?.classList.toggle('is-on', h.combo >= 2);
        if (h.combo > (u.combo ?? 0) && comboNum.current) {
          comboNum.current.classList.remove('is-pulo');
          void comboNum.current.offsetWidth;
          comboNum.current.classList.add('is-pulo');
        }
      }
      if (u.mult !== h.mult && multEl.current) {
        multEl.current.textContent = `${h.mult}×`;
        multEl.current.parentElement?.classList.toggle('is-alto', h.mult >= 4);
      }
      if (u.energia !== h.energia) {
        coracoes.current.forEach((c, i) => {
          if (!c) return;
          const cheio = Math.max(0, Math.min(1, h.energia * CORACOES - i));
          c.style.clipPath = `inset(${((1 - cheio) * 100).toFixed(1)}% 0 0 0)`;
        });
      }
      const seg = Math.floor(h.tempo);
      if (u.seg !== seg && progTempo.current) progTempo.current.textContent = formatarDuracao(Math.min(seg, h.duracao));
      if (u.duracao !== h.duracao && progTotal.current) progTotal.current.textContent = formatarDuracao(h.duracao);
      const prog = Math.round(Math.max(0, Math.min(1, h.tempo / Math.max(1, h.duracao))) * 1000) / 10;
      if (u.prog !== prog && progBarra.current) progBarra.current.style.setProperty('--p', `${prog}%`);
      // guarda o que foi mostrado (copiando: o motor reaproveita o objeto)
      Object.assign(u, h);
      u.seg = seg;
      u.prog = prog;
    };
    const m = new MotorOcarina(canvas.current, chart, som, {
      latencia,
      rotulos: coarse ? PISTAS.map(() => '') : PISTAS.map((p) => nomeTecla(teclas[p.id])),
      audio,
      comecarEm,
      clique,
      precisao,
      onHud: hud,
      onGeometria: setGeo,
      onFim: (r) => fimRef.current(r)
    });
    motor.current = m;
    if (motorRef) motorRef.current = m;
    m.iniciar();
    // fps no console do teste (window.__ocarina.fps)
    (window as unknown as { __ocarina?: MotorOcarina }).__ocarina = m;
    document.body.style.overflow = 'hidden';
    return () => {
      m.destruir();
      if (motorRef) motorRef.current = null;
      document.body.style.overflow = '';
    };
  }, [chart, som, audio, latencia, teclas, comecarEm, clique, precisao, motorRef]);

  // Teclado
  useEffect(() => {
    const desce = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        e.stopPropagation();
        pausaRef.current();
        return;
      }
      const i = pistaDaTecla(e.code, teclas);
      if (i >= 0) {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) motor.current?.pressionar(i);
      } else if (capturarTeclado) e.stopPropagation();
    };
    const sobe = (e: KeyboardEvent) => {
      const i = pistaDaTecla(e.code, teclas);
      if (i >= 0) {
        motor.current?.soltar(i);
        e.stopPropagation();
      } else if (capturarTeclado) e.stopPropagation();
    };
    window.addEventListener('keydown', desce, true);
    window.addEventListener('keyup', sobe, true);
    return () => {
      window.removeEventListener('keydown', desce, true);
      window.removeEventListener('keyup', sobe, true);
    };
  }, [teclas, capturarTeclado]);

  const dif = DIFICULDADES[chart.dificuldade];
  return (
    <div className={`oc-palco ${OC_FONTES}`} role="application" aria-label={`Ocarina Hero: ${chart.titulo}`}>
      <canvas ref={canvas} className="oc-canvas" />

      <div className="oc-hud" aria-hidden="true">
        <div className="oc-hud-titulo">
          <img src={`${UI}brasao.webp`} alt="" className="oc-hud-brasao" />
          <div>
            <p className="oc-hud-jogo">
              Ocarina Hero
              <span className="oc-hud-dif" style={{ '--dif': dif.cor } as React.CSSProperties}>
                {dif.nome}
              </span>
            </p>
            {etiqueta && <p className="oc-hud-etiqueta">{etiqueta}</p>}
            <p className="oc-hud-musica">♪ {chart.titulo}</p>
          </div>
        </div>

        <img src={`${UI}triforce.webp`} alt="" className="oc-hud-tri" />

        <div className="oc-hud-dir">
          <div className="oc-hud-linha">
            <div className="oc-hud-pontos">
              <span ref={pontosEl}>000 000</span>
            </div>
          </div>
          <div className="oc-hud-coracoes">
            {Array.from({ length: CORACOES }, (_, i) => (
              <span key={i} className="oc-hud-coracao">
                <img src={`${UI}coracao.webp`} alt="" className="is-vazio" />
                <span ref={(el) => void (coracoes.current[i] = el)}>
                  <img src={`${UI}coracao.webp`} alt="" />
                </span>
              </span>
            ))}
          </div>
        </div>

        <div className="oc-hud-combo" ref={comboEl}>
          <div className="oc-hud-combo-num">
            <img src={`${UI}asa-esq.webp`} alt="" />
            <strong ref={comboNum}>0</strong>
            <img src={`${UI}asa-dir.webp`} alt="" />
          </div>
          <span className="oc-hud-combo-txt">Combo</span>
          <div className="oc-hud-mult">
            <span ref={multEl}>1×</span>
          </div>
        </div>

        <div className="oc-hud-prog">
          <span ref={progTempo}>0:00</span>
          <i ref={progBarra} className="oc-hud-barra" />
          <span ref={progTotal}>0:00</span>
        </div>
      </div>

      <button type="button" className="oc-hud-pausa" onClick={onPausa} aria-label="Pausar">
        <img src={`${UI}pausa.webp`} alt="" />
      </button>

      {geo && (
        <div
          className={`oc-zonas${toque ? ' is-toque' : ''}`}
          style={{
            left: geo.esquerda,
            width: geo.largura,
            top: geo.acerto - (geo.acerto - geo.topo) * 0.45,
            height: geo.base - (geo.acerto - (geo.acerto - geo.topo) * 0.45)
          }}
        >
          {PISTAS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className="oc-zona"
              aria-label={`Pista ${p.rotulo}`}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture?.(e.pointerId);
                motor.current?.pressionar(i);
              }}
              onPointerUp={() => motor.current?.soltar(i)}
              onPointerCancel={() => motor.current?.soltar(i)}
              onLostPointerCapture={() => motor.current?.soltar(i)}
              onContextMenu={(e) => e.preventDefault()}
            />
          ))}
        </div>
      )}
      {children}
    </div>
  );
}
