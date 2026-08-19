'use client';

import { useEffect, useMemo, useState } from 'react';
import { getContrastColor } from '@/lib/color';
import type { Platform, GameType } from '@/lib/db';

type Item = {
  id: number;
  name: string;
  price: number;
  priceLabel: string;
  originalPriceLabel: string | null;
  imageUrl: string | null;
  hasBadge: boolean;
  badgeText: string;
  badgeColor: string;
  franchise: string | null;
  platform: Platform;
  gameType: GameType;
  whatsappUrl: string;
};

type ViewMode = 'grid' | 'list';
type PlatformFilter = 'all' | 'switch1' | 'switch2';
type TypeFilter = 'all' | GameType;

export default function CatalogClient({ items }: { items: Item[] }) {
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [franchiseFilter, setFranchiseFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    function onScroll() {
      setShowBackToTop(window.scrollY > 400);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const franchises = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.franchise) set.add(it.franchise);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = priceMin.trim() ? parseFloat(priceMin.replace(',', '.')) : null;
    const max = priceMax.trim() ? parseFloat(priceMax.replace(',', '.')) : null;
    return items.filter((it) => {
      if (q && !it.name.toLowerCase().includes(q)) return false;
      if (franchiseFilter && it.franchise !== franchiseFilter) return false;
      if (platformFilter !== 'all' && it.platform !== platformFilter && it.platform !== 'both') {
        return false;
      }
      if (typeFilter !== 'all' && it.gameType !== typeFilter) return false;
      if (min !== null && !Number.isNaN(min) && it.price < min) return false;
      if (max !== null && !Number.isNaN(max) && it.price > max) return false;
      return true;
    });
  }, [items, query, franchiseFilter, platformFilter, typeFilter, priceMin, priceMax]);

  const activeFilterCount =
    (franchiseFilter ? 1 : 0) +
    (platformFilter !== 'all' ? 1 : 0) +
    (typeFilter !== 'all' ? 1 : 0) +
    (priceMin.trim() ? 1 : 0) +
    (priceMax.trim() ? 1 : 0);

  function clearFilters() {
    setFranchiseFilter('');
    setPlatformFilter('all');
    setTypeFilter('all');
    setPriceMin('');
    setPriceMax('');
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px 80px' }}>
      <header style={{ marginBottom: 22, textAlign: 'center' }}>
        <div className="brand">
          XAN<span>SWITCH</span>
        </div>
        <p style={{ color: 'var(--ink-dim)', fontSize: 14.5, fontWeight: 600, margin: '6px 0 0' }}>
          Clique no jogo que você quer e a conversa já abre no WhatsApp, prontinha pra fechar o
          pedido.
        </p>
      </header>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--panel)',
            border: '1px solid rgba(164,99,255,.3)',
            borderRadius: 10,
            padding: '10px 14px',
            flex: '1 1 260px',
            maxWidth: 420
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width={16} height={16} style={{ color: 'var(--ink-dim)', flex: 'none' }}>
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar jogo..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ background: 'none', border: 'none', width: '100%' }}
          />
        </div>

        <div className="view-toggle">
          <button
            type="button"
            className={viewMode === 'grid' ? 'active' : ''}
            onClick={() => setViewMode('grid')}
            aria-label="Ver em grade"
            title="Grade"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width={16} height={16}>
              <rect x="3" y="3" width="8" height="8" rx="1.5" />
              <rect x="13" y="3" width="8" height="8" rx="1.5" />
              <rect x="3" y="13" width="8" height="8" rx="1.5" />
              <rect x="13" y="13" width="8" height="8" rx="1.5" />
            </svg>
          </button>
          <button
            type="button"
            className={viewMode === 'list' ? 'active' : ''}
            onClick={() => setViewMode('list')}
            aria-label="Ver em lista"
            title="Lista"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width={16} height={16}>
              <rect x="3" y="4.5" width="18" height="3" rx="1.2" />
              <rect x="3" y="10.5" width="18" height="3" rx="1.2" />
              <rect x="3" y="16.5" width="18" height="3" rx="1.2" />
            </svg>
          </button>
        </div>

        <button type="button" className="btn ghost" onClick={() => setFiltersOpen((v) => !v)}>
          🎚 Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
      </div>

      {filtersOpen && (
        <div className="filters-panel">
          <div>
            <label htmlFor="filter-franchise">Franquia</label>
            <select
              id="filter-franchise"
              value={franchiseFilter}
              onChange={(e) => setFranchiseFilter(e.target.value)}
            >
              <option value="">Todas</option>
              {franchises.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-platform">Plataforma</label>
            <select
              id="filter-platform"
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value as PlatformFilter)}
            >
              <option value="all">Todas</option>
              <option value="switch1">Nintendo Switch</option>
              <option value="switch2">Nintendo Switch 2</option>
            </select>
          </div>
          <div>
            <label htmlFor="filter-type">Tipo</label>
            <select
              id="filter-type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            >
              <option value="all">Todos</option>
              <option value="base">Jogo base</option>
              <option value="dlc">DLC</option>
              <option value="update">Atualização</option>
            </select>
          </div>
          <div>
            <label htmlFor="filter-price-min">Preço de</label>
            <input
              id="filter-price-min"
              type="text"
              inputMode="decimal"
              placeholder="R$ 0"
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="filter-price-max">Preço até</label>
            <input
              id="filter-price-max"
              type="text"
              inputMode="decimal"
              placeholder="R$ 999"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
            />
          </div>
          {activeFilterCount > 0 && (
            <button type="button" className="btn ghost" onClick={clearFilters} style={{ alignSelf: 'end' }}>
              ✕ Limpar filtros
            </button>
          )}
        </div>
      )}

      <p
        style={{
          textAlign: 'center',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: 'var(--ink-dim)',
          margin: '0 0 22px'
        }}
      >
        <span style={{ color: 'var(--green)' }}>{filtered.length}</span> jogos disponíveis
      </p>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-dim)' }}>
          <p style={{ fontSize: 15, fontWeight: 600 }}>
            {items.length === 0
              ? 'Nenhum jogo disponível no momento. Volte em breve!'
              : 'Nenhum jogo encontrado com esses filtros.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="catalog-grid">
          {filtered.map((item) => (
            <GameCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="catalog-list">
          {filtered.map((item) => (
            <ListRow key={item.id} item={item} />
          ))}
        </div>
      )}

      {showBackToTop && (
        <button
          type="button"
          className="back-to-top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Voltar ao topo"
          title="Voltar ao topo"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width={20} height={20}>
            <path d="M12 19V5" />
            <path d="M5 12l7-7 7 7" />
          </svg>
        </button>
      )}

      <p
        style={{
          textAlign: 'center',
          color: 'var(--ink-dim)',
          fontSize: 12.5,
          fontWeight: 600,
          marginTop: 50
        }}
      >
        XAN SWITCH — Nintendo mais barato
      </p>
    </div>
  );
}

