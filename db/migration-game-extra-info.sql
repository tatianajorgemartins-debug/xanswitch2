-- XAN Switch — migração: idioma, tamanho e nº de jogadores dos jogos
-- Rode este script uma vez no editor SQL do seu banco (Neon). É seguro
-- rodar mais de uma vez.
--
-- Contexto: campos opcionais da ficha técnica na janela do jogo
-- (PurchaseModal.tsx). Vazios, simplesmente não aparecem. Preencha no
-- admin, no formulário de cada jogo.

ALTER TABLE games ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS size_gb NUMERIC(6, 2);
ALTER TABLE games ADD COLUMN IF NOT EXISTS players TEXT;
