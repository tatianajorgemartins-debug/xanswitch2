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
  setMpPaymentStatus
} from './db';
import { after } from 'next/server';
import { getPayment } from './mercadoPago';
import { notifyNewOrder } from './notifications';

// O que a tela do cliente precisa saber: pagou, ainda não, ou não vai mais
// rolar (Pix expirou, foi recusado ou devolvido) e precisa gerar outro.
export type PixCheckStatus = 'approved' | 'pending' | 'failed';

const FAILED_STATUSES = new Set(['rejected', 'cancelled', 'refunded', 'charged_back']);

export async function syncMercadoPagoPayment(paymentId: string): Promise<PixCheckStatus> {
  const record = await getMpPaymentRecord(paymentId);
  // Pagamento que não foi criado pelo site (ex: uma venda sua por outro
  // canal do Mercado Pago que também gera aviso): não é da nossa conta.
  if (!record) return 'failed';
  if (record.processed_at) return 'approved';

  const payment = await getPayment(paymentId);

  if (payment.status === 'approved') {
    // Confere que o valor pago é o valor cobrado — evita aprovar um pedido
    // por uma cobrança diferente que, por algum motivo, tenha o mesmo id.
    if (payment.transaction_amount + 0.009 < parseFloat(record.total)) {
      console.error(`[mercadopago] Pagamento ${paymentId} aprovado com valor menor que o pedido.`);
      await setMpPaymentStatus(paymentId, 'amount_mismatch');
      return 'failed';
    }
    await createOrdersForApprovedPayment(paymentId);
    return 'approved';
  }

  if (payment.status !== record.status) {
    await setMpPaymentStatus(paymentId, payment.status);
  }
  return FAILED_STATUSES.has(payment.status) ? 'failed' : 'pending';
}

async function createOrdersForApprovedPayment(paymentId: string): Promise<void> {
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
      total: parseFloat(record.total),
      customerEmail: record.customer_email
    })
  );
}
