'use server';

import { createOrder } from '@/lib/db';

// Chamada quando o cliente chega na etapa de pagamento (QR Code gerado) —
// serve só pra registrar "alguém gerou um Pix pra este jogo, nesta hora"
// no histórico do admin. Não confirma pagamento nenhum (isso é manual, veja
// lib/pix.ts e o PurchaseModal) e não precisa de login: é só um registro de
// intenção de compra, então qualquer cliente pode disparar isso.
export async function logOrderAttempt(gameId: number, gameName: string, price: number): Promise<void> {
  await createOrder({ game_id: gameId, game_name: gameName, price });
}
