// Banco dos jogos interativos: registro das partidas (game_plays) e o feed
// de resultados (game_posts / game_post_likes). Tabelas criadas por
// db/migration-jogos-interativos.sql. Só roda no servidor.
import { getSql } from './sql';

// ---------- Partidas ----------

export type GamePlayRow = {
  id: number;
  game: string;
  mode: string;
  daily_day: string | null;
  won: boolean | null;
  score: number | null;
  summary: string;
  details: Record<string, unknown>;
  customer_email: string | null;
  visitor_id: string;
  created_at: Date;
};

export async function insertGamePlay(p: {
  game: string;
  mode: string;
  dailyDay: string | null;
  won: boolean | null;
  score: number | null;
  summary: string;
  details: Record<string, unknown>;
  email: string | null;
  visitorId: string;
}): Promise<void> {
  await getSql()`
    INSERT INTO game_plays (game, mode, daily_day, won, score, summary, details, customer_email, visitor_id)
    VALUES (${p.game}, ${p.mode}, ${p.dailyDay}, ${p.won}, ${p.score}, ${p.summary}, ${JSON.stringify(p.details)}::jsonb, ${p.email}, ${p.visitorId})
  `;
}

// Quantas partidas esse aparelho registrou na última hora (trava contra
// alguém enchendo a tabela de propósito).
export async function countRecentPlaysByVisitor(visitorId: string): Promise<number> {
  const rows = await getSql()`
    SELECT count(*)::int AS n FROM game_plays WHERE visitor_id = ${visitorId} AND created_at > now() - interval '1 hour'
  `;
  return (rows[0] as { n: number }).n;
}

export async function getRecentGamePlays(limit = 600): Promise<GamePlayRow[]> {
  const rows = await getSql()`
    SELECT id, game, mode, to_char(daily_day, 'YYYY-MM-DD') AS daily_day, won, score, summary, details, customer_email, visitor_id, created_at
    FROM game_plays ORDER BY created_at DESC LIMIT ${limit}
  `;
  return rows as GamePlayRow[];
}

// Melhor partida de cada jogador numa música e dificuldade, do maior pro menor.
export type RecordeJogador = { customer_email: string; nome: string; score: number; precisao: string | null; estrelas: string | null; modo: string | null };

export async function getRecordesOcarina(chartId: string, limit = 100): Promise<RecordeJogador[]> {
  const rows = await getSql()`
    SELECT customer_email, nome, score, precisao, estrelas, modo FROM (
      -- Uma linha por jogador: o mesmo nome em contas diferentes (ex: uma
      -- pelo Google e outra por e-mail) conta como uma pessoa só. Contas sem
      -- nome ("Jogador XAN") são pessoas diferentes: ficam separadas.
      SELECT DISTINCT ON (CASE WHEN nome = 'Jogador XAN' THEN customer_email ELSE lower(nome) END) * FROM (
        SELECT DISTINCT ON (customer_email) customer_email, score, created_at,
          details -> 'jogador' ->> 'nome' AS nome, details ->> 'precisao' AS precisao, details ->> 'estrelas' AS estrelas,
          details ->> 'modoPrecisao' AS modo
        FROM game_plays
        WHERE game = 'ocarina' AND customer_email IS NOT NULL AND score IS NOT NULL
          AND details ->> 'chartId' = ${chartId} AND details ->> 'completou' = 'true'
          AND details -> 'jogador' ->> 'nome' IS NOT NULL
        ORDER BY customer_email, score DESC, created_at ASC
      ) por_conta
      ORDER BY CASE WHEN nome = 'Jogador XAN' THEN customer_email ELSE lower(nome) END, score DESC, created_at ASC
    ) melhores
    ORDER BY score DESC, created_at ASC
    LIMIT ${limit}
  `;
  return rows as RecordeJogador[];
}

export type GamePlayStats = { game: string; plays_today: number; plays_7d: number; plays_total: number; players_7d: number };

// Totais por jogo (hoje = dia de Brasília).
export async function getGamePlayStats(): Promise<GamePlayStats[]> {
  const rows = await getSql()`
    SELECT game,
      count(*) FILTER (WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date)::int AS plays_today,
      count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS plays_7d,
      count(*)::int AS plays_total,
      count(DISTINCT coalesce(customer_email, visitor_id)) FILTER (WHERE created_at > now() - interval '7 days')::int AS players_7d
    FROM game_plays GROUP BY game ORDER BY plays_total DESC
  `;
  return rows as GamePlayStats[];
}

