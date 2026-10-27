'use client';

import { startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
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
import { useDesignVariant } from './DesignVariant';
import { scrollToResults } from './scrollToResults';
import { fallbackToOriginal, IMAGE_SIZES, imageSrcSet } from '@/lib/imageVariants';
import { afterPageLoad } from '@/lib/afterPageLoad';

// Os popups só baixam depois que o catálogo já está na tela (logo em
// seguida, em segundo plano — ver preloadModals): assim não atrasam a
// primeira abertura do site, e quando a pessoa clica já estão prontos.
const PurchaseModal = dynamic(() => import('./PurchaseModal'), { ssr: false });
const AccountModal = dynamic(() => import('./AccountModal'), { ssr: false });
const BulkPurchaseModal = dynamic(() => import('./BulkPurchaseModal'), { ssr: false });
// Na abertura do site só os primeiros cards do catálogo vêm prontos (são os
// únicos que dá pra ver sem rolar); o resto entra logo depois que a página
// aparece, em segundo plano. Deixa a página bem mais leve pra abrir.
const INITIAL_CARDS = 12;

// Os 5 jogos com mais favoritos (vitrine "Mais desejados"). Mesma conta
// feita no servidor em lib/catalogData.ts.
function topWanted(items: Item[], countOf: (id: number) => number): Item[] {
  return items
    .map((item) => ({ item, count: countOf(item.id) }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((entry) => entry.item);
}

// Baixa a capa de um card (no mesmo tamanho que o card usa) e espera
// terminar — no máximo 3 s, pra nunca travar nada.
function preloadCardImage(url: string | null | undefined): Promise<void> {
  if (!url) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    const done = () => resolve();
    img.onload = done;
    img.onerror = done;
    setTimeout(done, 3000);
    img.sizes = IMAGE_SIZES.card;
    img.srcset = imageSrcSet(url) ?? '';
    img.src = url;
  });
}

function preloadModals() {
  return afterPageLoad(() => {
    import('./PurchaseModal');
    import('./AccountModal');
    import('./BulkPurchaseModal');
  });
}

export type Item = {
  id: number;
  name: string;
  price: number;
  priceLabel: string;
  originalPriceLabel: string | null;
  // Em promoção (preço promocional do admin menor que o normal) — ver
  // toItem em lib/catalogData.ts. salePercent é o desconto arredondado.
  isOnSale: boolean;
  salePercent: number | null;
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
  // Link de pagamento parcelado (crédito), configurado manualmente no admin
  // pra esse jogo — quando presente, a tela de compra mostra dois botões em
  // vez de um só (ver StepSummary em PurchaseModal.tsx).
  creditPaymentUrl: string | null;
  // Quantos pontos o card colecionável desse jogo vale (1 a 5), configurado
  // no admin — ver CollectibleCard.tsx.
  cardPoints: number;
  // Se esse jogo aceita desconto de fidelidade (troca de pontos), marcado
  // no admin — ver a etapa de pagamento em PurchaseModal.tsx.
  discountEligible: boolean;
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
type SortMode = 'relevance' | 'price-asc' | 'price-desc';
type Shortcut = { kind: 'all' } | { kind: 'switch2' } | { kind: 'franchise'; name: string } | { kind: 'others' };

// Atalhos acima do catálogo ("Todos", "Switch 2", as franquias com mais
// jogos e "Outros"). Só franquias com pelo menos 2 jogos viram atalho.
const SHORTCUT_FRANCHISES = 6;
const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'relevance', label: 'Relevância' },
  { value: 'price-asc', label: 'Menor preço' },
  { value: 'price-desc', label: 'Maior preço' }
];

function shortcutKey(shortcut: Shortcut): string {
  return shortcut.kind === 'franchise' ? `franchise:${shortcut.name}` : shortcut.kind;
}

const INTRO_TITLE_WORDS = [
  { text: 'Jogos' },
  { text: 'digitais' },
  { text: 'de' },
  { text: 'Nintendo', key: true },
  { text: 'Switch', key: true }
];

