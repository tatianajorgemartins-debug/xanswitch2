import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { montarEstadoPublico, obterSorteioPorSlug, sorteioVisivel } from '@/lib/sorteioDb';
import SorteioClient from './SorteioClient';
import '../sorteio.css';

// Página pública do sorteio ao vivo. O estado inicial vem daqui; depois a
// página pergunta o estado sozinha (app/api/sorteios/[slug]).
export const dynamic = 'force-dynamic';

async function carregar(slug: string) {
  const sorteio = await obterSorteioPorSlug(slug).catch(() => null);
  return sorteio && sorteioVisivel(sorteio) ? sorteio : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const sorteio = await carregar((await params).slug);
  if (!sorteio) return { title: 'Sorteio — XAN Switch' };
  return {
    title: `${sorteio.titulo} — XAN Switch`,
    description: sorteio.descricao || 'Sorteio ao vivo da XAN Switch.',
    robots: { index: false }
  };
}

export default async function SorteioPage({ params }: { params: Promise<{ slug: string }> }) {
  const sorteio = await carregar((await params).slug);
  if (!sorteio) notFound();
  return <SorteioClient inicial={await montarEstadoPublico(sorteio)} />;
}
