import { getActiveGames, getApprovedReviews, type Game } from '@/lib/db';
import { buildWhatsAppPaymentLink, buildWhatsAppContactLink, formatPriceBR } from '@/lib/whatsapp';
import CatalogClient, { type Item, type ReviewItem } from './CatalogClient';

// Antes esta página era "force-dynamic" (nunca cacheada — cada visita
// refazia a consulta ao banco do zero, o que ajudou a estourar o limite de
// banda do Vercel Blob). Agora o cache acontece dentro de getActiveGames e
// getApprovedReviews (lib/db.ts), com invalidação instantânea sempre que
// algo muda no admin — então essa página pode ser cacheada normalmente sem
// nunca mostrar dado desatualizado pra você.

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

export default async function CatalogPage() {
  const games = await getActiveGames();
  const reviews = await getApprovedReviews();

  const items = games.map(toItem);
  const featuredItems = byRecentFirst(games.filter((g) => g.is_featured)).map(toItem);
  const bestsellerItems = byRecentFirst(games.filter((g) => g.is_bestseller)).map(toItem);
  const upcomingItems = byRecentFirst(games.filter((g) => g.is_upcoming)).map(toItem);

  return (
    <CatalogClient
      items={items}
      featuredItems={featuredItems}
      bestsellerItems={bestsellerItems}
      upcomingItems={upcomingItems}
      reviews={reviews.map(toReviewItem)}
      whatsappContactUrl={buildWhatsAppContactLink()}
    />
  );
}
