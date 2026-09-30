'use client';

// Modal de conta do cliente: login com e-mail e senha, campo opcional de
// Instagram, e a lista de desejos de quem está logado. Reaproveita o
// mesmo "esqueleto" de modal do PurchaseModal.tsx (fundo escurecido,
// fecha com Esc ou clicando fora, trava o scroll da página).
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Item } from './CatalogClient';
import {
  signUp,
  signIn,
  signOut,
  getInstagramHandle,
  saveInstagramHandle,
  translateAuthError,
  getAccessToken,
  sendPasswordResetEmail
} from '@/lib/wishlist';
import { getMyCardsAction, redeemDiscountAction, type CardSummary } from './cardActions';
import { CollectibleCard, DownloadCardButton } from './CollectibleCard';

const WISHLIST_PREVIEW_LIMIT = 5;

export default function AccountModal({
  open,
  onClose,
  user,
  wishlistItems,
  onOpenGame,
  onRemoveFromWishlist,
  onBulkPurchase,
  onInstagramSaved
}: {
  open: boolean;
  onClose: () => void;
  user: User | null;
  wishlistItems: Item[];
  onOpenGame: (item: Item) => void;
  onRemoveFromWishlist: (gameId: number) => void;
  onBulkPurchase: (items: Item[]) => void;
  // Avisa o CatalogClient assim que o Instagram é salvo, pra atualizar o
  // texto do botão de conta no cabeçalho na hora, sem esperar reabrir o
  // popup.
  onInstagramSaved: (handle: string) => void;
}) {
  // Fecha com Esc, trava o scroll de fundo — mesmo comportamento de
  // qualquer outro modal do site.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="purchase-modal-overlay" onClick={onClose}>
      <div
        className={`account-modal${user ? ' is-logged-in' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={user ? 'Minha conta' : 'Entrar'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="purchase-modal-header">
          <span className="purchase-modal-title">{user ? 'Minha conta' : 'Entrar'}</span>
          <button type="button" className="purchase-modal-close" onClick={onClose} aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width={18} height={18}>
              <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="purchase-modal-body">
          {user ? (
            <LoggedInView
              user={user}
              wishlistItems={wishlistItems}
              onOpenGame={(item) => {
                onClose();
                onOpenGame(item);
              }}
              onRemoveFromWishlist={onRemoveFromWishlist}
              onBulkPurchase={(items) => {
                onClose();
                onBulkPurchase(items);
              }}
              onInstagramSaved={onInstagramSaved}
            />
          ) : (
            <LoginForm />
          )}
        </div>
      </div>
    </div>
  );
}

// Tela de entrar/criar conta: só e-mail e senha, sem link nenhum pra
// clicar. Alterna entre os dois modos (entrar / criar conta) no mesmo
// formulário. Quando o login/cadastro dá certo, essa tela nem chega a
// mostrar nada — o AccountModal já troca sozinho pra LoggedInView assim
// que o `user` muda lá em cima, no CatalogClient.
function LoginForm() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'needsConfirmation' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [resetStatus, setResetStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  function switchMode(next: 'login' | 'signup') {
    setMode(next);
    setStatus('idle');
    setErrorMessage('');
    setResetStatus('idle');
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setStatus('error');
      setErrorMessage('Digite seu e-mail acima primeiro, aí clica em "Esqueci minha senha" de novo.');
      return;
    }
    setResetStatus('sending');
    try {
      await sendPasswordResetEmail(email.trim());
      setResetStatus('sent');
    } catch {
      // O Supabase não deixa saber se o e-mail existe ou não por segurança
      // — então mesmo num erro, mostramos a mesma mensagem de "enviamos".
      setResetStatus('sent');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    try {
      if (mode === 'signup') {
        const { confirmedImmediately } = await signUp(email.trim(), password);
        if (!confirmedImmediately) {
          // Só acontece se "Confirm email" ainda estiver ligado no
          // Supabase (veja o README) — a conta foi criada, mas precisa
          // confirmar o e-mail antes de conseguir entrar.
          setStatus('needsConfirmation');
          return;
        }
      } else {
        await signIn(email.trim(), password);
      }
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setErrorMessage(translateAuthError(err instanceof Error ? err.message : 'Não foi possível continuar.'));
    }
  }

  if (status === 'needsConfirmation') {
    return (
      <div style={{ textAlign: 'center', padding: '10px 0' }}>
        <p style={{ fontSize: 34, marginBottom: 10 }}>✉️</p>
        <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 6 }}>
          Falta confirmar seu e-mail
        </p>
        <p style={{ fontSize: 13.5, color: 'var(--ink-dim)', lineHeight: 1.5 }}>
          Abre a caixa de entrada de <strong style={{ color: 'var(--ink)' }}>{email}</strong> e clica no
          link de confirmação pra poder entrar.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ fontSize: 13.5, color: 'var(--ink-dim)', lineHeight: 1.5, marginBottom: 16 }}>
        {mode === 'signup'
          ? 'Cria sua conta com e-mail e senha pra salvar jogos na sua lista de desejos.'
          : 'Entre com seu e-mail e senha pra ver sua lista de desejos.'}
      </p>
      <label htmlFor="account-email">Seu e-mail</label>
      <input
        id="account-email"
        type="email"
        required
        placeholder="voce@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={status === 'submitting'}
        style={{ marginBottom: 14 }}
      />
      <label htmlFor="account-password">Sua senha</label>
      <input
        id="account-password"
        type="password"
        required
        minLength={6}
        placeholder="Pelo menos 6 caracteres"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={status === 'submitting'}
        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
      />
      {mode === 'login' && (
        <p style={{ textAlign: 'right', margin: '6px 0 0' }}>
          {resetStatus === 'sent' ? (
            <span style={{ fontSize: 12.5, color: 'var(--green)', fontWeight: 700 }}>
              ✓ Se esse e-mail tiver conta, mandamos um link pra trocar a senha.
            </span>
          ) : (
            <button
              type="button"
              className="account-mode-switch"
              style={{ fontSize: 12.5 }}
              onClick={handleForgotPassword}
              disabled={resetStatus === 'sending'}
            >
              {resetStatus === 'sending' ? 'Enviando...' : 'Esqueci minha senha'}
            </button>
          )}
        </p>
      )}
      {status === 'error' && (
        <p style={{ color: '#ff8a8a', fontSize: 13, fontWeight: 600, margin: '10px 0 0' }}>{errorMessage}</p>
      )}
      <div className="purchase-modal-actions" style={{ marginTop: 16 }}>
        <button type="submit" className="btn primary" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Só um instante...' : mode === 'signup' ? 'Criar conta' : 'Entrar'}
        </button>
      </div>
      <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-dim)', marginTop: 4 }}>
        {mode === 'signup' ? (
          <>
            Já tem conta?{' '}
            <button type="button" className="account-mode-switch" onClick={() => switchMode('login')}>
              Entrar
            </button>
          </>
        ) : (
          <>
            Ainda não tem conta?{' '}
            <button type="button" className="account-mode-switch" onClick={() => switchMode('signup')}>
              Criar conta
            </button>
          </>
        )}
      </p>
    </form>
  );
}

// Tela de quem já está logado: um cabeçalho com avatar + e-mail, o campo de
// Instagram (opcional — só ajuda você a reconhecer o cliente depois) e a
// lista de desejos dele, com caixinhas de seleção pra comprar vários jogos
// de uma vez (ver BulkPurchaseModal.tsx).
function LoggedInView({
  user,
  wishlistItems,
  onOpenGame,
  onRemoveFromWishlist,
  onBulkPurchase,
  onInstagramSaved
}: {
  user: User;
  wishlistItems: Item[];
  onOpenGame: (item: Item) => void;
  onRemoveFromWishlist: (gameId: number) => void;
  onBulkPurchase: (items: Item[]) => void;
  onInstagramSaved: (handle: string) => void;
}) {
  const [instagram, setInstagram] = useState('');
  const [loadingInstagram, setLoadingInstagram] = useState(true);
  const [savingInstagram, setSavingInstagram] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [instagramError, setInstagramError] = useState('');
  // Todo mundo começa marcado (é mais comum querer comprar tudo do que só
  // uma parte) — a pessoa desmarca o que não quiser levar agora. O modal
  // reabre do zero toda vez, então não precisa reagir a itens removidos
  // enquanto está aberto (não dá pra tirar/favoritar nada com ele aberto).
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    () => new Set(wishlistItems.map((item) => item.id))
  );
  // Mostra só os 5 primeiros favoritos por padrão — a lista pode ficar
  // enorme, e isso evita o popup crescer sem fim. A seleção pra comprar
  // continua valendo pra lista inteira, mesmo com o resto escondido.
  const [showAllWishlist, setShowAllWishlist] = useState(false);

  // Cards colecionáveis + pontos — ficam escondidos atrás do botão "Ver
  // coleção de cards" (ver mais abaixo), então só busca no servidor na
  // primeira vez que a pessoa clica, não toda vez que abre "Minha conta".
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collectionLoaded, setCollectionLoaded] = useState(false);
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [confirmedPoints, setConfirmedPoints] = useState(0);
  const [pendingPoints, setPendingPoints] = useState(0);
  const [availableDiscountCount, setAvailableDiscountCount] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(20);
  const [pointsPerDiscount, setPointsPerDiscount] = useState(5);
  const [loadingCards, setLoadingCards] = useState(false);
  const [cardsError, setCardsError] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMessage, setRedeemMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    getInstagramHandle()
      .then((value) => {
        if (!cancelled) setInstagram(value ?? '');
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingInstagram(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A Server Action getMyCardsAction roda no servidor e precisa de um jeito
  // de confirmar quem está pedindo — por isso manda o token da sessão atual
  // em vez de só o e-mail (ver o comentário em app/cardActions.ts pra
  // entender por quê).
  function loadCollection() {
    setLoadingCards(true);
    setCardsError('');
    getAccessToken()
      .then((token) => {
        if (!token) throw new Error('Sessão inválida — entre de novo na sua conta.');
        return getMyCardsAction(token);
      })
      .then((result) => {
        if (result.ok) {
          setCards(result.cards);
          setConfirmedPoints(result.confirmedPoints);
          setPendingPoints(result.pendingPoints);
          setAvailableDiscountCount(result.availableDiscountCount);
          setDiscountAmount(result.discountAmount);
          setPointsPerDiscount(result.pointsPerDiscount);
          setCollectionLoaded(true);
        } else {
          setCardsError(result.error);
        }
      })
      .catch((err) => {
        setCardsError(err instanceof Error ? err.message : 'Não foi possível carregar seus cards.');
      })
      .finally(() => setLoadingCards(false));
  }

  function handleToggleCollection() {
    const opening = !collectionOpen;
    setCollectionOpen(opening);
    if (opening && !collectionLoaded) loadCollection();
  }

  async function handleRedeemDiscount() {
    setRedeeming(true);
    setRedeemMessage('');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Sessão inválida — entre de novo na sua conta.');
      const result = await redeemDiscountAction(token);
      if (result.ok) {
        setRedeemMessage(
          `✓ Desconto de R$ ${discountAmount.toFixed(2).replace('.', ',')} liberado! Use na sua próxima compra de um jogo elegível.`
        );
        loadCollection();
      } else {
        setRedeemMessage(result.error);
      }
    } catch (err) {
      setRedeemMessage(err instanceof Error ? err.message : 'Não foi possível trocar agora.');
    } finally {
      setRedeeming(false);
    }
  }

  async function handleSaveInstagram(e: React.FormEvent) {
    e.preventDefault();
    setSavingInstagram(true);
    setInstagramError('');
    try {
      const cleaned = instagram.trim().replace(/^@/, '');
      await saveInstagramHandle(cleaned);
      onInstagramSaved(cleaned);
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
    } catch (err) {
      // Antes esse erro era escondido (a pessoa clicava em "Salvar" e nada
      // parecia acontecer) — agora mostra o motivo, pra dar pra perceber
      // se falta rodar a migração do banco no Supabase, por exemplo.
      setInstagramError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSavingInstagram(false);
    }
  }

  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = wishlistItems.length > 0 && wishlistItems.every((item) => selectedIds.has(item.id));
  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(wishlistItems.map((item) => item.id)));
  }

  const selectedItems = wishlistItems.filter((item) => selectedIds.has(item.id));
  const selectedTotalLabel = selectedItems.reduce((sum, item) => sum + item.price, 0).toFixed(2).replace('.', ',');
  const initials = user.email ? user.email.slice(0, 2).toUpperCase() : '?';
  const visibleWishlistItems = showAllWishlist ? wishlistItems : wishlistItems.slice(0, WISHLIST_PREVIEW_LIMIT);
  const hiddenWishlistCount = wishlistItems.length - visibleWishlistItems.length;

  return (
    <>
      <div className="account-profile-header">
        <div className="account-avatar" aria-hidden="true">
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <p className="account-profile-email">{user.email}</p>
          <p className="account-profile-sub">Cliente XAN Switch</p>
        </div>
      </div>

      <button type="button" className={`account-collection-toggle${collectionOpen ? ' is-open' : ''}`} onClick={handleToggleCollection}>
        <span className="account-collection-toggle-icon" aria-hidden="true">🎴</span>
        <span className="account-collection-toggle-text">
          <strong>{collectionOpen ? 'Esconder coleção' : 'Ver coleção de cards'}</strong>
          {!collectionOpen && <span>seus cards e pontos de fidelidade</span>}
        </span>
        <svg
          className="account-collection-toggle-chevron"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          width={16}
          height={16}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {collectionOpen &&
        (loadingCards ? (
          <p style={{ fontSize: 13, color: 'var(--ink-dim)', padding: '4px 2px' }}>Carregando seus cards...</p>
        ) : cardsError ? (
          <p style={{ color: '#ff8a8a', fontSize: 12.5, fontWeight: 600, padding: '4px 2px' }}>{cardsError}</p>
        ) : cards.length === 0 ? (
          <div className="account-wishlist-empty">
            <p style={{ fontSize: 30, margin: '0 0 6px' }}>🎴</p>
            <p style={{ margin: 0 }}>Sua primeira compra confirmada já vem com um card de presente.</p>
          </div>
        ) : (
          <>
            <div className="account-points-summary">
              <div>
                <p className="account-points-value">{confirmedPoints}</p>
                <p className="account-points-label">pontos confirmados</p>
              </div>
              {pendingPoints > 0 && (
                <div>
                  <p className="account-points-value is-pending">{pendingPoints}</p>
                  <p className="account-points-label">pendente{pendingPoints > 1 ? 's' : ''}</p>
                </div>
              )}
            </div>

            {availableDiscountCount > 0 && (
              <p className="account-discount-available">
                🎟️ Você tem R$ {discountAmount.toFixed(2).replace('.', ',')} de desconto pronto pra usar na sua
                próxima compra de um jogo elegível!
              </p>
            )}

            {confirmedPoints >= pointsPerDiscount && (
              <div className="account-redeem-box">
                <p>
                  Troque {pointsPerDiscount} pontos por R$ {discountAmount.toFixed(2).replace('.', ',')} de desconto
                </p>
                <button type="button" className="btn credit" onClick={handleRedeemDiscount} disabled={redeeming}>
                  {redeeming ? 'Trocando...' : 'Trocar pontos por desconto'}
                </button>
              </div>
            )}
            {redeemMessage && (
              <p
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: redeemMessage.startsWith('✓') ? 'var(--green)' : '#ff8a8a',
                  margin: '8px 2px 0'
                }}
              >
                {redeemMessage}
              </p>
            )}

            <div className="account-cards-row">
              {cards.map((card) => (
                <div key={card.orderId} className="account-card-item">
                  <CollectibleCard
                    gameName={card.gameName}
                    imageUrl={card.imageUrl}
                    points={card.points}
                    pending={!card.confirmed}
                    compact
                  />
                  <DownloadCardButton gameName={card.gameName} imageUrl={card.imageUrl} points={card.points} />
                </div>
              ))}
            </div>
          </>
        ))}

      <form onSubmit={handleSaveInstagram} className="account-instagram-field">
        <label htmlFor="account-instagram">Seu Instagram (opcional)</label>
        <div className="account-instagram-row">
          <span className="account-instagram-prefix">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={15} height={15}>
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <input
            id="account-instagram"
            type="text"
            placeholder="seu.usuario"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            disabled={loadingInstagram || savingInstagram}
          />
          <button type="submit" className="btn ghost" disabled={loadingInstagram || savingInstagram}>
            Salvar
          </button>
        </div>
        {savedFeedback && <p className="purchase-copy-feedback" style={{ margin: '8px 0 0' }}>✓ Salvo!</p>}
        {instagramError && (
          <p style={{ color: '#ff8a8a', fontSize: 12.5, fontWeight: 600, margin: '8px 0 0' }}>{instagramError}</p>
        )}
      </form>

      <div className="account-section-header">
        <p className="purchase-description-label" style={{ margin: 0 }}>
          ❤️ Lista de desejos {wishlistItems.length > 0 ? `(${wishlistItems.length})` : ''}
        </p>
        {wishlistItems.length > 1 && (
          <button type="button" className="account-select-all" onClick={toggleSelectAll}>
            {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
          </button>
        )}
      </div>

      {wishlistItems.length > 0 && (
        <p className="account-wishlist-hint">
          A caixinha é só pra escolher o que comprar agora — pra tirar um jogo da lista de desejos,
          clica no coração ❤️.
        </p>
      )}

      {wishlistItems.length === 0 ? (
        <div className="account-wishlist-empty">
          <p style={{ fontSize: 30, margin: '0 0 6px' }}>🤍</p>
          <p style={{ margin: 0 }}>Ainda vazia — clica no ♡ de qualquer jogo do catálogo pra favoritar.</p>
        </div>
      ) : (
        <>
          <div className="wishlist-list">
            {visibleWishlistItems.map((item) => (
              <div key={item.id} className={`wishlist-row${selectedIds.has(item.id) ? ' is-selected' : ''}`}>
                <input
                  type="checkbox"
                  className="wishlist-row-checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleSelected(item.id)}
                  aria-label={`Selecionar ${item.name} pra comprar`}
                />
                <button type="button" className="wishlist-row-main" onClick={() => onOpenGame(item)}>
                  <span className="wishlist-row-cover">
                    {item.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" loading="lazy" />
                    )}
                  </span>
                  <span className="wishlist-row-info">
                    <span className="wishlist-row-name">{item.name}</span>
                    <span className="wishlist-row-price">R$ {item.priceLabel}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="wishlist-heart-button list-row-heart active"
                  onClick={() => onRemoveFromWishlist(item.id)}
                  aria-label={`Tirar ${item.name} da lista de desejos`}
                  title="Tirar dos favoritos"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" width={16} height={16}>
                    <path d="M12 20.5s-7.5-4.6-10-9.3C.5 7.8 2.3 4.5 5.6 4c2-.3 3.9.6 5 2.3a5.3 5.3 0 015-2.3c3.3.5 5.1 3.8 3.6 7.2-2.5 4.7-10 9.3-10 9.3z" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {hiddenWishlistCount > 0 && (
            <button type="button" className="account-show-all-wishlist" onClick={() => setShowAllWishlist(true)}>
              Ver todos os favoritos ({wishlistItems.length})
            </button>
          )}
          {showAllWishlist && wishlistItems.length > WISHLIST_PREVIEW_LIMIT && (
            <button type="button" className="account-show-all-wishlist" onClick={() => setShowAllWishlist(false)}>
              Ver menos
            </button>
          )}

          <div className="account-bulk-bar">
            <span className="account-bulk-total">
              {selectedItems.length === 0
                ? 'Nenhum selecionado'
                : `${selectedItems.length} selecionado${selectedItems.length > 1 ? 's' : ''} · R$ ${selectedTotalLabel}`}
            </span>
            <button
              type="button"
              className="btn green"
              disabled={selectedItems.length === 0}
              onClick={() => onBulkPurchase(selectedItems)}
            >
              Comprar selecionados
            </button>
          </div>
        </>
      )}

      <div className="purchase-modal-actions">
        <button type="button" className="purchase-step-back" onClick={() => signOut()}>
          Sair da conta
        </button>
      </div>
    </>
  );
}
