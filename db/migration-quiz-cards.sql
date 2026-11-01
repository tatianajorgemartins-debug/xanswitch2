-- XAN Switch — migração: card colecionável dos quizzes
-- Rode este script uma vez no editor SQL do seu banco (Neon). É seguro
-- rodar mais de uma vez.
--
-- Contexto: terminar o quiz "Qual Link é você?" (/qual-link) dá um card de
-- 1 ponto, personalizado com o Link que a pessoa tirou — só pra quem está
-- logado, e só UM por conta (a chave primária garante isso). O ponto em si
-- entra como um ajuste em point_adjustments, então já vale pra troca por
-- desconto como os outros.

CREATE TABLE IF NOT EXISTS quiz_cards (
  quiz TEXT NOT NULL,                 -- 'qual-link'
  customer_email TEXT NOT NULL,       -- sempre em minúsculas
  result_id TEXT NOT NULL,            -- o Link que saiu (nes, botw, totk...)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (quiz, customer_email)
);
