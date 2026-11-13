'use server';

// Preço atual de todos os jogos do catálogo, direto do banco. O catálogo
// (CatalogClient.tsx) chama isso ao abrir uma compra, ao abrir a lista de
// desejos e ao voltar pra uma aba que ficou parada — assim o cliente nunca
// vê (nem compra pelo) preço de quando a página foi carregada dias antes.
// Só devolve o que já é público no catálogo.
import { getActiveGames } from '@/lib/db';
import { toItem } from '@/lib/catalogData';
import type { Item } from './CatalogClient';

export type FreshPrice = Pick<Item, 'id' | 'price' | 'priceLabel' | 'originalPriceLabel' | 'isOnSale' | 'salePercent' | 'eventTag'>;

export async function getFreshPricesAction(): Promise<FreshPrice[]> {
  const games = await getActiveGames();
  return games.map((g) => {
    const it = toItem(g);
    return {
      id: it.id,
      price: it.price,
      priceLabel: it.priceLabel,
      originalPriceLabel: it.originalPriceLabel,
      isOnSale: it.isOnSale,
      salePercent: it.salePercent,
      eventTag: it.eventTag
    };
  });
}
