'use server';

import { createOrder } from '@/lib/db';
import { buildWhatsAppBulkPaymentLink } from '@/lib/whatsapp';

// Chamada quando o cliente chega na etapa de pagamento (QR Code gerado) —
// serve só pra registrar "alguém gerou um Pix pra este jogo, nesta hora"
// no histórico do admin. Não confirma pagamento nenhum (isso é manual, veja
// lib/pix.ts e o PurchaseModal) e não precisa de login: é só um registro de
// intenção de compra, então qualquer cliente pode disparar isso.
export async function logOrderAttempt(gameId: number, gameName: string, price: number): Promise<void> {
  await createOrder({ game_id: gameId, game_name: gameName, price });
}

// Monta o link do WhatsApp da compra em lote (BulkPurchaseModal). Precisa
// ser uma Server Action porque WHATSAPP_NUMBER é uma variável de ambiente
// SEM o prefixo NEXT_PUBLIC_ — ela só existe no servidor. Chamar
// buildWhatsAppBulkPaymentLink direto de dentro de um componente 'use
// client' (como o BulkPurchaseModal) faria essa variável chegar undefined
// no navegador, e a função quebraria a página inteira ao gerar o link.
export async function getBulkWhatsAppLink(
  items: { name: string; price: number }[],
  total: number
): Promise<string> {
  return buildWhatsAppBulkPaymentLink(items, total);
}
