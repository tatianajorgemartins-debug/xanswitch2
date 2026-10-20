import type { Metadata } from 'next';
import { ViewTransition } from 'react';
import SiteShell from '@/app/SiteShell';
import { notFound } from 'next/navigation';
import { loadPhysicalCatalogData } from '@/lib/physicalCatalogData';
import { buildWhatsAppContactLink } from '@/lib/whatsapp';
import PhysicalCatalogClient from '@/app/PhysicalCatalogClient';

// Link direto de um produto físico — mesma ideia do link direto de um jogo
// (app/jogo/[id]/page.tsx): mostra o catálogo físico inteiro, já com o
// popup de detalhes desse produto aberto, e monta uma prévia (título,
// descrição, foto) pra quando o link é compartilhado.

async function findProduct(id: string) {
  const data = await loadPhysicalCatalogData();
  const productId = Number(id);
  return { data, item: data.items.find((item) => item.id === productId) ?? null };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { item } = await findProduct(id);
  if (!item) return {};

  const title = `${item.name} — XAN Switch`;
  const description = item.description?.trim()
    ? item.description.slice(0, 200)
    : `${item.name} — produto físico disponível na XAN Switch.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: item.imageUrl ? [item.imageUrl] : undefined
    }
  };
}

export default async function PhysicalProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, item } = await findProduct(id);
  if (!item) notFound();

  // Ver o comentário em app/page.tsx sobre o <ViewTransition>.
  return (
    <SiteShell>
      <ViewTransition>
        <PhysicalCatalogClient
          items={data.items}
          bannerUrl={data.bannerUrl}
          whatsappContactUrl={buildWhatsAppContactLink()}
          initialProductId={item.id}
        />
      </ViewTransition>
    </SiteShell>
  );
}
