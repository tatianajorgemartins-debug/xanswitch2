'use server';

// Ações dos jogos interativos chamadas pelo navegador:
//  - registrar cada partida terminada (vai pro admin, aba "Jogos
//    interativos");
//  - o feed de resultados (/testes/feed): publicar, listar, curtir, apagar.
// Quem está logado é conferido com o próprio Supabase (o navegador manda o
// token, nunca o e-mail). Se a tabela ainda não existe (falta rodar
// db/migration-jogos-interativos.sql), registrar falha em silêncio e o feed
// avisa.
import {
  countPostsTodayByEmail,
  countRecentPlaysByVisitor,
  deletePost,
  getLikedPostIds,
  getPostById,
  getRecordesOcarina,
  getVisiblePosts,
  insertGamePlay,
  insertGamePost,
  toggleLike,
  type GamePostRow
} from '@/lib/jogosDb';
import { verifyAccessToken, verifyAccessTokenProfile } from '@/lib/supabaseAuthServer';
import { dificuldadesDaMusica, getOcarinaSong } from '@/lib/ocarinaDb';
import { loadCatalogData } from '@/lib/catalogData';
import { normalizar } from '@/lib/jogos/respostas';
import { imagemDoPost, type ImagemPost } from './feed/imagemPost';

const JOGOS = ['silhueta', 'ocarina', 'qual-link', 'proximo-jogo'] as const;
const ehJogo = (g: unknown): g is (typeof JOGOS)[number] => typeof g === 'string' && (JOGOS as readonly string[]).includes(g);
const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// ---------- Classificação do Zelda Tour ----------

const ID_RANKING = /^m(\d{1,9}):(facil|medio|dificil|insano)$/;

// Na classificação aparece só o primeiro nome e a inicial do sobrenome.
function nomePublico(nome: string | null): string {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return 'Jogador XAN';
  const primeiro = partes[0].slice(0, 18);
  return partes.length > 1 ? `${primeiro} ${partes[partes.length - 1][0].toUpperCase()}.` : primeiro;
}

// A pontuação cabe no máximo que aquela música dá? (x4 de combo e x2 do especial)
async function pontuacaoPossivel(d: Record<string, unknown>, pontos: unknown): Promise<boolean> {
  const m = ID_RANKING.exec(String(d.chartId ?? ''));
  if (!m || d.completou !== true || typeof pontos !== 'number' || pontos <= 0) return false;
  const musica = await getOcarinaSong(Number(m[1]));
  if (!musica?.published) return false;
  const notas = dificuldadesDaMusica(musica).notas[m[2]] ?? [];
  const acertos = Number(d.perfeitos) + Number(d.bons);
  if (!notas.length || !Number.isFinite(acertos) || acertos > notas.length) return false;
  const teto = notas.reduce((total, n) => total + 400 + (n.dur ?? 0) * 320, 0);
  return pontos <= teto + 1;
}

export type LinhaClassificacao = { posicao: number; nome: string; pontos: number; precisao: number; estrelas: number; meu: boolean };
export type Classificacao = { ok: true; linhas: LinhaClassificacao[]; logado: boolean } | { ok: false };

export async function classificacaoAction(accessToken: string | null, chartId: string): Promise<Classificacao> {
  if (!ID_RANKING.test(String(chartId))) return { ok: false };
  try {
    const email = (await verifyAccessToken(accessToken).catch(() => null))?.toLowerCase() ?? null;
    const recordes = await getRecordesOcarina(chartId);
    return {
      ok: true,
      logado: email !== null,
      // o e-mail fica no servidor: o navegador só recebe se a linha é da pessoa
      linhas: recordes.map((r, i) => ({
        posicao: i + 1,
        nome: r.nome,
        pontos: r.score,
        precisao: Number(r.precisao) || 0,
        estrelas: Number(r.estrelas) || 0,
        meu: email !== null && r.customer_email === email
      }))
    };
  } catch (err) {
    console.error('[jogos] Falha ao ler a classificação:', err);
    return { ok: false };
  }
}

