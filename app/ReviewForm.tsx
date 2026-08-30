'use client';

import { useEffect, useRef, useState, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { submitReviewAction, type ReviewFormState } from './reviewActions';

const emptyState: ReviewFormState = { error: null, success: false };

export default function ReviewForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [state, formAction] = useActionState(submitReviewAction, emptyState);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // useActionState keeps the exact same `emptyState` object reference
    // until a submission actually completes — checking identity here (not a
    // "first render" ref flag) is what keeps this safe under React
    // StrictMode's double-effect-invoke in development.
    if (state === emptyState) return;
    if (state.success) {
      formRef.current?.reset();
      setRating(0);
      const timer = setTimeout(onSubmitted, 2500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="review-form-panel">
      {state.success ? (
        <p className="review-thanks">✓ Valeu pelo comentário! Ele vai aparecer no site assim que eu aprovar.</p>
      ) : (
        <form ref={formRef} action={formAction}>
          <input type="hidden" name="rating" value={rating} />
          <div className="review-form-row">
            <div>
              <label htmlFor="review-name">Seu nome</label>
              <input id="review-name" name="name" type="text" maxLength={60} required placeholder="Ex: João" />
            </div>
            <div>
              <label htmlFor="review-instagram">Instagram (opcional)</label>
              <input id="review-instagram" name="instagram" type="text" maxLength={40} placeholder="@seuinstagram" />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label>Sua nota</label>
            <div className="review-star-picker" onMouseLeave={() => setHoverRating(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="review-star-button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHoverRating(n)}
                  aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
                  aria-pressed={rating === n}
                >
                  {(hoverRating || rating) >= n ? '★' : '☆'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label htmlFor="review-comment">Comentário</label>
            <textarea
              id="review-comment"
              name="comment"
              rows={3}
              maxLength={500}
              required
              placeholder="Conta pra gente o que achou..."
            />
          </div>

          {state.error && (
            <p style={{ color: '#ff8a8a', fontSize: 13, fontWeight: 600, margin: '0 0 14px' }}>{state.error}</p>
          )}

          <ReviewSubmitButton />
        </form>
      )}
    </div>
  );
}

function ReviewSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn primary" disabled={pending}>
      {pending ? 'Enviando...' : 'Enviar comentário'}
    </button>
  );
}
