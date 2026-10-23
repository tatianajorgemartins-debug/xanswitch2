'use client';

import { useEffect } from 'react';

// Tela mostrada quando algo quebra no navegador (ver app/error.tsx e
// app/global-error.tsx). Antes, o Next.js mostrava uma mensagem em texto
// escuro sobre o fundo escuro do site — pro cliente parecia só uma tela
// preta. Os estilos ficam aqui mesmo (inline) porque, no pior caso, o CSS
// do site nem chegou a carregar.
export default function ErrorScreen({
  error,
  retry
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    const report = (window as unknown as { __xanReportError?: (k: string, m: unknown, s?: unknown) => void })
      .__xanReportError;
    report?.('error-boundary', `${error.message}${error.digest ? ` (digest ${error.digest})` : ''}`, error.stack);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: '#0a0716',
        color: '#f4f1fb',
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        textAlign: 'center'
      }}
    >
      <div style={{ maxWidth: 420 }}>
        <p style={{ fontSize: 26, fontWeight: 800, margin: '0 0 12px', lineHeight: 1.15 }}>
          Ops, o site não carregou direito
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.5, color: '#b7aed4', margin: '0 0 24px' }}>
          Tente recarregar a página. Se continuar, atualize o navegador do celular ou fale com a gente pelo
          Instagram @xan.switch.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              minHeight: 48,
              padding: '0 22px',
              border: 0,
              borderRadius: 999,
              background: '#7b2ff0',
              color: '#ffffff',
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Recarregar a página
          </button>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minHeight: 48,
              padding: '0 22px',
              border: 0,
              borderRadius: 999,
              background: '#1c1338',
              color: '#f4f1fb',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Tentar de novo
          </button>
        </div>
      </div>
    </div>
  );
}
