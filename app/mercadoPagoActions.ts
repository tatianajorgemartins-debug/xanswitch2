'use server';

// Pix e cartão pelo Mercado Pago — as ações que a tela de pagamento usa
// (PurchaseModal.tsx, BulkPurchaseModal.tsx e CardPaymentStep.tsx):
//
// 1. startPixPaymentAction / startBulkPixPaymentAction: cria a cobrança no
//    Mercado Pago e devolve o QR Code. O valor é calculado AQUI, a partir
//    do banco (preço, promoção, desconto de fidelidade) — nunca a partir do
//    preço que o navegador mandou.
// 2. checkPixPaymentAction: a tela chama a cada poucos segundos; quando o
//    Pix cai, o pedido é criado (ver lib/mercadoPagoOrders.ts) e a tela
//    avança sozinha pro card — sem o "Já paguei".
// 3. payWithCardAction: cobra no cartão com o "token" que o formulário do
//    Mercado Pago gerou no navegador; a resposta já vem decidida na hora.
//
// Sem MP_ACCESS_TOKEN configurado, as ações de início devolvem
// { mode: 'static' } e a tela segue no Pix de sempre (lib/pix.ts).
import { randomUUID } from 'crypto';
import {
  getAvailableDiscountCredit,
  getGameById,
  createMpPaymentRecord,
  setMpPaymentReferralSource,
  type Game,
  type MpPaymentItem
} from '@/lib/db';
import { createCardPayment, createPixPayment, isMercadoPagoEnabled, type CardInput } from '@/lib/mercadoPago';
import { syncMercadoPagoPayment, type PixCheckStatus } from '@/lib/mercadoPagoOrders';
import { gamePrice } from '@/lib/gamePrice';
import { isValidEmail, isValidReferralSource } from '@/lib/validation';
import { verifyAccessToken } from '@/lib/supabaseAuthServer';

export type StartPixResult =
  | { mode: 'static' }
  | { mode: 'mercadopago'; paymentId: string; brCode: string; qrCodeImage: string }
  | { mode: 'error'; error: string };

const GENERIC_ERROR = 'Não foi possível gerar o Pix agora. Tente de novo em instantes.';

async function loadGame(gameId: number): Promise<Game | null> {
  const game = await getGameById(gameId).catch(() => null);
  return game && !game.archived ? game : null;
}

function gameToPaymentItem(game: Game): MpPaymentItem {
  return {
    gameId: game.id,
    gameName: game.name,
    price: gamePrice(game).price,
    discountApplied: 0,
    cardPoints: game.card_points,
    cardImageUrl: game.image_url,
    amazonJpUrl: game.amazon_jp_url
  };
}

async function createCharge(
  items: MpPaymentItem[],
  email: string,
  discountCreditId: number | null
): Promise<StartPixResult> {
  const total = Math.round(items.reduce((sum, it) => sum + it.price, 0) * 100) / 100;
  // Desconto cobrindo o jogo inteiro (ou valor quebrado demais pra cobrar):
  // não tem o que cobrar no Mercado Pago, segue o caminho de sempre.
  if (total < 1) return { mode: 'static' };

  try {
    const charge = await createPixPayment({
      amount: total,
      payerEmail: email,
      externalReference: randomUUID()
    });
    await createMpPaymentRecord({
      id: charge.id,
      total,
      customer_email: email,
      discount_credit_id: discountCreditId,
      items,
      payment_method: 'pix'
    });
    return {
      mode: 'mercadopago',
      paymentId: charge.id,
      brCode: charge.qrCode,
      qrCodeImage: `data:image/png;base64,${charge.qrCodeBase64}`
    };
  } catch (err) {
    console.error('[mercadopago] Falha ao criar Pix:', err);
    return { mode: 'error', error: GENERIC_ERROR };
  }
}

// Um jogo só. applyDiscount + accessToken: mesma conferência do
// confirmOrderAction (app/orderActions.ts) — o desconto de fidelidade só
// vale se o token for válido, for do mesmo e-mail e existir crédito.
export async function startPixPaymentAction(
  gameId: number,
  email: string,
  applyDiscount: boolean,
  accessToken: string | null
): Promise<StartPixResult> {
  if (!isMercadoPagoEnabled()) return { mode: 'static' };
  const trimmedEmail = email.trim();
  if (!isValidEmail(trimmedEmail)) return { mode: 'error', error: 'Digite um e-mail válido.' };

  const game = await loadGame(gameId);
  if (!game) return { mode: 'error', error: 'Esse jogo não está mais disponível.' };
  const item = gameToPaymentItem(game);

  let discountCreditId: number | null = null;
  if (applyDiscount && game.discount_eligible) {
    const verifiedEmail = await verifyAccessToken(accessToken);
    if (verifiedEmail && verifiedEmail.toLowerCase() === trimmedEmail.toLowerCase()) {
      const credit = await getAvailableDiscountCredit(verifiedEmail);
      if (credit) {
        item.discountApplied = Math.min(item.price, parseFloat(credit.amount));
        item.price = Math.max(0, item.price - item.discountApplied);
        discountCreditId = credit.id;
      }
    }
  }

  return createCharge([item], trimmedEmail, discountCreditId);
}

