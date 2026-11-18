'use server';

// Ações do admin do Zelda Tour (aba "Zelda Tour" e o editor em
// /admin/ocarina/[id]). Tudo confere o login do admin.
import { revalidatePath } from 'next/cache';
import { isAuthenticated } from '@/lib/auth';
import {
  createOcarinaSong,
  deleteOcarinaSong,
  getOcarinaSong,
  setOcarinaSongAudio,
  setJogoOcarinaPublicado,
  setOcarinaSongPublished,
  updateOcarinaSong,
  type OcarinaNota
} from '@/lib/ocarinaDb';
import { createOcarinaAudioUploadTicket, deleteOcarinaAudioByUrl } from '@/lib/supabaseAdmin';
import { addDias, diaEm } from '@/lib/jogos/dia';

const PISTAS = ['verde', 'amarelo', 'vermelho', 'roxo', 'azul'];
const DIFICULDADES = ['facil', 'medio', 'dificil', 'insano'];
type Resultado = { ok: true } | { ok: false; erro: string };

function atualizarPaginas(id?: number) {
  revalidatePath('/testes/ocarina-hero');
  revalidatePath('/admin');
  if (id) revalidatePath(`/admin/ocarina/${id}`);
}

export async function criarMusicaAction(): Promise<{ ok: true; id: number } | { ok: false; erro: string }> {
  if (!(await isAuthenticated())) return { ok: false, erro: 'Entre no admin de novo.' };
  try {
    const id = await createOcarinaSong('Nova música');
    atualizarPaginas();
    return { ok: true, id };
  } catch (err) {
    console.error('[ocarina] criar:', err);
    return { ok: false, erro: 'Não deu pra criar. Já rodou o db/migration-ocarina-musicas.sql no Neon?' };
  }
}

export type DadosMusica = {
  titulo: string;
  jogo: string;
  bpm: number;
  inicioBatida: number;
  // onde a música termina no jogo (segundos); null = até o fim do áudio
  fimEm: number | null;
  // notas de cada dificuldade e as que aparecem pros jogadores
  charts: Record<string, OcarinaNota[]>;
  liberadas: string[];
};

function limparNotas(lista: OcarinaNota[]): OcarinaNota[] {
  const notas: OcarinaNota[] = [];
  for (const n of lista) {
    if (!n || !Number.isFinite(n.t) || n.t < 0 || !PISTAS.includes(n.pista)) continue;
    const nota: OcarinaNota = { t: Math.round(n.t * 1000) / 1000, pista: n.pista };
    if (Number.isFinite(n.dur) && (n.dur ?? 0) > 0.05) nota.dur = Math.round((n.dur as number) * 1000) / 1000;
    if (n.estrela === true) nota.estrela = true;
    notas.push(nota);
  }
  return notas.sort((a, b) => a.t - b.t || PISTAS.indexOf(a.pista) - PISTAS.indexOf(b.pista));
}

export async function salvarMusicaAction(id: number, d: DadosMusica): Promise<Resultado> {
  if (!(await isAuthenticated())) return { ok: false, erro: 'Entre no admin de novo.' };
  const charts: Record<string, OcarinaNota[]> = {};
  for (const dif of DIFICULDADES) {
    const lista = d?.charts?.[dif] ?? [];
    if (!Array.isArray(lista) || lista.length > 8000) return { ok: false, erro: 'Notas demais (máximo 8000 por dificuldade).' };
    charts[dif] = limparNotas(lista);
  }
  const liberadas = DIFICULDADES.filter((dif) => d?.liberadas?.includes(dif) && charts[dif].length > 0);
  // A principal (a mais difícil liberada) fica nas colunas de sempre.
  const dosMaisDificeis = [...DIFICULDADES].reverse();
  const principal = dosMaisDificeis.find((dif) => liberadas.includes(dif)) ?? dosMaisDificeis.find((dif) => charts[dif].length > 0) ?? 'medio';
  const bpm = Number(d.bpm);
  try {
    const fim = Number(d.fimEm);
    await updateOcarinaSong(id, {
      title: String(d.titulo ?? '').trim().slice(0, 80) || 'Sem título',
      game: String(d.jogo ?? '').trim().slice(0, 60),
      difficulty: principal,
      bpm: Number.isFinite(bpm) && bpm >= 30 && bpm <= 400 ? Math.round(bpm * 100) / 100 : 120,
      beatOffset: Number.isFinite(d.inicioBatida) ? Math.max(0, Math.round(d.inicioBatida * 1000) / 1000) : 0,
      notes: charts[principal],
      charts: { notas: charts, liberadas },
      endAt: d.fimEm !== null && Number.isFinite(fim) && fim > 0 ? Math.round(fim * 1000) / 1000 : null
    });
    atualizarPaginas(id);
    return { ok: true };
  } catch (err) {
    console.error('[ocarina] salvar:', err);
    return { ok: false, erro: 'Não deu pra salvar agora. Tente de novo.' };
  }
}

