// Banco dos sorteios ao vivo (tabelas de db/migration-sorteios.sql). Só roda
// no servidor. As regras ficam em lib/sorteio/regras.ts.
import { getSql } from './sql';
import { ehStatus, nomePublico, type StatusSorteio } from './sorteio/regras';
import { ganhadorPublico, type EstadoPublico, type PremioPublico, type SorteioPublico } from './sorteio/estado';
import type { DadosParaSortear, NovoSorteio } from './sorteio/sortear';

export type Sorteio = {
  id: number;
  slug: string;
  titulo: string;
  descricao: string;
  regulamento: string;
  data: string | null; // ISO
  banner: string | null;
  mensagemGanhador: string;
  status: StatusSorteio;
  teste: boolean;
  limitePorIp: number | null;
  bloquearDispositivo: boolean;
  contasCriadasAntes: string | null; // ISO
};

export type Premio = PremioPublico;

export type Participacao = {
  id: number;
  codigo: string;
  usuario: string;
  email: string;
  nome: string | null;
  ip: string | null;
  navegador: string | null;
  dispositivo: string | null;
  teste: boolean;
  desclassificado: boolean;
  motivo: string | null;
  criadoEm: string;
};

export type SorteioFeito = {
  id: number;
  premioId: number;
  vaga: number;
  entradaId: number;
  quem: string;
  refeito: boolean;
  substituiu: number | null;
  anulado: boolean;
  motivoAnulado: string | null;
  inicio: number;
  duracao: number;
  roleta: string[];
  criadoEm: string;
  ganhador: { codigo: string; nome: string | null; email: string };
};

type Linha = Record<string, unknown>;
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

function paraSorteio(r: Linha): Sorteio {
  return {
    id: Number(r.id),
    slug: String(r.slug),
    titulo: String(r.title),
    descricao: String(r.description ?? ''),
    regulamento: String(r.rules ?? ''),
    data: iso(r.event_at),
    banner: (r.banner_url as string | null) ?? null,
    mensagemGanhador: String(r.winner_message ?? ''),
    status: ehStatus(r.status) ? r.status : 'rascunho',
    teste: Boolean(r.test_mode),
    limitePorIp: r.ip_limit === null || r.ip_limit === undefined ? null : Number(r.ip_limit),
    bloquearDispositivo: Boolean(r.block_same_device),
    contasCriadasAntes: iso(r.accounts_created_before)
  };
}

function paraPremio(r: Linha): Premio {
  return {
    id: Number(r.id),
    nome: String(r.name),
    descricao: String(r.description ?? ''),
    imagem: (r.image_url as string | null) ?? null,
    ganhadores: Number(r.winners_count),
    ordem: Number(r.sort_order)
  };
}

function paraParticipacao(r: Linha): Participacao {
  return {
    id: Number(r.id),
    codigo: String(r.public_id),
    usuario: String(r.user_id),
    email: String(r.email),
    nome: (r.name as string | null) ?? null,
    ip: (r.ip as string | null) ?? null,
    navegador: (r.user_agent as string | null) ?? null,
    dispositivo: (r.device_id as string | null) ?? null,
    teste: Boolean(r.is_test),
    desclassificado: Boolean(r.disqualified),
    motivo: (r.disqualified_reason as string | null) ?? null,
    criadoEm: new Date(r.created_at as string).toISOString()
  };
}

function paraSorteioFeito(r: Linha): SorteioFeito {
  return {
    id: Number(r.id),
    premioId: Number(r.prize_id),
    vaga: Number(r.slot),
    entradaId: Number(r.entry_id),
    quem: String(r.triggered_by),
    refeito: Boolean(r.is_redraw),
    substituiu: r.replaced_draw_id === null ? null : Number(r.replaced_draw_id),
    anulado: Boolean(r.voided),
    motivoAnulado: (r.voided_reason as string | null) ?? null,
    inicio: new Date(r.started_at as string).getTime(),
    duracao: Number(r.duration_ms),
    roleta: Array.isArray(r.reel) ? (r.reel as string[]) : [],
    criadoEm: new Date(r.created_at as string).toISOString(),
    ganhador: { codigo: String(r.public_id), nome: (r.name as string | null) ?? null, email: String(r.email) }
  };
}

// ---------- Sorteios ----------

export type ResumoSorteio = Sorteio & { participantes: number; premios: number };

