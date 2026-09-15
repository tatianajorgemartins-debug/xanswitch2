'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getContrastColor } from '@/lib/color';
import type { Platform, GameType } from '@/lib/db';
import {
  getCurrentUser,
  onAuthChange,
  getWishlistGameIds,
  addToWishlist,
  removeFromWishlist,
  getInstagramHandle
} from '@/lib/wishlist';
import SiteHeader from './SiteHeader';
import PromoSection from './PromoSection';
import ReviewsSection from './ReviewsSection';
import ReviewForm from './ReviewForm';
import PurchaseModal from './PurchaseModal';
import AccountModal from './AccountModal';
import BulkPurchaseModal from './BulkPurchaseModal';

export type Item = {
  id: number;
  name: string;
  price: number;
  priceLabel: string;
  originalPriceLabel: string | null;
  imageUrl: string | null;
  // Imagem separada pros banners largos (Destaque da semana / Mais
  // aguardados) — quando vazia, esses banners usam imageUrl (a capa
  // quadrada) como já faziam antes.
  bannerImageUrl: string | null;
  hasBadge: boolean;
  badgeText: string;
  badgeColor: string;
  franchise: string | null;
  platform: Platform;
  gameType: GameType;
  isBestseller: boolean;
  isUpcoming: boolean;
  description: string | null;
  screenshots: string[];
};

export type ReviewItem = {
  id: number;
  name: string;
  instagram: string | null;
  rating: number;
  comment: string;
  isFeatured: boolean;
};

type ViewMode = 'grid' | 'list';
type PlatformFilter = 'all' | 'switch1' | 'switch2';
type TypeFilter = 'all' | GameType;
type QuickFilter = 'bestseller' | 'upcoming' | null;

