// Roda `task` só depois que a página terminou de carregar (e o navegador
// está livre) — pra coisas que baixam em segundo plano (login, popups) não
// disputarem a internet com as capas que a pessoa está vendo agora.
export function afterPageLoad(task: () => void): () => void {
  let cancelled = false;
  const run = () => {
    if (cancelled) return;
    if ('requestIdleCallback' in window) window.requestIdleCallback(() => !cancelled && task(), { timeout: 1500 });
    else setTimeout(() => !cancelled && task(), 200);
  };
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener('load', run);
  };
}
