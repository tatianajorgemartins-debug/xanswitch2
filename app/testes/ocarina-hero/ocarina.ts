// Regras e dados do "Ocarina Hero" (sem tela e sem som): pistas, escala,
// formato das músicas, pontuação, estrelas e o texto de compartilhar.
// O motor (canvas + tempo) fica em motor.ts; o som, em som.ts.

export const JOGO = 'ocarina';
// Dia #1 da Música do Dia (mesmo lançamento do Silhueta do Dia).
export const INICIO = '2026-11-16';

// ---------- Pistas e escala (o único lugar onde ficam as alturas) ----------

export type PistaId = 'verde' | 'amarelo' | 'vermelho' | 'roxo' | 'azul';

export type Pista = {
  id: PistaId;
  rotulo: string;
  cor: string;
  // nota da ocarina tocada ao acertar (só nas músicas sem áudio próprio)
  nota: string;
};

// Da esquerda pra direita na tela: verde, amarelo, vermelho, roxo e azul.
export const PISTAS: Pista[] = [
  { id: 'verde', rotulo: 'Verde', cor: '#38d96a', nota: 'D4' },
  { id: 'amarelo', rotulo: 'Amarelo', cor: '#ffd23e', nota: 'F4' },
  { id: 'vermelho', rotulo: 'Vermelho', cor: '#ff4d5e', nota: 'A4' },
  { id: 'roxo', rotulo: 'Roxo', cor: '#b06bff', nota: 'B4' },
  { id: 'azul', rotulo: 'Azul', cor: '#3d8bff', nota: 'D5' }
];

// Nomes antigos das pistas (A e botões C) → cores, pra arquivos antigos.
const PISTAS_ANTIGAS: Record<string, PistaId> = { A: 'verde', C_baixo: 'amarelo', C_dir: 'vermelho', C_esq: 'roxo', C_cima: 'azul' };

export const indicePista = (id: string) => PISTAS.findIndex((p) => p.id === (PISTAS_ANTIGAS[id] ?? id));

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
  // De qual jogo é a música (agrupa a lista "Por jogo"). Ex: "Ocarina of Time".
  jogo?: string;
  bpm: number;
  // Onde cai o 1º tempo do 1º compasso, em segundos (grade do editor).
  inicioBatida?: number;
  dificuldade: Dificuldade;
  // Áudio da música (mp3/aac). Sem áudio, o jogo toca a ocarina em cada
  // acerto com um metrônomo de fundo (as músicas originais da XAN).
  audio?: string;
  duracaoAudio?: number;
  // Quando foi publicada (pra lista de "Novas").
  publicadaEm?: string;
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
      pista: PISTAS[indicePista(String(n.pista))].id,
      ...(typeof n.dur === 'number' && n.dur > 0.05 ? { dur: n.dur } : {}),
      ...(typeof n.nota === 'string' ? { nota: n.nota } : {})
    });
  }
  if (!notas.length) return null;
  notas.sort((a, b) => a.t - b.t);
  const texto = (k: string) => (typeof c[k] === 'string' && c[k] ? { [k]: c[k] as string } : {});
  const numero = (k: string) => (typeof c[k] === 'number' && Number.isFinite(c[k]) ? { [k]: c[k] as number } : {});
  return {
    id: c.id,
    titulo: c.titulo,
    bpm: c.bpm,
    dificuldade,
    ...texto('jogo'),
    ...texto('audio'),
    ...texto('publicadaEm'),
    ...numero('duracaoAudio'),
    ...numero('inicioBatida'),
    ...(typeof c.tom === 'string' ? { tom: c.tom } : {}),
    ...(typeof c.ativo_desde === 'string' ? { ativo_desde: c.ativo_desde } : {}),
    ...(c.ativo === false ? { ativo: false } : {}),
    notas
  };
}

export function duracaoChart(c: Chart): number {
  return Math.max(...c.notas.map((n) => n.t + (n.dur ?? 0)));
}

// Duração total pra mostrar na lista (o áudio, se tiver; senão as notas).
export function duracaoMusica(c: Chart): number {
  return c.duracaoAudio ?? duracaoChart(c) + 1;
}

export function formatarDuracao(s: number): string {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

// "Nova" = publicada nos últimos 14 dias.
export function ehNova(c: Chart, agora = Date.now()): boolean {
  return Boolean(c.publicadaEm) && agora - new Date(c.publicadaEm!).getTime() < 14 * 86_400_000;
}

// Músicas sem jogo definido (as originais) entram neste grupo.
export const JOGO_ORIGINAIS = 'Originais XAN';

// ---------- Pontuação ----------

// Precisão (escolhida pelo jogador no menu): quanto antes/depois do tempo
// certo o toque ainda vale. "perfeito" e "bom" em segundos, pra cada lado.
export type Precisao = 'folgada' | 'normal' | 'exata';
export const PRECISOES: Record<Precisao, { nome: string; dica: string; perfeito: number; bom: number }> = {
  folgada: { nome: 'Folgada', dica: 'mais fácil de acertar', perfeito: 0.075, bom: 0.16 },
  normal: { nome: 'Normal', dica: 'o padrão', perfeito: 0.06, bom: 0.125 },
  exata: { nome: 'Exata', dica: 'pra quem quer desafio', perfeito: 0.045, bom: 0.09 }
};
export const PRECISAO_PADRAO: Precisao = 'normal';
export const ehPrecisao = (v: unknown): v is Precisao => typeof v === 'string' && v in PRECISOES;
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

// Teclas padrão (event.code): A S J K L, da esquerda pra direita. Os
// números 1 a 5 funcionam sempre, como alternativa.
export const TECLAS_PADRAO: MapaTeclas = { verde: 'KeyA', amarelo: 'KeyS', vermelho: 'KeyJ', roxo: 'KeyK', azul: 'KeyL' };
export const TECLAS_ALTERNATIVAS: MapaTeclas = { verde: 'Digit1', amarelo: 'Digit2', vermelho: 'Digit3', roxo: 'Digit4', azul: 'Digit5' };

// Teclas salvas no formato antigo (A/C) → cores.
export function migrarTeclas(t: Record<string, string>): Partial<MapaTeclas> {
  const r: Partial<MapaTeclas> = {};
  for (const [k, v] of Object.entries(t)) {
    const i = indicePista(k);
    if (i >= 0 && typeof v === 'string') r[PISTAS[i].id] = v;
  }
  return r;
}

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
