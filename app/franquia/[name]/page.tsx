import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadCatalogData } from '@/lib/catalogData';
import CatalogClient from '@/app/CatalogClient';

// Link direto pra uma franquia específica (ex: /franquia/Legend%20Of%20Zelda)
// — é o que o botão de "franquia em destaque" usa pra ser compartilhável
// (ver FeaturedFranchisePanel em app/admin/AdminClient.tsx). Mesma ideia do
// link direto de um jogo (app/jogo/[id]/page.tsx): mostra o catálogo
// inteiro, só que já filtrado pra essa franquia ao carregar.
//
// Se a franquia do link não bater com nenhum jogo ativo, cai na página de
// "não encontrado" em vez de mostrar um catálogo vazio sem explicação.

// decodeURIComponent defensivo: em alguns casos (observado no modo dev) o
// valor já vem decodificado pelo Next, em outros ainda vem cru
// (ex: "Legend%20Of%20Zelda") — decodificar de novo um texto que já não
// tem nenhum "%XX" é inofensivo, então isso cobre os dois casos sem
// depender de qual exatamente o Next entrega em cada chamada.
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function findFranchise(name: string) {
  const data = await loadCatalogData();
  const decoded = safeDecode(name);
  const exists = data.items.some((item) => item.franchise === decoded);
  return { data, exists, decoded };
}

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params;
  const { exists, decoded } = await findFranchise(name);
  if (!exists) return {};

  const title = `Jogos de ${decoded} — XAN Switch`;
  const description = `Confira todos os jogos de ${decoded} disponíveis na XAN Switch — código digital, entrega rápida.`;

  return { title, description, openGraph: { title, description } };
}

export default async function FranchisePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const { data, exists, decoded } = await findFranchise(name);
  if (!exists) notFound();

  return <CatalogClient {...data} initialFranchiseFilter={decoded} />;
}
