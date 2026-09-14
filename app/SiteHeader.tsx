'use client';

const INSTAGRAM_URL = 'https://instagram.com/xan.switch';

export default function SiteHeader({
  whatsappContactUrl,
  wishlistCount,
  accountLabel,
  onOpenAccount
}: {
  whatsappContactUrl: string | null;
  wishlistCount: number;
  // "Minha conta" pra quem não logou; @instagram ou a inicial do e-mail pra
  // quem já logou (calculado em CatalogClient.tsx, que sabe quem é o
  // usuário e o Instagram salvo dele).
  accountLabel: string;
  onOpenAccount: () => void;
}) {
  return (
    <div className="site-header">
      <div className="site-header-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="XAN Switch" />
      </div>

      <div className="site-header-icons">
        <button type="button" className="account-button" onClick={onOpenAccount} aria-label="Minha conta">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="3.4" />
            <path d="M4.5 20c1.4-3.8 4.4-6 7.5-6s6.1 2.2 7.5 6" strokeLinecap="round" />
          </svg>
          <span className="account-button-label">{accountLabel}</span>
          {wishlistCount > 0 && <span className="account-button-badge">{wishlistCount}</span>}
        </button>

        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="social-icon"
          aria-label="Instagram"
          title="Instagram"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
          </svg>
        </a>
        {whatsappContactUrl && (
          <a
            href={whatsappContactUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="social-icon"
            aria-label="WhatsApp"
            title="WhatsApp"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3a9 9 0 0 0-7.75 13.5L3 21l4.5-1.25A9 9 0 1 0 12 3z" />
              <path
                d="M8.5 9.7c0 3.4 2.4 5.8 5.8 5.8.8 0 1-1.4.5-1.9s-1.1-.7-1.6-.3c-.4.4-.6.4-1 .1a4.7 4.7 0 0 1-2-2c-.3-.4-.3-.6.1-1 .5-.5.2-1.2-.3-1.7s-1.9-.3-1.9.5"
                fill="currentColor"
                stroke="none"
              />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}
