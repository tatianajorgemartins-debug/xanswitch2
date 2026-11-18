import type { Metadata } from 'next';
import { ViewTransition } from 'react';
import { redirect } from 'next/navigation';
import SiteShell from '@/app/SiteShell';
import { buildWhatsAppContactLink } from '@/lib/whatsapp';
import { dificuldadesDaMusica, getPublishedOcarinaSongs, jogoOcarinaPublicado } from '@/lib/ocarinaDb';
import JogoCabecalho from '../JogoCabecalho';
import OcarinaClient from './OcarinaClient';
import { validarChart, type Chart } from './ocarina';

// "Zelda Tour": jogo de ritmo. As músicas são as publicadas no admin (aba
// "Zelda Tour", tabela ocarina_songs).
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Zelda Tour — XAN Switch',
  description: 'Jogo de ritmo da XAN Switch: toque as notas no tempo da música. Música do Dia nova todo dia.',
  openGraph: {
    title: 'Zelda Tour — XAN Switch',
    description: 'Toque as notas no tempo da música. Música do Dia nova todo dia.',
    images: ['/opengraph-image.jpg']
  }
};

async function musicasDoAdmin(): Promise<Chart[]> {
  const rows = await getPublishedOcarinaSongs().catch(() => []);
  return rows
    .map((m) => {
      const { notas, liberadas } = dificuldadesDaMusica(m);
      return validarChart({
        id: `m${m.id}`,
        titulo: m.title,
        jogo: m.game || 'Outros',
        bpm: m.bpm,
        inicioBatida: m.beat_offset,
        dificuldade: m.difficulty,
        audio: m.audio_url,
        duracaoAudio: m.audio_duration ?? undefined,
        fimEm: m.end_at ?? undefined,
        publicadaEm: m.published_at ? new Date(m.published_at).toISOString() : undefined,
        ativo_desde: m.active_from ?? undefined,
        notas: m.notes,
        variantes: Object.fromEntries(liberadas.map((d) => [d, notas[d]]))
      });
    })
    .filter((c): c is Chart => c !== null);
}

export default async function OcarinaPage() {
  // Fora do ar (admin > Zelda Tour): só o site oficial (Vercel, produção)
  // manda de volta pra /testes. No computador de teste continua abrindo.
  if (process.env.VERCEL_ENV === 'production' && !(await jogoOcarinaPublicado())) redirect('/testes');
  const charts = await musicasDoAdmin();
  return (
    <SiteShell>
      <ViewTransition>
        <JogoCabecalho whatsappContactUrl={buildWhatsAppContactLink()}>
          <OcarinaClient charts={charts} />
        </JogoCabecalho>
      </ViewTransition>
    </SiteShell>
  );
}
