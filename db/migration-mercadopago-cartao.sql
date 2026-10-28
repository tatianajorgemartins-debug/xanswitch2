-- XAN Switch — migração: cartão de crédito pelo Mercado Pago
-- Rode este script uma vez no editor SQL do seu banco (Neon), DEPOIS do
-- db/migration-mercadopago.sql. É seguro rodar mais de uma vez.
--
-- Contexto: além do Pix, o cartão (com parcelas) também passa a ser
-- cobrado pelo Mercado Pago, dentro do próprio site (ver
-- app/CardPaymentStep.tsx). Essa coluna guarda se a cobrança foi Pix ou
-- cartão, pra o pedido criado depois do pagamento sair com a forma certa
-- ('pix' ou 'cartao') — e o admin mostrar o aviso de conferir os pedidos
-- no cartão antes de mandar o código.

ALTER TABLE mp_payments ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'pix';