// Passo 1 do envio do áudio: autorização pro navegador subir direto pro Storage.
export async function autorizarAudioAction(
  id: number,
  extensao: string
): Promise<{ ok: true; path: string; token: string; publicUrl: string } | { ok: false; erro: string }> {
  if (!(await isAuthenticated())) return { ok: false, erro: 'Entre no admin de novo.' };
  const ext = ['aac', 'mp3', 'm4a'].includes(extensao) ? extensao : 'mp3';
  try {
    const t = await createOcarinaAudioUploadTicket(`musicas/${id}-${Date.now()}.${ext}`);
    return { ok: true, path: t.path, token: t.token, publicUrl: t.publicUrl };
  } catch (err) {
    console.error('[ocarina] autorizar áudio:', err);
    return { ok: false, erro: err instanceof Error ? err.message : 'Falha ao autorizar o envio.' };
  }
}

// Passo 2: o arquivo já subiu — grava na música e apaga o áudio antigo.
export async function confirmarAudioAction(id: number, url: string, duracao: number, bytes: number): Promise<Resultado> {
  if (!(await isAuthenticated())) return { ok: false, erro: 'Entre no admin de novo.' };
  if (!url.includes('/ocarina-audio/') || !Number.isFinite(duracao) || duracao <= 0) return { ok: false, erro: 'Áudio inválido.' };
  try {
    const antiga = await getOcarinaSong(id);
    await setOcarinaSongAudio(id, url, Math.round(duracao * 1000) / 1000, Math.round(bytes));
    if (antiga?.audio_url && antiga.audio_url !== url) await deleteOcarinaAudioByUrl(antiga.audio_url).catch(() => {});
    atualizarPaginas(id);
    return { ok: true };
  } catch (err) {
    console.error('[ocarina] confirmar áudio:', err);
    return { ok: false, erro: 'O áudio subiu, mas não deu pra gravar na música. Tente de novo.' };
  }
}

export async function publicarMusicaAction(id: number, publicar: boolean): Promise<Resultado> {
  if (!(await isAuthenticated())) return { ok: false, erro: 'Entre no admin de novo.' };
  try {
    if (publicar) {
      const m = await getOcarinaSong(id);
      if (!m?.audio_url) return { ok: false, erro: 'Envie o áudio da música antes de publicar.' };
      if (m.notes.length < 10) return { ok: false, erro: 'Coloque pelo menos 10 notas (e salve) antes de publicar.' };
    }
    await setOcarinaSongPublished(id, publicar, addDias(diaEm(), 1));
    atualizarPaginas(id);
    return { ok: true };
  } catch (err) {
    console.error('[ocarina] publicar:', err);
    return { ok: false, erro: 'Não deu pra mudar agora. Tente de novo.' };
  }
}

// Abre ou tira do ar o jogo inteiro pro público.
export async function publicarJogoAction(publicar: boolean): Promise<Resultado> {
  if (!(await isAuthenticated())) return { ok: false, erro: 'Entre no admin de novo.' };
  try {
    await setJogoOcarinaPublicado(publicar === true);
    atualizarPaginas();
    revalidatePath('/testes');
    revalidatePath('/testes/feed');
    return { ok: true };
  } catch (err) {
    console.error('[ocarina] publicar o jogo:', err);
    return { ok: false, erro: 'Não deu pra mudar agora. Tente de novo.' };
  }
}

export async function apagarMusicaAction(id: number): Promise<Resultado> {
  if (!(await isAuthenticated())) return { ok: false, erro: 'Entre no admin de novo.' };
  try {
    const audio = await deleteOcarinaSong(id);
    if (audio) await deleteOcarinaAudioByUrl(audio).catch(() => {});
    atualizarPaginas();
    return { ok: true };
  } catch (err) {
    console.error('[ocarina] apagar:', err);
    return { ok: false, erro: 'Não deu pra apagar agora.' };
  }
}
