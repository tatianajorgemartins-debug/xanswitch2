'use client';

// Controle (joystick) no Zelda Tour, pela Gamepad API do navegador.
// Funciona com controles XInput (Xbox e compatíveis) e DirectInput
// (genéricos, PS, etc.): o navegador entrega os botões numerados. Nos
// controles "padrão" (Xbox, PS4/PS5, Switch Pro) os números já vêm
// arrumados; nos genéricos cada marca numera de um jeito, e aí o jogador
// escolhe os botões em "Configurar controle".
//
// O navegador só mostra o controle depois que algum botão é apertado
// com a página aberta (regra de privacidade dos navegadores).
import { useEffect, useRef, useState } from 'react';
import { ler } from '@/lib/jogos/armazenamento';
import { PISTAS, type PistaId } from './ocarina';

export type AcaoControle = PistaId | 'especial';
// "b14" = botão 14; "a1+" / "a1-" = eixo 1 pra um lado / pro outro
export type MapaControle = Record<AcaoControle, string>;
export type TipoControle = 'xbox' | 'ps';

export const CHAVE_CONTROLE = 'ocarina_controle';
export const ACOES_CONTROLE: AcaoControle[] = [...PISTAS.map((p) => p.id), 'especial'];

// Padrão, da esquerda pra direita: LT LB RB RT A; Y = especial.
export const CONTROLE_PADRAO: MapaControle = { verde: 'b6', amarelo: 'b4', vermelho: 'b5', roxo: 'b7', azul: 'b0', especial: 'b3' };
// Sempre valem também (se o jogador tirar das pistas): ombros, gatilhos e Y
// pro especial; Start e Select/Back pra pausar.
const EXTRAS_ESPECIAL = ['b3', 'b4', 'b5', 'b6', 'b7'];
const PAUSA = ['b9', 'b8'];
const LIMIAR_EIXO = 0.6;

export function lerControle(): MapaControle {
  const salvo = ler<Partial<Record<string, string>>>(CHAVE_CONTROLE, {});
  const r = { ...CONTROLE_PADRAO };
  for (const a of ACOES_CONTROLE) {
    const v = salvo[a];
    if (typeof v === 'string' && /^(b\d{1,2}|a\d{1,2}[+-]|h\d{1,2}[udlr])$/.test(v)) r[a] = v;
  }
  return r;
}

function controles(): Gamepad[] {
  try {
    return (navigator.getGamepads?.() ?? []).filter((g): g is Gamepad => Boolean(g && g.connected));
  } catch {
    // bloqueado por política do site/navegador
    return [];
  }
}

// D-pad "chapéu" dos DirectInput: um eixo só, parado num valor acima de 1;
// cada direção (8) vira um valor entre -1 e 1.
const DIRECOES_CHAPEU: Record<string, number[]> = { u: [7, 0, 1], r: [1, 2, 3], d: [3, 4, 5], l: [5, 6, 7] };
function posicaoChapeu(v: number): number {
  return Math.abs(v) > 1.05 ? -1 : Math.round((v + 1) / (2 / 7)) % 8;
}

function apertado(g: Gamepad, bind: string): boolean {
  if (bind[0] === 'b') {
    const b = g.buttons[Number(bind.slice(1))];
    return Boolean(b && (b.pressed || b.value > 0.5));
  }
  if (bind[0] === 'h') {
    const v = g.axes[Number(bind.slice(1, -1))];
    return v !== undefined && DIRECOES_CHAPEU[bind.slice(-1)].includes(posicaoChapeu(v));
  }
  const v = g.axes[Number(bind.slice(1, -1))] ?? 0;
  return bind.endsWith('+') ? v > LIMIAR_EIXO : v < -LIMIAR_EIXO;
}

// Nomes dos botões: sempre os do Xbox, menos com controle de PlayStation.
export function tipoDoControle(g: Gamepad): TipoControle {
  return /054c|playstation|dualshock|dualsense|wireless controller/i.test(g.id) ? 'ps' : 'xbox';
}

const NOMES: Record<TipoControle, string[]> = {
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'LS', 'RS', '↑', '↓', '←', '→'],
  ps: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Share', 'Options', 'L3', 'R3', '↑', '↓', '←', '→']
};

// Nome curto do botão pra aparecer nos anéis e nas telas.
export function nomeBotao(bind: string, tipo: TipoControle | null): string {
  if (bind[0] === 'h') return { u: '↑', d: '↓', l: '←', r: '→' }[bind.slice(-1)] ?? '?';
  if (bind[0] === 'a') {
    const eixo = Number(bind.slice(1, -1));
    const mais = bind.endsWith('+');
    if (eixo === 0) return mais ? '→' : '←';
    if (eixo === 1) return mais ? '↓' : '↑';
    return `E${eixo + 1}${mais ? '+' : '−'}`;
  }
  const n = Number(bind.slice(1));
  // botão além dos 16 do padrão (ex: o botão central): número a partir do 1
  return NOMES[tipo ?? 'xbox'][n] ?? String(n + 1);
}

