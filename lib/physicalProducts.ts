// Acesso a dados do catálogo de PRODUTOS FÍSICOS (parceria com
// importadora) — arquivo completamente separado de lib/db.ts (catálogo de
// jogos digitais). Os dois compartilham só a conexão de baixo nível (ver
// lib/sql.ts); a tabela, os tipos e todas as funções aqui são exclusivos
// desse catálogo, pra nenhuma operação acidentalmente misturar os dois.
import { getSql } from './sql';

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
    INSERT INTO physical_products (name, price, original_price, image_url, description, published, is_demo)
    VALUES (${data.name}, ${data.price}, ${data.original_price}, ${data.image_url}, ${data.description}, ${data.published}, ${data.is_demo})
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
        updated_at = now()
    WHERE id = ${id}
  `;
}

export async function setPhysicalProductPublished(id: number, published: boolean): Promise<void> {
  await getSql()`
    UPDATE physical_products SET published = ${published}, updated_at = now() WHERE id = ${id}
  `;
}

export async function deletePhysicalProduct(id: number): Promise<void> {
  await getSql()`DELETE FROM physical_products WHERE id = ${id}`;
}
