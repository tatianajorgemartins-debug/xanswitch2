-- Preço automático pela Amazon Japão (ver lib/autoPricing.ts e o cron
-- /api/cron/precos). Todo dia de manhã o site lê o preço em ienes de cada
-- jogo na Amazon JP, converte pra reais e garante que o preço de venda fique
-- pelo menos a margem configurada acima do custo (nunca baixa sozinho e
-- nunca passa do preço da eShop brasileira = original_price).
--
-- auto_price: false = o sistema não mexe no preço desse jogo.
-- amazon_yen / amazon_checked_at / amazon_error: o que foi lido na última
-- consulta (só pra mostrar no admin).
ALTER TABLE games ADD COLUMN IF NOT EXISTS auto_price BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE games ADD COLUMN IF NOT EXISTS amazon_yen INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS amazon_checked_at TIMESTAMPTZ;
ALTER TABLE games ADD COLUMN IF NOT EXISTS amazon_error TEXT;
