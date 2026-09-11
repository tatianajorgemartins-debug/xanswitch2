// Tudo neste arquivo roda no NAVEGADOR e fala direto com o Supabase (sem
// passar pelo nosso servidor) — é assim que o Supabase Auth funciona: o
// cliente já vem pronto pra cuidar de login, sessão (lembrar que a pessoa
// já entrou, mesmo depois de fechar e abrir o site de novo) e, com o Row
// Level Security configurado no banco (db/migration-wishlist.sql), até
// leitura/escrita direta nas tabelas, com segurança — o Postgres em si já
// impede um cliente de ler ou mexer nos dados de outro.
'use client';

import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowser } from './supabaseBrowser';

// Cria a conta com e-mail e senha, direto no site — sem link nenhum pra
// clicar. (Antes era um "link mágico" por e-mail, mas isso dava problema
// quando o cliente abria o link em um navegador ou aparelho diferente de
// onde pediu o login — o Supabase amarra esse link ao navegador de
// origem. E-mail + senha não tem esse problema.)
//
// Se o seu projeto Supabase estiver com a opção "Confirm email" ligada
// (Authentication → Providers → Email), essa função ainda cria a conta,
// mas a pessoa só consegue entrar depois de clicar num link de
// confirmação — o que reintroduz o mesmo problema. Por isso o passo a
// passo do README pede pra deixar essa opção DESLIGADA: assim, ao criar a
// conta, a pessoa já entra na hora, sem etapa nenhuma de e-mail.
export async function signUp(email: string, password: string): Promise<{ confirmedImmediately: boolean }> {
  const { data, error } = await getSupabaseBrowser().auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  // Se "Confirm email" estiver desligado no Supabase, já vem uma sessão
  // pronta aqui. Se estiver ligado, data.session vem vazio (a pessoa
  // precisa confirmar o e-mail antes de conseguir entrar).
  return { confirmedImmediately: !!data.session };
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await getSupabaseBrowser().auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  await getSupabaseBrowser().auth.signOut();
}

// Devolve quem está logado agora (ou null, se ninguém). Útil pra checar o
// estado uma vez, por exemplo quando o site carrega.
export async function getCurrentUser(): Promise<User | null> {
  const { data } = await getSupabaseBrowser().auth.getUser();
  return data.user;
}

// Chama `callback` toda vez que o login muda (a pessoa entra, sai, ou o
// link mágico é confirmado depois de clicado no e-mail). Devolve uma
// função pra "desligar" essa escuta quando o componente for desmontado.
//
// Envolvido em try/catch de propósito: essa função roda pra QUALQUER
// visitante do catálogo assim que a página carrega (não só quem tenta
// logar). Se o Supabase de login estiver mal configurado (por exemplo,
// faltando as variáveis de ambiente), é melhor o site continuar
// funcionando normalmente sem o login do que travar a loja inteira.
export function onAuthChange(callback: (user: User | null) => void): () => void {
  try {
    const {
      data: { subscription }
    } = getSupabaseBrowser().auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  } catch {
    return () => {};
  }
}

// --- Lista de desejos ---

// Devolve os ids dos jogos que a pessoa logada já favoritou. Graças ao Row
// Level Security, essa consulta só pode devolver os favoritos de quem está
// logado no momento — não tem como ler a lista de outra pessoa por aqui.
export async function getWishlistGameIds(): Promise<number[]> {
  const { data, error } = await getSupabaseBrowser().from('wishlists').select('game_id');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.game_id as number);
}

export async function addToWishlist(gameId: number): Promise<void> {
  // user_id não precisa ser informado aqui — a tabela já preenche sozinha
  // com quem está logado (ver "DEFAULT auth.uid()" na migração).
  const { error } = await getSupabaseBrowser().from('wishlists').insert({ game_id: gameId });
  if (error) throw new Error(error.message);
}

export async function removeFromWishlist(gameId: number): Promise<void> {
  const { error } = await getSupabaseBrowser().from('wishlists').delete().eq('game_id', gameId);
  if (error) throw new Error(error.message);
}

// --- Perfil (só o Instagram, por enquanto) ---

export async function getInstagramHandle(): Promise<string | null> {
  const { data, error } = await getSupabaseBrowser().from('profiles').select('instagram').maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.instagram as string | null) ?? null;
}

export async function saveInstagramHandle(instagram: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Você precisa estar logado pra salvar o Instagram.');

  const { error } = await getSupabaseBrowser()
    .from('profiles')
    // upsert = "insere se não existir, atualiza se já existir" — assim
    // funciona tanto na primeira vez quanto pra editar depois.
    .upsert({ id: user.id, instagram, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}
