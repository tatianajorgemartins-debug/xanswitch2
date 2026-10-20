// Acesso a dados do catálogo de PRODUTOS FÍSICOS (parceria com
// importadora) — arquivo completamente separado de lib/db.ts (catálogo de
// jogos digitais). Os dois compartilham só a conexão de baixo nível (ver
// lib/sql.ts); a tabela, os tipos e todas as funções aqui são exclusivos
// desse catálogo, pra nenhuma operação acidentalmente misturar os dois.
import { getSql } from './sql';
// getSiteSetting/setSiteSetting são genéricas (chave/valor pro site
// inteiro, não específicas de jogos) — reaproveitar daqui é seguro, é só a
// tabela physical_products (os PRODUTOS em si) que fica isolada de
// lib/db.ts.
import { getSiteSetting, setSiteSetting } from './db';

// Chave em site_settings pra guardar a URL do banner da loja parceira
// (ex: Beedle Games), mostrado no topo do catálogo de produtos físicos,
// antes da grade — ver updatePhysicalBannerAction em
// app/admin/produtos-fisicos/actions.ts e loadPhysicalCatalogData logo
// abaixo.
export const PHYSICAL_CATALOG_BANNER_KEY = 'physical_catalog_banner_image_url';

export async function getPhysicalCatalogBanner(): Promise<string | null> {
  return getSiteSetting(PHYSICAL_CATALOG_BANNER_KEY);
}

export async function setPhysicalCatalogBanner(url: string | null): Promise<void> {
  await setSiteSetting(PHYSICAL_CATALOG_BANNER_KEY, url);
}

export type PhysicalProduct = {
  id: number;
  name: string;
  price: string; // numeric vem como string do postgres
  original_price: string | null;
  image_url: string | null;
  description: string | null;
  published: boolean;
  // Marca os produtos de demonstração (ver db/seed-physical-demo-products.sql)
  // — dá pra identificar e excluir todos de uma vez só, sem misturar com
  // produtos de verdade cadastrados depois.
  is_demo: boolean;
  // Texto livre, criado aos poucos no admin conforme os produtos vão
  // sendo cadastrados (mesma ideia da "franquia" dos jogos digitais) —
  // null enquanto o produto ainda não tem categoria.
  category: string | null;
  created_at: Date;
  updated_at: Date;
};

export type CreatePhysicalProductData = {
  name: string;
  price: number;
  original_price: number | null;
  image_url: string | null;
  description: string | null;
  published: boolean;
  is_demo: boolean;
  category: string | null;
};

export async function getAllPhysicalProducts(): Promise<PhysicalProduct[]> {
  const rows = await getSql()`
    SELECT * FROM physical_products ORDER BY sort_name ASC
  `;
  return rows as PhysicalProduct[];
}

// Só os publicados — usado no catálogo público (/produtos-fisicos).
export async function getPublishedPhysicalProducts(): Promise<PhysicalProduct[]> {
  const rows = await getSql()`
    SELECT * FROM physical_products WHERE published = TRUE ORDER BY sort_name ASC
  `;
  return rows as PhysicalProduct[];
}

export async function getPhysicalProductById(id: number): Promise<PhysicalProduct | null> {
  const rows = await getSql()`
    SELECT * FROM physical_products WHERE id = ${id}
  `;
  return (rows[0] as PhysicalProduct) ?? null;
}

export async function createPhysicalProduct(data: CreatePhysicalProductData): Promise<PhysicalProduct> {
  const rows = await getSql()`
    INSERT INTO physical_products (name, price, original_price, image_url, description, published, is_demo, category)
    VALUES (${data.name}, ${data.price}, ${data.original_price}, ${data.image_url}, ${data.description}, ${data.published}, ${data.is_demo}, ${data.category})
    RETURNING *
  `;
  return rows[0] as PhysicalProduct;
}

export async function updatePhysicalProduct(id: number, data: CreatePhysicalProductData): Promise<void> {
  await getSql()`
    UPDATE physical_products
    SET name = ${data.name},
        price = ${data.price},
        original_price = ${data.original_price},
        image_url = ${data.image_url},
        description = ${data.description},
        published = ${data.published},
        is_demo = ${data.is_demo},
        category = ${data.category},
        updated_at = now()
    WHERE id = ${id}
  `;
}

// Lista de categorias já usadas em algum produto, sem repetir — alimenta o
// <datalist> do formulário (pra você digitar uma nova ou reaproveitar uma
// que já criou) e o filtro da lista no admin.
export async function getAllPhysicalProductCategories(): Promise<string[]> {
  const rows = await getSql()`
    SELECT DISTINCT category FROM physical_products
    WHERE category IS NOT NULL AND category <> ''
    ORDER BY category ASC
  `;
  return rows.map((r) => r.category as string);
}

export async function setPhysicalProductPublished(id: number, published: boolean): Promise<void> {
  await getSql()`
    UPDATE physical_products SET published = ${published}, updated_at = now() WHERE id = ${id}
  `;
}

export async function deletePhysicalProduct(id: number): Promise<void> {
  await getSql()`DELETE FROM physical_products WHERE id = ${id}`;
}
