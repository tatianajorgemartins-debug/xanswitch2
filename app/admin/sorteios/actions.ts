'use server';

// Ações do painel de sorteios (/admin > 🎁 Sorteios e /admin/sorteios/[id]).
// Todas conferem o login do admin.
import { randomInt } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { isAuthenticated } from '@/lib/auth';
import { uploadImageBuffer } from '@/lib/supabaseAdmin';
import {
  apagarPremio,
  apagarSorteio,
  carregarParaSortear,
  criarSorteio,
  desclassificar,
  gerarParticipantesTeste,
  gravarSorteio,
  ligarModoTeste,
  listarParticipacoes,
  listarPremios,
  listarSorteiosFeitos,
  montarEstadoPublico,
  mudarStatus,
  obterSorteio,
  resetarSorteio,
  salvarPremio,
  salvarSorteio,
  type Participacao,
  type Premio,
  type Sorteio,
  type SorteioFeito
} from '@/lib/sorteioDb';
import { proximoStatus, ehStatus, NOME_STATUS } from '@/lib/sorteio/regras';
import { dispararSorteio } from '@/lib/sorteio/sortear';
import type { EstadoPublico } from '@/lib/sorteio/estado';

type Resultado = { ok: true } | { ok: false; erro: string };
const SEM_LOGIN = { ok: false as const, erro: 'Entre no admin de novo.' };
const SEM_TABELA = 'Não deu pra salvar. Se ainda não rodou, rode db/migration-sorteios.sql no Neon.';
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const texto = (v: FormDataEntryValue | null, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// "2026-12-11T21:00" (Brasília) → ISO com fuso; vazio → null.
function horario(v: FormDataEntryValue | null): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? `${s}:00-03:00` : null;
}

async function subirImagem(arquivo: FormDataEntryValue | null, nome: string): Promise<string | null> {
  if (!(arquivo instanceof File) || arquivo.size === 0) return null;
  if (!arquivo.type.startsWith('image/')) throw new Error('Envie uma imagem (jpg, png ou webp).');
  const extensao = arquivo.type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  return uploadImageBuffer(`sorteios/${Date.now()}-${nome}.${extensao}`, Buffer.from(await arquivo.arrayBuffer()), arquivo.type);
}

const atualizar = (id?: number) => {
  revalidatePath('/admin');
  if (id) revalidatePath(`/admin/sorteios/${id}`);
};

// ---------- Sorteio ----------

export async function criarSorteioAction(titulo: string): Promise<{ ok: true; id: number } | { ok: false; erro: string }> {
  if (!(await isAuthenticated())) return SEM_LOGIN;
  const nome = String(titulo ?? '').trim().slice(0, 120) || 'Novo sorteio';
  const slug =
    nome
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50) || 'sorteio';
  try {
    const id = await criarSorteio(nome, `${slug}-${Date.now().toString(36).slice(-4)}`);
    atualizar();
    return { ok: true, id };
  } catch (err) {
    console.error('[sorteios] criar:', err);
    return { ok: false, erro: SEM_TABELA };
  }
}

export async function salvarSorteioAction(id: number, form: FormData): Promise<Resultado> {
  if (!(await isAuthenticated())) return SEM_LOGIN;
  const atual = await obterSorteio(id).catch(() => null);
  if (!atual) return { ok: false, erro: 'Sorteio não encontrado.' };
  const slug = texto(form.get('slug'), 60).toLowerCase();
  if (!SLUG.test(slug)) return { ok: false, erro: 'O link só pode ter letras minúsculas, números e hífens (ex: tga-2026).' };
  const limite = texto(form.get('limitePorIp'), 4);
  const limitePorIp = limite === '' ? null : Number(limite);
  if (limitePorIp !== null && (!Number.isInteger(limitePorIp) || limitePorIp < 1 || limitePorIp > 1000)) {
    return { ok: false, erro: 'O limite por IP precisa ser um número de 1 a 1000 (ou vazio pra desligar).' };
  }
  try {
    const novoBanner = await subirImagem(form.get('banner'), 'banner');
    await salvarSorteio(id, {
      slug,
      titulo: texto(form.get('titulo'), 120) || 'Sorteio',
      descricao: texto(form.get('descricao'), 2000),
      regulamento: texto(form.get('regulamento'), 20000),
      data: horario(form.get('data')),
      banner: form.get('removerBanner') === '1' ? null : (novoBanner ?? atual.banner),
      mensagemGanhador: texto(form.get('mensagemGanhador'), 2000),
      limitePorIp,
      bloquearDispositivo: form.get('bloquearDispositivo') === '1',
      contasCriadasAntes: horario(form.get('contasCriadasAntes'))
    });
    atualizar(id);
    return { ok: true };
  } catch (err) {
    if ((err as { code?: string })?.code === '23505') return { ok: false, erro: 'Já existe outro sorteio com esse link.' };
    console.error('[sorteios] salvar:', err);
    return { ok: false, erro: err instanceof Error && err.message.startsWith('Envie') ? err.message : 'Não deu pra salvar agora.' };
  }
}

