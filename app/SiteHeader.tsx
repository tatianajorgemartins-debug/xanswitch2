'use client';

import Link from 'next/link';
import { useLayoutEffect, useState } from 'react';
import { useDesignVariant } from './DesignVariant';
import { useThemeToggle } from './Theme';

const SWITCHER_FROM_KEY = 'xan-catalog-switch-from';

function GamepadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={16} height={16} aria-hidden="true">
      <path d="M7 8h10a5 5 0 0 1 4.7 6.7l-.6 1.6a2.6 2.6 0 0 1-4.3 1L15 15.5H9l-1.8 1.8a2.6 2.6 0 0 1-4.3-1l-.6-1.6A5 5 0 0 1 7 8z" strokeLinejoin="round" />
      <path d="M8 11v3M6.5 12.5h3" strokeLinecap="round" />
      <circle cx="16" cy="11.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="17.6" cy="13.4" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={16} height={16} aria-hidden="true">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" strokeLinejoin="round" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={16} height={16} aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={16} height={16} aria-hidden="true">
      <path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" strokeLinejoin="round" />
      <path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" strokeLinejoin="round" />
    </svg>
  );
}

const INSTAGRAM_URL = 'https://instagram.com/xan.switch';

export default function SiteHeader({
  whatsappContactUrl,
  wishlistCount,
  accountLabel,
  onOpenAccount,
  accountHref,
  activeCatalog
}: {
  whatsappContactUrl: string | null;
  wishlistCount?: number;
  // "Minha conta" pra quem não logou; @instagram ou a inicial do e-mail pra
  // quem já logou (calculado em CatalogClient.tsx, que sabe quem é o
  // usuário e o Instagram salvo dele).
  accountLabel?: string;
  // Abre o popup de conta na própria página (catálogo digital).
  onOpenAccount?: () => void;
  // Sem onOpenAccount, o botão vira um link pra cá — o catálogo físico usa
  // isso pra levar ao catálogo digital já com o popup de conta aberto, que
  // é onde ficam login, pontos e lista de desejos.
  accountHref?: string;
  // Em qual dos dois catálogos esse header está sendo mostrado — controla
  // qual lado do seletor fica "aceso" (ver .catalog-switcher em
  // globals.css). 'digital' = jogos (app/CatalogClient.tsx), 'fisico' =
  // produtos físicos (app/PhysicalCatalogClient.tsx).
  activeCatalog: 'digital' | 'fisico';
}) {
  const isRedesign = useDesignVariant() === 'redesign';
  const themeControl = useThemeToggle();

  // Pílula do seletor que desliza de um lado pro outro, tipo o botão de
  // liga/desliga do iPhone. Cada catálogo é uma página separada, então o
  // cabeçalho é montado de novo na troca: o clique anota de onde a pessoa
  // veio, e a página nova desenha a pílula nesse lado e anima até o lado
  // certo (antes da primeira pintura, pra não piscar na posição final).
  const [thumbAt, setThumbAt] = useState(activeCatalog);
  const [thumbInstant, setThumbInstant] = useState(false);
  useLayoutEffect(() => {
    let from: string | null = null;
    try {
      from = sessionStorage.getItem(SWITCHER_FROM_KEY);
    } catch {}
    if ((from !== 'digital' && from !== 'fisico') || from === activeCatalog) {
      setThumbInstant(false);
      setThumbAt(activeCatalog);
      return;
    }
    setThumbInstant(true);
    setThumbAt(from);
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        // Só apaga a anotação aqui (e não logo na leitura): se o efeito
        // rodar duas vezes seguidas, a segunda ainda encontra o lado de
        // origem e a animação não se perde.
        try {
          sessionStorage.removeItem(SWITCHER_FROM_KEY);
        } catch {}
        setThumbInstant(false);
        setThumbAt(activeCatalog);
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [activeCatalog]);

  function rememberSwitchFrom(target: 'digital' | 'fisico') {
    if (target === activeCatalog) return;
    try {
      sessionStorage.setItem(SWITCHER_FROM_KEY, activeCatalog);
    } catch {}
  }

  const shownCatalog = isRedesign ? thumbAt : activeCatalog;

  const accountContent = (
    <>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="3.4" />
        <path d="M4.5 20c1.4-3.8 4.4-6 7.5-6s6.1 2.2 7.5 6" strokeLinecap="round" />
      </svg>
      <span className="account-button-label">{accountLabel}</span>
      {!!wishlistCount && wishlistCount > 0 && <span className="account-button-badge">{wishlistCount}</span>}
    </>
  );

  return (
    <div className="site-header">
      {/* Com o modo claro ligado, as duas versões de cada logo vão pra página
          e o CSS mostra a do tema atual (letras brancas no escuro, escuras no
          claro) — ver .logo-for-light / .logo-for-dark em redesign.css. */}
      <div className="site-header-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="XAN Switch" className={themeControl ? 'logo-for-dark' : undefined} />
        {themeControl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/logo-dark.png" alt="XAN Switch" className="logo-for-light" />
        )}
        {activeCatalog === 'fisico' && (
          <>
            <span className="site-header-logo-plus" aria-hidden="true">
              +
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/beedle-logo.png"
              alt="Beedle Games"
              className={`site-header-partner-logo${themeControl ? ' logo-for-dark' : ''}`}
            />
            {themeControl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/beedle-logo-dark.png" alt="Beedle Games" className="site-header-partner-logo logo-for-light" />
            )}
          </>
        )}
      </div>

      {/* Alterna entre os dois catálogos do site — sempre leva pra raiz de
          cada um (não carrega filtros/estado de um catálogo no outro, que
          são páginas Next completamente separadas). Usa <Link> (navegação
          client-side), não <a>, de propósito: é isso que deixa a troca
          passar pela View Transitions API (ver <ViewTransition> em cada
          page.tsx e a duração em globals.css) em vez de recarregar a
          página inteira na hora. */}
      <div
        className={`catalog-switcher${isRedesign ? ' has-thumb' : ''}`}
        data-active={shownCatalog}
        role="group"
        aria-label="Escolher catálogo"
      >
        {isRedesign && (
          <span className={`catalog-switcher-thumb${thumbInstant ? ' is-instant' : ''}`} aria-hidden="true" />
        )}
        <Link
          href="/"
          className={`catalog-switcher-option${shownCatalog === 'digital' ? ' active' : ''}`}
          aria-current={activeCatalog === 'digital'}
          onClick={() => rememberSwitchFrom('digital')}
        >
          {isRedesign ? <GamepadIcon /> : <span aria-hidden="true">🎮</span>}
          <span className="catalog-switcher-label">Jogos digitais</span>
        </Link>
        <Link
          href="/produtos-fisicos"
          className={`catalog-switcher-option${shownCatalog === 'fisico' ? ' active' : ''}`}
          aria-current={activeCatalog === 'fisico'}
          onClick={() => rememberSwitchFrom('fisico')}
        >
          {isRedesign ? <BoxIcon /> : <span aria-hidden="true">📦</span>}
          <span className="catalog-switcher-label">Produtos físicos</span>
        </Link>
      </div>

      <div className="site-header-icons">
        {onOpenAccount ? (
          <button type="button" className="account-button" onClick={onOpenAccount} aria-label="Minha conta">
            {accountContent}
          </button>
        ) : (
          accountHref && (
            <Link href={accountHref} className="account-button" aria-label="Minha conta">
              {accountContent}
            </Link>
          )
        )}

        {themeControl && (
          <>
            {/* Computador: chave de duas opções com a pílula deslizante (a
                posição da pílula vem do data-theme do <html>, então já
                nasce no lugar certo e só anima quando a pessoa troca). */}
            <div className="theme-switch" role="group" aria-label="Tema do site">
              <span className="theme-switch-thumb" aria-hidden="true" />
              <button
                type="button"
                className="theme-switch-option is-dark"
                onClick={() => themeControl.setTheme('dark')}
                aria-pressed={themeControl.theme === 'dark'}
                aria-label="Modo escuro"
                title="Modo escuro"
              >
                <MoonIcon />
              </button>
              <button
                type="button"
                className="theme-switch-option is-light"
                onClick={() => themeControl.setTheme('light')}
                aria-pressed={themeControl.theme === 'light'}
                aria-label="Modo claro"
                title="Modo claro"
              >
                <SunIcon />
              </button>
            </div>
            {/* Celular: um botão só, que alterna. */}
            <button
              type="button"
              className="social-icon theme-toggle"
              onClick={themeControl.toggle}
              aria-label={themeControl.theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
              title={themeControl.theme === 'light' ? 'Modo escuro' : 'Modo claro'}
            >
              {themeControl.theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
          </>
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
