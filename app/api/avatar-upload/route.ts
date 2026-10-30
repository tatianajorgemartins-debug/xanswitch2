import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSignedUploadTicket, getPublicUrl } from '@/lib/supabaseAdmin';

// Igual ao /api/screenshot-upload, mas pra foto de perfil do CLIENTE (não
// do admin): confere o token da sessão do cliente com o próprio Supabase e
// só então devolve um ticket de upload de uso único. A foto vai direto do
// navegador pro Supabase Storage, numa pasta avatars/ com o id da pessoa
// no nome — ninguém consegue mandar foto em nome de outro cliente.
export async function POST(request: Request): Promise<NextResponse> {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!accessToken) {
    return NextResponse.json({ error: 'Entre na sua conta primeiro.' }, { status: 401 });
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    return NextResponse.json({ error: 'Entre na sua conta primeiro.' }, { status: 401 });
  }

  const path = `avatars/${data.user.id}-${Date.now()}.webp`;
  try {
    const ticket = await createSignedUploadTicket(path);
    return NextResponse.json({ ...ticket, publicUrl: getPublicUrl(path) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Falha no upload.' },
      { status: 400 }
    );
  }
}
