// Preço automático pela Amazon Japão. Roda todo dia de manhã (cron
// /api/cron/precos, ver vercel.json) e pelo botão "Atualizar agora" do admin.
//
// Regra, jogo por jogo (só os não arquivados, com link da Amazon e com o
// preço automático ligado):
//   custo  = ienes na Amazon × cotação do iene × (1 + acréscimo do cartão %)
//   mínimo = custo + margem (R$35), arredondado PRA CIMA num múltiplo de R$5
//   teto   = preço da eShop brasileira ("preço original" do jogo),
//            arredondado pra baixo num múltiplo de R$5 — nunca passa dele
//   Se o preço atual estiver abaixo do mínimo, sobe pra ele (respeitando o
//   teto). Nunca baixa preço sozinho.
import { revalidatePath, revalidateTag } from 'next/cache';
import { getSql } from './sql';
import { getSiteSetting, setSiteSetting } from './db';
import { autoPriceTarget, DEFAULT_MARGIN, DEFAULT_SPREAD, fetchAmazonYen, fetchJpyBrlRate } from './amazonPrice';
import { sendTelegramMessage } from './notifications';

export const AUTO_PRICE_MARGIN_KEY = 'auto_price_margin';
export const AUTO_PRICE_SPREAD_KEY = 'auto_price_spread';
export const AUTO_PRICE_ENABLED_KEY = 'auto_price_enabled';
export const AUTO_PRICE_LAST_RUN_KEY = 'auto_price_last_run';

// Um aumento maior que isso (ex.: de R$200 pra R$330) é tratado como leitura
// suspeita da Amazon e NÃO é aplicado — fica no relatório pra você conferir.
const MAX_RAISE_FACTOR = 1.6;
const CONCURRENCY = 6;

export type AutoPriceSettings = { enabled: boolean; margin: number; spread: number };

export async function getAutoPriceSettings(): Promise<AutoPriceSettings> {
  const [enabled, margin, spread] = await Promise.all([
    getSiteSetting(AUTO_PRICE_ENABLED_KEY),
    getSiteSetting(AUTO_PRICE_MARGIN_KEY),
    getSiteSetting(AUTO_PRICE_SPREAD_KEY),
  ]);
  const m = margin !== null ? parseFloat(margin) : NaN;
  const s = spread !== null ? parseFloat(spread) : NaN;
  return {
    enabled: enabled !== 'false',
    margin: Number.isFinite(m) && m >= 0 ? m : DEFAULT_MARGIN,
    spread: Number.isFinite(s) && s >= 0 ? s : DEFAULT_SPREAD,
  };
}

export type AutoPriceItem = {
  id: number;
  name: string;
  yen: number | null;
  cost: number | null;
  oldPrice: number;
  newPrice: number;
  status: 'raised' | 'ok' | 'error' | 'suspicious';
  capped: boolean;
  error?: string;
};

export type AutoPriceRun = {
  at: string;
  trigger: 'cron' | 'manual';
  rate: number;
  rateSource: string;
  margin: number;
  spread: number;
  items: AutoPriceItem[];
};

type Row = { id: number; name: string; price: string; original_price: string | null; amazon_jp_url: string };

