// Testes das regras do sorteio ao vivo. Rodar: npm run test:sorteio
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  avaliarParticipacao,
  ipDaRequisicao,
  mascararEmail,
  mascararIp,
  normalizarInstagram,
  montarRoleta,
  nomePublico,
  progressoRoleta,
  paraStatus,
  proximoStatus,
  type ConfigAntifraude,
  type PedidoParticipacao
} from '../../lib/sorteio/regras.ts';
import { dispararSorteio, type DadosParaSortear, type DepsSorteio, type NovoSorteio } from '../../lib/sorteio/sortear.ts';

// ---------- Confirmar presença ----------

const CONFIG: ConfigAntifraude = { limitePorIp: 3, bloquearDispositivo: true, contasCriadasAntes: '2026-12-11T21:00:00-03:00' };
const PEDIDO: PedidoParticipacao = {
  statusSorteio: 'abertas',
  statusItem: 'abertas',
  aceitouRegulamento: true,
  instagram: 'maria.silva',
  instagramDeOutraConta: false,
  jaParticipa: false,
  contaCriadaEm: '2026-10-01T12:00:00Z',
  participacoesNoIp: 0,
  dispositivoDeOutraConta: false,
  tentativasIp: 1,
  tentativasConta: 1
};
const codigo = (r: ReturnType<typeof avaliarParticipacao>) => (r.ok ? 'ok' : r.codigo);

test('participação válida passa', () => {
  assert.equal(codigo(avaliarParticipacao(CONFIG, PEDIDO)), 'ok');
});

test('uma participação por conta', () => {
  assert.equal(codigo(avaliarParticipacao(CONFIG, { ...PEDIDO, jaParticipa: true })), 'ja-participa');
});

test('só com a página publicada, o item com inscrições abertas e o regulamento aceito', () => {
  for (const statusSorteio of ['rascunho', 'finalizado'] as const) {
    assert.equal(codigo(avaliarParticipacao(CONFIG, { ...PEDIDO, statusSorteio })), 'fechado');
  }
  for (const statusItem of ['em_breve', 'encerradas'] as const) {
    assert.equal(codigo(avaliarParticipacao(CONFIG, { ...PEDIDO, statusItem })), 'fechado');
  }
  assert.equal(codigo(avaliarParticipacao(CONFIG, { ...PEDIDO, aceitouRegulamento: false })), 'regulamento');
});

test('@ do Instagram é obrigatório e único por sorteio', () => {
  assert.equal(codigo(avaliarParticipacao(CONFIG, { ...PEDIDO, instagram: null })), 'instagram');
  assert.equal(codigo(avaliarParticipacao(CONFIG, { ...PEDIDO, instagramDeOutraConta: true })), 'instagram-em-uso');
  assert.equal(normalizarInstagram(' @Maria.Silva '), 'maria.silva');
  assert.equal(normalizarInstagram('https://www.instagram.com/xan_switch/?hl=pt'), 'xan_switch');
  for (const ruim of ['', '@', 'com espaço', '.maria', 'maria.', 'ma..ria', 'a'.repeat(31), 'maria!']) {
    assert.equal(normalizarInstagram(ruim), null, ruim);
  }
});

test('IP aparece escondido no admin', () => {
  assert.equal(mascararIp('189.40.123.45'), '189.40.•••.•••');
  assert.equal(mascararIp('2804:14c:5b:1::1'), '2804:14c:••••');
  assert.equal(mascararIp(null), '—');
});

test('limite por IP configurável (e desligável)', () => {
  assert.equal(codigo(avaliarParticipacao(CONFIG, { ...PEDIDO, participacoesNoIp: 2 })), 'ok');
  assert.equal(codigo(avaliarParticipacao(CONFIG, { ...PEDIDO, participacoesNoIp: 3 })), 'limite-ip');
  assert.equal(codigo(avaliarParticipacao({ ...CONFIG, limitePorIp: null }, { ...PEDIDO, participacoesNoIp: 500 })), 'ok');
  assert.equal(codigo(avaliarParticipacao({ ...CONFIG, limitePorIp: 1 }, { ...PEDIDO, participacoesNoIp: 1 })), 'limite-ip');
});

