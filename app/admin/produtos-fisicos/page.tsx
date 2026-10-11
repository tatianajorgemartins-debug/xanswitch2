import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { getAllPhysicalProducts } from '@/lib/physicalProducts';
import PhysicalProductsAdminClient from './PhysicalProductsAdminClient';

// Área administrativa separada do catálogo de produtos físicos — mesmo
// login do admin de jogos digitais (um site, um dono, uma sessão), mas uma
// página própria, com seu próprio componente e suas próprias Server
// Actions (ver ./actions.ts), pra garantir separação de verdade entre os
// dois catálogos — não só visual.
export const dynamic = 'force-dynamic';

export default async function PhysicalProductsAdminPage() {
  const authed = await isAuthenticated();
  if (!authed) {
    redirect('/admin/login');
  }

  const products = await getAllPhysicalProducts();
  return <PhysicalProductsAdminClient initialProducts={products} />;
}
