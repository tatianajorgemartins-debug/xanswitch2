import type { Metadata } from 'next';
import { ViewTransition } from 'react';
import SiteShell from '@/app/SiteShell';
import { buildWhatsAppContactLink } from '@/lib/whatsapp';
import JogoCabecalho from '../JogoCabecalho';
import FeedClient from './FeedClient';

// Feed dos jogadores: resultados que os clientes publicam dos jogos da
// página Testes (Silhueta do Dia, Ocarina Hero, quizzes). Os posts são
// carregados pelo navegador (jogosActions.ts), pra já virem com as
// curtidas de quem está logado. Moderação: admin > Jogos interativos.
export const metadata: Metadata = {
  title: 'Feed dos jogadores — XAN Switch',
  description: 'Os resultados dos desafios diários e quizzes da XAN Switch. Publique o seu e veja quem mandou bem hoje.',
  openGraph: {
    title: 'Feed dos jogadores — XAN Switch',
    description: 'Publique seu resultado e veja quem mandou bem hoje.',
    images: ['/opengraph-image.jpg']
  }
};

export default function FeedPage() {
  return (
    <SiteShell>
      <ViewTransition>
        <JogoCabecalho whatsappContactUrl={buildWhatsAppContactLink()}>
          <FeedClient />
        </JogoCabecalho>
      </ViewTransition>
    </SiteShell>
  );
}