test('mesmo aparelho com outra conta é bloqueado (quando ligado)', () => {
  assert.equal(codigo(avaliarParticipacao(CONFIG, { ...PEDIDO, dispositivoDeOutraConta: true })), 'dispositivo');
  assert.equal(codigo(avaliarParticipacao({ ...CONFIG, bloquearDispositivo: false }, { ...PEDIDO, dispositivoDeOutraConta: true })), 'ok');
});

test('idade da conta: só contas criadas antes do horário', () => {
  assert.equal(codigo(avaliarParticipacao(CONFIG, { ...PEDIDO, contaCriadaEm: '2026-12-11T23:59:00Z' })), 'ok'); // 20:59 em Brasília
  assert.equal(codigo(avaliarParticipacao(CONFIG, { ...PEDIDO, contaCriadaEm: '2026-12-12T00:01:00Z' })), 'conta-nova');
  assert.equal(codigo(avaliarParticipacao(CONFIG, { ...PEDIDO, contaCriadaEm: '2026-12-12T00:00:00Z' })), 'conta-nova');
  assert.equal(codigo(avaliarParticipacao(CONFIG, { ...PEDIDO, contaCriadaEm: null })), 'conta-nova');
  assert.equal(codigo(avaliarParticipacao({ ...CONFIG, contasCriadasAntes: null }, { ...PEDIDO, contaCriadaEm: null })), 'ok');
});

test('limite de tentativas por minuto', () => {
  assert.equal(codigo(avaliarParticipacao(CONFIG, { ...PEDIDO, tentativasIp: 13 })), 'muitas-tentativas');
  assert.equal(codigo(avaliarParticipacao(CONFIG, { ...PEDIDO, tentativasConta: 7 })), 'muitas-tentativas');
});

// ---------- Como aparece em público ----------

test('e-mail mascarado e nome curto', () => {
  assert.equal(mascararEmail('maria.silva@gmail.com'), 'ma***@gmail.com');
  assert.equal(nomePublico('Maria da Silva', 'x@y.com'), 'Maria S.');
  assert.equal(nomePublico(null, 'joao@y.com'), 'jo***');
  assert.equal(ipDaRequisicao(new Map([['x-forwarded-for', '200.1.2.3, 10.0.0.1']]) as unknown as Headers), '200.1.2.3');
});

test('situação só anda pra frente (e as antigas viram "publicado")', () => {
  assert.equal(proximoStatus('rascunho'), 'abertas');
  assert.equal(proximoStatus('abertas'), 'finalizado');
  assert.equal(proximoStatus('finalizado'), null);
  assert.equal(paraStatus('sorteando'), 'abertas');
  assert.equal(paraStatus('encerradas'), 'abertas');
  assert.equal(paraStatus('lixo'), 'rascunho');
});

test('roleta termina no ganhador e a animação vai de 0 a 1', () => {
  const r = montarRoleta(['A', 'B'], 'GANHADOR', () => 0);
  assert.equal(r[r.length - 1], 'GANHADOR');
  assert.equal(progressoRoleta(0, 100, 1000), 0);
  assert.equal(progressoRoleta(1100, 100, 1000), 1);
});

// ---------- Sortear ----------

