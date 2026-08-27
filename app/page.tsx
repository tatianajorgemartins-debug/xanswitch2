import { getActiveGames, getMusicSettings, type Game } from '@/lib/db';
import { buildWhatsAppLink, buildWhatsAppContactLink, formatPriceBR } from '@/lib/whatsapp';
import { formatTrackName } from '@/lib/format';
import CatalogClient, { type Item } from './CatalogClient';

export const dynamic = 'force-dynamic'; // always show the latest games, never a stale cached build

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
    whatsappUrl: buildWhatsAppLink(g.name, g.price)
  };
}

function mostRecent(games: Game[]): Game | null {
  return games.slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null;
}

export default async function CatalogPage() {
  const games = await getActiveGames();
  const music = await getMusicSettings();

  const items = games.map(toItem);
  const featuredItems = games.filter((g) => g.is_featured).map(toItem);
  const bestsellerGame = mostRecent(games.filter((g) => g.is_bestseller));
  const upcomingGame = mostRecent(games.filter((g) => g.is_upcoming));

  return (
    <CatalogClient
      items={items}
      featuredItems={featuredItems}
      bestsellerItem={bestsellerGame ? toItem(bestsellerGame) : null}
      upcomingItem={upcomingGame ? toItem(upcomingGame) : null}
      musicUrl={music.url}
      musicName={music.filename ? formatTrackName(music.filename) : null}
      whatsappContactUrl={buildWhatsAppContactLink()}
    />
  );
}