export async function listarSorteios(): Promise<ResumoSorteio[]> {
  const rows = await getSql()`
    SELECT r.*,
      (SELECT count(*)::int FROM raffle_entries e WHERE e.raffle_id = r.id AND NOT e.disqualified) AS participantes,
      (SELECT count(*)::int FROM raffle_prizes p WHERE p.raffle_id = r.id) AS premios
    FROM raffles r ORDER BY r.created_at DESC
  `;
  return (rows as Linha[]).map((r) => ({ ...paraSorteio(r), participantes: Number(r.participantes), premios: Number(r.premios) }));
}

export async function criarSorteio(titulo: string, slug: string): Promise<number> {
  const rows = await getSql()`INSERT INTO raffles (title, slug) VALUES (${titulo}, ${slug}) RETURNING id`;
  return Number((rows[0] as Linha).id);
}

export async function obterSorteio(id: number): Promise<Sorteio | null> {
  const rows = await getSql()`SELECT * FROM raffles WHERE id = ${id}`;
  return rows[0] ? paraSorteio(rows[0] as Linha) : null;
}

export async function obterSorteioPorSlug(slug: string): Promise<Sorteio | null> {
  const rows = await getSql()`SELECT * FROM raffles WHERE slug = ${slug}`;
  return rows[0] ? paraSorteio(rows[0] as Linha) : null;
}

export type CamposSorteio = Omit<Sorteio, 'id' | 'status' | 'teste'>;

export async function salvarSorteio(id: number, c: CamposSorteio): Promise<void> {
  await getSql()`
    UPDATE raffles SET slug = ${c.slug}, title = ${c.titulo}, description = ${c.descricao}, rules = ${c.regulamento},
      event_at = ${c.data}, banner_url = ${c.banner}, winner_message = ${c.mensagemGanhador}, ip_limit = ${c.limitePorIp},
      block_same_device = ${c.bloquearDispositivo}, accounts_created_before = ${c.contasCriadasAntes}, updated_at = now()
    WHERE id = ${id}
  `;
}

// Só muda se ainda estiver na situação esperada (dois cliques não pulam duas etapas).
export async function mudarStatus(id: number, de: StatusSorteio, para: StatusSorteio): Promise<boolean> {
  const rows = await getSql()`UPDATE raffles SET status = ${para}, updated_at = now() WHERE id = ${id} AND status = ${de} RETURNING id`;
  return rows.length > 0;
}

export async function ligarModoTeste(id: number, ligado: boolean): Promise<void> {
  await getSql()`UPDATE raffles SET test_mode = ${ligado}, updated_at = now() WHERE id = ${id}`;
}

// Volta ao começo: apaga sorteios, participações e tentativas.
export async function resetarSorteio(id: number): Promise<void> {
  const sql = getSql();
  await sql.transaction([
    sql`DELETE FROM raffle_draws WHERE raffle_id = ${id}`,
    sql`DELETE FROM raffle_entries WHERE raffle_id = ${id}`,
    sql`DELETE FROM raffle_attempts WHERE raffle_id = ${id}`,
    sql`UPDATE raffles SET status = 'rascunho', updated_at = now() WHERE id = ${id}`
  ]);
}

export async function apagarSorteio(id: number): Promise<void> {
  await getSql()`DELETE FROM raffles WHERE id = ${id}`;
}

// ---------- Prêmios ----------

export async function listarPremios(raffleId: number): Promise<Premio[]> {
  const rows = await getSql()`SELECT * FROM raffle_prizes WHERE raffle_id = ${raffleId} ORDER BY sort_order, id`;
  return (rows as Linha[]).map(paraPremio);
}

export async function salvarPremio(raffleId: number, id: number | null, p: Omit<Premio, 'id'>): Promise<void> {
  const sql = getSql();
  if (id === null) {
    await sql`
      INSERT INTO raffle_prizes (raffle_id, name, description, image_url, winners_count, sort_order)
      VALUES (${raffleId}, ${p.nome}, ${p.descricao}, ${p.imagem}, ${p.ganhadores}, ${p.ordem})
    `;
  } else {
    await sql`
      UPDATE raffle_prizes SET name = ${p.nome}, description = ${p.descricao}, image_url = ${p.imagem},
        winners_count = ${p.ganhadores}, sort_order = ${p.ordem}
      WHERE id = ${id} AND raffle_id = ${raffleId}
    `;
  }
}

export async function apagarPremio(raffleId: number, id: number): Promise<void> {
  await getSql()`DELETE FROM raffle_prizes WHERE id = ${id} AND raffle_id = ${raffleId}`;
}

// ---------- Participações ----------

export async function contarParticipantes(raffleId: number): Promise<number> {
  const rows = await getSql()`SELECT count(*)::int AS n FROM raffle_entries WHERE raffle_id = ${raffleId} AND NOT disqualified`;
  return Number((rows[0] as Linha).n);
}

