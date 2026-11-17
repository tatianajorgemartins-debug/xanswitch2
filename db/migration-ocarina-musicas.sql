-- XAN Switch — migração: músicas do Ocarina Hero
-- Rode este script uma vez no editor SQL do seu banco (Neon). É seguro
-- rodar mais de uma vez.
--
-- Cada música que você monta no admin (aba "Ocarina Hero"): o áudio (fica
-- no Supabase Storage, bucket "ocarina-audio", criado sozinho no primeiro
-- envio) e as notas. Só aparece no jogo depois de publicada.

CREATE TABLE IF NOT EXISTS ocarina_songs (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Nova música',
  game TEXT NOT NULL DEFAULT '',          -- de qual jogo é (lista "Por jogo")
  difficulty TEXT NOT NULL DEFAULT 'medio',
  bpm NUMERIC NOT NULL DEFAULT 120,
  beat_offset NUMERIC NOT NULL DEFAULT 0, -- segundo em que cai o 1º tempo
  audio_url TEXT,
  audio_duration NUMERIC,
  audio_bytes INTEGER,
  notes JSONB NOT NULL DEFAULT '[]',      -- [{ "t": 1.25, "pista": "verde", "dur": 0.5 }]
  published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,               -- 1ª publicação (lista "Novas")
  active_from DATE,                       -- entra no sorteio da Música do Dia a partir daqui
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
