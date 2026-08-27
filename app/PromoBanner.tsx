import { getContrastColor } from '@/lib/color';
import type { Item } from './CatalogClient';

export default function PromoBanner({
  item,
  category,
  ctaLabel,
  priceOverride,
  onClick,
  size
}: {
  item: Item;
  category: string;
  ctaLabel?: string;
  priceOverride?: string;
  onClick: () => void;
  size: 'large' | 'small';
}) {
  return (
    <button type="button" className={`promo-banner promo-banner-${size}`} onClick={onClick}>
      {item.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt={item.name} className="promo-banner-image" />
      )}
      <div className="promo-banner-overlay" />
      <div className="promo-banner-content">
        <span className="promo-banner-category">{category}</span>
        <span className="promo-banner-name">{item.name}</span>
        <div className="promo-banner-meta">
          {item.hasBadge && (
            <span
              className="tag"
              style={{ background: item.badgeColor, color: getContrastColor(item.badgeColor) }}
            >
              {item.badgeText}
            </span>
          )}
          <span className="promo-banner-price-block">
            {!priceOverride && item.originalPriceLabel && (
              <span className="promo-banner-price-old">R$ {item.originalPriceLabel}</span>
            )}
            <span className="promo-banner-price">{priceOverride ?? `R$ ${item.priceLabel}`}</span>
          </span>
        </div>
        {ctaLabel && <span className="promo-banner-cta">{ctaLabel}</span>}
      </div>
    </button>
  );
}
