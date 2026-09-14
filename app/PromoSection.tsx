import PromoCarousel, { type PromoSlide } from './PromoCarousel';
import type { Item } from './CatalogClient';

export default function PromoSection({
  featuredItems,
  mostWantedItems,
  upcomingItems,
  onViewGame,
  onFilterFlag
}: {
  featuredItems: Item[];
  mostWantedItems: Item[];
  upcomingItems: Item[];
  onViewGame: (name: string) => void;
  onFilterFlag: (flag: 'bestseller' | 'upcoming') => void;
}) {
  const hasFeatured = featuredItems.length > 0;
  const hasSide = mostWantedItems.length > 0 || upcomingItems.length > 0;
  if (!hasFeatured && !hasSide) return null;

  const featuredSlides: PromoSlide[] = featuredItems.map((item) => ({
    item,
    category: 'Destaque da semana',
    ctaLabel: 'Ver jogo',
    onClick: () => onViewGame(item.name)
  }));

  const mostWantedSlides: PromoSlide[] = mostWantedItems.map((item) => ({
    item,
    category: '❤️ Mais desejados',
    onClick: () => onViewGame(item.name)
  }));

  const upcomingSlides: PromoSlide[] = upcomingItems.map((item) => ({
    item,
    category: '👀 Mais aguardados',
    priceOverride: 'EM BREVE',
    onClick: () => onFilterFlag('upcoming')
  }));

  return (
    <div className="promo-section">
      {hasFeatured && (
        <div className="promo-section-main">
          <PromoCarousel slides={featuredSlides} intervalMs={6000} size="large" />
        </div>
      )}
      {hasSide && (
        <>
          {/* Computador/tablet: as duas categorias empilhadas, cada uma
              com seu próprio carrossel. */}
          <div className="promo-section-side promo-section-side-wide">
            {mostWantedSlides.length > 0 && (
              <PromoCarousel slides={mostWantedSlides} intervalMs={4000} size="small" showControls={false} />
            )}
            {upcomingSlides.length > 0 && (
              <PromoCarousel slides={upcomingSlides} intervalMs={4000} size="small" showControls={false} />
            )}
          </div>
          {/* Celular: as duas categorias juntas, revezando num carrossel
              só — evita empilhar dois banners inteiros embaixo do de
              destaque, o que deixava a tela poluída antes de chegar no
              catálogo em si. */}
          <div className="promo-section-side-compact">
            <PromoCarousel
              slides={[...mostWantedSlides, ...upcomingSlides]}
              intervalMs={3500}
              size="small"
              showControls={false}
            />
          </div>
        </>
      )}
    </div>
  );
}
