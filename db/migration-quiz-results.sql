-- XAN Switch — migração: histórico de resultados dos quizzes
-- Rode este script uma vez no editor SQL do seu banco (Neon). É seguro
-- rodar mais de uma vez.
--
-- Contexto: cada vez que alguém termina um quiz logado (ex.: "Qual Link é
-- você?"), o resultado fica guardado aqui — vários por pessoa, um por
-- jogada. Em "Minha conta → Meus resultados de quiz" a pessoa vê a lista e
-- reabre qualquer um. As respostas ficam salvas pra o resultado completo
-- (afinidade etc.) ser recalculado igualzinho.

CREATE TABLE IF NOT EXISTS quiz_results (
  id SERIAL PRIMARY KEY,
  quiz TEXT NOT NULL,                 -- 'qual-link'
  customer_email TEXT NOT NULL,       -- sempre em minúsculas
  result_id TEXT NOT NULL,            -- o Link que saiu (nes, botw, totk...)
  answers JSONB NOT NULL,             -- a opção escolhida em cada pergunta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quiz_results_email_idx ON quiz_results (customer_email, created_at DESC);
