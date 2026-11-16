-- XAN Switch — migração: jogos interativos (registro de jogadas + feed)
-- Rode este script uma vez no editor SQL do seu banco (Neon). É seguro
-- rodar mais de uma vez.
--
-- game_plays: cada partida terminada dos jogos da página "Testes" (Silhueta
--   do Dia, Ocarina Hero, Qual Link, Qual será seu próximo jogo). Quem joga
--   sem conta aparece pelo "visitante" (um código aleatório do aparelho);
--   quem está logado, pelo e-mail. Aparece no admin, aba "Jogos interativos".
-- game_posts / game_post_likes: o feed de resultados (/testes/feed). Só quem
--   tem conta publica e curte; o admin pode esconder ou apagar.

CREATE TABLE IF NOT EXISTS game_plays (
  id BIGSERIAL PRIMARY KEY,
  game TEXT NOT NULL,               -- 'silhueta', 'ocarina', 'qual-link', 'proximo-jogo'
  mode TEXT NOT NULL,               -- 'facil', 'medio'... / 'dia', 'livre' / 'treino'
  daily_day DATE,                   -- dia do desafio diário (vazio fora do diário)
  won BOOLEAN,                      -- venceu? (vazio quando não se aplica)
  score INTEGER,                    -- tentativas, pontos ou %
  summary TEXT NOT NULL,            -- resumo legível ("3/5 · Donkey Kong")
  details JSONB NOT NULL DEFAULT '{}',
  customer_email TEXT,              -- quem estava logado (conferido no servidor)
  visitor_id TEXT NOT NULL,         -- código aleatório do aparelho
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS game_plays_created_idx ON game_plays (created_at DESC);
CREATE INDEX IF NOT EXISTS game_plays_game_idx ON game_plays (game, created_at DESC);

CREATE TABLE IF NOT EXISTS game_posts (
  id BIGSERIAL PRIMARY KEY,
  game TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,              -- "Silhueta do Dia #3 · Difícil"
  result_text TEXT NOT NULL,        -- o placar com emojis
  comment TEXT NOT NULL DEFAULT '',
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  customer_email TEXT NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0,
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS game_posts_created_idx ON game_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS game_posts_email_idx ON game_posts (customer_email, created_at DESC);

CREATE TABLE IF NOT EXISTS game_post_likes (
  post_id BIGINT NOT NULL REFERENCES game_posts(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, customer_email)
);