export async function obterParticipacao(raffleId: number, usuario: string): Promise<Participacao | null> {
  const rows = await getSql()`SELECT * FROM raffle_entries WHERE raffle_id = ${raffleId} AND user_id = ${usuario}`;
  return rows[0] ? paraParticipacao(rows[0] as Linha) : null;
}

// Participações de OUTRAS contas no mesmo IP / no mesmo aparelho.
export async function contarNoIp(raffleId: number, ip: string, usuario: string): Promise<number> {
  const rows = await getSql()`
    SELECT count(*)::int AS n FROM raffle_entries WHERE raffle_id = ${raffleId} AND ip = ${ip} AND user_id <> ${usuario} AND NOT is_test
  `;
  return Number((rows[0] as Linha).n);
}

export async function dispositivoDeOutraConta(raffleId: number, dispositivos: string[], usuario: string): Promise<boolean> {
  if (!dispositivos.length) return false;
  const rows = await getSql()`
    SELECT 1 FROM raffle_entries
    WHERE raffle_id = ${raffleId} AND device_id = ANY(${dispositivos}) AND user_id <> ${usuario} AND NOT is_test
    LIMIT 1
  `;
  return rows.length > 0;
}

// 'duplicada' = a conta já tinha participação (UNIQUE do banco).
export async function inserirParticipacao(p: {
  raffleId: number;
  usuario: string;
  email: string;
  nome: string | null;
  ip: string | null;
  navegador: string | null;
  dispositivo: string | null;
}): Promise<{ ok: true; codigo: string } | { ok: false; duplicada: true }> {
  const rows = await getSql()`
    INSERT INTO raffle_entries (raffle_id, user_id, email, name, ip, user_agent, device_id)
    VALUES (${p.raffleId}, ${p.usuario}, ${p.email}, ${p.nome}, ${p.ip}, ${p.navegador}, ${p.dispositivo})
    ON CONFLICT (raffle_id, user_id) DO NOTHING
    RETURNING public_id
  `;
  return rows[0] ? { ok: true, codigo: String((rows[0] as Linha).public_id) } : { ok: false, duplicada: true };
}

export async function listarParticipacoes(raffleId: number): Promise<Participacao[]> {
  const rows = await getSql()`SELECT * FROM raffle_entries WHERE raffle_id = ${raffleId} ORDER BY created_at DESC`;
  return (rows as Linha[]).map(paraParticipacao);
}

export async function desclassificar(raffleId: number, entradaId: number, sim: boolean, motivo: string | null): Promise<void> {
  await getSql()`
    UPDATE raffle_entries SET disqualified = ${sim}, disqualified_reason = ${sim ? motivo : null}
    WHERE id = ${entradaId} AND raffle_id = ${raffleId}
  `;
}

// Participantes fictícios pro ensaio (modo de teste).
export async function gerarParticipantesTeste(raffleId: number, quantos: number): Promise<void> {
  const nomes = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabi', 'Hugo', 'Iara', 'João', 'Kauã', 'Lara', 'Mateus', 'Nina', 'Otávio', 'Paula'];
  const sobrenomes = ['Silva', 'Souza', 'Lima', 'Costa', 'Rocha', 'Alves', 'Pereira', 'Martins', 'Gomes', 'Ribeiro'];
  const base = Date.now();
  const linhas = Array.from({ length: quantos }, (_, i) => ({
    usuario: `teste:${base}:${i}`,
    email: `teste${base % 100000}${i}@teste.xanswitch`,
    nome: `${nomes[i % nomes.length]} ${sobrenomes[(i * 7) % sobrenomes.length]}`,
    ip: `10.0.${Math.floor(i / 250)}.${i % 250}`
  }));
  await getSql()`
    INSERT INTO raffle_entries (raffle_id, user_id, email, name, ip, user_agent, device_id, is_test)
    SELECT ${raffleId}, u, e, n, i, 'teste', 'teste:' || u, TRUE
    FROM unnest(${linhas.map((l) => l.usuario)}::text[], ${linhas.map((l) => l.email)}::text[], ${linhas.map((l) => l.nome)}::text[], ${linhas.map((l) => l.ip)}::text[]) AS t(u, e, n, i)
    ON CONFLICT DO NOTHING
  `;
}

// ---------- Limite de tentativas ----------

