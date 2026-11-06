// Regras do controle de vendas (/admin > 📊 Vendas), usadas no navegador e
// no servidor: status, formas de pagamento e a conta do lucro.
//
// O preço gravado na venda já é o que fica pra você: a taxa do Mercado Pago
// é repassada pro cliente por cima (ver lib/paymentFees.ts). Por isso o
// lucro é preço − custo da chave − taxa extra (normalmente zero).

import type { Order } from './db';

export const SALE_STATUSES = [
  { id: 'aguardando_codigo', label: 'A entregar', emoji: '⏳' },
  { id: 'concluido', label: 'Concluída', emoji: '✅' },
  { id: 'cancelado', label: 'Cancelada', emoji: '✖' }
] as const;

export type SaleStatus = (typeof SALE_STATUSES)[number]['id'];

// 'codigo_enviado' (versões antigas) também é venda terminada.
export function normalizeStatus(status: string | null | undefined): SaleStatus {
  if (status === 'concluido' || status === 'codigo_enviado') return 'concluido';
  if (status === 'cancelado') return 'cancelado';
  return 'aguardando_codigo';
}

export function statusLabel(status: string): string {
  const s = SALE_STATUSES.find((x) => x.id === normalizeStatus(status))!;
  return `${s.emoji} ${s.label}`;
}

// Formas de pagamento: as do site e as de vendas lançadas à mão.
export const PAYMENT_METHODS = [
  { id: 'pix', label: 'Pix' },
  { id: 'cartao', label: 'Cartão' },
  { id: 'pix+cartao', label: 'Pix + cartão' },
  { id: 'credito', label: 'Crédito parcelado' },
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'outro', label: 'Outro' }
] as const;

export function paymentLabel(method: string | null | undefined): string {
  return PAYMENT_METHODS.find((m) => m.id === method)?.label ?? (method || '—');
}

export function toNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

// null = custo ainda não informado (não dá pra saber o lucro).
export function saleProfit(o: Pick<Order, 'price' | 'cost' | 'fee'>): number | null {
  const cost = toNumber(o.cost);
  if (cost === null) return null;
  return (toNumber(o.price) ?? 0) - cost - (toNumber(o.fee) ?? 0);
}

// Quem comprou, do jeito mais legível disponível.
export function saleCustomer(o: Pick<Order, 'customer_name' | 'customer_email' | 'customer_whatsapp'>): string {
  return o.customer_name || o.customer_email || (o.customer_whatsapp ? `+${o.customer_whatsapp}` : '') || '—';
}
