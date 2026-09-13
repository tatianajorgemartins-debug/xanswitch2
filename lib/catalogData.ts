// Busca tudo que o catálogo precisa pra renderizar — jogos, avaliações e o
// ranking de mais desejados. Fica num arquivo à parte (em vez de só dentro
// de app/page.tsx) porque agora tem DUAS páginas que precisam exatamente
// dos mesmos dados: o catálogo normal (app/page.tsx) e o link direto de um
// jogo (app/jogo/[id]/page.tsx, usado pra compartilhar nas redes sociais).
//
// O cache() do React garante que, mesmo chamando essa função várias vezes
// na mesma requisição (o link direto de um jogo chama ela tanto pra montar
// a prévia de compartilhamento — generateMetadata — quanto pra desenhar a
// página em si), o banco só é consultado uma vez.
import { cache } from 'react';
import { getActiveGames, getApprovedReviews, type Game } from './db';
import { buildWhatsAppPaymentLink, buildWhatsAppContactLink, formatPriceBR } from './whatsapp';
import { getWishlistCounts } from './supabaseAdmin';
import type { Item, ReviewItem } from '@/app/CatalogClient';

function toItem(g: Game): Item {
  return {
    id: g.id,
    name: g.name,
    price: parseFloat(g.price),
    priceLabel: formatPriceBR(g.price),
    originalPriceLabel:
      g.original_price && parseFloat(g.original_price) > parseFloat(g.price)
        ? formatPriceBR(g.original_price)
        : null,
    imageUrl: g.image_url,
    hasBadge: g.has_badge,
    badgeText: g.badge_text,
    badgeColor: g.badge_color,
    franchise: g.franchise,
    platform: g.platform,
    gameType: g.game_type,
    isBestseller: g.is_bestseller,
    isUpcoming: g.is_upcoming,
    description: g.description,
    screenshots: g.screenshots,
    whatsappPaymentUrl: buildWhatsAppPaymentLink(g.name, g.price)
  };
}

function byRecentFirst(games: Game[]): Game[] {
  // The Postgres driver hands back updated_at as a Date object, not the
  // string the Game type claims — compare via getTime() so it works
  // whichever shape it actually is.
  return games.slice().sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

function toReviewItem(r: Awaited<ReturnType<typeof getApprovedReviews>>[number]): ReviewItem {
  return {
    id: r.id,
    name: r.name,
    instagram: r.instagram,
    rating: r.rating,
    comment: r.comment,
    isFeatured: r.is_featured
  };
}

export type CatalogData = {
  items: Item[];
  featuredItems: Item[];
  bestsellerItems: Item[];
  upcomingItems: Item[];
  mostWantedItems: Item[];
  reviews: ReviewItem[];
  whatsappContactUrl: string | null;
};

export const loadCatalogData = cache(async (): Promise<CatalogData> => {
  const games = await getActiveGames();
  const reviews = await getApprovedReviews();

  const items = games.map(toItem);
  const featuredItems = byRecentFirst(games.filter((g) => g.is_featured)).map(toItem);
  const bestsellerItems = byRecentFirst(games.filter((g) => g.is_bestseller)).map(toItem);
  const upcomingItems = byRecentFirst(games.filter((g) => g.is_upcoming)).map(toItem);

  // Se o banco da lista de desejos ainda não estiver configurado (por
  // exemplo, a migração db/migration-wishlist.sql ainda não foi rodada),
  // não deixa isso quebrar o catálogo inteiro — só mostra sem essa vitrine.
  const wishlistCounts = await getWishlistCounts().catch(() => new Map<number, number>());
  const mostWantedItems = items
    .map((item) => ({ item, count: wishlistCounts.get(item.id) ?? 0 }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((entry) => entry.item);

  return {
    items,
    featuredItems,
    bestsellerItems,
    upcomingItems,
    mostWantedItems,
    reviews: reviews.map(toReviewItem),
    whatsappContactUrl: buildWhatsAppContactLink()
  };
});
