-- XAN Switch — migração: forma de pagamento no pedido (Pix ou crédito)
-- Rode este script uma vez no editor SQL do seu banco (Neon). É seguro
-- rodar mais de uma vez.
--
-- Contexto: agora um pedido também é registrado quando o cliente clica em
-- "Continuar pro pagamento" no caminho de crédito parcelado (antes de abrir
-- o link externo) — não só quando confirma "Já paguei" no Pix. Esse pedido
-- não tem e-mail (esse caminho não pede e-mail), então payment_method é o
-- jeito de diferenciar os dois tipos de pedido na lista do admin.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'pix';
