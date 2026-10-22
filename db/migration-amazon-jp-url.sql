-- Link do jogo na Amazon Japão, onde a loja compra o código. Só aparece no
-- aviso de venda que chega no Telegram (ver lib/notifications.ts) e no
-- admin; nunca vai pro catálogo público. Null = ainda sem link cadastrado.
ALTER TABLE games ADD COLUMN IF NOT EXISTS amazon_jp_url TEXT;