// Banco de mentira com as mesmas travas do de verdade (índices únicos).
// Cada pessoa P1..Pn se inscreve em todos os itens (uma inscrição por item:
// id = item * 1000 + pessoa).
function bancoFalso(opcoes: {
  participantes: number;
  premios: { id: number; ganhadores: number; ordem: number; status?: 'em_breve' | 'abertas' | 'encerradas' }[];
  admin?: boolean;
}) {
  let relogio = 1_000_000;
  let proximoId = 1;
  const dados: DadosParaSortear = {
    status: 'abertas',
    premios: opcoes.premios.map((p) => ({ status: 'encerradas' as const, ...p })),
    sorteios: [],
    entradas: opcoes.premios.flatMap((p) =>
      Array.from({ length: opcoes.participantes }, (_, i) => ({ id: p.id * 1000 + i + 1, premioId: p.id, desclassificado: false, nomeExibicao: `P${i + 1}` }))
    )
  };
  const gravados: NovoSorteio[] = [];
  let sorteio = 7;
  const deps: DepsSorteio = {
    ehAdmin: async () => opcoes.admin !== false,
    carregar: async () => structuredClone(dados),
    gravar: async (s) => {
      const vagaOcupada = dados.sorteios.some((x) => !x.anulado && x.premioId === s.premioId && x.vaga === s.vaga && x.id !== s.refazer?.sorteioId);
      const repetido = dados.sorteios.some((x) => x.entradaId === s.entradaId);
      if (vagaOcupada || repetido) return 'conflito';
      if (s.refazer) dados.sorteios = dados.sorteios.map((x) => (x.id === s.refazer!.sorteioId ? { ...x, anulado: true } : x));
      dados.sorteios.push({ id: proximoId++, premioId: s.premioId, entradaId: s.entradaId, vaga: s.vaga, anulado: false, fimAnimacao: s.inicio + s.duracao });
      gravados.push(s);
      return 'ok';
    },
    agora: () => relogio,
    aleatorio: (n) => (sorteio = (sorteio * 16807) % 2147483647) % n
  };
  return { deps, dados, gravados, avancar: (ms: number) => (relogio += ms) };
}

test('só o admin dispara o sorteio', async () => {
  const b = bancoFalso({ participantes: 5, premios: [{ id: 1, ganhadores: 1, ordem: 1 }], admin: false });
  const r = await dispararSorteio(b.deps);
  assert.equal(r.ok, false);
  assert.equal(b.gravados.length, 0);
});

test('só sorteia com a página publicada e as inscrições do item encerradas', async () => {
  const b = bancoFalso({ participantes: 5, premios: [{ id: 1, ganhadores: 1, ordem: 1, status: 'abertas' }] });
  assert.equal((await dispararSorteio(b.deps)).ok, false);
  assert.equal((await dispararSorteio(b.deps, { premioId: 1 })).ok, false);
  b.dados.premios[0].status = 'encerradas';
  b.dados.status = 'rascunho';
  assert.equal((await dispararSorteio(b.deps)).ok, false);
  b.dados.status = 'abertas';
  assert.equal((await dispararSorteio(b.deps)).ok, true);
});

test('cada item é sorteado na sua hora: um fechado não atrapalha o outro', async () => {
  const b = bancoFalso({
    participantes: 4,
    premios: [
      { id: 1, ganhadores: 1, ordem: 1, status: 'abertas' },
      { id: 2, ganhadores: 1, ordem: 2, status: 'encerradas' }
    ]
  });
  const r = await dispararSorteio(b.deps);
  assert.equal(r.ok, true);
  assert.equal(b.gravados[0].premioId, 2);
  assert.equal(Math.floor(b.gravados[0].entradaId / 1000), 2); // inscrição do item 2
});

test('a mesma pessoa pode ganhar itens diferentes', async () => {
  const b = bancoFalso({
    participantes: 1,
    premios: [
      { id: 1, ganhadores: 1, ordem: 1 },
      { id: 2, ganhadores: 1, ordem: 2 }
    ]
  });
  assert.equal((await dispararSorteio(b.deps)).ok, true);
  b.avancar(20_000);
  assert.equal((await dispararSorteio(b.deps)).ok, true);
  assert.deepEqual(
    b.gravados.map((g) => g.roleta[g.roleta.length - 1]),
    ['P1', 'P1']
  );
});

