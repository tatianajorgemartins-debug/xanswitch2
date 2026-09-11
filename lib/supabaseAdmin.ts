// Tudo neste arquivo roda só no SERVIDOR (Server Actions, rotas de API).
// Ele usa a "service role key" do Supabase, uma chave secreta que tem
// acesso total ao projeto — por isso NUNCA pode ser importada por um
// componente com 'use client' nem aparecer em código que vai pro
// navegador. Pra upload direto do navegador (capturas de tela), veja
// lib/supabaseBrowser.ts, que usa uma chave bem mais limitada.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { IMAGES_BUCKET } from './supabaseImagesConfig';

// Criado só na primeira chamada (mesmo padrão do getSql() em lib/db.ts),
// pra não quebrar em algum ambiente que importe este arquivo sem nunca usar
// nenhuma função dele.
let client: SupabaseClient | null = null;
function getAdminClient(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return client;
}

// Monta a URL pública de um arquivo a partir do caminho dele dentro do
// bucket (ex: "games/1234-capa.webp" -> "https://SEU-PROJETO.supabase.co/
// storage/v1/object/public/game-images/games/1234-capa.webp"). Funciona
// porque o bucket é público — qualquer pessoa com o link consegue ver a
// imagem, sem precisar de senha (é assim que também funcionava no Vercel Blob).
export function getPublicUrl(path: string): string {
  const { data } = getAdminClient().storage.from(IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Envia um arquivo direto do servidor pro Supabase Storage — usado hoje só
// pela capa do jogo, que chega pro servidor via Server Action (o navegador
// manda o arquivo, o servidor recebe, comprime com sharp e só depois sobe
// pro Storage). Retorna a URL pública já pronta pra salvar no banco.
export async function uploadImageBuffer(
  path: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const { error } = await getAdminClient()
    .storage.from(IMAGES_BUCKET)
    .upload(path, body, { contentType, upsert: false });

  if (error) {
    throw new Error(`Falha ao enviar imagem pro Supabase: ${error.message}`);
  }
  return getPublicUrl(path);
}

// Apaga uma imagem a partir da URL pública dela (é assim que a imagem fica
// salva no banco — como URL completa, não como caminho). Se a URL não for
// deste bucket (por exemplo, uma imagem antiga que ainda está no Vercel
// Blob e não foi migrada), simplesmente não faz nada — sem erro.
export async function deleteImageByUrl(url: string): Promise<void> {
  const path = extractPathFromPublicUrl(url);
  if (!path) return;
  await getAdminClient().storage.from(IMAGES_BUCKET).remove([path]);
}

function extractPathFromPublicUrl(url: string): string | null {
  const marker = `/object/public/${IMAGES_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

// Gera uma "autorização de upload" temporária (válida por 2 horas, segundo
// a documentação do Supabase) pra um caminho específico. É isso que
// permite o NAVEGADOR enviar uma captura de tela direto pro Supabase, sem
// passar pelo nosso servidor (o arquivo pode ser grande demais pra passar
// por uma Server Action) e sem expor a chave secreta pro navegador — só
// esse token de uso único.
export async function createSignedUploadTicket(
  path: string
): Promise<{ signedUrl: string; token: string; path: string }> {
  const { data, error } = await getAdminClient()
    .storage.from(IMAGES_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(`Falha ao gerar autorização de upload: ${error?.message ?? 'erro desconhecido'}`);
  }
  return data;
}

// Devolve quantas vezes cada jogo foi favoritado, dos mais pra menos
// desejados. Usa a service role key de propósito, porque o Row Level
// Security da tabela "wishlists" (db/migration-wishlist.sql) só deixa cada
// cliente ver a PRÓPRIA lista — pra ver o total de todo mundo (o que
// interessa aqui, pra saber quais jogos são mais procurados), precisa da
// chave que ignora essa trava, e só o painel admin deveria ter acesso a
// isso.
export async function getWishlistCounts(): Promise<Map<number, number>> {
  const { data, error } = await getAdminClient().from('wishlists').select('game_id');
  if (error) {
    throw new Error(`Falha ao buscar a lista de desejos: ${error.message}`);
  }
  const counts = new Map<number, number>();
  for (const row of data ?? []) {
    const gameId = row.game_id as number;
    counts.set(gameId, (counts.get(gameId) ?? 0) + 1);
  }
  return counts;
}

// Insere uma linha na tabela "keepalive" (veja db/migration-supabase-keepalive.sql).
// Usado pelo Cron Job diário em app/api/cron/keepalive/route.ts — sem isso,
// o projeto gratuito do Supabase pode ser pausado por "inatividade" mesmo
// com o site recebendo visitas, porque só usamos o Storage dele, nunca o
// banco de dados. Um INSERT bem pequeno, uma vez por dia, é o suficiente
// pra contar como atividade e manter o projeto ativo.
export async function pingKeepAlive(): Promise<void> {
  const { error } = await getAdminClient().from('keepalive').insert({});
  if (error) {
    throw new Error(`Falha no ping de keepalive: ${error.message}`);
  }
}
