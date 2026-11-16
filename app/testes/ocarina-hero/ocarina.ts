// Regras e dados do "Ocarina Hero" (sem tela e sem som): pistas, escala,
// formato das músicas, pontuação, estrelas e o texto de compartilhar.
// O motor (canvas + tempo) fica em motor.ts; o som, em som.ts.

export const JOGO = 'ocarina';
// Dia #1 da Música do Dia (mesmo lançamento do Silhueta do Dia).
export const INICIO = '2026-11-16';

// ---------- Pistas e escala (o único lugar onde ficam as alturas) ----------

export type PistaId = 'A' | 'C_baixo' | 'C_dir' | 'C_esq' | 'C_cima';

export type Pista = {
  id: PistaId;
  rotulo: string;
  // seta desenhada na nota (null = botão A)
  seta: 'baixo' | 'direita' | 'esquerda' | 'cima' | null;
  cor: string;
  // nota da escala da ocarina (nome e frequência em Hz)
  nota: string;
};

// Da esquerda pra direita na tela. A em azul; os botões C em dourado.
export const PISTAS: Pista[] = [
  { id: 'A', rotulo: 'A', seta: null, cor: '#3d8bff', nota: 'D4' },
  { id: 'C_baixo', rotulo: 'C↓', seta: 'baixo', cor: '#ffc93c', nota: 'F4' },
  { id: 'C_dir', rotulo: 'C→', seta: 'direita', cor: '#ffc93c', nota: 'A4' },
  { id: 'C_esq', rotulo: 'C←', seta: 'esquerda', cor: '#ffc93c', nota: 'B4' },
  { id: 'C_cima', rotulo: 'C↑', seta: 'cima', cor: '#ffc93c', nota: 'D5' }
];

export const indicePista = (id: string) => PISTAS.findIndex((p) => p.id === id);

// "D4", "F#5", "Bb3" → Hz (lá 440).
export function frequencia(nota: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(nota.trim());
  if (!m) return 440;
  const base: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  const semitons = base[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * Math.pow(2, semitons / 12);
}

// ---------- Músicas (charts) ----------

export type Dificuldade = 'facil' | 'medio' | 'dificil' | 'insano';

export const DIFICULDADES: Record<Dificuldade, { nome: string; cor: string; antecedencia: number }> = {
  // antecedencia = quantos segundos a nota leva pra descer a pista
  facil: { nome: 'Fácil', cor: '#4ef05f', antecedencia: 2.0 },
  medio: { nome: 'Médio', cor: '#38c8ff', antecedencia: 1.7 },
  dificil: { nome: 'Difícil', cor: '#ffab2e', antecedencia: 1.45 },
  insano: { nome: 'Insano', cor: '#ff4d7d', antecedencia: 1.25 }
};

export type NotaChart = {
  t: number; // segundos desde o início da música
  pista: PistaId;
  dur?: number; // nota longa (segurar), em segundos
  nota?: string; // altura diferente da pista (opcional), ex: "E5"
};

export type Chart = {
  id: string;
  titulo: string;
  bpm: number;
  dificuldade: Dificuldade;
  // nota grave do acompanhamento (opcional, padrão D2)
  tom?: string;
  // "AAAA-MM-DD": só entra no sorteio da Música do Dia a partir desse dia
  // (o editor já põe amanhã). false em "ativo" tira do sorteio e da lista.
  ativo_desde?: string;
  ativo?: boolean;
  notas: NotaChart[];
};

// Confere e arruma um chart lido do JSON. null se estiver inválido.
export function validarChart(raw: unknown): Chart | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.id !== 'string' || typeof c.titulo !== 'string' || typeof c.bpm !== 'number' || !Array.isArray(c.notas)) return null;
  const dificuldade = (['facil', 'medio', 'dificil', 'insano'] as const).find((d) => d === c.dificuldade) ?? 'medio';
  const notas: NotaChart[] = [];
  for (const n of c.notas as Record<string, unknown>[]) {
    if (!n || typeof n.t !== 'number' || indicePista(String(n.pista)) < 0) continue;
    notas.push({
      t: n.t,
      pista: n.pista as PistaId,
      ...(typeof n.dur === 'number' && n.dur > 0.05 ? { dur: n.dur } : {}),
      ...(typeof n.nota === 'string' ? { nota: n.nota } : {})
    });
  }
  if (!notas.length) return null;
  notas.sort((a, b) => a.t - b.t);
  return {
    id: c.id,
    titulo: c.titulo,
    bpm: c.bpm,
    dificuldade,
    ...(typeof c.tom === 'string' ? { tom: c.tom } : {}),
    ...(typeof c.ativo_desde === 'string' ? { ativo_desde: c.ativo_desde } : {}),
    ...(c.ativo === false ? { ativo: false } : {}),
    notas
  };
}