function GameCard({ item }: { item: Item }) {
  return (
    <a
      href={item.whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
    >
      <div className="cover-frame">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ink-dim)'
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="26%">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}

        {item.hasBadge && (
          <div
            style={{
              position: 'absolute',
              top: -2,
              left: '6%',
              background: item.badgeColor,
              color: getContrastColor(item.badgeColor),
              fontFamily: "'Press Start 2P', cursive",
              fontSize: 8,
              padding: '4px 8px',
              maxWidth: '70%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              clipPath: 'polygon(0 0, 100% 0, 92% 100%, 0% 100%)'
            }}
          >
            {item.badgeText}
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
    </a>
  );
}

function ListRow({ item }: { item: Item }) {
  return (
    <a href={item.whatsappUrl} target="_blank" rel="noopener noreferrer" className="list-row">
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontWeight: 700,
          fontSize: 15,
          color: 'var(--ink)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {item.name}
      </span>
      <span style={{ flex: 'none', textAlign: 'right' }}>
        {item.originalPriceLabel && (
          <span
            style={{
              display: 'block',
              fontSize: 11.5,
              fontWeight: 700,
              color: '#8b83a8',
              textDecoration: 'line-through'
            }}
          >
            R$ {item.originalPriceLabel}
          </span>
        )}
        <span
          style={{
            fontFamily: "'Press Start 2P', cursive",
            fontSize: 11,
            color: 'var(--green)',
            textShadow: '0 0 8px var(--green-glow)'
          }}
        >
          R$ {item.priceLabel}
        </span>
      </span>
    </a>
  );
}