export const rotulosControle = (mapa: MapaControle, tipo: TipoControle | null) => PISTAS.map((p) => nomeBotao(mapa[p.id], tipo));

// Tudo que está apertado agora, somando todos os controles ligados.
function acoesApertadas(mapa: MapaControle): Set<AcaoControle | 'pausa'> {
  const r = new Set<AcaoControle | 'pausa'>();
  const usados = new Set(ACOES_CONTROLE.map((a) => mapa[a]));
  for (const g of controles()) {
    for (const a of ACOES_CONTROLE) if (apertado(g, mapa[a])) r.add(a);
    for (const b of EXTRAS_ESPECIAL) if (!usados.has(b) && apertado(g, b)) r.add('especial');
    for (const b of PAUSA) if (!usados.has(b) && apertado(g, b)) r.add('pausa');
  }
  return r;
}

type Ouvintes = {
  desce?: (a: AcaoControle | 'pausa') => void;
  sobe?: (a: AcaoControle | 'pausa') => void;
};

// Lê o controle a cada quadro enquanto tiver um ligado. Avisa quando um
// botão desce/sobe e devolve o tipo do controle ligado (ou null).
export function useControle(mapa: MapaControle, ouvintes: Ouvintes = {}): TipoControle | null {
  const [tipo, setTipo] = useState<TipoControle | null>(null);
  const mapaRef = useRef(mapa);
  mapaRef.current = mapa;
  const ouvRef = useRef(ouvintes);
  ouvRef.current = ouvintes;

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('getGamepads' in navigator)) return;
    let raf = 0;
    let antes = new Set<AcaoControle | 'pausa'>();
    const quadro = () => {
      const agora = acoesApertadas(mapaRef.current);
      for (const a of agora) if (!antes.has(a)) ouvRef.current.desce?.(a);
      for (const a of antes) if (!agora.has(a)) ouvRef.current.sobe?.(a);
      antes = agora;
      raf = requestAnimationFrame(quadro);
    };
    const conferir = () => {
      const gs = controles();
      setTipo(gs.length ? tipoDoControle(gs[0]) : null);
      if (gs.length && !raf) {
        // começa sem nada "apertado": o botão que acordou o controle não conta
        antes = acoesApertadas(mapaRef.current);
        raf = requestAnimationFrame(quadro);
      } else if (!gs.length && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
        for (const a of antes) ouvRef.current.sobe?.(a);
        antes = new Set();
      }
    };
    conferir();
    window.addEventListener('gamepadconnected', conferir);
    window.addEventListener('gamepaddisconnected', conferir);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('gamepadconnected', conferir);
      window.removeEventListener('gamepaddisconnected', conferir);
    };
  }, []);

  return tipo;
}

// Espera o próximo botão (ou eixo) apertado, pra configurar. Ignora o que
// já estava apertado/torto quando começou. Devolve uma função pra cancelar.
export function esperarBotao(aoApertar: (bind: string) => void): () => void {
  const base = new Set<string>();
  const chapeus = new Set<string>();
  const ativos = (g: Gamepad) => {
    const r: string[] = [];
    g.buttons.forEach((b, i) => {
      if (b.pressed || b.value > 0.5) r.push(`b${i}`);
    });
    g.axes.forEach((v, i) => {
      const k = `${g.index}:${i}`;
      if (Math.abs(v) > 1.05) chapeus.add(k);
      if (chapeus.has(k)) {
        const pos = posicaoChapeu(v);
        // diagonal não conta: espera uma direção reta
        const dir = (['u', 'r', 'd', 'l'] as const).find((d, j) => pos === j * 2);
        if (dir) r.push(`h${i}${dir}`);
      } else if (v > LIMIAR_EIXO) r.push(`a${i}+`);
      else if (v < -LIMIAR_EIXO) r.push(`a${i}-`);
    });
    return r;
  };
  for (const g of controles()) for (const b of ativos(g)) base.add(`${g.index}:${b}`);
  let raf = 0;
  const quadro = () => {
    for (const g of controles()) {
      const agora = ativos(g);
      // solto de novo: pode valer numa próxima vez
      for (const k of [...base]) if (k.startsWith(`${g.index}:`) && !agora.includes(k.slice(k.indexOf(':') + 1))) base.delete(k);
      const novo = agora.find((b) => !base.has(`${g.index}:${b}`));
      // gatilhos analógicos aparecem como botão e às vezes como eixo: fica o botão
      if (novo) {
        aoApertar(agora.find((b) => b[0] === 'b' && !base.has(`${g.index}:${b}`)) ?? novo);
        return;
      }
    }
    raf = requestAnimationFrame(quadro);
  };
  raf = requestAnimationFrame(quadro);
  return () => cancelAnimationFrame(raf);
}
