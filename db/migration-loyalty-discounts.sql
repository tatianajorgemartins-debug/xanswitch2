-- XAN Switch — migração: ajustes manuais de pontos e troca por desconto
-- Rode este script uma vez no editor SQL do seu banco (Neon). É seguro
-- rodar mais de uma vez.
--
-- games.discount_eligible: jogos marcados no admin como "aceita desconto de
--   pontos" — só nesses jogos o cliente pode usar um desconto de R$20 na
--   hora de pagar.
--
-- point_adjustments: um "livro-razão" de ajustes manuais de pontos — tanto
--   os que você faz direto no admin (em "🎖️ Clientes") quanto os que o
--   próprio sistema faz quando o cliente troca 5 pontos por um desconto
--   (um lançamento de -5 pontos). O total de pontos de um cliente é a soma
--   dos pontos confirmados dos pedidos (orders.card_points_earned onde
--   card_points_confirmed = true) MAIS a soma de todos os ajustes daqui.
--
-- discount_credits: cada troca de 5 pontos gera uma linha aqui (R$20,
--   status 'available'). Quando o cliente usa esse desconto numa compra,
--   o status vira 'used' e used_order_id aponta pro pedido em que foi usado.
--
-- orders.discount_applied: quanto de desconto (em R$) foi usado nesse
--   pedido específico — fica registrado no histórico mesmo que o crédito
--   de desconto original seja apagado depois.

ALTER TABLE games ADD COLUMN IF NOT EXISTS discount_eligible BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS point_adjustments (
  id SERIAL PRIMARY KEY,
  customer_email TEXT NOT NULL,
  points INTEGER NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS point_adjustments_email_idx ON point_adjustments (customer_email);

CREATE TABLE IF NOT EXISTS discount_credits (
  id SERIAL PRIMARY KEY,
  customer_email TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 20,
  status TEXT NOT NULL DEFAULT 'available',
  used_order_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS discount_credits_email_idx ON discount_credits (customer_email);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_applied NUMERIC(10, 2) NOT NULL DEFAULT 0;