// Vários jogos da lista de desejos num Pix só (BulkPurchaseModal.tsx). Sem
// desconto de fidelidade, igual ao confirmBulkOrderAction.
export async function startBulkPixPaymentAction(gameIds: number[], email: string): Promise<StartPixResult> {
  if (!isMercadoPagoEnabled()) return { mode: 'static' };
  const trimmedEmail = email.trim();
  if (!isValidEmail(trimmedEmail)) return { mode: 'error', error: 'Digite um e-mail válido.' };

  const games = await Promise.all(gameIds.map(loadGame));
  if (games.length === 0 || games.some((g) => !g)) {
    return { mode: 'error', error: 'Algum desses jogos não está mais disponível. Volte e confira a lista.' };
  }
  const items = (games as Game[]).map(gameToPaymentItem);

  return createCharge(items, trimmedEmail, null);
}

// referralSource vai junto porque o "como você conheceu a loja?" é marcado
// na própria tela do Pix, depois que a cobrança já existe.
export async function checkPixPaymentAction(paymentId: string, referralSource: string | null): Promise<PixCheckStatus> {
  // Ids das cobranças do Mercado Pago são letras e números ("ORD01...").
  if (!/^[A-Za-z0-9]+$/.test(paymentId)) return 'failed';
  try {
    await setMpPaymentReferralSource(paymentId, referralSource && isValidReferralSource(referralSource) ? referralSource : null);
    return await syncMercadoPagoPayment(paymentId);
  } catch (err) {
    // Falha passageira (rede, Mercado Pago lento): a tela tenta de novo na
    // próxima consulta.
    console.error('[mercadopago] Falha ao consultar pagamento:', err);
    return 'pending';
  }
}

export type CardPaymentResult =
  | { status: 'approved' }
  // Em análise pelo antifraude do Mercado Pago: a tela fica esperando
  // (mesma consulta do Pix — checkPixPaymentAction) até sair a decisão.
  | { status: 'pending'; paymentId: string }
  | { status: 'rejected'; error: string };

// Explica a recusa em português, pelo motivo que o Mercado Pago devolve.
function cardRejectionMessage(statusDetail: string): string {
  const detail = statusDetail.toLowerCase();
  if (detail.includes('insufficient')) return 'Cartão recusado por limite insuficiente. Tente outro cartão ou pague com Pix.';
  if (detail.includes('security_code')) return 'O código de segurança (CVV) não confere. Confira e tente de novo.';
  if (detail.includes('expiration') || detail.includes('date')) return 'A data de validade não confere. Confira e tente de novo.';
  if (detail.includes('call_for_authorize') || detail.includes('authorize'))
    return 'O banco pediu autorização pra essa compra. Libere no app do seu banco e tente de novo.';
  if (detail.includes('risk') || detail.includes('fraud') || detail.includes('blacklist'))
    return 'O pagamento não foi aprovado pela análise de segurança. Tente outro cartão ou pague com Pix.';
  return 'O cartão foi recusado. Confira os dados, tente outro cartão ou pague com Pix.';
}

// Cobra um jogo no cartão. O valor vem do banco (sem desconto de
// fidelidade — o desconto continua valendo só no Pix). Aprovado, o pedido
// é criado na hora, com os pontos já confirmados, igual ao Pix.
export async function payWithCardAction(
  gameId: number,
  email: string,
  card: CardInput,
  referralSource: string | null
): Promise<CardPaymentResult> {
  if (!isMercadoPagoEnabled()) return { status: 'rejected', error: 'Pagamento com cartão indisponível no momento.' };
  const trimmedEmail = email.trim();
  if (!isValidEmail(trimmedEmail)) return { status: 'rejected', error: 'Digite um e-mail válido.' };

  const game = await loadGame(gameId);
  if (!game) return { status: 'rejected', error: 'Esse jogo não está mais disponível.' };
  const item = gameToPaymentItem(game);

  try {
    const charge = await createCardPayment({
      amount: item.price,
      payerEmail: trimmedEmail,
      externalReference: randomUUID(),
      card
    });
    if (charge.state.status === 'failed' || !charge.id) {
      return { status: 'rejected', error: cardRejectionMessage(charge.statusDetail) };
    }

    await createMpPaymentRecord({
      id: charge.id,
      total: item.price,
      customer_email: trimmedEmail,
      discount_credit_id: null,
      items: [item],
      payment_method: 'cartao',
      referral_source: referralSource && isValidReferralSource(referralSource) ? referralSource : null
    });

    if (charge.state.status === 'approved') {
      // Cria o pedido agora (o aviso do Mercado Pago pode chegar depois;
      // se chegar, encontra tudo já feito e não duplica).
      const synced = await syncMercadoPagoPayment(charge.id).catch(() => 'approved' as const);
      if (synced === 'approved') return { status: 'approved' };
    }
    return { status: 'pending', paymentId: charge.id };
  } catch (err) {
    console.error('[mercadopago] Falha ao cobrar no cartão:', err);
    return { status: 'rejected', error: 'Não foi possível processar o cartão agora. Tente de novo em instantes ou pague com Pix.' };
  }
}
