'use server';

// Ações do controle de vendas (/admin > 📊 Vendas — SalesPanel.tsx).
import { revalidatePath } from 'next/cache';
import { isAuthenticated } from '@/lib/auth';
import { createManualSale, setSaleCost, setSalesStatus, updateSale, type SaleFields } from '@/lib/db';
import { PAYMENT_METHODS, SALE_STATUSES } from '@/lib/sales';
import { normalizeWhatsApp } from '@/lib/validation';

export type SaleInput = {
  gameId: number | null;
  gameName: string;
  price: string;
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  paymentMethod: string;
  status: string;
  cost: string;
  fee: string;
  notes: string;
  date: string; // AAAA-MM-DD
};

type Result = { ok: true } | { ok: false; error: string };

const MIGRATION_HINT =
  'Não deu pra salvar. Se ainda não rodou, rode db/migration-controle-vendas.sql no Neon e tente de novo.';

// "199,90" ou "199.90" → 199.9; vazio → null.
function parseMoney(raw: string): number | null | 'invalid' {
  const t = raw.trim().replace(/\s|R\$/g, '');
  if (!t) return null;
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 && n < 1_000_000 ? Math.round(n * 100) / 100 : 'invalid';
}

function parseInput(input: SaleInput): SaleFields | string {
  const gameName = input.gameName.trim();
  if (!gameName) return 'Escolha ou digite o nome do jogo.';
  const price = parseMoney(input.price);
  if (price === null || price === 'invalid') return 'Digite o valor da venda (ex: 199,90).';
  const cost = parseMoney(input.cost);
  if (cost === 'invalid') return 'O custo precisa ser um valor (ex: 120,00).';
  const fee = parseMoney(input.fee);
  if (fee === 'invalid') return 'A taxa precisa ser um valor (ex: 5,00).';
  if (!PAYMENT_METHODS.some((m) => m.id === input.paymentMethod)) return 'Escolha a forma de pagamento.';
  if (!SALE_STATUSES.some((s) => s.id === input.status)) return 'Escolha a situação da venda.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return 'Escolha a data da venda.';
  const email = input.customerEmail.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'O e-mail do cliente parece errado.';
  const whatsapp = normalizeWhatsApp(input.customerWhatsapp);
  if (input.customerWhatsapp.trim() && !whatsapp) return 'O WhatsApp precisa ter DDD + número (ex: 21 99999-8888).';

  return {
    game_id: input.gameId,
    game_name: gameName.slice(0, 200),
    price,
    customer_email: email || null,
    customer_name: input.customerName.trim().slice(0, 120) || null,
    customer_whatsapp: whatsapp,
    payment_method: input.paymentMethod,
    status: input.status,
    cost,
    fee,
    notes: input.notes.trim().slice(0, 1000) || null,
    // Meio-dia de Brasília: a data não "pula" de dia por causa do fuso.
    created_at: `${input.date}T12:00:00-03:00`
  };
}

async function guard(): Promise<string | null> {
  return (await isAuthenticated()) ? null : 'Sua sessão do admin expirou. Entre de novo.';
}

export async function updateSaleAction(id: number, input: SaleInput): Promise<Result> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  const fields = parseInput(input);
  if (typeof fields === 'string') return { ok: false, error: fields };
  try {
    await updateSale(id, fields);
  } catch (err) {
    console.error('[vendas] updateSale', err);
    return { ok: false, error: MIGRATION_HINT };
  }
  revalidatePath('/admin');
  return { ok: true };
}

export async function createManualSaleAction(input: SaleInput): Promise<Result> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  const fields = parseInput(input);
  if (typeof fields === 'string') return { ok: false, error: fields };
  try {
    await createManualSale(fields);
  } catch (err) {
    console.error('[vendas] createManualSale', err);
    return { ok: false, error: MIGRATION_HINT };
  }
  revalidatePath('/admin');
  return { ok: true };
}

export async function setSaleCostAction(id: number, rawCost: string): Promise<Result> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  const cost = parseMoney(rawCost);
  if (cost === 'invalid') return { ok: false, error: 'Valor inválido.' };
  try {
    await setSaleCost(id, cost);
  } catch (err) {
    console.error('[vendas] setSaleCost', err);
    return { ok: false, error: MIGRATION_HINT };
  }
  revalidatePath('/admin');
  return { ok: true };
}

export async function setSalesStatusAction(ids: number[], status: string): Promise<Result> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  if (!SALE_STATUSES.some((s) => s.id === status)) return { ok: false, error: 'Situação inválida.' };
  const clean = ids.filter((n) => Number.isInteger(n) && n > 0).slice(0, 5000);
  try {
    await setSalesStatus(clean, status);
  } catch (err) {
    console.error('[vendas] setSalesStatus', err);
    return { ok: false, error: MIGRATION_HINT };
  }
  revalidatePath('/admin');
  return { ok: true };
}
