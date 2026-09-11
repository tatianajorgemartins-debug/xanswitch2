// Comprime imagens no SERVIDOR antes de salvar no Vercel Blob (usado hoje
// só pela capa do jogo, que sobe via Server Action — veja
// app/admin/actions.ts). Isso existe porque o "peso" que estoura o limite
// de banda do Vercel Blob não é o espaço ocupado pelos arquivos, é quantas
// vezes cada visitante baixa essas imagens: uma foto de celular sem
// comprimir pode ter vários MB, e isso se repete a cada visita do site.
//
// Reduzindo a resolução (ninguém precisa de uma foto de 4000px pra mostrar
// num card de 300px) e convertendo pra WebP (formato mais leve que
// JPEG/PNG pra fotos), o mesmo visual final ocupa uma fração do tamanho.
import sharp from 'sharp';

export type CompressedImage = {
  buffer: Buffer;
  contentType: string;
  /** Extensão sugerida pro nome do arquivo salvo (sem o ponto). */
  extension: string;
};

/**
 * @param input bytes originais da imagem (de qualquer formato que o sharp
 *   entenda: jpg, png, webp, avif, gif...)
 * @param maxDimension maior lado (largura OU altura) que a imagem pode
 *   ter depois de redimensionada — imagens menores que isso não são
 *   esticadas, só as maiores são encolhidas.
 * @param quality qualidade do WebP, de 1 a 100 (80 já é bem leve mantendo
 *   uma qualidade visual boa pra fotos de jogos).
 */
export async function compressImage(
  input: Buffer,
  maxDimension: number,
  quality: number
): Promise<CompressedImage> {
  const buffer = await sharp(input)
    .rotate() // aplica a orientação EXIF (fotos de celular vêm "deitadas" sem isso)
    .resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();

  return { buffer, contentType: 'image/webp', extension: 'webp' };
}
