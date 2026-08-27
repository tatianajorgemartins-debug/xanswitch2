import FeaturedCarousel from './FeaturedCarousel';
import PromoBanner from './PromoBanner';
import type { Item } from './CatalogClient';

export default function PromoSection({
  featuredItems,
  bestsellerItem,
  upcomingItem,
  onViewGame,
  onFilterFlag
}: {
  featuredItems: Item[];
  bestsellerItem: Item | null;
  upcomingItem: Item | null;
  onViewGame: (name: string) => void;
  onFilterFlag: (flag: 'bestseller' | 'upcoming') => void;
}) {
  const hasFeatured = featuredItems.length > 0;
  const hasSide = bestsellerItem || upcomingItem;
  if (!hasFeatured && !hasSide) return null;

  return (
    <div className="promo-section">
      {hasFeatured && (
        <div className="promo-section-main">
          <FeaturedCarousel items={featuredItems} onViewGame={onViewGame} />
        </div>
      )}
      {hasSide && (
        <div className="promo-section-side">
          {bestsellerItem && (
            <PromoBanner
              item={bestsellerItem}
              category="🔥 Mais vendidos"
              size="small"
              onClick={() => onFilterFlag('bestseller')}
            />
          )}
          {upcomingItem && (
            <PromoBanner
              item={upcomingItem}
              category="👀 Mais aguardados"
              priceOverride="EM BREVE"
              size="small"
              onClick={() => onFilterFlag('upcoming')}
            />
          )}
        </div>
      )}
    </div>
  );
}
