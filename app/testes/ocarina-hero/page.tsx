import type { Metadata } from 'next';
import fs from 'node:fs';
import path from 'node:path';
import { ViewTransition } from 'react';
import { redirect } from 'next/navigation';
import { OCARINA_ENABLED } from '@/lib/siteSections';
import SiteShell from '@/app/SiteShell';
import { buildWhatsAppContactLink } from '@/lib/whatsapp';
import JogoCabecalho from '../JogoCabecalho';
import OcarinaClient from './OcarinaClient';
import { validarChart, type Chart } from './ocarina';

// "Ocarina Hero": jogo de ritmo com a ocarina. As músicas são os arquivos
// .json de data/jogos/ocarina (crie novas pelo modo gravar:
// /testes/ocarina-hero?editor=1). A página é gerada na publicação do site,
// então música nova entra quando o site é publicado de novo.
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Ocarina Hero — XAN Switch',
  description: 'Toque a ocarina no ritmo! Jogo de ritmo com músicas originais e uma Música do Dia nova todo dia.',
  openGraph: {
    title: 'Ocarina Hero — XAN Switch',
    description: 'Toque a ocarina no ritmo. Música do Dia nova todo dia.',
    images: ['/opengraph-image.jpg']
  }
};

function lerCharts(): Chart[] {
  const pasta = path.join(process.cwd(), 'data', 'jogos', 'ocarina');
  const charts: Chart[] = [];
  for (const arquivo of fs.readdirSync(pasta).filter((f) => f.endsWith('.json')).sort()) {
    try {
      const c = validarChart(JSON.parse(fs.readFileSync(path.join(pasta, arquivo), 'utf8')));
      if (c) charts.push(c);
      else console.warn(`[ocarina] Música inválida, ignorada: ${arquivo}`);
    } catch (err) {
      console.warn(`[ocarina] Não consegui ler ${arquivo}:`, err);
    }
  }
  const ordem = { facil: 0, medio: 1, dificil: 2, insano: 3 };
  return charts.sort((a, b) => ordem[a.dificuldade] - ordem[b.dificuldade] || a.titulo.localeCompare(b.titulo, 'pt-BR'));
}

export default function OcarinaPage() {
  // Guardado por enquanto (lib/siteSections.ts). No computador de teste
  // (npm run dev) continua abrindo, pra dar pra refinar.
  if (!OCARINA_ENABLED && process.env.NODE_ENV === 'production') redirect('/testes');
  return (
    <SiteShell>
      <ViewTransition>
        <JogoCabecalho whatsappContactUrl={buildWhatsAppContactLink()}>
          <OcarinaClient charts={lerCharts()} />
        </JogoCabecalho>
      </ViewTransition>
    </SiteShell>
  );
}
