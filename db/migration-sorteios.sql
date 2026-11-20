-- XAN Switch — migração: sorteios ao vivo (ex: live do The Game Awards)
-- Rode este script uma vez no editor SQL do seu banco (Neon). É seguro
-- rodar mais de uma vez. Ver SORTEIO-README.md.

-- O sorteio: link (slug), textos, regras antifraude e a situação.
CREATE TABLE IF NOT EXISTS raffles (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,                    -- /sorteio/<slug>
  title TEXT NOT NULL DEFAULT 'Novo sorteio',
  description TEXT NOT NULL DEFAULT '',
  rules TEXT NOT NULL DEFAULT '',               -- regulamento
  event_at TIMESTAMPTZ,                         -- data da live (só informativo)
  banner_url TEXT,
  winner_message TEXT NOT NULL DEFAULT '',      -- o que o ganhador vê na página dele
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'abertas', 'encerradas', 'sorteando', 'finalizado')),
  test_mode BOOLEAN NOT NULL DEFAULT FALSE,     -- ensaio: deixa resetar e gerar participantes fictícios
  ip_limit INTEGER DEFAULT 3,                   -- participações por IP (vazio = sem limite)
  block_same_device BOOLEAN NOT NULL DEFAULT TRUE,
  accounts_created_before TIMESTAMPTZ,          -- só contas criadas antes disso (vazio = qualquer conta)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prêmios de cada sorteio, na ordem em que são sorteados.
CREATE TABLE IF NOT EXISTS raffle_prizes (
  id SERIAL PRIMARY KEY,
  raffle_id INTEGER NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  winners_count INTEGER NOT NULL DEFAULT 1 CHECK (winners_count BETWEEN 1 AND 100),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS raffle_prizes_raffle_idx ON raffle_prizes (raffle_id, sort_order);

-- Participações: uma por conta em cada sorteio (garantido pelo UNIQUE).
CREATE TABLE IF NOT EXISTS raffle_entries (
  id SERIAL PRIMARY KEY,
  raffle_id INTEGER NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,                        -- id da conta da loja (Supabase)
  email TEXT NOT NULL,
  name TEXT,
  public_id UUID NOT NULL DEFAULT gen_random_uuid(),  -- código público (nunca o e-mail)
  ip TEXT,
  user_agent TEXT,
  device_id TEXT,
  is_test BOOLEAN NOT NULL DEFAULT FALSE,       -- participante fictício do modo de teste
  disqualified BOOLEAN NOT NULL DEFAULT FALSE,
  disqualified_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (raffle_id, user_id)
);
CREATE INDEX IF NOT EXISTS raffle_entries_ip_idx ON raffle_entries (raffle_id, ip);
CREATE INDEX IF NOT EXISTS raffle_entries_device_idx ON raffle_entries (raffle_id, device_id);

-- Cada sorteio feito (histórico/auditoria). Re-sortear anula o anterior
-- (voided) e cria um novo pra mesma vaga do prêmio.
CREATE TABLE IF NOT EXISTS raffle_draws (
  id SERIAL PRIMARY KEY,
  raffle_id INTEGER NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  prize_id INTEGER NOT NULL REFERENCES raffle_prizes(id) ON DELETE CASCADE,
  slot INTEGER NOT NULL,                        -- 1º, 2º... ganhador do prêmio
  entry_id INTEGER NOT NULL REFERENCES raffle_entries(id) ON DELETE CASCADE,
  triggered_by TEXT NOT NULL DEFAULT 'admin',
  is_redraw BOOLEAN NOT NULL DEFAULT FALSE,
  replaced_draw_id INTEGER,
  voided BOOLEAN NOT NULL DEFAULT FALSE,
  voided_reason TEXT,
  started_at TIMESTAMPTZ NOT NULL,              -- quando a animação começa (igual pra todo mundo)
  duration_ms INTEGER NOT NULL,
  reel JSONB NOT NULL DEFAULT '[]',             -- nomes que passam na roleta, o ganhador por último
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Ninguém ganha duas vezes no mesmo sorteio (nem depois de anulado).
CREATE UNIQUE INDEX IF NOT EXISTS raffle_draws_entry_uniq ON raffle_draws (raffle_id, entry_id);
-- Cada vaga de prêmio tem um ganhador valendo por vez.
CREATE UNIQUE INDEX IF NOT EXISTS raffle_draws_slot_uniq ON raffle_draws (prize_id, slot) WHERE NOT voided;

-- Tentativas de confirmar presença (limite de pedidos por minuto).
CREATE TABLE IF NOT EXISTS raffle_attempts (
  id BIGSERIAL PRIMARY KEY,
  raffle_id INTEGER NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  ip TEXT,
  user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS raffle_attempts_idx ON raffle_attempts (raffle_id, created_at DESC);

-- @ do Instagram de quem participa (obrigatório pra confirmar presença),
-- um por sorteio. O mesmo está em db/migration-sorteios-instagram.sql.
ALTER TABLE raffle_entries ADD COLUMN IF NOT EXISTS instagram TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS raffle_entries_instagram_uniq ON raffle_entries (raffle_id, instagram) WHERE instagram IS NOT NULL;
