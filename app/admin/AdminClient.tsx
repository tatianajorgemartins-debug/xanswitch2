'use client';

import { useMemo, useRef, useState, useEffect, useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { uploadToSignedTicket } from '@/lib/supabaseBrowser';
import type { Game, Review, Order } from '@/lib/db';
import { getContrastColor } from '@/lib/color';
import { formatPriceBR } from '@/lib/whatsapp';
import { compressImageFile } from '@/lib/imageCompression';
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
  type GameFormState
} from './actions';

const emptyFormState: GameFormState = { error: null };

export default function AdminClient({
  initialGames,
  visitCount,
  reviews,
  orders,
  wishlistCounts
}: {
  initialGames: Game[];
  visitCount: number;
  reviews: Review[];
  orders: Order[];
  wishlistCounts: Record<number, number>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showReviewsPanel, setShowReviewsPanel] = useState(false);
  const [showOrdersPanel, setShowOrdersPanel] = useState(false);
  const [showWishlistPanel, setShowWishlistPanel] = useState(false);
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

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
        <div className="brand">
          XAN<span>SWITCH</span>
        </div>
        <p style={{ color: 'var(--ink-dim)', fontSize: 14.5, fontWeight: 600, margin: 0, flex: 1 }}>
          Painel de administração — adicione, edite, arquive e exclua os jogos do catálogo.
        </p>
        <span
          title="Visitas no catálogo público, sem contar você (quando está com sessão ativa no admin no mesmo navegador)"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--panel)',
            border: '1px solid rgba(164,99,255,.3)',
            borderRadius: 10,
            padding: '9px 14px',
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--ink)'
          }}
        >
          👁 <span style={{ color: 'var(--green)' }}>{visitCount}</span> visitas
        </span>
        <a href="/" target="_blank" rel="noreferrer" className="btn ghost">
          🔗 Ver catálogo público
        </a>
        <form action={logoutAction}>
          <button type="submit" className="btn ghost">
            Sair
          </button>
        </form>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div
          style={{
            flex: 1,
            minWidth: 220,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--panel)',
            border: '1px solid rgba(164,99,255,.3)',
            borderRadius: 10,
            padding: '10px 14px'
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
        <button className="btn primary" onClick={openAddPanel}>
          ＋ Adicionar jogo
        </button>
        <button className="btn ghost" onClick={() => setShowArchived((s) => !s)}>
          📦 Arquivados ({archivedGames.length})
        </button>
        <button className="btn ghost" onClick={() => setShowReviewsPanel((s) => !s)}>
          💬 Comentários{pendingReviewCount > 0 ? ` (${pendingReviewCount} pendente${pendingReviewCount > 1 ? 's' : ''})` : ''}
        </button>
        <button className="btn ghost" onClick={() => setShowOrdersPanel((s) => !s)}>
          📋 Pedidos ({orders.length})
        </button>
        <button className="btn ghost" onClick={() => setShowWishlistPanel((s) => !s)}>
          ❤️ Mais desejados ({mostWantedGames.length})
        </button>
      </div>

      {showReviewsPanel && (
        <ReviewsPanel
          reviews={reviews}
          onApprove={handleApproveReview}
          onDelete={handleDeleteReview}
          onToggleFeatured={handleToggleFeaturedReview}
        />
      )}

      {showOrdersPanel && <OrdersPanel orders={orders} onDelete={handleDeleteOrder} />}

      {showWishlistPanel && <WishlistPanel entries={mostWantedGames} />}

      {panelOpen && (
        <GameFormPanel
          game={editingGame}
          allFranchises={allFranchises}
          onClose={closePanel}
          onSaved={() => { closePanel(); router.refresh(); }}
        />
      )}

      {showArchived && (
        <div
          style={{
            background: 'var(--panel)',
            border: '1px solid rgba(164,99,255,.25)',
            borderRadius: 14,
            padding: 16,
            marginBottom: 20
          }}
        >
          {archivedGames.length === 0 ? (
            <p style={{ color: 'var(--ink-dim)', fontSize: 14, padding: '10px 6px' }}>
              Nenhum jogo arquivado.
            </p>
          ) : (
            archivedGames.map((g) => (
              <div
                key={g.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 6px',
                  borderBottom: '1px solid rgba(255,255,255,.06)'
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.image_url || ''}
                  alt=""
                  loading="lazy"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 6,
                    objectFit: 'cover',
                    background: 'var(--bg-dark)',
                    border: '1px solid rgba(164,99,255,.3)'
                  }}
                />
                <span style={{ flex: 1, fontWeight: 700, fontSize: 14.5 }}>{g.name}</span>
                <button className="btn ghost" onClick={() => handleArchive(g.id, false)}>
                  ↺ Restaurar
                </button>
                <button className="btn ghost" onClick={() => handleDelete(g.id, g.name)}>
                  🗑
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {activeGames.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-dim)' }}>
          <p style={{ fontSize: 15, fontWeight: 600 }}>
            Nenhum jogo ainda. Clique em &quot;＋ Adicionar jogo&quot; pra começar seu catálogo.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 20
          }}
        >
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

// Histórico de "intenção de compra": uma linha aparece aqui toda vez que
// alguém gera um QR Code Pix no modal de compra do catálogo. NÃO é uma
// confirmação de pagamento — serve pra você não perder o rastro se alguém
// pagar e esquecer de chamar no WhatsApp depois. A confirmação de verdade
// continua sendo feita manualmente, vendo o Pix cair na sua conta.
function OrdersPanel({ orders, onDelete }: { orders: Order[]; onDelete: (id: number) => void }) {
  return (
    <div
      style={{
        background: 'var(--panel)',
        border: '1px solid rgba(164,99,255,.25)',
        borderRadius: 14,
        padding: 16,
        marginBottom: 20
      }}
    >
      <h4 style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        Pedidos gerados (mais recentes primeiro)
      </h4>
      {orders.length === 0 ? (
        <p style={{ color: 'var(--ink-dim)', fontSize: 14, padding: '6px 2px', margin: 0 }}>
          Nenhum pedido registrado ainda.
        </p>
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
                  {o.customer_email && (
                    <span style={{ color: 'var(--ink-dim)', fontSize: 12.5 }}>✉ {o.customer_email}</span>
                  )}
                  {o.referral_source && (
                    <span style={{ color: 'var(--ink-dim)', fontSize: 12.5 }}>📣 {o.referral_source}</span>
                  )}
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: 'var(--purple-2)',
                      background: 'rgba(164,99,255,.12)',
                      border: '1px solid rgba(164,99,255,.3)',
                      borderRadius: 6,
                      padding: '2px 8px'
                    }}
                  >
                    {o.status}
                  </span>
                </div>
              </div>
              <button className="btn ghost" onClick={() => onDelete(o.id)} style={{ flex: 'none' }}>
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WishlistPanel({ entries }: { entries: { game: Game; count: number }[] }) {
  return (
    <div
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
