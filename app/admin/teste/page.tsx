import type { Metadata } from 'next';
import { Archivo } from 'next/font/google';
import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { loadCatalogData } from '@/lib/catalogData';
import { loadPhysicalCatalogData } from '@/lib/physicalCatalogData';
import { buildWhatsAppContactLink } from '@/lib/whatsapp';
import CatalogClient from '@/app/CatalogClient';
import PhysicalCatalogClient from '@/app/PhysicalCatalogClient';
import { DesignVariantProvider } from '@/app/DesignVariant';
import TestModeBar from './TestModeBar';
import './redesign.css';

// Área de testes: só abre com o login de admin (o proxy já barra quem não
// tem o cookie, e o isAuthenticated abaixo confere a assinatura de verdade).
// O visual novo só existe aqui: os componentes leem o DesignVariantProvider
// e todo o CSS dele fica preso dentro de .redesign (ver redesign.css).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Página de teste — XAN Switch',
  robots: { index: false, follow: false }
};

const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--font-redesign'
});

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

  const catalog =
    view === 'digital' ? (
      <CatalogClient {...await loadCatalogData()} />
    ) : (
      <PhysicalCatalogClient {...await loadPhysicalCatalogData()} whatsappContactUrl={buildWhatsAppContactLink()} />
    );

  return (
    <DesignVariantProvider variant={design}>
      {design === 'redesign' ? <div className={`redesign ${archivo.variable}`}>{catalog}</div> : catalog}
      <TestModeBar view={view} design={design} />
    </DesignVariantProvider>
  );
}
