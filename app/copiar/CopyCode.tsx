'use client';

import { useEffect, useState } from 'react';
import { REDEEM_URL } from '@/lib/deliveryEmail';

type Status = 'idle' | 'copied' | 'failed';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Navegadores antigos ou sem permissão: cai pro jeito clássico.
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    el.remove();
    return ok;
  }
}

export default function CopyCode() {
  const [code, setCode] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    const value = decodeURIComponent(window.location.hash.slice(1)).trim();
    setCode(value);
    if (!value) return;
    // Tenta copiar sozinho ao abrir. Alguns navegadores só deixam depois de
    // um toque — aí fica o botão.
    navigator.clipboard
      ?.writeText(value)
      .then(() => setStatus('copied'))
      .catch(() => {});
  }, []);

  async function handleCopy() {
    if (!code) return;
    setStatus((await copyText(code)) ? 'copied' : 'failed');
  }

  return (
    <main className="copy-page">
      <div className="copy-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="XAN Switch" className="copy-logo" />

        {code === null ? null : code ? (
          <>
            <p className="copy-label">Seu código</p>
            <p className="copy-code">{code}</p>
            <button type="button" className={`copy-btn${status === 'copied' ? ' is-done' : ''}`} onClick={handleCopy}>
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                {status === 'copied' ? (
                  <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <>
                    <rect x="8" y="8" width="12" height="12" rx="2.5" />
                    <path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" />
                  </>
                )}
              </svg>
              {status === 'copied' ? 'Código copiado!' : 'Copiar código'}
            </button>
            {status === 'failed' && <p className="copy-hint">Não deu pra copiar sozinho: toque e segure o código pra copiar.</p>}
            <a className="copy-next" href={REDEEM_URL} target="_blank" rel="noopener noreferrer">
              Ir pro resgate na Nintendo →
            </a>
            <p className="copy-hint">Lembre: mude a região da conta pra Japão antes de resgatar (está no vídeo do e-mail).</p>
          </>
        ) : (
          <p className="copy-hint">Esse link não tem nenhum código. Volte no e-mail e copie o código direto de lá.</p>
        )}
      </div>
    </main>
  );
}
