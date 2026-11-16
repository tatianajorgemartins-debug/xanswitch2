import type { Metadata } from 'next';
import { ViewTransition } from 'react';
import SiteShell from '@/app/SiteShell';
import { loadCatalogData } from '@/lib/catalogData';
import { buildWhatsAppContactLink } from '@/lib/whatsapp';
import personagensJson from '@/data/jogos/personagens.json';
import JogoCabecalho from '../JogoCabecalho';
import SilhuetaClient from './SilhuetaClient';
import { personagensDoJson } from './silhueta';

// "Silhueta do Dia": adivinhe o personagem Nintendo pela silhueta. Um
// desafio por dia em cada nível, igual pra todo mundo. Regras em
// silhueta.ts; personagens em data/jogos/personagens.json.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Silhueta do Dia — XAN Switch',
  description: 'Quem é esse personagem? Adivinhe o personagem Nintendo pela silhueta. Desafio novo todo dia.',
  openGraph: {
    title: 'Silhueta do Dia — XAN Switch',
    description: 'Quem é esse personagem? Desafio novo todo dia.',
    images: ['/opengraph-image.jpg']
  }
};

export default async function SilhuetaPage() {
  const data = await loadCatalogData().catch(() => null);
  const franquiasLoja = [...new Set((data?.items ?? []).map((it) => it.franchise).filter((f): f is string => Boolean(f)))];
  return (
    <SiteShell>
      <ViewTransition>
        <JogoCabecalho whatsappContactUrl={buildWhatsAppContactLink()}>
          <SilhuetaClient personagens={personagensDoJson(personagensJson as Record<string, unknown>[])} franquiasLoja={franquiasLoja} />
        </JogoCabecalho>
      </ViewTransition>
    </SiteShell>
  );
}
