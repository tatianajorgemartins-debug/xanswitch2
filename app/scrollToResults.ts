// Leva a página até o título dos resultados da busca ("X jogos
// disponíveis"), logo abaixo do cabeçalho fixo. No celular, apertar Enter
// fecha o teclado e a tela muda de tamanho no meio do caminho — então, se o
// teclado estava aberto, espera ele fechar antes de calcular a posição.
export function scrollToResults(target: HTMLElement | null, input: HTMLInputElement | null) {
  if (!target) return;

  const viewport = window.visualViewport;
  const keyboardOpen = !!viewport && document.activeElement === input && viewport.height < window.innerHeight - 80;
  input?.blur();

  const go = () => {
    const header = document.querySelector('.site-header-bar');
    // Com uma busca ativa, a barra de busca fica presa logo abaixo do
    // cabeçalho (.catalog-toolbar.is-searching) — desconta ela também, pra
    // não cobrir o "Resultados para...".
    const stickySearch = document.querySelector<HTMLElement>('.catalog-toolbar.is-searching');
    const offset = (header?.getBoundingClientRect().bottom ?? 0) + (stickySearch?.offsetHeight ?? 0) + 16;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  if (!keyboardOpen || !viewport) {
    go();
    return;
  }

  let finished = false;
  let settle: ReturnType<typeof setTimeout> | undefined;
  const finish = () => {
    if (finished) return;
    finished = true;
    viewport.removeEventListener('resize', onResize);
    clearTimeout(settle);
    clearTimeout(fallback);
    go();
  };
  const onResize = () => {
    clearTimeout(settle);
    settle = setTimeout(finish, 120);
  };
  viewport.addEventListener('resize', onResize);
  const fallback = setTimeout(finish, 700);
}
