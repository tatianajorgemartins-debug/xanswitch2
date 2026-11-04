-- XAN Switch — migração: entrega da chave do jogo pelo admin (e-mail ou WhatsApp)
-- Rode este script uma vez no editor SQL do seu banco (Neon). É seguro
-- rodar mais de uma vez.
--
-- Contexto: em /admin > Pedidos, cada pedido tem a mensagem pro cliente já
-- montada (jogo, valor, passo a passo de resgate). Você só cola a chave e
-- envia (ver sendGameCodeAction e markCodeSentByWhatsAppAction em
-- app/admin/actions.ts). Na compra, o cliente pode informar o WhatsApp
-- (opcional): se informou, a chave vai pelo WhatsApp; se não, por e-mail.
--
-- orders:
--   - customer_whatsapp: WhatsApp informado na compra (só números, com 55
--     na frente), ou vazio se o cliente não informou;
--   - delivered_code: a chave que foi enviada (pra conferir depois, se o
--     cliente disser que não recebeu);
--   - code_sent_at: quando foi enviada;
--   - code_sent_via: 'email' ou 'whatsapp'.
-- mp_payments:
--   - customer_whatsapp: o mesmo WhatsApp, guardado na cobrança do Mercado
--     Pago até o pagamento cair e o pedido ser criado.
--
-- O site funciona normalmente mesmo antes desta migração: só não guarda o
-- WhatsApp nem marca o pedido como entregue.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_whatsapp TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS code_sent_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS code_sent_via TEXT;

ALTER TABLE mp_payments ADD COLUMN IF NOT EXISTS customer_whatsapp TEXT;
