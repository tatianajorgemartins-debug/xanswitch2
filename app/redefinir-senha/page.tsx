'use client';

// Página de destino do link de "esqueci minha senha" (ver
// sendPasswordResetEmail em lib/wishlist.ts). Quando a pessoa clica no link
// do e-mail, o Supabase já autentica ela temporariamente nesse navegador
// (uma "sessão de recuperação") — essa página só espera esse login
// acontecer e mostra o formulário de senha nova.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthChange, updatePassword, translateAuthError, getCurrentUser } from '@/lib/wishlist';

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // getCurrentUser cobre o caso de já ter uma sessão de recuperação
    // assim que a página carrega; onAuthChange cobre o caso do Supabase
    // ainda estar processando o link no momento em que a página abriu.
    getCurrentUser()
      .then((user) => {
        if (user) setReady(true);
      })
      .catch(() => {});
    return onAuthChange((user) => {
      if (user) setReady(true);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setStatus('error');
      setErrorMessage('As duas senhas precisam ser iguais.');
      return;
    }
    setStatus('submitting');
    try {
      await updatePassword(password);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrorMessage(translateAuthError(err instanceof Error ? err.message : 'Não foi possível trocar a senha.'));
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="account-modal" style={{ position: 'static', maxWidth: 380, width: '100%' }}>
        <div className="purchase-modal-header">
          <span className="purchase-modal-title">Nova senha</span>
        </div>
        <div className="purchase-modal-body">
          {status === 'done' ? (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <p style={{ fontSize: 34, marginBottom: 10 }}>✓</p>
              <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 10 }}>
                Senha alterada com sucesso!
              </p>
              <button type="button" className="btn primary" onClick={() => router.push('/')}>
                Voltar pro site
              </button>
            </div>
          ) : !ready ? (
            <p style={{ textAlign: 'center', color: 'var(--ink-dim)', fontWeight: 600 }}>
              Confirmando seu link de recuperação...
            </p>
          ) : (
            <form onSubmit={handleSubmit}>
              <p style={{ fontSize: 13.5, color: 'var(--ink-dim)', lineHeight: 1.5, marginBottom: 16 }}>
                Escolha uma nova senha pra sua conta XAN Switch.
              </p>
              <label htmlFor="new-password">Nova senha</label>
              <input
                id="new-password"
                type="password"
                required
                minLength={6}
                placeholder="Pelo menos 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={status === 'submitting'}
                autoComplete="new-password"
                style={{ marginBottom: 14 }}
              />
              <label htmlFor="confirm-password">Confirme a nova senha</label>
              <input
                id="confirm-password"
                type="password"
                required
                minLength={6}
                placeholder="Digite de novo"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={status === 'submitting'}
                autoComplete="new-password"
              />
              {status === 'error' && (
                <p style={{ color: '#ff8a8a', fontSize: 13, fontWeight: 600, margin: '10px 0 0' }}>{errorMessage}</p>
              )}
              <div className="purchase-modal-actions" style={{ marginTop: 16 }}>
                <button type="submit" className="btn primary" disabled={status === 'submitting'}>
                  {status === 'submitting' ? 'Só um instante...' : 'Salvar nova senha'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
