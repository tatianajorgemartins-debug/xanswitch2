import { getActiveGames } from '@/lib/db';
import { buildWhatsAppLink, formatPriceBR } from '@/lib/whatsapp';
import CatalogClient from './CatalogClient';

export const dynamic = 'force-dynamic'; // always show the latest games, never a stale cached build

export default async function CatalogPage() {
  const games = await getActiveGames();

  const items = games.map((g) => ({
    id: g.id,
    name: g.name,
    priceLabel: formatPriceBR(g.price),
    originalPriceLabel:
      g.original_price && parseFloat(g.original_price) > parseFloat(g.price)
        ? formatPriceBR(g.original_price)
        : null,
    imageUrl: g.image_url,
    hasBadge: g.has_badge,
    badgeText: g.badge_text,
    badgeColor: g.badge_color,
    whatsappUrl: buildWhatsAppLink(g.name, g.price)
  }));

  return <CatalogClient items={items} />;
}
