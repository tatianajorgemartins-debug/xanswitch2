// Versão desta compressão que roda NO NAVEGADOR (usada pelas capturas de
// tela, que são enviadas direto do navegador pro Vercel Blob — veja
// ScreenshotsField em app/admin/AdminClient.tsx). A capa do jogo usa a
// versão server-side (lib/imageResize.ts) porque ela passa pelo servidor
// de qualquer forma; as capturas de tela não, então a compressão também
// precisa acontecer aqui.
//
// A técnica: desenha a imagem escolhida num <canvas> já no tamanho
// reduzido, depois pede pro navegador exportar esse canvas como um arquivo
// WebP comprimido. Nenhum dado sai do computador da pessoa até esse passo
// terminar.

/**
 * @param file arquivo de imagem original (o que veio do <input type="file">)
 * @param maxDimension maior lado (largura OU altura) permitido depois de
 *   redimensionar — imagens menores não são esticadas.
 * @param quality qualidade do WebP, de 1 a 100.
 */
export async function compressImageFile(file: File, maxDimension: number, quality: number): Promise<File> {
  // `imageOrientation: 'from-image'` é o que evita fotos de celular saindo
  // "deitadas" — sem isso, o EXIF de orientação da foto é ignorado.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Navegador muito antigo/incomum sem suporte a canvas 2D — melhor
    // mandar o arquivo original do que travar a compra do jogo por causa
    // disso.
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', quality / 100);
  });
  if (!blob) return file;

  const newName = file.name.replace(/\.[^.]+$/, '') + '.webp';
  return new File([blob], newName, { type: 'image/webp' });
}
