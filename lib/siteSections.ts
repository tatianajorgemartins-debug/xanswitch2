// Liga/desliga seções inteiras do site.
//
// Catálogo de produtos físicos (parceria Beedle Games): está GUARDADO. Todo
// o código continua aqui (app/beedle-games, app/PhysicalCatalogClient.tsx,
// app/admin/produtos-fisicos, lib/physicalProducts.ts), mas enquanto isso
// estiver em false ele não aparece no site: as páginas /beedle-games levam
// pro catálogo de jogos. Pra trazer de volta: troque pra true e recoloque a
// opção "Produtos físicos" no seletor do cabeçalho (app/SiteHeader.tsx),
// que hoje mostra "Testes" no lugar.
export const PHYSICAL_CATALOG_ENABLED = false;

// Ocarina Hero (app/testes/ocarina-hero): GUARDADO enquanto é refinado.
// Em false some do site — card da página Testes, filtro do feed e o
// "Música do Dia" do resumo de hoje — e /testes/ocarina-hero leva pra
// /testes. Pra ligar: troque pra true e publique.
export const OCARINA_ENABLED = false;
