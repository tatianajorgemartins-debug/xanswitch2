import { ViewTransition } from 'react';
import SiteShell from '@/app/SiteShell';
import { loadPhysicalCatalogData } from '@/lib/physicalCatalogData';
import { buildWhatsAppContactLink } from '@/lib/whatsapp';
import PhysicalCatalogClient from '@/app/PhysicalCatalogClient';
import { redirect } from 'next/navigation';
import { PHYSICAL_CATALOG_ENABLED } from '@/lib/siteSections';

// Segundo catálogo do site: produtos físicos (parceria com importadora),
// numa rota própria — mesmo padrão de cache (ISR) da página principal (ver
// app/page.tsx), já que também não depende de nada específico de quem
// visita.
export const revalidate = 300;

export default async function PhysicalProductsPage() {
  // Seção guardada (lib/siteSections.ts): quem cair aqui vai pro catálogo.
  if (!PHYSICAL_CATALOG_ENABLED) redirect('/');
  const data = await loadPhysicalCatalogData();
  // Ver o comentário em app/page.tsx sobre o <ViewTransition>.
  return (
    <SiteShell>
      <ViewTransition>
        <PhysicalCatalogClient items={data.items} bannerUrl={data.bannerUrl} whatsappContactUrl={buildWhatsAppContactLink()} />
      </ViewTransition>
    </SiteShell>
  );
}
