import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export type Game = {
  id: number;
  name: string;
  price: string; // numeric comes back as string from postgres
  image_url: string | null;
  has_badge: boolean;
  badge_text: string;
  badge_color: string;
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
  image_url: string | null;
  has_badge: boolean;
  badge_text: string;
  badge_color: string;
}): Promise<Game> {
  const rows = await sql`
    INSERT INTO games (name, price, image_url, has_badge, badge_text, badge_color)
    VALUES (${data.name}, ${data.price}, ${data.image_url}, ${data.has_badge}, ${data.badge_text}, ${data.badge_color})
    RETURNING *
  `;
  return rows[0] as Game;
}

export async function updateGame(
  id: number,
  data: {
    name: string;
    price: number;
    image_url: string | null;
    has_badge: boolean;
    badge_text: string;
    badge_color: string;
  }
): Promise<Game> {
  const rows = await sql`
    UPDATE games SET
      name = ${data.name},
      price = ${data.price},
      image_url = ${data.image_url},
      has_badge = ${data.has_badge},
      badge_text = ${data.badge_text},
      badge_color = ${data.badge_color},
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