export async function runAutoPricing(trigger: 'cron' | 'manual'): Promise<AutoPriceRun> {
  const settings = await getAutoPriceSettings();
  const { rate, source } = await fetchJpyBrlRate();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, name, price, original_price, amazon_jp_url FROM games
    WHERE archived = FALSE AND auto_price = TRUE AND amazon_jp_url IS NOT NULL AND amazon_jp_url <> ''
    ORDER BY id
  `) as Row[];

  const items: AutoPriceItem[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < rows.length) {
        const g = rows[next++];
        items.push(await priceOne(g, rate, settings));
      }
    })
  );
  items.sort((a, b) => a.name.localeCompare(b.name));

  const run: AutoPriceRun = {
    at: new Date().toISOString(),
    trigger,
    rate,
    rateSource: source,
    margin: settings.margin,
    spread: settings.spread,
    items,
  };
  await setSiteSetting(AUTO_PRICE_LAST_RUN_KEY, JSON.stringify(run));

  if (items.some((i) => i.status === 'raised')) {
    revalidatePath('/');
    revalidatePath('/admin');
    revalidateTag('games', { expire: 0 });
  }
  await sendTelegramMessage(telegramSummary(run)).catch((err) =>
    console.error('[autoPricing] Falha ao avisar no Telegram:', err)
  );
  return run;
}

async function priceOne(g: Row, rate: number, settings: AutoPriceSettings): Promise<AutoPriceItem> {
  const sql = getSql();
  const oldPrice = parseFloat(g.price);
  const base = { id: g.id, name: g.name, oldPrice, newPrice: oldPrice };
  const result = await fetchAmazonYen(g.amazon_jp_url);
  if ('error' in result) {
    await sql`UPDATE games SET amazon_error = ${result.error}, amazon_checked_at = NOW() WHERE id = ${g.id}`;
    return { ...base, yen: null, cost: null, status: 'error', capped: false, error: result.error };
  }

  const eshop = g.original_price ? parseFloat(g.original_price) : null;
  const { cost, target, capped } = autoPriceTarget(result.yen, rate, settings, eshop);
  const roundedCost = Math.round(cost * 100) / 100;

  if (target <= oldPrice) {
    await sql`UPDATE games SET amazon_yen = ${result.yen}, amazon_error = NULL, amazon_checked_at = NOW() WHERE id = ${g.id}`;
    return { ...base, yen: result.yen, cost: roundedCost, status: 'ok', capped };
  }
  if (oldPrice > 0 && target > oldPrice * MAX_RAISE_FACTOR) {
    const msg = `Aumento grande demais (R$${oldPrice} → R$${target}); não apliquei. Confira o link.`;
    await sql`UPDATE games SET amazon_yen = ${result.yen}, amazon_error = ${msg}, amazon_checked_at = NOW() WHERE id = ${g.id}`;
    return { ...base, yen: result.yen, cost: roundedCost, status: 'suspicious', capped, error: msg };
  }
  await sql`
    UPDATE games SET price = ${target}, amazon_yen = ${result.yen}, amazon_error = NULL,
      amazon_checked_at = NOW(), updated_at = NOW()
    WHERE id = ${g.id}
  `;
  return { ...base, newPrice: target, yen: result.yen, cost: roundedCost, status: 'raised', capped };
}

const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function telegramSummary(run: AutoPriceRun): string {
  const raised = run.items.filter((i) => i.status === 'raised');
  const problems = run.items.filter((i) => i.status === 'error' || i.status === 'suspicious');
  const capped = run.items.filter((i) => i.capped);
  const lines = [
    `💴 Preços pela Amazon JP — ¥1 = R$ ${run.rate.toFixed(5).replace('.', ',')}`,
    `${run.items.length} jogos conferidos: ${raised.length} subiram, ${problems.length} com problema.`,
  ];
  if (raised.length) {
    lines.push('', '⬆️ Subiram:');
    for (const i of raised) lines.push(`• ${i.name}: R$ ${brl(i.oldPrice)} → R$ ${brl(i.newPrice)} (¥${i.yen})${i.capped ? ' [no teto da eShop]' : ''}`);
  }
  if (capped.length) {
    lines.push('', '⚠️ Margem menor que R$' + run.margin + ' por causa do teto da eShop:');
    for (const i of capped) lines.push(`• ${i.name}: custo R$ ${brl(i.cost ?? 0)}, preço R$ ${brl(i.newPrice)}`);
  }
  if (problems.length) {
    lines.push('', '❌ Não consegui conferir:');
    for (const i of problems) lines.push(`• ${i.name}: ${i.error}`);
  }
  return lines.join('\n');
}
