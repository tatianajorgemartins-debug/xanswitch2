'use server';

import { revalidatePath } from 'next/cache';
import { createReview } from '@/lib/db';

export type ReviewFormState = { error: string | null; success: boolean };

export async function submitReviewAction(
  _prevState: ReviewFormState,
  formData: FormData
): Promise<ReviewFormState> {
  const name = String(formData.get('name') || '').trim();
  const instagram = String(formData.get('instagram') || '').trim() || null;
  const rating = parseInt(String(formData.get('rating') || ''), 10);
  const comment = String(formData.get('comment') || '').trim();

  if (!name) return { error: 'Digite seu nome.', success: false };
  if (name.length > 60) return { error: 'Nome muito longo.', success: false };
  if (instagram && instagram.length > 40) return { error: 'Instagram muito longo.', success: false };
  if (Number.isNaN(rating) || rating < 1 || rating > 5) {
    return { error: 'Escolha uma nota de 1 a 5 estrelas.', success: false };
  }
  if (!comment) return { error: 'Escreva um comentário.', success: false };
  if (comment.length > 500) return { error: 'Comentário muito longo (máximo 500 caracteres).', success: false };

  await createReview({ name, instagram, rating, comment });

  // The review isn't public yet (pending approval) — only the admin queue
  // needs to know about it right away.
  revalidatePath('/admin');
  return { error: null, success: true };
}
