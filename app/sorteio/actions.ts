'use server';

// Ações do participante: ver se já participa e confirmar presença. Quem é a
// pessoa é conferido no próprio Supabase (o navegador manda o token). Todas
// as regras (uma por conta, IP, aparelho, idade da conta, limite de
// tentativas) são checadas aqui, no servidor.
import { cookies, headers } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { verifyAccessTokenAccount } from '@/lib/supabaseAuthServer';
import {
  contarNoIp,
  dispositivoDeOutraConta,
  inserirParticipacao,
  instagramDeOutraConta,
  obterParticipacao,
  obterSorteioPorSlug,
  registrarTentativa,
  sorteioVisivel
} from '@/lib/sorteioDb';
import { avaliarParticipacao, ipDaRequisicao, normalizarInstagram } from '@/lib/sorteio/regras';

const COOKIE_DISPOSITIVO = 'xan_dispositivo';
const ID_VALIDO = /^[a-f0-9-]{20,60}$/i;

export type MinhaParticipacao = { logado: boolean; participando: boolean; codigo: string | null };

export async function minhaParticipacaoAction(token: string | null, slug: string): Promise<MinhaParticipacao> {
  const conta = await verifyAccessTokenAccount(token).catch(() => null);
  if (!conta) return { logado: false, participando: false, codigo: null };
  try {
    const s = await obterSorteioPorSlug(slug);
    if (!s) return { logado: true, participando: false, codigo: null };
    const p = await obterParticipacao(s.id, conta.id);
    return { logado: true, participando: p !== null && !p.desclassificado, codigo: p && !p.desclassificado ? p.codigo : null };
  } catch {
    return { logado: true, participando: false, codigo: null };
  }
}

export type ResultadoConfirmar =
  | { ok: true; codigo: string; dispositivo: string }
  | { ok: false; erro: string; login?: boolean; jaParticipa?: boolean };

export async function confirmarPresencaAction(
  token: string | null,
  slug: string,
  aceitou: boolean,
  dispositivoLocal: string | null,
  instagramDigitado: string
): Promise<ResultadoConfirmar> {
  const conta = await verifyAccessTokenAccount(token).catch(() => null);
  if (!conta) return { ok: false, erro: 'Entre na sua conta pra participar.', login: true };
  try {
    const sorteio = await obterSorteioPorSlug(String(slug));
    if (!sorteio || !sorteioVisivel(sorteio)) return { ok: false, erro: 'Sorteio não encontrado.' };

    const h = await headers();
    const ip = ipDaRequisicao(h);
    const navegador = h.get('user-agent')?.slice(0, 300) ?? null;
    const jarra = await cookies();
    const doCookie = jarra.get(COOKIE_DISPOSITIVO)?.value;
    const dispositivos = [doCookie, dispositivoLocal].filter((d): d is string => typeof d === 'string' && ID_VALIDO.test(d));

    const instagram = normalizarInstagram(instagramDigitado);
    const tentativas = await registrarTentativa(sorteio.id, ip, conta.id);
    const [ja, noIp, outraConta, instagramOcupado] = await Promise.all([
      obterParticipacao(sorteio.id, conta.id),
      ip ? contarNoIp(sorteio.id, ip, conta.id) : Promise.resolve(0),
      dispositivoDeOutraConta(sorteio.id, dispositivos, conta.id),
      instagram ? instagramDeOutraConta(sorteio.id, instagram, conta.id) : Promise.resolve(false)
    ]);
    if (ja) return { ok: false, erro: 'Você já está participando deste sorteio.', jaParticipa: true };

    const avaliacao = avaliarParticipacao(
      { limitePorIp: sorteio.limitePorIp, bloquearDispositivo: sorteio.bloquearDispositivo, contasCriadasAntes: sorteio.contasCriadasAntes },
      {
        status: sorteio.status,
        aceitouRegulamento: aceitou === true,
        instagram,
        instagramDeOutraConta: instagramOcupado,
        jaParticipa: false,
        contaCriadaEm: conta.createdAt,
        participacoesNoIp: noIp,
        dispositivoDeOutraConta: outraConta,
        tentativasIp: tentativas.ip,
        tentativasConta: tentativas.conta
      }
    );
    if (!avaliacao.ok) return { ok: false, erro: avaliacao.motivo };
    if (!instagram) return { ok: false, erro: 'Coloque o @ do seu Instagram pra participar.' };

    const dispositivo = dispositivos[0] ?? randomUUID();
    const r = await inserirParticipacao({
      raffleId: sorteio.id,
      usuario: conta.id,
      email: conta.email,
      nome: conta.name,
      instagram,
      ip,
      navegador,
      dispositivo
    });
    if (!r.ok) {
      return r.repetido === 'conta'
        ? { ok: false, erro: 'Você já está participando deste sorteio.', jaParticipa: true }
        : { ok: false, erro: 'Esse @ do Instagram já está participando com outra conta.' };
    }

    // Marca o aparelho (some só se a pessoa limpar os dados do navegador).
    jarra.set(COOKIE_DISPOSITIVO, dispositivo, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 730
    });
    return { ok: true, codigo: r.codigo, dispositivo };
  } catch (err) {
    console.error('[sorteio] confirmar presença:', err);
    return { ok: false, erro: 'Não deu pra confirmar agora. Tente de novo em instantes.' };
  }
}
