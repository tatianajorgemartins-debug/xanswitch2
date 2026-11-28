// Preço automático pela Amazon Japão.
//
// A Amazon bloqueia consultas vindas dos servidores da Vercel (503/captcha),
// então quem lê os preços é o script do seu PC (scripts/atualizar-precos.mjs,
// agendado no Windows todo dia às 7h): ele pede a lista de jogos, lê cada
// link na Amazon e manda as leituras + a cotação pra /api/cron/precos, que
// chama runAutoPricing('pc', ...). O botão "Recalcular" do admin roda
// runAutoPricing('manual') com o último preço em ienes salvo de cada jogo.
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
import { autoPriceTarget, DEFAULT_MARGIN, DEFAULT_SPREAD, fetchJpyBrlRate, type AmazonResult } from './amazonPrice';
import { sendTelegramMessage } from './notifications';

export const AUTO_PRICE_MARGIN_KEY = 'auto_price_margin';
export const AUTO_PRICE_SPREAD_KEY = 'auto_price_spread';
export const AUTO_PRICE_ENABLED_KEY = 'auto_price_enabled';
export const AUTO_PRICE_LAST_RUN_KEY = 'auto_price_last_run';

// Um aumento maior que isso (ex.: de R$200 pra R$330) é tratado como leitura
// suspeita da Amazon e NÃO é aplicado — fica no relatório pra você conferir.
const MAX_RAISE_FACTOR = 1.6;

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
  // Quando esse jogo foi conferido (os lotes do dia se juntam no relatório).
  at?: string;
};

export type AutoPriceRun = {
  at: string;
  trigger: 'pc' | 'manual' | 'cron';
  rate: number;
  rateSource: string;
  margin: number;
  spread: number;
  items: AutoPriceItem[];
};

type Row = {
  id: number;
  name: string;
  price: string;
  original_price: string | null;
  amazon_jp_url: string;
  amazon_yen: number | null;
  amazon_checked_at: Date | null;
};

// Jogos que entram no preço automático (o script do PC pede essa lista pra
// saber quais links consultar e quando cada um foi conferido pela última vez).
export async function getAutoPriceGames(): Promise<Row[]> {
  return (await getSql()`
    SELECT id, name, price, original_price, amazon_jp_url, amazon_yen, amazon_checked_at FROM games
    WHERE archived = FALSE AND auto_price = TRUE AND amazon_jp_url IS NOT NULL AND amazon_jp_url <> ''
    ORDER BY id
  `) as Row[];
}

export async function runAutoPricing(
  trigger: 'pc' | 'manual',
  input: { readings?: Record<number, AmazonResult>; rate?: number; rateSource?: string } = {}
): Promise<AutoPriceRun> {
  const settings = await getAutoPriceSettings();
  const { rate, source } =
    input.rate && input.rate > 0.005 && input.rate < 0.2
      ? { rate: input.rate, source: input.rateSource || 'PC' }
      : await fetchJpyBrlRate();
  const rows = await getAutoPriceGames();
  const fresh = Boolean(input.readings);

  // O PC consulta aos poucos (um lote de jogos por vez, várias vezes ao
  // dia), então com leituras só processa os jogos que vieram nelas.
  const now = new Date().toISOString();
  const items: AutoPriceItem[] = [];
  for (const g of rows) {
    if (input.readings && !(g.id in input.readings)) continue;
    const reading: AmazonResult = input.readings
      ? input.readings[g.id]
      : g.amazon_yen
        ? { yen: g.amazon_yen }
        : { error: 'Ainda sem leitura da Amazon' };
    items.push({ ...(await priceOne(g, reading, rate, settings, fresh)), at: now });
  }

  const run: AutoPriceRun = {
    at: now,
    trigger,
    rate,
    rateSource: source,
    margin: settings.margin,
    spread: settings.spread,
    items: mergeWithLastRun(await getLastRun(), items, rows.map((r) => r.id)),
  };
  await setSiteSetting(AUTO_PRICE_LAST_RUN_KEY, JSON.stringify(run));

  if (items.some((i) => i.status === 'raised')) {
    revalidatePath('/');
    revalidatePath('/admin');
    revalidateTag('games', { expire: 0 });
  }
  // Telegram só quando algo subiu ou deu problema nesse lote (senão seriam
  // várias mensagens por dia sem novidade).
  if (trigger === 'pc' && items.some((i) => i.status !== 'ok')) {
    await sendTelegramMessage(telegramSummary({ ...run, items })).catch((err) =>
      console.error('[autoPricing] Falha ao avisar no Telegram:', err)
    );
  }
  return run;
}

// O relatório do admin junta os lotes: cada jogo fica com a sua última
// conferência. Um "subiu" de mais de 3 dias vira "ok", pra lista de
// aumentos mostrar só o que é recente.
const RECENT_MS = 3 * 24 * 60 * 60 * 1000;
async function getLastRun(): Promise<AutoPriceRun | null> {
  const raw = await getSiteSetting(AUTO_PRICE_LAST_RUN_KEY);
  try {
    return raw ? (JSON.parse(raw) as AutoPriceRun) : null;
  } catch {
    return null;
  }
}
function mergeWithLastRun(old: AutoPriceRun | null, items: AutoPriceItem[], activeIds: number[]): AutoPriceItem[] {
  const byId = new Map<number, AutoPriceItem>();
  const active = new Set(activeIds);
  for (const i of old?.items ?? []) {
    if (!active.has(i.id)) continue;
    const at = i.at ?? old!.at;
    const stale = Date.now() - new Date(at).getTime() > RECENT_MS;
    byId.set(i.id, { ...i, at, status: stale && i.status === 'raised' ? 'ok' : i.status });
  }
  for (const i of items) byId.set(i.id, i);
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function priceOne(
  g: Row,
  result: AmazonResult,
  rate: number,
  settings: AutoPriceSettings,
  fresh: boolean
): Promise<AutoPriceItem> {
  const sql = getSql();
  const oldPrice = parseFloat(g.price);
  const base = { id: g.id, name: g.name, oldPrice, newPrice: oldPrice };
  if ('error' in result) {
    if (fresh) await sql`UPDATE games SET amazon_error = ${result.error}, amazon_checked_at = NOW() WHERE id = ${g.id}`;
    return { ...base, yen: null, cost: null, status: 'error', capped: false, error: result.error };
  }

  const eshop = g.original_price ? parseFloat(g.original_price) : null;
  const { cost, target, capped } = autoPriceTarget(result.yen, rate, settings, eshop);
  const roundedCost = Math.round(cost * 100) / 100;

  if (target <= oldPrice) {
    if (fresh) await sql`UPDATE games SET amazon_yen = ${result.yen}, amazon_error = NULL, amazon_checked_at = NOW() WHERE id = ${g.id}`;
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
