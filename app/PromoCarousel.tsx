'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import PromoBanner from './PromoBanner';
import type { Item } from './CatalogClient';

// Cada "slide" já vem com a categoria/preço/clique prontos — isso existe
// pra dar pra misturar jogos de categorias diferentes (tipo "Mais
// desejados" + "Mais aguardados") num carrossel só, cada um mostrando sua
// própria etiqueta, em vez de um carrossel só servir uma categoria fixa.
export type PromoSlide = {
  item: Item;
  category: string;
  ctaLabel?: string;
  priceOverride?: string;
  onClick: () => void;
};

export default function PromoCarousel({
  slides,
  intervalMs,
  size,
  showControls = true
}: {
  slides: PromoSlide[];
  intervalMs: number;
  size: 'large' | 'small';
  showControls?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    if (slides.length < 2 || reducedMotion.current || paused) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, intervalMs);
    return () => clearInterval(timer);
    // `index` is intentionally in the deps: any manual navigation resets
    // this interval, so the next autoplay tick is always a full intervalMs
    // away from the user's last interaction rather than from page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length, index, paused, intervalMs]);

  function go(next: number) {
    const total = slides.length;
    setIndex(((next % total) + total) % total);
  }

  function handlePointerDown(e: PointerEvent) {
    dragStartX.current = e.clientX;
  }
  function handlePointerUp(e: PointerEvent) {
    if (dragStartX.current === null) return;
    const delta = e.clientX - dragStartX.current;
    dragStartX.current = null;
    if (Math.abs(delta) < 40) return;
    go(delta > 0 ? index - 1 : index + 1);
  }

  if (slides.length === 0) return null;

  return (
    <div
      className={`promo-carousel promo-carousel-${size}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="promo-carousel-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((slide) => (
          <div className="promo-carousel-slide" key={slide.item.id}>
            <PromoBanner
              item={slide.item}
              category={slide.category}
              ctaLabel={slide.ctaLabel}
              priceOverride={slide.priceOverride}
              size={size}
              onClick={slide.onClick}
            />
          </div>
        ))}
      </div>

      {showControls && slides.length > 1 && (
        <>
          <button
            type="button"
            className="promo-carousel-arrow left"
            onClick={() => go(index - 1)}
            aria-label="Anterior"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width={16} height={16}>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            className="promo-carousel-arrow right"
            onClick={() => go(index + 1)}
            aria-label="Próximo"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width={16} height={16}>
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>

          <div className="promo-carousel-dots">
            {slides.map((slide, i) => (
              <button
                key={slide.item.id}
                type="button"
                className={`promo-carousel-dot${i === index ? ' active' : ''}`}
                onClick={() => go(i)}
                aria-label={`Ir para o item ${i + 1}`}
                aria-current={i === index}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
