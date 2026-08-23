import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';

// Music files can be several MB — too big to pass through a Server Action
// (Vercel's serverless functions reject large request bodies outright,
// well below what Next's own bodySizeLimit config can raise). Instead the
// browser uploads straight to Vercel Blob, and this route only ever handles
// the tiny "please issue me a token" exchange, never the file bytes.
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
          allowedContentTypes: ['audio/mpeg', 'audio/mp3'],
          maximumSizeInBytes: 50 * 1024 * 1024,
          addRandomSuffix: true
        };
      },
      onUploadCompleted: async () => {
        // No-op: the admin panel saves the URL itself once the client-side
        // upload() call resolves. This callback also never fires in local
        // dev, since Vercel has no way to reach localhost.
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
