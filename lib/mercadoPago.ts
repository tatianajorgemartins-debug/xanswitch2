// Conversa com a API do Mercado Pago — só no servidor (o Access Token é
// segredo e nunca pode ir pro navegador). Usa fetch direto em vez do SDK
// oficial: são só duas chamadas (criar um Pix e consultar um pagamento),
// não vale uma dependência a mais.
//
// Sem MP_ACCESS_TOKEN configurado, isMercadoPagoEnabled() é false e o site
// continua no Pix "estático" de sempre (lib/pix.ts), com o "Já paguei".
import { createHmac, timingSafeEqual } from 'crypto';

const API = 'https://api.mercadopago.com';

// Quanto tempo o Pix gerado vale. Depois disso o Mercado Pago cancela a
// cobrança e o cliente precisa gerar outro.
const PIX_EXPIRATION_MINUTES = 30;

export function isMercadoPagoEnabled(): boolean {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

export type MpPaymentStatus =
  | 'pending'
  | 'approved'
  | 'authorized'
  | 'in_process'
  | 'in_mediation'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'charged_back';

export type MpPayment = {
  id: number;
  status: MpPaymentStatus;
  transaction_amount: number;
  external_reference: string | null;
  point_of_interaction?: {
    transaction_data?: { qr_code?: string; qr_code_base64?: string };
  };
};

async function mpFetch<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  };
  if (init.idempotencyKey) headers['X-Idempotency-Key'] = init.idempotencyKey;
  const res = await fetch(`${API}${path}`, { ...init, headers, cache: 'no-store' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Mercado Pago ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

// O Mercado Pago pede a data no formato "2026-10-28T15:30:00.000-03:00"
// (com fuso explícito) — o "Z" do toISOString nem sempre é aceito.
function formatExpiration(date: Date): string {
  return date.toISOString().replace('Z', '+00:00');
}

// Endereço público pro Mercado Pago avisar quando o Pix cair. Só manda
// quando é um endereço https de verdade — rodando no seu computador
// (localhost) o aviso não chegaria; aí quem confirma é a própria tela do
// cliente consultando o pagamento (ver checkPixPaymentAction).
function notificationUrl(): string | undefined {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_ENV === 'production' ? 'https://www.xanswitch.com.br' : '');
  if (!base.startsWith('https://')) return undefined;
  return `${base.replace(/\/$/, '')}/api/mercadopago/webhook`;
}

export async function createPixPayment(data: {
  amount: number;
  description: string;
  payerEmail: string;
  externalReference: string;
}): Promise<{ id: string; qrCode: string; qrCodeBase64: string }> {
  const payment = await mpFetch<MpPayment>('/v1/payments', {
    method: 'POST',
    // Mesma chave = mesmo Pix: se a requisição for reenviada (conexão caiu
    // no meio), o Mercado Pago devolve a cobrança já criada em vez de outra.
    idempotencyKey: data.externalReference,
    body: JSON.stringify({
      transaction_amount: Math.round(data.amount * 100) / 100,
      description: data.description.slice(0, 120),
      payment_method_id: 'pix',
      payer: { email: data.payerEmail },
      external_reference: data.externalReference,
      notification_url: notificationUrl(),
      date_of_expiration: formatExpiration(new Date(Date.now() + PIX_EXPIRATION_MINUTES * 60 * 1000))
    })
  });
  const tx = payment.point_of_interaction?.transaction_data;
  if (!tx?.qr_code || !tx.qr_code_base64) {
    throw new Error('Mercado Pago não devolveu o QR Code do Pix.');
  }
  return { id: String(payment.id), qrCode: tx.qr_code, qrCodeBase64: tx.qr_code_base64 };
}

export async function getPayment(id: string): Promise<MpPayment> {
  return mpFetch<MpPayment>(`/v1/payments/${encodeURIComponent(id)}`);
}

// Confere se o aviso (webhook) veio mesmo do Mercado Pago: ele assina cada
// aviso com a "assinatura secreta" do painel (MP_WEBHOOK_SECRET), no header
// x-signature ("ts=...,v1=..."). O texto assinado é
// "id:<data.id>;request-id:<x-request-id>;ts:<ts>;".
export function isValidWebhookSignature(params: {
  signature: string | null;
  requestId: string | null;
  dataId: string;
}): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret || !params.signature) return false;
  const parts = Object.fromEntries(
    params.signature.split(',').map((p) => {
      const [k, ...v] = p.trim().split('=');
      return [k, v.join('=')];
    })
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  // Ids alfanuméricos chegam em minúsculas no texto assinado.
  const id = /^[a-z0-9]+$/i.test(params.dataId) ? params.dataId.toLowerCase() : params.dataId;
  let manifest = `id:${id};`;
  if (params.requestId) manifest += `request-id:${params.requestId};`;
  manifest += `ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
