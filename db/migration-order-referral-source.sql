-- XAN Switch — migração: "como você conheceu a loja" no pedido
-- Rode este script uma vez no editor SQL do seu banco (Neon). É seguro
-- rodar mais de uma vez.
--
-- Contexto: na tela de pagamento (Pix), o cliente pode marcar, de forma
-- opcional, por onde conheceu a XAN Switch (Zelda Brasil, Nintendólatras,
-- Instagram da loja ou Outro). Essa resposta fica salva junto do pedido e
-- aparece no admin, em "📋 Pedidos".

ALTER TABLE orders ADD COLUMN IF NOT EXISTS referral_source TEXT;
