// Troca entre os dois catálogos (Jogos digitais <-> Produtos físicos) pelo
// seletor do cabeçalho: em vez da tela de carregamento, a página atual
// continua na tela (uma "foto" dela, por cima de tudo menos do cabeçalho)
// enquanto a outra carrega por baixo. Quando a nova está pronta (ver
// PageLoader em app/XanLoader.tsx), a foto some num fade e a página nova
// aparece já completa.

const FADE_MS = 300;
// Se algo travar, a foto sai do mesmo jeito depois desse tempo.
const MAX_WAIT_MS = 5000;

let overlay: HTMLElement | null = null;
let failsafe: ReturnType<typeof setTimeout> | undefined;

export function isCatalogSwitchPending(): boolean {
  return overlay !== null;
}

export function beginCatalogSwitch() {
  removeNow();
  const root = document.querySelector<HTMLElement>('.redesign');
  if (!root) return;

  const snapshot = root.cloneNode(true) as HTMLElement;
  snapshot
    .querySelectorAll(
      '.site-header-bar, .xan-loader, .motion-scroll-bar, .purchase-modal-overlay, .test-mode-bar, script, noscript'
    )
    .forEach((node) => node.remove());
  snapshot.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
  // Sem as marcas das animações de entrada (SiteMotion.tsx): na foto, tudo
  // aparece como já estava na tela, sem nada escondido esperando animar.
  snapshot.classList.remove('motion-on', 'motion-live');
  snapshot.querySelectorAll('[data-motion]').forEach((node) => node.removeAttribute('data-motion'));
  snapshot.classList.add('is-switch-snapshot');
  snapshot.style.transform = `translateY(${-window.scrollY}px)`;

  const wrap = document.createElement('div');
  wrap.className = 'catalog-switch-overlay';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.appendChild(snapshot);
  document.body.appendChild(wrap);
  overlay = wrap;
  failsafe = setTimeout(finishCatalogSwitch, MAX_WAIT_MS);
}

export function finishCatalogSwitch() {
  const wrap = overlay;
  if (!wrap) return;
  overlay = null;
  clearTimeout(failsafe);
  wrap.classList.add('is-leaving');
  setTimeout(() => wrap.remove(), FADE_MS);
}

function removeNow() {
  clearTimeout(failsafe);
  overlay?.remove();
  overlay = null;
}
