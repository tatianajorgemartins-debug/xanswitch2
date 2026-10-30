// O que acontece quando o Mercado Pago diz em que pé está um Pix — chamado
// tanto pelo aviso automático dele (app/api/mercadopago/webhook/route.ts)
// quanto pela tela do cliente, que consulta o pagamento a cada poucos
// segundos (checkPixPaymentAction em app/mercadoPagoActions.ts). Os dois
// caminhos existem de propósito: se um falhar ou atrasar, o outro resolve.
//
// A fonte da verdade é SEMPRE a consulta direta à API do Mercado Pago com o
// seu Access Token — nunca o conteúdo do aviso em si —, então ninguém
// consegue "fingir" um pagamento mandando um aviso falso pro site.
import {
  claimApprovedMpPayment,
  createPaidMercadoPagoOrder,
  getMpPaymentRecord,
  markDiscountCreditUsed,
  releaseMpPaymentClaim,
  setMpPaymentStatus,
  type MpPaymentRecord
} from './db';
import { after } from 'next/server';
import { getPixPaymentState } from './mercadoPago';
import { notifyNewOrder } from './notifications';

// O que a tela do cliente precisa saber: pagou, ainda não, ou não vai mais
// rolar (Pix expirou, foi cancelado ou devolvido) e precisa gerar outro.
export type PixCheckStatus = 'approved' | 'pending' | 'failed';

export async function syncMercadoPagoPayment(paymentId: string): Promise<PixCheckStatus> {
  const record = await getMpPaymentRecord(paymentId);
  // Cobrança que não foi criada pelo site (ex: uma venda sua por outro
  // canal do Mercado Pago que também gera aviso): não é da nossa conta.
  if (!record) return 'failed';
  if (record.processed_at) return 'approved';

  const state = await getPixPaymentState(paymentId);

  if (state.status === 'approved') {
    // Confere que o valor pago é o valor cobrado — evita aprovar um pedido
    // por uma cobrança diferente que, por algum motivo, tenha o mesmo id.
    if (state.amount + 0.009 < parseFloat(record.total)) {
      console.error(`[mercadopago] Cobrança ${paymentId} aprovada com valor menor que o pedido.`);
      await setMpPaymentStatus(paymentId, 'amount_mismatch');
      return 'failed';
    }
    if (record.payment_method === 'pix+cartao') return syncSplitPart(record);
    await createOrdersForApprovedPayment(paymentId);
    return 'approved';
  }

  if (state.rawStatus !== record.status) {
    await setMpPaymentStatus(paymentId, state.rawStatus);
  }
  return state.status;
}

// Pix + cartão: são duas cobranças, e o pedido só nasce quando as duas
// estão pagas. A do Pix, ao cair, só fica marcada "paga, esperando o
// cartão" (o cliente segue pro cartão na mesma tela); a do cartão, ao ser
// aprovada, confere de novo no Mercado Pago que o Pix dela caiu e então
// cria o pedido a partir da cobrança do Pix (que tem o jogo e os preços).
async function syncSplitPart(record: MpPaymentRecord): Promise<PixCheckStatus> {
  if (!record.split_pix_id) {
    if (record.status !== 'paid_waiting_card') await setMpPaymentStatus(record.id, 'paid_waiting_card');
    return 'approved';
  }

  const pixRecord = await getMpPaymentRecord(record.split_pix_id);
  if (!pixRecord || pixRecord.split_pix_part === null) return 'failed';
  if (!pixRecord.processed_at) {
    const pixState = await getPixPaymentState(pixRecord.id);
    if (pixState.status !== 'approved' || pixState.amount + 0.009 < parseFloat(pixRecord.total)) {
      console.error(`[mercadopago] Cartão ${record.id} aprovado, mas o Pix ${pixRecord.id} não está pago.`);
      return 'pending';
    }
  }
  // A cobrança do cartão não gera pedido sozinha: só fica marcada como
  // processada. Se já estava (aviso e tela chegando juntos), segue igual.
  await claimApprovedMpPayment(record.id);
  if (!pixRecord.processed_at) await createOrdersForApprovedPayment(pixRecord.id, parseFloat(record.total));
  return 'approved';
}

// extraTotal: no Pix + cartão, o valor cobrado no cartão — entra no total
// do aviso de novo pedido, junto do valor do Pix.
async function createOrdersForApprovedPayment(paymentId: string, extraTotal = 0): Promise<void> {
  const record = await claimApprovedMpPayment(paymentId);
  if (!record) return; // outra chamada já está criando (ou já criou) os pedidos

  try {
    const orders = await Promise.all(
      record.items.map((it) =>
        createPaidMercadoPagoOrder({
          game_id: it.gameId,
          game_name: it.gameName,
          price: it.price,
          customer_email: record.customer_email,
          referral_source: record.referral_source,
          payment_method: record.payment_method,
          card_points_earned: it.cardPoints,
          card_image_url: it.cardImageUrl,
          discount_applied: it.discountApplied,
          mp_payment_id: paymentId
        })
      )
    );

    if (record.discount_credit_id) {
      const discountedOrder = orders.find((_, i) => record.items[i].discountApplied > 0) ?? orders[0];
      await markDiscountCreditUsed(record.discount_credit_id, discountedOrder.id).catch(() => {});
    }
  } catch (err) {
    await releaseMpPaymentClaim(paymentId);
    throw err;
  }

  // Depois da resposta: o Mercado Pago espera o aviso ser respondido
  // rápido, e o e-mail/Telegram podem levar alguns segundos.
  after(() =>
    notifyNewOrder({
      items: record.items.map((it) => ({ gameName: it.gameName, price: it.price, amazonJpUrl: it.amazonJpUrl })),
      total: parseFloat(record.total) + extraTotal,
      customerEmail: record.customer_email
    })
  );
}
