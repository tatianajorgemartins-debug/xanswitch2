'use server';

// Busca os cards colecionáveis, pontos e desconto de fidelidade de quem
// está logado — usado pela seção "🎴 Minha coleção" dentro do popup de
// conta (ver AccountModal.tsx) e pela troca de pontos por desconto.
//
// Todas as funções aqui recebem um "token" (ver getAccessToken em
// lib/wishlist.ts) em vez de confiar num e-mail solto — é assim que a
// gente confirma, com o próprio Supabase, que quem está pedindo é
// realmente o dono da conta (ver lib/supabaseAuthServer.ts).
import {
  getOrdersByEmail,
  getPointAdjustmentTotal,
  createPointAdjustment,
  createDiscountCredit,
  getAvailableDiscountCredit,
  getSiteSetting,
  LOYALTY_DISCOUNT_AMOUNT_KEY,
  type Order
} from '@/lib/db';
import { verifyAccessToken } from '@/lib/supabaseAuthServer';

const POINTS_PER_DISCOUNT = 5;
const DEFAULT_DISCOUNT_AMOUNT = 20;

// Valor configurável no admin (ver ReviewsBannerPanel... na verdade
// LoyaltySettingsPanel em AdminClient.tsx) — cai pra R$20 se ainda não
// tiver sido configurado ou vier um valor inválido salvo por engano.
async function getDiscountAmount(): Promise<number> {
  const raw = await getSiteSetting(LOYALTY_DISCOUNT_AMOUNT_KEY);
  const parsed = raw ? parseFloat(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DISCOUNT_AMOUNT;
}

export type CardSummary = {
  orderId: number;
  gameName: string;
  imageUrl: string | null;
  points: number;
  confirmed: boolean;
  purchasedAt: string;
};

export type MyCardsResult =
  | {
      ok: true;
      cards: CardSummary[];
      confirmedPoints: number;
      pendingPoints: number;
      availableDiscountCount: number;
      discountAmount: number;
      pointsPerDiscount: number;
    }
  | { ok: false; error: string };

function toCardSummary(order: Order): CardSummary {
  return {
    orderId: order.id,
    gameName: order.game_name,
    imageUrl: order.card_image_url,
    points: order.card_points_earned,
    confirmed: order.card_points_confirmed,
    purchasedAt: order.created_at.toString()
  };
}

// Soma os pontos confirmados de pedidos com os ajustes manuais (admin ou
// resgates de desconto) — esse é o total "de verdade" de um cliente.
async function getConfirmedPointsTotal(email: string, orders: Order[]): Promise<number> {
  const fromOrders = orders.filter((o) => o.card_points_confirmed).reduce((sum, o) => sum + o.card_points_earned, 0);
  const fromAdjustments = await getPointAdjustmentTotal(email);
  return fromOrders + fromAdjustments;
}

export async function getMyCardsAction(accessToken: string): Promise<MyCardsResult> {
  const email = await verifyAccessToken(accessToken);
  if (!email) {
    return { ok: false, error: 'Sessão expirada — entre de novo na sua conta.' };
  }

  const orders = await getOrdersByEmail(email);
  const cards = orders.filter((o) => o.card_points_earned > 0).map(toCardSummary);
  const pendingPoints = orders
    .filter((o) => o.card_points_earned > 0 && !o.card_points_confirmed)
    .reduce((sum, o) => sum + o.card_points_earned, 0);
  const confirmedPoints = await getConfirmedPointsTotal(email, orders);

  const availableCredit = await getAvailableDiscountCredit(email);
  // Só pra saber SE existe (a troca é sempre de 5 em 5 pontos, um crédito
  // por vez) — não precisa contar quantos exatamente pra essa tela.
  const availableDiscountCount = availableCredit ? 1 : 0;

  return {
    ok: true,
    cards,
    confirmedPoints,
    pendingPoints,
    availableDiscountCount,
    discountAmount: await getDiscountAmount(),
    pointsPerDiscount: POINTS_PER_DISCOUNT
  };
}

export type RedeemDiscountResult =
  | { ok: true; remainingPoints: number; amount: number }
  | { ok: false; error: string };

// Troca 5 pontos confirmados por um crédito de desconto (valor configurável
// no admin, ver getDiscountAmount acima) — chamado direto na página do
// jogo (ver GameDiscountBanner em PurchaseModal.tsx), assim que o cliente
// já tem pontos suficientes. O desconto é aplicado na hora nessa mesma
// compra (se for via Pix — ver confirmOrderAction em orderActions.ts).
export async function redeemDiscountAction(accessToken: string): Promise<RedeemDiscountResult> {
  const email = await verifyAccessToken(accessToken);
  if (!email) {
    return { ok: false, error: 'Sessão expirada — entre de novo na sua conta.' };
  }

  const orders = await getOrdersByEmail(email);
  const confirmedPoints = await getConfirmedPointsTotal(email, orders);
  if (confirmedPoints < POINTS_PER_DISCOUNT) {
    return { ok: false, error: `Você precisa de ${POINTS_PER_DISCOUNT} pontos confirmados pra trocar por desconto.` };
  }

  const discountAmount = await getDiscountAmount();
  await createPointAdjustment({
    customer_email: email,
    points: -POINTS_PER_DISCOUNT,
    note: `Troca de ${POINTS_PER_DISCOUNT} pontos por R$ ${discountAmount.toFixed(2).replace('.', ',')} de desconto`
  });
  await createDiscountCredit(email, discountAmount);

  return { ok: true, remainingPoints: confirmedPoints - POINTS_PER_DISCOUNT, amount: discountAmount };
}

export type GameDiscountOffer = {
  // false quando não está logado — nesse caso não dá pra saber se tem
  // pontos, então a página do jogo simplesmente não mostra nada sobre
  // desconto de fidelidade.
  ok: boolean;
  // Já existe um crédito pronto pra usar (de uma troca anterior) — nesse
  // caso a página do jogo já aplica ele de cara, sem precisar resgatar de
  // novo.
  hasAvailableCredit: boolean;
  availableAmount: number;
  confirmedPoints: number;
  pointsPerDiscount: number;
  // Quanto valeria um resgate NOVO, se o cliente tiver pontos suficientes
  // e ainda não tiver nenhum crédito disponível.
  discountAmount: number;
};

// Busca tudo que a página do jogo precisa mostrar sobre desconto de
// fidelidade pra esse cliente (ver GameDiscountBanner em
// PurchaseModal.tsx) — se já tem um crédito pronto, ou se já tem pontos
// suficientes pra resgatar um novo ali mesmo, na hora.
export async function getGameDiscountOfferAction(accessToken: string): Promise<GameDiscountOffer> {
  const discountAmount = await getDiscountAmount();
  const email = await verifyAccessToken(accessToken);
  if (!email) {
    return {
      ok: false,
      hasAvailableCredit: false,
      availableAmount: 0,
      confirmedPoints: 0,
      pointsPerDiscount: POINTS_PER_DISCOUNT,
      discountAmount
    };
  }

  const credit = await getAvailableDiscountCredit(email);
  const orders = await getOrdersByEmail(email);
  const confirmedPoints = await getConfirmedPointsTotal(email, orders);

  return {
    ok: true,
    hasAvailableCredit: !!credit,
    availableAmount: credit ? parseFloat(credit.amount) : 0,
    confirmedPoints,
    pointsPerDiscount: POINTS_PER_DISCOUNT,
    discountAmount
  };
}
