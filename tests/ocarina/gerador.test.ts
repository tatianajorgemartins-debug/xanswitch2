// Testes do gerador automático de notas do Zelda Tour. Rodar: npm run test:gerador
// Música sintética com resposta conhecida: guitarra (aberta à esquerda)
// tocando Ré4 Fá4 Lá4 Si4 Ré5 Lá4 Fá4 Ré4 a 120 bpm, uma "voz" no centro
// com outras notas, bumbo em todo tempo e chimbal nos contratempos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { estimarBatida, extrair, gerarNotas, pistaOcarina, type Parametros } from '../../app/admin/ocarina/gerador/analise.ts';

const TAXA = 22050;
const BPM = 120;
const BATIDA = 60 / BPM;
const ESCALA = [62, 65, 69, 71, 74, 69, 65, 62]; // Ré4 Fá4 Lá4 Si4 Ré5 Lá4 Fá4 Ré4
const ESPERADO = ['verde', 'amarelo', 'vermelho', 'roxo', 'azul', 'vermelho', 'amarelo', 'verde'];
const VOZ = [76, 76, 79, 79]; // Mi5, Sol5 (2 batidas cada)
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function musica(compassos = 4) {
  const duracao = compassos * 8 * BATIDA + 1;
  const n = Math.floor(duracao * TAXA);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  let semente = 1;
  const ruido = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
  const inicio = 0.5;
  for (let c = 0; c < compassos; c++) {
    for (let i = 0; i < 8; i++) {
      const t0 = inicio + (c * 8 + i) * BATIDA;
      const f = hz(ESCALA[i]);
      // guitarra: dedilhado com harmônicos, decaindo; só no canal esquerdo
      for (let j = 0; j < BATIDA * TAXA * 0.95; j++) {
        const t = j / TAXA;
        const env = Math.exp(-t * 3) * Math.min(1, j / 40);
        const v = env * (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(4 * Math.PI * f * t) + 0.25 * Math.sin(6 * Math.PI * f * t)) * 0.35;
        L[Math.floor(t0 * TAXA) + j] += v;
      }
      // bumbo no centro
      for (let j = 0; j < 0.15 * TAXA; j++) {
        const t = j / TAXA;
        const v = Math.sin(2 * Math.PI * (60 + 80 * Math.exp(-t * 30)) * t) * Math.exp(-t * 18) * 0.6;
        L[Math.floor(t0 * TAXA) + j] += v;
        R[Math.floor(t0 * TAXA) + j] += v;
      }
      // chimbal no contratempo
      const tc = t0 + BATIDA / 2;
      for (let j = 0; j < 0.05 * TAXA; j++) {
        const v = ruido() * Math.exp(-(j / TAXA) * 60) * 0.25;
        L[Math.floor(tc * TAXA) + j] += v;
        R[Math.floor(tc * TAXA) + j] += v;
      }
    }
    // "voz" no centro, notas longas
    for (let i = 0; i < 4; i++) {
      const t0 = inicio + (c * 8 + i * 2) * BATIDA;
      const f = hz(VOZ[i]);
      for (let j = 0; j < 2 * BATIDA * TAXA; j++) {
        const t = j / TAXA;
        const v = Math.sin(2 * Math.PI * f * t) * 0.15 * Math.min(1, j / 400);
        L[Math.floor(t0 * TAXA) + j] += v;
        R[Math.floor(t0 * TAXA) + j] += v;
      }
    }
  }
  return { L, R, inicio };
}

const PARAMS: Parametros = {
  sensibilidade: 50,
  intervaloMinMs: 90,
  quantizacao: 2,
  dificuldade: 'insano',
  modo: 'ocarina',
  offsetMs: 0,
  notaLongaMs: 0,
  bpm: 120,
  inicioBatida: 0.5
};

