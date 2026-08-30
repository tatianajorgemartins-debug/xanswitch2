import type { ReviewItem } from './CatalogClient';

export default function ReviewsSection({ reviews }: { reviews: ReviewItem[] }) {
  if (reviews.length === 0) return null;

  return (
    <div className="reviews-section">
      <p className="reviews-title">O que os clientes estão dizendo</p>
      <div className="reviews-track">
        {reviews.map((r) => (
          <div className="review-card" key={r.id}>
            <div className="review-card-stars">
              {'★'.repeat(r.rating)}
              <span className="review-card-stars-empty">{'★'.repeat(5 - r.rating)}</span>
            </div>
            <p className="review-card-comment">&ldquo;{r.comment}&rdquo;</p>
            <div className="review-card-author">
              <span className="review-card-name">{r.name}</span>
              {r.instagram && (
                <a
                  href={`https://instagram.com/${r.instagram.replace(/^@/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="review-card-instagram"
                >
                  @{r.instagram.replace(/^@/, '')}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
