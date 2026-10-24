-- Preço promocional de cada jogo. Quando preenchido com um valor menor que o
-- preço normal, o jogo entra em promoção: esse vira o preço cobrado, o
-- normal aparece riscado e o card ganha o selo "PROMO -X%". Null = sem
-- promoção.
ALTER TABLE games ADD COLUMN IF NOT EXISTS promo_price NUMERIC(10, 2);
