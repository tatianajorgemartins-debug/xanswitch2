import { loadCatalogData } from '@/lib/catalogData';
import CatalogClient from './CatalogClient';

// Antes esta página era "force-dynamic" (nunca cacheada — cada visita
// refazia a consulta ao banco do zero, o que ajudou a estourar o limite de
// banda do Vercel Blob). Agora ela é cacheada como página (ISR): fica
// pronta por até 5 minutos antes de ser gerada de novo sozinha — as ações
// do admin (app/admin/actions.ts) também pedem pra regenerar na hora via
// revalidatePath('/'), então normalmente nem precisa esperar os 5 minutos.
export const revalidate = 300;

export default async function CatalogPage() {
  const data = await loadCatalogData();
  return <CatalogClient {...data} />;
}
