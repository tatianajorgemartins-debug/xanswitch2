import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';

// Várias capturas de tela de uma vez podem somar vários MB, o que estoura
// o limite de tamanho de requisição de uma Server Action. Por isso o
// navegador envia cada imagem direto pro Vercel Blob, e esta rota só cuida
// da parte de autorizar o envio — nunca vê os bytes da imagem em si.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const authed = await isAuthenticated();
        if (!authed) {
          throw new Error('Não autorizado.');
        }
        return {
          allowedContentTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif'],
          // O navegador já comprime a imagem antes de enviar (veja
          // lib/imageCompression.ts) — um WebP de 1600px raramente passa de
          // 1-2MB, então 5MB já é uma folga generosa, não um limite apertado.
          maximumSizeInBytes: 5 * 1024 * 1024,
          addRandomSuffix: true
        };
      },
      onUploadCompleted: async () => {
        // No-op: o painel admin guarda a URL retornada assim que o upload()
        // no navegador termina. Esse callback também nunca dispara em
        // desenvolvimento local, porque a Vercel não alcança o localhost.
      }
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha no upload.' },
      { status: 400 }
    );
  }
}
