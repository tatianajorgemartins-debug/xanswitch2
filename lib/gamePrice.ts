import type { Game } from './db';

// O preço que o cliente paga por um jogo: o promocional, quando menor que o
// normal, senão o normal. Fica num lugar só porque é usado tanto pra
// mostrar no catálogo (toItem em lib/catalogData.ts) quanto pra cobrar no
// Pix do Mercado Pago (app/mercadoPagoActions.ts) — o servidor calcula o
// valor da cobrança sozinho, nunca confia no preço que veio do navegador.
//
// Evento de promoção valendo (Black Friday etc. — g.promo_event, ver
// lib/promoEvents.ts): o preço do evento ganha, já calculado em cima do
// promocional.
export function gamePrice(g: Game): { regularPrice: number; isOnSale: boolean; price: number } {
  const regularPrice = parseFloat(g.price);
  const promoPrice = g.promo_price ? parseFloat(g.promo_price) : null;
  const eventPrice = g.promo_event ? g.promo_event.price : null;
  const best = [promoPrice, eventPrice].reduce<number | null>(
    (min, p) => (p !== null && p > 0 && p < regularPrice && (min === null || p < min) ? p : min),
    null
  );
  return { regularPrice, isOnSale: best !== null, price: best ?? regularPrice };
}

// Valor a cobrar pra receber `price` inteiro depois da taxa do Mercado
// Pago (ver lib/paymentFees.ts): ele tira a porcentagem do valor COBRADO,
// então a conta é price ÷ (1 − taxa) — não price + taxa. Arredonda pra
// cima nos centavos, pra nunca sobrar menos que o preço. Fica aqui (e não
// em paymentFees.ts, que lê o banco) pra o admin poder usar no navegador.
export function priceWithFee(price: number, feePercent: number): number {
  if (feePercent <= 0) return Math.round(price * 100) / 100;
  return Math.ceil((price / (1 - feePercent / 100)) * 100 - 1e-9) / 100;
}
