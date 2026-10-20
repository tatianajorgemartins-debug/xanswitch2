import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { loadCatalogData } from '@/lib/catalogData';
import { loadPhysicalCatalogData } from '@/lib/physicalCatalogData';
import { buildWhatsAppContactLink } from '@/lib/whatsapp';
import CatalogClient from '@/app/CatalogClient';
import PhysicalCatalogClient from '@/app/PhysicalCatalogClient';
import TestModeBar from './TestModeBar';

// Área de testes: só abre com o login de admin (o proxy já barra quem não
// tem o cookie, e o isAuthenticated abaixo confere a assinatura de verdade).
// Mudanças em teste ficam em arquivos desta pasta, nunca nos componentes do
// site público, até serem aprovadas.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Página de teste — XAN Switch',
  robots: { index: false, follow: false }
};

export default async function TestPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  if (!(await isAuthenticated())) {
    redirect('/admin/login');
  }

  const { v } = await searchParams;
  const view = v === 'digital' ? 'digital' : 'fisico';

  return (
    <>
      {view === 'digital' ? (
        <CatalogClient {...await loadCatalogData()} />
      ) : (
        <PhysicalCatalogClient
          {...await loadPhysicalCatalogData()}
          whatsappContactUrl={buildWhatsAppContactLink()}
        />
      )}
      <TestModeBar view={view} />
    </>
  );
}
