-- XAN Switch — migração: registro de pedidos (intenção de compra via Pix)
-- Rode este script uma vez no editor SQL do seu banco (Neon). É seguro
-- rodar mais de uma vez.
--
-- Esta tabela NÃO confirma pagamento nenhum — ela só guarda "alguém gerou um
-- QR Code Pix para este jogo, nesta hora". A confirmação real do pagamento
-- continua manual, vendo o Pix cair na conta e conversando no WhatsApp.

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  game_id INTEGER,
  game_name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC);
