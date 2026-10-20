-- Categoria dos produtos físicos — texto livre, criado aos poucos conforme
-- você vai cadastrando produtos (igual a "franquia" já funciona pros jogos
-- digitais: digita um nome novo ou escolhe um já usado). Null = produto
-- ainda sem categoria.
ALTER TABLE physical_products ADD COLUMN IF NOT EXISTS category TEXT;
CREATE INDEX IF NOT EXISTS physical_products_category_idx ON physical_products (category);