export default function CatalogClient({
  items,
  featuredItems,
  bestsellerItems,
  upcomingItems,
  mostWantedItems,
  reviews,
  whatsappContactUrl,
  reviewsBannerUrl,
  featuredFranchise,
  initialGameId,
  initialFranchiseFilter
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
  // Imagem do banner fino que substitui as avaliações na página principal —
  // null enquanto não subir nada no admin (ver ReviewsBannerPanel). As
  // avaliações em si continuam existindo, atrás do botão "Ver avaliações".
  reviewsBannerUrl: string | null;
  // Botão de franquia em destaque (ex: "🔥 Jogos de Zelda"), configurado no
  // admin — null quando desativado. Aparece do lado de "Ver avaliações" e,
  // ao clicar, filtra o catálogo pra essa franquia (ver
  // FeaturedFranchisePanel em AdminClient.tsx).
  featuredFranchise: { franchise: string; label: string } | null;
  // Só vem preenchido quando a página é acessada pelo link direto de um
  // jogo (app/jogo/[id]/page.tsx) — abre o modal de compra desse jogo
  // assim que a página carrega, sem precisar clicar em nada.
  initialGameId?: number;
  // Só vem preenchido quando a página é acessada pelo link direto de uma
  // franquia (app/franquia/[name]/page.tsx) — já filtra o catálogo pra essa
  // franquia ao carregar, sem precisar clicar em nada.
  initialFranchiseFilter?: string;
}) {
  const isRedesign = useDesignVariant() === 'redesign';
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Só importa no celular (≤700px, ver .catalog-toolbar-extra em
  // globals.css) — no computador os botões ficam sempre visíveis, esse
  // estado nem é consultado pelo CSS daquele breakpoint pra cima.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [reviewsModalOpen, setReviewsModalOpen] = useState(false);
  const [franchiseFilter, setFranchiseFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [saleOnly, setSaleOnly] = useState(false);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null);
  // "Outros" dos atalhos: jogos de franquias que não têm atalho próprio.
  const [otherFranchises, setOtherFranchises] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('relevance');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const gridAnchorRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

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

  useEffect(preloadModals, []);

  const [renderAllCards, setRenderAllCards] = useState(false);
  useEffect(() => {
    startTransition(() => setRenderAllCards(true));
  }, []);

  // Quando a página é acessada pelo link direto de um jogo
  // (app/jogo/[id]/page.tsx), abre o modal dele sozinho ao carregar.
  useEffect(() => {
    if (initialGameId === undefined) return;
    const item = items.find((it) => it.id === initialGameId);
    if (item) setSelectedItem(item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGameId]);

  // Mesma ideia, mas pro link direto de uma franquia
  // (app/franquia/[name]/page.tsx) — já filtra o catálogo sozinho ao
  // carregar. scrollToGrid é declarado mais abaixo nesse mesmo componente,
  // mas já existe aqui por causa do hoisting normal de function declaration.
  useEffect(() => {
    if (!initialFranchiseFilter) return;
    setFranchiseFilter(initialFranchiseFilter);
    scrollToGrid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFranchiseFilter]);

  // Conta do cliente (login por e-mail) e lista de desejos dele. `user` fica
  // null enquanto ninguém logou. `wishlistIds` guarda só os ids dos jogos
  // favoritados, pra checar rapidinho (Set.has) se cada card deve mostrar o
  // coração preenchido ou vazio.
  const [user, setUser] = useState<User | null>(null);
  const [wishlistIds, setWishlistIds] = useState<Set<number>>(new Set());
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  // "Minha conta" no catálogo de produtos físicos leva pra cá com ?conta=1
  // (ver accountHref em PhysicalCatalogClient.tsx) — abre o popup sozinho e
  // limpa o endereço.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('conta') !== '1') return;
    setAccountModalOpen(true);
    params.delete('conta');
    const query = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : ''));
  }, []);
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
      .then(async (data) => {
        const counts: Record<number, number> = data.counts ?? {};
        // Se a vitrine "Mais desejados" vai mudar (entrou outro jogo), baixa
        // a capa dele antes de trocar — senão o card novo aparecia vazio e
        // a capa só chegava um instante depois.
        const shown = new Set(liveMostWantedRef.current.map((item) => item.id));
        const incoming = topWanted(items, (id) => counts[id] ?? 0).filter((item) => !shown.has(item.id));
        await Promise.all(incoming.map((item) => preloadCardImage(item.imageUrl)));
        setWishlistCounts(counts);
      })
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
  // e-mail confirmando o login em outra aba). Só depois que a página
  // carregou (lib/afterPageLoad.ts): o login não precisa estar pronto pra
  // pessoa ver o catálogo.
  useEffect(() => {
    let stopListening = () => {};
    const cancel = afterPageLoad(() => {
      getCurrentUser()
        .then(setUser)
        .catch(() => {});
      stopListening = onAuthChange(setUser);
    });
    return () => {
      cancel();
      stopListening();
    };
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
    return topWanted(items, (id) => wishlistCounts[id] ?? 0);
  }, [items, wishlistCounts, mostWantedItems]);
  const liveMostWantedRef = useRef(liveMostWantedItems);
  liveMostWantedRef.current = liveMostWantedItems;

  // Texto do botão de conta no cabeçalho: prioriza o @ do Instagram, depois
  // a inicial do e-mail, e só mostra "Minha conta" pra quem não está logado.
  // No visual novo é sempre "Minha conta", logado ou não.
  const accountLabel =
    isRedesign || !user
      ? 'Minha conta'
      : instagramHandle
        ? `@${instagramHandle}`
        : user.email?.charAt(0).toUpperCase() ?? 'Minha conta';

  const franchises = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.franchise) set.add(it.franchise);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [items]);

  const shortcutFranchises = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((it) => {
      if (it.franchise) counts.set(it.franchise, (counts.get(it.franchise) ?? 0) + 1);
    });
    return Array.from(counts)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
      .slice(0, SHORTCUT_FRANCHISES)
      .map(([name, count]) => ({ name, count }));
  }, [items]);
  const shortcutNames = useMemo(() => new Set(shortcutFranchises.map((f) => f.name)), [shortcutFranchises]);
  const shortcuts = useMemo(() => {
    const switch2 = items.filter((it) => it.platform === 'switch2' || it.platform === 'both').length;
    const others = items.filter((it) => !it.franchise || !shortcutNames.has(it.franchise)).length;
    const list: { label: string; count: number; shortcut: Shortcut }[] = [
      { label: 'Todos', count: items.length, shortcut: { kind: 'all' } }
    ];
    if (switch2 > 0) list.push({ label: 'Switch 2', count: switch2, shortcut: { kind: 'switch2' } });
    shortcutFranchises.forEach((f) => list.push({ label: f.name, count: f.count, shortcut: { kind: 'franchise', name: f.name } }));
    if (others > 0) list.push({ label: 'Outros', count: others, shortcut: { kind: 'others' } });
    return list;
  }, [items, shortcutFranchises, shortcutNames]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = priceMin.trim() ? parseFloat(priceMin.replace(',', '.')) : null;
    const max = priceMax.trim() ? parseFloat(priceMax.replace(',', '.')) : null;
    const result = items.filter((it) => {
      if (q && !it.name.toLowerCase().includes(q)) return false;
      if (franchiseFilter && it.franchise !== franchiseFilter) return false;
      if (otherFranchises && it.franchise && shortcutNames.has(it.franchise)) return false;
      if (platformFilter !== 'all' && it.platform !== platformFilter && it.platform !== 'both') {
        return false;
      }
      if (typeFilter !== 'all' && it.gameType !== typeFilter) return false;
      if (min !== null && !Number.isNaN(min) && it.price < min) return false;
      if (max !== null && !Number.isNaN(max) && it.price > max) return false;
      if (saleOnly && !it.isOnSale) return false;
      if (quickFilter === 'bestseller' && !it.isBestseller) return false;
      if (quickFilter === 'upcoming' && !it.isUpcoming) return false;
      return true;
    });
    if (sortMode === 'relevance') return result;
    const direction = sortMode === 'price-asc' ? 1 : -1;
    return [...result].sort((a, b) => (a.price - b.price) * direction);
  }, [
    items,
    query,
    franchiseFilter,
    otherFranchises,
    shortcutNames,
    platformFilter,
    typeFilter,
    priceMin,
    priceMax,
    saleOnly,
    quickFilter,
    sortMode
  ]);
  const visibleItems = renderAllCards ? filtered : filtered.slice(0, INITIAL_CARDS);

  const activeFilterCount =
    (franchiseFilter ? 1 : 0) +
    (platformFilter !== 'all' ? 1 : 0) +
    (typeFilter !== 'all' ? 1 : 0) +
    (priceMin.trim() ? 1 : 0) +
    (priceMax.trim() ? 1 : 0) +
    (saleOnly ? 1 : 0) +
    (otherFranchises ? 1 : 0) +
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

  // Botão de franquia em destaque (ver render mais abaixo) — mesma lógica
  // de handleFilterFlag, só que filtrando por franquia em vez de "mais
  // vendido"/"mais aguardado".
  function handleFranchiseHighlight(franchise: string) {
    setQuery('');
    setPlatformFilter('all');
    setTypeFilter('all');
    setPriceMin('');
    setPriceMax('');
    setQuickFilter(null);
    setFranchiseFilter(franchise);
    scrollToGrid();
  }

  function clearFilters() {
    setFranchiseFilter('');
    setPlatformFilter('all');
    setTypeFilter('all');
    setPriceMin('');
    setPriceMax('');
    setSaleOnly(false);
    setOtherFranchises(false);
    setQuickFilter(null);
  }

  // Atalho clicado: troca só a franquia/plataforma (busca e outros filtros
  // continuam). Clicar no atalho que já está ativo volta pra "Todos". Como a
  // vitrine "Mais desejados" (acima) some/volta ao filtrar, segura a linha
  // dos atalhos no mesmo lugar da tela, sem a página pular.
  const activeShortcut = otherFranchises
    ? 'others'
    : franchiseFilter
      ? `franchise:${franchiseFilter}`
      : platformFilter === 'switch2'
        ? 'switch2'
        : 'all';
  const shortcutAnchor = useRef<number | null>(null);
  function selectShortcut(shortcut: Shortcut) {
    const next: Shortcut = shortcutKey(shortcut) === activeShortcut ? { kind: 'all' } : shortcut;
    shortcutAnchor.current = resultsRef.current?.getBoundingClientRect().top ?? null;
    setFranchiseFilter(next.kind === 'franchise' ? next.name : '');
    setPlatformFilter(next.kind === 'switch2' ? 'switch2' : 'all');
    setOtherFranchises(next.kind === 'others');
    setQuickFilter(null);
  }
  useLayoutEffect(() => {
    const before = shortcutAnchor.current;
    shortcutAnchor.current = null;
    if (before === null || !resultsRef.current) return;
    const shift = resultsRef.current.getBoundingClientRect().top - before;
    if (Math.abs(shift) > 1) window.scrollBy(0, shift);
  });

  // Limpa filtros E a busca de uma vez — o botão "Limpar filtros" de dentro
  // do painel só limpava os filtros, deixando a busca de fora; esse aqui
  // fica na barra principal, sempre visível quando tem algo ativo.
  function clearEverything() {
    setQuery('');
    clearFilters();
  }

  // Enter na busca (ou o botão "PESQUISAR"): desce até "X jogos
  // disponíveis", com os resultados logo abaixo do cabeçalho. Tirar o foco
  // do campo fecha o teclado no celular, pra deixar os resultados à vista.
  function submitSearch() {
    scrollToResults(resultsRef.current, searchInputRef.current);
  }

  // "Limpar filtro" ao lado de "X jogos disponíveis": limpa busca e filtros
  // e volta pro topo da página.
  function clearAndScrollTop() {
    clearEverything();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  return (
    <>
      {/* viewTransitionName: deixa o cabeçalho FORA do crossfade da troca de
          catálogo (ver <ViewTransition> em page.tsx) — sem isso, ele
          esmaecia/dava um leve zoom junto com o resto da página, e os
          elementos pareciam "pular" de lugar por um instante. Ver a regra
          ::view-transition-group(site-header) em globals.css. */}
      <header className="site-header-bar" style={{ viewTransitionName: 'site-header' }}>
        <div className="site-header-bar-inner">
          <SiteHeader
            whatsappContactUrl={whatsappContactUrl}
            wishlistCount={wishlistIds.size}
            accountLabel={accountLabel}
            onOpenAccount={() => setAccountModalOpen(true)}
            activeCatalog="digital"
          />
        </div>
      </header>

      {/* maxWidth 1240 (não 1200) de propósito: com os 20px de padding dos
          dois lados, a largura útil do conteúdo continua 1200px — mas essa
          combinação é o que faz a margem esquerda bater exatamente com a
          do cabeçalho fixo (.site-header-bar-inner), que usa padding 20px
          num container de largura cheia por fora de um maxWidth 1200 por
          dentro. As duas contas davam 20px de diferença uma da outra antes
          disso, o que ficava visível na barra de botões logo abaixo. */}
      <div className="page-content" style={{ maxWidth: 1240, margin: '0 auto', paddingLeft: 20, paddingRight: 20, paddingBottom: 80 }}>
        {isRedesign && (
          <section className="catalog-intro">
            {/* Uma palavra por <span> pra animação de entrada palavra por
                palavra (ver SiteMotion.tsx); sem animação, fica igual. */}
            <h1 className="catalog-intro-title">
              {INTRO_TITLE_WORDS.map((word, i) => (
                <span key={i}>
                  {i > 0 && ' '}
                  <span className={`motion-word${word.key ? ' is-key' : ''}`} style={{ '--i': i } as React.CSSProperties}>
                    {word.text}
                  </span>
                </span>
              ))}
            </h1>
            <p className="catalog-intro-lead">
              Pague no Pix e receba o código do jogo. Cada compra vale um card colecionável e pontos pra trocar por
              desconto.
            </p>
          </section>
        )}
        <div className="catalog-toolbar">
        <div className="catalog-toolbar-search">
          <svg className="catalog-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width={16} height={16} style={{ color: 'var(--ink-dim)', flex: 'none' }} aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Buscar jogo..."
            value={query}
            enterKeyHint="search"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitSearch();
              }
            }}
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
          {/* Aparece enquanto o campo está em foco (ver
              .catalog-search-submit no CSS). O onMouseDown evita que o campo
              perca o foco antes do clique — sem isso o botão sumiria no meio
              do clique e ele não contaria. */}
          <button
            type="button"
            className="catalog-search-submit"
            onMouseDown={(e) => e.preventDefault()}
            onClick={submitSearch}
          aria-label="Pesquisar"
          >
            <span className="catalog-search-submit-label">PESQUISAR</span>
            <svg className="catalog-search-submit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" width={17} height={17} aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>

        {/* Só aparece no celular (≤700px) — abre/fecha o grupo de botões
            "secundários" logo abaixo (.catalog-toolbar-extra). No
            computador esse botão fica escondido via CSS, porque lá esses
            botões já aparecem direto na barra. */}
        <button
          type="button"
          className="btn ghost catalog-toolbar-menu-btn"
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label={mobileMenuOpen ? 'Fechar mais opções' : 'Mais opções'}
          aria-expanded={mobileMenuOpen}
        >
          {isRedesign && (
            <span className="catalog-toolbar-menu-label" aria-hidden="true">
              MENU
            </span>
          )}
          {mobileMenuOpen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width={16} height={16}>
              <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width={16} height={16}>
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            </svg>
          )}
        </button>

        {featuredFranchise && (
          <button
            type="button"
            className="btn featured-franchise-btn"
            onClick={() => handleFranchiseHighlight(featuredFranchise.franchise)}
          >
            {featuredFranchise.label}
          </button>
        )}

        <div className={`catalog-toolbar-extra${mobileMenuOpen ? ' is-open' : ''}`}>
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

          <button type="button" className="btn ghost" onClick={() => setReviewFormOpen((v) => !v)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={14} height={14} style={{ flex: 'none' }}>
              <path d="M4 4h16v12H8l-4 4V4z" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            Deixe um comentário
          </button>

          <button type="button" className="btn ghost" onClick={() => setReviewsModalOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={14} height={14} style={{ flex: 'none' }}>
              <path d="M12 17.3l-5.4 3 1.4-6-4.6-4 6-.5L12 4l2.6 5.8 6 .5-4.6 4 1.4 6z" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            Ver avaliações
          </button>
        </div>
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
          <label className="filter-sale-toggle" htmlFor="filter-sale-only">
            <input
              id="filter-sale-only"
              type="checkbox"
              checked={saleOnly}
              onChange={(e) => setSaleOnly(e.target.checked)}
            />
            <span>Só jogos em promoção</span>
          </label>
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

      {reviewsBannerUrl && (
        <div className="reviews-banner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={reviewsBannerUrl}
            srcSet={imageSrcSet(reviewsBannerUrl, 1600)}
            sizes="(max-width: 640px) 68vw, (max-width: 1240px) 100vw, 1200px"
            onError={fallbackToOriginal}
            alt=""
          />
        </div>
      )}

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
          <h2 className="most-wanted-heading">{isRedesign ? 'Os mais desejados' : '❤️ Mais desejados pelos clientes'}</h2>
          <div className="catalog-grid">
            {liveMostWantedItems.slice(0, 5).map((item, index) => (
              <div key={item.id} className={index === 4 ? 'most-wanted-fifth' : undefined}>
                <GameCard
                  item={item}
                  onSelect={() => openGame(item)}
                  wishlisted={wishlistIds.has(item.id)}
                  onToggleWishlist={() => toggleWishlist(item.id)}
                  rank={index < 3 ? index + 1 : undefined}
                  eager={index < 4}
                />
              </div>
            ))}
          </div>
          <hr className="section-divider" />
        </div>
      )}

      {/* min-height (ver .catalog-results no CSS): mesmo com poucos
          resultados, sobra página pra rolar o título até o topo. */}
      <div ref={resultsRef} className="catalog-results">
      <div className="catalog-count-row">
        <p className="catalog-count">
          <span className="catalog-count-number">{filtered.length}</span>{' '}
          {filtered.length === 1 ? 'jogo disponível' : 'jogos disponíveis'}
        </p>
        {isFiltering && (
          <button type="button" className="btn ghost catalog-clear-filter" onClick={clearAndScrollTop}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width={13} height={13} aria-hidden="true">
              <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" />
            </svg>
            Limpar filtro
          </button>
        )}
        {isRedesign && (
          <div className="catalog-sort" role="group" aria-label="Ordenar">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={sortMode === option.value ? 'active' : undefined}
                aria-pressed={sortMode === option.value}
                onClick={() => setSortMode(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {isRedesign && items.length > 0 && (
        <div className="catalog-shortcuts" role="group" aria-label="Atalhos de filtro">
          {shortcuts.map(({ label, count, shortcut }) => {
            const active = shortcutKey(shortcut) === activeShortcut;
            return (
              <button
                key={shortcutKey(shortcut)}
                type="button"
                className={`catalog-shortcut${active ? ' active' : ''}`}
                aria-pressed={active}
                onClick={() => selectShortcut(shortcut)}
              >
                {label}
                <span className="catalog-shortcut-count">{count}</span>
              </button>
            );
          })}
        </div>
      )}

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
          {visibleItems.map((item) => (
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
          {visibleItems.map((item) => (
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
      </div>

      {/* O modal de compra só existe na tela quando um jogo foi clicado.
          Ele fica fora do fluxo normal da página (position: fixed no CSS),
          então não bagunça o layout do catálogo por trás dele. */}
      {selectedItem && (
        <PurchaseModal
          item={selectedItem}
          user={user}
          onClose={closeGame}
          onViewCollection={() => {
            closeGame();
            setAccountModalOpen(true);
          }}
        />
      )}

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
        <BulkPurchaseModal
          items={bulkPurchaseItems}
          user={user}
          onClose={() => setBulkPurchaseItems(null)}
          onViewCollection={() => {
            setBulkPurchaseItems(null);
            setAccountModalOpen(true);
          }}
        />
      )}

      {/* Popup com as avaliações, aberto pelo botão "Ver avaliações" — o
          mesmo conteúdo que antes ficava fixo na página, só que agora atrás
          de um clique, pra dar lugar ao banner de pontos ali em cima. */}
      {reviewsModalOpen && (
        <div className="purchase-modal-overlay" onClick={() => setReviewsModalOpen(false)}>
          <div
            className="purchase-modal is-reviews-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Avaliações dos clientes"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="purchase-modal-header">
              <span className="purchase-modal-title">Avaliações dos clientes</span>
              <button
                type="button"
                className="purchase-modal-close"
                onClick={() => setReviewsModalOpen(false)}
                aria-label="Fechar"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width={18} height={18}>
                  <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="purchase-modal-body">
              {reviews.length > 0 ? (
                <ReviewsSection reviews={reviews} />
              ) : (
                <p style={{ textAlign: 'center', color: 'var(--ink-dim)', fontWeight: 600, padding: '20px 0' }}>
                  Ainda não temos avaliações por aqui.
                </p>
              )}
            </div>
          </div>
        </div>
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

      <p className="site-footer-line">
        XAN SWITCH — Nintendo mais barato
        <span aria-hidden="true"> · </span>
        <a href="/privacidade">Política de privacidade</a>
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
  rank,
  eager
}: {
  item: Item;
  onSelect: () => void;
  wishlisted: boolean;
  onToggleWishlist: () => void;
  // Posição no ranking de mais desejados (1, 2 ou 3) — só é passado pros
  // 3 primeiros cards da vitrine "Mais desejados", em nenhum outro lugar
  // do catálogo.
  rank?: number;
  // Cards que já aparecem na abertura do site (os primeiros "mais
  // desejados"): a capa começa a baixar junto com a página, sem esperar.
  eager?: boolean;
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
      className="game-card"
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
            className="game-card-rank"
            style={
              {
                background: rankStyle.background,
                color: rankStyle.color,
                '--rank-glow': rankStyle.glow
              } as React.CSSProperties
            }
            title={`${rank}º lugar entre os mais desejados`}
          >
            {rank}º
          </div>
        )}

        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            srcSet={imageSrcSet(item.imageUrl)}
            sizes={IMAGE_SIZES.card}
            onError={fallbackToOriginal}
            alt={item.name}
            loading={eager ? 'eager' : 'lazy'}
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

        {item.isOnSale && (
          <div className="game-card-sale" title={`Em promoção: ${item.salePercent}% de desconto`}>
            PROMO -{item.salePercent}%
          </div>
        )}

        {item.hasBadge && (
          <div
            className="game-card-badge"
            style={{ background: item.badgeColor, color: getContrastColor(item.badgeColor) }}
          >
            {item.badgeText}
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
        <span className="list-row-name">{item.name}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {item.hasBadge && (
            <span className="tag" style={{ background: item.badgeColor, color: getContrastColor(item.badgeColor) }}>
              {item.badgeText}
            </span>
          )}
          {!platformRedundant && <span className="tag tag-platform">{platformLabel}</span>}
          {typeLabel && <span className="tag tag-type">{typeLabel}</span>}
          {item.isOnSale && <span className="tag tag-sale">PROMO -{item.salePercent}%</span>}
        </div>
      </div>
      <span style={{ flex: 'none', textAlign: 'right' }}>
        {item.originalPriceLabel && <span className="list-row-old-price">R$ {item.originalPriceLabel}</span>}
        <span className="list-row-price">R$ {item.priceLabel}</span>
      </span>
    </div>
  );
}
