'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReviewItem } from './CatalogClient';

const ITEMS_PER_PAGE = 4;
const AUTOPLAY_MS = 8000;

export default function ReviewsSection({ reviews }: { reviews: ReviewItem[] }) {
  const [page, setPage] = useState(0);
  const [pagedPaused, setPagedPaused] = useState(false);
  const [scrollPaused, setScrollPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.max(1, Math.ceil(reviews.length / ITEMS_PER_PAGE));

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

  const visiblePage = reviews.slice(page * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE + ITEMS_PER_PAGE);

  return (
    <div className="reviews-section">
      <p className="reviews-title">O que os clientes estão dizendo</p>

      <div className="reviews-grid" onMouseEnter={() => setPagedPaused(true)} onMouseLeave={() => setPagedPaused(false)}>
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
  return (
    <div className={`review-card${review.isFeatured ? ' featured' : ''}`}>
      {review.isFeatured && <span className="review-card-featured-badge">⭐ Destaque</span>}
      <div className="review-card-stars">
        {'★'.repeat(review.rating)}
        <span className="review-card-stars-empty">{'★'.repeat(5 - review.rating)}</span>
      </div>
      <p className="review-card-comment">&ldquo;{review.comment}&rdquo;</p>
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
