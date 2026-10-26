// Este arquivo roda no NAVEGADOR. A chave usada aqui (a "anon key" /
// "publishable key") é pública por design — o Supabase espera que ela
// apareça no código do navegador, diferente da service role key usada em
// lib/supabaseAdmin.ts (essa sim é secreta, nunca aparece aqui).
//
// Com essa chave, o navegador consegue: (1) fazer upload pra um caminho
// específico quando acompanhada do token de uso único gerado pelo servidor
// (ver createSignedUploadTicket em supabaseAdmin.ts); (2) fazer login do
// cliente (e-mail com link mágico — ver lib/wishlist.ts); (3) ler/escrever
// SÓ os próprios dados de um cliente já logado (perfil, lista de desejos),
// nunca de outra pessoa — quem garante esse limite é o "Row Level
// Security" configurado no banco (db/migration-wishlist.sql), não esta
// chave em si.
//
// A biblioteca do Supabase é grande (~1/4 de todo o JavaScript da loja),
// então ela só é baixada quando alguém precisa dela (import() abaixo) — e
// não atrasa a primeira abertura do site.
import type { SupabaseClient } from '@supabase/supabase-js';
import { IMAGES_BUCKET } from './supabaseImagesConfig';

let client: Promise<SupabaseClient> | null = null;
export function getSupabaseBrowser(): Promise<SupabaseClient> {
  if (!client) {
    client = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    );
    // Se falhar (rede caiu), tenta de novo na próxima vez.
    client.catch(() => {
      client = null;
    });
  }
  return client;
}

// Envia o arquivo (já comprimido, ver lib/imageCompression.ts) direto do
// navegador pro Supabase Storage, usando o token de uso único que o
// servidor gerou. Depois disso o arquivo já está público — é só usar a
// publicUrl que a rota /api/screenshot-upload devolveu junto com o token.
export async function uploadToSignedTicket(path: string, token: string, file: File): Promise<void> {
  const { error } = await (await getSupabaseBrowser())
    .storage.from(IMAGES_BUCKET)
    .uploadToSignedUrl(path, token, file);

  if (error) {
    throw new Error(`Falha ao enviar imagem: ${error.message}`);
  }
}
