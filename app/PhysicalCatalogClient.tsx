'use client';

// Catálogo PÚBLICO de produtos físicos — componente separado de
// CatalogClient.tsx (jogos digitais) de propósito. Nessa primeira etapa é
// deliberadamente simples: sem carrossel, sem lista de desejos, sem fluxo
// de compra — só o banner da loja parceira, a busca, o filtro por
// categoria (franquia), a grade de produtos e um popup com os detalhes de
// cada um. Reaproveita o cabeçalho (SiteHeader), o grid e o visual de card
// já usados no catálogo digital, pra não parecer uma seção improvisada.
import { useEffect, useMemo, useState } from 'react';
import SiteHeader from './SiteHeader';
import { useDesignVariant } from './DesignVariant';
import type { PhysicalItem } from '@/lib/physicalCatalogData';

export default function PhysicalCatalogClient({
  items,
  bannerUrl,
  whatsappContactUrl,
  initialProductId
}: {
  items: PhysicalItem[];
  // Banner da loja parceira (ex: Beedle Games) mostrado antes da grade —
  // null enquanto não subir nada no admin.
  bannerUrl: string | null;
  whatsappContactUrl: string | null;
  // Só vem preenchido quando a página é acessada pelo link direto de um
  // produto (app/produtos-fisicos/[id]/page.tsx) — abre o popup de
  // detalhes desse produto assim que a página carrega.
  initialProductId?: number;
}) {
  const isRedesign = useDesignVariant() === 'redesign';
  const [selectedItem, setSelectedItem] = useState<PhysicalItem | null>(null);
  const [query, setQuery] = useState('');
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');

  const categories = useMemo(
    () =>
      Array.from(new Set(items.map((it) => it.category).filter((c): c is string => !!c))).sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
      ),
    [items]
  );

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(query.trim().toLowerCase()) &&
      (categoryFilter === '' || item.category === categoryFilter)
  );

  function openProduct(item: PhysicalItem) {
    setSelectedItem(item);
    window.history.replaceState(null, '', `/produtos-fisicos/${item.id}`);
  }
  function closeProduct() {
    setSelectedItem(null);
    window.history.replaceState(null, '', '/produtos-fisicos');
  }

  useEffect(() => {
    if (initialProductId === undefined) return;
    const item = items.find((it) => it.id === initialProductId);
    if (item) setSelectedItem(item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProductId]);

  useEffect(() => {
    if (!selectedItem) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeProduct();
    }
    window.addEventListener('keydown', onKeyDown);
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = original;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem]);

  return (
    <>
      {/* viewTransitionName: ver o mesmo comentário em CatalogClient.tsx —
          mantém o cabeçalho parado durante o crossfade da troca de
          catálogo, em vez de esmaecer/mexer junto com o resto da página. */}
      <header className="site-header-bar" style={{ viewTransitionName: 'site-header' }}>
        <div className="site-header-bar-inner">
          <SiteHeader
            whatsappContactUrl={whatsappContactUrl}
            activeCatalog="fisico"
            accountLabel="Minha conta"
            accountHref="/?conta=1"
          />
        </div>
      </header>

      <div className="page-content" style={{ maxWidth: 1240, margin: '0 auto', paddingLeft: 20, paddingRight: 20, paddingBottom: 80 }}>
        {/* Banner da loja parceira — mesmo tratamento visual do
            .reviews-banner do catálogo digital (ver globals.css), só com
            altura maior porque essa arte é um banner largo 3:1, não uma
            tira fina de avaliações. */}
        {isRedesign && <h1 className="visually-hidden">Colecionáveis e games físicos da Beedle Games</h1>}
        {bannerUrl && (
          <div className="physical-catalog-banner">
            <img src={bannerUrl} alt="Loja parceira" />
          </div>
        )}

        {/* Mesma busca do catálogo digital (ver .catalog-toolbar-search em
            CatalogClient.tsx), com um botão "Categorias" do lado que abre
            um seletor de franquia (ver .filters-panel em globals.css,
            mesmo painel usado pelo "Filtros" do catálogo digital). */}
        <div className="catalog-toolbar is-centered">
          <div className="catalog-toolbar-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width={16} height={16} style={{ color: 'var(--ink-dim)', flex: 'none' }}>
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input type="text" placeholder="Buscar produto..." value={query} onChange={(e) => setQuery(e.target.value)} />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Limpar busca"
                title="Limpar busca"
                style={{ background: 'none', border: 'none', color: 'var(--ink-dim)', cursor: 'pointer', padding: 0, flex: 'none', display: 'flex' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width={14} height={14}>
                  <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>

          <a href={BEEDLE_GAMES_INSTAGRAM_URL} target="_blank" rel="noreferrer" className="btn ghost">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={15} height={15} style={{ flex: 'none' }}>
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
            Entre em contato
          </a>

          {categories.length > 0 && (
            <button type="button" className="btn ghost" onClick={() => setCategoryFilterOpen((v) => !v)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={14} height={14} style={{ flex: 'none' }}>
                <path d="M3 4h18l-7 8v7l-4-2v-5L3 4z" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
              Categorias{categoryFilter ? ` (${categoryFilter})` : ''}
            </button>
          )}
        </div>

        {categoryFilterOpen && categories.length > 0 && (
          <div className="filters-panel">
            <div>
              <label htmlFor="pp-public-category">Categoria</label>
              <select id="pp-public-category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">Todas</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {categoryFilter && (
              <button type="button" className="btn ghost" onClick={() => setCategoryFilter('')} style={{ alignSelf: 'end' }}>
                ✕ Limpar filtro
              </button>
            )}
          </div>
        )}

        {items.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--ink-dim)', fontSize: 14, padding: '40px 0' }}>
            Nenhum produto disponível no momento. Volte em breve!
          </p>
        ) : filteredItems.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--ink-dim)', fontSize: 14, padding: '40px 0' }}>
            {query ? `Nenhum produto encontrado pra "${query}".` : `Nenhum produto encontrado na categoria "${categoryFilter}".`}
          </p>
        ) : (
          <>
          {isRedesign && (
            <p className="catalog-count">
              <span className="catalog-count-number">{filteredItems.length}</span>{' '}
              {filteredItems.length === 1 ? 'colecionável' : 'colecionáveis'}
            </p>
          )}
          <div className="catalog-grid">
            {filteredItems.map((item) => (
              <PhysicalProductCard key={item.id} item={item} onSelect={() => openProduct(item)} />
            ))}
          </div>
          </>
        )}
      </div>

      {selectedItem && <PhysicalProductModal item={selectedItem} onClose={closeProduct} />}
    </>
  );
}

