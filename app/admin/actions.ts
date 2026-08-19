'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { put, del } from '@vercel/blob';
import {
  checkPassword,
  createSession,
  destroySession,
  isAuthenticated
} from '@/lib/auth';
import {
  createGame,
  updateGame,
  deleteGame,
  setArchived,
  getGameById
} from '@/lib/db';

// Server Actions can be invoked directly (e.g. a crafted request to the
// action's endpoint), bypassing whatever check ran on the page that
// rendered the button — so every mutating action re-checks auth itself
// rather than trusting that the caller only reached this code through an
// already-protected page.
async function requireAuth(): Promise<void> {
  const authed = await isAuthenticated();
  if (!authed) {
    redirect('/admin/login');
  }
}

export type LoginState = { error: string | null };

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const password = String(formData.get('password') || '');
  const ok = await checkPassword(password);
  if (!ok) {
    return { error: 'Senha incorreta. Tente de novo.' };
  }
  await createSession();
  redirect('/admin');
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/admin/login');
}

async function uploadImageIfPresent(formData: FormData): Promise<string | null | undefined> {
  const file = formData.get('image');
  if (!file || !(file instanceof File) || file.size === 0) {
    // no new image chosen — caller decides whether to keep the existing one
    return undefined;
  }
  const blob = await put(`games/${Date.now()}-${file.name}`, file, {
    access: 'public'
  });
  return blob.url;
}

export type GameFormState = { error: string | null };

export async function createGameAction(
  _prevState: GameFormState,
  formData: FormData
): Promise<GameFormState> {
  await requireAuth();

  const name = String(formData.get('name') || '').trim();
  const priceRaw = String(formData.get('price') || '0');
  const price = parseFloat(priceRaw.replace(',', '.'));
  const originalPriceRaw = String(formData.get('originalPrice') || '').trim();
  const originalPrice = originalPriceRaw ? parseFloat(originalPriceRaw.replace(',', '.')) : null;
  const hasBadge = formData.get('hasBadge') === 'on';
  const badgeText = String(formData.get('badgeText') || 'TOP').trim() || 'TOP';
  const badgeColor = String(formData.get('badgeColor') || '#4ef05f');

  if (!name) return { error: 'Digite o nome do jogo.' };
  if (Number.isNaN(price) || price < 0) return { error: 'Preço inválido.' };
  if (originalPrice !== null && (Number.isNaN(originalPrice) || originalPrice < 0)) {
    return { error: 'Preço original inválido.' };
  }

  const imageUrl = (await uploadImageIfPresent(formData)) ?? null;

  await createGame({
    name,
    price,
    original_price: originalPrice,
    image_url: imageUrl,
    has_badge: hasBadge,
    badge_text: badgeText,
    badge_color: badgeColor
  });

  revalidatePath('/admin');
  revalidatePath('/');
  return { error: null };
}

export async function updateGameAction(
  _prevState: GameFormState,
  formData: FormData
): Promise<GameFormState> {
  await requireAuth();

  const id = parseInt(String(formData.get('id') || ''), 10);
  const name = String(formData.get('name') || '').trim();
  const priceRaw = String(formData.get('price') || '0');
  const price = parseFloat(priceRaw.replace(',', '.'));
  const originalPriceRaw = String(formData.get('originalPrice') || '').trim();
  const originalPrice = originalPriceRaw ? parseFloat(originalPriceRaw.replace(',', '.')) : null;
  const hasBadge = formData.get('hasBadge') === 'on';
  const badgeText = String(formData.get('badgeText') || 'TOP').trim() || 'TOP';
  const badgeColor = String(formData.get('badgeColor') || '#4ef05f');
  const removeImage = formData.get('removeImage') === 'on';

  if (!id) return { error: 'Jogo inválido.' };
  if (!name) return { error: 'Digite o nome do jogo.' };
  if (Number.isNaN(price) || price < 0) return { error: 'Preço inválido.' };
  if (originalPrice !== null && (Number.isNaN(originalPrice) || originalPrice < 0)) {
    return { error: 'Preço original inválido.' };
  }

  const existing = await getGameById(id);
  if (!existing) return { error: 'Jogo não encontrado.' };

  let imageUrl: string | null = existing.image_url;
  const newImageUrl = await uploadImageIfPresent(formData);
  if (newImageUrl !== undefined) {
    // a new file was uploaded — replace, and clean up the old blob if any
    if (existing.image_url) {
      await del(existing.image_url).catch(() => {});
    }
    imageUrl = newImageUrl;
  } else if (removeImage) {
    if (existing.image_url) {
      await del(existing.image_url).catch(() => {});
    }
    imageUrl = null;
  }

  await updateGame(id, {
    name,
    price,
    original_price: originalPrice,
    image_url: imageUrl,
    has_badge: hasBadge,
    badge_text: badgeText,
    badge_color: badgeColor
  });

  revalidatePath('/admin');
  revalidatePath('/');
  return { error: null };
}

export async function archiveGameAction(id: number, archived: boolean): Promise<void> {
  await requireAuth();
  await setArchived(id, archived);
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function deleteGameAction(id: number): Promise<void> {
  await requireAuth();
  const existing = await getGameById(id);
  if (existing?.image_url) {
    await del(existing.image_url).catch(() => {});
  }
  await deleteGame(id);
  revalidatePath('/admin');
  revalidatePath('/');
}
