-- XAN Switch — migração: controle de vendas no admin (/admin > 📊 Vendas)
-- Rode este script uma vez no editor SQL do seu banco (Neon). É seguro
-- rodar mais de uma vez.
--
-- orders ganha:
--   - cost: quanto você pagou pela chave (R$). O lucro é calculado na tela:
--     preço − taxa − custo. Vazio = custo ainda não informado.
--   - fee: taxa extra que saiu do seu bolso nessa venda (R$). Normalmente
--     vazio, porque a taxa do Mercado Pago já é repassada pro cliente.
--   - notes: observação livre sobre a venda.
--   - customer_name: nome ou @ do cliente (usado nas vendas lançadas à mão).
--   - source: 'site' (entrou pelo site) ou 'manual' (lançada no admin).
--   - completed_at: quando a venda foi marcada como concluída.
--
-- E TODAS as vendas que já existem são marcadas como concluídas (status
-- 'concluido'). Nada é apagado: elas continuam guardadas e aparecem no
-- controle de vendas.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS cost NUMERIC(10, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fee NUMERIC(10, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'site';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

UPDATE orders
SET status = 'concluido', completed_at = COALESCE(completed_at, code_sent_at, created_at)
WHERE status IS DISTINCT FROM 'concluido' AND status IS DISTINCT FROM 'cancelado';
