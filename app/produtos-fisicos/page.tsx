import { ViewTransition } from 'react';
import { loadPhysicalCatalogData } from '@/lib/physicalCatalogData';
import { buildWhatsAppContactLink } from '@/lib/whatsapp';
import PhysicalCatalogClient from '@/app/PhysicalCatalogClient';

// Segundo catálogo do site: produtos físicos (parceria com importadora),
// numa rota própria — mesmo padrão de cache (ISR) da página principal (ver
// app/page.tsx), já que também não depende de nada específico de quem
// visita.
export const revalidate = 300;

export default async function PhysicalProductsPage() {
  const data = await loadPhysicalCatalogData();
  // Ver o comentário em app/page.tsx sobre o <ViewTransition>.
  return (
    <ViewTransition>
      <PhysicalCatalogClient items={data.items} whatsappContactUrl={buildWhatsAppContactLink()} />
    </ViewTransition>
  );
}
