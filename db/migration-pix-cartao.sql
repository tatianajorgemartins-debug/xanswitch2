-- XAN Switch — migração: pagar um jogo com Pix + cartão
-- Rode este script uma vez no editor SQL do seu banco (Neon), DEPOIS do
-- db/migration-mercadopago-cartao.sql. É seguro rodar mais de uma vez.
--
-- Contexto: o cliente pode pagar uma parte do jogo no Pix e o resto no
-- cartão. São duas cobranças no Mercado Pago (uma de cada), as duas com
-- payment_method = 'pix+cartao' em mp_payments:
--   - a do Pix guarda em split_pix_part quanto do preço do jogo foi pago
--     no Pix (o resto vai pro cartão);
--   - a do cartão guarda em split_pix_id o id da cobrança do Pix que ela
--     completa.
-- O pedido só é criado quando as DUAS estão pagas (ver
-- lib/mercadoPagoOrders.ts).

ALTER TABLE mp_payments ADD COLUMN IF NOT EXISTS split_pix_part NUMERIC(10, 2);
ALTER TABLE mp_payments ADD COLUMN IF NOT EXISTS split_pix_id TEXT;
