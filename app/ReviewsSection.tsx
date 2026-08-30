'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReviewItem } from './CatalogClient';

const ITEMS_PER_PAGE = 4;
const AUTOPLAY_MS = 8000;

export default function ReviewsSection({ reviews }: { reviews: ReviewItem[] }) {
  const [page, setPage] = useState(0);
  const [pagedPaused, setPagedPaused] = useState(false);
  const [scrollPaused, setScrollPaused] = useState(false);
  const [gridMinHeight, setGridMinHeight] = useState<number | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  const pages = useMemo(() => {
    const chunks: ReviewItem[][] = [];
    for (let i = 0; i < reviews.length; i += ITEMS_PER_PAGE) {
      chunks.push(reviews.slice(i, i + ITEMS_PER_PAGE));
    }
    return chunks;
  }, [reviews]);
  const totalPages = Math.max(1, pages.length);

  // Every page has a different tallest card, so the grid's natural height
  // would otherwise jump each time it auto-advances. A hidden copy of every
  // page (collapsed, same width) is measured so the visible grid can be
  // locked to whichever page needs the most room. A ResizeObserver (rather
  // than a one-off measurement) is what makes this reliable: each card's
  // own "Ler mais" button only appears after its own effect runs, one tick
  // after this component mounts, so the very first measurement always
  // undercounts — the observer just re-measures whenever that settles.
  useEffect(() => {
    const container = measureRef.current;
    if (!container) return;
    const groups = Array.from(container.children) as HTMLElement[];
    if (groups.length === 0) return;

    const observer = new ResizeObserver(() => {
      const max = groups.reduce((m, g) => Math.max(m, g.offsetHeight), 0);
      setGridMinHeight((prev) => (max > 0 ? max : prev));
    });
    groups.forEach((g) => observer.observe(g));
    return () => observer.disconnect();
  }, [pages]);

  // Desktop: page through groups of 4 cards.
  useEffect(() => {
    if (totalPages < 2 || pagedPaused) return;
    const timer = setInterval(() => setPage((p) => (p + 1) % totalPages), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [totalPages, pagedPaused, page]);

  // Mobile: keep the free-scrolling row, but nudge it along by itself.
  useEffect(() => {
    if (reviews.length < 2 || scrollPaused) return;
    const timer = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const card = el.firstElementChild as HTMLElement | null;
      const step = card ? card.offsetWidth + 14 : 260;
      const maxScroll = el.scrollWidth - el.clientWidth;
      const next = el.scrollLeft >= maxScroll - 5 ? 0 : Math.min(el.scrollLeft + step, maxScroll);
      el.scrollTo({ left: next, behavior: 'smooth' });
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [reviews.length, scrollPaused]);

  if (reviews.length === 0) return null;

  const visiblePage = pages[page] ?? [];

  return (
    <div className="reviews-section">
      <p className="reviews-title">O que os clientes estão dizendo</p>

      {/* Off-screen: every page rendered once, collapsed, just to measure heights. */}
      <div className="reviews-measure" aria-hidden="true" ref={measureRef}>
        {pages.map((group, i) => (
          <div className="reviews-grid" key={i}>
            {group.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>
        ))}
      </div>

      <div
        className="reviews-grid"
        style={{ minHeight: gridMinHeight }}
        onMouseEnter={() => setPagedPaused(true)}
        onMouseLeave={() => setPagedPaused(false)}
      >
        {visiblePage.map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
      </div>
      {totalPages > 1 && (
        <div className="reviews-dots">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              type="button"
              className={`reviews-dot${i === page ? ' active' : ''}`}
              onClick={() => setPage(i)}
              aria-label={`Página ${i + 1} de avaliações`}
              aria-current={i === page}
            />
          ))}
        </div>
      )}

      <div
        className="reviews-track"
        ref={scrollRef}
        onPointerDown={() => setScrollPaused(true)}
        onPointerUp={() => setScrollPaused(false)}
      >
        {reviews.map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: ReviewItem }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [review.comment]);

  return (
    <div className={`review-card${review.isFeatured ? ' featured' : ''}`}>
      {review.isFeatured && <span className="review-card-featured-badge">⭐ Destaque</span>}
      <div className="review-card-stars">
        {'★'.repeat(review.rating)}
        <span className="review-card-stars-empty">{'★'.repeat(5 - review.rating)}</span>
      </div>
      <p ref={textRef} className={`review-card-comment${expanded ? ' expanded' : ''}`}>
        &ldquo;{review.comment}&rdquo;
      </p>
      {overflowing && (
        <button type="button" className="review-card-more" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Ler menos' : 'Ler mais'}
        </button>
      )}
      <div className="review-card-author">
        <span className="review-card-name">{review.name}</span>
        {review.instagram && (
          <a
            href={`https://instagram.com/${review.instagram.replace(/^@/, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="review-card-instagram"
          >
            @{review.instagram.replace(/^@/, '')}
          </a>
        )}
      </div>
    </div>
  );
}
