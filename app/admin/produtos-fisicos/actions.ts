'use server';

// Server Actions do admin de PRODUTOS FÍSICOS — arquivo separado de
// app/admin/actions.ts (jogos digitais) de propósito: cada ação aqui só
// enxerga lib/physicalProducts.ts, nunca lib/db.ts (jogos), então não tem
// como uma operação de um catálogo acidentalmente mexer no outro, mesmo
// que alguém chame essas funções diretamente.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { uploadImageBuffer, deleteImageByUrl } from '@/lib/supabaseAdmin';
import { compressImage } from '@/lib/imageResize';
import {
  createPhysicalProduct,
  updatePhysicalProduct,
  deletePhysicalProduct,
  setPhysicalProductPublished,
  getPhysicalProductById
} from '@/lib/physicalProducts';

// Mesma checagem de sessão usada em app/admin/actions.ts — é o mesmo login
// de admin pros dois catálogos (não existem contas separadas), só a ÁREA
// de gerenciamento é separada.
async function requireAuth(): Promise<void> {
  const authed = await isAuthenticated();
  if (!authed) {
    redirect('/admin/login');
  }
}

// IMPORTANTE: um módulo 'use server' só pode exportar funções async em
// tempo de execução — por isso o valor inicial do formulário
// (emptyFormState, equivalente) é definido direto em
// PhysicalProductsAdminClient.tsx, não aqui.
export type PhysicalProductFormState = { error: string | null };

async function uploadImageIfPresent(formData: FormData): Promise<string | null | undefined> {
  const file = formData.get('image');
  if (!file || !(file instanceof File) || file.size === 0) {
    return undefined;
  }
  const originalBytes = Buffer.from(await file.arrayBuffer());
  const { buffer, contentType, extension } = await compressImage(originalBytes, 900, 80);
  return uploadImageBuffer(`produtos-fisicos/${Date.now()}-foto.${extension}`, buffer, contentType);
}

function parseProductFields(formData: FormData): {
  name: string;
  price: number;
  originalPrice: number | null;
  description: string | null;
  published: boolean;
  isDemo: boolean;
  error: string | null;
} {
  const name = String(formData.get('name') || '').trim();
  const priceRaw = String(formData.get('price') || '0');
  const price = parseFloat(priceRaw.replace(',', '.'));
  const originalPriceRaw = String(formData.get('originalPrice') || '').trim();
  const originalPrice = originalPriceRaw ? parseFloat(originalPriceRaw.replace(',', '.')) : null;
  const description = String(formData.get('description') || '').trim() || null;
  const published = formData.get('published') === 'on';
  const isDemo = formData.get('isDemo') === 'on';

  if (!name) return { name, price, originalPrice, description, published, isDemo, error: 'Digite o nome do produto.' };
  if (Number.isNaN(price) || price < 0) {
    return { name, price, originalPrice, description, published, isDemo, error: 'Preço inválido.' };
  }
  if (originalPrice !== null && (Number.isNaN(originalPrice) || originalPrice < 0)) {
    return { name, price, originalPrice, description, published, isDemo, error: 'Preço original inválido.' };
  }

  return { name, price, originalPrice, description, published, isDemo, error: null };
}

export async function createPhysicalProductAction(
  _prevState: PhysicalProductFormState,
  formData: FormData
): Promise<PhysicalProductFormState> {
  await requireAuth();

  const fields = parseProductFields(formData);
  if (fields.error) return { error: fields.error };

  const imageUrl = (await uploadImageIfPresent(formData)) ?? null;

  await createPhysicalProduct({
    name: fields.name,
    price: fields.price,
    original_price: fields.originalPrice,
    image_url: imageUrl,
    description: fields.description,
    published: fields.published,
    is_demo: fields.isDemo
  });

  revalidatePath('/admin/produtos-fisicos');
  revalidatePath('/produtos-fisicos');
  return { error: null };
}

export async function updatePhysicalProductAction(
  _prevState: PhysicalProductFormState,
  formData: FormData
): Promise<PhysicalProductFormState> {
  await requireAuth();

  const id = parseInt(String(formData.get('id') || ''), 10);
  if (!id) return { error: 'Produto inválido.' };

  const fields = parseProductFields(formData);
  if (fields.error) return { error: fields.error };

  const existing = await getPhysicalProductById(id);
  if (!existing) return { error: 'Produto não encontrado.' };

  const removeImage = formData.get('removeImage') === 'on';
  let imageUrl: string | null = existing.image_url;
  const newImageUrl = await uploadImageIfPresent(formData);
  if (newImageUrl !== undefined) {
    if (existing.image_url) await deleteImageByUrl(existing.image_url).catch(() => {});
    imageUrl = newImageUrl;
  } else if (removeImage) {
    if (existing.image_url) await deleteImageByUrl(existing.image_url).catch(() => {});
    imageUrl = null;
  }

  await updatePhysicalProduct(id, {
    name: fields.name,
    price: fields.price,
    original_price: fields.originalPrice,
    image_url: imageUrl,
    description: fields.description,
    published: fields.published,
    is_demo: fields.isDemo
  });

  revalidatePath('/admin/produtos-fisicos');
  revalidatePath('/produtos-fisicos');
  return { error: null };
}

export async function deletePhysicalProductAction(id: number): Promise<void> {
  await requireAuth();
  const existing = await getPhysicalProductById(id);
  if (existing?.image_url) {
    await deleteImageByUrl(existing.image_url).catch(() => {});
  }
  await deletePhysicalProduct(id);
  revalidatePath('/admin/produtos-fisicos');
  revalidatePath('/produtos-fisicos');
}

export async function setPhysicalProductPublishedAction(id: number, published: boolean): Promise<void> {
  await requireAuth();
  await setPhysicalProductPublished(id, published);
  revalidatePath('/admin/produtos-fisicos');
  revalidatePath('/produtos-fisicos');
}
