'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReviewItem } from './CatalogClient';

const ITEMS_PER_PAGE = 4;
const AUTOPLAY_MS = 8000;

export default function ReviewsSection({ reviews }: { reviews: ReviewItem[] }) {
  const [page, setPage] = useState(0);
  const [pagedPaused, setPagedPaused] = useState(false);
  const [scrollPaused, setScrollPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const pages = useMemo(() => {
    const chunks: ReviewItem[][] = [];
    for (let i = 0; i < reviews.length; i += ITEMS_PER_PAGE) {
      chunks.push(reviews.slice(i, i + ITEMS_PER_PAGE));
    }
    return chunks;
  }, [reviews]);
  const totalPages = Math.max(1, pages.length);

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

  return (
    <div className="reviews-section">
      <p className="reviews-title">O que os clientes estão dizendo</p>

      {/* Every page sits side by side in one flex row; sliding between them
          is just a transform, and flexbox's default cross-axis "stretch"
          keeps every page the height of the tallest one — no JS measuring. */}
      <div className="reviews-carousel" onMouseEnter={() => setPagedPaused(true)} onMouseLeave={() => setPagedPaused(false)}>
        <div className="reviews-pages-track" style={{ transform: `translateX(-${page * 100}%)` }}>
          {pages.map((group, i) => (
            <div className="reviews-grid" key={i}>
              {group.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          ))}
        </div>
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

// Seção "O que os clientes dizem" na própria home (CatalogClient.tsx), pra
// prova social não ficar escondida atrás do botão "Ver avaliações": resumo
// (média e total) + 3 avaliações — as em destaque primeiro, depois as de
// nota mais alta. No celular vira um carrossel de arrastar com bolinhas;
// no computador, uma grade de 3. "Ver todas" abre o popup que já existia.
// onLeaveReview: abre o formulário "deixe sua avaliação" (antes ficava na
// barra do catálogo; aqui fica junto das avaliações, que é onde faz sentido).
export function HomeReviews({
  reviews,
  onSeeAll,
  onLeaveReview
}: {
  reviews: ReviewItem[];
  onSeeAll: () => void;
  onLeaveReview?: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const picked = useMemo(
    () =>
      [...reviews]
        .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || b.rating - a.rating)
        .slice(0, 3),
    [reviews]
  );
  const average = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  if (reviews.length === 0) return null;

  function handleScroll() {
    const el = trackRef.current;
    if (!el || !el.firstElementChild) return;
    const step = (el.firstElementChild as HTMLElement).offsetWidth;
    setActive(Math.round(el.scrollLeft / Math.max(1, step)));
  }

  return (
    <section className="home-reviews" aria-labelledby="home-reviews-title">
      <div className="home-reviews-head">
        <h2 id="home-reviews-title" className="home-reviews-title">
          O que os clientes dizem
        </h2>
        <p className="home-reviews-summary">
          <span className="home-reviews-stars" aria-hidden="true">
            ★
          </span>
          <strong>{average.toFixed(1).replace('.', ',')}</strong> de 5 · {reviews.length}{' '}
          {reviews.length === 1 ? 'avaliação' : 'avaliações'}
        </p>
      </div>

      <div ref={trackRef} className="home-reviews-track" onScroll={handleScroll}>
        {picked.map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
      </div>

      {picked.length > 1 && (
        <div className="home-reviews-dots" aria-hidden="true">
          {picked.map((r, i) => (
            <span key={r.id} className={`reviews-dot${i === active ? ' active' : ''}`} />
          ))}
        </div>
      )}

      <div className="home-reviews-actions">
        <button type="button" className="btn ghost" onClick={onSeeAll}>
          Ver todas as avaliações
        </button>
        {onLeaveReview && (
          <button type="button" className="btn ghost" onClick={onLeaveReview}>
            Deixe sua avaliação
          </button>
        )}
      </div>
    </section>
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
