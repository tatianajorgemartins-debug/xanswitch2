import { redirect } from 'next/navigation';
import {
  getAllGames,
  getVisitCount,
  getAllReviews,
  getRecentOrders,
  getStalledSplitPayments,
  getAllPrivateOffers,
  getAllPointAdjustmentTotals,
  getAllAvailableDiscountCreditTotals,
  getSiteSetting,
  REVIEWS_BANNER_KEY,
  LOYALTY_DISCOUNT_AMOUNT_KEY,
  FEATURED_FRANCHISE_ENABLED_KEY,
  FEATURED_FRANCHISE_KEY,
  FEATURED_FRANCHISE_LABEL_KEY
} from '@/lib/db';
import { isAuthenticated } from '@/lib/auth';
import { getPaymentFees } from '@/lib/paymentFees';
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
  // Antes de rodar db/migration-pix-cartao.sql a consulta falha — aí só
  // não mostra o aviso.
  const stalledSplits = (await getStalledSplitPayments().catch(() => [])).map((p) => ({
    id: p.id,
    email: p.customer_email,
    gameName: p.items[0]?.gameName ?? '',
    pixTotal: parseFloat(p.total),
    createdAt: new Date(p.created_at).toISOString()
  }));
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
  const featuredFranchiseEnabled = (await getSiteSetting(FEATURED_FRANCHISE_ENABLED_KEY)) === 'true';
  const featuredFranchiseName = (await getSiteSetting(FEATURED_FRANCHISE_KEY)) ?? '';
  const featuredFranchiseLabel = (await getSiteSetting(FEATURED_FRANCHISE_LABEL_KEY)) ?? '';
  const paymentFees = await getPaymentFees();
  // null = tabela ainda não existe (falta rodar db/migration-private-offers.sql).
  const privateOffers = await getAllPrivateOffers()
    .then((rows) =>
      rows.map((o) => ({
        token: o.token,
        gameId: o.game_id,
        price: parseFloat(o.price),
        note: o.note,
        maxUses: o.max_uses,
        uses: o.uses,
        expiresAt: o.expires_at ? new Date(o.expires_at).toISOString() : null,
        active: o.active,
        createdAt: new Date(o.created_at).toISOString()
      }))
    )
    .catch(() => null);
  return (
    <AdminClient
      initialGames={games}
      visitCount={visitCount}
      reviews={reviews}
      orders={orders}
      stalledSplits={stalledSplits}
      wishlistCounts={Object.fromEntries(wishlistCounts)}
      pointAdjustmentTotals={pointAdjustmentTotals}
      availableDiscountCreditTotals={availableDiscountCreditTotals}
      reviewsBannerUrl={reviewsBannerUrl}
      discountAmount={discountAmount}
      featuredFranchiseEnabled={featuredFranchiseEnabled}
      featuredFranchiseName={featuredFranchiseName}
      featuredFranchiseLabel={featuredFranchiseLabel}
      paymentFees={paymentFees}
      privateOffers={privateOffers}
    />
  );
}
