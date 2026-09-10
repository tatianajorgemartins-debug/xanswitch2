-- XAN Switch — migração: descrição e capturas de tela por jogo
-- Rode este script uma vez no editor SQL do seu banco (Neon). É seguro
-- rodar mais de uma vez.

-- Texto livre que aparece no modal de compra, explicando o jogo.
ALTER TABLE games ADD COLUMN IF NOT EXISTS description TEXT;

-- Lista de URLs das imagens (capturas de tela), guardada como JSON.
-- Ex: ["https://.../foto1.png", "https://.../foto2.png"]
ALTER TABLE games ADD COLUMN IF NOT EXISTS screenshots JSONB NOT NULL DEFAULT '[]';
