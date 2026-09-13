import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadCatalogData } from '@/lib/catalogData';
import CatalogClient from '@/app/CatalogClient';

// Essa página existe só pra ter um link "direto" de cada jogo, pra você
// compartilhar nas redes sociais (ver o botão "Compartilhar" dentro do
// modal de compra). Ela mostra o catálogo inteiro, igual à página
// principal — só que já abre o modal do jogo em questão sozinha, e monta
// uma prévia (título, descrição, capa) que aparece quando o link é colado
// no WhatsApp, Instagram etc.
//
// Se o link apontar pra um jogo que não existe mais (foi excluído ou
// arquivado), cai na página de "não encontrado" do Next em vez de quebrar.

async function findGame(id: string) {
  const data = await loadCatalogData();
  const gameId = Number(id);
  return { data, game: data.items.find((item) => item.id === gameId) ?? null };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { game } = await findGame(id);
  if (!game) return {};

  const title = `${game.name} — XAN Switch`;
  const description = game.description?.trim()
    ? game.description.slice(0, 200)
    : `Compre ${game.name} com Pix, direto pelo site — código digital, entrega rápida.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: game.imageUrl ? [game.imageUrl] : undefined
    }
  };
}

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, game } = await findGame(id);
  if (!game) notFound();

  return <CatalogClient {...data} initialGameId={game.id} />;
}