test('só concorre quem se inscreveu no item', async () => {
  const b = bancoFalso({ participantes: 3, premios: [{ id: 1, ganhadores: 1, ordem: 1 }, { id: 2, ganhadores: 1, ordem: 2 }] });
  b.dados.entradas = b.dados.entradas.filter((e) => e.premioId === 1 || e.id === 2003);
  assert.equal((await dispararSorteio(b.deps, { premioId: 2 })).ok, true);
  assert.equal(b.gravados[0].entradaId, 2003);
});

test('ninguém ganha duas vezes o mesmo item e os itens saem na ordem', async () => {
  const b = bancoFalso({
    participantes: 6,
    premios: [
      { id: 2, ganhadores: 3, ordem: 2 },
      { id: 1, ganhadores: 2, ordem: 1 }
    ]
  });
  for (let i = 0; i < 5; i++) {
    const r = await dispararSorteio(b.deps);
    assert.equal(r.ok, true);
    b.avancar(20_000);
  }
  assert.deepEqual(
    b.gravados.map((g) => g.premioId),
    [1, 1, 2, 2, 2]
  );
  assert.equal(new Set(b.gravados.map((g) => g.entradaId)).size, 5);
  for (const g of b.gravados) assert.equal(g.roleta[g.roleta.length - 1], `P${g.entradaId % 1000}`);
  // Tudo sorteado: não sorteia mais
  assert.equal((await dispararSorteio(b.deps)).ok, false);
});

test('espera a animação anterior terminar', async () => {
  const b = bancoFalso({ participantes: 5, premios: [{ id: 1, ganhadores: 3, ordem: 1 }] });
  assert.equal((await dispararSorteio(b.deps)).ok, true);
  assert.equal((await dispararSorteio(b.deps)).ok, false);
  b.avancar(20_000);
  assert.equal((await dispararSorteio(b.deps)).ok, true);
});

test('re-sortear anula o anterior, mantém no histórico e não sorteia a mesma pessoa', async () => {
  const b = bancoFalso({ participantes: 3, premios: [{ id: 1, ganhadores: 1, ordem: 1 }] });
  await dispararSorteio(b.deps);
  b.avancar(20_000);
  const primeiro = b.dados.sorteios[0];
  assert.equal((await dispararSorteio(b.deps, { refazer: { sorteioId: primeiro.id, motivo: '' } })).ok, false);
  const r = await dispararSorteio(b.deps, { refazer: { sorteioId: primeiro.id, motivo: 'não respondeu' } });
  assert.equal(r.ok, true);
  assert.equal(b.dados.sorteios.length, 2);
  assert.equal(b.dados.sorteios[0].anulado, true);
  assert.notEqual(b.dados.sorteios[1].entradaId, primeiro.entradaId);
  assert.equal(b.gravados[1].vaga, 1);
});

test('desclassificados não ganham', async () => {
  const b = bancoFalso({ participantes: 4, premios: [{ id: 1, ganhadores: 4, ordem: 1 }] });
  b.dados.entradas = b.dados.entradas.map((e) => ({ ...e, desclassificado: e.id !== 1003 }));
  assert.equal((await dispararSorteio(b.deps)).ok, true);
  assert.equal(b.gravados[0].entradaId, 1003);
  b.avancar(20_000);
  assert.equal((await dispararSorteio(b.deps)).ok, false);
});

test('dois cliques ao mesmo tempo: o banco barra e o segundo tenta de novo', async () => {
  const b = bancoFalso({ participantes: 10, premios: [{ id: 1, ganhadores: 2, ordem: 1 }] });
  // Simula outro sorteio gravado entre o "carregar" e o "gravar".
  const carregarOriginal = b.deps.carregar;
  let primeira = true;
  b.deps.carregar = async () => {
    const d = await carregarOriginal();
    if (primeira) {
      primeira = false;
      b.dados.sorteios.push({ id: 99, premioId: 1, entradaId: 1001, vaga: 1, anulado: false, fimAnimacao: 0 });
    }
    return d;
  };
  const r = await dispararSorteio(b.deps);
  assert.equal(r.ok, true);
  assert.equal(b.gravados[0].vaga, 2);
  assert.notEqual(b.gravados[0].entradaId, 1001);
});
