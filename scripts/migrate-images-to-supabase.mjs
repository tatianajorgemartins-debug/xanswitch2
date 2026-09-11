// Script de migração: baixa cada imagem que hoje está no Vercel Blob,
// COMPRIME (essas imagens antigas nunca passaram pela compressão que o
// site já usa pra imagens novas — ver lib/imageResize.ts) e sobe a versão
// comprimida pro Supabase Storage, atualizando o banco de dados pra
// apontar pra URL nova. Não apaga nada do Vercel Blob — depois de conferir
// que está tudo certo no site, você pode simplesmente excluir a Blob Store
// inteira pelo painel da Vercel (Storage → sua store → Settings → Delete).
//
// COMO RODAR (uma vez só, depois de configurar o Supabase — veja o README):
//   node scripts/migrate-images-to-supabase.mjs
//
// IMPORTANTE: isso só funciona se o Vercel Blob estiver acessível pra
// LEITURA no momento em que você rodar (ou seja, a Blob Store não pode
// estar suspensa por cobrança). Se estiver suspensa, espere ela ser
// reativada (ou pague/aguarde os 30 dias) antes de rodar este script —
// sem isso não tem como baixar as imagens antigas de lá.
//
// É seguro rodar mais de uma vez: qualquer imagem que já esteja com URL do
// Supabase é pulada automaticamente.

import { neon } from '@neondatabase/serverless';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import sharp from 'sharp';

function readEnvVar(name) {
  const envFile = readFileSync('.env.local', 'utf-8');
  const match = envFile.match(new RegExp(`^${name}=(.+)$`, 'm'));
  if (!match) throw new Error(`Variável ${name} não encontrada em .env.local`);
  return match[1].trim();
}

const sql = neon(readEnvVar('DATABASE_URL'));
const supabase = createClient(
  readEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
  readEnvVar('SUPABASE_SERVICE_ROLE_KEY')
);
const BUCKET = 'game-images';
const SUPABASE_URL = readEnvVar('NEXT_PUBLIC_SUPABASE_URL');

function isAlreadyMigrated(url) {
  return url.includes(SUPABASE_URL) || url.includes('supabase.co');
}

// Baixa a imagem do Vercel Blob, comprime (mesmos parâmetros já usados
// pelo site em uploads novos) e sobe pro Supabase, devolvendo a URL nova.
// Se a imagem já foi migrada (URL já é do Supabase), devolve a mesma URL.
async function migrateOneUrl(url, pathPrefix, maxDimension) {
  if (isAlreadyMigrated(url)) {
    return { url, skipped: true };
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Não consegui baixar (status ${response.status}). A Blob Store ainda está suspensa?`);
  }
  const originalBytes = Buffer.from(await response.arrayBuffer());

  const compressed = await sharp(originalBytes)
    .rotate()
    .resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const originalName = decodeURIComponent(url.split('/').pop().split('?')[0]).replace(/\.[^.]+$/, '');
  const path = `${pathPrefix}/${Date.now()}-${originalName}.webp`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, { contentType: 'image/webp' });
  if (error) throw new Error(`Falha ao subir pro Supabase: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, skipped: false };
}

async function main() {
  const games = await sql`SELECT id, name, image_url, screenshots FROM games ORDER BY id`;
  console.log(`Encontrados ${games.length} jogos no banco.\n`);

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const game of games) {
    // Capa do jogo
    if (game.image_url) {
      try {
        const result = await migrateOneUrl(game.image_url, 'games', 900);
        if (result.skipped) {
          skippedCount++;
        } else {
          await sql`UPDATE games SET image_url = ${result.url} WHERE id = ${game.id}`;
          console.log(`✓ Capa migrada: ${game.name}`);
          migratedCount++;
        }
      } catch (err) {
        console.log(`✗ Falha na capa de "${game.name}": ${err.message}`);
        errorCount++;
      }
    }

    // Capturas de tela
    if (game.screenshots?.length) {
      const newScreenshots = [];
      let anyChanged = false;
      for (const shot of game.screenshots) {
        try {
          const result = await migrateOneUrl(shot, 'screenshots', 1600);
          newScreenshots.push(result.url);
          if (result.skipped) {
            skippedCount++;
          } else {
            migratedCount++;
            anyChanged = true;
          }
        } catch (err) {
          console.log(`✗ Falha numa captura de tela de "${game.name}": ${err.message}`);
          errorCount++;
          newScreenshots.push(shot); // mantém a antiga se der erro, pra não perder a referência
        }
      }
      if (anyChanged) {
        await sql`UPDATE games SET screenshots = ${JSON.stringify(newScreenshots)}::jsonb WHERE id = ${game.id}`;
        console.log(`✓ Capturas de tela migradas: ${game.name}`);
      }
    }
  }

  console.log('\n--- Resumo ---');
  console.log('Migradas com sucesso:', migratedCount);
  console.log('Já estavam no Supabase (puladas):', skippedCount);
  console.log('Falhas:', errorCount);
  if (errorCount > 0) {
    console.log('\nAlgumas imagens falharam — rode o script de novo depois (ele pula as que já migraram e tenta de novo só as que falharam).');
  } else {
    console.log('\nTudo migrado! Pode conferir o site e, se estiver tudo certo, excluir a Blob Store antiga pelo painel da Vercel.');
  }
}

main();
