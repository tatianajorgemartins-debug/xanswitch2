-- XAN Switch — migração: eventos de promoção (/admin > 🏷️ Promoções)
-- Rode este script uma vez no editor SQL do seu banco (Neon). É seguro
-- rodar mais de uma vez.
--
-- Um evento (ex: Black Friday) dá o mesmo desconto pra vários jogos de uma
-- vez, com uma etiqueta própria no site, a partir de uma data/hora (e até
-- outra, se quiser). Ver lib/promoEvents.ts.
--
-- promo_events:
--   - name: nome interno (só você vê)
--   - tag_text / tag_color: a etiqueta que aparece nos jogos (ex: BLACK FRIDAY)
--   - discount_type: 'fixed' (R$ a menos) ou 'percent' (% a menos)
--   - discount_value: o valor do desconto
--   - starts_at / ends_at: quando começa e (opcional) quando termina
--   - enabled: dá pra pausar sem apagar
-- promo_event_games: quais jogos estão em cada evento.

CREATE TABLE IF NOT EXISTS promo_events (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  tag_text TEXT NOT NULL,
  tag_color TEXT NOT NULL DEFAULT '#111111',
  discount_type TEXT NOT NULL DEFAULT 'fixed',
  discount_value NUMERIC(10, 2) NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promo_event_games (
  event_id INTEGER NOT NULL REFERENCES promo_events (id) ON DELETE CASCADE,
  game_id INTEGER NOT NULL,
  PRIMARY KEY (event_id, game_id)
);

CREATE INDEX IF NOT EXISTS promo_event_games_game_idx ON promo_event_games (game_id);
