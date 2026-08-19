-- XAN Switch — migração: franquia, plataforma e tipo de jogo
-- Rode este script uma vez no editor SQL do seu banco (Neon). É seguro
-- rodar mais de uma vez — não apaga nem altera dados já existentes, só
-- adiciona as colunas novas (com valor padrão pros jogos já cadastrados).

ALTER TABLE games ADD COLUMN IF NOT EXISTS franchise TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'switch2';
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_type TEXT NOT NULL DEFAULT 'base';
