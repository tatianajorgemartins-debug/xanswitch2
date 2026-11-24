// Músicas do Zelda Tour montadas no admin (tabela ocarina_songs, de
// db/migration-ocarina-musicas.sql). Só roda no servidor.
import { getSql } from './sql';
import { getSiteSetting, setSiteSetting } from './db';

// O jogo está aberto pro público? Ligado em /admin > Zelda Tour. Enquanto
// estiver fora do ar, a página Testes mostra o banner "Em breve".
const JOGO_PUBLICADO_KEY = 'ocarina_publicado';

export async function jogoOcarinaPublicado(): Promise<boolean> {
  return (await getSiteSetting(JOGO_PUBLICADO_KEY).catch(() => null)) === 'true';
}

export async function setJogoOcarinaPublicado(publicado: boolean): Promise<void> {
  await setSiteSetting(JOGO_PUBLICADO_KEY, publicado ? 'true' : 'false');
}

export type OcarinaNota = { t: number; pista: string; dur?: number; estrela?: boolean };

// As notas de cada dificuldade e quais delas os jogadores podem escolher.
export type OcarinaCharts = { notas: Record<string, OcarinaNota[]>; liberadas: string[] };

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
  // onde a música termina no jogo (segundos); null = até o fim do áudio
  end_at: number | null;
  // null = só tem a dificuldade principal (difficulty + notes)
  charts: OcarinaCharts | null;
  // imagem de fundo do jogo nesta música (null = o cenário padrão)
  background_url: string | null;
  published: boolean;
  published_at: Date | null;
  active_from: string | null;
  created_at: Date;
  updated_at: Date;
};

// NUMERIC volta como texto no driver do Neon: converte aqui.
function lerCharts(v: unknown): OcarinaCharts | null {
  if (!v || typeof v !== 'object') return null;
  const c = v as Partial<OcarinaCharts>;
  return {
    notas: c.notas && typeof c.notas === 'object' ? c.notas : {},
    liberadas: Array.isArray(c.liberadas) ? c.liberadas.filter((d) => typeof d === 'string') : []
  };
}

// Fim da música e dificuldades ficam em site_settings (uma chave por música):
// assim valem no jogo publicado sem depender de coluna nova no banco.
const PREFIXO_EXTRA = 'ocarina_extra_';
type ExtraMusica = { fimEm: number | null; charts: OcarinaCharts; fundo?: string | null };

async function lerExtras(): Promise<Map<number, ExtraMusica>> {
  const mapa = new Map<number, ExtraMusica>();
  const rows = await getSql()`SELECT key, value FROM site_settings WHERE key LIKE ${PREFIXO_EXTRA + '%'}`.catch(() => []);
  for (const r of rows as { key: string; value: string | null }[]) {
    try {
      const v = JSON.parse(r.value ?? 'null') as Partial<ExtraMusica> | null;
      if (!v) continue;
      mapa.set(Number(r.key.slice(PREFIXO_EXTRA.length)), {
        fimEm: typeof v.fimEm === 'number' && v.fimEm > 0 ? v.fimEm : null,
        charts: lerCharts(v.charts) ?? { notas: {}, liberadas: [] },
        fundo: typeof v.fundo === 'string' && v.fundo ? v.fundo : null
      });
    } catch {
      // valor quebrado: fica como se não tivesse
    }
  }
  return mapa;
}

function comExtra<T extends { id: number; end_at: number | null; charts: OcarinaCharts | null; background_url: string | null }>(
  m: T,
  extras: Map<number, ExtraMusica>
): T {
  const e = extras.get(m.id);
  return e ? { ...m, end_at: e.fimEm, charts: e.charts, background_url: e.fundo ?? null } : m;
}

async function lerExtra(id: number): Promise<ExtraMusica | null> {
  const rows = await getSql()`SELECT value FROM site_settings WHERE key = ${PREFIXO_EXTRA + id}`;
  try {
    const v = JSON.parse((rows[0] as { value: string | null } | undefined)?.value ?? 'null') as Partial<ExtraMusica> | null;
    if (!v) return null;
    return {
      fimEm: typeof v.fimEm === 'number' && v.fimEm > 0 ? v.fimEm : null,
      charts: lerCharts(v.charts) ?? { notas: {}, liberadas: [] },
      fundo: typeof v.fundo === 'string' && v.fundo ? v.fundo : null
    };
  } catch {
    return null;
  }
}

// As notas de cada dificuldade e as liberadas. A principal sempre vale.
export function dificuldadesDaMusica(m: Pick<OcarinaSongRow, 'difficulty' | 'notes' | 'charts'>): OcarinaCharts {
  const notas = { ...(m.charts?.notas ?? {}), [m.difficulty]: m.notes };
  const liberadas = [...new Set([...(m.charts?.liberadas ?? []), m.difficulty])].filter((d) => (notas[d]?.length ?? 0) > 0);
  return { notas, liberadas };
}