// ---------- Registro de partidas ----------

export type Jogada = {
  jogo: string;
  modo: string;
  dia?: string | null;
  venceu?: boolean | null;
  pontos?: number | null;
  resumo: string;
  detalhes?: Record<string, unknown>;
};

export async function registrarJogadaAction(accessToken: string | null, visitante: string, j: Jogada): Promise<{ ok: boolean }> {
  try {
    if (!ehJogo(j?.jogo) || !/^[a-z0-9-]{8,40}$/.test(visitante)) return { ok: false };
    // "jogador" é preenchido só aqui no servidor, nunca pelo navegador
    const { jogador: _ignorado, ...detalhes } = (j.detalhes && typeof j.detalhes === 'object' ? j.detalhes : {}) as Record<string, unknown>;
    if (JSON.stringify(detalhes).length > 3000) return { ok: false };
    if ((await countRecentPlaysByVisitor(visitante)) > 120) return { ok: false };
    const conta = await verifyAccessTokenProfile(accessToken).catch(() => null);
    const email = conta?.email ?? null;
    if (conta && j.jogo === 'ocarina' && (await pontuacaoPossivel(detalhes, j.pontos).catch(() => false))) {
      detalhes.jogador = { nome: nomePublico(conta.name) };
    }
    await insertGamePlay({
      game: j.jogo,
      mode: texto(j.modo, 30) || '-',
      dailyDay: typeof j.dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(j.dia) ? j.dia : null,
      won: typeof j.venceu === 'boolean' ? j.venceu : null,
      score: typeof j.pontos === 'number' && Number.isFinite(j.pontos) ? Math.round(j.pontos) : null,
      summary: texto(j.resumo, 200) || '-',
      details: detalhes,
      email: email?.toLowerCase() ?? null,
      visitorId: visitante
    });
    return { ok: true };
  } catch (err) {
    console.error('[jogos] Falha ao registrar partida:', err);
    return { ok: false };
  }
}

// ---------- Feed ----------

export type PostFeed = {
  id: number;
  jogo: string;
  modo: string;
  titulo: string;
  resultado: string;
  comentario: string;
  autor: string;
  foto: string | null;
  curtidas: number;
  criadoEm: string;
  meu: boolean;
  imagem: ImagemPost;
};

// Capas do catálogo por nome (pra imagem dos posts do "Próximo jogo").
async function capasDoCatalogo(rows: GamePostRow[]): Promise<Map<string, string>> {
  if (!rows.some((r) => r.game === 'proximo-jogo')) return new Map();
  const data = await loadCatalogData().catch(() => null);
  return new Map((data?.items ?? []).filter((it) => it.imageUrl).map((it) => [normalizar(it.name), it.imageUrl as string]));
}

function paraFeed(r: GamePostRow, email: string | null, capas: Map<string, string>): PostFeed {
  return {
    imagem: imagemDoPost(r, capas),
    id: Number(r.id),
    jogo: r.game,
    modo: r.mode,
    titulo: r.title,
    resultado: r.result_text,
    comentario: r.comment,
    autor: r.author_name,
    foto: r.author_avatar,
    curtidas: r.likes,
    criadoEm: new Date(r.created_at).toISOString(),
    meu: email !== null && r.customer_email === email
  };
}

export type ListaFeed = { ok: true; posts: PostFeed[]; curtidos: number[]; temMais: boolean } | { ok: false; erro: string };

const POR_PAGINA = 20;

