// Aviso automático do Mercado Pago ("webhook") — cadastrado no painel dele
// em Webhooks > Configurar notificações, evento "Pagamentos", com a URL
// https://www.xanswitch.com.br/api/mercadopago/webhook.
//
// O aviso só diz "o pagamento X mudou"; o que aconteceu de fato é sempre
// consultado direto na API do Mercado Pago (ver lib/mercadoPagoOrders.ts).
// Mesmo assim, a assinatura é conferida (MP_WEBHOOK_SECRET) pra recusar
// avisos que não vieram dele.
import { NextResponse, type NextRequest } from 'next/server';
import { isMercadoPagoEnabled, isValidWebhookSignature } from '@/lib/mercadoPago';
import { syncMercadoPagoPayment } from '@/lib/mercadoPagoOrders';

export async function POST(request: NextRequest) {
  if (!isMercadoPagoEnabled()) return new NextResponse(null, { status: 200 });

  const body = (await request.json().catch(() => null)) as { type?: string; data?: { id?: string | number } } | null;
  const type = body?.type ?? request.nextUrl.searchParams.get('type');
  const dataId = String(request.nextUrl.searchParams.get('data.id') ?? body?.data?.id ?? '');

  // Outros tipos de aviso (ex: de contas, de assinaturas) não interessam.
  if (type !== 'payment' || !/^\d+$/.test(dataId)) return new NextResponse(null, { status: 200 });

  if (
    process.env.MP_WEBHOOK_SECRET &&
    !isValidWebhookSignature({
      signature: request.headers.get('x-signature'),
      requestId: request.headers.get('x-request-id'),
      dataId
    })
  ) {
    return new NextResponse(null, { status: 401 });
  }

  try {
    await syncMercadoPagoPayment(dataId);
  } catch (err) {
    // Responde erro pro Mercado Pago tentar de novo mais tarde.
    console.error('[mercadopago] Falha ao processar aviso:', err);
    return new NextResponse(null, { status: 500 });
  }
  return new NextResponse(null, { status: 200 });
}
