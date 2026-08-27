import PromoCarousel from './PromoCarousel';
import type { Item } from './CatalogClient';

export default function PromoSection({
  featuredItems,
  bestsellerItems,
  upcomingItems,
  onViewGame,
  onFilterFlag
}: {
  featuredItems: Item[];
  bestsellerItems: Item[];
  upcomingItems: Item[];
  onViewGame: (name: string) => void;
  onFilterFlag: (flag: 'bestseller' | 'upcoming') => void;
}) {
  const hasFeatured = featuredItems.length > 0;
  const hasSide = bestsellerItems.length > 0 || upcomingItems.length > 0;
  if (!hasFeatured && !hasSide) return null;

  return (
    <div className="promo-section">
      {hasFeatured && (
        <div className="promo-section-main">
          <PromoCarousel
            items={featuredItems}
            intervalMs={6000}
            size="large"
            category="Destaque da semana"
            ctaLabel="Ver jogo"
            onItemClick={(item) => onViewGame(item.name)}
          />
        </div>
      )}
      {hasSide && (
        <div className="promo-section-side">
          {bestsellerItems.length > 0 && (
            <PromoCarousel
              items={bestsellerItems}
              intervalMs={4000}
              size="small"
              category="🔥 Mais vendidos"
              showControls={false}
              onItemClick={() => onFilterFlag('bestseller')}
            />
          )}
          {upcomingItems.length > 0 && (
            <PromoCarousel
              items={upcomingItems}
              intervalMs={4000}
              size="small"
              category="👀 Mais aguardados"
              priceOverride="EM BREVE"
              showControls={false}
              onItemClick={() => onFilterFlag('upcoming')}
            />
          )}
        </div>
      )}
    </div>
  );
}
