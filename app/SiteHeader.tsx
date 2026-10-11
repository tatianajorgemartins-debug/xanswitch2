'use client';

const INSTAGRAM_URL = 'https://instagram.com/xan.switch';

export default function SiteHeader({
  whatsappContactUrl,
  wishlistCount,
  accountLabel,
  onOpenAccount,
  activeCatalog
}: {
  whatsappContactUrl: string | null;
  wishlistCount?: number;
  // "Minha conta" pra quem não logou; @instagram ou a inicial do e-mail pra
  // quem já logou (calculado em CatalogClient.tsx, que sabe quem é o
  // usuário e o Instagram salvo dele).
  accountLabel?: string;
  // Deixado de fora (undefined) esconde o botão de conta inteiro — é o que
  // o catálogo de produtos físicos faz por enquanto, já que login/lista de
  // desejos ainda são recursos só do catálogo digital (ver
  // PhysicalCatalogClient.tsx).
  onOpenAccount?: () => void;
  // Em qual dos dois catálogos esse header está sendo mostrado — controla
  // qual lado do seletor fica "aceso" (ver .catalog-switcher em
  // globals.css). 'digital' = jogos (app/CatalogClient.tsx), 'fisico' =
  // produtos físicos (app/PhysicalCatalogClient.tsx).
  activeCatalog: 'digital' | 'fisico';
}) {
  return (
    <div className="site-header">
      <div className="site-header-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="XAN Switch" />
      </div>

      {/* Alterna entre os dois catálogos do site — sempre leva pra raiz de
          cada um (não carrega filtros/estado de um catálogo no outro, que
          são páginas Next completamente separadas). */}
      <div className="catalog-switcher" role="group" aria-label="Escolher catálogo">
        <a href="/" className={`catalog-switcher-option${activeCatalog === 'digital' ? ' active' : ''}`} aria-current={activeCatalog === 'digital'}>
          <span aria-hidden="true">🎮</span>
          <span className="catalog-switcher-label">Jogos digitais</span>
        </a>
        <a
          href="/produtos-fisicos"
          className={`catalog-switcher-option${activeCatalog === 'fisico' ? ' active' : ''}`}
          aria-current={activeCatalog === 'fisico'}
        >
          <span aria-hidden="true">📦</span>
          <span className="catalog-switcher-label">Produtos físicos</span>
        </a>
      </div>

      <div className="site-header-icons">
        {onOpenAccount && (
          <button type="button" className="account-button" onClick={onOpenAccount} aria-label="Minha conta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="3.4" />
              <path d="M4.5 20c1.4-3.8 4.4-6 7.5-6s6.1 2.2 7.5 6" strokeLinecap="round" />
            </svg>
            <span className="account-button-label">{accountLabel}</span>
            {!!wishlistCount && wishlistCount > 0 && <span className="account-button-badge">{wishlistCount}</span>}
          </button>
        )}

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
