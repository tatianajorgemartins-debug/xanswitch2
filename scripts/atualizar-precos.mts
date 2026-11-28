// Atualiza os preços do site pela Amazon Japão, aos poucos. Roda sozinho de
// 2 em 2 horas, das 7h às 21h, pelo Agendador de Tarefas do Windows (tarefa
// "XAN Switch - Precos Amazon"); se o PC estiver desligado, roda quando ligar.
//
// Uso manual: duplo clique em "ATUALIZAR PRECOS.bat" (nesta pasta) — roda um
// lote só, igual às rodadas automáticas.
//
// Por que roda no PC e não no site: a Amazon bloqueia (503/captcha) consultas
// vindas dos servidores da Vercel, mas aceita normalmente as daqui — desde que
// sejam poucas e espaçadas. Por isso cada rodada abre só alguns links (os que
// estão há ~2 dias sem conferir), um de cada vez, com pausa entre eles, e para
// na hora se a Amazon pedir captcha. Só abre os links cadastrados no site.
//
// O que faz: pede ao site a lista de jogos com preço automático, lê o preço
// em ienes do lote na Amazon JP, pega a cotação do iene e manda pro site
// (/api/cron/precos), que aplica a regra (lib/autoPricing.ts), muda os preços
// e avisa no Telegram se algo subiu ou deu problema. O registro fica em
// scripts/atualizar-precos.log.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAmazonYen, fetchJpyBrlRate, type AmazonResult } from '../lib/amazonPrice.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG = path.join(ROOT, 'scripts', 'atualizar-precos.log');
const SITE = process.env.SITE_URL || 'https://www.xanswitch.com.br';

// Ritmo: 8 rodadas por dia (7h às 21h, de 2 em 2 horas) × 6 jogos = cerca de
// 48 links por dia, então cada jogo é conferido mais ou menos a cada 2 dias.
const BATCH_SIZE = 6;
const DUE_AFTER_MS = 46 * 60 * 60 * 1000;
const PAUSE_MIN_MS = 20000;
const PAUSE_MAX_MS = 45000;

function log(msg: string) {
  const line = `[${new Date().toLocaleString('pt-BR')}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG, line + '\n');
}

function readSecret(): string {
  const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
  const m = env.match(/^CRON_SECRET=(.*)$/m);
  if (!m) throw new Error('CRON_SECRET não encontrado no .env.local');
  return m[1].trim().replace(/^"|"$/g, '');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForInternet() {
  // Logo depois de ligar o PC a internet pode demorar pra conectar.
  for (let i = 0; i < 20; i++) {
    try {
      await fetch(SITE, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
      return;
    } catch {
      await sleep(15000);
    }
  }
  throw new Error('Sem internet depois de 5 minutos.');
}

async function main() {
  const secret = readSecret();
  const auth = { Authorization: `Bearer ${secret}` };
  await waitForInternet();

  const listRes = await fetch(`${SITE}/api/cron/precos`, { headers: auth });
  if (!listRes.ok) throw new Error(`Site respondeu ${listRes.status} ao pedir a lista de jogos`);
  const list = (await listRes.json()) as {
    enabled: boolean;
    games: { id: number; name: string; url: string; checkedAt: string | null }[];
  };
  if (!list.enabled) return log('Preço automático está desligado no admin. Nada feito.');

  // Lote: os que estão há mais de ~2 dias sem conferir (ou nunca foram),
  // os mais antigos primeiro.
  const due = list.games
    .filter((g) => !g.checkedAt || Date.now() - new Date(g.checkedAt).getTime() > DUE_AFTER_MS)
    .sort((a, b) => (a.checkedAt ? new Date(a.checkedAt).getTime() : 0) - (b.checkedAt ? new Date(b.checkedAt).getTime() : 0))
    .slice(0, BATCH_SIZE);
  if (due.length === 0) return log('Nenhum jogo precisando de conferência agora.');

  const { rate, source } = await fetchJpyBrlRate();
  log(`Cotação: ¥1 = R$ ${rate} (${source}). Lendo ${due.length} jogo(s) na Amazon...`);

  const readings: Record<number, AmazonResult> = {};
  for (const [i, g] of due.entries()) {
    if (i > 0) await sleep(PAUSE_MIN_MS + Math.random() * (PAUSE_MAX_MS - PAUSE_MIN_MS));
    const r = await fetchAmazonYen(g.url);
    if ('error' in r && /captcha|respondeu 5/i.test(r.error)) {
      // Bloqueio da Amazon: não insiste. Os que faltaram ficam pra próxima
      // rodada (não são enviados, então continuam "pendentes").
      log(`  Amazon bloqueou em ${g.name} (${r.error}). Paro por aqui e tento na próxima rodada.`);
      break;
    }
    readings[g.id] = r;
    log(`  ${g.name}: ${'yen' in r ? `¥${r.yen}` : r.error}`);
  }
  if (Object.keys(readings).length === 0) return log('Nada lido nesta rodada.');

  const postRes = await fetch(`${SITE}/api/cron/precos`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ rate, rateSource: source, readings })
  });
  const out = await postRes.json().catch(() => ({}));
  if (!postRes.ok) throw new Error(`Site respondeu ${postRes.status}: ${JSON.stringify(out)}`);
  log(`Pronto: ${out.total} conferidos, ${out.raised} subiram, ${out.errors} com problema.`);
  for (const c of out.changes ?? []) log(`  ${c}`);
}

main().catch((err) => {
  log(`ERRO: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
