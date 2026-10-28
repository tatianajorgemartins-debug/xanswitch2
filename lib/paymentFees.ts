// Repasse da taxa do Mercado Pago pro cliente: o site cobra um pouco a
// mais no cartão (e, se você quiser, no Pix) pra que, depois de o Mercado
// Pago descontar a taxa dele, sobre exatamente o preço do jogo. A Lei
// 13.455/2017 permite preço diferente por forma de pagamento, desde que o
// cliente veja o valor antes de pagar — ver CardPaymentStep.tsx e a tela do
// Pix em PurchaseModal.tsx.
//
// As taxas ficam em site_settings e são editadas no admin (📋 Pedidos >
// "Taxas do Mercado Pago"). Os valores padrão abaixo são os do Checkout
// com recebimento "Na hora" em out/2026.
import { getSiteSetting } from './db';

export const MP_CARD_FEE_KEY = 'mp_card_fee_percent';
export const MP_PIX_FEE_KEY = 'mp_pix_fee_percent';

const DEFAULT_CARD_FEE = 4.98;
const DEFAULT_PIX_FEE = 0;

function parseFee(raw: string | null, fallback: number): number {
  const value = raw === null ? NaN : parseFloat(raw);
  return Number.isFinite(value) && value >= 0 && value < 50 ? value : fallback;
}

export async function getPaymentFees(): Promise<{ card: number; pix: number }> {
  const [card, pix] = await Promise.all([getSiteSetting(MP_CARD_FEE_KEY), getSiteSetting(MP_PIX_FEE_KEY)]);
  return { card: parseFee(card, DEFAULT_CARD_FEE), pix: parseFee(pix, DEFAULT_PIX_FEE) };
}
