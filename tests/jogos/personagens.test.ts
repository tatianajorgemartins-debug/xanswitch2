// Confere o data/jogos/personagens.json (útil depois de editar à mão).
// Rodar: npm run test:jogos
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const NIVEIS = ['facil', 'medio', 'dificil', 'insano'];
const lista = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'jogos', 'personagens.json'), 'utf8')) as Record<string, unknown>[];

test('personagens.json: campos certos, ids únicos e imagens existentes', () => {
  const ids = new Set<string>();
  for (const p of lista) {
    const quem = String(p.id);
    assert.equal(typeof p.id, 'string', 'sem id');
    assert.ok(!ids.has(quem), `id repetido: ${quem}`);
    ids.add(quem);
    assert.ok(typeof p.nome === 'string' && p.nome, `${quem}: sem nome`);
    assert.ok(Array.isArray(p.niveis) && p.niveis.length && p.niveis.every((n) => NIVEIS.includes(n)), `${quem}: nível inválido`);
    if (p.aceitos !== undefined) assert.ok(Array.isArray(p.aceitos), `${quem}: "aceitos" tem que ser uma lista`);
    if (p.ativo_desde !== undefined) assert.match(String(p.ativo_desde), /^\d{4}-\d{2}-\d{2}$/, `${quem}: ativo_desde`);
    for (const suf of ['s', 'c']) {
      const f = path.join(process.cwd(), 'public', 'jogos', 'silhueta', `${p.imagem}-${suf}.webp`);
      assert.ok(fs.existsSync(f), `${quem}: falta a imagem ${p.imagem}-${suf}.webp (rode a sincronização)`);
    }
  }
});
