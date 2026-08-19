-- XAN Switch — esquema do banco de dados
-- Rode este script uma vez, no painel "Query" do seu banco Postgres na Vercel,
-- antes do primeiro deploy (ou logo depois — pode rodar a qualquer momento).

CREATE TABLE IF NOT EXISTS games (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  original_price NUMERIC(10, 2),
  image_url TEXT,
  has_badge BOOLEAN NOT NULL DEFAULT FALSE,
  badge_text TEXT NOT NULL DEFAULT 'TOP',
  badge_color TEXT NOT NULL DEFAULT '#4ef05f',
  franchise TEXT,
  platform TEXT NOT NULL DEFAULT 'switch2',
  game_type TEXT NOT NULL DEFAULT 'base',
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  sort_name TEXT GENERATED ALWAYS AS (lower(name)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS games_sort_name_idx ON games (sort_name);
CREATE INDEX IF NOT EXISTS games_archived_idx ON games (archived);

-- Se a tabela já existia antes do campo de preço original ser adicionado,
-- esta linha garante que o banco seja atualizado sem perder dados.
ALTER TABLE games ADD COLUMN IF NOT EXISTS original_price NUMERIC(10, 2);