// ---------- Feed ----------

export type GamePostRow = {
  id: number;
  game: string;
  mode: string;
  title: string;
  result_text: string;
  comment: string;
  author_name: string;
  author_avatar: string | null;
  customer_email: string;
  likes: number;
  hidden: boolean;
  created_at: Date;
};

export async function insertGamePost(p: {
  game: string;
  mode: string;
  title: string;
  resultText: string;
  comment: string;
  authorName: string;
  authorAvatar: string | null;
  email: string;
}): Promise<GamePostRow> {
  const rows = await getSql()`
    INSERT INTO game_posts (game, mode, title, result_text, comment, author_name, author_avatar, customer_email)
    VALUES (${p.game}, ${p.mode}, ${p.title}, ${p.resultText}, ${p.comment}, ${p.authorName}, ${p.authorAvatar}, ${p.email})
    RETURNING *
  `;
  return rows[0] as GamePostRow;
}

export async function countPostsTodayByEmail(email: string): Promise<number> {
  const rows = await getSql()`
    SELECT count(*)::int AS n FROM game_posts WHERE customer_email = ${email} AND created_at > now() - interval '24 hours'
  `;
  return (rows[0] as { n: number }).n;
}

// Posts visíveis, do mais novo pro mais antigo. beforeId = paginação.
export async function getVisiblePosts(opts: { beforeId?: number | null; game?: string | null; limit?: number }): Promise<GamePostRow[]> {
  const limit = opts.limit ?? 20;
  const before = opts.beforeId ?? null;
  const game = opts.game ?? null;
  const rows = await getSql()`
    SELECT * FROM game_posts
    WHERE hidden = FALSE
      AND (${before}::bigint IS NULL OR id < ${before}::bigint)
      AND (${game}::text IS NULL OR game = ${game}::text)
    ORDER BY id DESC LIMIT ${limit}
  `;
  return rows as GamePostRow[];
}

export async function getAllPostsForAdmin(limit = 300): Promise<GamePostRow[]> {
  const rows = await getSql()`SELECT * FROM game_posts ORDER BY id DESC LIMIT ${limit}`;
  return rows as GamePostRow[];
}

export async function getPostById(id: number): Promise<GamePostRow | null> {
  const rows = await getSql()`SELECT * FROM game_posts WHERE id = ${id}`;
  return (rows[0] as GamePostRow | undefined) ?? null;
}

export async function setPostHidden(id: number, hidden: boolean): Promise<void> {
  await getSql()`UPDATE game_posts SET hidden = ${hidden} WHERE id = ${id}`;
}

export async function deletePost(id: number): Promise<void> {
  await getSql()`DELETE FROM game_posts WHERE id = ${id}`;
}

// Curtir / descurtir. Devolve o estado novo e o total.
export async function toggleLike(postId: number, email: string): Promise<{ liked: boolean; likes: number }> {
  const sql = getSql();
  const removed = await sql`DELETE FROM game_post_likes WHERE post_id = ${postId} AND customer_email = ${email} RETURNING post_id`;
  let liked = false;
  if (removed.length === 0) {
    const added = await sql`
      INSERT INTO game_post_likes (post_id, customer_email) VALUES (${postId}, ${email})
      ON CONFLICT DO NOTHING RETURNING post_id
    `;
    liked = added.length > 0;
  }
  const rows = await sql`
    UPDATE game_posts SET likes = (SELECT count(*) FROM game_post_likes WHERE post_id = ${postId})
    WHERE id = ${postId} RETURNING likes
  `;
  return { liked, likes: (rows[0] as { likes: number } | undefined)?.likes ?? 0 };
}

export async function getLikedPostIds(email: string, ids: number[]): Promise<number[]> {
  if (!ids.length) return [];
  const rows = await getSql()`
    SELECT post_id FROM game_post_likes WHERE customer_email = ${email} AND post_id = ANY(${ids}::bigint[])
  `;
  return rows.map((r) => Number((r as { post_id: number }).post_id));
}
