// Conversa com a API do Mercado Pago — só no servidor (o Access Token é
// segredo e nunca pode ir pro navegador). Usa fetch direto em vez do SDK
// oficial: são só duas chamadas (criar um Pix e consultar), não vale uma
// dependência a mais.
//
// Usa a "Orders API" (/v1/orders), a mais nova: aplicações criadas em contas
// novas do Mercado Pago só funcionam nela — a antiga /v1/payments recusa as
// credenciais com "Unauthorized use of live credentials".
//
// Sem MP_ACCESS_TOKEN configurado, isMercadoPagoEnabled() é false e o site
// continua no Pix "estático" de sempre (lib/pix.ts), com o "Já paguei".
import { createHmac, timingSafeEqual } from 'crypto';

const API = 'https://api.mercadopago.com';

// Quanto tempo o Pix gerado vale (duração no formato ISO 8601 — "PT30M" =
// 30 minutos, o mínimo aceito). Depois disso o Mercado Pago cancela a
// cobrança e o cliente precisa gerar outro.
const PIX_EXPIRATION = 'PT30M';

export function isMercadoPagoEnabled(): boolean {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

type MpOrder = {
  id: string;
  status: string; // created | action_required | processing | processed | failed | canceled | expired | refunded | charged_back
  status_detail: string; // ex: waiting_transfer, accredited, expired
  total_amount: string;
  external_reference: string | null;
  transactions?: {
    payments?: {
      payment_method?: { qr_code?: string; qr_code_base64?: string };
    }[];
  };
};

// Em que pé está a cobrança, já traduzido pro que o site precisa saber.
export type MpOrderState = {
  status: 'approved' | 'pending' | 'failed';
  rawStatus: string; // o status original do Mercado Pago, guardado no banco
  amount: number;
};

// Erro da API do Mercado Pago, com o status e o corpo da resposta — o
// cartão recusado, por exemplo, volta como 402 trazendo a cobrança
// recusada no corpo (ver createCardPayment).
export class MercadoPagoError extends Error {
  constructor(
    readonly status: number,
    readonly body: string
  ) {
    super(`Mercado Pago ${status}: ${body.slice(0, 300)}`);
  }
}

async function mpFetch<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  };
  if (init.idempotencyKey) headers['X-Idempotency-Key'] = init.idempotencyKey;
  const res = await fetch(`${API}${path}`, { ...init, headers, cache: 'no-store' });
  if (!res.ok) {
    throw new MercadoPagoError(res.status, await res.text().catch(() => ''));
  }
  return (await res.json()) as T;
}

export async function createPixPayment(data: {
  amount: number;
  payerEmail: string;
  externalReference: string;
}): Promise<{ id: string; qrCode: string; qrCodeBase64: string }> {
  const amount = (Math.round(data.amount * 100) / 100).toFixed(2);
  const order = await mpFetch<MpOrder>('/v1/orders', {
    method: 'POST',
    // Mesma chave = mesmo Pix: se a requisição for reenviada (conexão caiu
    // no meio), o Mercado Pago devolve a cobrança já criada em vez de outra.
    idempotencyKey: data.externalReference,
    body: JSON.stringify({
      type: 'online',
      processing_mode: 'automatic',
      total_amount: amount,
      external_reference: data.externalReference,
      payer: { email: data.payerEmail },
      transactions: {
        payments: [
          {
            amount,
            payment_method: { id: 'pix', type: 'bank_transfer' },
            expiration_time: PIX_EXPIRATION
          }
        ]
      }
    })
  });
  const pix = order.transactions?.payments?.[0]?.payment_method;
  if (!pix?.qr_code || !pix.qr_code_base64) {
    throw new Error('Mercado Pago não devolveu o QR Code do Pix.');
  }
  return { id: order.id, qrCode: pix.qr_code, qrCodeBase64: pix.qr_code_base64 };
}

const FAILED_STATUSES = new Set(['failed', 'canceled', 'expired', 'refunded', 'charged_back']);

function orderState(order: MpOrder): MpOrderState {
  const status =
    order.status === 'processed' && order.status_detail === 'accredited'
      ? 'approved'
      : FAILED_STATUSES.has(order.status)
        ? 'failed'
        : 'pending';
  return { status, rawStatus: order.status, amount: parseFloat(order.total_amount) };
}

export async function getPixPaymentState(id: string): Promise<MpOrderState> {
  return orderState(await mpFetch<MpOrder>(`/v1/orders/${encodeURIComponent(id)}`));
}

// O que o formulário de cartão do Mercado Pago (Card Payment Brick — ver
// app/CardPaymentStep.tsx) devolve no navegador: o "token" é o cartão
// já trancado pelo Mercado Pago (o número do cartão nunca passa pelo site).
export type CardInput = {
  token: string;
  paymentMethodId: string; // bandeira: master, visa, elo...
  paymentTypeId: string; // credit_card ou debit_card
  installments: number;
  issuerId: string | null;
  identification: { type: string; number: string } | null;
};

// Cobra no cartão. Diferente do Pix, a resposta já vem decidida na hora:
// aprovado, recusado, ou (raro) em análise pelo antifraude do Mercado Pago.
// statusDetail ajuda a explicar a recusa pro cliente (ver
// app/mercadoPagoActions.ts).
export async function createCardPayment(data: {
  amount: number;
  payerEmail: string;
  externalReference: string;
  card: CardInput;
}): Promise<{ id: string | null; state: MpOrderState; statusDetail: string }> {
  const amount = (Math.round(data.amount * 100) / 100).toFixed(2);
  let order: MpOrder;
  try {
    order = await mpFetch<MpOrder>('/v1/orders', {
      method: 'POST',
      idempotencyKey: data.externalReference,
      body: JSON.stringify({
        type: 'online',
        processing_mode: 'automatic',
        total_amount: amount,
        external_reference: data.externalReference,
        payer: {
          email: data.payerEmail,
          ...(data.card.identification ? { identification: data.card.identification } : {})
        },
        transactions: {
          payments: [
            {
              amount,
              payment_method: {
                id: data.card.paymentMethodId,
                type: data.card.paymentTypeId === 'debit_card' ? 'debit_card' : 'credit_card',
                token: data.card.token,
                installments: data.card.installments
              }
            }
          ]
        }
      })
    });
  } catch (err) {
    // Cartão recusado: a cobrança recusada vem no corpo do erro 402 (às
    // vezes dentro de "data").
    if (err instanceof MercadoPagoError && err.status === 402) {
      let parsed: { data?: Partial<MpOrder> } & Partial<MpOrder> = {};
      try {
        parsed = JSON.parse(err.body);
      } catch {
        // corpo vazio ou fora do formato — segue como recusa genérica
      }
      const failed = parsed.data ?? parsed;
      return {
        id: failed.id ?? null,
        state: { status: 'failed', rawStatus: failed.status ?? 'failed', amount: parseFloat(amount) },
        statusDetail: failed.status_detail ?? ''
      };
    }
    throw err;
  }
  return { id: order.id, state: orderState(order), statusDetail: order.status_detail };
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
  // Ids alfanuméricos (como os das orders, "ORD01...") entram em
  // minúsculas no texto assinado.
  const id = /^[a-z0-9]+$/i.test(params.dataId) ? params.dataId.toLowerCase() : params.dataId;
  let manifest = `id:${id};`;
  if (params.requestId) manifest += `request-id:${params.requestId};`;
  manifest += `ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
