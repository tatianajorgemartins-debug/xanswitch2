'use client';

import { useEffect, useRef } from 'react';

// Animações do site no estilo "motion dinâmico": entradas rápidas com
// desaceleração longa, cards em cascata, título palavra por palavra, barra
// fina de progresso de rolagem e número do contador subindo. Por enquanto
// só ligado na página de teste (ver SiteShell, prop testPreview).
//
// Como funciona: este componente marca o .redesign com "motion-on" (o CSS
// esconde os elementos que vão entrar) e, assim que a tela de carregamento
// sai, com "motion-live" (o CSS toca a abertura). Cada card/bloco ganha
// data-motion="wait" e vira "in" quando aparece na tela. Se algo der errado,
// tudo aparece sozinho depois de alguns segundos — nada fica escondido.

const REVEAL_SELECTOR = [
  '.catalog-grid > *',
  '.catalog-list > *',
  '.most-wanted-heading',
  '.catalog-count-row',
  '.promo-section-main',
  '.promo-section-side',
  '.promo-section-side-compact > *',
  '.reviews-section',
  '.review-card',
  '.page-content h2',
  '.site-footer'
].join(',');

const STAGGER_MS = 55;
const MAX_STAGGER_STEPS = 8;
const FAILSAFE_MS = 12000;

function countUp(el: HTMLElement) {
  const node = el.firstChild;
  if (!node || node.nodeType !== Node.TEXT_NODE) return;
  const target = Number(node.nodeValue);
  if (!Number.isFinite(target) || target < 2) return;
  const start = performance.now();
  const duration = 900;
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 4);
    // Mexe só no texto do nó (não troca o nó), pro React continuar
    // conseguindo atualizar o número depois.
    if (node.nodeValue !== null && node.isConnected) node.nodeValue = String(Math.round(target * eased));
    if (t < 1) requestAnimationFrame(tick);
    else node.nodeValue = String(target);
  };
  requestAnimationFrame(tick);
}

export default function SiteMotion() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const root = barRef.current?.closest('.redesign') as HTMLElement | null;
    if (!root) return;

    root.classList.add('motion-on');
    const pending = new Set<HTMLElement>();

    let observer: IntersectionObserver | null = null;
    let batch: HTMLElement[] = [];
    let batchFrame = 0;

    const reveal = (el: HTMLElement, index: number) => {
      el.style.setProperty('--motion-delay', `${Math.min(index, MAX_STAGGER_STEPS) * STAGGER_MS}ms`);
      el.dataset.motion = 'in';
      pending.delete(el);
      const counter = el.querySelector<HTMLElement>('.catalog-count-number');
      if (counter) countUp(counter);
      // Depois da entrada, tira o atraso pra não atrapalhar o hover.
      window.setTimeout(() => el.style.removeProperty('--motion-delay'), 1400);
    };

    // Junta tudo que entrou na tela no mesmo quadro e solta em cascata, de
    // cima pra baixo e da esquerda pra direita.
    const flush = () => {
      batchFrame = 0;
      const items = batch
        .map((el) => ({ el, rect: el.getBoundingClientRect() }))
        .sort((a, b) => Math.round(a.rect.top - b.rect.top) || a.rect.left - b.rect.left);
      batch = [];
      items.forEach(({ el }, i) => reveal(el, i));
    };

    const register = (el: HTMLElement) => {
      if (el.dataset.motion) return;
      el.dataset.motion = 'wait';
      pending.add(el);
      observer?.observe(el);
    };
    const scan = (scope: ParentNode) => {
      if (scope instanceof HTMLElement && scope.matches(REVEAL_SELECTOR)) register(scope);
      scope.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach(register);
    };

    scan(root);
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) scan(node);
        });
      }
    });
    mutations.observe(root, { childList: true, subtree: true });

    const start = () => {
      root.classList.add('motion-live');
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            observer?.unobserve(entry.target);
            batch.push(entry.target as HTMLElement);
          }
          if (batch.length && !batchFrame) batchFrame = requestAnimationFrame(flush);
        },
        { rootMargin: '0px 0px 12% 0px', threshold: 0 }
      );
      pending.forEach((el) => observer?.observe(el));
    };

    // Espera a tela de carregamento sair, pra abertura acontecer à vista.
    let loaderWatch: MutationObserver | null = null;
    if (root.querySelector('.xan-loader.is-page')) {
      loaderWatch = new MutationObserver(() => {
        if (!root.querySelector('.xan-loader.is-page:not(.is-leaving)')) {
          loaderWatch?.disconnect();
          loaderWatch = null;
          start();
        }
      });
      loaderWatch.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    } else {
      start();
    }

    const failsafe = window.setTimeout(() => {
      if (!observer) start();
      pending.forEach((el) => reveal(el, 0));
    }, FAILSAFE_MS);

    // Barra fina de progresso da rolagem.
    let scrollFrame = 0;
    const updateBar = () => {
      scrollFrame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (barRef.current) barRef.current.style.transform = `scaleX(${progress})`;
    };
    const onScroll = () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(updateBar);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    updateBar();

    return () => {
      window.clearTimeout(failsafe);
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(scrollFrame);
      cancelAnimationFrame(batchFrame);
      mutations.disconnect();
      loaderWatch?.disconnect();
      observer?.disconnect();
      pending.forEach((el) => delete el.dataset.motion);
      root.classList.remove('motion-on', 'motion-live');
    };
  }, []);

  return <div ref={barRef} className="motion-scroll-bar" aria-hidden="true" />;
}
