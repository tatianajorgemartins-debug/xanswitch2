import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export type Platform = 'switch1' | 'switch2' | 'both';
export type GameType = 'base' | 'dlc' | 'update';

export type Game = {
  id: number;
  name: string;
  price: string; // numeric comes back as string from postgres
  original_price: string | null;
  image_url: string | null;
  has_badge: boolean;
  badge_text: string;
  badge_color: string;
  franchise: string | null;
  platform: Platform;
  game_type: GameType;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export async function getActiveGames(): Promise<Game[]> {
  const rows = await sql`
    SELECT * FROM games WHERE archived = FALSE ORDER BY sort_name ASC
  `;
  return rows as Game[];
}

export async function getAllGames(): Promise<Game[]> {
  const rows = await sql`
    SELECT * FROM games ORDER BY archived ASC, sort_name ASC
  `;
  return rows as Game[];
}

export async function getGameById(id: number): Promise<Game | null> {
  const rows = await sql`SELECT * FROM games WHERE id = ${id}`;
  return (rows[0] as Game) ?? null;
}

export async function createGame(data: {
  name: string;
  price: number;
  original_price: number | null;
  image_url: string | null;
  has_badge: boolean;
  badge_text: string;
  badge_color: string;
  franchise: string | null;
  platform: Platform;
  game_type: GameType;
}): Promise<Game> {
  const rows = await sql`
    INSERT INTO games (name, price, original_price, image_url, has_badge, badge_text, badge_color, franchise, platform, game_type)
    VALUES (${data.name}, ${data.price}, ${data.original_price}, ${data.image_url}, ${data.has_badge}, ${data.badge_text}, ${data.badge_color}, ${data.franchise}, ${data.platform}, ${data.game_type})
    RETURNING *
  `;
  return rows[0] as Game;
}

export async function updateGame(
  id: number,
  data: {
    name: string;
    price: number;
    original_price: number | null;
    image_url: string | null;
    has_badge: boolean;
    badge_text: string;
    badge_color: string;
    franchise: string | null;
    platform: Platform;
    game_type: GameType;
  }
): Promise<Game> {
  const rows = await sql`
    UPDATE games SET
      name = ${data.name},
      price = ${data.price},
      original_price = ${data.original_price},
      image_url = ${data.image_url},
      has_badge = ${data.has_badge},
      badge_text = ${data.badge_text},
      badge_color = ${data.badge_color},
      franchise = ${data.franchise},
      platform = ${data.platform},
      game_type = ${data.game_type},
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] as Game;
}

export async function setArchived(id: number, archived: boolean): Promise<void> {
  await sql`UPDATE games SET archived = ${archived}, updated_at = now() WHERE id = ${id}`;
}

export async function deleteGame(id: number): Promise<void> {
  await sql`DELETE FROM games WHERE id = ${id}`;
}
