-- XAN Switch — migração: e-mail do cliente e status no pedido
-- Rode este script uma vez no editor SQL do seu banco (Neon). É seguro
-- rodar mais de uma vez.
--
-- Contexto: antes, um pedido era só um registro de "alguém gerou um Pix"
-- (sem e-mail, sem status), criado a cada visita à tela de pagamento. Agora,
-- o pedido só é salvo quando o cliente confirma "Já paguei — confirmar
-- pedido", e junto vem o e-mail dele (pra onde o código será enviado
-- depois) e um status, pra você acompanhar o que já foi resolvido.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'aguardando_codigo';
