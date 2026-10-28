import type { Game } from './db';

// O preço que o cliente paga por um jogo: o promocional, quando menor que o
// normal, senão o normal. Fica num lugar só porque é usado tanto pra
// mostrar no catálogo (toItem em lib/catalogData.ts) quanto pra cobrar no
// Pix do Mercado Pago (app/mercadoPagoActions.ts) — o servidor calcula o
// valor da cobrança sozinho, nunca confia no preço que veio do navegador.
export function gamePrice(g: Game): { regularPrice: number; isOnSale: boolean; price: number } {
  const regularPrice = parseFloat(g.price);
  const promoPrice = g.promo_price ? parseFloat(g.promo_price) : null;
  const isOnSale = promoPrice !== null && promoPrice > 0 && promoPrice < regularPrice;
  const price = isOnSale ? (promoPrice as number) : regularPrice;
  return { regularPrice, isOnSale, price };
}
