// Versões menores das imagens do catálogo (capas, banners, fotos dos
// produtos físicos), guardadas no Supabase ao lado da original:
//   games/123-capa.webp  ->  games/123-capa-w480.webp e games/123-capa-w800.webp
// O navegador escolhe sozinho (srcset) a menor que ainda fica nítida no
// tamanho em que a imagem aparece na tela — um card no celular baixa uns
// 30 KB em vez dos ~150 KB da original. Se uma versão não existir (imagem
// antiga ainda sem versões), o <img> cai de volta pra original (ver
// fallbackToOriginal abaixo). Sem segredos aqui: usado no navegador e no
// servidor (as versões são geradas no upload, em lib/supabaseAdmin.ts).

import { IMAGES_BUCKET } from './supabaseImagesConfig';

export const IMAGE_VARIANT_WIDTHS = [480, 800] as const;

const PUBLIC_MARKER = `/object/public/${IMAGES_BUCKET}/`;
// Só as pastas que passam pelo upload do admin (que gera as versões).
const VARIANT_FOLDERS = ['games/', 'produtos-fisicos/', 'site/'];

export function variantPath(path: string, width: number): string {
  return path.replace(/\.[a-z0-9]+$/i, '') + `-w${width}.webp`;
}

function variantUrl(url: string, width: number): string | null {
  const idx = url.indexOf(PUBLIC_MARKER);
  if (idx === -1) return null;
  const path = url.slice(idx + PUBLIC_MARKER.length);
  if (!VARIANT_FOLDERS.some((folder) => path.startsWith(folder))) return null;
  return url.slice(0, idx + PUBLIC_MARKER.length) + variantPath(path, width);
}

// srcset pronto pro <img>: as versões menores + a original (com a largura
// máxima que ela pode ter, ver lib/imageResize.ts). undefined quando a
// imagem não é do nosso Storage — aí fica só o src normal.
export function imageSrcSet(url: string | null | undefined, originalWidth = 900): string | undefined {
  if (!url) return undefined;
  const candidates: string[] = [];
  for (const width of IMAGE_VARIANT_WIDTHS) {
    if (width >= originalWidth) break;
    const variant = variantUrl(url, width);
    if (!variant) return undefined;
    candidates.push(`${variant} ${width}w`);
  }
  if (candidates.length === 0) return undefined;
  candidates.push(`${url} ${originalWidth}w`);
  return candidates.join(', ');
}

// onError do <img>: se a versão menor não existir, tira o srcset e o
// navegador carrega a original (o src).
export function fallbackToOriginal(event: { currentTarget: HTMLImageElement }) {
  const img = event.currentTarget;
  if (!img.hasAttribute('srcset')) return;
  img.removeAttribute('srcset');
  img.removeAttribute('sizes');
}

// Tamanhos em que cada tipo de imagem aparece na tela (o "sizes" do <img>).
// No celular os valores são um pouco menores que o tamanho real de
// propósito: telas de celular têm 3x mais pixels, e sem isso o navegador
// baixaria a versão grande pra um card pequeno — com 2x e pouco já fica
// nítido do mesmo jeito, com uma fração do peso.
export const IMAGE_SIZES = {
  card: '(max-width: 640px) 40vw, (max-width: 1100px) 30vw, 240px',
  banner: '(max-width: 900px) 68vw, 800px',
  modalCover: '(max-width: 640px) 60vw, 340px',
  thumb: '96px'
} as const;
