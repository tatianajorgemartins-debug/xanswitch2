-- XAN Switch — rode isso no editor SQL do SUPABASE (não é o mesmo banco
-- do catálogo, que continua no Neon — este aqui é só do Supabase).
--
-- Projetos gratuitos do Supabase são pausados automaticamente depois de 7
-- dias sem "atividade de banco de dados". Como este projeto usa o Supabase
-- só pra guardar imagens (o Storage), sem nunca consultar o banco de dados
-- dele, corre o risco de ser pausado mesmo com o site recebendo visitas
-- normalmente — pausado, as imagens param de carregar em todo o site.
--
-- Esta tabela existe só pra ter algo bem pequeno pra "cutucar" (inserir uma
-- linha) uma vez por dia via Cron Job da Vercel — veja
-- app/api/cron/keepalive/route.ts e o "crons" no vercel.json.

CREATE TABLE IF NOT EXISTS keepalive (
  id SERIAL PRIMARY KEY,
  pinged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
