'use server';

import { createOrder, getGameById, getAvailableDiscountCredit, markDiscountCreditUsed } from '@/lib/db';
import { notifyNewOrder } from '@/lib/notifications';
import { isValidEmail, isValidReferralSource } from '@/lib/validation';
import { verifyAccessToken } from '@/lib/supabaseAuthServer';

export type ConfirmOrderResult = { ok: true } | { ok: false; error: string };

// "Outro" (ou qualquer valor fora da lista) vira null — a resposta é
// sempre opcional, então um valor inesperado (ex: alguém chamando a Server
// Action diretamente) só é ignorado, nunca barra o pedido.
function sanitizeReferralSource(value: string | null): string | null {
  return value && isValidReferralSource(value) ? value : null;
}

// Busca, direto no banco (não confia no que o navegador mandou), os dados
// do jogo no momento da compra: quantos pontos o card vale, qual é a capa
// atual, e se esse jogo aceita desconto de fidelidade. Assim o pedido
// sempre reflete o jogo de verdade, mesmo que o cliente tenha ficado com a
// tela aberta um tempo antes de confirmar. Se o jogo não existir mais
// (raro — foi excluído do catálogo nesse meio tempo), o pedido é salvo sem
// card e sem desconto em vez de falhar o pedido inteiro por causa disso.
async function snapshotGameForOrder(
  gameId: number | null
): Promise<{ points: number; imageUrl: string | null; discountEligible: boolean }> {
  if (!gameId) return { points: 0, imageUrl: null, discountEligible: false };
  const game = await getGameById(gameId);
  if (!game) return { points: 0, imageUrl: null, discountEligible: false };
  return { points: game.card_points, imageUrl: game.image_url, discountEligible: game.discount_eligible };
}

// Chamada quando o cliente clica em "Já paguei — confirmar pedido" na tela
// do Pix (um jogo por vez — ver PurchaseModal.tsx). Como não há gateway de
// pagamento, isso é uma declaração do próprio cliente, não uma confirmação
// automática de que o Pix caiu na conta — exatamente como já era antes,
// só que agora fica registrado com e-mail e é avisado automaticamente
// (ver lib/notifications.ts) em vez de depender de abrir o WhatsApp.
//
// applyDiscount + accessToken: se o cliente escolheu usar um desconto de
// fidelidade (ver a etapa de desconto em StepPayment), confirmamos de novo
// aqui, no servidor, que o token é válido e que existe mesmo um crédito
// disponível pra essa conta — nunca confiamos só no que o navegador falou
// que "tem desconto".
export async function confirmOrderAction(
  gameId: number | null,
  gameName: string,
  price: number,
  email: string,
  referralSource: string | null,
  applyDiscount: boolean,
  accessToken: string | null
): Promise<ConfirmOrderResult> {
  const trimmedEmail = email.trim();
  if (!isValidEmail(trimmedEmail)) {
    return { ok: false, error: 'Digite um e-mail válido.' };
  }

  const game = await snapshotGameForOrder(gameId);

  let finalPrice = price;
  let discountApplied = 0;
  let creditIdToMark: number | null = null;

  if (applyDiscount && game.discountEligible) {
    const verifiedEmail = await verifyAccessToken(accessToken);
    if (verifiedEmail && verifiedEmail.toLowerCase() === trimmedEmail.toLowerCase()) {
      const credit = await getAvailableDiscountCredit(verifiedEmail);
      if (credit) {
        discountApplied = Math.min(price, parseFloat(credit.amount));
        finalPrice = Math.max(0, price - discountApplied);
        creditIdToMark = credit.id;
      }
    }
  }

  let order;
  try {
    order = await createOrder({
      game_id: gameId,
      game_name: gameName,
      price: finalPrice,
      customer_email: trimmedEmail,
      referral_source: sanitizeReferralSource(referralSource),
      payment_method: 'pix',
      card_points_earned: game.points,
      card_image_url: game.imageUrl,
      discount_applied: discountApplied
    });
  } catch {
    return { ok: false, error: 'Não foi possível registrar seu pedido agora. Tente novamente em instantes.' };
  }

  if (creditIdToMark) {
    await markDiscountCreditUsed(creditIdToMark, order.id).catch(() => {});
  }

  // O pedido já está salvo no banco nesse ponto — se a notificação falhar
  // (e-mail fora do ar, CallMeBot indisponível etc.), o pedido continua
  // valendo e visível em /admin > Pedidos, então não há por que travar a
  // tela do cliente esperando ou tratando erro aqui.
  await notifyNewOrder({ items: [{ gameName, price: finalPrice }], total: finalPrice, customerEmail: trimmedEmail });

  return { ok: true };
}

// Mesma ideia de confirmOrderAction, só que pra quando o cliente compra
// vários jogos de uma vez pela lista de desejos (ver BulkPurchaseModal.tsx)
// — um registro de pedido por jogo (assim cada um aparece separado em
// "📋 Pedidos" no admin), mas um único aviso cobrindo a lista inteira.
// Por enquanto essa compra em lote não aceita desconto de fidelidade — como
// cada jogo pode ou não ser elegível, aplicar um desconto só numa parte do
// carrinho complicaria bastante a conta; fica pra uma próxima versão.
export async function confirmBulkOrderAction(
  items: { id: number | null; name: string; price: number }[],
  total: number,
  email: string,
  referralSource: string | null
): Promise<ConfirmOrderResult> {
  const trimmedEmail = email.trim();
  if (!isValidEmail(trimmedEmail)) {
    return { ok: false, error: 'Digite um e-mail válido.' };
  }
  const sanitizedReferralSource = sanitizeReferralSource(referralSource);

  try {
    await Promise.all(
      items.map(async (it) => {
        const game = await snapshotGameForOrder(it.id);
        return createOrder({
          game_id: it.id,
          game_name: it.name,
          price: it.price,
          customer_email: trimmedEmail,
          referral_source: sanitizedReferralSource,
          payment_method: 'pix',
          card_points_earned: game.points,
          card_image_url: game.imageUrl,
          discount_applied: 0
        });
      })
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

// Chamada quando o cliente clica em "Continuar pro pagamento" no caminho de
// crédito parcelado, um instante antes do link externo abrir (ver
// StepSummary em PurchaseModal.tsx). Esse caminho não pede e-mail — o
// pagamento em si acontece inteiramente fora do site, no link que você
// configurou — então aqui só registra a intenção (jogo, preço e "como
// conheceu a loja", se respondido) pra aparecer em /admin > Pedidos.
// Silenciosa de propósito: se o registro falhar, não faz sentido travar
// nem avisar o cliente, que já está de saída pra pagar em outro site.
export async function logCreditLinkClickAction(
  gameId: number | null,
  gameName: string,
  price: number,
  referralSource: string | null
): Promise<void> {
  await createOrder({
    game_id: gameId,
    game_name: gameName,
    price,
    customer_email: null,
    referral_source: sanitizeReferralSource(referralSource),
    payment_method: 'credito',
    // Sem card nem desconto nesse caminho: esse pedido não tem e-mail,
    // então não tem como saber a qual conta de cliente pertenceria.
    card_points_earned: 0,
    card_image_url: null,
    discount_applied: 0
  }).catch(() => {});
}
