'use client';

// Modal de conta do cliente: login com e-mail e senha, campo opcional de
// Instagram, e a lista de desejos de quem está logado. Reaproveita o
// mesmo "esqueleto" de modal do PurchaseModal.tsx (fundo escurecido,
// fecha com Esc ou clicando fora, trava o scroll da página).
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Item } from './CatalogClient';
import { signUp, signIn, signOut, getInstagramHandle, saveInstagramHandle } from '@/lib/wishlist';

export default function AccountModal({
  open,
  onClose,
  user,
  wishlistItems,
  onOpenGame,
  onRemoveFromWishlist,
  onBulkPurchase
}: {
  open: boolean;
  onClose: () => void;
  user: User | null;
  wishlistItems: Item[];
  onOpenGame: (item: Item) => void;
  onRemoveFromWishlist: (gameId: number) => void;
  onBulkPurchase: (items: Item[]) => void;
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
        className="account-modal"
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
            />
          ) : (
            <LoginForm />
          )}
        </div>
      </div>
    </div>
  );
}

// Traduz as mensagens de erro do Supabase (vêm em inglês) pras mais comuns
// que um cliente pode ver aqui, sem gerar um texto técnico na tela dele.
function translateAuthError(message: string): string {
  const known: Record<string, string> = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'User already registered': 'Esse e-mail já tem uma conta — tenta entrar em vez de criar uma nova.',
    'Password should be at least 6 characters': 'A senha precisa ter pelo menos 6 caracteres.',
    'Email not confirmed': 'Esse e-mail ainda não foi confirmado — verifica sua caixa de entrada.'
  };
  return known[message] ?? message;
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

  function switchMode(next: 'login' | 'signup') {
    setMode(next);
    setStatus('idle');
    setErrorMessage('');
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
  onBulkPurchase
}: {
  user: User;
  wishlistItems: Item[];
  onOpenGame: (item: Item) => void;
  onRemoveFromWishlist: (gameId: number) => void;
  onBulkPurchase: (items: Item[]) => void;
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

  useEffect(() => {
    let cancelled = false;
    getInstagramHandle()
      .then((value) => {
        if (!cancelled) setInstagram(value ?? '');
      })
      .finally(() => {
        if (!cancelled) setLoadingInstagram(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSaveInstagram(e: React.FormEvent) {
    e.preventDefault();
    setSavingInstagram(true);
    setInstagramError('');
    try {
      await saveInstagramHandle(instagram.trim().replace(/^@/, ''));
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
            {wishlistItems.map((item) => (
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
