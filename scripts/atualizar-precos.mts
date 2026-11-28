// Atualiza os preços do site pela Amazon Japão. Roda sozinho todo dia às 7h
// pelo Agendador de Tarefas do Windows (tarefa "XAN Switch - Precos Amazon");
// se o PC estiver desligado nessa hora, roda assim que ligar.
//
// Uso manual: duplo clique em "ATUALIZAR PRECOS.bat" (nesta pasta).
//
// Por que roda no PC e não no site: a Amazon bloqueia (503/captcha) consultas
// vindas dos servidores da Vercel, mas aceita normalmente as daqui.
//
// O que faz: pede ao site a lista de jogos com preço automático, lê o preço
// em ienes de cada link na Amazon JP, pega a cotação do iene e manda tudo pro
// site (/api/cron/precos), que aplica a regra (lib/autoPricing.ts), muda os
// preços e manda o resumo no Telegram. O registro fica em
// scripts/atualizar-precos.log.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAmazonYen, fetchJpyBrlRate, type AmazonResult } from '../lib/amazonPrice.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG = path.join(ROOT, 'scripts', 'atualizar-precos.log');
const SITE = process.env.SITE_URL || 'https://www.xanswitch.com.br';

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
  const list = (await listRes.json()) as { enabled: boolean; games: { id: number; name: string; url: string }[] };
  if (!list.enabled) return log('Preço automático está desligado no admin. Nada feito.');

  const { rate, source } = await fetchJpyBrlRate();
  log(`Cotação: ¥1 = R$ ${rate} (${source}). Lendo ${list.games.length} jogos na Amazon...`);

  const readings: Record<number, AmazonResult> = {};
  let next = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < list.games.length) {
        const g = list.games[next++];
        readings[g.id] = await fetchAmazonYen(g.url);
      }
    })
  );
  // Segunda tentativa, com calma, pros que falharam.
  for (const g of list.games) {
    if ('error' in readings[g.id]) {
      await sleep(4000);
      const again = await fetchAmazonYen(g.url);
      if ('yen' in again) readings[g.id] = again;
    }
  }
  const failed = list.games.filter((g) => 'error' in readings[g.id]);
  for (const g of failed) log(`  sem preço: ${g.name} — ${(readings[g.id] as { error: string }).error}`);

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
