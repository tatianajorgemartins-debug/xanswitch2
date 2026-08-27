'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import PromoBanner from './PromoBanner';
import type { Item } from './CatalogClient';

const AUTOPLAY_MS = 6000;

export default function FeaturedCarousel({
  items,
  onViewGame
}: {
  items: Item[];
  onViewGame: (name: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    if (items.length < 2 || reducedMotion.current || paused) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
    // `index` is intentionally in the deps: any manual navigation resets
    // this interval, so the next autoplay tick is always a full AUTOPLAY_MS
    // away from the user's last interaction rather than from page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, index, paused]);

  function go(next: number) {
    const total = items.length;
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

  if (items.length === 0) return null;

  return (
    <div
      className="featured-carousel"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="featured-carousel-track"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {items.map((item) => (
          <div className="featured-carousel-slide" key={item.id}>
            <PromoBanner
              item={item}
              category="Destaque da semana"
              ctaLabel="Ver jogo"
              size="large"
              onClick={() => onViewGame(item.name)}
            />
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <>
          <button
            type="button"
            className="featured-carousel-arrow left"
            onClick={() => go(index - 1)}
            aria-label="Destaque anterior"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width={16} height={16}>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            className="featured-carousel-arrow right"
            onClick={() => go(index + 1)}
            aria-label="Próximo destaque"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width={16} height={16}>
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>

          <div className="featured-carousel-dots">
            {items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className={`featured-carousel-dot${i === index ? ' active' : ''}`}
                onClick={() => go(i)}
                aria-label={`Ir para destaque ${i + 1}`}
                aria-current={i === index}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
