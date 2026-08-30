-- XAN Switch — migração: avaliações de clientes (comentários + estrelas)
-- Rode este script uma vez no editor SQL do seu banco (Neon). É seguro
-- rodar mais de uma vez.

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
