// O "dia" dos jogos diários (Silhueta do Dia, Música do Dia…) e o sorteio
// que sai dele.
//
// O dia é contado no horário de Brasília e vira a semente de um gerador
// pseudoaleatório: a mesma data dá o mesmo resultado em qualquer aparelho,
// sem servidor. Por isso todo mundo recebe o mesmo desafio no mesmo dia, e o
// desafio troca à meia-noite de Brasília.
//
// Este arquivo não depende de nada do site (roda também nos testes:
// tests/jogos/*.test.ts).

export const FUSO = 'America/Sao_Paulo';

// "AAAA-MM-DD" do dia em Brasília no instante dado.
export function diaEm(instante: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(instante);
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
  return `${v('year')}-${v('month')}-${v('day')}`;
}

// Soma (ou subtrai) dias numa data "AAAA-MM-DD".
export function addDias(dia: string, n: number): string {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

// Quantos dias de `de` até `ate` (positivo se `ate` vem depois).
export function diffDias(de: string, ate: string): number {
  const ms = (dia: string) => {
    const [a, m, d] = dia.split('-').map(Number);
    return Date.UTC(a, m - 1, d);
  };
  return Math.round((ms(ate) - ms(de)) / 86_400_000);
}

// Diferença de Brasília pra UTC no instante dado, em minutos (hoje, -180).
// Calculada em vez de fixa caso o horário de verão volte um dia.
function offsetMinutos(instante: Date): number {
  const nome =
    new Intl.DateTimeFormat('en-US', { timeZone: FUSO, timeZoneName: 'longOffset' })
      .formatToParts(instante)
      .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-03:00';
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(nome);
  if (!m) return -180;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

// Milissegundos até a próxima meia-noite de Brasília (o contador "próximo
// desafio em…").
export function msAteProximoDia(agora: Date = new Date()): number {
  const amanha = addDias(diaEm(agora), 1);
  const [a, m, d] = amanha.split('-').map(Number);
  const meiaNoiteUtc = Date.UTC(a, m - 1, d) - offsetMinutos(agora) * 60_000;
  return Math.max(0, meiaNoiteUtc - agora.getTime());
}

// "05:03:09"
export function formatarContador(ms: number): string {
  const s = Math.floor(ms / 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

// ---------- Sorteio determinístico ----------

// Texto → número de 32 bits (xmur3). Mesma entrada, mesmo número.
export function hashTexto(texto: string): number {
  let h = 1779033703 ^ texto.length;
  for (let i = 0; i < texto.length; i++) {
    h = Math.imul(h ^ texto.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

// Gerador pseudoaleatório mulberry32: devolve números entre 0 e 1.
export function mulberry32(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Gerador já semeado por um texto (ex: "2026-11-16:facil").
export function rngDe(texto: string): () => number {
  return mulberry32(hashTexto(texto));
}

// Embaralha uma cópia da lista com o gerador dado.
export function embaralhar<T>(lista: readonly T[], rng: () => number): T[] {
  const r = [...lista];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
