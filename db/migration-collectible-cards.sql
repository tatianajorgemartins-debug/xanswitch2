-- XAN Switch — migração: cards colecionáveis e pontos
-- Rode este script uma vez no editor SQL do seu banco (Neon). É seguro
-- rodar mais de una vez.
--
-- Contexto: toda compra confirmada por Pix agora gera um "card colecionável"
-- do jogo pra conta do cliente, valendo pontos que um dia vão poder ser
-- trocados por desconto (a troca em si ainda não existe — só a contagem).
--
-- games.card_points: quantos pontos o card desse jogo vale (1 a 5),
--   configurável por você no admin.
-- orders.card_points_earned: uma "foto" de games.card_points no momento da
--   compra — assim, se você mudar os pontos do jogo depois, pedidos antigos
--   não mudam de valor retroativamente (mesma lógica já usada pra price e
--   game_name, que também são copiados pro pedido em vez de linkados ao
--   vivo com a tabela games).
-- orders.card_image_url: idem, mas pra capa do jogo — assim o card sempre
--   mostra a imagem de quando foi comprado, mesmo que você troque a capa
--   do jogo (ou até apague o jogo do catálogo) depois.
-- orders.card_points_confirmed: como não existe integração com gateway de
--   pagamento (o "Já paguei" é uma declaração do cliente, não uma
--   confirmação de verdade), os pontos de um pedido só contam pra valer
--   depois que você confirmar manualmente aqui — ver confirmOrderPointsAction
--   em app/admin/actions.ts e o botão correspondente em /admin > Pedidos.

ALTER TABLE games ADD COLUMN IF NOT EXISTS card_points INTEGER NOT NULL DEFAULT 1;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_points_earned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_image_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_points_confirmed BOOLEAN NOT NULL DEFAULT FALSE;
