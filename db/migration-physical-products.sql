-- Segundo catálogo: produtos físicos (parceria com importadora), totalmente
-- separado da tabela "games" (catálogo digital). Nenhuma linha de "games" é
-- tocada por essa migração.
--
-- is_demo marca os produtos de demonstração criados pra testar o layout —
-- dá pra filtrar/excluir todos eles de uma vez (ver db/seed-physical-demo-products.sql).
-- published controla se o produto aparece no catálogo público (/produtos-fisicos),
-- igual "archived" faz pros jogos, só que com o sentido invertido (published=true = visível).
CREATE TABLE IF NOT EXISTS physical_products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  original_price NUMERIC(10, 2),
  image_url TEXT,
  description TEXT,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  sort_name TEXT GENERATED ALWAYS AS (lower(name)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS physical_products_sort_name_idx ON physical_products (sort_name);
CREATE INDEX IF NOT EXISTS physical_products_published_idx ON physical_products (published);
