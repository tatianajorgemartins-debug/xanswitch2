'use client';

// Catálogo PÚBLICO de produtos físicos — componente separado de
// CatalogClient.tsx (jogos digitais) de propósito. Nessa primeira etapa é
// deliberadamente simples: sem carrossel, sem lista de desejos, sem fluxo
// de compra — só o banner da loja parceira, a grade de produtos e um
// popup com os detalhes de cada um. Reaproveita o cabeçalho (SiteHeader),
// o grid e o visual de card já usados no catálogo digital, pra não
// parecer uma seção improvisada.
import { useEffect, useState } from 'react';
import SiteHeader from './SiteHeader';
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
  const [selectedItem, setSelectedItem] = useState<PhysicalItem | null>(null);
  const [query, setQuery] = useState('');
  const filteredItems = items.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()));

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
          <SiteHeader whatsappContactUrl={whatsappContactUrl} activeCatalog="fisico" />
        </div>
      </header>

      <div className="page-content" style={{ maxWidth: 1240, margin: '0 auto', paddingLeft: 20, paddingRight: 20, paddingBottom: 80 }}>
        {/* Banner da loja parceira — mesmo tratamento visual do
            .reviews-banner do catálogo digital (ver globals.css), só com
            altura maior porque essa arte é um banner largo 3:1, não uma
            tira fina de avaliações. */}
        {bannerUrl && (
          <div className="physical-catalog-banner">
            <img src={bannerUrl} alt="Loja parceira" />
          </div>
        )}

        <div style={{ textAlign: 'center', margin: '18px 0 26px' }}>
          <p className="product-eyebrow" style={{ marginBottom: 4 }}>
            XAN Switch
          </p>
          <h1 style={{ fontFamily: "'Press Start 2P', cursive", fontSize: 18, color: 'var(--ink)', margin: 0 }}>
            📦 Produtos Físicos
          </h1>
          <p style={{ color: 'var(--ink-dim)', fontSize: 13.5, marginTop: 8, fontWeight: 700, letterSpacing: 0.4 }}>
            PÁGINA EM DESENVOLVIMENTO
          </p>
        </div>

        {/* Mesma busca do catálogo digital (ver .catalog-toolbar-search em
            CatalogClient.tsx) — aqui só com o campo de busca, já que os
            outros botões daquela barra (Filtros, avaliações, etc.) não se
            aplicam a esse catálogo ainda. */}
        <div className="catalog-toolbar" style={{ justifyContent: 'center', marginBottom: 22 }}>
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
        </div>

        {items.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--ink-dim)', fontSize: 14, padding: '40px 0' }}>
            Nenhum produto disponível no momento. Volte em breve!
          </p>
        ) : filteredItems.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--ink-dim)', fontSize: 14, padding: '40px 0' }}>
            Nenhum produto encontrado pra "{query}".
          </p>
        ) : (
          <div className="catalog-grid">
            {filteredItems.map((item) => (
              <PhysicalProductCard key={item.id} item={item} onSelect={() => openProduct(item)} />
            ))}
          </div>
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
      style={{
        textDecoration: 'none',
        color: 'inherit',
        cursor: 'pointer',
        background: 'none',
        border: 'none',
        padding: 0,
        textAlign: 'left',
        font: 'inherit',
        width: '100%'
      }}
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

      <div style={{ padding: '9px 2px 0', textAlign: 'center' }}>
        <p
          style={{
            fontWeight: 700,
            fontSize: 13.5,
            color: 'var(--ink)',
            margin: '0 0 3px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {item.name}
        </p>
        {item.originalPriceLabel && (
          <p
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: 12,
              fontWeight: 700,
              color: '#8b83a8',
              textDecoration: 'line-through',
              margin: '0 0 2px'
            }}
          >
            R$ {item.originalPriceLabel}
          </p>
        )}
        <p
          style={{
            fontFamily: "'Press Start 2P', cursive",
            fontSize: 12,
            color: 'var(--green)',
            textShadow: '0 0 8px var(--green-glow)',
            margin: 0
          }}
        >
          R$ {item.priceLabel}
        </p>
      </div>
    </div>
  );
}

// Popup de detalhes — bem mais simples que o modal de compra dos jogos
// digitais (PurchaseModal.tsx): sem etapas, sem pagamento, só a foto
// grande, nome, preço e descrição. A compra desses produtos ainda não
// acontece pelo site nessa primeira etapa.
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
        </div>
      </div>
    </div>
  );
}
