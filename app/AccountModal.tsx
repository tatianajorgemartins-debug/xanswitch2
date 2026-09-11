'use client';

// Modal de conta do cliente: login por e-mail (link mágico, sem senha),
// campo opcional de Instagram, e a lista de desejos de quem está logado.
// Reaproveita o mesmo "esqueleto" de modal do PurchaseModal.tsx (fundo
// escurecido, fecha com Esc ou clicando fora, trava o scroll da página).
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Item } from './CatalogClient';
import { sendMagicLink, signOut, getInstagramHandle, saveInstagramHandle } from '@/lib/wishlist';

export default function AccountModal({
  open,
  onClose,
  user,
  wishlistItems,
  onOpenGame,
  onRemoveFromWishlist
}: {
  open: boolean;
  onClose: () => void;
  user: User | null;
  wishlistItems: Item[];
  onOpenGame: (item: Item) => void;
  onRemoveFromWishlist: (gameId: number) => void;
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
            />
          ) : (
            <LoginForm />
          )}
        </div>
      </div>
    </div>
  );
}

// Tela de login: só um campo de e-mail. Sem senha — a pessoa recebe um
// link no e-mail e, ao clicar, já entra logada automaticamente (se for a
// primeira vez, a conta é criada nesse mesmo clique).
function LoginForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    try {
      await sendMagicLink(email.trim());
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível enviar o link.');
    }
  }

  if (status === 'sent') {
    return (
      <div style={{ textAlign: 'center', padding: '10px 0' }}>
        <p style={{ fontSize: 34, marginBottom: 10 }}>✉️</p>
        <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 6 }}>
          Enviamos um link pro seu e-mail!
        </p>
        <p style={{ fontSize: 13.5, color: 'var(--ink-dim)', lineHeight: 1.5 }}>
          Abre a caixa de entrada de <strong style={{ color: 'var(--ink)' }}>{email}</strong> e clica no
          link — você já entra automaticamente, sem precisar de senha.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ fontSize: 13.5, color: 'var(--ink-dim)', lineHeight: 1.5, marginBottom: 16 }}>
        Entre com seu e-mail pra salvar jogos na sua lista de desejos. Sem senha — a gente manda um
        link de acesso direto pra sua caixa de entrada.
      </p>
      <label htmlFor="account-email">Seu e-mail</label>
      <input
        id="account-email"
        type="email"
        required
        placeholder="voce@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={status === 'sending'}
      />
      {status === 'error' && (
        <p style={{ color: '#ff8a8a', fontSize: 13, fontWeight: 600, margin: '10px 0 0' }}>{errorMessage}</p>
      )}
      <div className="purchase-modal-actions" style={{ marginTop: 16 }}>
        <button type="submit" className="btn primary" disabled={status === 'sending'}>
          {status === 'sending' ? 'Enviando...' : 'Enviar link de acesso'}
        </button>
      </div>
    </form>
  );
}

// Tela de quem já está logado: e-mail da conta, campo de Instagram
// (opcional — só ajuda você a reconhecer o cliente depois) e a lista de
// desejos dele.
function LoggedInView({
  user,
  wishlistItems,
  onOpenGame,
  onRemoveFromWishlist
}: {
  user: User;
  wishlistItems: Item[];
  onOpenGame: (item: Item) => void;
  onRemoveFromWishlist: (gameId: number) => void;
}) {
  const [instagram, setInstagram] = useState('');
  const [loadingInstagram, setLoadingInstagram] = useState(true);
  const [savingInstagram, setSavingInstagram] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

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
    try {
      await saveInstagramHandle(instagram.trim().replace(/^@/, ''));
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
    } catch {
      // Se falhar, a pessoa só tenta salvar de novo — não é uma informação
      // crítica pro funcionamento do site.
    } finally {
      setSavingInstagram(false);
    }
  }

  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <p className="purchase-description-label" style={{ marginBottom: 4 }}>
          Logado como
        </p>
        <p style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' }}>{user.email}</p>
      </div>

      <form onSubmit={handleSaveInstagram} style={{ marginBottom: 22 }}>
        <label htmlFor="account-instagram">Seu Instagram (opcional)</label>
        <div style={{ display: 'flex', gap: 8 }}>
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
      </form>

      <p className="purchase-description-label" style={{ marginBottom: 10 }}>
        Sua lista de desejos {wishlistItems.length > 0 ? `(${wishlistItems.length})` : ''}
      </p>

      {wishlistItems.length === 0 ? (
        <p style={{ fontSize: 13.5, color: 'var(--ink-dim)', marginBottom: 18 }}>
          Ainda vazia — clica no ♡ de qualquer jogo do catálogo pra favoritar.
        </p>
      ) : (
        <div className="wishlist-list">
          {wishlistItems.map((item) => (
            <div key={item.id} className="wishlist-row">
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
                className="wishlist-row-remove"
                onClick={() => onRemoveFromWishlist(item.id)}
                aria-label={`Remover ${item.name} da lista de desejos`}
                title="Remover"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={15} height={15}>
                  <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a1 1 0 01-1 1H7a1 1 0 01-1-1V6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="purchase-modal-actions">
        <button type="button" className="purchase-step-back" onClick={() => signOut()}>
          Sair da conta
        </button>
      </div>
    </>
  );
}