function PhysicalProductCard({ item, onSelect }: { item: PhysicalItem; onSelect: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className="game-card"
    >
      <div className="cover-frame">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-dim)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="26%">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}
      </div>

      <div className="game-card-info">
        <p className="game-card-name">{item.name}</p>
        {item.originalPriceLabel && <p className="game-card-old-price">R$ {item.originalPriceLabel}</p>}
        <p className="game-card-price">R$ {item.priceLabel}</p>
      </div>
    </div>
  );
}

// Perfil da loja parceira no Instagram — é lá que a compra desses produtos
// acontece de verdade por enquanto (sem fluxo de pagamento próprio aqui no
// site ainda, diferente dos jogos digitais via Pix).
const BEEDLE_GAMES_INSTAGRAM_URL = 'https://www.instagram.com/beedle_games/';

// Popup de detalhes — bem mais simples que o modal de compra dos jogos
// digitais (PurchaseModal.tsx): sem etapas, sem pagamento por aqui, só a
// foto grande, nome, preço, descrição e um botão "Comprar agora" que leva
// pro Instagram da loja parceira (mesmo texto/estilo do botão de comprar
// dos jogos digitais).
function PhysicalProductModal({ item, onClose }: { item: PhysicalItem; onClose: () => void }) {
  return (
    <div className="purchase-modal-overlay" onClick={onClose}>
      <div
        className="purchase-modal"
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440 }}
      >
        <div className="purchase-modal-header">
          <span className="purchase-modal-title">{item.name}</span>
          <button type="button" className="purchase-modal-close" onClick={onClose} aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width={18} height={18}>
              <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="purchase-modal-body">
          <div className="cover-frame" style={{ marginBottom: 16 }}>
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-dim)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="22%">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
            )}
          </div>

          <div className="product-price-row" style={{ justifyContent: 'center' }}>
            {item.originalPriceLabel && <span className="product-price-old">R$ {item.originalPriceLabel}</span>}
            <span className="product-price">R$ {item.priceLabel}</span>
          </div>

          {item.description && (
            <div className="purchase-description">
              <p className="purchase-description-label">Sobre o produto</p>
              <p className="purchase-description-text">{item.description}</p>
            </div>
          )}

          <div className="purchase-modal-actions">
            <a
              href={BEEDLE_GAMES_INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="btn primary product-cta"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width={17} height={17}>
                <circle cx="9" cy="21" r="1.4" fill="currentColor" stroke="none" />
                <circle cx="18" cy="21" r="1.4" fill="currentColor" stroke="none" />
                <path d="M2.5 3h2.4l2.4 12.4a2 2 0 002 1.6h8.8a2 2 0 002-1.6L21.5 7H6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Comprar agora
            </a>
            <p style={{ fontSize: 12, color: 'var(--ink-dim)', textAlign: 'center', margin: '8px 0 0' }}>
              Você será direcionado pro Instagram da Beedle Games pra fechar a compra.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
