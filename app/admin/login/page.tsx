'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { loginAction, type LoginState } from '../actions';

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
    >
      <form
        action={formAction}
        style={{
          background: 'var(--panel)',
          border: '1px solid rgba(164,99,255,.35)',
          borderRadius: 16,
          padding: 32,
          maxWidth: 360,
          width: '100%'
        }}
      >
        <div className="brand" style={{ marginBottom: 6 }}>
          XAN<span>SWITCH</span>
        </div>
        <p style={{ color: 'var(--ink-dim)', fontSize: 13.5, fontWeight: 600, margin: '0 0 22px' }}>
          Painel de administração
        </p>

        <label htmlFor="password">Senha</label>
        <input
          id="password"
          name="password"
          type="password"
          autoFocus
          required
          style={{ marginBottom: 16 }}
        />

        {state.error && (
          <p style={{ color: '#ff8a8a', fontSize: 13, fontWeight: 600, margin: '0 0 16px' }}>
            {state.error}
          </p>
        )}

        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn primary" disabled={pending} style={{ width: '100%', justifyContent: 'center' }}>
      {pending ? 'Entrando...' : 'Entrar'}
    </button>
  );
}
