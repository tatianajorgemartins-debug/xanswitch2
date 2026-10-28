-- XAN Switch — migração: Pix automático pelo Mercado Pago
-- Rode este script uma vez no editor SQL do seu banco (Neon). É seguro
-- rodar mais de uma vez.
--
-- Contexto: com o Mercado Pago configurado (MP_ACCESS_TOKEN — ver
-- .env.example), cada Pix gerado no site é uma cobrança de verdade lá. O
-- pedido só entra em "Pedidos" DEPOIS que o Mercado Pago avisa que o Pix
-- caiu (ver lib/mercadoPagoOrders.ts) — até lá, tudo que foi escolhido na
-- compra (jogos, preços, e-mail, desconto) fica guardado aqui, em
-- mp_payments. Pix gerado e nunca pago fica só aqui e nunca vira pedido.

CREATE TABLE IF NOT EXISTS mp_payments (
  id TEXT PRIMARY KEY,                -- id do pagamento no Mercado Pago
  status TEXT NOT NULL DEFAULT 'pending',
  total NUMERIC(10, 2) NOT NULL,
  customer_email TEXT NOT NULL,
  referral_source TEXT,
  discount_credit_id INTEGER,
  items JSONB NOT NULL,               -- jogos, preços e card de cada um, já calculados no servidor
  processed_at TIMESTAMPTZ,           -- quando os pedidos foram criados (pagamento aprovado)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pedidos pagos pelo Mercado Pago guardam o id do pagamento, pra você
-- achar a transação no painel do Mercado Pago se precisar.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_payment_id TEXT;