export async function listarFeedAction(accessToken: string | null, antesDe: number | null, jogo: string | null): Promise<ListaFeed> {
  try {
    const email = (await verifyAccessToken(accessToken).catch(() => null))?.toLowerCase() ?? null;
    const rows = await getVisiblePosts({ beforeId: antesDe, game: ehJogo(jogo) ? jogo : null, limit: POR_PAGINA + 1 });
    const pagina = rows.slice(0, POR_PAGINA);
    const curtidos = email ? await getLikedPostIds(email, pagina.map((r) => Number(r.id))) : [];
    const capas = await capasDoCatalogo(pagina);
    return { ok: true, posts: pagina.map((r) => paraFeed(r, email, capas)), curtidos, temMais: rows.length > POR_PAGINA };
  } catch (err) {
    console.error('[feed] Falha ao listar:', err);
    // 42P01 = tabela não existe (falta rodar db/migration-jogos-interativos.sql)
    const semTabela = (err as { code?: string })?.code === '42P01';
    return { ok: false, erro: semTabela ? 'O feed abre em breve! Volte daqui a pouco.' : 'O feed não carregou agora. Tente de novo em instantes.' };
  }
}

// Links, @ e e-mails ficam fora do comentário (evita propaganda e golpe).
function limparComentario(c: string): string {
  return c
    .replace(/https?:\/\/\S+|www\.\S+|\S+\.(com|net|org|br|io|gg|me|ly)(\/\S*)?/gi, '')
    .replace(/\S+@\S+\.\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

export type ResultadoPublicar = { ok: true; post: PostFeed } | { ok: false; erro: string; login?: boolean };

export async function publicarResultadoAction(
  accessToken: string | null,
  p: { jogo: string; modo: string; titulo: string; resultado: string; comentario: string; nome: string }
): Promise<ResultadoPublicar> {
  const conta = await verifyAccessTokenProfile(accessToken).catch(() => null);
  if (!conta) return { ok: false, erro: 'Entre na sua conta pra publicar.', login: true };
  if (!ehJogo(p?.jogo)) return { ok: false, erro: 'Resultado inválido.' };
  const titulo = texto(p.titulo, 80);
  const resultado = texto(p.resultado, 300);
  const nome = texto(p.nome, 30) || conta.name?.slice(0, 30) || 'Jogador XAN';
  if (!titulo || !resultado) return { ok: false, erro: 'Resultado inválido.' };
  try {
    if ((await countPostsTodayByEmail(conta.email)) >= 15) {
      return { ok: false, erro: 'Você já publicou bastante hoje. Volte amanhã!' };
    }
    const row = await insertGamePost({
      game: p.jogo,
      mode: texto(p.modo, 30),
      title: titulo,
      resultText: resultado,
      comment: limparComentario(texto(p.comentario, 300)),
      authorName: nome,
      authorAvatar: conta.avatar,
      email: conta.email
    });
    return { ok: true, post: paraFeed(row, conta.email, await capasDoCatalogo([row])) };
  } catch (err) {
    console.error('[feed] Falha ao publicar:', err);
    return { ok: false, erro: 'Não deu pra publicar agora. Tente de novo em instantes.' };
  }
}

export async function curtirAction(
  accessToken: string | null,
  postId: number
): Promise<{ ok: true; curtido: boolean; curtidas: number } | { ok: false; login?: boolean }> {
  const email = (await verifyAccessToken(accessToken).catch(() => null))?.toLowerCase();
  if (!email) return { ok: false, login: true };
  if (!Number.isInteger(postId) || postId <= 0) return { ok: false };
  try {
    const r = await toggleLike(postId, email);
    return { ok: true, curtido: r.liked, curtidas: r.likes };
  } catch (err) {
    console.error('[feed] Falha ao curtir:', err);
    return { ok: false };
  }
}

// A pessoa apaga o próprio post.
export async function apagarMeuPostAction(accessToken: string | null, postId: number): Promise<{ ok: boolean }> {
  const email = (await verifyAccessToken(accessToken).catch(() => null))?.toLowerCase();
  if (!email || !Number.isInteger(postId)) return { ok: false };
  try {
    const post = await getPostById(postId);
    if (!post || post.customer_email !== email) return { ok: false };
    await deletePost(postId);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
