import type { Metadata } from 'next';
import SiteShell from '@/app/SiteShell';
import CatalogClient from '@/app/CatalogClient';
import { loadCatalogData } from '@/lib/catalogData';

// Link direto do quiz "Qual Link é você?" (bom pra bio do Instagram): o
// catálogo de sempre por trás, com o quiz já aberto por cima — assim o
// login (pro card) e o "Ver jogos de Zelda" funcionam igual à página inicial.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Qual Link é você? — Quiz Zelda · XAN Switch',
  description:
    '10 perguntas, 13 Links. Descubra qual herói de The Legend of Zelda tem a sua personalidade e ganhe um card colecionável na XAN Switch.',
  openGraph: {
    title: 'Qual Link é você? — Quiz Zelda · XAN Switch',
    description: '10 perguntas, 13 Links. Descubra qual herói de Zelda tem a sua personalidade.',
    images: ['/quiz-zelda/card-botw.webp']
  }
};

export default async function QualLinkPage() {
  const data = await loadCatalogData();
  return (
    <SiteShell>
      <CatalogClient {...data} initialQualLink />
    </SiteShell>
  );
}