function normalizar(r: Record<string, unknown>): OcarinaSongRow {
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    ...(r as OcarinaSongRow),
    id: Number(r.id),
    bpm: Number(r.bpm),
    beat_offset: Number(r.beat_offset),
    audio_duration: num(r.audio_duration),
    audio_bytes: num(r.audio_bytes),
    end_at: r.end_at === null || r.end_at === undefined || r.end_at === '' ? null : Number(r.end_at),
    notes: Array.isArray(r.notes) ? (r.notes as OcarinaNota[]) : [],
    charts: null,
    background_url: null
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
  const extras = await lerExtras();
  return (rows as Record<string, unknown>[]).map((r) => ({ ...comExtra(normalizar(r), extras), note_count: Number(r.note_count) }));
}

export async function getOcarinaSong(id: number): Promise<OcarinaSongRow | null> {
  const rows = await getSql()`
    SELECT id, title, game, difficulty, bpm, beat_offset, audio_url, audio_duration, audio_bytes, notes, published,
      published_at, to_char(active_from, 'YYYY-MM-DD') AS active_from, created_at, updated_at,
      to_jsonb(ocarina_songs) ->> 'end_at' AS end_at
    FROM ocarina_songs WHERE id = ${id}
  `;
  return rows[0] ? comExtra(normalizar(rows[0] as Record<string, unknown>), await lerExtras()) : null;
}

// As publicadas, completas (pro jogo).
export async function getPublishedOcarinaSongs(): Promise<OcarinaSongRow[]> {
  const rows = await getSql()`
    SELECT id, title, game, difficulty, bpm, beat_offset, audio_url, audio_duration, audio_bytes, notes, published,
      published_at, to_char(active_from, 'YYYY-MM-DD') AS active_from, created_at, updated_at,
      to_jsonb(ocarina_songs) ->> 'end_at' AS end_at
    FROM ocarina_songs WHERE published = TRUE AND audio_url IS NOT NULL AND jsonb_array_length(notes) > 0
    ORDER BY published_at DESC
  `;
  const extras = await lerExtras();
  return (rows as Record<string, unknown>[]).map((r) => comExtra(normalizar(r), extras));
}

export async function createOcarinaSong(title: string): Promise<number> {
  const rows = await getSql()`INSERT INTO ocarina_songs (title) VALUES (${title}) RETURNING id`;
  return Number((rows[0] as { id: number }).id);
}

export async function updateOcarinaSong(
  id: number,
  s: { title: string; game: string; difficulty: string; bpm: number; beatOffset: number; notes: OcarinaNota[]; endAt: number | null; charts: OcarinaCharts }
): Promise<void> {
  await getSql()`
    UPDATE ocarina_songs SET title = ${s.title}, game = ${s.game}, difficulty = ${s.difficulty}, bpm = ${s.bpm},
      beat_offset = ${s.beatOffset}, notes = ${JSON.stringify(s.notes)}::jsonb, updated_at = now()
    WHERE id = ${id}
  `;
  // mantém o fundo que já estava (ele é trocado à parte, ver abaixo)
  const antes = await lerExtra(id);
  const extra: ExtraMusica = { fimEm: s.endAt, charts: s.charts, fundo: antes?.fundo ?? null };
  await setSiteSetting(PREFIXO_EXTRA + id, JSON.stringify(extra));
}

// Troca (ou tira, com null) a imagem de fundo. Devolve a URL antiga.
export async function setOcarinaSongBackground(id: number, url: string | null): Promise<string | null> {
  const antes = await lerExtra(id);
  let base: ExtraMusica;
  if (antes) base = antes;
  else {
    // ainda não tinha extra: parte do que está nas colunas
    const m = await getOcarinaSong(id);
    base = { fimEm: m?.end_at ?? null, charts: m ? dificuldadesDaMusica(m) : { notas: {}, liberadas: [] } };
  }
  await setSiteSetting(PREFIXO_EXTRA + id, JSON.stringify({ ...base, fundo: url }));
  await getSql()`UPDATE ocarina_songs SET updated_at = now() WHERE id = ${id}`;
  return antes?.fundo ?? null;
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

export async function deleteOcarinaSong(id: number): Promise<{ audio: string | null; fundo: string | null }> {
  const fundo = (await lerExtra(id).catch(() => null))?.fundo ?? null;
  await getSql()`DELETE FROM site_settings WHERE key = ${PREFIXO_EXTRA + id}`;
  const rows = await getSql()`DELETE FROM ocarina_songs WHERE id = ${id} RETURNING audio_url`;
  return { audio: (rows[0] as { audio_url: string | null } | undefined)?.audio_url ?? null, fundo };
}
