import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { montarEstadoPublico, obterSorteioPorSlug, sorteioVisivel } from '@/lib/sorteioDb';
import SiteShell from '@/app/SiteShell';
import SorteioClient from './SorteioClient';
import '../sorteio.css';

// Página pública do sorteio ao vivo. O estado inicial vem daqui; depois a
// página pergunta o estado sozinha (app/api/sorteios/[slug]).
export const dynamic = 'force-dynamic';

// Rascunho fica escondido do público, mas o admin logado vê uma prévia.
async function carregar(slug: string) {
  const sorteio = await obterSorteioPorSlug(slug).catch(() => null);
  if (!sorteio) return null;
  if (sorteioVisivel(sorteio)) return { sorteio, previa: false };
  return (await isAuthenticated()) ? { sorteio, previa: true } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const sorteio = (await carregar((await params).slug))?.sorteio;
  if (!sorteio) return { title: 'Sorteio — XAN Switch' };
  return {
    title: `${sorteio.titulo} — XAN Switch`,
    description: sorteio.descricao || 'Sorteio ao vivo da XAN Switch.',
    robots: { index: false }
  };
}

export default async function SorteioPage({ params }: { params: Promise<{ slug: string }> }) {
  const achado = await carregar((await params).slug);
  if (!achado) notFound();
  // Mesmo "casco" das páginas públicas (fonte, cores, tela de carregamento).
  return (
    <SiteShell themeToggle={false}>
      <SorteioClient inicial={await montarEstadoPublico(achado.sorteio)} previa={achado.previa} />
    </SiteShell>
  );
}
