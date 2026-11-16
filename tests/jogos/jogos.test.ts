// Testes dos jogos diários. Rodar: npm run test:jogos
import test from 'node:test';
import assert from 'node:assert/strict';
import { addDias, diaEm, diffDias, msAteProximoDia, rngDe } from '../../lib/jogos/dia.ts';
import { ativoEm, numeroDoDia, sortearDoDia } from '../../lib/jogos/sorteio.ts';
import { normalizar, respostaConfere, sugestoes } from '../../lib/jogos/respostas.ts';
import { avancarSequencia, registrarResultado, sequenciaHoje, SEQUENCIA_VAZIA, STATS_VAZIO } from '../../lib/jogos/sequencia.ts';

// ---------- Dia em Brasília ----------

test('dia em Brasília perto da meia-noite', () => {
  // 02:59 UTC = 23:59 de Brasília do dia anterior
  assert.equal(diaEm(new Date('2026-11-17T02:59:59Z')), '2026-11-16');
  // 03:00 UTC = 00:00 de Brasília
  assert.equal(diaEm(new Date('2026-11-17T03:00:00Z')), '2026-11-17');
  // virada de ano
  assert.equal(diaEm(new Date('2027-01-01T02:30:00Z')), '2026-12-31');
  assert.equal(diaEm(new Date('2027-01-01T03:00:01Z')), '2027-01-01');
});

test('contador até o próximo desafio', () => {
  assert.equal(msAteProximoDia(new Date('2026-11-17T02:59:00Z')), 60_000);
  assert.equal(msAteProximoDia(new Date('2026-11-17T03:00:00Z')), 86_400_000);
});

test('soma e diferença de dias', () => {
  assert.equal(addDias('2026-02-28', 1), '2026-03-01');
  assert.equal(addDias('2026-12-31', 1), '2027-01-01');
  assert.equal(diffDias('2026-11-16', '2026-12-16'), 30);
});

// ---------- Sorteio ----------

const lista = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, niveis: ['facil'], ativo_desde: '2026-11-16' }));

test('mesma data e mesma semente dão o mesmo resultado', () => {
  assert.equal(rngDe('2026-11-20:facil')(), rngDe('2026-11-20:facil')());
  assert.notEqual(rngDe('2026-11-20:facil')(), rngDe('2026-11-21:facil')());
  for (const d of ['2026-11-16', '2026-11-30', '2027-03-02']) {
    assert.equal(sortearDoDia(lista, 'facil', d, '2026-11-16', 's')?.id, sortearDoDia([...lista].reverse(), 'facil', d, '2026-11-16', 's')?.id);
  }
});

test('não repete antes de passar por todos', () => {
  const ids = Array.from({ length: 8 }, (_, i) => sortearDoDia(lista, 'facil', addDias('2026-11-16', i), '2026-11-16', 's')!.id);
  assert.equal(new Set(ids).size, 8);
  // e não repete o mesmo em dois dias seguidos na virada do ciclo
  for (let i = 1; i < 40; i++) {
    const a = sortearDoDia(lista, 'facil', addDias('2026-11-16', i - 1), '2026-11-16', 's')!.id;
    const b = sortearDoDia(lista, 'facil', addDias('2026-11-16', i), '2026-11-16', 's')!.id;
    assert.notEqual(a, b);
  }
});

test('personagem novo não muda os dias que já passaram nem o de hoje', () => {
  const hoje = '2026-12-05';
  const antes = Array.from({ length: 20 }, (_, i) => sortearDoDia(lista, 'facil', addDias('2026-11-16', i), '2026-11-16', 's')!.id);
  const comNovos = [...lista, { id: 'novo1', niveis: ['facil'], ativo_desde: addDias(hoje, 1) }, { id: 'novo2', niveis: ['facil'], ativo_desde: addDias(hoje, 1) }];
  const depois = Array.from({ length: 20 }, (_, i) => sortearDoDia(comNovos, 'facil', addDias('2026-11-16', i), '2026-11-16', 's')!.id);
  assert.deepEqual(depois, antes);
  // e os novos aparecem depois
  const futuros = Array.from({ length: 30 }, (_, i) => sortearDoDia(comNovos, 'facil', addDias(hoje, i + 1), '2026-11-16', 's')!.id);
  assert.ok(futuros.includes('novo1') && futuros.includes('novo2'));
});

test('desativado sai do sorteio só a partir de inativo_desde', () => {
  const p = { id: 'x', ativo: false, ativo_desde: '2026-11-16', inativo_desde: '2026-12-01' };
  assert.equal(ativoEm(p, '2026-11-30'), true);
  assert.equal(ativoEm(p, '2026-12-01'), false);
  assert.equal(ativoEm({ id: 'y', ativo: false }, '2026-11-20'), false);
  assert.equal(numeroDoDia('2026-11-16', '2026-11-16'), 1);
  assert.equal(numeroDoDia('2026-12-27', '2026-11-16'), 42);
});

// ---------- Sequência ----------

test('sequência: dia seguido soma, dia pulado recomeça, mesmo dia não conta duas vezes', () => {
  let s = avancarSequencia(SEQUENCIA_VAZIA, '2026-11-16', true);
  assert.equal(s.atual, 1);
  s = avancarSequencia(s, '2026-11-17', true);
  assert.equal(s.atual, 2);
  assert.equal(avancarSequencia(s, '2026-11-17', true).atual, 2); // jogou de novo hoje
  assert.equal(sequenciaHoje(s, '2026-11-18'), 2); // ainda dá pra continuar hoje
  assert.equal(sequenciaHoje(s, '2026-11-19'), 0); // pulou um dia: quebrou
  s = avancarSequencia(s, '2026-11-19', true);
  assert.equal(s.atual, 1);
  assert.equal(s.melhor, 2);
  s = avancarSequencia(s, '2026-11-20', false); // perdeu
  assert.equal(s.atual, 0);
});

test('estatísticas: não registra o mesmo dia duas vezes', () => {
  let st = registrarResultado(STATS_VAZIO, { dia: '2026-11-16', venceu: true, tentativas: 2 });
  st = registrarResultado(st, { dia: '2026-11-16', venceu: false, tentativas: 3 });
  assert.equal(st.partidas, 1);
  assert.deepEqual(st.distribuicao, { '2': 1 });
  st = registrarResultado(st, { dia: '2026-11-17', venceu: false, tentativas: 3 });
  assert.deepEqual(st.distribuicao, { '2': 1, X: 1 });
  assert.equal(st.sequencia.atual, 0);
});

// ---------- Respostas ----------

test('respostas ignoram acentos, maiúsculas, espaços e aceitam apelidos', () => {
  const p = { nome: 'Mr. Game & Watch', aceitos: ['game and watch'] };
  assert.equal(normalizar('  Pokémon-Ã '), 'pokemona');
  assert.ok(respostaConfere('mr game e watch', p));
  assert.ok(respostaConfere('GAME AND WATCH', p));
  assert.ok(respostaConfere('Meta-Knight', { nome: 'Meta Knight' }));
  assert.ok(respostaConfere('princesa zélda', { nome: 'Zelda', aceitos: ['princesa zelda'] }));
  assert.ok(!respostaConfere('Link', { nome: 'Zelda' }));
  assert.ok(!respostaConfere('   ', { nome: 'Zelda' }));
  assert.deepEqual(sugestoes('gan', ['Ganondorf', 'Ganondorf', 'Gyorg', 'Pagan']), ['Ganondorf', 'Pagan']);
});
