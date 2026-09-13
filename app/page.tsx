import { loadCatalogData } from '@/lib/catalogData';
import CatalogClient from './CatalogClient';

// Antes esta página era "force-dynamic" (nunca cacheada — cada visita
// refazia a consulta ao banco do zero, o que ajudou a estourar o limite de
// banda do Vercel Blob). Agora o cache acontece dentro de loadCatalogData
// (lib/catalogData.ts), com invalidação instantânea sempre que algo muda
// no admin — então essa página pode ser cacheada normalmente sem nunca
// mostrar dado desatualizado pra você.

export default async function CatalogPage() {
  const data = await loadCatalogData();
  return <CatalogClient {...data} />;
}
