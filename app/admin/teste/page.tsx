import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { loadCatalogData } from '@/lib/catalogData';
import { loadPhysicalCatalogData } from '@/lib/physicalCatalogData';
import { buildWhatsAppContactLink } from '@/lib/whatsapp';
import CatalogClient from '@/app/CatalogClient';
import PhysicalCatalogClient from '@/app/PhysicalCatalogClient';
import SiteShell from '@/app/SiteShell';
import TestModeBar from './TestModeBar';

// Área de testes: só abre com o login de admin (o proxy já barra quem não
// tem o cookie, e o isAuthenticated abaixo confere a assinatura de verdade).
// Mostra os catálogos com o visual do site ou, com ?d=atual, com o visual
// antigo, pra comparar antes de levar mudanças pro ar.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Página de teste — XAN Switch',
  robots: { index: false, follow: false }
};

export default async function TestPage({
  searchParams
}: {
  searchParams: Promise<{ v?: string; d?: string }>;
}) {
  if (!(await isAuthenticated())) {
    redirect('/admin/login');
  }

  const { v, d } = await searchParams;
  const view = v === 'digital' ? 'digital' : 'fisico';
  const design = d === 'atual' ? 'current' : 'redesign';

  return (
    <>
      <SiteShell variant={design} themeToggle testPreview>
        {view === 'digital' ? (
          <CatalogClient {...await loadCatalogData()} />
        ) : (
          <PhysicalCatalogClient {...await loadPhysicalCatalogData()} whatsappContactUrl={buildWhatsAppContactLink()} />
        )}
      </SiteShell>
      <TestModeBar view={view} design={design} />
    </>
  );
}
