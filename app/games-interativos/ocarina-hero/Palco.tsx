'use client';
/* eslint-disable @next/next/no-img-element */

// Palco da partida: cenário da floresta, a pista (canvas, motor.ts) e o
// HUD em HTML por cima — brasão + nome da música, placar, pausa, corações
// (energia), combo com multiplicador e a barra de progresso. Usado no jogo
// (OcarinaClient) e no "Testar no jogo" do editor do admin.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { DIFICULDADES, NOME_JOGO, PISTAS, TECLA_ESPECIAL, formatarDuracao, nomeTecla, pistaDaTecla, type Chart, type MapaTeclas, type Precisao, type ResultadoMusica } from './ocarina';
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
  const palco = useRef<HTMLDivElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const magia = useRef<HTMLDivElement>(null);
  const magiaFill = useRef<HTMLElement>(null);
  const botaoEspecial = useRef<HTMLButtonElement>(null);
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
      if (u.barra !== h.barra && magiaFill.current) magiaFill.current.style.transform = `scaleX(${h.barra.toFixed(3)})`;
      if (u.especial !== h.especial) {
        palco.current?.classList.toggle('is-especial', h.especial);
        magia.current?.classList.toggle('is-gastando', h.especial);
        botaoEspecial.current?.classList.toggle('is-ativo', h.especial);
      }
      if (u.pronta !== h.pronta) {
        magia.current?.classList.toggle('is-pronta', h.pronta);
        botaoEspecial.current?.classList.toggle('is-pronto', h.pronta);
        botaoEspecial.current?.setAttribute('aria-disabled', String(!h.pronta));
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

  // Placar, vida, barra e combo sempre encostados na pista.
  useLayoutEffect(() => {
    const p = palco.current;
    const d = painel.current;
    const c = comboEl.current;
    if (!geo || !p || !d || !c) return;
    const colocar = (el: HTMLElement, left: number, top: number) => {
      el.style.right = 'auto';
      el.style.left = `${Math.round(left)}px`;
      el.style.top = `${Math.round(top)}px`;
    };
    const largura = p.clientWidth;
    if (p.clientHeight > largura) {
      // Em pé: numa linha logo acima da pista, com o botão do especial à direita.
      colocar(d, 12, Math.max(56, geo.topo - d.offsetHeight - 10));
      colocar(c, Math.max(d.offsetWidth + 18, largura - c.offsetWidth - 92), Math.max(56, geo.topo - c.offsetHeight - 6));
      return;
    }
    const borda = (y: number) => geo.bordaTopo + ((geo.bordaAcerto - geo.bordaTopo) * (y - geo.topo)) / (geo.acerto - geo.topo);
    const topo = Math.max(10, geo.topo);
    colocar(d, Math.min(borda(topo + d.offsetHeight) + 14, largura - d.offsetWidth - 72), topo);
    const topoCombo = topo + d.offsetHeight + 12;
    colocar(c, Math.min(borda(topoCombo + c.offsetHeight) + 14, largura - c.offsetWidth - 10), topoCombo);
  }, [geo, toque]);

  // Teclado
  useEffect(() => {
    const desce = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        e.stopPropagation();
        pausaRef.current();
        return;
      }
      if (e.code === TECLA_ESPECIAL && motor.current?.emJogo) {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) motor.current.ativarEspecial();
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
      if (e.code === TECLA_ESPECIAL && motor.current?.emJogo) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
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
  const topoZonas = geo ? geo.acerto - (geo.acerto - geo.topo) * 0.45 : 0;
  return (
    <div ref={palco} className={`oc-palco ${OC_FONTES}`} role="application" aria-label={`${NOME_JOGO}: ${chart.titulo}`}>
      <div className="oc-cenario" aria-hidden="true" />
      <canvas ref={canvas} className="oc-canvas" />

      <div className="oc-hud" aria-hidden="true">
        <div className="oc-hud-titulo">
          <img src={`${UI}brasao.webp`} alt="" className="oc-hud-brasao" />
          <div>
            <p className="oc-hud-jogo">
              {NOME_JOGO}
              <span className="oc-hud-dif" style={{ '--dif': dif.cor } as React.CSSProperties}>
                {dif.nome}
              </span>
            </p>
            {etiqueta && <p className="oc-hud-etiqueta">{etiqueta}</p>}
            <p className="oc-hud-musica">♪ {chart.titulo}</p>
          </div>
        </div>

        <img src={`${UI}triforce.webp`} alt="" className="oc-hud-tri" />

        <div className="oc-hud-dir" ref={painel}>
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
          <div className="oc-hud-magia" ref={magia}>
            <span className="oc-hud-magia-barra">
              <i ref={magiaFill} />
            </span>
            {!toque && <span className="oc-hud-magia-tecla">Espaço</span>}
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

      {toque && (
        <button
          ref={botaoEspecial}
          type="button"
          className="oc-especial"
          style={{ '--topo-pista': `${geo?.topo ?? 0}px` } as React.CSSProperties}
          aria-label="Ativar o especial"
          aria-disabled="true"
          onPointerDown={(e) => {
            e.preventDefault();
            motor.current?.ativarEspecial();
          }}
          onClick={() => motor.current?.ativarEspecial()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <svg viewBox="0 0 24 24" width={26} height={26} aria-hidden="true">
            <path d="M12 3l4.5 8h-9zM7.5 11l4.5 8H3zM16.5 11l4.5 8h-9z" fill="currentColor" />
          </svg>
          <span>Especial</span>
        </button>
      )}

      {geo && (
        <div
          className={`oc-zonas${toque ? ' is-toque' : ''}`}
          style={{
            left: geo.esquerda,
            width: geo.largura,
            top: topoZonas,
            height: geo.base - topoZonas
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
