import { NextResponse, type NextRequest } from 'next/server';
import { getAutoPriceGames, getAutoPriceSettings, runAutoPricing } from '@/lib/autoPricing';
import type { AmazonResult } from '@/lib/amazonPrice';

// Usado pelo script do seu PC (scripts/atualizar-precos.mjs), que roda todo
// dia às 7h pelo Agendador de Tarefas do Windows — a Amazon bloqueia
// consultas vindas da Vercel, então a leitura dos preços em ienes é feita aí.
//   GET  → lista de jogos com preço automático (id + link da Amazon)
//   POST → recebe { rate, rateSource, readings: { [id]: { yen } | { error } } }
//          e aplica a regra (lib/autoPricing.ts)
// As duas pedem o cabeçalho "Authorization: Bearer <CRON_SECRET>".
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

function authorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  return Boolean(cronSecret) && request.headers.get('authorization') === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!authorized(request)) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const settings = await getAutoPriceSettings();
  const games = settings.enabled ? await getAutoPriceGames() : [];
  return NextResponse.json({ enabled: settings.enabled, games: games.map((g) => ({ id: g.id, name: g.name, url: g.amazon_jp_url })) });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!authorized(request)) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  try {
    const settings = await getAutoPriceSettings();
    if (!settings.enabled) return NextResponse.json({ skipped: 'Preço automático desligado no admin.' });
    const body = (await request.json()) as { rate?: number; rateSource?: string; readings?: Record<string, AmazonResult> };
    const readings: Record<number, AmazonResult> = {};
    for (const [id, r] of Object.entries(body.readings ?? {})) {
      if (r && typeof r === 'object' && 'yen' in r && Number.isFinite(r.yen) && r.yen >= 100 && r.yen <= 30000) {
        readings[Number(id)] = { yen: Math.round(r.yen) };
      } else if (r && typeof r === 'object' && 'error' in r) {
        readings[Number(id)] = { error: String(r.error).slice(0, 200) };
      }
    }
    const run = await runAutoPricing('pc', { readings, rate: Number(body.rate), rateSource: body.rateSource });
    const count = (s: string) => run.items.filter((i) => i.status === s).length;
    return NextResponse.json({
      rate: run.rate,
      total: run.items.length,
      raised: count('raised'),
      errors: count('error') + count('suspicious'),
      changes: run.items.filter((i) => i.status === 'raised').map((i) => `${i.name}: ${i.oldPrice} -> ${i.newPrice}`)
    });
  } catch (error) {
    console.error('[cron/precos]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha.' }, { status: 500 });
  }
}
