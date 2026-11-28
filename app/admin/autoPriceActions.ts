'use server';

// Ações do preço automático pela Amazon JP (/admin > 🎮 Jogos —
// AutoPricePanel.tsx). Regras em lib/autoPricing.ts.
import { revalidatePath } from 'next/cache';
import { isAuthenticated } from '@/lib/auth';
import { getSql } from '@/lib/sql';
import { setSiteSetting } from '@/lib/db';
import {
  AUTO_PRICE_ENABLED_KEY,
  AUTO_PRICE_MARGIN_KEY,
  AUTO_PRICE_SPREAD_KEY,
  runAutoPricing,
  type AutoPriceRun
} from '@/lib/autoPricing';

type Result = { ok: true } | { ok: false; error: string };

export async function updateAutoPriceSettingsAction(enabled: boolean, margin: number, spread: number): Promise<Result> {
  if (!(await isAuthenticated())) return { ok: false, error: 'Faça login de novo.' };
  if (!Number.isFinite(margin) || margin < 0 || margin > 500) return { ok: false, error: 'Margem inválida.' };
  if (!Number.isFinite(spread) || spread < 0 || spread > 30) return { ok: false, error: 'Acréscimo do cartão inválido (0 a 30%).' };
  await setSiteSetting(AUTO_PRICE_ENABLED_KEY, enabled ? 'true' : 'false');
  await setSiteSetting(AUTO_PRICE_MARGIN_KEY, String(margin));
  await setSiteSetting(AUTO_PRICE_SPREAD_KEY, String(spread));
  revalidatePath('/admin');
  return { ok: true };
}

export async function setGameAutoPriceAction(id: number, autoPrice: boolean): Promise<Result> {
  if (!(await isAuthenticated())) return { ok: false, error: 'Faça login de novo.' };
  await getSql()`UPDATE games SET auto_price = ${autoPrice} WHERE id = ${id}`;
  revalidatePath('/admin');
  return { ok: true };
}

export async function runAutoPricingNowAction(): Promise<{ ok: true; run: AutoPriceRun } | { ok: false; error: string }> {
  if (!(await isAuthenticated())) return { ok: false, error: 'Faça login de novo.' };
  try {
    const run = await runAutoPricing('manual');
    revalidatePath('/admin');
    return { ok: true, run };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Falha ao atualizar os preços.' };
  }
}
