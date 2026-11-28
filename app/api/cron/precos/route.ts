import { NextResponse, type NextRequest } from 'next/server';
import { getAutoPriceSettings, runAutoPricing } from '@/lib/autoPricing';

// Chamado todo dia de manhã pela Vercel (veja "crons" em vercel.json): lê
// o preço de cada jogo na Amazon Japão e sobe os que ficaram abaixo do
// custo + margem (regras em lib/autoPricing.ts). Leva uns 30 segundos.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }
  try {
    const settings = await getAutoPriceSettings();
    if (!settings.enabled) return NextResponse.json({ skipped: 'Preço automático desligado no admin.' });
    const run = await runAutoPricing('cron');
    const count = (s: string) => run.items.filter((i) => i.status === s).length;
    return NextResponse.json({ rate: run.rate, total: run.items.length, raised: count('raised'), errors: count('error') + count('suspicious') });
  } catch (error) {
    console.error('[cron/precos]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha.' }, { status: 500 });
  }
}