test('mapa da ocarina: Ré4 verde, Fá amarelo, Lá vermelho, Si roxo, Ré5 azul (qualquer oitava)', () => {
  assert.equal(pistaOcarina(62, 68), 'verde');
  assert.equal(pistaOcarina(65, 68), 'amarelo');
  assert.equal(pistaOcarina(69, 68), 'vermelho');
  assert.equal(pistaOcarina(71, 68), 'roxo');
  assert.equal(pistaOcarina(74, 68), 'azul');
  assert.equal(pistaOcarina(53, 68), 'amarelo'); // Fá3
  assert.equal(pistaOcarina(64, 68), 'amarelo'); // Mi → Fá (mais próxima)
});

test('foco na guitarra: acha o BPM, as notas da guitarra e mapeia na ocarina', () => {
  const { L, R } = musica();
  const inicio = Date.now();
  const c = extrair(L, R, TAXA, 'guitarra');
  const ms = Date.now() - inicio;
  assert.equal(c.usouEstereo, true);
  assert.ok(Math.abs(c.bpm - BPM) <= 1 || Math.abs(c.bpm - BPM * 2) <= 2, `bpm ${c.bpm}`);
  const r = gerarNotas(c, { ...PARAMS, bpm: 120, inicioBatida: 0.5 });
  const pistas = r.notas.map((n) => n.pista);
  // 4 compassos × 8 notas, no tempo certo e na pista certa (tolera 2 erros)
  let acertos = 0;
  for (let i = 0; i < 32; i++) {
    const t = 0.5 + i * BATIDA;
    const nota = r.notas.find((n) => Math.abs(n.t - t) < 0.06);
    if (nota && nota.pista === ESPERADO[i % 8]) acertos++;
  }
  console.log(`   ${ms} ms · bpm ${c.bpm} · início ${c.inicioBatida}s · ${r.notas.length} notas (${r.comAltura} com altura) · acertos ${acertos}/32`);
  console.log('   pistas:', pistas.slice(0, 16).join(' '));
  assert.ok(acertos >= 30, `acertos ${acertos}/32`);
});

test('dificuldade controla a densidade', () => {
  const { L, R } = musica(2);
  const c = extrair(L, R, TAXA, 'tudo');
  const conta = (d: Parametros['dificuldade']) => gerarNotas(c, { ...PARAMS, dificuldade: d, bpm: 120, inicioBatida: 0.5 }).notas.length;
  const [f, m, d] = [conta('facil'), conta('medio'), conta('dificil')];
  console.log(`   fácil ${f} · médio ${m} · difícil ${d}`);
  assert.ok(f <= m && m <= d, `${f} ${m} ${d}`);
  assert.ok(f <= 9, `fácil ${f}`); // no máximo 1 a cada 2 batidas
});

test('notas longas: a voz sustentada vira nota de segurar no foco "melodia"', () => {
  const { L, R } = musica(2);
  const c = extrair(L, R, TAXA, 'melodia');
  const r = gerarNotas(c, { ...PARAMS, notaLongaMs: 400, quantizacao: 1, dificuldade: 'medio' });
  const longas = r.notas.filter((n) => n.dur);
  console.log(`   ${r.notas.length} notas, ${longas.length} longas`, JSON.stringify(r.notas.slice(0, 4)));
  assert.ok(longas.length >= 2);
  // a voz (Mi5 e Sol5) e não a guitarra: as notas com altura são Mi ou Sol
  const comAltura = r.notas.filter((n) => n.midi !== undefined);
  const daVoz = comAltura.filter((n) => [4, 7].includes(Math.round(n.midi as number) % 12));
  assert.ok(daVoz.length >= comAltura.length * 0.7, `voz ${daVoz.length}/${comAltura.length}`);
});

test('BPM de um envelope de pulsos regulares', () => {
  const taxa = 86.13;
  const env = new Float32Array(Math.round(taxa * 20));
  for (let t = 0.3; t < 20; t += 60 / 95) env[Math.round(t * taxa)] = 1;
  const { bpm } = estimarBatida(env, taxa);
  assert.ok(Math.abs(bpm - 95) <= 1, `bpm ${bpm}`);
});
