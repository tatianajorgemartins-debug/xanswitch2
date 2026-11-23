'use server';

// Ações do participante: ver em quais itens já está inscrito e se inscrever
// em um ou mais itens. Quem é a pessoa é conferido no próprio Supabase (o
// navegador manda o token). Todas as regras (uma inscrição por conta e por @
// em cada item, IP, aparelho, idade da conta, limite de tentativas) são
// checadas aqui, no servidor.
import { cookies, headers } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { verifyAccessTokenAccount } from '@/lib/supabaseAuthServer';
import {
  contarNoIp,
  dispositivoDeOutraConta,
  inserirParticipacao,
  instagramDeOutraConta,
  listarMinhasParticipacoes,
  listarPremios,
  obterSorteioPorSlug,
  registrarTentativa,
  sorteioVisivel
} from '@/lib/sorteioDb';
import { avaliarParticipacao, ipDaRequisicao, normalizarInstagram } from '@/lib/sorteio/regras';

const COOKIE_DISPOSITIVO = 'xan_dispositivo';
const ID_VALIDO = /^[a-f0-9-]{20,60}$/i;

// Em quais itens a pessoa está (e o código de cada inscrição, pra saber se ganhou).
export type MinhaParticipacao = { logado: boolean; itens: { premioId: number; codigo: string }[] };

export async function minhaParticipacaoAction(token: string | null, slug: string): Promise<MinhaParticipacao> {
  const conta = await verifyAccessTokenAccount(token).catch(() => null);
  if (!conta) return { logado: false, itens: [] };
  try {
    const s = await obterSorteioPorSlug(slug);
    if (!s) return { logado: true, itens: [] };
    const minhas = await listarMinhasParticipacoes(s.id, conta.id);
    return {
      logado: true,
      itens: minhas.filter((p) => !p.desclassificado && p.premioId !== null).map((p) => ({ premioId: p.premioId as number, codigo: p.codigo }))
    };
  } catch {
    return { logado: true, itens: [] };
  }
}

export type ResultadoConfirmar =
  | { ok: true; dispositivo: string; inscritos: { premioId: number; codigo: string }[]; erros: { premioId: number; erro: string }[] }
  | { ok: false; erro: string; login?: boolean };

export async function confirmarPresencaAction(
  token: string | null,
  slug: string,
  premioIds: number[],
  aceitou: boolean,
  dispositivoLocal: string | null,
  instagramDigitado: string
): Promise<ResultadoConfirmar> {
  const conta = await verifyAccessTokenAccount(token).catch(() => null);
  if (!conta) return { ok: false, erro: 'Entre na sua conta pra participar.', login: true };
  const pedidos = [...new Set((Array.isArray(premioIds) ? premioIds : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 30);
  if (!pedidos.length) return { ok: false, erro: 'Escolha um item pra participar.' };
  try {
    const sorteio = await obterSorteioPorSlug(String(slug));
    if (!sorteio || !sorteioVisivel(sorteio)) return { ok: false, erro: 'Sorteio não encontrado.' };

    const h = await headers();
    const ip = ipDaRequisicao(h);
    const navegador = h.get('user-agent')?.slice(0, 300) ?? null;
    const jarra = await cookies();
    const doCookie = jarra.get(COOKIE_DISPOSITIVO)?.value;
    const dispositivos = [doCookie, dispositivoLocal].filter((d): d is string => typeof d === 'string' && ID_VALIDO.test(d));
    const dispositivo = dispositivos[0] ?? randomUUID();
    const instagram = normalizarInstagram(instagramDigitado);

    // Um pedido (mesmo com vários itens) conta como uma tentativa.
    const [tentativas, premios, minhas] = await Promise.all([
      registrarTentativa(sorteio.id, ip, conta.id),
      listarPremios(sorteio.id),
      listarMinhasParticipacoes(sorteio.id, conta.id)
    ]);

    const inscritos: { premioId: number; codigo: string }[] = [];
    const erros: { premioId: number; erro: string }[] = [];
    for (const premioId of pedidos) {
      const item = premios.find((p) => p.id === premioId);
      if (!item) {
        erros.push({ premioId, erro: 'Esse item não existe.' });
        continue;
      }
      const ja = minhas.find((m) => m.premioId === premioId);
      if (ja) {
        if (!ja.desclassificado) inscritos.push({ premioId, codigo: ja.codigo });
        else erros.push({ premioId, erro: 'Sua inscrição neste item foi cancelada.' });
        continue;
      }
      const [noIp, outraConta, instagramOcupado] = await Promise.all([
        ip ? contarNoIp(premioId, ip, conta.id) : Promise.resolve(0),
        dispositivoDeOutraConta(premioId, dispositivos, conta.id),
        instagram ? instagramDeOutraConta(premioId, instagram, conta.id) : Promise.resolve(false)
      ]);
      const avaliacao = avaliarParticipacao(
        { limitePorIp: sorteio.limitePorIp, bloquearDispositivo: sorteio.bloquearDispositivo, contasCriadasAntes: sorteio.contasCriadasAntes },
        {
          statusSorteio: sorteio.status,
          statusItem: item.status,
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
      if (!avaliacao.ok || !instagram) {
        // Regra que vale pra todos os itens: devolve o erro direto.
        if (!avaliacao.ok && ['muitas-tentativas', 'instagram', 'regulamento', 'conta-nova'].includes(avaliacao.codigo)) {
          return { ok: false, erro: avaliacao.motivo };
        }
        erros.push({ premioId, erro: avaliacao.ok ? 'Coloque o @ do seu Instagram.' : avaliacao.motivo });
        continue;
      }
      const r = await inserirParticipacao({
        raffleId: sorteio.id,
        premioId,
        usuario: conta.id,
        email: conta.email,
        nome: conta.name,
        instagram,
        ip,
        navegador,
        dispositivo
      });
      if (r.ok) inscritos.push({ premioId, codigo: r.codigo });
      else if (r.repetido === 'instagram') erros.push({ premioId, erro: 'Esse @ do Instagram já está neste item com outra conta.' });
    }

    if (inscritos.length) {
      // Marca o aparelho (some só se a pessoa limpar os dados do navegador).
      jarra.set(COOKIE_DISPOSITIVO, dispositivo, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 730
      });
    }
    if (!inscritos.length && erros.length) return { ok: false, erro: erros[0].erro };
    return { ok: true, dispositivo, inscritos, erros };
  } catch (err) {
    console.error('[sorteio] inscrever:', err);
    return { ok: false, erro: 'Não deu pra confirmar agora. Tente de novo em instantes.' };
  }
}
