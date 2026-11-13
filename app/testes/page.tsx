import type { Metadata } from 'next';
import { ViewTransition } from 'react';
import SiteShell from '@/app/SiteShell';
import { loadCatalogData } from '@/lib/catalogData';
import TestesClient from './TestesClient';

// Página "Testes": a área de jogos interativos da loja (quizzes e o que
// mais vier). Fica na aba "Testes" do cabeçalho, onde antes ficavam os
// produtos físicos. Os jogos da lista estão em games.ts.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Testes e jogos — XAN Switch',
  description:
    'Quizzes e jogos interativos da XAN Switch: descubra qual Link de Zelda é você, qual será seu próximo jogo e muito mais.',
  openGraph: {
    title: 'Testes e jogos — XAN Switch',
    description: 'Quizzes e jogos interativos da XAN Switch. Escolha um e jogue agora.',
    images: ['/opengraph-image.jpg']
  }
};

export default async function TestesPage() {
  const data = await loadCatalogData();
  // Ver o comentário em app/page.tsx sobre o <ViewTransition>.
  return (
    <SiteShell>
      <ViewTransition>
        <TestesClient items={data.items} whatsappContactUrl={data.whatsappContactUrl} />
      </ViewTransition>
    </SiteShell>
  );
}
