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
  is_featured: boolean;
  is_bestseller: boolean;
  is_upcoming: boolean;
  archived: boolean;
  created_at: Date; // timestamptz comes back as a real Date, not a string
  updated_at: Date;
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
  is_featured: boolean;
  is_bestseller: boolean;
  is_upcoming: boolean;
}): Promise<Game> {
  const rows = await sql`
    INSERT INTO games (name, price, original_price, image_url, has_badge, badge_text, badge_color, franchise, platform, game_type, is_featured, is_bestseller, is_upcoming)
    VALUES (${data.name}, ${data.price}, ${data.original_price}, ${data.image_url}, ${data.has_badge}, ${data.badge_text}, ${data.badge_color}, ${data.franchise}, ${data.platform}, ${data.game_type}, ${data.is_featured}, ${data.is_bestseller}, ${data.is_upcoming})
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
    is_featured: boolean;
    is_bestseller: boolean;
    is_upcoming: boolean;
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
      is_featured = ${data.is_featured},
      is_bestseller = ${data.is_bestseller},
      is_upcoming = ${data.is_upcoming},
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

export type MusicSettings = { url: string | null; filename: string | null };

export async function getMusicSettings(): Promise<MusicSettings> {
  const rows = await sql`
    SELECT key, value FROM site_settings WHERE key IN ('music_url', 'music_filename')
  `;
  const map = new Map(rows.map((r) => [r.key as string, r.value as string]));
  return { url: map.get('music_url') ?? null, filename: map.get('music_filename') ?? null };
}

export async function setMusicSettings(url: string, filename: string): Promise<void> {
  await sql`
    INSERT INTO site_settings (key, value) VALUES ('music_url', ${url})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  await sql`
    INSERT INTO site_settings (key, value) VALUES ('music_filename', ${filename})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}