export default function CatalogClient({
  items,
  featuredItems,
  bestsellerItems,
  upcomingItems,
  mostWantedItems,
  reviews,
  whatsappContactUrl,
  initialGameId
}: {
  items: Item[];
  featuredItems: Item[];
  bestsellerItems: Item[];
  upcomingItems: Item[];
  // Os jogos mais favoritados do site inteiro (todos os clientes), do mais
  // pro menos desejado — calculado no servidor (app/page.tsx) a partir da
  // tabela wishlists do Supabase. Os 3 primeiros alimentam o carrossel
  // "❤️ Mais desejados" e os 4 primeiros a vitrine antes do catálogo
  // completo, mais abaixo.
  mostWantedItems: Item[];
  reviews: ReviewItem[];
  whatsappContactUrl: string | null;
  // Só vem preenchido quando a página é acessada pelo link direto de um
  // jogo (app/jogo/[id]/page.tsx) — abre o modal de compra desse jogo
  // assim que a página carrega, sem precisar clicar em nada.
  initialGameId?: number;
}) {
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [franchiseFilter, setFranchiseFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const gridAnchorRef = useRef<HTMLDivElement>(null);

  // Jogo clicado no momento (null = nenhum modal aberto). É só esse estado
  // que controla o modal de compra — abrir um jogo é simplesmente colocar o
  // Item aqui, fechar é voltar pra null.
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  // Abre o modal de compra E deixa o link da página (a URL no navegador)
  // apontando pro link direto desse jogo (/jogo/<id>) — assim, a qualquer
  // momento, a pessoa pode simplesmente copiar o link da barra de endereço
  // pra compartilhar aquele jogo específico. Usa replaceState (não
  // pushState) de propósito: só troca o que aparece na barra, sem criar
  // uma parada a mais no histórico — o botão "voltar" do navegador continua
  // se comportando exatamente como antes.
  function openGame(item: Item) {
    setSelectedItem(item);
    window.history.replaceState(null, '', `/jogo/${item.id}`);
  }
  function closeGame() {
    setSelectedItem(null);
    window.history.replaceState(null, '', '/');
  }

  // Quando a página é acessada pelo link direto de um jogo
  // (app/jogo/[id]/page.tsx), abre o modal dele sozinho ao carregar.
  useEffect(() => {
    if (initialGameId === undefined) return;
    const item = items.find((it) => it.id === initialGameId);
    if (item) setSelectedItem(item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGameId]);

  // Conta do cliente (login por e-mail) e lista de desejos dele. `user` fica
  // null enquanto ninguém logou. `wishlistIds` guarda só os ids dos jogos
  // favoritados, pra checar rapidinho (Set.has) se cada card deve mostrar o
  // coração preenchido ou vazio.
  const [user, setUser] = useState<User | null>(null);
  const [wishlistIds, setWishlistIds] = useState<Set<number>>(new Set());
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  // Jogos selecionados pra compra em lote (null = modal fechado) — disparado
  // a partir da lista de desejos, dentro do popup de conta.
  const [bulkPurchaseItems, setBulkPurchaseItems] = useState<Item[] | null>(null);
  // Mensagem de erro ao favoritar/desfavoritar (ex: banco de dados da lista
  // de desejos ainda não configurado). Sem isso, um erro aqui ficava
  // completamente invisível — o coração só "piscava" e voltava, sem
  // explicar o motivo.
  const [wishlistError, setWishlistError] = useState<string | null>(null);
  // Contagem de favoritos por jogo, buscada direto do navegador (não vem
  // mais só do servidor) — assim a vitrine "Mais desejados" reflete
  // favoritos/desfavoritos na hora, em vez de esperar o cache da página
  // (até 1h) expirar. Começa null e usa mostWantedItems (calculado no
  // servidor) como uma prévia, até a primeira busca terminar.
  const [wishlistCounts, setWishlistCounts] = useState<Record<number, number> | null>(null);
  // @ do Instagram de quem está logado (pra mostrar no botão "Minha conta"
  // do cabeçalho) — null enquanto não logou ou ainda não carregou.
  const [instagramHandle, setInstagramHandle] = useState<string | null>(null);

  function refreshWishlistCounts() {
    fetch('/api/wishlist-counts', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setWishlistCounts(data.counts ?? {}))
      .catch(() => {});
  }

  useEffect(() => {
    refreshWishlistCounts();
  }, []);

  useEffect(() => {
    function onScroll() {
      setShowBackToTop(window.scrollY > 400);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Checa quem está logado assim que a página carrega, e continua escutando
  // pra qualquer mudança (login, logout, ou o clique no link mágico do
  // e-mail confirmando o login em outra aba).
  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => {});
    return onAuthChange(setUser);
  }, []);

  // Sempre que alguém loga, busca a lista de desejos dela no Supabase. Ao
  // deslogar, some com a lista local também (senão ficaria mostrando os
  // favoritos de quem acabou de sair pra quem entrar depois no mesmo
  // navegador).
  useEffect(() => {
    if (!user) {
      setWishlistIds(new Set());
      return;
    }
    getWishlistGameIds()
      .then((ids) => setWishlistIds(new Set(ids)))
      .catch(() => {});
  }, [user]);

  // Mesma ideia, mas pro @ do Instagram — usado só pra decidir o texto do
  // botão de conta no cabeçalho (ver accountLabel mais abaixo).
  useEffect(() => {
    if (!user) {
      setInstagramHandle(null);
      return;
    }
    getInstagramHandle()
      .then(setInstagramHandle)
      .catch(() => {});
  }, [user]);

  // Alterna um jogo na lista de desejos. Se ninguém estiver logado, abre o
  // popup de login em vez de tentar salvar (não tem lista de desejos sem
  // conta). Atualiza o estado local na hora (otimista) pro coração responder
  // no mesmo clique, sem esperar a resposta do servidor.
  async function toggleWishlist(gameId: number) {
    if (!user) {
      setAccountModalOpen(true);
      return;
    }
    const alreadyIn = wishlistIds.has(gameId);
    setWishlistIds((prev) => {
      const next = new Set(prev);
      if (alreadyIn) next.delete(gameId);
      else next.add(gameId);
      return next;
    });
    try {
      if (alreadyIn) await removeFromWishlist(gameId);
      else await addToWishlist(gameId);
      // Atualiza a contagem de "mais desejados" na hora, refletindo esse
      // favorito/desfavorito — sem esperar o cache da página expirar.
      refreshWishlistCounts();
    } catch (err) {
      // Se der erro, desfaz a mudança otimista e mostra o motivo (ex: a
      // migração db/migration-wishlist.sql ainda não foi rodada no
      // Supabase) — sem isso, o coração só "piscava" sem explicar nada.
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (alreadyIn) next.add(gameId);
        else next.delete(gameId);
        return next;
      });
      setWishlistError(err instanceof Error ? err.message : 'Não foi possível salvar o favorito.');
    }
  }

  useEffect(() => {
    if (!wishlistError) return;
    const timer = setTimeout(() => setWishlistError(null), 6000);
    return () => clearTimeout(timer);
  }, [wishlistError]);

  const wishlistItems = useMemo(
    () => items.filter((it) => wishlistIds.has(it.id)),
    [items, wishlistIds]
  );

  // Enquanto a contagem buscada no navegador não chega, usa a prévia que já
  // veio pronta do servidor (mostWantedItems) — assim a vitrine não fica
  // vazia por um instante ao carregar a página.
  const liveMostWantedItems = useMemo(() => {
    if (!wishlistCounts) return mostWantedItems;
    return items
      .map((item) => ({ item, count: wishlistCounts[item.id] ?? 0 }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((entry) => entry.item);
  }, [items, wishlistCounts, mostWantedItems]);

  // Texto do botão de conta no cabeçalho: prioriza o @ do Instagram, depois
  // a inicial do e-mail, e só mostra "Minha conta" pra quem não está logado.
  const accountLabel = user ? (instagramHandle ? `@${instagramHandle}` : user.email?.charAt(0).toUpperCase() ?? 'Minha conta') : 'Minha conta';

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
      if (quickFilter === 'bestseller' && !it.isBestseller) return false;
      if (quickFilter === 'upcoming' && !it.isUpcoming) return false;
      return true;
    });
  }, [items, query, franchiseFilter, platformFilter, typeFilter, priceMin, priceMax, quickFilter]);

  const activeFilterCount =
    (franchiseFilter ? 1 : 0) +
    (platformFilter !== 'all' ? 1 : 0) +
    (typeFilter !== 'all' ? 1 : 0) +
    (priceMin.trim() ? 1 : 0) +
    (priceMax.trim() ? 1 : 0) +
    (quickFilter ? 1 : 0);

  // Verdadeiro sempre que a pessoa está filtrando ou buscando algo — usado
  // pra esconder a vitrine "Mais desejados" (que é uma sugestão pro
  // catálogo inteiro, não faz sentido junto de uma busca filtrada) e pra
  // decidir quando mostrar o botão de limpar tudo.
  const isFiltering = activeFilterCount > 0 || query.trim() !== '';

  function scrollToGrid() {
    gridAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleViewGame(name: string) {
    setQuery(name);
    scrollToGrid();
  }

  function handleFilterFlag(flag: 'bestseller' | 'upcoming') {
    setQuery('');
    setFranchiseFilter('');
    setPlatformFilter('all');
    setTypeFilter('all');
    setPriceMin('');
    setPriceMax('');
    setQuickFilter(flag);
    scrollToGrid();
  }

  function clearFilters() {
    setFranchiseFilter('');
    setPlatformFilter('all');
    setTypeFilter('all');
    setPriceMin('');
    setPriceMax('');
    setQuickFilter(null);
  }

  // Limpa filtros E a busca de uma vez — o botão "Limpar filtros" de dentro
  // do painel só limpava os filtros, deixando a busca de fora; esse aqui
  // fica na barra principal, sempre visível quando tem algo ativo.
  function clearEverything() {
    setQuery('');
    clearFilters();
  }

  return (
    <>
      <header className="site-header-bar">
        <div className="site-header-bar-inner">
          <SiteHeader
            whatsappContactUrl={whatsappContactUrl}
            wishlistCount={wishlistIds.size}
            accountLabel={accountLabel}
            onOpenAccount={() => setAccountModalOpen(true)}
          />
        </div>
      </header>

      <div className="page-content" style={{ maxWidth: 1200, margin: '0 auto', paddingLeft: 20, paddingRight: 20, paddingBottom: 80 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 18, marginBottom: 10 }}>
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
            style={{ background: 'none', border: 'none', padding: 0, width: '100%' }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpar busca"
              title="Limpar busca"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--ink-dim)',
                cursor: 'pointer',
                padding: 0,
                flex: 'none',
                display: 'flex'
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width={14} height={14}>
                <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" />
              </svg>
            </button>
          )}
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={14} height={14} style={{ flex: 'none' }}>
            <path d="M3 4h18l-7 8v7l-4-2v-5L3 4z" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>

        {isFiltering && (
          <button type="button" className="btn ghost" onClick={clearEverything}>
            ✕ Limpar tudo
          </button>
        )}

        <button type="button" className="btn ghost" onClick={() => setReviewFormOpen((v) => !v)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={14} height={14} style={{ flex: 'none' }}>
            <path d="M4 4h16v12H8l-4 4V4z" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          Deixe um comentário
        </button>
      </div>

      {reviewFormOpen && (
        <ReviewForm onSubmitted={() => setReviewFormOpen(false)} instagramHandle={instagramHandle} />
      )}

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

      <PromoSection
        featuredItems={featuredItems}
        mostWantedItems={liveMostWantedItems.slice(0, 3)}
        upcomingItems={upcomingItems}
        onViewGame={handleViewGame}
        onFilterFlag={handleFilterFlag}
      />

      <ReviewsSection reviews={reviews} />

      <div ref={gridAnchorRef} className="grid-anchor" />

      {quickFilter && (
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <span className="tag tag-platform" style={{ fontSize: 12, padding: '5px 12px', display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            Mostrando: {quickFilter === 'bestseller' ? 'Mais vendidos' : 'Mais aguardados'}
            <button
              type="button"
              onClick={() => setQuickFilter(null)}
              aria-label="Remover esse filtro"
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: 12, lineHeight: 1 }}
            >
              ✕
            </button>
          </span>
        </div>
      )}

      {!isFiltering && liveMostWantedItems.length > 0 && (
        <div className="most-wanted-section">
          <h2 className="most-wanted-heading">❤️ Mais desejados pelos clientes</h2>
          <div className="catalog-grid">
            {liveMostWantedItems.slice(0, 5).map((item, index) => (
              <div key={item.id} className={index === 4 ? 'most-wanted-fifth' : undefined}>
                <GameCard
                  item={item}
                  onSelect={() => openGame(item)}
                  wishlisted={wishlistIds.has(item.id)}
                  onToggleWishlist={() => toggleWishlist(item.id)}
                  rank={index < 3 ? index + 1 : undefined}
                />
              </div>
            ))}
          </div>
          <hr className="section-divider" />
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
            <GameCard
              key={item.id}
              item={item}
              onSelect={() => openGame(item)}
              wishlisted={wishlistIds.has(item.id)}
              onToggleWishlist={() => toggleWishlist(item.id)}
            />
          ))}
        </div>
      ) : (
        <div className="catalog-list">
          {filtered.map((item) => (
            <ListRow
              key={item.id}
              item={item}
              onSelect={() => openGame(item)}
              wishlisted={wishlistIds.has(item.id)}
              onToggleWishlist={() => toggleWishlist(item.id)}
            />
          ))}
        </div>
      )}

      {/* O modal de compra só existe na tela quando um jogo foi clicado.
          Ele fica fora do fluxo normal da página (position: fixed no CSS),
          então não bagunça o layout do catálogo por trás dele. */}
      {selectedItem && <PurchaseModal item={selectedItem} onClose={closeGame} />}

      {/* Popup de login/conta — mesma lógica: só existe na tela quando
          aberto, fica por cima de tudo via position: fixed. */}
      <AccountModal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        user={user}
        wishlistItems={wishlistItems}
        onOpenGame={openGame}
        onRemoveFromWishlist={toggleWishlist}
        onBulkPurchase={setBulkPurchaseItems}
        onInstagramSaved={setInstagramHandle}
      />

      {/* Compra em lote de vários jogos da lista de desejos de uma vez —
          disparada de dentro do popup de conta (ver onBulkPurchase acima). */}
      {bulkPurchaseItems && (
        <BulkPurchaseModal items={bulkPurchaseItems} onClose={() => setBulkPurchaseItems(null)} />
      )}

      {wishlistError && (
        <div className="toast-error" role="alert">
          Não foi possível salvar o favorito: {wishlistError}
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
    </>
  );
}

