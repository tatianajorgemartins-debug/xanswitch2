'use client';

import { useMemo, useRef, useState, useEffect, useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { uploadToSignedTicket } from '@/lib/supabaseBrowser';
import type { Game, Review, Order } from '@/lib/db';
import { getContrastColor } from '@/lib/color';
import { formatPriceBR } from '@/lib/whatsapp';
import { gamePrice, priceWithFee } from '@/lib/gamePrice';
import { compressImageFile } from '@/lib/imageCompression';
import { buildDeliveryHtml, buildDeliverySubject, buildDeliveryWhatsAppText } from '@/lib/deliveryEmail';
import { formatWhatsApp } from '@/lib/validation';
import { normalizeStatus, saleProfit } from '@/lib/sales';
import SalesPanel from './SalesPanel';
import PromoEventsPanel from './PromoEventsPanel';
import type { PromoEventRow } from '@/lib/promoEvents';
import { setSalesStatusAction } from './salesActions';
import './admin.css';
import {
  createGameAction,
  updateGameAction,
  archiveGameAction,
  deleteGameAction,
  logoutAction,
  approveReviewAction,
  deleteReviewAction,
  setReviewFeaturedAction,
  deleteOrderAction,
  confirmOrderPointsAction,
  sendGameCodeAction,
  markCodeSentByWhatsAppAction,
  adjustClientPointsAction,
  updateReviewsBannerAction,
  removeReviewsBannerAction,
  updateLoyaltyDiscountAmountAction,
  updatePaymentFeesAction,
  createManualDiscountCreditAction,
  updateFeaturedFranchiseAction,
  createPrivateOfferAction,
  setPrivateOfferActiveAction,
  type GameFormState
} from './actions';

const emptyFormState: GameFormState = { error: null };

const TAB_IDS = ['inicio', 'pedidos', 'vendas', 'jogos', 'promocoes', 'clientes', 'comentarios', 'divulgacao', 'config'] as const;
type TabId = (typeof TAB_IDS)[number];

export default function AdminClient({
  initialGames,
  visitCount,
  reviews,
  orders,
  stalledSplits,
  wishlistCounts,
  pointAdjustmentTotals,
  availableDiscountCreditTotals,
  reviewsBannerUrl,
  discountAmount,
  featuredFranchiseEnabled,
  featuredFranchiseName,
  featuredFranchiseLabel,
  paymentFees,
  privateOffers,
  promoEvents
}: {
  initialGames: Game[];
  visitCount: number;
  reviews: Review[];
  orders: Order[];
  stalledSplits: StalledSplit[];
  wishlistCounts: Record<number, number>;
  pointAdjustmentTotals: Record<string, number>;
  availableDiscountCreditTotals: Record<string, number>;
  reviewsBannerUrl: string | null;
  discountAmount: number;
  featuredFranchiseEnabled: boolean;
  featuredFranchiseName: string;
  featuredFranchiseLabel: string;
  paymentFees: { card: number; pix: number };
  privateOffers: PrivateOfferRow[] | null;
  // null = tabela ainda não existe (falta rodar db/migration-eventos-promocao.sql).
  promoEvents: PromoEventRow[] | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  // Seção aberta do painel. Fica no endereço (#vendas, #jogos...) pra
  // continuar na mesma seção depois de atualizar a página.
  const [tab, setTab] = useState<TabId>('inicio');
  useEffect(() => {
    const fromHash = window.location.hash.slice(1) as TabId;
    if (TAB_IDS.includes(fromHash)) setTab(fromHash);
  }, []);
  // No celular a barra de seções rola pro lado: mantém a aberta à vista.
  useEffect(() => {
    document.querySelector('.adm-nav-btn.is-active')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [tab]);
  function goTo(id: TabId) {
    setTab(id);
    window.history.replaceState(null, '', `#${id}`);
    window.scrollTo({ top: 0 });
  }
  // Vendas pagas que ainda esperam a chave (o resto já está concluído).
  const pendingOrders = useMemo(() => orders.filter((o) => normalizeStatus(o.status) === 'aguardando_codigo'), [orders]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);

  const games = initialGames;

  const activeGames = useMemo(
    () =>
      games
        .filter((g) => !g.archived)
        .filter((g) => g.name.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [games, query]
  );
  const archivedGames = useMemo(
    () => games.filter((g) => g.archived).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [games]
  );
  const allFranchises = useMemo(() => {
    const set = new Set<string>();
    games.forEach((g) => {
      if (g.franchise) set.add(g.franchise);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [games]);

  function openAddPanel() {
    setEditingGame(null);
    setPanelOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function openEditPanel(game: Game) {
    setEditingGame(game);
    setPanelOpen(true);
    // O formulário abre no topo da página — sem isso, editar um jogo mais
    // pra baixo na lista abria o formulário fora da tela, obrigando a
    // rolar manualmente pra cima pra vê-lo.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function closePanel() {
    setPanelOpen(false);
    setEditingGame(null);
  }

  async function handleArchive(id: number, archived: boolean) {
    await archiveGameAction(id, archived);
    router.refresh();
  }
  async function handleDelete(id: number, name: string) {
    if (!confirm(`Excluir "${name}" do catálogo? Essa ação não pode ser desfeita.`)) return;
    await deleteGameAction(id);
    router.refresh();
  }

  async function handleApproveReview(id: number) {
    await approveReviewAction(id);
    router.refresh();
  }
  async function handleDeleteReview(id: number) {
    if (!confirm('Excluir essa avaliação?')) return;
    await deleteReviewAction(id);
    router.refresh();
  }
  async function handleToggleFeaturedReview(id: number, featured: boolean) {
    await setReviewFeaturedAction(id, featured);
    router.refresh();
  }
  async function handleDeleteOrder(id: number) {
    if (!confirm('Remover este pedido do histórico?')) return;
    await deleteOrderAction(id);
    router.refresh();
  }
  async function handleConfirmOrderPoints(id: number, confirmed: boolean) {
    await confirmOrderPointsAction(id, confirmed);
    router.refresh();
  }

  const pendingReviewCount = useMemo(() => reviews.filter((r) => !r.approved).length, [reviews]);

  // Ranking de "mais desejados" — cruza a contagem que vem do Supabase
  // (wishlistCounts, um total por game_id) com os dados do jogo em si
  // (nome, capa, preço), que ficam no Neon. Só entram jogos com pelo menos
  // 1 favorito, do mais pro menos desejado.
  const mostWantedGames = useMemo(() => {
    return games
      .map((g) => ({ game: g, count: wishlistCounts[g.id] ?? 0 }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [games, wishlistCounts]);

  // Um resumo por cliente (e-mail), pra tela "🎖️ Clientes" — soma os pontos
  // confirmados e pendentes de cada um (incluindo ajustes manuais feitos
  // aqui no admin) e lista os jogos que já levou. Calculado direto da lista
  // de pedidos que já veio pronta do servidor — não precisa de outra
  // consulta ao banco só pra isso.
  const clientSummaries = useMemo(() => {
    const byEmail = new Map<
      string,
      {
        email: string;
        confirmedPoints: number;
        pendingPoints: number;
        availableCredit: number;
        games: string[];
        lastPurchaseAt: string;
        pendingOrders: { id: number; gameName: string; points: number; createdAt: string }[];
        cards: { id: number; gameName: string; imageUrl: string | null; points: number; confirmed: boolean; createdAt: string }[];
      }
    >();
    for (const o of orders) {
      if (!o.customer_email) continue;
      const key = o.customer_email.toLowerCase();
      // .toISOString() (não .toString()) de propósito: o Postgres devolve
      // created_at como um Date de verdade, e Date.toString() começa com o
      // dia da semana ("Sat Oct 17..."), que não ordena cronologicamente
      // como texto — isso fazia "mais recente primeiro" sair tudo errado
      // (parecia aleatório). ISO ("2026-10-17T...") ordena certinho como
      // string comum, sem precisar converter pra número em cada comparação.
      const createdAt = new Date(o.created_at).toISOString();
      const entry =
        byEmail.get(key) ??
        {
          email: o.customer_email,
          confirmedPoints: 0,
          pendingPoints: 0,
          availableCredit: 0,
          games: [],
          lastPurchaseAt: createdAt,
          pendingOrders: [],
          cards: []
        };
      // orders já vem do servidor ordenado do mais recente pro mais antigo
      // (ver getAllOrders) — o primeiro pedido que achamos de cada
      // cliente já é o mais recente dele.
      if (createdAt > entry.lastPurchaseAt) entry.lastPurchaseAt = createdAt;
      if (o.card_points_earned > 0) {
        if (o.card_points_confirmed) {
          entry.confirmedPoints += o.card_points_earned;
        } else {
          entry.pendingPoints += o.card_points_earned;
          entry.pendingOrders.push({
            id: o.id,
            gameName: o.game_name,
            points: o.card_points_earned,
            createdAt
          });
        }
        entry.games.push(o.game_name);
        entry.cards.push({
          id: o.id,
          gameName: o.game_name,
          imageUrl: o.card_image_url,
          points: o.card_points_earned,
          confirmed: o.card_points_confirmed,
          createdAt
        });
      }
      byEmail.set(key, entry);
    }
    for (const [key, adjustment] of Object.entries(pointAdjustmentTotals)) {
      const entry = byEmail.get(key);
      if (entry) entry.confirmedPoints += adjustment;
    }
    for (const [key, credit] of Object.entries(availableDiscountCreditTotals)) {
      const entry = byEmail.get(key);
      if (entry) entry.availableCredit = credit;
    }
    return Array.from(byEmail.values())
      .filter((c) => c.games.length > 0)
      .sort((a, b) => (a.lastPurchaseAt < b.lastPurchaseAt ? 1 : -1));
  }, [orders, pointAdjustmentTotals, availableDiscountCreditTotals]);

  // Painel do mês na tela inicial (vendas que não foram canceladas).
  const monthStats = useMemo(() => {
    const month = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);
    let count = 0;
    let revenue = 0;
    let profit = 0;
    let withCost = 0;
    for (const o of orders) {
      if (normalizeStatus(o.status) === 'cancelado') continue;
      if (new Date(o.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7) !== month) continue;
      count++;
      revenue += parseFloat(o.price) || 0;
      const p = saleProfit(o);
      if (p !== null) {
        profit += p;
        withCost++;
      }
    }
    return { count, revenue, profit, withCost };
  }, [orders]);

  const tabs: { id: TabId; icon: string; label: string; badge?: number }[] = [
    { id: 'inicio', icon: '🏠', label: 'Início' },
    { id: 'pedidos', icon: '📦', label: 'Pedidos a entregar', badge: pendingOrders.length },
    { id: 'vendas', icon: '📊', label: 'Controle de vendas' },
    { id: 'jogos', icon: '🎮', label: 'Jogos do catálogo' },
    { id: 'promocoes', icon: '🏷️', label: 'Promoções e eventos' },
    { id: 'clientes', icon: '🎖️', label: 'Clientes e pontos' },
    { id: 'comentarios', icon: '💬', label: 'Comentários', badge: pendingReviewCount },
    { id: 'divulgacao', icon: '📣', label: 'Divulgação' },
    { id: 'config', icon: '⚙️', label: 'Configurações' }
  ];

  return (
    <div className="adm-shell">
      <aside className="adm-side">
        <div className="adm-brand">
          <div className="brand">
            XAN<span>SWITCH</span>
          </div>
          <span className="adm-brand-sub">Painel da loja</span>
        </div>
        <nav className="adm-nav" aria-label="Seções do painel">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`adm-nav-btn${tab === t.id ? ' is-active' : ''}`}
              onClick={() => goTo(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
            >
              <span aria-hidden="true">{t.icon}</span>
              <span className="adm-nav-label">{t.label}</span>
              {t.badge ? <span className="adm-badge">{t.badge}</span> : null}
            </button>
          ))}
        </nav>
        <div className="adm-side-foot">
          <a href="/" target="_blank" rel="noreferrer" className="adm-side-link">
            🔗 Abrir a loja
          </a>
          <form action={logoutAction}>
            <button type="submit" className="adm-side-link">
              ↩ Sair do painel
            </button>
          </form>
        </div>
      </aside>

      <main className="adm-main">
        {tab === 'inicio' && (
          <section>
            <div className="adm-section-head">
              <div>
                <h2>Olá! 👋</h2>
                <p className="adm-help">Aqui está o resumo da loja. Clique em qualquer cartão pra ir direto pra seção.</p>
              </div>
            </div>

            <div className="adm-home-grid">
              <button type="button" className={`adm-home-card${pendingOrders.length ? ' is-alert' : ''}`} onClick={() => goTo('pedidos')}>
                <span className="adm-home-icon">📦</span>
                <strong>{pendingOrders.length}</strong>
                <span>{pendingOrders.length === 1 ? 'pedido pra entregar' : 'pedidos pra entregar'}</span>
                <small>{pendingOrders.length ? 'Enviar as chaves →' : 'Tudo entregue 🎉'}</small>
              </button>
              <button type="button" className="adm-home-card" onClick={() => goTo('vendas')}>
                <span className="adm-home-icon">📊</span>
                <strong>{monthStats.count}</strong>
                <span>vendas este mês</span>
                <small>R$ {formatPriceBR(monthStats.revenue)} faturados</small>
              </button>
              <button type="button" className="adm-home-card is-profit" onClick={() => goTo('vendas')}>
                <span className="adm-home-icon">💰</span>
                <strong>{monthStats.withCost ? `R$ ${formatPriceBR(monthStats.profit)}` : '—'}</strong>
                <span>de lucro este mês</span>
                <small>
                  {monthStats.count - monthStats.withCost > 0
                    ? `${monthStats.count - monthStats.withCost} venda(s) sem custo informado`
                    : 'Custos em dia ✓'}
                </small>
              </button>
              <button type="button" className={`adm-home-card${pendingReviewCount ? ' is-alert' : ''}`} onClick={() => goTo('comentarios')}>
                <span className="adm-home-icon">💬</span>
                <strong>{pendingReviewCount}</strong>
                <span>{pendingReviewCount === 1 ? 'comentário esperando aprovação' : 'comentários esperando aprovação'}</span>
                <small>{pendingReviewCount ? 'Revisar →' : 'Nada pendente'}</small>
              </button>
              <div className="adm-home-card is-static">
                <span className="adm-home-icon">👁</span>
                <strong>{visitCount}</strong>
                <span>visitas na loja</span>
                <small>sem contar você</small>
              </div>
              <button type="button" className="adm-home-card" onClick={() => goTo('jogos')}>
                <span className="adm-home-icon">🎮</span>
                <strong>{games.filter((g) => !g.archived).length}</strong>
                <span>jogos no catálogo</span>
                <small>{archivedGames.length} arquivados</small>
              </button>
            </div>

            <h3 className="adm-subtitle">Atalhos</h3>
            <div className="adm-shortcuts">
              <button type="button" className="btn primary" onClick={() => { goTo('jogos'); openAddPanel(); }}>
                ＋ Adicionar jogo
              </button>
              <button type="button" className="btn ghost" onClick={() => goTo('vendas')}>
                ＋ Lançar venda feita fora do site
              </button>
              <button type="button" className="btn ghost" onClick={() => goTo('promocoes')}>
                🏷️ Criar promoção (Black Friday etc.)
              </button>
              <button type="button" className="btn ghost" onClick={() => goTo('divulgacao')}>
                🔗 Criar link exclusivo pra um cliente
              </button>
            </div>
          </section>
        )}

        {tab === 'pedidos' && (
          <section>
            <div className="adm-section-head">
              <div>
                <h2>📦 Pedidos a entregar</h2>
                <p className="adm-help">
                  Vendas pagas que ainda esperam a chave do jogo. Clique em <strong>Preparar</strong>, cole a chave e
                  envie: a venda é marcada como concluída sozinha e vai pro <strong>Controle de vendas</strong>.
                </p>
              </div>
            </div>
            <OrdersPanel orders={pendingOrders} stalledSplits={stalledSplits} onDelete={handleDeleteOrder} />
          </section>
        )}

        {tab === 'vendas' && <SalesPanel orders={orders} games={games} />}

        {tab === 'jogos' && (
          <section>
            <div className="adm-section-head">
              <div>
                <h2>🎮 Jogos do catálogo</h2>
                <p className="adm-help">
                  Tudo que aparece na loja. Clique num jogo pra editar preço, capa e detalhes. <strong>Arquivar</strong>{' '}
                  esconde o jogo da loja sem apagar (dá pra trazer de volta depois).
                </p>
              </div>
              <div className="adm-head-actions">
                <button className="btn primary" onClick={openAddPanel}>
                  ＋ Adicionar jogo
                </button>
                <button className="btn ghost" onClick={() => setShowArchived((s) => !s)}>
                  📦 Arquivados ({archivedGames.length})
                </button>
                <a href="/admin/produtos-fisicos" className="btn ghost">
                  📦 Produtos físicos
                </a>
              </div>
            </div>

            <div className="adm-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width={16} height={16} aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input type="search" placeholder="Buscar jogo pelo nome..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>

            {panelOpen && (
              <GameFormPanel
                game={editingGame}
                allFranchises={allFranchises}
                onClose={closePanel}
                onSaved={() => { closePanel(); router.refresh(); }}
              />
            )}

            {showArchived && (
              <div className="adm-card admin-panel">
                <h3>Jogos arquivados</h3>
                {archivedGames.length === 0 ? (
                  <p className="adm-empty">Nenhum jogo arquivado.</p>
                ) : (
                  archivedGames.map((g) => (
                    <div key={g.id} className="adm-archived-row">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={g.image_url || ''} alt="" loading="lazy" />
                      <span>{g.name}</span>
                      <button className="btn ghost" onClick={() => handleArchive(g.id, false)}>
                        ↺ Voltar pra loja
                      </button>
                      <button className="btn ghost" onClick={() => handleDelete(g.id, g.name)} aria-label={`Excluir ${g.name}`}>
                        🗑
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeGames.length === 0 ? (
              <p className="adm-empty">
                {query ? 'Nenhum jogo com esse nome.' : 'Nenhum jogo ainda. Clique em "＋ Adicionar jogo" pra começar.'}
              </p>
            ) : (
              <div className="adm-games-grid">
                {activeGames.map((g) => (
                  <AdminGameCard
                    key={g.id}
                    game={g}
                    onEdit={() => openEditPanel(g)}
                    onArchive={() => handleArchive(g.id, true)}
                    onDelete={() => handleDelete(g.id, g.name)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'promocoes' && <PromoEventsPanel games={games} events={promoEvents} />}

        {tab === 'clientes' && (
          <section>
            <div className="adm-section-head">
              <div>
                <h2>🎖️ Clientes e pontos</h2>
                <p className="adm-help">
                  Cada cliente que comprou com e-mail, com os cards e pontos de fidelidade. Confirme aqui os pontos de
                  compras que você conferiu, ou dê pontos/desconto na mão.
                </p>
              </div>
            </div>
            <ClientsPanel
              clients={clientSummaries}
              onConfirmPoints={handleConfirmOrderPoints}
              onDeleteCard={handleDeleteOrder}
              discountAmount={discountAmount}
            />
          </section>
        )}

        {tab === 'comentarios' && (
          <section>
            <div className="adm-section-head">
              <div>
                <h2>💬 Comentários</h2>
                <p className="adm-help">
                  Avaliações que os clientes deixaram. Elas só aparecem na loja depois que você <strong>aprova</strong>;
                  a ⭐ coloca a avaliação em destaque.
                </p>
              </div>
            </div>
            <ReviewsPanel
              reviews={reviews}
              onApprove={handleApproveReview}
              onDelete={handleDeleteReview}
              onToggleFeatured={handleToggleFeaturedReview}
            />
          </section>
        )}

        {tab === 'divulgacao' && (
          <section>
            <div className="adm-section-head">
              <div>
                <h2>📣 Divulgação</h2>
                <p className="adm-help">Ferramentas pra vender mais: links com preço especial, destaques na loja e o que o público mais quer.</p>
              </div>
            </div>
            <div className="adm-stack">
              <div className="adm-block">
                <PrivateOffersPanel games={initialGames} offers={privateOffers} />
              </div>
              <div className="adm-block">
                <FeaturedFranchisePanel
                  allFranchises={allFranchises}
                  enabled={featuredFranchiseEnabled}
                  franchise={featuredFranchiseName}
                  label={featuredFranchiseLabel}
                />
              </div>
              <div className="adm-block">
                <ReviewsBannerPanel currentUrl={reviewsBannerUrl} />
              </div>
              <div className="adm-block">
                <WishlistPanel entries={mostWantedGames} />
              </div>
            </div>
          </section>
        )}

        {tab === 'config' && (
          <section>
            <div className="adm-section-head">
              <div>
                <h2>⚙️ Configurações</h2>
                <p className="adm-help">Ajustes que você mexe de vez em quando.</p>
              </div>
            </div>
            <div className="adm-stack">
              <div className="adm-card">
                <PaymentFeesForm initial={paymentFees} />
              </div>
              <div className="adm-card">
                <h3>🧪 Outras páginas</h3>
                <div className="adm-shortcuts">
                  <a href="/admin/produtos-fisicos" className="btn ghost">
                    📦 Produtos físicos
                  </a>
                  <a href="/admin/teste" className="btn ghost">
                    🧪 Página de teste
                  </a>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}


function AdminGameCard({
  game,
  onEdit,
  onArchive,
  onDelete
}: {
  game: Game;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <div className="cover-frame">
        {!game.franchise && (
          <div
            title="Sem franquia definida"
            style={{
              position: 'absolute',
              top: 6,
              left: 6,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#ffb14e',
              boxShadow: '0 0 6px rgba(255,177,78,.7)',
              border: '1px solid rgba(10,7,20,.6)',
              zIndex: 4
            }}
          />
        )}
        {game.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.image_url}
            alt={game.name}
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

        {game.has_badge && (
          <div
            style={{
              position: 'absolute',
              top: -2,
              left: '6%',
              background: game.badge_color,
              color: getContrastColor(game.badge_color),
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
            {game.badge_text}
          </div>
        )}

        <button
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: 'rgba(10,7,20,.75)',
            border: '1px solid rgba(255,255,255,.25)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width={15} height={15}>
            <circle cx="12" cy="5" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="12" cy="19" r="1.8" />
          </svg>
        </button>

        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              top: 36,
              right: 6,
              background: 'var(--panel-2)',
              border: '1px solid rgba(164,99,255,.4)',
              borderRadius: 10,
              padding: 6,
              zIndex: 5,
              minWidth: 150,
              boxShadow: '0 10px 30px rgba(0,0,0,.5)'
            }}
          >
            <MenuButton
              onClick={() => {
                setMenuOpen(false);
                onEdit();
              }}
            >
              ✎ Editar
            </MenuButton>
            <MenuButton
              onClick={() => {
                setMenuOpen(false);
                onArchive();
              }}
            >
              📦 Arquivar
            </MenuButton>
            <MenuButton
              danger
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
            >
              🗑 Excluir
            </MenuButton>
          </div>
        )}
      </div>
      <div style={{ padding: '9px 2px 0', textAlign: 'center' }}>
        <p style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {game.name}
        </p>
        {game.original_price && parseFloat(game.original_price) > parseFloat(game.price) && (
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
            R$ {parseFloat(game.original_price).toFixed(2).replace('.', ',')}
          </p>
        )}
        <p style={{ fontFamily: "'Press Start 2P', cursive", fontSize: 12, color: 'var(--green)', textShadow: '0 0 8px var(--green-glow)', margin: 0 }}>
          R$ {parseFloat(game.price).toFixed(2).replace('.', ',')}
        </p>
        {game.promo_price && parseFloat(game.promo_price) < parseFloat(game.price) && (
          <p
            style={{
              display: 'inline-block',
              margin: '6px 0 0',
              padding: '3px 8px',
              borderRadius: 6,
              background: 'var(--gold)',
              color: '#2b1a00',
              fontSize: 12,
              fontWeight: 800
            }}
          >
            🏷️ PROMO R$ {parseFloat(game.promo_price).toFixed(2).replace('.', ',')}
          </p>
        )}
        {/* Evento de promoção valendo agora (🏷️ Promoções e eventos). */}
        {game.promo_event && (
          <p
            style={{
              display: 'inline-block',
              margin: '6px 0 0',
              padding: '3px 8px',
              borderRadius: 6,
              background: game.promo_event.tagColor,
              color: getContrastColor(game.promo_event.tagColor),
              boxShadow: '0 0 0 1px rgba(255,255,255,.2)',
              fontSize: 12,
              fontWeight: 800
            }}
          >
            {game.promo_event.tagText} R$ {formatPriceBR(game.promo_event.price)}
          </p>
        )}
      </div>
    </div>
  );
}

function MenuButton({
  children,
  onClick,
  danger
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: danger ? '#ff8a8a' : 'var(--ink)',
        textAlign: 'left',
        padding: '9px 10px',
        borderRadius: 6,
        fontFamily: "'Rajdhani',sans-serif",
        fontWeight: 600,
        fontSize: 13.5,
        cursor: 'pointer',
        width: '100%'
      }}
    >
      {children}
    </button>
  );
}

function StarsDisplay({ rating }: { rating: number }) {
  return (
    <span style={{ color: '#ffd24e', fontSize: 14, letterSpacing: 1 }}>
      {'★'.repeat(rating)}
      <span style={{ color: 'rgba(255,255,255,.2)' }}>{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

function FeaturedToggleButton({
  featured,
  onClick
}: {
  featured: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="btn ghost"
      onClick={onClick}
      title={featured ? 'Remover destaque' : 'Marcar como comentário destaque'}
      style={featured ? { borderColor: '#ffd24e', color: '#ffd24e' } : undefined}
    >
      {featured ? '★ Destacado' : '☆ Destacar'}
    </button>
  );
}

// Taxas do Mercado Pago repassadas ao cliente (ver lib/paymentFees.ts): o
// site cobra preço ÷ (1 − taxa) no cartão/Pix, pra sobrar o preço inteiro
// do jogo depois que o Mercado Pago desconta a parte dele.
// --- Links exclusivos: um jogo com preço especial, num link só pra quem
// você mandar (app/oferta/[token]/page.tsx). ---
type PrivateOfferRow = {
  token: string;
  gameId: number;
  price: number;
  note: string | null;
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
};

const SITE_URL = 'https://www.xanswitch.com.br';

function offerUrl(token: string): string {
  return `${SITE_URL}/oferta/${token}`;
}

function offerStatus(o: PrivateOfferRow): { label: string; live: boolean } {
  if (!o.active) return { label: 'Desativado', live: false };
  if (o.expiresAt && new Date(o.expiresAt) <= new Date()) return { label: 'Vencido', live: false };
  if (o.maxUses !== null && o.uses >= o.maxUses) return { label: 'Usado', live: false };
  return { label: 'Ativo', live: true };
}

function PrivateOffersPanel({ games, offers }: { games: Game[]; offers: PrivateOfferRow[] | null }) {
  const router = useRouter();
  const activeGames = useMemo(
    () => games.filter((g) => !g.archived).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [games]
  );
  const [gameId, setGameId] = useState<number | ''>('');
  const [priceInput, setPriceInput] = useState('');
  const [maxUsesInput, setMaxUsesInput] = useState('1');
  const [daysInput, setDaysInput] = useState('7');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const selectedGame = activeGames.find((g) => g.id === gameId) ?? null;
  const gameById = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);

  function copy(token: string) {
    navigator.clipboard
      .writeText(offerUrl(token))
      .then(() => {
        setCopied(token);
        setTimeout(() => setCopied(null), 2000);
      })
      .catch(() => {});
  }

  async function handleCreate() {
    if (gameId === '') {
      setError('Escolha o jogo.');
      return;
    }
    setSaving(true);
    setError(null);
    setCreated(null);
    const maxUses = maxUsesInput.trim() === '' || maxUsesInput.trim() === '0' ? null : Number(maxUsesInput);
    const days = daysInput.trim() === '' || daysInput.trim() === '0' ? null : Number(daysInput.replace(',', '.'));
    const result = await createPrivateOfferAction(gameId, Number(priceInput.replace(',', '.')), maxUses, days, note);
    setSaving(false);
    if (result.error || !result.token) {
      setError(result.error ?? 'Não foi possível criar o link.');
      return;
    }
    setCreated(result.token);
    copy(result.token);
    setPriceInput('');
    setNote('');
    router.refresh();
  }

  async function toggle(o: PrivateOfferRow) {
    await setPrivateOfferActiveAction(o.token, !o.active);
    router.refresh();
  }

  const labelStyle = { fontSize: 12.5, color: 'var(--ink-dim)', fontWeight: 600 } as const;

  return (
    <div
      className="admin-panel"
      style={{
        background: 'var(--panel)',
        border: '1px solid rgba(164,99,255,.25)',
        borderRadius: 14,
        padding: 16,
        marginBottom: 20
      }}
    >
      <h4 style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        Links exclusivos
      </h4>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--ink-dim)', lineHeight: 1.5 }}>
        Escolha um jogo e um preço especial: o site gera um link que só quem receber consegue usar. O preço é conferido no
        servidor em cada pagamento (Pix, cartão e Pix + cartão), e o link para de valer quando vence ou chega no limite de
        compras.
      </p>

      {offers === null ? (
        <p style={{ color: 'var(--gold)', fontSize: 13.5, margin: 0 }}>
          Falta rodar o <code>db/migration-private-offers.sql</code> no SQL Editor do Neon.
        </p>
      ) : (
        <>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
              <span style={labelStyle}>Jogo</span>
              <select value={gameId} onChange={(e) => setGameId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Escolha o jogo...</option>
                {activeGames.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} — R$ {formatPriceBR(gamePrice(g).price)}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={labelStyle}>Preço especial (R$)</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder={selectedGame ? formatPriceBR(gamePrice(selectedGame).price) : 'Ex: 199,90'}
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={labelStyle}>Quantas compras (0 = sem limite)</span>
              <input type="text" inputMode="numeric" value={maxUsesInput} onChange={(e) => setMaxUsesInput(e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={labelStyle}>Vale por quantos dias (0 = sempre)</span>
              <input type="text" inputMode="numeric" value={daysInput} onChange={(e) => setDaysInput(e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
              <span style={labelStyle}>Pra quem é (só você vê — opcional)</span>
              <input type="text" placeholder="Ex: Maria do Instagram" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
          {error && <p style={{ color: '#ff8a8a', fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>{error}</p>}
          <button className="btn primary" onClick={handleCreate} disabled={saving}>
            {saving ? 'Gerando...' : '🔗 Gerar link'}
          </button>

          {created && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--green)',
                fontSize: 13.5
              }}
            >
              <p style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--green)' }}>
                ✓ Link criado{copied === created ? ' e copiado' : ''}! Mande pro cliente:
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="text" readOnly value={offerUrl(created)} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 0 }} />
                <button className="btn ghost" onClick={() => copy(created)}>
                  {copied === created ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>
          )}

          <h4 style={{ margin: '20px 0 8px', fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Links criados
          </h4>
          {offers.length === 0 ? (
            <p style={{ color: 'var(--ink-dim)', fontSize: 14, margin: 0 }}>Nenhum link criado ainda.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {offers.map((o) => {
                const status = offerStatus(o);
                const game = gameById.get(o.gameId);
                return (
                  <div
                    key={o.token}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px 12px',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: 'rgba(164,99,255,.06)',
                      opacity: status.live ? 1 : 0.6,
                      fontSize: 13.5
                    }}
                  >
                    <strong style={{ color: 'var(--ink)' }}>{game?.name ?? `Jogo #${o.gameId}`}</strong>
                    <span style={{ color: 'var(--green)', fontWeight: 700 }}>R$ {formatPriceBR(o.price)}</span>
                    {game && (
                      <span style={{ color: 'var(--ink-dim)', textDecoration: 'line-through', fontSize: 12.5 }}>
                        R$ {formatPriceBR(gamePrice(game).price)}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: status.live ? 'var(--green)' : 'rgba(255,255,255,.12)',
                        color: status.live ? '#04210a' : 'var(--ink)'
                      }}
                    >
                      {status.label}
                    </span>
                    <span style={{ color: 'var(--ink-dim)', fontSize: 12.5 }}>
                      {o.uses}/{o.maxUses ?? '∞'} compras
                      {o.expiresAt ? ` · vence ${new Date(o.expiresAt).toLocaleDateString('pt-BR')}` : ''}
                      {o.note ? ` · ${o.note}` : ''}
                    </span>
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      {status.live && (
                        <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12.5 }} onClick={() => copy(o.token)}>
                          {copied === o.token ? 'Copiado!' : 'Copiar link'}
                        </button>
                      )}
                      <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12.5 }} onClick={() => toggle(o)}>
                        {o.active ? 'Desativar' : 'Reativar'}
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PaymentFeesForm({ initial }: { initial: { card: number; pix: number } }) {
  const router = useRouter();
  const [cardInput, setCardInput] = useState(formatPriceBR(initial.card));
  const [pixInput, setPixInput] = useState(formatPriceBR(initial.pix));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updatePaymentFeesAction(Number(cardInput.replace(',', '.')), Number(pixInput.replace(',', '.')));
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const examplePrice = 230;
  const exampleCard = Number(cardInput.replace(',', '.'));
  const exampleCharge =
    Number.isFinite(exampleCard) && exampleCard >= 0 && exampleCard < 50 ? priceWithFee(examplePrice, exampleCard) : null;

  return (
    <>
      <h4 style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        Taxas do Mercado Pago (repassadas ao cliente)
      </h4>
      <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--ink-dim)', lineHeight: 1.5 }}>
        Coloque a taxa que o Mercado Pago cobra de você (app do Mercado Pago &gt; Taxas e parcelas &gt; Checkout). O site
        cobra um pouco a mais do cliente pra você receber o preço inteiro do jogo — e avisa o cliente antes de pagar. Use 0
        pra não repassar.
        {exampleCharge !== null && exampleCard > 0 && (
          <>
            {' '}
            Ex.: jogo de R$ {formatPriceBR(examplePrice)} sai por R$ {formatPriceBR(exampleCharge)} no cartão.
          </>
        )}
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        <span style={{ fontSize: 13, color: 'var(--ink-dim)' }}>Cartão</span>
        <input
          type="text"
          inputMode="decimal"
          value={cardInput}
          onChange={(e) => {
            setCardInput(e.target.value);
            setSaved(false);
          }}
          style={{ width: 70 }}
        />
        <span style={{ fontSize: 13, color: 'var(--ink-dim)', marginRight: 8 }}>%</span>
        <span style={{ fontSize: 13, color: 'var(--ink-dim)' }}>Pix</span>
        <input
          type="text"
          inputMode="decimal"
          value={pixInput}
          onChange={(e) => {
            setPixInput(e.target.value);
            setSaved(false);
          }}
          style={{ width: 70 }}
        />
        <span style={{ fontSize: 13, color: 'var(--ink-dim)' }}>%</span>
        <button type="button" className="btn primary" style={{ padding: '6px 14px', fontSize: 12.5 }} disabled={saving} onClick={handleSave}>
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        {saved && <span style={{ fontSize: 12.5, color: 'var(--green)', fontWeight: 700 }}>✓ Salvo!</span>}
        {error && <span style={{ fontSize: 12.5, color: '#ff8a8a', fontWeight: 700 }}>{error}</span>}
      </div>
    </>
  );
}

// Histórico de "intenção de compra": uma linha aparece aqui toda vez que
// alguém gera um QR Code Pix no modal de compra do catálogo. NÃO é uma
// confirmação de pagamento — serve pra você não perder o rastro se alguém
// pagar e esquecer de chamar no WhatsApp depois. A confirmação de verdade
// continua sendo feita manualmente, vendo o Pix cair na sua conta.
// Pix + cartão em que o cliente pagou o Pix e não terminou o cartão (ver
// getStalledSplitPayments em lib/db.ts).
type StalledSplit = { id: string; email: string; gameName: string; pixTotal: number; createdAt: string };

function OrdersPanel({
  orders,
  stalledSplits,
  onDelete
}: {
  orders: Order[];
  stalledSplits: StalledSplit[];
  onDelete: (id: number) => void;
}) {
  const router = useRouter();
  // Entregou por fora (ex: mandou a chave direto no direct)? Marca como
  // concluída sem enviar nada.
  async function conclude(o: Order) {
    if (!confirm(`Marcar a venda de ${o.game_name} como concluída, sem enviar a chave por aqui?`)) return;
    const r = await setSalesStatusAction([o.id], 'concluido');
    if (!r.ok) alert(r.error);
    router.refresh();
  }

  return (
    <div className="adm-card admin-panel">
      {stalledSplits.length > 0 && (
        <div
          style={{
            border: '1px solid var(--gold)',
            borderRadius: 10,
            padding: '10px 12px',
            marginBottom: 12,
            fontSize: 13.5,
            lineHeight: 1.45
          }}
        >
          <p style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--gold)' }}>
            ⚠ Pix + cartão sem o cartão ({stalledSplits.length})
          </p>
          <p style={{ margin: '0 0 8px', color: 'var(--ink-dim)', fontSize: 12.5 }}>
            O cliente pagou o Pix mas não pagou o resto no cartão. Ele pode terminar abrindo o jogo de novo no
            mesmo aparelho; se não for terminar, devolva o Pix no painel do Mercado Pago (procure pelo id).
          </p>
          {stalledSplits.map((p) => (
            <p key={p.id} style={{ margin: '2px 0', color: 'var(--ink)' }}>
              {p.gameName} · {p.email} · Pix R$ {formatPriceBR(p.pixTotal)} ·{' '}
              {new Date(p.createdAt).toLocaleString('pt-BR')} · <code style={{ fontSize: 11.5 }}>{p.id}</code>
            </p>
          ))}
        </div>
      )}
      {orders.length === 0 ? (
        <p className="adm-empty">🎉 Tudo entregue! Quando entrar uma venda nova no site, ela aparece aqui.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {orders.map((o) => (
            <div
              key={o.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                padding: '8px 4px',
                borderBottom: '1px solid rgba(255,255,255,.06)',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.game_name}
                  </strong>
                  <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 13.5, flex: 'none' }}>
                    R$ {formatPriceBR(o.price)}
                  </span>
                  <span style={{ color: 'var(--ink-dim)', fontSize: 12.5, flex: 'none' }}>
                    {new Date(o.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {o.payment_method === 'credito' && (
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: '#2b1a00',
                        background: 'linear-gradient(135deg, var(--gold), var(--gold-2))',
                        borderRadius: 6,
                        padding: '2px 8px'
                      }}
                    >
                      💳 Crédito parcelado
                    </span>
                  )}
                  {o.mp_payment_id && (
                    <span
                      title={`Pagamento ${o.mp_payment_id} no Mercado Pago`}
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: '#04210a',
                        background: 'var(--green)',
                        borderRadius: 6,
                        padding: '2px 8px'
                      }}
                    >
                      {o.payment_method === 'cartao'
                        ? '✓ Cartão pago (Mercado Pago)'
                        : o.payment_method === 'pix+cartao'
                          ? '✓ Pix + cartão pagos (Mercado Pago)'
                          : '✓ Pix pago (Mercado Pago)'}
                    </span>
                  )}
                  {(o.payment_method === 'cartao' || o.payment_method === 'pix+cartao') && (
                    // Jogo digital no cartão é alvo de compra com cartão
                    // roubado (o dono contesta semanas depois): vale olhar
                    // o pedido com calma antes de mandar o código.
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--gold)' }}>
                      ⚠ Confira antes de enviar o código
                    </span>
                  )}
                  {o.customer_email && (
                    <span style={{ color: 'var(--ink-dim)', fontSize: 12.5 }}>✉ {o.customer_email}</span>
                  )}
                  {o.customer_whatsapp && (
                    <span style={{ color: 'var(--ink-dim)', fontSize: 12.5 }}>💬 {formatWhatsApp(o.customer_whatsapp)}</span>
                  )}
                  {o.code_sent_at ? (
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--green)' }}>
                      ✓ Código enviado{o.code_sent_via === 'whatsapp' ? ' pelo WhatsApp' : o.code_sent_via === 'email' ? ' por e-mail' : ''} em{' '}
                      {new Date(o.code_sent_at).toLocaleString('pt-BR')}
                    </span>
                  ) : (
                    o.customer_email && (
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--gold)' }}>⏳ Aguardando código</span>
                    )
                  )}
                  {o.referral_source && (
                    <span style={{ color: 'var(--ink-dim)', fontSize: 12.5 }}>📣 {o.referral_source}</span>
                  )}
                </div>
                {o.card_points_earned > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 12.5 }}>
                      🎴 {o.card_points_earned} {o.card_points_earned === 1 ? 'ponto' : 'pontos'}
                    </span>
                    {/* Confirmar os pontos agora é feito em "🎖️ Clientes", junto
                        com o resto do que envolve pontos de cada cliente — aqui
                        fica só o status, pra não duplicar a ação em dois lugares. */}
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: o.card_points_confirmed ? 'var(--green)' : 'var(--ink-dim)' }}>
                      {o.card_points_confirmed ? '✓ Pontos confirmados' : '⏳ Pontos pendentes'}
                    </span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
                <button className="btn ghost" onClick={() => conclude(o)} title="Já entreguei por fora">
                  ✅ Concluir
                </button>
                <button className="btn ghost" onClick={() => onDelete(o.id)} aria-label="Apagar pedido" title="Apagar pedido">
                  🗑
                </button>
              </div>
              {o.customer_email && <DeliveryComposer order={o} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Entrega da chave, já montada com os dados do pedido. Se o cliente
// informou WhatsApp na compra, o padrão é o WhatsApp (abre o wa.me com a
// mensagem pronta); senão, e-mail (sai pelo Resend). Dá pra trocar de canal
// na hora, se precisar. Fica fechado por padrão; aberto, mostra a prévia
// exata do que o cliente vai receber, o campo da chave e o botão de enviar.
// Os textos moram em lib/deliveryEmail.ts.
function DeliveryComposer({ order }: { order: Order }) {
  const router = useRouter();
  const alreadySent = Boolean(order.code_sent_at);
  const whatsappNumber = order.customer_whatsapp || null;
  const [channel, setChannel] = useState<'whatsapp' | 'email'>(whatsappNumber ? 'whatsapp' : 'email');
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const price = parseFloat(order.price);
  const data = {
    orderId: order.id,
    gameName: order.game_name,
    price: Number.isFinite(price) ? price : 0,
    code,
    whatsappUrl: null
  };
  const previewHtml = useMemo(() => buildDeliveryHtml(data), [order.id, order.game_name, price, code]);
  const whatsappText = buildDeliveryWhatsAppText({ ...data, code: code.trim() || '(a chave que você colar aparece aqui)' });

  async function handleSend() {
    const trimmed = code.trim();
    if (!trimmed || sending) return;
    const verb = alreadySent ? 'REENVIAR' : 'Enviar';

    if (channel === 'whatsapp' && whatsappNumber) {
      if (!window.confirm(`${verb} a chave "${trimmed}" de ${order.game_name} pelo WhatsApp ${formatWhatsApp(whatsappNumber)}?`)) return;
      // Abre o WhatsApp ainda dentro do clique (senão o navegador bloqueia a
      // janela nova) e só depois registra no banco. api.whatsapp.com/send em
      // vez de wa.me: o redirecionamento do wa.me estraga os emojis (viram
      // "�") no WhatsApp Web/Desktop.
      const query = `phone=${whatsappNumber}&text=${encodeURIComponent(buildDeliveryWhatsAppText({ ...data, code: trimmed }))}`;
      const webUrl = `https://api.whatsapp.com/send?${query}`;
      // No Android, abre direto o WhatsApp Business (pacote com.whatsapp.w4b)
      // em vez do WhatsApp normal; sem o Business instalado, cai no link
      // comum. No computador o sistema é quem escolhe o app.
      // (O intent:// abre o app sem sair da página do admin.)
      if (/Android/i.test(navigator.userAgent)) {
        window.location.href = `intent://send?${query}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
      } else {
        window.open(webUrl, '_blank', 'noopener,noreferrer');
      }
      setSending(true);
      setResult(null);
      try {
        const r = await markCodeSentByWhatsAppAction(order.id, trimmed);
        setResult(r.ok ? { ok: true, message: 'WhatsApp aberto com a mensagem pronta — é só apertar enviar lá. ✓ Pedido marcado como enviado.' } : r);
        if (r.ok) {
          setCode('');
          router.refresh();
        }
      } catch {
        setResult({ ok: false, message: 'O WhatsApp abriu, mas não deu pra marcar o pedido como enviado. Tente de novo.' });
      } finally {
        setSending(false);
      }
      return;
    }

    if (!window.confirm(`${verb} a chave "${trimmed}" de ${order.game_name} para ${order.customer_email}?`)) return;
    setSending(true);
    setResult(null);
    try {
      const r = await sendGameCodeAction(order.id, trimmed);
      setResult(r);
      if (r.ok) {
        setCode('');
        router.refresh();
      }
    } catch {
      setResult({ ok: false, message: 'Algo deu errado no envio. Confira sua conexão e tente de novo.' });
    } finally {
      setSending(false);
    }
  }

  const isWhatsApp = channel === 'whatsapp' && Boolean(whatsappNumber);
  const toggleStyle = (active: boolean) => ({
    fontSize: 12.5,
    padding: '5px 10px',
    borderRadius: 8,
    border: `1px solid ${active ? 'var(--green)' : 'rgba(255,255,255,.2)'}`,
    background: active ? 'rgba(78,240,95,.12)' : 'transparent',
    color: 'var(--ink)',
    fontWeight: 700,
    cursor: 'pointer'
  });

  return (
    <div style={{ flexBasis: '100%', marginTop: 2 }}>
      <button
        type="button"
        className="btn ghost"
        onClick={() => setOpen((v) => !v)}
        style={{ fontSize: 13, padding: '6px 12px' }}
      >
        {open
          ? '▲ Fechar'
          : alreadySent
            ? '↻ Reenviar código'
            : whatsappNumber
              ? '💬 Preparar WhatsApp'
              : '✉ Preparar e-mail'}
      </button>

      {result && !open && (
        <p style={{ margin: '6px 0 0', fontSize: 12.5, fontWeight: 700, color: result.ok ? 'var(--green)' : '#ff6b6b' }}>
          {result.message}
        </p>
      )}

      {open && (
        <div
          style={{
            marginTop: 10,
            border: '1px solid rgba(164,99,255,.3)',
            borderRadius: 12,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}
        >
          {whatsappNumber && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, color: 'var(--ink-dim)' }}>Enviar por:</span>
              <button type="button" style={toggleStyle(channel === 'whatsapp')} onClick={() => setChannel('whatsapp')}>
                💬 WhatsApp
              </button>
              <button type="button" style={toggleStyle(channel === 'email')} onClick={() => setChannel('email')}>
                📧 E-mail
              </button>
            </div>
          )}

          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            <div>
              <span style={{ color: 'var(--ink-dim)' }}>Para:</span>{' '}
              <strong>{isWhatsApp && whatsappNumber ? `WhatsApp ${formatWhatsApp(whatsappNumber)}` : order.customer_email}</strong>
            </div>
            {!isWhatsApp && (
              <div>
                <span style={{ color: 'var(--ink-dim)' }}>Assunto:</span> {buildDeliverySubject(order.game_name)}
              </div>
            )}
            {alreadySent && order.delivered_code && (
              <div style={{ color: 'var(--gold)' }}>
                Já enviado antes{order.code_sent_via === 'whatsapp' ? ' pelo WhatsApp' : order.code_sent_via === 'email' ? ' por e-mail' : ''} com a
                chave <code>{order.delivered_code}</code>
              </div>
            )}
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 700 }}>
            Chave do jogo
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Cole aqui a chave (ex: XXXX-XXXX-XXXX-XXXX)"
              autoComplete="off"
              spellCheck={false}
              style={{
                fontFamily: 'monospace',
                fontSize: 16,
                letterSpacing: 1,
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid rgba(164,99,255,.45)',
                background: 'rgba(0,0,0,.25)',
                color: 'var(--ink)'
              }}
            />
          </label>

          <button
            type="button"
            className="btn"
            onClick={handleSend}
            disabled={!code.trim() || sending}
            style={{ alignSelf: 'flex-start', opacity: !code.trim() || sending ? 0.55 : 1 }}
          >
            {sending
              ? 'Enviando…'
              : isWhatsApp
                ? alreadySent
                  ? '↻ Reenviar pelo WhatsApp'
                  : '💬 Enviar pelo WhatsApp'
                : alreadySent
                  ? '↻ Reenviar por e-mail'
                  : '📨 Enviar por e-mail'}
          </button>

          {result && (
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: result.ok ? 'var(--green)' : '#ff6b6b' }}>
              {result.message}
            </p>
          )}

          <div style={{ fontSize: 12, color: 'var(--ink-dim)' }}>
            Prévia {isWhatsApp ? 'da mensagem de WhatsApp' : 'do e-mail'} que o cliente vai receber:
          </div>
          {isWhatsApp ? (
            <pre
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'inherit',
                fontSize: 13.5,
                lineHeight: 1.5,
                background: '#dcf8c6',
                color: '#111b21',
                borderRadius: 10,
                padding: '10px 12px',
                maxWidth: 480
              }}
            >
              {whatsappText}
            </pre>
          ) : (
            <iframe
              title={`Prévia do e-mail do pedido ${order.id}`}
              srcDoc={previewHtml}
              sandbox=""
              style={{ width: '100%', height: 560, border: 'none', borderRadius: 10, background: '#f4f1fa' }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ClientsPanel({
  clients,
  onConfirmPoints,
  onDeleteCard,
  discountAmount
}: {
  clients: {
    email: string;
    confirmedPoints: number;
    pendingPoints: number;
    availableCredit: number;
    games: string[];
    lastPurchaseAt: string;
    pendingOrders: { id: number; gameName: string; points: number; createdAt: string }[];
    cards: { id: number; gameName: string; imageUrl: string | null; points: number; confirmed: boolean; createdAt: string }[];
  }[];
  onConfirmPoints: (id: number, confirmed: boolean) => void;
  onDeleteCard: (id: number) => void;
  discountAmount: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [pointsInput, setPointsInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [discountInput, setDiscountInput] = useState(discountAmount.toFixed(2));
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountSaved, setDiscountSaved] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [savingCoupon, setSavingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSaved, setCouponSaved] = useState(false);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.email.toLowerCase().includes(q) || c.games.some((g) => g.toLowerCase().includes(q)));
  }, [clients, search]);

  function toggleExpanded(email: string) {
    if (expandedEmail === email) {
      setExpandedEmail(null);
      return;
    }
    setExpandedEmail(email);
    setPointsInput('');
    setNoteInput('');
    setCouponInput(discountAmount.toFixed(2));
    setCouponError(null);
    setCouponSaved(false);
  }

  async function handleApply(email: string) {
    const points = Number(pointsInput);
    if (!Number.isFinite(points) || points === 0) return;
    setSaving(true);
    await adjustClientPointsAction(email, points, noteInput);
    setSaving(false);
    setPointsInput('');
    setNoteInput('');
    router.refresh();
  }

  async function handleConfirmOrder(id: number) {
    setConfirmingId(id);
    await onConfirmPoints(id, true);
    setConfirmingId(null);
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    await onDeleteCard(id);
    setDeletingId(null);
  }

  async function handleGiveCoupon(email: string) {
    const amount = Number(couponInput.replace(',', '.'));
    setSavingCoupon(true);
    setCouponError(null);
    setCouponSaved(false);
    const result = await createManualDiscountCreditAction(email, amount);
    setSavingCoupon(false);
    if (result.error) {
      setCouponError(result.error);
      return;
    }
    setCouponSaved(true);
    router.refresh();
  }

  async function handleSaveDiscount() {
    const amount = Number(discountInput.replace(',', '.'));
    setSavingDiscount(true);
    setDiscountError(null);
    setDiscountSaved(false);
    const result = await updateLoyaltyDiscountAmountAction(amount);
    setSavingDiscount(false);
    if (result.error) {
      setDiscountError(result.error);
      return;
    }
    setDiscountSaved(true);
    router.refresh();
  }

  return (
    <div
      className="admin-panel"
      style={{
        background: 'var(--panel)',
        border: '1px solid rgba(164,99,255,.25)',
        borderRadius: 14,
        padding: 16,
        marginBottom: 20
      }}
    >
      <h4 style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        Valor do desconto por troca de pontos
      </h4>
      <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--ink-dim)', lineHeight: 1.5 }}>
        A cada 5 pontos confirmados, o cliente pode trocar por esse valor de desconto na próxima compra de um jogo
        elegível. Mudar aqui só vale pra trocas novas — descontos que os clientes já têm guardado não mudam de valor.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        <span style={{ fontSize: 13, color: 'var(--ink-dim)' }}>R$</span>
        <input
          type="text"
          inputMode="decimal"
          value={discountInput}
          onChange={(e) => {
            setDiscountInput(e.target.value);
            setDiscountSaved(false);
          }}
          style={{ width: 100 }}
        />
        <button type="button" className="btn primary" style={{ padding: '6px 14px', fontSize: 12.5 }} disabled={savingDiscount} onClick={handleSaveDiscount}>
          {savingDiscount ? 'Salvando...' : 'Salvar'}
        </button>
        {discountSaved && <span style={{ fontSize: 12.5, color: 'var(--green)', fontWeight: 700 }}>✓ Salvo!</span>}
        {discountError && <span style={{ fontSize: 12.5, color: '#ff8a8a', fontWeight: 700 }}>{discountError}</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Clientes com cards (compra mais recente primeiro)
        </h4>
        <input
          type="text"
          placeholder="Buscar por e-mail ou jogo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 260 }}
        />
      </div>

      {filteredClients.length === 0 ? (
        <p style={{ color: 'var(--ink-dim)', fontSize: 14, padding: '6px 2px', margin: 0 }}>
          {clients.length === 0 ? 'Ninguém ganhou um card ainda.' : 'Nenhum cliente encontrado.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredClients.map((c) => {
            const expanded = expandedEmail === c.email;
            return (
              <div
                key={c.email}
                className="admin-row"
                style={{
                  border: '1px solid rgba(255,255,255,.08)',
                  borderRadius: 10,
                  background: expanded ? 'rgba(164,99,255,.05)' : 'transparent',
                  overflow: 'hidden'
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleExpanded(c.email)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap',
                    padding: '10px 12px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: 14, display: 'block', color: 'var(--ink)' }}>{c.email}</strong>
                    <span style={{ fontSize: 12.5, color: 'var(--ink-dim)' }}>
                      Última compra: {new Date(c.lastPurchaseAt).toLocaleDateString('pt-BR')} · {c.cards.length}{' '}
                      {c.cards.length === 1 ? 'card' : 'cards'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flex: 'none', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: '#2b1a00',
                        background: 'linear-gradient(135deg, var(--gold), var(--gold-2))',
                        borderRadius: 6,
                        padding: '3px 10px'
                      }}
                    >
                      {c.confirmedPoints} pts
                    </span>
                    {c.pendingPoints > 0 && (
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: 700,
                          color: 'var(--ink-dim)',
                          border: '1px solid rgba(255,255,255,.2)',
                          borderRadius: 6,
                          padding: '3px 10px'
                        }}
                      >
                        +{c.pendingPoints} pendente{c.pendingPoints > 1 ? 's' : ''}
                      </span>
                    )}
                    {c.availableCredit > 0 && (
                      <span
                        title="Cupom(s) de desconto disponível(is), ainda não usado(s)"
                        style={{
                          fontSize: 12.5,
                          fontWeight: 700,
                          color: 'var(--green)',
                          border: '1px solid rgba(78,240,95,.35)',
                          borderRadius: 6,
                          padding: '3px 10px'
                        }}
                      >
                        🎟️ R$ {c.availableCredit.toFixed(2).replace('.', ',')}
                      </span>
                    )}
                    <span style={{ color: 'var(--ink-dim)', fontSize: 14 }}>{expanded ? '▲' : '▼'}</span>
                  </div>
                </button>

                {expanded && (
                  <div className="admin-panel" style={{ padding: '0 12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {c.pendingOrders.length > 0 && (
                      <div>
                        <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: 'var(--ink-dim)', textTransform: 'uppercase' }}>
                          Pontos pendentes de confirmação
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {c.pendingOrders.map((o) => (
                            <div
                              key={o.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 10,
                                flexWrap: 'wrap',
                                background: 'var(--bg-dark)',
                                border: '1px solid rgba(255,255,255,.1)',
                                borderRadius: 8,
                                padding: '6px 10px'
                              }}
                            >
                              <span style={{ fontSize: 12.5, color: 'var(--ink-dim)' }}>
                                ⏳ {o.gameName} — {o.points} {o.points === 1 ? 'ponto' : 'pontos'} ·{' '}
                                {new Date(o.createdAt).toLocaleDateString('pt-BR')}
                              </span>
                              <button
                                type="button"
                                className="btn ghost"
                                style={{ padding: '3px 10px', fontSize: 12 }}
                                disabled={confirmingId === o.id}
                                onClick={() => handleConfirmOrder(o.id)}
                              >
                                {confirmingId === o.id ? 'Confirmando...' : '✓ Confirmar pontos'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 260px', minWidth: 240 }}>
                        <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: 'var(--ink-dim)', textTransform: 'uppercase' }}>
                          ✏️ Ajustar pontos
                        </p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <input
                            type="number"
                            placeholder="ex: 5 ou -5"
                            value={pointsInput}
                            onChange={(e) => setPointsInput(e.target.value)}
                            style={{ width: 90 }}
                          />
                          <input
                            type="text"
                            placeholder="Motivo (opcional)"
                            value={noteInput}
                            onChange={(e) => setNoteInput(e.target.value)}
                            style={{ flex: 1, minWidth: 120 }}
                          />
                          <button
                            type="button"
                            className="btn primary"
                            style={{ padding: '6px 14px', fontSize: 12.5 }}
                            disabled={saving || !pointsInput}
                            onClick={() => handleApply(c.email)}
                          >
                            {saving ? 'Salvando...' : 'Aplicar'}
                          </button>
                        </div>
                      </div>

                      <div style={{ flex: '1 1 260px', minWidth: 240 }}>
                        <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: 'var(--ink-dim)', textTransform: 'uppercase' }}>
                          🎟️ Dar cupom (não mexe nos pontos)
                        </p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: 13, color: 'var(--ink-dim)' }}>R$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={couponInput}
                            onChange={(e) => {
                              setCouponInput(e.target.value);
                              setCouponSaved(false);
                            }}
                            style={{ width: 90 }}
                          />
                          <button
                            type="button"
                            className="btn primary"
                            style={{ padding: '6px 14px', fontSize: 12.5 }}
                            disabled={savingCoupon || !couponInput}
                            onClick={() => handleGiveCoupon(c.email)}
                          >
                            {savingCoupon ? 'Salvando...' : 'Dar cupom'}
                          </button>
                          {couponSaved && <span style={{ fontSize: 12.5, color: 'var(--green)', fontWeight: 700 }}>✓ Dado!</span>}
                          {couponError && <span style={{ fontSize: 12.5, color: '#ff8a8a', fontWeight: 700 }}>{couponError}</span>}
                        </div>
                      </div>
                    </div>

                    <div>
                      <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--ink-dim)', textTransform: 'uppercase' }}>
                        🎴 Cards ({c.cards.length})
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {c.cards
                          .slice()
                          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                          .map((card) => (
                            <div
                              key={card.id}
                              style={{
                                width: 150,
                                background: 'var(--bg-dark)',
                                border: '1px solid rgba(255,255,255,.1)',
                                borderRadius: 10,
                                padding: 10,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6
                              }}
                            >
                              {card.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={card.imageUrl}
                                  alt=""
                                  style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 6 }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: '100%',
                                    aspectRatio: '1 / 1',
                                    borderRadius: 6,
                                    background: 'var(--panel)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 11,
                                    color: 'var(--ink-dim)'
                                  }}
                                >
                                  sem capa
                                </div>
                              )}
                              <strong style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.3 }}>{card.gameName}</strong>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                <span style={{ fontSize: 11.5, fontWeight: 700, color: card.confirmed ? 'var(--green)' : 'var(--ink-dim)' }}>
                                  {card.confirmed ? '✓ Confirmado' : '⏳ Pendente'}
                                </span>
                                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--gold)' }}>
                                  {card.points} {card.points === 1 ? 'pt' : 'pts'}
                                </span>
                              </div>
                              <span style={{ fontSize: 11, color: 'var(--ink-dim)' }}>
                                {new Date(card.createdAt).toLocaleDateString('pt-BR')}
                              </span>
                              <button
                                type="button"
                                className="btn ghost"
                                style={{ padding: '4px 8px', fontSize: 11.5, justifyContent: 'center' }}
                                disabled={deletingId === card.id}
                                onClick={() => handleDelete(card.id)}
                              >
                                {deletingId === card.id ? 'Removendo...' : '🗑 Remover card'}
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Banner fino que substitui as avaliações na página principal — troca de
// imagem quando você quiser (ver updateReviewsBannerAction/
// removeReviewsBannerAction em actions.ts). As avaliações continuam
// existindo, só que atrás do botão "Ver avaliações" no catálogo.
function ReviewsBannerPanel({ currentUrl }: { currentUrl: string | null }) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    setError(null);
    const result = await updateReviewsBannerAction(formData);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleRemove() {
    setSubmitting(true);
    await removeReviewsBannerAction();
    setSubmitting(false);
    setPreview(null);
    router.refresh();
  }

  return (
    <div
      className="admin-panel"
      style={{
        background: 'var(--panel)',
        border: '1px solid rgba(164,99,255,.25)',
        borderRadius: 14,
        padding: 16,
        marginBottom: 20
      }}
    >
      <h4 style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        Banner de avaliações
      </h4>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.5 }}>
        Esse banner aparece na página principal no lugar das avaliações (que continuam existindo, só que atrás
        do botão "Ver avaliações"). Use uma imagem mais fina que os banners de destaque.
      </p>

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt=""
          style={{ width: '100%', maxWidth: 480, borderRadius: 10, border: '1px solid rgba(164,99,255,.3)', marginBottom: 14, display: 'block' }}
        />
      )}

      <form action={handleSubmit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input ref={fileInputRef} name="image" type="file" accept="image/*" onChange={handleFileChange} />
        <button type="submit" className="btn primary" disabled={submitting}>
          {submitting ? 'Enviando...' : preview === currentUrl ? 'Trocar imagem' : 'Salvar banner'}
        </button>
        {currentUrl && (
          <button type="button" className="btn ghost" disabled={submitting} onClick={handleRemove}>
            Remover banner
          </button>
        )}
      </form>
      {error && <p style={{ color: '#ff8a8a', fontSize: 13, fontWeight: 600, marginTop: 10 }}>{error}</p>}
    </div>
  );
}

// Botão de franquia em destaque, do lado de "Ver avaliações" no catálogo —
// pra divulgar uma promoção específica (ex: "Jogos de Zelda em destaque").
// Também gera um link direto (/franquia/<nome>) que já abre o site filtrado
// nessa franquia, pra compartilhar nas redes sociais.
function FeaturedFranchisePanel({
  allFranchises,
  enabled: initialEnabled,
  franchise: initialFranchise,
  label: initialLabel
}: {
  allFranchises: string[];
  enabled: boolean;
  franchise: string;
  label: string;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [franchise, setFranchise] = useState(initialFranchise || allFranchises[0] || '');
  const [label, setLabel] = useState(initialLabel);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updateFeaturedFranchiseAction(enabled, franchise, label);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const shareableLink =
    typeof window !== 'undefined' && franchise ? `${window.location.origin}/franquia/${encodeURIComponent(franchise)}` : '';

  async function handleCopyLink() {
    if (!shareableLink) return;
    try {
      await navigator.clipboard.writeText(shareableLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      // Sem permissão de área de transferência — sem fallback melhor do
      // que simplesmente não fazer nada (o link já está escrito na tela).
    }
  }

  return (
    <div
      className="admin-panel"
      style={{
        background: 'var(--panel)',
        border: '1px solid rgba(164,99,255,.25)',
        borderRadius: 14,
        padding: 16,
        marginBottom: 20
      }}
    >
      <h4 style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        Franquia em destaque
      </h4>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.5 }}>
        Um botão chamativo do lado de "Ver avaliações" no catálogo, pra divulgar uma promoção específica — ex:
        ativando com "Legend Of Zelda", aparece um botão que mostra só os jogos dessa franquia quando clicado.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <input
          id="franchise-enabled"
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            setSaved(false);
          }}
          style={{ width: 18, height: 18, accentColor: 'var(--green)' }}
        />
        <label htmlFor="franchise-enabled" style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600 }}>
          Ativar o botão no catálogo
        </label>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: '1 1 200px', minWidth: 180 }}>
          <label htmlFor="franchise-select">Franquia</label>
          <select
            id="franchise-select"
            value={franchise}
            onChange={(e) => {
              setFranchise(e.target.value);
              setSaved(false);
            }}
          >
            {allFranchises.length === 0 && <option value="">Nenhuma franquia cadastrada ainda</option>}
            {allFranchises.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: '2 1 260px', minWidth: 220 }}>
          <label htmlFor="franchise-label">Texto do botão (opcional)</label>
          <input
            id="franchise-label"
            type="text"
            placeholder={`Padrão: 🔥 Jogos de ${franchise || '...'}`}
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              setSaved(false);
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <button type="button" className="btn primary" disabled={saving} onClick={handleSave}>
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        {saved && <span style={{ fontSize: 12.5, color: 'var(--green)', fontWeight: 700 }}>✓ Salvo!</span>}
        {error && <span style={{ fontSize: 12.5, color: '#ff8a8a', fontWeight: 700 }}>{error}</span>}
      </div>

      {franchise && (
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 12.5, color: 'var(--ink-dim)' }}>
            Link direto pra compartilhar (abre o site já filtrado nessa franquia, mesmo com o botão desativado):
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="text" readOnly value={shareableLink} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 220 }} />
            <button type="button" className="btn ghost" onClick={handleCopyLink}>
              {linkCopied ? '✓ Copiado!' : 'Copiar link'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function WishlistPanel({ entries }: { entries: { game: Game; count: number }[] }) {
  return (
    <div
      className="admin-panel"
      style={{
        background: 'var(--panel)',
        border: '1px solid rgba(164,99,255,.25)',
        borderRadius: 14,
        padding: 16,
        marginBottom: 20
      }}
    >
      <h4 style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        Jogos mais favoritados pelos clientes (mais desejado primeiro)
      </h4>
      {entries.length === 0 ? (
        <p style={{ color: 'var(--ink-dim)', fontSize: 14, padding: '6px 2px', margin: 0 }}>
          Ninguém favoritou nenhum jogo ainda.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map(({ game, count }, index) => (
            <div
              key={game.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 4px',
                borderBottom: '1px solid rgba(255,255,255,.06)'
              }}
            >
              <span style={{ flex: 'none', width: 22, textAlign: 'center', color: 'var(--ink-dim)', fontSize: 13, fontWeight: 700 }}>
                {index + 1}º
              </span>
              {game.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={game.image_url}
                  alt=""
                  style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', flex: 'none' }}
                />
              ) : (
                <span style={{ width: 34, height: 34, borderRadius: 6, background: 'var(--panel-2)', flex: 'none' }} />
              )}
              <strong style={{ fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {game.name}
              </strong>
              <span
                style={{
                  flex: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  color: '#ff5c8a',
                  fontWeight: 800,
                  fontSize: 13.5
                }}
              >
                ❤️ {count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewsPanel({
  reviews,
  onApprove,
  onDelete,
  onToggleFeatured
}: {
  reviews: Review[];
  onApprove: (id: number) => void;
  onDelete: (id: number) => void;
  onToggleFeatured: (id: number, featured: boolean) => void;
}) {
  const pending = reviews.filter((r) => !r.approved);
  const approved = reviews.filter((r) => r.approved);

  return (
    <div
      className="admin-panel"
      style={{
        background: 'var(--panel)',
        border: '1px solid rgba(164,99,255,.25)',
        borderRadius: 14,
        padding: 16,
        marginBottom: 20
      }}
    >
      <h4 style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        Pendentes de aprovação ({pending.length})
      </h4>
      {pending.length === 0 ? (
        <p style={{ color: 'var(--ink-dim)', fontSize: 14, padding: '6px 2px', margin: '0 0 20px' }}>
          Nenhum comentário pendente.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {pending.map((r) => (
            <div
              key={r.id}
              style={{ background: 'var(--panel-2)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 14.5 }}>{r.name}</strong>
                  {r.instagram && (
                    <span style={{ color: 'var(--ink-dim)', fontSize: 13 }}>@{r.instagram.replace(/^@/, '')}</span>
                  )}
                  <StarsDisplay rating={r.rating} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <FeaturedToggleButton featured={r.is_featured} onClick={() => onToggleFeatured(r.id, !r.is_featured)} />
                  <button className="btn green" onClick={() => onApprove(r.id)}>
                    ✓ Aprovar
                  </button>
                  <button className="btn ghost" onClick={() => onDelete(r.id)}>
                    🗑
                  </button>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--ink)' }}>{r.comment}</p>
            </div>
          ))}
        </div>
      )}

      <h4 style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        Já aprovados no site ({approved.length})
      </h4>
      {approved.length === 0 ? (
        <p style={{ color: 'var(--ink-dim)', fontSize: 14, padding: '6px 2px', margin: 0 }}>Nenhum ainda.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {approved.map((r) => (
            <div
              key={r.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                padding: '8px 4px',
                borderBottom: '1px solid rgba(255,255,255,.06)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <strong style={{ fontSize: 14, flex: 'none' }}>{r.name}</strong>
                <StarsDisplay rating={r.rating} />
                <span
                  style={{
                    color: 'var(--ink-dim)',
                    fontSize: 13,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {r.comment}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
                <FeaturedToggleButton featured={r.is_featured} onClick={() => onToggleFeatured(r.id, !r.is_featured)} />
                <button className="btn ghost" onClick={() => onDelete(r.id)}>
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GameFormPanel({
  game,
  allFranchises,
  onClose,
  onSaved
}: {
  game: Game | null;
  allFranchises: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!game;
  const action = isEditing ? updateGameAction : createGameAction;
  const [state, formAction] = useActionState(action, emptyFormState);
  const [hasBadge, setHasBadge] = useState(game?.has_badge ?? false);
  const [removeImage, setRemoveImage] = useState(false);
  const [preview, setPreview] = useState<string | null>(game?.image_url ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [removeBannerImage, setRemoveBannerImage] = useState(false);
  const [bannerPreview, setBannerPreview] = useState<string | null>(game?.banner_image_url ?? null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // useActionState keeps returning the exact same `emptyFormState` object
    // reference until an actual submission completes and hands back a new
    // one — checking identity (rather than a "first render" ref flag) is
    // what makes this safe under React StrictMode's double-effect-invoke.
    if (state === emptyFormState) return;
    if (state.error === null) {
      onSaved();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRemoveImage(false);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleBannerFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRemoveBannerImage(false);
    const reader = new FileReader();
    reader.onload = (ev) => setBannerPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div
      className="admin-panel"
      style={{
        background: 'var(--panel)',
        border: '1px solid rgba(164,99,255,.35)',
        borderRadius: 14,
        padding: 20,
        marginBottom: 20
      }}
    >
      <h3 style={{ margin: '0 0 16px', fontFamily: "'Press Start 2P',cursive", fontSize: 13, color: 'var(--purple)' }}>
        {isEditing ? 'EDITAR JOGO' : 'ADICIONAR JOGO'}
      </h3>
      <form action={formAction}>
        {isEditing && <input type="hidden" name="id" value={game!.id} />}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label htmlFor="name">Nome do jogo</label>
            <input id="name" name="name" type="text" defaultValue={game?.name} placeholder="Ex: Fire Emblem Engage" required />
          </div>
          <div>
            <label htmlFor="price">Preço (R$)</label>
            <input
              id="price"
              name="price"
              type="text"
              inputMode="decimal"
              defaultValue={game ? parseFloat(game.price).toFixed(2) : ''}
              placeholder="230.00"
              required
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label htmlFor="franchise">Franquia</label>
            <input
              id="franchise"
              name="franchise"
              type="text"
              list="franchise-options"
              defaultValue={game?.franchise || ''}
              placeholder="Ex: Mario"
            />
            <datalist id="franchise-options">
              {allFranchises.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor="platform">Plataforma</label>
            <select id="platform" name="platform" defaultValue={game?.platform || 'switch2'}>
              <option value="switch1">Nintendo Switch</option>
              <option value="switch2">Nintendo Switch 2</option>
              <option value="both">Ambos</option>
            </select>
          </div>
          <div>
            <label htmlFor="gameType">Tipo</label>
            <select id="gameType" name="gameType" defaultValue={game?.game_type || 'base'}>
              <option value="base">Jogo base</option>
              <option value="dlc">DLC</option>
              <option value="update">Atualização</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label>Banners promocionais (opcional)</label>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                id="isFeatured"
                name="isFeatured"
                type="checkbox"
                defaultChecked={game?.is_featured ?? false}
                style={{ width: 18, height: 18, accentColor: 'var(--green)' }}
              />
              <label htmlFor="isFeatured" style={{ margin: 0, textTransform: 'none', fontSize: 14, color: 'var(--ink)' }}>
                Destaque da semana
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                id="isBestseller"
                name="isBestseller"
                type="checkbox"
                defaultChecked={game?.is_bestseller ?? false}
                style={{ width: 18, height: 18, accentColor: 'var(--green)' }}
              />
              <label htmlFor="isBestseller" style={{ margin: 0, textTransform: 'none', fontSize: 14, color: 'var(--ink)' }}>
                Mais vendido
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                id="isUpcoming"
                name="isUpcoming"
                type="checkbox"
                defaultChecked={game?.is_upcoming ?? false}
                style={{ width: 18, height: 18, accentColor: 'var(--green)' }}
              />
              <label htmlFor="isUpcoming" style={{ margin: 0, textTransform: 'none', fontSize: 14, color: 'var(--ink)' }}>
                Mais aguardado
              </label>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label htmlFor="originalPrice">Preço original (opcional — pra mostrar como desconto)</label>
          <input
            id="originalPrice"
            name="originalPrice"
            type="text"
            inputMode="decimal"
            defaultValue={game?.original_price ? parseFloat(game.original_price).toFixed(2) : ''}
            placeholder="Ex: 300.00"
          />
        </div>

        <div
          style={{
            marginBottom: 14,
            padding: 14,
            borderRadius: 10,
            background: 'rgba(255,210,78,.08)',
            border: '1px solid rgba(255,210,78,.35)'
          }}
        >
          <label htmlFor="promoPrice">🏷️ Preço promocional (opcional)</label>
          <input
            id="promoPrice"
            name="promoPrice"
            type="text"
            inputMode="decimal"
            defaultValue={game?.promo_price ? parseFloat(game.promo_price).toFixed(2) : ''}
            placeholder="Ex: 199.90"
          />
          <p style={{ margin: '6px 2px 0', fontSize: 12.5, color: 'var(--ink-dim)', lineHeight: 1.5 }}>
            Preencha com um valor menor que o preço normal pra colocar o jogo em promoção: ele passa a ser vendido
            por esse valor, o preço da eShop (o &ldquo;preço original&rdquo; acima) continua riscado e o card ganha o
            selo &ldquo;PROMO&rdquo;. Apague o valor pra tirar da promoção. Atenção: o link de crédito parcelado tem o valor definido lá no Mercado
            Pago/PagSeguro — se o jogo tiver esse link, atualize o valor lá também.
          </p>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label htmlFor="creditPaymentUrl">Link de pagamento parcelado (opcional)</label>
          <input
            id="creditPaymentUrl"
            name="creditPaymentUrl"
            type="url"
            defaultValue={game?.credit_payment_url || ''}
            placeholder="Ex: https://mpago.la/xxxxxxx"
          />
          <p style={{ margin: '6px 2px 0', fontSize: 12.5, color: 'var(--ink-dim)' }}>
            Cole aqui o link de pagamento (Mercado Pago, PagSeguro etc.) que você gera fora do site. Quando
            preenchido, o cliente vê dois botões na tela de compra: "Pix à vista" (continua como já era) e
            "Crédito parcelado" (abre esse link). Deixe em branco pra manter só o botão único de sempre.
          </p>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label htmlFor="amazonJpUrl">Link na Amazon Japão (opcional)</label>
          <input
            id="amazonJpUrl"
            name="amazonJpUrl"
            type="url"
            defaultValue={game?.amazon_jp_url || ''}
            placeholder="Ex: https://www.amazon.co.jp/dp/XXXXXXXXXX"
          />
          <p style={{ margin: '6px 2px 0', fontSize: 12.5, color: 'var(--ink-dim)' }}>
            Só pra você: esse link vai junto no aviso de venda do Telegram, pra comprar o código rapidinho. O
            cliente nunca vê.
          </p>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label htmlFor="cardPoints">Pontos do card colecionável (1 a 5)</label>
          <input
            id="cardPoints"
            name="cardPoints"
            type="number"
            min={1}
            max={5}
            step={1}
            defaultValue={game?.card_points ?? 1}
            style={{ maxWidth: 120 }}
          />
          <p style={{ margin: '6px 2px 0', fontSize: 12.5, color: 'var(--ink-dim)' }}>
            Quanto vale o card desse jogo pro cliente que comprar — aparece como "gemas" preenchidas no card
            (ex: 3 pontos = 3 de 5 gemas) e soma pro total de pontos da conta dele.
          </p>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              id="discountEligible"
              name="discountEligible"
              type="checkbox"
              defaultChecked={game?.discount_eligible ?? false}
              style={{ width: 18, height: 18, accentColor: 'var(--green)' }}
            />
            <label htmlFor="discountEligible" style={{ margin: 0, textTransform: 'none', fontSize: 14, color: 'var(--ink)' }}>
              Jogo elegível pra desconto de pontos
            </label>
          </div>
          <p style={{ margin: '6px 2px 0', fontSize: 12.5, color: 'var(--ink-dim)' }}>
            Se marcado, o cliente pode usar um desconto de R$ 20 (trocado por 5 pontos) na compra desse jogo.
          </p>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label>Capa do jogo</label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {preview && !removeImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt=""
                style={{ width: 64, height: 85, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(164,99,255,.3)' }}
              />
            )}
            <input
              ref={fileInputRef}
              name="image"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ color: 'var(--ink-dim)', fontSize: 13 }}
            />
          </div>
          {isEditing && game?.image_url && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                id="removeImage"
                name="removeImage"
                type="checkbox"
                checked={removeImage}
                onChange={(e) => setRemoveImage(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--green)' }}
              />
              <label htmlFor="removeImage" style={{ margin: 0, textTransform: 'none', fontSize: 13, color: 'var(--ink)' }}>
                Remover a imagem atual
              </label>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label>Imagem do banner — Destaque da semana / Mais aguardados (opcional)</label>
          <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--ink-dim)' }}>
            Uma foto separada, mais larga, só pra esses dois banners no topo do site. Se não
            cadastrar, eles usam a capa do jogo esticada/cortada pra caber — funciona, mas uma
            imagem própria (tipo uma arte promocional do jogo) costuma ficar bem melhor.
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {bannerPreview && !removeBannerImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bannerPreview}
                alt=""
                style={{ width: 128, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(164,99,255,.3)' }}
              />
            )}
            <input
              ref={bannerFileInputRef}
              name="bannerImage"
              type="file"
              accept="image/*"
              onChange={handleBannerFileChange}
              style={{ color: 'var(--ink-dim)', fontSize: 13 }}
            />
          </div>
          {isEditing && game?.banner_image_url && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                id="removeBannerImage"
                name="removeBannerImage"
                type="checkbox"
                checked={removeBannerImage}
                onChange={(e) => setRemoveBannerImage(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--green)' }}
              />
              <label htmlFor="removeBannerImage" style={{ margin: 0, textTransform: 'none', fontSize: 13, color: 'var(--ink)' }}>
                Remover a imagem do banner (volta a usar a capa)
              </label>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label htmlFor="description">Descrição do jogo (aparece na tela de compra)</label>
          <textarea
            id="description"
            name="description"
            rows={4}
            maxLength={1000}
            defaultValue={game?.description ?? ''}
            placeholder="Conte um pouco sobre o jogo: gênero, modo de jogo, o que o cliente vai encontrar..."
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label>Capturas de tela (aparecem numa galeria na tela de compra)</label>
          <ScreenshotsField initialScreenshots={game?.screenshots ?? []} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <input
            id="hasBadge"
            name="hasBadge"
            type="checkbox"
            checked={hasBadge}
            onChange={(e) => setHasBadge(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: 'var(--green)' }}
          />
          <label htmlFor="hasBadge" style={{ margin: 0, textTransform: 'none', fontSize: 14, color: 'var(--ink)' }}>
            Adicionar etiqueta
          </label>
        </div>

        {hasBadge && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label htmlFor="badgeText">Texto da etiqueta</label>
              <input id="badgeText" name="badgeText" type="text" maxLength={14} defaultValue={game?.badge_text || 'TOP'} />
            </div>
            <div>
              <label htmlFor="badgeColor">Cor da etiqueta</label>
              <input id="badgeColor" name="badgeColor" type="color" defaultValue={game?.badge_color || '#4ef05f'} />
            </div>
          </div>
        )}

        {state.error && (
          <p style={{ color: '#ff8a8a', fontSize: 13, fontWeight: 600, margin: '0 0 14px' }}>{state.error}</p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <SubmitButton isEditing={isEditing} />
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

// Gerencia a lista de capturas de tela dentro do formulário de jogo. Cada
// imagem escolhida é comprimida no navegador (ver lib/imageCompression.ts —
// isso é o que evita estourar a banda do Vercel Blob) e enviada direto pro
// Blob assim que é selecionada, sem esperar o formulário ser salvo. As URLs
// já prontas viram inputs escondidos (<input type="hidden" name="screenshots">),
// que é como o Server Action (createGameAction/updateGameAction) recebe a
// lista quando o formulário inteiro é enviado.
function ScreenshotsField({ initialScreenshots }: { initialScreenshots: string[] }) {
  const [urls, setUrls] = useState<string[]>(initialScreenshots);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFilesChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setError(null);

    const remaining = 10 - urls.length;
    if (remaining <= 0) {
      setError('Máximo de 10 capturas de tela por jogo.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const toUpload = files.slice(0, remaining);

    setUploadingCount(toUpload.length);
    try {
      // Comprime cada imagem no navegador ANTES de enviar (ver
      // lib/imageCompression.ts) — é isso que evita que fotos de celular
      // de vários MB cada sejam baixadas na íntegra por todo visitante do
      // site depois. Só o arquivo já reduzido vai pro Supabase Storage.
      const uploaded = await Promise.all(
        toUpload.map(async (file) => {
          const compressed = await compressImageFile(file, 1600, 78);

          // Passo 1: pede pro servidor uma "autorização de upload" (o
          // servidor confere login e gera um token de uso único do
          // Supabase — veja app/api/screenshot-upload/route.ts).
          const res = await fetch('/api/screenshot-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: compressed.name })
          });
          const ticket = await res.json();
          if (!res.ok) throw new Error(ticket.error || 'Falha ao autorizar upload.');

          // Passo 2: com o token em mãos, o navegador manda o arquivo
          // direto pro Supabase — sem passar pelo nosso servidor de novo.
          await uploadToSignedTicket(ticket.path, ticket.token, compressed);
          return ticket.publicUrl as string;
        })
      );
      setUrls((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar uma das imagens.');
    } finally {
      setUploadingCount(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleRemove(url: string) {
    setUrls((prev) => prev.filter((u) => u !== url));
    // Repare que isso só tira a imagem da lista aqui no formulário — o
    // arquivo em si só é apagado do Supabase Storage quando o formulário é
    // salvo (updateGameAction compara a lista antiga com a nova).
  }

  return (
    <div>
      {urls.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          {urls.map((url) => (
            <div key={url} style={{ position: 'relative' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                loading="lazy"
                style={{ width: 84, height: 63, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(164,99,255,.3)' }}
              />
              <button
                type="button"
                onClick={() => handleRemove(url)}
                aria-label="Remover essa captura de tela"
                title="Remover"
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#ff5a5a',
                  color: '#fff',
                  border: '2px solid var(--panel)',
                  cursor: 'pointer',
                  fontSize: 11,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0
                }}
              >
                ✕
              </button>
              {/* Isso é o que realmente chega no Server Action quando o formulário é enviado. */}
              <input type="hidden" name="screenshots" value={url} />
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        disabled={uploadingCount > 0 || urls.length >= 10}
        onChange={handleFilesChosen}
        style={{ color: 'var(--ink-dim)', fontSize: 13 }}
      />
      {uploadingCount > 0 && (
        <p style={{ color: 'var(--ink-dim)', fontSize: 12.5, margin: '6px 0 0' }}>
          Enviando {uploadingCount} imagem{uploadingCount > 1 ? 'ns' : ''}...
        </p>
      )}
      {error && <p style={{ color: '#ff8a8a', fontSize: 12.5, fontWeight: 600, margin: '6px 0 0' }}>{error}</p>}
      <p style={{ color: 'var(--ink-dim)', fontSize: 12, margin: '6px 0 0' }}>
        {urls.length}/10 capturas de tela
      </p>
    </div>
  );
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn primary" disabled={pending}>
      {pending ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Adicionar'}
    </button>
  );
}
