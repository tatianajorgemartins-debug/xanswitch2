'use client';

// Botão da promoção de franquia (admin > "🔥 Franquia em destaque"): texto
// do admin + "até X% OFF" calculado dos descontos reais + contagem
// regressiva quando tem data de fim (passou, o botão some). Símbolos que o
// admin usou pra imitar a Triforce (▲ △) viram o ícone de verdade.
import { useEffect, useState } from 'react';
import type { Item } from './CatalogClient';
import { normalizeText } from '@/lib/search';
import { promoEndTime } from '@/lib/promo';

function formatRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `termina em ${days}d ${hours}h`;
  if (hours > 0) return `termina em ${hours}h ${minutes}min`;
  return `termina em ${minutes}min`;
}

const TRIFORCE_SYMBOLS = /[▲△▴▵]|🔺/g;
const HAS_TRIFORCE_SYMBOL = /[▲△▴▵]|🔺/;

export default function FeaturedPromoButton({
  promo,
  items,
  onClick
}: {
  promo: { franchise: string; label: string; saleOnly: boolean; endsAt: string | null };
  items: Item[];
  onClick: () => void;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!promo.endsAt) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [promo.endsAt]);

  const usesTriforce = HAS_TRIFORCE_SYMBOL.test(promo.label) || normalizeText(promo.franchise).includes('zelda');
  const label = promo.label.replace(TRIFORCE_SYMBOLS, '').trim();
  const bestDiscount = promo.saleOnly
    ? Math.max(0, ...items.filter((it) => it.franchise === promo.franchise && it.isOnSale).map((it) => it.salePercent ?? 0))
    : 0;
  const remaining = promo.endsAt && now !== null ? promoEndTime(promo.endsAt) - now : null;
  if (remaining !== null && remaining <= 0) return null;

  return (
    <button type="button" className="btn featured-franchise-btn" onClick={onClick}>
      {usesTriforce && (
        <svg viewBox="0 0 24 21" width={16} height={14} fill="currentColor" aria-hidden="true">
          <path d="M12 0l6 10.5H6zM6 10.5L12 21H0zM18 10.5L24 21H12z" />
        </svg>
      )}
      <span>{label}</span>
      {bestDiscount > 0 && <span className="featured-promo-off">até {bestDiscount}% OFF</span>}
      {remaining !== null && <span className="featured-promo-timer">{formatRemaining(remaining)}</span>}
    </button>
  );
}
