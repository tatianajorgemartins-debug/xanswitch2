import type { Item } from './CatalogClient';
import { fallbackToOriginal, IMAGE_SIZES, imageSrcSet } from '@/lib/imageVariants';
import { installmentsLabel } from '@/lib/installments';
import Badge, { adminBadgeKind, badgeHint } from './Badge';

export default function PromoBanner({
  item,
  category,
  ctaLabel,
  priceOverride,
  onClick,
  size,
  priority
}: {
  item: Item;
  category: string;
  ctaLabel?: string;
  priceOverride?: string;
  onClick: () => void;
  size: 'large' | 'small';
  // Primeiro slide de cada carrossel: aparece logo na abertura do site, então
  // começa a baixar junto com a página (em vez de esperar o navegador montar
  // a tela, como as imagens "lazy"). 'high' = passa na frente das outras.
  priority?: 'high' | 'eager';
}) {
  // Usa a imagem própria do banner quando cadastrada no admin; sem ela,
  // cai de volta pra capa quadrada normal (esticada/cortada pra caber no
  // formato largo), exatamente como já funcionava antes desse campo existir.
  const bannerImage = item.bannerImageUrl ?? item.imageUrl;

  return (
    <button type="button" className={`promo-banner promo-banner-${size}`} onClick={onClick}>
      {bannerImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bannerImage}
          srcSet={imageSrcSet(bannerImage, item.bannerImageUrl ? 1400 : 900)}
          sizes={IMAGE_SIZES.banner}
          onError={fallbackToOriginal}
          alt={item.name}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority === 'high' ? 'high' : undefined}
          className="promo-banner-image"
        />
      )}
      <div className="promo-banner-overlay" />
      <div className="promo-banner-content">
        <span className="promo-banner-category">{category}</span>
        <span className="promo-banner-name">{item.name}</span>
        <div className="promo-banner-meta">
          {item.hasBadge && (
            <Badge kind={adminBadgeKind(item.badgeText)} className="tag" title={badgeHint(item.badgeText)}>
              {item.badgeText}
            </Badge>
          )}
          <span className="promo-banner-price-block">
            {!priceOverride && item.originalPriceLabel && (
              <span className="promo-banner-price-old">R$ {item.originalPriceLabel}</span>
            )}
            <span className="promo-banner-price">{priceOverride ?? `R$ ${item.priceLabel}`}</span>
            {!priceOverride && <span className="promo-banner-installments">{installmentsLabel(item.price)}</span>}
          </span>
        </div>
        {ctaLabel && <span className="promo-banner-cta">{ctaLabel}</span>}
      </div>
    </button>
  );
}
