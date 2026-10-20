// Busca os dados do catálogo PÚBLICO de produtos físicos — equivalente a
// lib/catalogData.ts, só que pro segundo catálogo. Fica num arquivo à
// parte pelo mesmo motivo: o link direto de um produto
// (app/produtos-fisicos/[id]/page.tsx) e a página principal desse catálogo
// (app/produtos-fisicos/page.tsx) precisam dos mesmos dados, e o cache()
// do React garante que o banco só é consultado uma vez por requisição.
import { cache } from 'react';
import { getPublishedPhysicalProducts, getPhysicalCatalogBanner, type PhysicalProduct } from './physicalProducts';
import { formatPriceBR } from './whatsapp';

export type PhysicalItem = {
  id: number;
  name: string;
  price: number;
  priceLabel: string;
  originalPriceLabel: string | null;
  imageUrl: string | null;
  description: string | null;
  // Franquia/categoria (ex: "Naruto", "Dragon Ball Z") — usada no filtro de
  // categorias da página pública (ver o botão "Categorias" em
  // PhysicalCatalogClient.tsx).
  category: string | null;
};

function toPhysicalItem(p: PhysicalProduct): PhysicalItem {
  return {
    id: p.id,
    name: p.name,
    price: parseFloat(p.price),
    priceLabel: formatPriceBR(p.price),
    originalPriceLabel:
      p.original_price && parseFloat(p.original_price) > parseFloat(p.price) ? formatPriceBR(p.original_price) : null,
    imageUrl: p.image_url,
    description: p.description,
    category: p.category
  };
}

export type PhysicalCatalogData = {
  items: PhysicalItem[];
  // Banner da loja parceira (ex: Beedle Games), mostrado antes da grade —
  // null enquanto não subir nada no admin.
  bannerUrl: string | null;
};

export const loadPhysicalCatalogData = cache(async (): Promise<PhysicalCatalogData> => {
  const [products, bannerUrl] = await Promise.all([getPublishedPhysicalProducts(), getPhysicalCatalogBanner()]);
  return { items: products.map(toPhysicalItem), bannerUrl };
});
