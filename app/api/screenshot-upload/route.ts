import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { createSignedUploadTicket, getPublicUrl } from '@/lib/supabaseAdmin';

// O navegador chama esta rota ANTES de enviar a imagem em si — ela só
// autoriza o upload (confere login e devolve um "ticket" de upload de uso
// único do Supabase). O arquivo em si nunca passa por aqui, vai direto do
// navegador pro Supabase Storage — é assim que se evita o limite de
// tamanho de requisição de uma Server Action normal.
export async function POST(request: Request): Promise<NextResponse> {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const body = await request.json();
  const rawName = String(body?.filename || 'imagem');
  // Só letras, números, ponto, hífen e underscore no nome do arquivo —
  // evita problemas com espaços, acentos ou caracteres especiais na URL.
  const safeName = rawName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const path = `screenshots/${Date.now()}-${safeName}`;

  try {
    const ticket = await createSignedUploadTicket(path);
    return NextResponse.json({ ...ticket, publicUrl: getPublicUrl(path) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha no upload.' },
      { status: 400 }
    );
  }
}