export function duracaoChart(c: Chart): number {
  return Math.max(...c.notas.map((n) => n.t + (n.dur ?? 0)));
}

// ---------- Pontuação ----------

export const JANELA_PERFEITO = 0.045;
export const JANELA_BOM = 0.09;
export const PONTOS_PERFEITO = 50;
export const PONTOS_BOM = 30;

// x2 a partir de 10 acertos seguidos, x3 em 20, x4 em 30.
export function multiplicador(combo: number): number {
  return combo >= 30 ? 4 : combo >= 20 ? 3 : combo >= 10 ? 2 : 1;
}

// Energia da Navi: sobe ao acertar, cai ao errar; zerou, a música acaba.
export const ENERGIA_INICIAL = 0.6;
export const ENERGIA_ACERTO = 0.025;
export const ENERGIA_ERRO = 0.065;
export const ENERGIA_TOQUE_VAZIO = 0.03;

export type ResultadoMusica = {
  chartId: string;
  completou: boolean;
  pontos: number;
  precisao: number; // 0 a 100
  maiorCombo: number;
  perfeitos: number;
  bons: number;
  erros: number;
  estrelas: number; // 0 a 5 (0 = não completou)
};

export function precisao(perfeitos: number, bons: number, total: number): number {
  return total ? Math.round(((perfeitos + bons * 0.6) / total) * 100) : 0;
}

export function estrelas(completou: boolean, prec: number): number {
  if (!completou) return 0;
  return prec >= 95 ? 5 : prec >= 85 ? 4 : prec >= 70 ? 3 : prec >= 50 ? 2 : 1;
}

export const desenhoEstrelas = (n: number) => '⭐'.repeat(n) + '☆'.repeat(5 - n);

export function textoCompartilhar(o: { numero: number | null; chart: Chart; r: ResultadoMusica; sequencia: number }): string {
  const linhas = [
    o.numero ? `Ocarina Hero · Música do Dia #${o.numero}` : 'Ocarina Hero',
    `🎵 ${o.chart.titulo} (${DIFICULDADES[o.chart.dificuldade].nome})`,
    o.r.completou ? `${desenhoEstrelas(o.r.estrelas)} ${o.r.precisao}% · Combo ${o.r.maiorCombo}` : `💔 Não completou · ${o.r.precisao}%`
  ];
  if (o.numero) linhas.push(`🔥 Sequência: ${o.sequencia} ${o.sequencia === 1 ? 'dia' : 'dias'}`);
  linhas.push('xanswitch.com.br');
  return linhas.join('\n');
}

// ---------- Teclas ----------

export type MapaTeclas = Record<PistaId, string>;

// Teclas padrão (event.code): A S J K L, da esquerda pra direita. As setas
// e o espaço funcionam sempre, como alternativa.
export const TECLAS_PADRAO: MapaTeclas = { A: 'KeyA', C_baixo: 'KeyS', C_dir: 'KeyJ', C_esq: 'KeyK', C_cima: 'KeyL' };
export const TECLAS_ALTERNATIVAS: MapaTeclas = { A: 'Space', C_baixo: 'ArrowDown', C_dir: 'ArrowRight', C_esq: 'ArrowLeft', C_cima: 'ArrowUp' };

// Pista da tecla apertada (teclas escolhidas + setas/espaço); -1 se nenhuma.
export function pistaDaTecla(code: string, teclas: MapaTeclas): number {
  const i = PISTAS.findIndex((p) => teclas[p.id] === code);
  return i >= 0 ? i : PISTAS.findIndex((p) => TECLAS_ALTERNATIVAS[p.id] === code);
}

// "KeyA" → "A", "ArrowDown" → "↓", "Space" → "Espaço"
export function nomeTecla(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const especiais: Record<string, string> = {
    Space: 'Espaço',
    ArrowDown: '↓',
    ArrowUp: '↑',
    ArrowLeft: '←',
    ArrowRight: '→',
    Semicolon: 'Ç',
    Comma: ',',
    Period: '.',
    Slash: ';'
  };
  return especiais[code] ?? code;
}