// Cores do 1º, 2º e 3º lugar da vitrine de mais desejados — em vez de
// ouro/prata/bronze "de verdade" (que destoava do resto do site), usa as
// mesmas cores que o site já usa pra "destaque" (verde), marca (roxo) e
// desejo (rosa), com o mesmo tipo de brilho que já aparece em outros
// lugares (preço, capa em hover).
const RANK_BADGE_STYLE: Record<number, { background: string; color: string; glow: string }> = {
  1: { background: 'var(--green)', color: '#07230c', glow: 'var(--green-glow)' },
  2: { background: 'var(--purple)', color: '#fff', glow: 'var(--purple-glow)' },
  3: { background: 'var(--wishlist-pink)', color: '#fff', glow: 'var(--wishlist-pink-glow)' }
};

function GameCard({
  item,
  onSelect,
  wishlisted,
  onToggleWishlist,
  rank
}: {
  item: Item;
  onSelect: () => void;
  wishlisted: boolean;
  onToggleWishlist: () => void;
  // Posição no ranking de mais desejados (1, 2 ou 3) — só é passado pros
  // 3 primeiros cards da vitrine "Mais desejados", em nenhum outro lugar
  // do catálogo.
  rank?: number;
}) {
  const rankStyle = rank ? RANK_BADGE_STYLE[rank] : undefined;
  return (
    // Esse card precisa conter DOIS elementos clicáveis (o card inteiro, que
    // abre o modal de compra, e o coração de favoritar) — HTML não permite
    // um <button> dentro de outro <button>, então o card virou uma <div>
    // com role="button" (pra continuar acessível: leitor de tela anuncia
    // como botão, e o teclado consegue ativar com Enter/Espaço).
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
        width: '100%',
        position: 'relative'
      }}
    >
      <div className="cover-frame">
        <button
          type="button"
          className={`wishlist-heart-button${wishlisted ? ' active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist();
          }}
          aria-label={wishlisted ? `Remover ${item.name} da lista de desejos` : `Adicionar ${item.name} à lista de desejos`}
          title={wishlisted ? 'Remover dos desejos' : 'Adicionar aos desejos'}
        >
          <svg viewBox="0 0 24 24" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" width={16} height={16}>
            <path d="M12 20.5s-7.5-4.6-10-9.3C.5 7.8 2.3 4.5 5.6 4c2-.3 3.9.6 5 2.3a5.3 5.3 0 015-2.3c3.3.5 5.1 3.8 3.6 7.2-2.5 4.7-10 9.3-10 9.3z" strokeLinejoin="round" />
          </svg>
        </button>

        {rankStyle && (
          <div
            style={{
              position: 'absolute',
              bottom: 7,
              left: 7,
              zIndex: 2,
              padding: '3px 7px',
              borderRadius: 6,
              background: rankStyle.background,
              color: rankStyle.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'Press Start 2P', cursive",
              fontSize: 9,
              boxShadow: `0 0 8px ${rankStyle.glow}`
            }}
            title={`${rank}º lugar entre os mais desejados`}
          >
            {rank}º
          </div>
        )}

        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
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
    </div>
  );
}

const PLATFORM_TAG_LABEL: Record<Platform, string> = {
  switch1: 'Switch',
  switch2: 'Switch 2',
  both: 'Switch 1 e 2'
};

const GAME_TYPE_TAG_LABEL: Partial<Record<GameType, string>> = {
  dlc: 'DLC',
  update: 'Atualização'
};

function ListRow({
  item,
  onSelect,
  wishlisted,
  onToggleWishlist
}: {
  item: Item;
  onSelect: () => void;
  wishlisted: boolean;
  onToggleWishlist: () => void;
}) {
  const typeLabel = GAME_TYPE_TAG_LABEL[item.gameType];
  const platformLabel = PLATFORM_TAG_LABEL[item.platform];
  // Avoid showing the same word twice when the seller's own badge already
  // says it (e.g. a "SWITCH 2" badge next to a "Switch 2" platform tag).
  const platformRedundant =
    item.hasBadge && item.badgeText.trim().toLowerCase() === platformLabel.toLowerCase();

  return (
    // Mesmo motivo do GameCard: precisa de um coração clicável dentro da
    // linha, então a linha virou uma <div role="button"> em vez de <button>.
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
      className="list-row"
    >
      <button
        type="button"
        className={`wishlist-heart-button list-row-heart${wishlisted ? ' active' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleWishlist();
        }}
        aria-label={wishlisted ? `Remover ${item.name} da lista de desejos` : `Adicionar ${item.name} à lista de desejos`}
        title={wishlisted ? 'Remover dos desejos' : 'Adicionar aos desejos'}
      >
        <svg viewBox="0 0 24 24" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" width={16} height={16}>
          <path d="M12 20.5s-7.5-4.6-10-9.3C.5 7.8 2.3 4.5 5.6 4c2-.3 3.9.6 5 2.3a5.3 5.3 0 015-2.3c3.3.5 5.1 3.8 3.6 7.2-2.5 4.7-10 9.3-10 9.3z" strokeLinejoin="round" />
        </svg>
      </button>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span
          style={{
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {item.hasBadge && (
            <span className="tag" style={{ background: item.badgeColor, color: getContrastColor(item.badgeColor) }}>
              {item.badgeText}
            </span>
          )}
          {!platformRedundant && <span className="tag tag-platform">{platformLabel}</span>}
          {typeLabel && <span className="tag tag-type">{typeLabel}</span>}
        </div>
      </div>
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
    </div>
  );
}
