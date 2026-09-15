'use server';

import { createOrder } from '@/lib/db';
import { notifyNewOrder } from '@/lib/notifications';
import { isValidEmail } from '@/lib/validation';

export type ConfirmOrderResult = { ok: true } | { ok: false; error: string };

// Chamada quando o cliente clica em "Já paguei — confirmar pedido" na tela
// do Pix (um jogo por vez — ver PurchaseModal.tsx). Como não há gateway de
// pagamento, isso é uma declaração do próprio cliente, não uma confirmação
// automática de que o Pix caiu na conta — exatamente como já era antes,
// só que agora fica registrado com e-mail e é avisado automaticamente
// (ver lib/notifications.ts) em vez de depender de abrir o WhatsApp.
export async function confirmOrderAction(
  gameId: number | null,
  gameName: string,
  price: number,
  email: string
): Promise<ConfirmOrderResult> {
  const trimmedEmail = email.trim();
  if (!isValidEmail(trimmedEmail)) {
    return { ok: false, error: 'Digite um e-mail válido.' };
  }

  try {
    await createOrder({ game_id: gameId, game_name: gameName, price, customer_email: trimmedEmail });
  } catch {
    return { ok: false, error: 'Não foi possível registrar seu pedido agora. Tente novamente em instantes.' };
  }

  // O pedido já está salvo no banco nesse ponto — se a notificação falhar
  // (e-mail fora do ar, CallMeBot indisponível etc.), o pedido continua
  // valendo e visível em /admin > Pedidos, então não há por que travar a
  // tela do cliente esperando ou tratando erro aqui.
  await notifyNewOrder({ items: [{ gameName, price }], total: price, customerEmail: trimmedEmail });

  return { ok: true };
}

// Mesma ideia de confirmOrderAction, só que pra quando o cliente compra
// vários jogos de uma vez pela lista de desejos (ver BulkPurchaseModal.tsx)
// — um registro de pedido por jogo (assim cada um aparece separado em
// "📋 Pedidos" no admin), mas um único aviso cobrindo a lista inteira.
export async function confirmBulkOrderAction(
  items: { id: number | null; name: string; price: number }[],
  total: number,
  email: string
): Promise<ConfirmOrderResult> {
  const trimmedEmail = email.trim();
  if (!isValidEmail(trimmedEmail)) {
    return { ok: false, error: 'Digite um e-mail válido.' };
  }

  try {
    await Promise.all(
      items.map((it) =>
        createOrder({ game_id: it.id, game_name: it.name, price: it.price, customer_email: trimmedEmail })
      )
    );
  } catch {
    return { ok: false, error: 'Não foi possível registrar seu pedido agora. Tente novamente em instantes.' };
  }

  await notifyNewOrder({
    items: items.map((it) => ({ gameName: it.name, price: it.price })),
    total,
    customerEmail: trimmedEmail
  });

  return { ok: true };
}
