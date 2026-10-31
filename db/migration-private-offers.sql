-- XAN Switch — migração: links exclusivos (oferta com preço especial)
-- Rode este script uma vez no editor SQL do seu banco (Neon). É seguro
-- rodar mais de uma vez.
--
-- Contexto: no admin (🔗 Links exclusivos) você escolhe um jogo e um preço
-- e o site gera um link /oferta/<token>. Só quem tem o link vê e paga esse
-- preço — o valor é sempre conferido no servidor pelo token, nunca pelo
-- navegador. max_uses = quantas compras o link aceita (NULL = sem limite);
-- uses conta as compras pagas.

CREATE TABLE IF NOT EXISTS private_offers (
  token TEXT PRIMARY KEY,
  game_id INTEGER NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  note TEXT,
  max_uses INTEGER DEFAULT 1,
  uses INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
