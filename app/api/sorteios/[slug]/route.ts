// Estado público do sorteio ao vivo (/sorteio/<slug> pergunta isso a cada
// ~2 s). Sem dados privados. O cache de 1 s na Vercel junta os pedidos de
// quem está assistindo, pra a live não sobrecarregar o banco.
import { montarEstadoPublico, obterSorteioPorSlug, sorteioVisivel } from '@/lib/sorteioDb';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const sorteio = await obterSorteioPorSlug(slug);
    if (!sorteio || !sorteioVisivel(sorteio)) return Response.json({ erro: 'não encontrado' }, { status: 404 });
    return Response.json(await montarEstadoPublico(sorteio), {
      headers: { 'Cache-Control': 'public, s-maxage=1, stale-while-revalidate=1' }
    });
  } catch (err) {
    console.error('[sorteio] estado:', err);
    return Response.json({ erro: 'indisponível' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
