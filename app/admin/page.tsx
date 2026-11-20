import { redirect } from 'next/navigation';
import {
  getAllGames,
  getVisitCount,
  getAllReviews,
  getAllOrders,
  getStalledSplitPayments,
  getAllPrivateOffers,
  getAllPromoEvents,
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
import { isMercadoPagoEnabled } from '@/lib/mercadoPago';
import { reconcilePendingMercadoPagoPayments } from '@/lib/mercadoPagoOrders';
import AdminClient from './AdminClient';
import { parsePromoBanner, PROMO_BANNER_KEY } from '@/lib/promoBanner';
import { getAllPostsForAdmin, getGamePlayStats, getRecentGamePlays } from '@/lib/jogosDb';
import type { JogosInterativosData } from './JogosInterativosPanel';
import { getAllOcarinaSongs, jogoOcarinaPublicado } from '@/lib/ocarinaDb';
import { listarSorteios } from '@/lib/sorteioDb';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // this is the real, authoritative check — the proxy only does a cheap
  // "is there a cookie at all" pass to bounce obviously logged-out visitors
  const authed = await isAuthenticated();
  if (!authed) {
    redirect('/admin/login');
  }

  // Antes de listar os pedidos: confere no Mercado Pago se algum Pix recente
  // foi pago sem virar pedido (cliente fechou a tela, aviso automático
  // falhou) e cria os que faltam. No máximo ~8s, pra nunca travar o painel.
  if (isMercadoPagoEnabled()) {
    await Promise.race([
      reconcilePendingMercadoPagoPayments().catch((err) => console.error('[admin] Conferência de Pix falhou:', err)),
      new Promise((resolve) => setTimeout(resolve, 8000))
    ]);
  }

  const games = await getAllGames();
  const visitCount = await getVisitCount();
  const reviews = await getAllReviews();
  // Todas as vendas (o controle de vendas filtra e soma tudo no navegador).
  const orders = await getAllOrders();
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
  // null = tabela ainda não existe (falta rodar db/migration-eventos-promocao.sql).
  const promoEvents = await getAllPromoEvents().catch(() => null);
  const promoBanner = parsePromoBanner(await getSiteSetting(PROMO_BANNER_KEY));
  // Jogos interativos: partidas e feed. null = falta rodar
  // db/migration-jogos-interativos.sql.
  const jogosInterativos: JogosInterativosData | null = await Promise.all([getRecentGamePlays(), getGamePlayStats(), getAllPostsForAdmin()])
    .then(([plays, stats, posts]) => ({
      plays: plays.map((p) => ({
        id: Number(p.id),
        game: p.game,
        mode: p.mode,
        dailyDay: p.daily_day,
        won: p.won,
        score: p.score,
        summary: p.summary,
        email: p.customer_email,
        visitor: p.visitor_id,
        createdAt: new Date(p.created_at).toISOString()
      })),
      stats: stats.map((s) => ({ game: s.game, today: s.plays_today, week: s.plays_7d, total: s.plays_total, players7d: s.players_7d })),
      posts: posts.map((p) => ({
        id: Number(p.id),
        game: p.game,
        title: p.title,
        resultText: p.result_text,
        comment: p.comment,
        authorName: p.author_name,
        email: p.customer_email,
        likes: p.likes,
        hidden: p.hidden,
        createdAt: new Date(p.created_at).toISOString()
      }))
    }))
    .catch(() => null);
  const ocarinaPublicado = await jogoOcarinaPublicado();
  // Sorteios ao vivo. null = falta rodar db/migration-sorteios.sql.
  const sorteios = await listarSorteios()
    .then((l) => l.map((s) => ({ id: s.id, titulo: s.titulo, slug: s.slug, status: s.status, teste: s.teste, participantes: s.participantes, premios: s.premios })))
    .catch(() => null);
  // Músicas do Zelda Tour. null = falta rodar db/migration-ocarina-musicas.sql.
  const musicasOcarina = await getAllOcarinaSongs()
    .then((l) =>
      l.map((m) => ({
        id: m.id,
        titulo: m.title,
        jogo: m.game,
        dificuldades: m.charts?.liberadas.length ? m.charts.liberadas : [m.difficulty],
        notas: m.note_count,
        duracao: m.audio_duration,
        temAudio: Boolean(m.audio_url),
        publicada: m.published,
        atualizadaEm: new Date(m.updated_at).toISOString()
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
      promoEvents={promoEvents}
      promoBanner={promoBanner}
      jogosInterativos={jogosInterativos}
      musicasOcarina={musicasOcarina}
      ocarinaPublicado={ocarinaPublicado}
      sorteios={sorteios}
    />
  );
}