export async function apagarSorteioAction(id: number): Promise<Resultado> {
  if (!(await isAuthenticated())) return SEM_LOGIN;
  const s = await obterSorteio(id).catch(() => null);
  if (!s) return { ok: false, erro: 'Sorteio não encontrado.' };
  if (s.status !== 'rascunho' && !s.teste) return { ok: false, erro: 'Só dá pra apagar sorteio em rascunho ou em modo de teste.' };
  await apagarSorteio(id);
  atualizar();
  return { ok: true };
}

export async function avancarStatusAction(id: number, de: string): Promise<Resultado> {
  if (!(await isAuthenticated())) return SEM_LOGIN;
  if (!ehStatus(de)) return { ok: false, erro: 'Situação inválida.' };
  const para = proximoStatus(de);
  if (!para) return { ok: false, erro: 'O sorteio já está finalizado.' };
  if (para === 'abertas' && !(await listarPremios(id)).length) return { ok: false, erro: 'Cadastre pelo menos um prêmio antes de abrir.' };
  const mudou = await mudarStatus(id, de, para);
  atualizar(id);
  return mudou ? { ok: true } : { ok: false, erro: `A situação mudou em outra tela. Atualize (agora: diferente de "${NOME_STATUS[de]}").` };
}

// ---------- Modo de teste ----------

// Ligar: só em rascunho. Desligar: apaga tudo do ensaio e volta pro rascunho.
export async function modoTesteAction(id: number, ligar: boolean): Promise<Resultado> {
  if (!(await isAuthenticated())) return SEM_LOGIN;
  const s = await obterSorteio(id).catch(() => null);
  if (!s) return { ok: false, erro: 'Sorteio não encontrado.' };
  if (ligar) {
    if (s.status !== 'rascunho') return { ok: false, erro: 'O modo de teste só liga com o sorteio em rascunho.' };
    await ligarModoTeste(id, true);
  } else {
    await resetarSorteio(id);
    await ligarModoTeste(id, false);
  }
  atualizar(id);
  return { ok: true };
}

export async function resetarAction(id: number): Promise<Resultado> {
  if (!(await isAuthenticated())) return SEM_LOGIN;
  const s = await obterSorteio(id).catch(() => null);
  if (!s?.teste) return { ok: false, erro: 'O reset só funciona no modo de teste.' };
  await resetarSorteio(id);
  atualizar(id);
  return { ok: true };
}

export async function gerarTesteAction(id: number, quantos: number): Promise<Resultado> {
  if (!(await isAuthenticated())) return SEM_LOGIN;
  const s = await obterSorteio(id).catch(() => null);
  if (!s?.teste) return { ok: false, erro: 'Ligue o modo de teste antes de gerar participantes fictícios.' };
  const n = Math.max(1, Math.min(500, Math.round(Number(quantos) || 0)));
  await gerarParticipantesTeste(id, n);
  atualizar(id);
  return { ok: true };
}

// ---------- Prêmios ----------

