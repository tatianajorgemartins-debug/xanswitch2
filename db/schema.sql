-- XAN Switch — esquema do banco de dados
-- Rode este script uma vez, no painel "Query" do seu banco Postgres na Vercel,
-- antes do primeiro deploy (ou logo depois — pode rodar a qualquer momento).

CREATE TABLE IF NOT EXISTS games (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  original_price NUMERIC(10, 2),
  image_url TEXT,
  has_badge BOOLEAN NOT NULL DEFAULT FALSE,
  badge_text TEXT NOT NULL DEFAULT 'TOP',
  badge_color TEXT NOT NULL DEFAULT '#4ef05f',
  franchise TEXT,
  platform TEXT NOT NULL DEFAULT 'switch2',
  game_type TEXT NOT NULL DEFAULT 'base',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_bestseller BOOLEAN NOT NULL DEFAULT FALSE,
  is_upcoming BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  screenshots JSONB NOT NULL DEFAULT '[]',
  credit_payment_url TEXT,
  card_points INTEGER NOT NULL DEFAULT 1,
  discount_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  sort_name TEXT GENERATED ALWAYS AS (lower(name)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS games_sort_name_idx ON games (sort_name);
CREATE INDEX IF NOT EXISTS games_archived_idx ON games (archived);

-- Configurações globais do site (chave/valor) — usado hoje pela música do dia.
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Avaliações de clientes (comentário + estrelas), aprovadas manualmente no admin.
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  instagram TEXT,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reviews_approved_idx ON reviews (approved);

-- Registro de pedidos: uma linha é salva aqui quando o cliente confirma
-- "Já paguei — confirmar pedido" no modal de compra. Como não existe
-- gateway de pagamento, isso é uma declaração do próprio cliente, não uma
-- confirmação automática de que o Pix caiu na conta. customer_email é pra
-- onde o código será enviado depois; status guarda em que pé está o
-- atendimento (padrão: 'aguardando_codigo').
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  game_id INTEGER,
  game_name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  customer_email TEXT,
  status TEXT NOT NULL DEFAULT 'aguardando_codigo',
  referral_source TEXT,
  payment_method TEXT NOT NULL DEFAULT 'pix',
  card_points_earned INTEGER NOT NULL DEFAULT 0,
  card_image_url TEXT,
  card_points_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  discount_applied NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC);

-- Ajustes manuais de pontos (admin) e trocas de pontos por desconto — ver
-- db/migration-loyalty-discounts.sql pra explicação completa.
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

-- Se a tabela já existia antes do campo de preço original ser adicionado,
-- esta linha garante que o banco seja atualizado sem perder dados.
ALTER TABLE games ADD COLUMN IF NOT EXISTS original_price NUMERIC(10, 2);

-- Idem para descrição e capturas de tela (ver db/migration-game-details.sql).
ALTER TABLE games ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS screenshots JSONB NOT NULL DEFAULT '[]';

-- Idem para e-mail do cliente e status do pedido (ver
-- db/migration-orders-checkout-v2.sql).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'aguardando_codigo';

-- Idem para o link de pagamento parcelado (ver
-- db/migration-credit-payment-link.sql).
ALTER TABLE games ADD COLUMN IF NOT EXISTS credit_payment_url TEXT;

-- Idem para "como você conheceu a loja" (ver
-- db/migration-order-referral-source.sql).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS referral_source TEXT;

-- Idem para a forma de pagamento do pedido (ver
-- db/migration-order-payment-method.sql).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'pix';

-- Idem para os cards colecionáveis e pontos (ver
-- db/migration-collectible-cards.sql).
ALTER TABLE games ADD COLUMN IF NOT EXISTS card_points INTEGER NOT NULL DEFAULT 1;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_points_earned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_image_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_points_confirmed BOOLEAN NOT NULL DEFAULT FALSE;

-- Idem para a troca de pontos por desconto (ver
-- db/migration-loyalty-discounts.sql).
ALTER TABLE games ADD COLUMN IF NOT EXISTS discount_eligible BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_applied NUMERIC(10, 2) NOT NULL DEFAULT 0;
