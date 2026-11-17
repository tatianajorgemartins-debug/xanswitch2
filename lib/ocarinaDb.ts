// Músicas do Ocarina Hero montadas no admin (tabela ocarina_songs, de
// db/migration-ocarina-musicas.sql). Só roda no servidor.
import { getSql } from './sql';

export type OcarinaNota = { t: number; pista: string; dur?: number };

export type OcarinaSongRow = {
  id: number;
  title: string;
  game: string;
  difficulty: string;
  bpm: number;
  beat_offset: number;
  audio_url: string | null;
  audio_duration: number | null;
  audio_bytes: number | null;
  notes: OcarinaNota[];
  published: boolean;
  published_at: Date | null;
  active_from: string | null;
  created_at: Date;
  updated_at: Date;
};

// NUMERIC volta como texto no driver do Neon: converte aqui.
function normalizar(r: Record<string, unknown>): OcarinaSongRow {
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    ...(r as OcarinaSongRow),
    id: Number(r.id),
    bpm: Number(r.bpm),
    beat_offset: Number(r.beat_offset),
    audio_duration: num(r.audio_duration),
    audio_bytes: num(r.audio_bytes),
    notes: Array.isArray(r.notes) ? (r.notes as OcarinaNota[]) : []
  };
}

export type OcarinaSongResumo = Omit<OcarinaSongRow, 'notes'> & { note_count: number };

export async function getAllOcarinaSongs(): Promise<OcarinaSongResumo[]> {
  const rows = await getSql()`
    SELECT id, title, game, difficulty, bpm, beat_offset, audio_url, audio_duration, audio_bytes,
      jsonb_array_length(notes) AS note_count, published, published_at, to_char(active_from, 'YYYY-MM-DD') AS active_from,
      created_at, updated_at
    FROM ocarina_songs ORDER BY updated_at DESC
  `;
  return (rows as Record<string, unknown>[]).map((r) => ({ ...normalizar(r), note_count: Number(r.note_count) }));
}

export async function getOcarinaSong(id: number): Promise<OcarinaSongRow | null> {
  const rows = await getSql()`
    SELECT id, title, game, difficulty, bpm, beat_offset, audio_url, audio_duration, audio_bytes, notes, published,
      published_at, to_char(active_from, 'YYYY-MM-DD') AS active_from, created_at, updated_at
    FROM ocarina_songs WHERE id = ${id}
  `;
  return rows[0] ? normalizar(rows[0] as Record<string, unknown>) : null;
}

// As publicadas, completas (pro jogo).
export async function getPublishedOcarinaSongs(): Promise<OcarinaSongRow[]> {
  const rows = await getSql()`
    SELECT id, title, game, difficulty, bpm, beat_offset, audio_url, audio_duration, audio_bytes, notes, published,
      published_at, to_char(active_from, 'YYYY-MM-DD') AS active_from, created_at, updated_at
    FROM ocarina_songs WHERE published = TRUE AND audio_url IS NOT NULL AND jsonb_array_length(notes) > 0
    ORDER BY published_at DESC
  `;
  return (rows as Record<string, unknown>[]).map(normalizar);
}

export async function createOcarinaSong(title: string): Promise<number> {
  const rows = await getSql()`INSERT INTO ocarina_songs (title) VALUES (${title}) RETURNING id`;
  return Number((rows[0] as { id: number }).id);
}

export async function updateOcarinaSong(
  id: number,
  s: { title: string; game: string; difficulty: string; bpm: number; beatOffset: number; notes: OcarinaNota[] }
): Promise<void> {
  await getSql()`
    UPDATE ocarina_songs SET title = ${s.title}, game = ${s.game}, difficulty = ${s.difficulty}, bpm = ${s.bpm},
      beat_offset = ${s.beatOffset}, notes = ${JSON.stringify(s.notes)}::jsonb, updated_at = now()
    WHERE id = ${id}
  `;
}

export async function setOcarinaSongAudio(id: number, url: string, duration: number, bytes: number): Promise<void> {
  await getSql()`
    UPDATE ocarina_songs SET audio_url = ${url}, audio_duration = ${duration}, audio_bytes = ${bytes}, updated_at = now()
    WHERE id = ${id}
  `;
}

// Publicar: na primeira vez marca a data e o dia em que entra no sorteio da
// Música do Dia (amanhã, pra não mudar o desafio de hoje).
export async function setOcarinaSongPublished(id: number, published: boolean, activeFrom: string): Promise<void> {
  await getSql()`
    UPDATE ocarina_songs SET published = ${published},
      published_at = CASE WHEN ${published} AND published_at IS NULL THEN now() ELSE published_at END,
      active_from = CASE WHEN ${published} AND active_from IS NULL THEN ${activeFrom}::date ELSE active_from END,
      updated_at = now()
    WHERE id = ${id}
  `;
}

export async function deleteOcarinaSong(id: number): Promise<string | null> {
  const rows = await getSql()`DELETE FROM ocarina_songs WHERE id = ${id} RETURNING audio_url`;
  return (rows[0] as { audio_url: string | null } | undefined)?.audio_url ?? null;
}
