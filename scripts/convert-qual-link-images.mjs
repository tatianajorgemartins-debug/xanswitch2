// Converte as imagens do quiz "Qual Link é você?" (pasta QUIZ ZELDA, fora
// do projeto) pra WebP de no máximo 600px, com nome sem espaço/acento, em
// public/quiz-zelda/. Rodar de novo se trocar alguma imagem:
//   node scripts/convert-qual-link-images.mjs "../QUIZ ZELDA"
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import path from 'path';

const SOURCE = process.argv[2] ?? '../QUIZ ZELDA';
const OUT = 'public/quiz-zelda';

const FILES = {
  nes: 'LINK O HERÓI.png',
  alttp: 'LINK DE A LINK TO THE PAST.png',
  la: "LINK FOFO DE LINK'S AWAKENING.png",
  oot: 'LINK CRIANÇA OCARINA.avif',
  mm: "LINK DE MAJORA'S MASK.png",
  ww: 'TOON LINK.png',
  fs: 'LINK FOUR SWORDS.png',
  mc: 'LINK MINISH CAP.png',
  tp: 'LINK TWILIGHT PRINCESS.png',
  ss: 'LINK SKYWARD SWORD.png',
  albw: 'LINK LINK BETWEEN WORLDS.png',
  botw: 'LINK BREATH OF THE WILDS.png',
  totk: 'LINK TEARS OF THE KINGDOM.png'
};

mkdirSync(OUT, { recursive: true });
for (const [id, file] of Object.entries(FILES)) {
  const out = path.join(OUT, `link-${id}.webp`);
  const info = await sharp(path.join(SOURCE, file))
    .trim()
    .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, alphaQuality: 90 })
    .toFile(out);
  console.log(`${out}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)} KB`);
}

// Arte quadrada do card colecionável do quiz (card-<id>.webp): o Link
// inteiro sobre um fundo verde de Hyrule com brilho dourado — o card corta
// a imagem em quadrado, então o Link não pode ir solto (cortaria os altos).
const SIZE = 600;
const background = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
  <defs>
    <radialGradient id="g" cx="50%" cy="42%" r="70%">
      <stop offset="0%" stop-color="#2a5a3a"/>
      <stop offset="55%" stop-color="#0f2618"/>
      <stop offset="100%" stop-color="#07110C"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="78%" r="45%">
      <stop offset="0%" stop-color="#F2CD73" stop-opacity=".35"/>
      <stop offset="100%" stop-color="#F2CD73" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  <rect x="14" y="14" width="${SIZE - 28}" height="${SIZE - 28}" fill="none" stroke="rgba(214,177,94,.45)" stroke-width="2"/>
  <rect x="24" y="24" width="${SIZE - 48}" height="${SIZE - 48}" fill="none" stroke="rgba(214,177,94,.22)" stroke-width="1"/>
</svg>`);
for (const id of Object.keys(FILES)) {
  const link = await sharp(path.join(OUT, `link-${id}.webp`))
    .resize(Math.round(SIZE * 0.8), Math.round(SIZE * 0.8), { fit: 'inside' })
    .toBuffer();
  const meta = await sharp(link).metadata();
  const out = path.join(OUT, `card-${id}.webp`);
  await sharp(background)
    .composite([{ input: link, left: Math.round((SIZE - meta.width) / 2), top: SIZE - meta.height - 34 }])
    .webp({ quality: 84 })
    .toFile(out);
  console.log(out);
}
