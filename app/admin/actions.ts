'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { put, del } from '@vercel/blob';
import { compressImage } from '@/lib/imageResize';
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
  getGameById,
  setReviewApproved,
  setReviewFeatured,
  deleteReview,
  deleteOrder,
  type Platform,
  type GameType
} from '@/lib/db';

const PLATFORMS: Platform[] = ['switch1', 'switch2', 'both'];
const GAME_TYPES: GameType[] = ['base', 'dlc', 'update'];
const MAX_SCREENSHOTS = 10;

// As capturas de tela já chegam como URLs prontas (o navegador faz o upload
// direto pro Vercel Blob antes de enviar o formulário — veja o componente
// ScreenshotsField no AdminClient.tsx), então aqui é só ler a lista de
// campos hidden "screenshots" que o formulário manda.
function parseScreenshots(formData: FormData): string[] {
  return formData
    .getAll('screenshots')
    .map((v) => String(v).trim())
    .filter(Boolean)
    .slice(0, MAX_SCREENSHOTS);
}

function parsePlatform(value: FormDataEntryValue | null): Platform {
  const v = String(value || '');
  return (PLATFORMS as string[]).includes(v) ? (v as Platform) : 'switch2';
}

function parseGameType(value: FormDataEntryValue | null): GameType {
  const v = String(value || '');
  return (GAME_TYPES as string[]).includes(v) ? (v as GameType) : 'base';
}

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
  // Capas são sempre mostradas pequenas (cards, miniaturas) — não faz
  // sentido guardar (e reenviar pra cada visitante) a foto original em
  // resolução de câmera. 900px já é mais do que suficiente mesmo em telas
  // retina, e o WebP fica bem mais leve que o JPEG/PNG original.
  const originalBytes = Buffer.from(await file.arrayBuffer());
  const { buffer, contentType, extension } = await compressImage(originalBytes, 900, 80);

  const blob = await put(`games/${Date.now()}-capa.${extension}`, buffer, {
    access: 'public',
    contentType
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
  const franchise = String(formData.get('franchise') || '').trim() || null;
  const platform = parsePlatform(formData.get('platform'));
  const gameType = parseGameType(formData.get('gameType'));
  const isFeatured = formData.get('isFeatured') === 'on';
  const isBestseller = formData.get('isBestseller') === 'on';
  const isUpcoming = formData.get('isUpcoming') === 'on';
  const description = String(formData.get('description') || '').trim() || null;
  const screenshots = parseScreenshots(formData);

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
    badge_color: badgeColor,
    franchise,
    platform,
    game_type: gameType,
    is_featured: isFeatured,
    is_bestseller: isBestseller,
    is_upcoming: isUpcoming,
    description,
    screenshots
  });

  revalidatePath('/admin');
  revalidatePath('/');
  updateTag('games');
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
  const franchise = String(formData.get('franchise') || '').trim() || null;
  const platform = parsePlatform(formData.get('platform'));
  const gameType = parseGameType(formData.get('gameType'));
  const isFeatured = formData.get('isFeatured') === 'on';
  const isBestseller = formData.get('isBestseller') === 'on';
  const isUpcoming = formData.get('isUpcoming') === 'on';
  const description = String(formData.get('description') || '').trim() || null;
  const screenshots = parseScreenshots(formData);

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

  // Qualquer captura de tela que estava salva antes mas não veio na lista
  // nova foi removida pelo admin — apaga o arquivo do Vercel Blob também,
  // senão ele fica ocupando espaço pra sempre sem ninguém usar.
  const removedScreenshots = existing.screenshots.filter((url) => !screenshots.includes(url));
  await Promise.all(removedScreenshots.map((url) => del(url).catch(() => {})));

  await updateGame(id, {
    name,
    price,
    original_price: originalPrice,
    image_url: imageUrl,
    has_badge: hasBadge,
    badge_text: badgeText,
    badge_color: badgeColor,
    franchise,
    platform,
    game_type: gameType,
    is_featured: isFeatured,
    is_bestseller: isBestseller,
    is_upcoming: isUpcoming,
    description,
    screenshots
  });

  revalidatePath('/admin');
  revalidatePath('/');
  updateTag('games');
  return { error: null };
}

export async function archiveGameAction(id: number, archived: boolean): Promise<void> {
  await requireAuth();
  await setArchived(id, archived);
  revalidatePath('/admin');
  revalidatePath('/');
  updateTag('games');
}

export async function deleteGameAction(id: number): Promise<void> {
  await requireAuth();
  const existing = await getGameById(id);
  if (existing?.image_url) {
    await del(existing.image_url).catch(() => {});
  }
  if (existing?.screenshots.length) {
    await Promise.all(existing.screenshots.map((url) => del(url).catch(() => {})));
  }
  await deleteGame(id);
  revalidatePath('/admin');
  revalidatePath('/');
  updateTag('games');
}

export async function approveReviewAction(id: number): Promise<void> {
  await requireAuth();
  await setReviewApproved(id, true);
  revalidatePath('/admin');
  revalidatePath('/');
  updateTag('reviews');
}

export async function deleteReviewAction(id: number): Promise<void> {
  await requireAuth();
  await deleteReview(id);
  revalidatePath('/admin');
  revalidatePath('/');
  updateTag('reviews');
}

export async function setReviewFeaturedAction(id: number, featured: boolean): Promise<void> {
  await requireAuth();
  await setReviewFeatured(id, featured);
  revalidatePath('/admin');
  revalidatePath('/');
  updateTag('reviews');
}

// Apaga um registro do histórico de pedidos (ex: depois de já ter
// conversado com o cliente no WhatsApp e resolvido tudo, pra deixar a lista
// limpa). Isso NÃO cancela nem estorna nada — é só um histórico local, sem
// ligação com pagamento de verdade.
export async function deleteOrderAction(id: number): Promise<void> {
  await requireAuth();
  await deleteOrder(id);
  revalidatePath('/admin');
}