// Registra esta tentativa e devolve quantas houve no último minuto.
export async function registrarTentativa(raffleId: number, ip: string | null, usuario: string): Promise<{ ip: number; conta: number }> {
  const sql = getSql();
  await sql`INSERT INTO raffle_attempts (raffle_id, ip, user_id) VALUES (${raffleId}, ${ip}, ${usuario})`;
  const rows = await sql`
    SELECT
      count(*) FILTER (WHERE ip IS NOT DISTINCT FROM ${ip})::int AS ip,
      count(*) FILTER (WHERE user_id = ${usuario})::int AS conta
    FROM raffle_attempts WHERE raffle_id = ${raffleId} AND created_at > now() - interval '1 minute'
  `;
  const r = rows[0] as Linha;
  return { ip: Number(r.ip), conta: Number(r.conta) };
}

// ---------- Sorteios feitos ----------

export async function listarSorteiosFeitos(raffleId: number): Promise<SorteioFeito[]> {
  const rows = await getSql()`
    SELECT d.*, e.public_id, e.name, e.email FROM raffle_draws d
    JOIN raffle_entries e ON e.id = d.entry_id
    WHERE d.raffle_id = ${raffleId} ORDER BY d.started_at, d.id
  `;
  return (rows as Linha[]).map(paraSorteioFeito);
}

// Tudo que o sorteio precisa pra escolher um ganhador.
export async function carregarParaSortear(raffleId: number): Promise<DadosParaSortear> {
  const [sorteio, premios, sorteios, entradas] = await Promise.all([
    obterSorteio(raffleId),
    listarPremios(raffleId),
    listarSorteiosFeitos(raffleId),
    listarParticipacoes(raffleId)
  ]);
  return {
    status: sorteio?.status ?? 'rascunho',
    premios,
    sorteios: sorteios.map((s) => ({ id: s.id, premioId: s.premioId, entradaId: s.entradaId, vaga: s.vaga, anulado: s.anulado, fimAnimacao: s.inicio + s.duracao })),
    entradas: entradas.map((e) => ({ id: e.id, desclassificado: e.desclassificado, nomeExibicao: nomePublico(e.nome, e.email) }))
  };
}

// Grava o ganhador (e anula o anterior, se for re-sorteio), tudo junto.
// 'conflito' = os índices únicos barraram (vaga ou ganhador já usados).
export async function gravarSorteio(raffleId: number, s: NovoSorteio, quem: string): Promise<'ok' | 'conflito'> {
  const sql = getSql();
  const inicio = new Date(s.inicio).toISOString();
  const inserir = sql`
    INSERT INTO raffle_draws (raffle_id, prize_id, slot, entry_id, triggered_by, is_redraw, replaced_draw_id, started_at, duration_ms, reel)
    VALUES (${raffleId}, ${s.premioId}, ${s.vaga}, ${s.entradaId}, ${quem}, ${s.refazer !== null}, ${s.refazer?.sorteioId ?? null},
      ${inicio}, ${s.duracao}, ${JSON.stringify(s.roleta)}::jsonb)
  `;
  try {
    if (s.refazer) {
      await sql.transaction([
        sql`UPDATE raffle_draws SET voided = TRUE, voided_reason = ${s.refazer.motivo} WHERE id = ${s.refazer.sorteioId} AND raffle_id = ${raffleId}`,
        inserir
      ]);
    } else {
      await inserir;
    }
    return 'ok';
  } catch (err) {
    if ((err as { code?: string })?.code === '23505') return 'conflito';
    throw err;
  }
}

// ---------- O que as telas públicas veem ----------

export async function montarEstadoPublico(sorteio: Sorteio): Promise<EstadoPublico> {
  const [premios, participantes, feitos] = await Promise.all([
    listarPremios(sorteio.id),
    contarParticipantes(sorteio.id),
    listarSorteiosFeitos(sorteio.id)
  ]);
  const sorteios: SorteioPublico[] = feitos
    .filter((s) => !s.anulado)
    .map((s) => ({
      id: s.id,
      premioId: s.premioId,
      vaga: s.vaga,
      inicio: s.inicio,
      duracao: s.duracao,
      roleta: s.roleta,
      refeito: s.refeito,
      ganhador: ganhadorPublico({ public_id: s.ganhador.codigo, name: s.ganhador.nome, email: s.ganhador.email })
    }));
  return {
    agora: Date.now(),
    sorteio: {
      slug: sorteio.slug,
      titulo: sorteio.titulo,
      descricao: sorteio.descricao,
      regulamento: sorteio.regulamento,
      banner: sorteio.banner,
      data: sorteio.data,
      status: sorteio.status,
      teste: sorteio.teste,
      mensagemGanhador: sorteio.mensagemGanhador
    },
    premios,
    participantes,
    sorteios
  };
}

// Público pode ver: tudo que saiu do rascunho, ou o rascunho em modo de teste.
export const sorteioVisivel = (s: Sorteio) => s.status !== 'rascunho' || s.teste;
