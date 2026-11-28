// Leitura do preço de um jogo na Amazon Japão e da cotação do iene — base do
// preço automático (ver lib/autoPricing.ts). Não importa nada do projeto,
// pra poder ser testado direto com node.

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.5',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

// Preço fora disso é quase certo leitura errada da página (jogo/DLC na
// Amazon JP fica entre algumas centenas e uns 15 mil ienes).
const MIN_YEN = 100;
const MAX_YEN = 30000;

function parseYen(text: string): number | null {
  const n = Number(text.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n >= MIN_YEN && n <= MAX_YEN ? Math.round(n) : null;
}

// Pega o preço da caixa de compra ("Comprar agora"). Primeiro o JSON que a
// Amazon põe na página com o preço da oferta principal; se não tiver, o
// preço exibido no bloco principal de preço.
export function extractAmazonYen(html: string): number | null {
  const json = html.match(/twister-plus-buying-options-price-data[^>]*>([^<]+)</);
  if (json) {
    try {
      const data = JSON.parse(json[1].replace(/&quot;/g, '"'));
      const offer = data?.desktop_buybox_group_1?.[0];
      if (offer && typeof offer.priceAmount === 'number') {
        const yen = parseYen(String(offer.priceAmount));
        if (yen) return yen;
      }
    } catch {
      // segue pro plano B
    }
  }
  const core = html.indexOf('id="corePriceDisplay_desktop_feature_div"');
  if (core >= 0) {
    const m = html.slice(core, core + 20000).match(/class="a-offscreen">\s*[￥¥]\s*([\d,]+)/);
    if (m) return parseYen(m[1]);
  }
  return null;
}

export type AmazonResult = { yen: number } | { error: string };

export async function fetchAmazonYen(url: string): Promise<AmazonResult> {
  try {
    const res = await fetch(url, { headers: HEADERS, redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(25000) });
    if (!res.ok) return { error: `Amazon respondeu ${res.status}` };
    const html = await res.text();
    if (/validateCaptcha|api-services-support@amazon/i.test(html)) return { error: 'Amazon pediu captcha (bloqueou a consulta)' };
    const yen = extractAmazonYen(html);
    if (!yen) return { error: 'Preço não encontrado na página (indisponível ou sem estoque?)' };
    return { yen };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Falha ao abrir a página' };
  }
}

// Quanto vale ¥1 em reais (cotação de venda). AwesomeAPI primeiro, a outra
// de reserva.
export async function fetchJpyBrlRate(): Promise<{ rate: number; source: string }> {
  try {
    const res = await fetch('https://economia.awesomeapi.com.br/json/last/JPY-BRL', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const data = await res.json();
    const rate = Number(data?.JPYBRL?.ask ?? data?.JPYBRL?.bid);
    if (rate > 0.005 && rate < 0.2) return { rate, source: 'AwesomeAPI' };
  } catch {
    // tenta a reserva
  }
  const res = await fetch('https://open.er-api.com/v6/latest/JPY', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  const data = await res.json();
  const rate = Number(data?.rates?.BRL);
  if (rate > 0.005 && rate < 0.2) return { rate, source: 'ExchangeRate-API' };
  throw new Error('Não consegui a cotação do iene em nenhuma fonte.');
}

// Preço de venda: custo em reais (ienes × cotação, mais o acréscimo % do
// cartão, se configurado) + a margem fixa, arredondado pra cima no real.
export function computeAutoPrice(yen: number, rate: number, marginBrl: number, spreadPercent: number): number {
  const cost = yen * rate * (1 + spreadPercent / 100);
  return Math.ceil(cost + marginBrl - 1e-9);
}

export const DEFAULT_MARGIN = 35;
export const DEFAULT_SPREAD = 3.5;

export const roundUp5 = (v: number) => Math.ceil(v / 5 - 1e-9) * 5;
export const roundDown5 = (v: number) => Math.floor(v / 5 + 1e-9) * 5;

// Preço mínimo (custo + margem, redondo) e o teto da eShop. Usado aqui e no
// admin, pra mostrar a mesma conta.
export function autoPriceTarget(
  yen: number,
  rate: number,
  settings: { margin: number; spread: number },
  eshopPrice: number | null
): { cost: number; minimum: number; cap: number | null; target: number; capped: boolean } {
  const cost = yen * rate * (1 + settings.spread / 100);
  const minimum = roundUp5(computeAutoPrice(yen, rate, settings.margin, settings.spread));
  const cap = eshopPrice && eshopPrice > 0 ? roundDown5(eshopPrice) : null;
  const capped = cap !== null && minimum > cap;
  return { cost, minimum, cap, target: capped ? cap! : minimum, capped };
}

