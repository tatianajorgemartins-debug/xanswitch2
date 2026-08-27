-- XAN Switch — migração: flags de destaque pros banners promocionais
-- Rode este script uma vez no editor SQL do seu banco (Neon). É seguro
-- rodar mais de uma vez — não apaga nem altera jogos já cadastrados,
-- todos ficam com as flags desligadas (FALSE) até você marcar no admin.

ALTER TABLE games ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE games ADD COLUMN IF NOT EXISTS is_bestseller BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE games ADD COLUMN IF NOT EXISTS is_upcoming BOOLEAN NOT NULL DEFAULT FALSE;