export async function salvarPremioAction(id: number, premioId: number | null, form: FormData): Promise<Resultado> {
  if (!(await isAuthenticated())) return SEM_LOGIN;
  const nome = texto(form.get('nome'), 120);
  if (!nome) return { ok: false, erro: 'Dê um nome pro prêmio.' };
  const ganhadores = Number(form.get('ganhadores'));
  if (!Number.isInteger(ganhadores) || ganhadores < 1 || ganhadores > 100) return { ok: false, erro: 'Ganhadores: um número de 1 a 100.' };
  try {
    const atual = premioId === null ? null : (await listarPremios(id)).find((p) => p.id === premioId);
    const imagem = await subirImagem(form.get('imagem'), 'premio');
    await salvarPremio(id, premioId, {
      nome,
      descricao: texto(form.get('descricao'), 1000),
      imagem: form.get('removerImagem') === '1' ? null : (imagem ?? atual?.imagem ?? null),
      ganhadores,
      ordem: Math.round(Number(form.get('ordem')) || 0)
    });
    atualizar(id);
    return { ok: true };
  } catch (err) {
    console.error('[sorteios] prêmio:', err);
    return { ok: false, erro: err instanceof Error && err.message.startsWith('Envie') ? err.message : 'Não deu pra salvar o prêmio.' };
  }
}

export async function apagarPremioAction(id: number, premioId: number): Promise<Resultado> {
  if (!(await isAuthenticated())) return SEM_LOGIN;
  if ((await listarSorteiosFeitos(id)).some((s) => s.premioId === premioId)) {
    return { ok: false, erro: 'Esse prêmio já foi sorteado. Não dá pra apagar.' };
  }
  await apagarPremio(id, premioId);
  atualizar(id);
  return { ok: true };
}

// ---------- Participantes ----------

export async function desclassificarAction(id: number, entradaId: number, sim: boolean, motivo: string): Promise<Resultado> {
  if (!(await isAuthenticated())) return SEM_LOGIN;
  if ((await listarSorteiosFeitos(id)).some((s) => s.entradaId === entradaId && !s.anulado)) {
    return { ok: false, erro: 'Essa pessoa já foi sorteada. Use "Re-sortear" no histórico.' };
  }
  await desclassificar(id, entradaId, sim, String(motivo ?? '').trim().slice(0, 300) || null);
  return { ok: true };
}

// ---------- Sortear ----------

async function sortear(id: number, opcoes: { premioId?: number; refazer?: { sorteioId: number; motivo: string } }) {
  return dispararSorteio(
    {
      ehAdmin: isAuthenticated,
      carregar: () => carregarParaSortear(id),
      gravar: (s) => gravarSorteio(id, s, 'admin'),
      agora: () => Date.now(),
      aleatorio: (n) => randomInt(n)
    },
    opcoes
  );
}

export async function sortearAction(id: number, premioId: number | null): Promise<Resultado> {
  try {
    const r = await sortear(id, premioId === null ? {} : { premioId });
    return r.ok ? { ok: true } : { ok: false, erro: r.erro };
  } catch (err) {
    console.error('[sorteios] sortear:', err);
    return { ok: false, erro: 'Não deu pra sortear agora. Tente de novo.' };
  }
}

export async function refazerSorteioAction(id: number, sorteioId: number, motivo: string): Promise<Resultado> {
  try {
    const r = await sortear(id, { refazer: { sorteioId, motivo: String(motivo ?? '').slice(0, 300) } });
    return r.ok ? { ok: true } : { ok: false, erro: r.erro };
  } catch (err) {
    console.error('[sorteios] re-sortear:', err);
    return { ok: false, erro: 'Não deu pra sortear de novo agora.' };
  }
}

// ---------- Dados das telas ----------

export type DadosControle = { sorteio: Sorteio; premios: Premio[]; participacoes: Participacao[]; sorteios: SorteioFeito[]; agora: number };

export async function dadosControleAction(id: number): Promise<DadosControle | null> {
  if (!(await isAuthenticated())) return null;
  const sorteio = await obterSorteio(id);
  if (!sorteio) return null;
  const [premios, participacoes, sorteios] = await Promise.all([listarPremios(id), listarParticipacoes(id), listarSorteiosFeitos(id)]);
  return { sorteio, premios, participacoes, sorteios, agora: Date.now() };
}

// O telão usa só o estado público (sem e-mail completo, IP etc.).
export async function estadoTelaoAction(id: number): Promise<EstadoPublico | null> {
  if (!(await isAuthenticated())) return null;
  const sorteio = await obterSorteio(id);
  return sorteio ? montarEstadoPublico(sorteio) : null;
}
