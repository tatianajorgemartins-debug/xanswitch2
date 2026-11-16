'use server';

// Ações do banner promocional (/admin > 🏷️ Promoções — PromoBannerPanel.tsx).
// Regras e formato em lib/promoBanner.ts.
import { revalidatePath } from 'next/cache';
import { isAuthenticated } from '@/lib/auth';
import { getSiteSetting, setSiteSetting } from '@/lib/db';
import { compressImage } from '@/lib/imageResize';
import { deleteImageByUrl, uploadImageBuffer } from '@/lib/supabaseAdmin';
import { parsePromoBanner, PROMO_BANNER_KEY, type PromoBannerSetting } from '@/lib/promoBanner';

type Result = { ok: true } | { ok: false; error: string };

// "2026-11-27T00:00" (Brasília) → ISO com fuso.
function toIso(local: string): string | null {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) ? `${local}:00-03:00` : null;
}

async function uploadIfPresent(file: FormDataEntryValue | null, name: string): Promise<string | null> {
  if (!file || !(file instanceof File) || file.size === 0) return null;
  const { buffer, contentType, extension } = await compressImage(Buffer.from(await file.arrayBuffer()), 1800, 82);
  return uploadImageBuffer(`site/${Date.now()}-${name}.${extension}`, buffer, contentType);
}

function refresh() {
  revalidatePath('/admin');
  revalidatePath('/', 'layout');
}

// Campos do formulário: image, mobileImage (arquivos, opcionais ao editar),
// removeMobile ('1' tira a arte do celular), alt, action, eventId (com
// action 'event': a promoção cujos jogos o clique mostra), startsAt, endsAt
// (AAAA-MM-DDTHH:MM, Brasília; endsAt pode vir vazio) e enabled ('1'/'0').
export async function savePromoBannerAction(formData: FormData): Promise<Result> {
  if (!(await isAuthenticated())) return { ok: false, error: 'Sua sessão do admin expirou. Entre de novo.' };

  const previous = parsePromoBanner(await getSiteSetting(PROMO_BANNER_KEY));
  const startsAt = toIso(String(formData.get('startsAt') ?? ''));
  if (!startsAt) return { ok: false, error: 'Escolha a data e a hora em que o banner começa a aparecer.' };
  const endsRaw = String(formData.get('endsAt') ?? '');
  const endsAt = endsRaw ? toIso(endsRaw) : null;
  if (endsRaw && !endsAt) return { ok: false, error: 'A data de término parece errada.' };
  if (endsAt && new Date(endsAt) <= new Date(startsAt)) return { ok: false, error: 'O término precisa ser depois do começo.' };

  let newImage: string | null;
  let newMobile: string | null;
  try {
    newImage = await uploadIfPresent(formData.get('image'), 'banner-promocional');
    newMobile = await uploadIfPresent(formData.get('mobileImage'), 'banner-promocional-celular');
  } catch (err) {
    console.error('[banner promocional] envio da imagem', err);
    return { ok: false, error: 'Não deu pra enviar a imagem. Tente de novo ou use outro arquivo (JPG ou PNG).' };
  }
  const imageUrl = newImage ?? previous?.imageUrl ?? null;
  if (!imageUrl) return { ok: false, error: 'Escolha a imagem do banner.' };
  const removeMobile = formData.get('removeMobile') === '1';
  const mobileImageUrl = newMobile ?? (removeMobile ? null : (previous?.mobileImageUrl ?? null));

  const rawAction = String(formData.get('action') ?? '');
  const action = rawAction === 'none' ? 'none' : rawAction === 'event' ? 'event' : 'sale';
  const eventId = Number(formData.get('eventId'));
  if (action === 'event' && !(Number.isInteger(eventId) && eventId > 0)) {
    return { ok: false, error: 'Escolha a promoção cujos jogos o banner vai mostrar.' };
  }

  const setting: PromoBannerSetting = {
    imageUrl,
    mobileImageUrl,
    alt: String(formData.get('alt') ?? '').trim().slice(0, 120),
    action,
    eventId: action === 'event' ? eventId : null,
    startsAt,
    endsAt,
    enabled: formData.get('enabled') !== '0'
  };
  await setSiteSetting(PROMO_BANNER_KEY, JSON.stringify(setting));

  // Apaga do armazenamento as imagens que saíram de uso.
  if (previous && previous.imageUrl !== imageUrl) await deleteImageByUrl(previous.imageUrl).catch(() => {});
  if (previous?.mobileImageUrl && previous.mobileImageUrl !== mobileImageUrl) {
    await deleteImageByUrl(previous.mobileImageUrl).catch(() => {});
  }
  refresh();
  return { ok: true };
}

export async function setPromoBannerEnabledAction(enabled: boolean): Promise<Result> {
  if (!(await isAuthenticated())) return { ok: false, error: 'Sua sessão do admin expirou. Entre de novo.' };
  const previous = parsePromoBanner(await getSiteSetting(PROMO_BANNER_KEY));
  if (!previous) return { ok: false, error: 'Ainda não tem banner salvo.' };
  await setSiteSetting(PROMO_BANNER_KEY, JSON.stringify({ ...previous, enabled }));
  refresh();
  return { ok: true };
}

export async function removePromoBannerAction(): Promise<Result> {
  if (!(await isAuthenticated())) return { ok: false, error: 'Sua sessão do admin expirou. Entre de novo.' };
  const previous = parsePromoBanner(await getSiteSetting(PROMO_BANNER_KEY));
  await setSiteSetting(PROMO_BANNER_KEY, null);
  if (previous) {
    await deleteImageByUrl(previous.imageUrl).catch(() => {});
    if (previous.mobileImageUrl) await deleteImageByUrl(previous.mobileImageUrl).catch(() => {});
  }
  refresh();
  return { ok: true };
}
