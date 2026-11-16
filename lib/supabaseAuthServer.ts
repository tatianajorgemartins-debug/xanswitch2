// Roda só no servidor. Confirma, junto do próprio Supabase, quem é o dono
// de um "access token" que o navegador mandou — usado por toda Server
// Action que precisa saber com certeza quem está pedindo algo (os cards da
// própria pessoa, o desconto da própria pessoa etc.), já que este projeto
// não guarda sessão nenhuma do lado do servidor (ver lib/supabaseBrowser.ts).
//
// Não precisa da chave secreta (service role) — validar um token já emitido
// só usa a chave pública (anon), a mesma que o navegador usa.
import { createClient } from '@supabase/supabase-js';

export async function verifyAccessToken(accessToken: string | null): Promise<string | null> {
  if (!accessToken) return null;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user?.email) return null;
  return data.user.email;
}

// Igual ao de cima, mas devolve também o nome e a foto da conta (dos
// metadados do próprio Supabase) — usado no feed dos jogos.
export async function verifyAccessTokenProfile(
  accessToken: string | null
): Promise<{ email: string; name: string | null; avatar: string | null } | null> {
  if (!accessToken) return null;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user?.email) return null;
  const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    email: data.user.email.toLowerCase(),
    name: text(meta.full_name) ?? text(meta.name),
    avatar: text(meta.photo_url) ?? text(meta.avatar_url) ?? text(meta.picture)
  };
}
