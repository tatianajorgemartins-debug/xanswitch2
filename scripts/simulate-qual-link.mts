// Simula milhares de pessoas respondendo o "Qual Link é você?" ao acaso e
// mostra quantas vezes cada Link sai como resultado — pra conferir que os
// 13 são possíveis e razoavelmente equilibrados. Rodar com:
//   node scripts/simulate-qual-link.mts
import { LINK_ORDER, LINKS, PERGUNTAS } from '../app/qual-link/quizData.ts';
import { winner } from '../app/qual-link/quizLogic.ts';

const RUNS = 200_000;
const counts = Object.fromEntries(LINK_ORDER.map((id) => [id, 0])) as Record<string, number>;
for (let r = 0; r < RUNS; r++) {
  const answers = PERGUNTAS.map((q) => Math.floor(Math.random() * q.opcoes.length));
  counts[winner(answers)]++;
}

const fair = 100 / LINK_ORDER.length;
let missing = 0;
for (const id of LINK_ORDER) {
  const pct = (counts[id] / RUNS) * 100;
  if (counts[id] === 0) missing++;
  const bar = '█'.repeat(Math.round(pct * 2));
  console.log(`${LINKS[id].nome.padEnd(34)} ${pct.toFixed(1).padStart(5)}%  ${bar}`);
}
const pcts = LINK_ORDER.map((id) => (counts[id] / RUNS) * 100);
console.log(`\nIdeal: ${fair.toFixed(1)}% cada · menor ${Math.min(...pcts).toFixed(1)}% · maior ${Math.max(...pcts).toFixed(1)}%`);
console.log(missing === 0 ? '✓ Os 13 resultados aparecem.' : `✗ ${missing} resultado(s) nunca aparecem!`);
