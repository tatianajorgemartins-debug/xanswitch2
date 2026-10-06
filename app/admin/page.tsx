import { redirect } from 'next/navigation';
import {
  getAllGames,
  getVisitCount,
  getAllReviews,
  getRecentOrders,
  getAllPointAdjustmentTotals,
  getAllAvailableDiscountCreditTotals,
  getSiteSetting,
  REVIEWS_BANNER_KEY,
  LOYALTY_DISCOUNT_AMOUNT_KEY
} from '@/lib/db';
import { isAuthenticated } from '@/lib/auth';
import { getWishlistCounts } from '@/lib/supabaseAdmin';
import AdminClient from './AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // this is the real, authoritative check — the proxy only does a cheap
  // "is there a cookie at all" pass to bounce obviously logged-out visitors
  const authed = await isAuthenticated();
  if (!authed) {
    redirect('/admin/login');
  }

  const games = await getAllGames();
  const visitCount = await getVisitCount();
  const reviews = await getAllReviews();
  const orders = await getRecentOrders();
  // Se o Supabase de lista de desejos ainda não estiver configurado (por
  // exemplo, logo depois do deploy, antes de rodar a migração), não deixa
  // isso quebrar o painel inteiro — só mostra "Mais desejados" vazio.
  const wishlistCounts = await getWishlistCounts().catch(() => new Map<number, number>());
  const pointAdjustmentTotals = await getAllPointAdjustmentTotals();
  const availableDiscountCreditTotals = await getAllAvailableDiscountCreditTotals();
  const reviewsBannerUrl = await getSiteSetting(REVIEWS_BANNER_KEY);
  const rawDiscountAmount = await getSiteSetting(LOYALTY_DISCOUNT_AMOUNT_KEY);
  const parsedDiscountAmount = rawDiscountAmount ? parseFloat(rawDiscountAmount) : NaN;
  const discountAmount = Number.isFinite(parsedDiscountAmount) && parsedDiscountAmount > 0 ? parsedDiscountAmount : 20;
  return (
    <AdminClient
      initialGames={games}
      visitCount={visitCount}
      reviews={reviews}
      orders={orders}
      wishlistCounts={Object.fromEntries(wishlistCounts)}
      pointAdjustmentTotals={pointAdjustmentTotals}
      availableDiscountCreditTotals={availableDiscountCreditTotals}
      reviewsBannerUrl={reviewsBannerUrl}
      discountAmount={discountAmount}
    />
  );
}
