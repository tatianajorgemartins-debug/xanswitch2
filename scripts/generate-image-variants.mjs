// Gera as versões menores (480 e 800 px, ver lib/imageVariants.ts) de todas
// as imagens que já estão no site: capas e banners dos jogos, fotos dos
// produtos físicos e os banners das páginas. Imagens novas já ganham essas
// versões sozinhas no upload do admin — isso aqui é só pras antigas.
// Não mexe nas originais nem no banco; só adiciona arquivos no Storage.
//
// COMO RODAR:  node scripts/generate-image-variants.mjs
// É seguro rodar de novo: versões que já existem são só substituídas.

import { neon } from '@neondatabase/serverless';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import sharp from 'sharp';

function readEnvVar(name) {
  const envFile = readFileSync('.env.local', 'utf-8');
  const match = envFile.match(new RegExp(`^${name}=(.+)$`, 'm'));
  if (!match) throw new Error(`Variável ${name} não encontrada em .env.local`);
  return match[1].trim().replace(/^(["'])(.*)\1$/, '$2');
}

const BUCKET = 'game-images';
const WIDTHS = [480, 800];
const MARKER = `/object/public/${BUCKET}/`;
const FOLDERS = ['games/', 'produtos-fisicos/', 'site/'];

const sql = neon(readEnvVar('DATABASE_URL'));
const supabase = createClient(readEnvVar('NEXT_PUBLIC_SUPABASE_URL'), readEnvVar('SUPABASE_SERVICE_ROLE_KEY'));

const variantPath = (path, width) => path.replace(/\.[a-z0-9]+$/i, '') + `-w${width}.webp`;

function pathFromUrl(url) {
  const idx = url ? url.indexOf(MARKER) : -1;
  if (idx === -1) return null;
  const path = decodeURIComponent(url.slice(idx + MARKER.length));
  return FOLDERS.some((folder) => path.startsWith(folder)) ? path : null;
}

const games = await sql`SELECT image_url, banner_image_url FROM games`;
const products = await sql`SELECT image_url FROM physical_products`;
const settings = await sql`SELECT value FROM site_settings WHERE key IN ('reviews_banner_image_url', 'physical_catalog_banner_image_url')`;

const urls = [
  ...games.flatMap((g) => [g.image_url, g.banner_image_url]),
  ...products.map((p) => p.image_url),
  ...settings.map((s) => s.value)
];
const paths = [...new Set(urls.map(pathFromUrl).filter(Boolean))];
console.log(`${paths.length} imagens pra processar`);

let done = 0;
let failed = 0;
async function processOne(path) {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error || !data) throw new Error(error?.message ?? 'download vazio');
    const original = Buffer.from(await data.arrayBuffer());
    for (const width of WIDTHS) {
      const variant = await sharp(original).resize({ width, withoutEnlargement: true }).webp({ quality: 74 }).toBuffer();
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(variantPath(path, width), variant, { contentType: 'image/webp', upsert: true });
      if (upErr) throw new Error(upErr.message);
    }
    done += 1;
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${path}: ${err.message}`);
  }
}

// Algumas por vez, pra não sobrecarregar o Storage.
const queue = [...paths];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (queue.length) {
      await processOne(queue.shift());
      if ((done + failed) % 20 === 0) console.log(`  ${done + failed}/${paths.length}`);
    }
  })
);
console.log(`Pronto: ${done} ok, ${failed} com erro.`);
