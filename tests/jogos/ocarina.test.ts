// Testes das regras do Zelda Tour. Rodar: npm run test:jogos
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { estrelas, frequencia, migrarTeclas, multiplicador, pistaDaTecla, precisao, sequenciasEstrela, validarChart, TECLAS_PADRAO } from '../../app/testes/ocarina-hero/ocarina.ts';

const notasSeguidas = (total: number, passo = 0.5) => Array.from({ length: total }, (_, i) => ({ t: 2 + i * passo, pista: 'verde' as const }));

test('triforces: só as marcadas contam e uma nota comum separa sequências', () => {
  const notas = notasSeguidas(8).map((n, i) => ({ ...n, estrela: [0, 1, 3, 4].includes(i) }));
  assert.deepEqual(sequenciasEstrela(notasSeguidas(8)), Array(8).fill(-1));
  assert.deepEqual(sequenciasEstrela(notas), [0, 0, -1, 1, 1, -1, -1, -1]);
});

test('estrelas: acorde conta como um passo da mesma sequência e passa pela validação', () => {
  const c = validarChart({ id: 'x', titulo: 'X', bpm: 100, notas: [{ t: 1, pista: 'verde', estrela: true }, { t: 1, pista: 'azul', estrela: true }, { t: 2, pista: 'roxo', estrela: true }] });
  assert.deepEqual(sequenciasEstrela(c!.notas), [0, 0, 0]);
});

test('o espaço não fica mais numa pista salva', () => {
  assert.deepEqual(migrarTeclas({ verde: 'Space', azul: 'KeyP' }), { azul: 'KeyP' });
});

test('pistas antigas (A/C) viram as cores', () => {
  const c = validarChart({ id: 'x', titulo: 'X', bpm: 100, notas: [{ t: 1, pista: 'A' }, { t: 2, pista: 'C_cima', dur: 0.5 }] });
  assert.deepEqual(
    c?.notas.map((n) => n.pista),
    ['verde', 'azul']
  );
});

test('escala da ocarina', () => {
  assert.equal(Math.round(frequencia('A4')), 440);
  assert.equal(Math.round(frequencia('D4') * 100) / 100, 293.66);
  assert.equal(Math.round(frequencia('D5') * 100) / 100, 587.33);
  assert.equal(Math.round(frequencia('F#4') * 100) / 100, 369.99);
});

test('pontuação: multiplicador, precisão e estrelas', () => {
  assert.deepEqual([0, 9, 10, 19, 20, 30, 99].map(multiplicador), [1, 1, 2, 2, 3, 4, 4]);
  assert.equal(precisao(10, 0, 10), 100);
  assert.equal(precisao(5, 5, 10), 80);
  assert.equal(estrelas(true, 96), 5);
  assert.equal(estrelas(true, 72), 3);
  assert.equal(estrelas(false, 99), 0);
});

test('teclas padrão e alternativas', () => {
  assert.equal(pistaDaTecla('KeyA', TECLAS_PADRAO), 0);
  assert.equal(pistaDaTecla('KeyL', TECLAS_PADRAO), 4);
  assert.equal(pistaDaTecla('Digit1', TECLAS_PADRAO), 0);
  assert.equal(pistaDaTecla('Digit5', TECLAS_PADRAO), 4);
  // teclas salvas no formato antigo (A/C) viram as cores
  assert.deepEqual(migrarTeclas({ A: 'KeyQ', C_cima: 'KeyP' }), { verde: 'KeyQ', azul: 'KeyP' });
  assert.equal(pistaDaTecla('KeyZ', TECLAS_PADRAO), -1);
});

test('todas as músicas de data/jogos/ocarina são válidas e duram 30–60 s', () => {
  const pasta = path.join(process.cwd(), 'data', 'jogos', 'ocarina');
  const arquivos = fs.readdirSync(pasta).filter((f) => f.endsWith('.json'));
  assert.ok(arquivos.length >= 6);
  const ids = new Set<string>();
  for (const f of arquivos) {
    const c = validarChart(JSON.parse(fs.readFileSync(path.join(pasta, f), 'utf8')));
    assert.ok(c, `${f} inválida`);
    assert.ok(!ids.has(c.id), `id repetido: ${c.id}`);
    ids.add(c.id);
    const fim = Math.max(...c.notas.map((n) => n.t + (n.dur ?? 0)));
    assert.ok(fim >= 30 && fim <= 60, `${f}: ${fim.toFixed(1)} s`);
  }
});

test('chart inválido é recusado', () => {
  assert.equal(validarChart({ id: 'x' }), null);
  assert.equal(validarChart({ id: 'x', titulo: 'X', bpm: 100, notas: [{ t: 1, pista: 'Z' }] }), null);
});
