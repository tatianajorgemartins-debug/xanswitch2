'use client';

// Faixa fina no topo do site enquanto um evento de promoção está valendo
// (ex: BLACK FRIDAY 2026). O nome, a cor e as datas vêm do evento criado em
// /admin > 🏷️ Promoções. O clique mostra os jogos do evento no catálogo.
import { useEffect, useState } from 'react';
import { getContrastColor } from '@/lib/color';
import type { ActivePromoStrip } from '@/lib/promoEvents';

// Maior espera aceita pelo setTimeout (cerca de 24 dias).
const MAX_TIMEOUT = 2 ** 31 - 1;

export default function PromoStrip({ strip, onClick }: { strip: ActivePromoStrip; onClick: () => void }) {
  // A página fica em cache por alguns minutos: some na hora em que o evento
  // acaba, mesmo com a página já aberta.
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    if (!strip.endsAt) return;
    const left = new Date(strip.endsAt).getTime() - Date.now();
    if (left > MAX_TIMEOUT) return;
    const timer = setTimeout(() => setEnded(true), Math.max(0, left));
    return () => clearTimeout(timer);
  }, [strip.endsAt]);

  if (ended) return null;

  return (
    <div className="promo-strip-space">
      <button
        type="button"
        className="promo-strip"
        style={{ '--strip-bg': strip.color, '--strip-ink': getContrastColor(strip.color) } as React.CSSProperties}
        onClick={onClick}
      >
        <span className="promo-strip-title">{strip.name}</span>
        {strip.maxPercent !== null && <span className="promo-strip-offer">até {strip.maxPercent}% OFF</span>}
        <span className="promo-strip-cta">
          Ver ofertas
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width={12} height={12} aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
    </div>
  );
}
