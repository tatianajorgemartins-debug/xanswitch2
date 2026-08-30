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
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_bestseller BOOLEAN NOT NULL DEFAULT FALSE,
  is_upcoming BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  sort_name TEXT GENERATED ALWAYS AS (lower(name)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS games_sort_name_idx ON games (sort_name);
CREATE INDEX IF NOT EXISTS games_archived_idx ON games (archived);

-- Configurações globais do site (chave/valor) — usado hoje pela música do dia.
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Avaliações de clientes (comentário + estrelas), aprovadas manualmente no admin.
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  instagram TEXT,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reviews_approved_idx ON reviews (approved);

-- Se a tabela já existia antes do campo de preço original ser adicionado,
-- esta linha garante que o banco seja atualizado sem perder dados.
ALTER TABLE games ADD COLUMN IF NOT EXISTS original_price NUMERIC(10, 2);
