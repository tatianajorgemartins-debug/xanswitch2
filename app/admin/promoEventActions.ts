'use server';

// Ações dos eventos de promoção (/admin > 🏷️ Promoções — PromoEventsPanel.tsx).
import { revalidatePath } from 'next/cache';
import { isAuthenticated } from '@/lib/auth';
import { deletePromoEvent, savePromoEvent, setPromoEventEnabled } from '@/lib/db';

export type PromoEventInput = {
  id: number | null;
  name: string;
  tagText: string;
  tagColor: string;
  discountType: string;
  discountValue: string;
  startsAt: string; // AAAA-MM-DDTHH:MM, horário de Brasília
  endsAt: string; // idem, ou vazio
  enabled: boolean;
  gameIds: number[];
};

type Result = { ok: true } | { ok: false; error: string };

const MIGRATION_HINT =
  'Não deu pra salvar. Se ainda não rodou, rode db/migration-eventos-promocao.sql no Neon e tente de novo.';

// "2026-11-27T00:00" (Brasília) → ISO com fuso.
function toIso(local: string): string | null {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) ? `${local}:00-03:00` : null;
}

// Atualiza na hora a loja inteira (catálogo, páginas de jogo e franquia).
function refreshSite() {
  revalidatePath('/', 'layout');
}

export async function savePromoEventAction(input: PromoEventInput): Promise<Result> {
  if (!(await isAuthenticated())) return { ok: false, error: 'Sua sessão do admin expirou. Entre de novo.' };

  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false, error: 'Dê um nome pra promoção (ex: Black Friday 2026).' };
  const tagText = input.tagText.trim().toUpperCase().slice(0, 24);
  if (!tagText) return { ok: false, error: 'Escreva o texto da etiqueta (ex: BLACK FRIDAY).' };
  const tagColor = /^#[0-9a-f]{6}$/i.test(input.tagColor) ? input.tagColor : '#111111';
  if (input.discountType !== 'fixed' && input.discountType !== 'percent') return { ok: false, error: 'Escolha o tipo de desconto.' };
  const value = Number(input.discountValue.trim().replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return { ok: false, error: 'Digite o valor do desconto (ex: 15).' };
  if (input.discountType === 'percent' && value > 95) return { ok: false, error: 'O desconto em % vai até 95%.' };
  const startsAt = toIso(input.startsAt);
  if (!startsAt) return { ok: false, error: 'Escolha a data e a hora em que a promoção começa.' };
  const endsAt = input.endsAt ? toIso(input.endsAt) : null;
  if (input.endsAt && !endsAt) return { ok: false, error: 'A data de término parece errada.' };
  if (endsAt && new Date(endsAt) <= new Date(startsAt)) return { ok: false, error: 'O término precisa ser depois do começo.' };
  const gameIds = Array.from(new Set(input.gameIds.filter((n) => Number.isInteger(n) && n > 0))).slice(0, 2000);
  if (gameIds.length === 0) return { ok: false, error: 'Selecione pelo menos um jogo.' };

  try {
    await savePromoEvent(input.id, {
      name,
      tag_text: tagText,
      tag_color: tagColor,
      discount_type: input.discountType,
      discount_value: Math.round(value * 100) / 100,
      starts_at: startsAt,
      ends_at: endsAt,
      enabled: input.enabled,
      game_ids: gameIds
    });
  } catch (err) {
    console.error('[promoções] savePromoEvent', err);
    return { ok: false, error: MIGRATION_HINT };
  }
  refreshSite();
  return { ok: true };
}

export async function setPromoEventEnabledAction(id: number, enabled: boolean): Promise<Result> {
  if (!(await isAuthenticated())) return { ok: false, error: 'Sua sessão do admin expirou. Entre de novo.' };
  try {
    await setPromoEventEnabled(id, enabled);
  } catch {
    return { ok: false, error: MIGRATION_HINT };
  }
  refreshSite();
  return { ok: true };
}

export async function deletePromoEventAction(id: number): Promise<Result> {
  if (!(await isAuthenticated())) return { ok: false, error: 'Sua sessão do admin expirou. Entre de novo.' };
  try {
    await deletePromoEvent(id);
  } catch {
    return { ok: false, error: MIGRATION_HINT };
  }
  refreshSite();
  return { ok: true };
}
