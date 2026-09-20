-- XAN Switch — migração: link de pagamento parcelado (crédito) por jogo
-- Rode este script uma vez no editor SQL do seu banco (Neon). É seguro
-- rodar mais de uma vez.
--
-- Contexto: cada jogo pode ter um link de pagamento parcelado configurado
-- manualmente no admin (ex: um link de pagamento do Mercado Pago, PagSeguro
-- etc. que você mesma gera fora do site). Quando esse link existe, o
-- catálogo público mostra dois botões de compra ("Pix à vista" e "Crédito
-- parcelado") em vez de um só; sem o link, continua um botão só, como já
-- era antes.

ALTER TABLE games ADD COLUMN IF NOT EXISTS credit_payment_url TEXT;
