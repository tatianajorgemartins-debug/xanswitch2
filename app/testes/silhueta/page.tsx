import type { Metadata } from 'next';
import { ViewTransition } from 'react';
import SiteShell from '@/app/SiteShell';
import { loadCatalogData } from '@/lib/catalogData';
import { buildWhatsAppContactLink } from '@/lib/whatsapp';
import personagensJson from '@/data/jogos/personagens.json';
import JogoCabecalho from '../JogoCabecalho';
import SilhuetaClient from './SilhuetaClient';
import type { Personagem } from './silhueta';

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

// Só o que o jogo usa (sem arquivo_original, revisar etc.).
function paraOJogo(raw: Record<string, unknown>[]): Personagem[] {
  return raw
    .filter((p) => typeof p.id === 'string' && typeof p.nome === 'string' && typeof p.imagem === 'string')
    .map((p) => ({
      id: p.id as string,
      nome: p.nome as string,
      aceitos: Array.isArray(p.aceitos) ? (p.aceitos as string[]) : [],
      franquia: typeof p.franquia === 'string' ? p.franquia : '',
      jogo: typeof p.jogo === 'string' ? p.jogo : '',
      estreia: typeof p.estreia === 'number' ? p.estreia : null,
      ...(typeof p.tipo === 'string' && p.tipo ? { tipo: p.tipo } : {}),
      niveis: Array.isArray(p.niveis) ? (p.niveis as string[]) : [],
      imagem: p.imagem as string,
      ...(p.ativo === false ? { ativo: false } : {}),
      ...(typeof p.ativo_desde === 'string' ? { ativo_desde: p.ativo_desde } : {}),
      ...(typeof p.inativo_desde === 'string' ? { inativo_desde: p.inativo_desde } : {}),
      ...(typeof p.franquia_loja === 'string' ? { franquia_loja: p.franquia_loja } : {})
    }));
}

export default async function SilhuetaPage() {
  const data = await loadCatalogData().catch(() => null);
  const franquiasLoja = [...new Set((data?.items ?? []).map((it) => it.franchise).filter((f): f is string => Boolean(f)))];
  return (
    <SiteShell>
      <ViewTransition>
        <JogoCabecalho whatsappContactUrl={buildWhatsAppContactLink()}>
          <SilhuetaClient personagens={paraOJogo(personagensJson as Record<string, unknown>[])} franquiasLoja={franquiasLoja} />
        </JogoCabecalho>
      </ViewTransition>
    </SiteShell>
  );
}
