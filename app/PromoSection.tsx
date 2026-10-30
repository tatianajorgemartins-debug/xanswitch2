import PromoCarousel, { type PromoSlide } from './PromoCarousel';
import type { Item } from './CatalogClient';
import { useDesignVariant } from './DesignVariant';
import QuizShowcase from './quiz/QuizShowcase';

export default function PromoSection({
  featuredItems,
  mostWantedItems,
  allItems,
  onViewGame,
  onOpenGame
}: {
  featuredItems: Item[];
  mostWantedItems: Item[];
  // Catálogo inteiro — é dele que o "Qual será seu próximo jogo?" sorteia.
  allItems: Item[];
  onViewGame: (name: string) => void;
  onOpenGame: (item: Item) => void;
}) {
  const isRedesign = useDesignVariant() === 'redesign';
  const hasFeatured = featuredItems.length > 0;
  // O mostruário do quiz ocupa o lugar que era dos banners rotativos
  // "Mais aguardados" (ver quiz/QuizShowcase.tsx).
  const hasQuiz = allItems.some((it) => !it.isUpcoming && it.imageUrl);
  const hasSide = mostWantedItems.length > 0 || hasQuiz;
  if (!hasFeatured && !hasSide) return null;

  const featuredSlides: PromoSlide[] = featuredItems.map((item) => ({
    item,
    category: 'Destaque da semana',
    ctaLabel: 'Ver jogo',
    onClick: () => onViewGame(item.name)
  }));

  const mostWantedSlides: PromoSlide[] = mostWantedItems.map((item) => ({
    item,
    category: isRedesign ? 'Mais desejados' : '❤️ Mais desejados',
    onClick: () => onViewGame(item.name)
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
            {hasQuiz && <QuizShowcase items={allItems} onOpenGame={onOpenGame} />}
          </div>
          {/* Celular: no lugar do carrossel compacto, só o mostruário do
              quiz — os mais desejados já aparecem na vitrine própria logo
              abaixo. Sem o quiz (catálogo sem capas), volta pro carrossel. */}
          {hasQuiz ? (
            <div className="promo-section-side-compact has-quiz">
              <QuizShowcase items={allItems} onOpenGame={onOpenGame} variant="compact" />
            </div>
          ) : (
            <div className="promo-section-side-compact">
              <PromoCarousel slides={mostWantedSlides} intervalMs={3500} size="small" showControls={false} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
