import PromoCarousel, { type PromoSlide } from './PromoCarousel';
import type { Item } from './CatalogClient';
import { useDesignVariant } from './DesignVariant';
import ZeldaTourShowcase from './games-interativos/ocarina-hero/ZeldaTourShowcase';
import QualLinkShowcase from './qual-link/QualLinkShowcase';
import type { ActivePromoBanner } from '@/lib/promoBanner';
import { fallbackToOriginal } from '@/lib/imageVariants';

export default function PromoSection({
  featuredItems,
  mostWantedItems,
  allItems,
  onViewGame,
  onOpenGame,
  onOpenQualLink,
  zeldaTourAberto = false,
  promoBanner = null,
  onPromoBannerClick
}: {
  featuredItems: Item[];
  mostWantedItems: Item[];
  // Catálogo inteiro — é dele que o "Qual será seu próximo jogo?" sorteia.
  allItems: Item[];
  onViewGame: (name: string) => void;
  onOpenGame: (item: Item) => void;
  // Abre o quiz "Qual Link é você?" (qual-link/QualLinkQuiz.tsx).
  onOpenQualLink: () => void;
  // Zelda Tour aberto pro público: o banner dele leva direto pro jogo.
  zeldaTourAberto?: boolean;
  // Banner promocional do admin (lib/promoBanner.ts): enquanto está
  // valendo, entra no lugar do carrossel de "Destaque da semana".
  promoBanner?: ActivePromoBanner | null;
  onPromoBannerClick?: () => void;
}) {
  const isRedesign = useDesignVariant() === 'redesign';
  const hasFeatured = featuredItems.length > 0;
  // O banner do "Qual Link é você?" fica no lugar do "Mais desejados"
  // (os mais desejados continuam na vitrine própria, mais abaixo).
  const hasSide = true;
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
      {promoBanner ? (
        <div className="promo-section-main">
          <PromoImageBanner banner={promoBanner} onClick={onPromoBannerClick} />
        </div>
      ) : hasFeatured && (
        <div className="promo-section-main">
          <PromoCarousel slides={featuredSlides} intervalMs={6000} size="large" />
        </div>
      )}
      {hasSide && (
        <>
          {/* Computador/tablet: as duas categorias empilhadas, cada uma
              com seu próprio carrossel. */}
          <div className="promo-section-side promo-section-side-wide">
            <QualLinkShowcase onOpen={onOpenQualLink} />
            <ZeldaTourShowcase aberto={zeldaTourAberto} />
          </div>
          {/* Celular: os dois banners um embaixo do outro (os mais
              desejados já aparecem na vitrine própria logo abaixo). */}
          <div className="promo-section-side-compact has-quiz">
            <QualLinkShowcase onOpen={onOpenQualLink} variant="compact" />
            <ZeldaTourShowcase aberto={zeldaTourAberto} variant="compact" />
          </div>
        </>
      )}
    </div>
  );
}

// A arte do banner promocional, ocupando o espaço inteiro dos destaques.
// Com arte própria pro celular, o navegador escolhe pela largura da tela.
function PromoImageBanner({ banner, onClick }: { banner: ActivePromoBanner; onClick?: () => void }) {
  const picture = (
    <picture>
      {banner.mobileImageUrl && <source media="(max-width: 600px)" srcSet={banner.mobileImageUrl} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={banner.imageUrl}
        onError={fallbackToOriginal}
        alt={banner.alt || 'Promoção'}
        className="promo-banner-image"
        fetchPriority="high"
        decoding="async"
      />
    </picture>
  );
  if (banner.action === 'none' || !onClick) {
    return <div className="promo-banner promo-image-banner is-static">{picture}</div>;
  }
  return (
    <button
      type="button"
      className="promo-banner promo-image-banner"
      onClick={onClick}
      aria-label={`${banner.alt || 'Promoção'} — ver os jogos em promoção`}
    >
      {picture}
    </button>
  );
}
