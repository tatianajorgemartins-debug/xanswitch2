// Este arquivo roda no NAVEGADOR. A chave usada aqui (a "anon key") é
// pública por design — o Supabase espera que ela apareça no código do
// navegador, diferente da service role key usada em lib/supabaseAdmin.ts.
// Sozinha, essa chave não dá acesso a nada: ela só consegue fazer upload
// pra um caminho específico quando acompanhada do token de uso único
// gerado pelo servidor (veja createSignedUploadTicket em supabaseAdmin.ts).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { IMAGES_BUCKET } from './supabaseImagesConfig';

let client: SupabaseClient | null = null;
function getBrowserClient(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}

// Envia o arquivo (já comprimido, ver lib/imageCompression.ts) direto do
// navegador pro Supabase Storage, usando o token de uso único que o
// servidor gerou. Depois disso o arquivo já está público — é só usar a
// publicUrl que a rota /api/screenshot-upload devolveu junto com o token.
export async function uploadToSignedTicket(path: string, token: string, file: File): Promise<void> {
  const { error } = await getBrowserClient()
    .storage.from(IMAGES_BUCKET)
    .uploadToSignedUrl(path, token, file);

  if (error) {
    throw new Error(`Falha ao enviar imagem: ${error.message}`);
  }
}
