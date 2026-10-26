'use client';

import { useEffect, useId, useState, type RefObject } from 'react';
import { XAN_LOGO_INK, XAN_LOGO_JOYCON } from '@/lib/xanLogoPaths';
import { finishCatalogSwitch, isCatalogSwitchPending } from '@/lib/catalogSwitch';

// Tela de carregamento do site: o ícone da XAN com uma linha neon verde
// correndo em volta de cada contorno do desenho e uma barra "Carregando"
// embaixo. Usada em dois lugares:
//   - PageLoader (no SiteShell): cobre a página até ela terminar de
//     carregar (fontes, imagens visíveis na tela e o JavaScript pronto).
//   - Modal de compra (PurchaseModal.tsx): segura a página do jogo até os
//     pontos/desconto e a capa chegarem, em vez de ela "montar" aos pedaços.
// Sempre tem um tempo máximo: se algo travar, a tela some do mesmo jeito.

const EXIT_MS = 280;
const ALL_OUTLINES = [...XAN_LOGO_INK, ...XAN_LOGO_JOYCON];

type Phase = 'hidden' | 'shown' | 'leaving';

export function XanLoader({
  progress,
  phase,
  variant
}: {
  progress: number;
  phase: Phase;
  variant: 'page' | 'modal';
}) {
  const glowId = `xl-glow-${useId().replace(/:/g, '')}`;
  if (phase === 'hidden') return null;
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <div
      className={`xan-loader is-${variant}${phase === 'leaving' ? ' is-leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Carregando"
    >
      <div className="xan-loader-stack">
        <svg className="xan-loader-logo" viewBox="-4 -4 108 108" aria-hidden="true">
          <defs>
            <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path className="xan-loader-ink" d={XAN_LOGO_INK.join(' ')} fillRule="evenodd" />
          <path className="xan-loader-joycon" d={XAN_LOGO_JOYCON.join(' ')} fillRule="evenodd" />
          <g className="xan-loader-track">
            {ALL_OUTLINES.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
          <g className="xan-loader-trace" filter={`url(#${glowId})`}>
            {ALL_OUTLINES.map((d, i) => (
              <path key={i} d={d} pathLength={100} />
            ))}
          </g>
        </svg>
        <div className="xan-loader-meter">
          <div className="xan-loader-label">
            <span>Carregando</span>
            <span className="xan-loader-percent">{percent}%</span>
          </div>
          <div className="xan-loader-bar">
            <div className="xan-loader-bar-fill" style={{ transform: `scaleX(${Math.max(0.04, percent / 100)})` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Controla quando a tela aparece e some: só aparece se o carregamento
// passar de `showDelay` (assim coisas que já estão prontas não "piscam" a
// tela), e na saída fica um instante em 'leaving' pra animação de sumir.
export function useLoaderPhase(active: boolean, showDelay: number, startShown = false): Phase {
  const [phase, setPhase] = useState<Phase>(startShown && active ? 'shown' : 'hidden');

  useEffect(() => {
    if (active) {
      if (phase === 'shown') return;
      const timer = setTimeout(() => setPhase('shown'), phase === 'leaving' ? 0 : showDelay);
      return () => clearTimeout(timer);
    }
    if (phase === 'shown') {
      setPhase('leaving');
      return;
    }
    if (phase === 'leaving') {
      const timer = setTimeout(() => setPhase('hidden'), EXIT_MS);
      return () => clearTimeout(timer);
    }
  }, [active, phase, showDelay]);

  return phase;
}

// Imagens que a pessoa já está vendo e ainda não terminaram de baixar.
// As de loading="lazy" fora da tela ficam de fora (só baixam ao rolar).
function pendingImages(root: ParentNode, onlyInViewport: boolean): HTMLImageElement[] {
  const height = window.innerHeight;
  return Array.from(root.querySelectorAll('img')).filter((img) => {
    if (img.complete) return false;
    if (!onlyInViewport) return img.loading !== 'lazy';
    const rect = img.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < height && rect.width > 0;
  });
}

function waitForImage(img: HTMLImageElement): Promise<void> {
  return new Promise((resolve) => {
    if (img.complete) return resolve();
    img.addEventListener('load', () => resolve(), { once: true });
    img.addEventListener('error', () => resolve(), { once: true });
  });
}

// Acompanha uma lista de "tarefas" (promises) e devolve o progresso de 0 a
// 1. Enquanto nada termina, a barra avança devagarinho sozinha (até 90%),
// pra nunca parecer travada.
function useTaskProgress(
  collect: (() => Promise<void>[]) | null,
  maxWaitMs: number,
  minVisibleMs = 0
): { progress: number; done: boolean } {
  const [real, setReal] = useState(0);
  const [creep, setCreep] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!collect) return;
    let cancelled = false;
    const tasks = collect();
    const total = tasks.length + 1;
    let finished = 1;
    setReal(finished / total);

    const finish = () => {
      if (cancelled) return;
      setReal(1);
      // minVisibleMs conta desde que a página começou a abrir
      // (performance.now() zera na navegação).
      const wait = Math.max(160, minVisibleMs - performance.now());
      setTimeout(() => !cancelled && setDone(true), wait);
    };

    tasks.forEach((task) =>
      task.then(() => {
        if (cancelled) return;
        finished += 1;
        setReal(finished / total);
      })
    );
    Promise.all(tasks).then(finish);
    const cap = setTimeout(finish, maxWaitMs);
    const creepTimer = setInterval(() => setCreep((c) => c + (0.9 - c) * 0.07), 220);

    return () => {
      cancelled = true;
      clearTimeout(cap);
      clearInterval(creepTimer);
    };
    // `collect` muda quando a condição de "pronto pra medir" muda.
  }, [collect, maxWaitMs, minVisibleMs]);

  return { progress: Math.max(real, creep), done };
}

// Na primeira visita a tela já vem no HTML (aparece antes de qualquer
// coisa); nas trocas de página dentro do site ela só aparece se demorar.
let firstPageLoadDone = false;

function collectPageTasks(): Promise<void>[] {
  const tasks: Promise<void>[] = pendingImages(document, true).map(waitForImage);
  if (document.fonts?.ready) tasks.push(document.fonts.ready.then(() => undefined));
  if (document.readyState !== 'complete') {
    tasks.push(new Promise((resolve) => window.addEventListener('load', () => resolve(), { once: true })));
  }
  return tasks;
}

export function PageLoader() {
  const [isFirstLoad] = useState(() => !firstPageLoadDone);
  // Troca de catálogo pelo seletor do cabeçalho: sem tela de carregamento —
  // a página anterior fica na tela até esta estar pronta (lib/catalogSwitch.ts).
  const [isCatalogSwitch] = useState(() => !isFirstLoad && isCatalogSwitchPending());
  const { progress, done } = useTaskProgress(collectPageTasks, isCatalogSwitch ? 4500 : 8000, isFirstLoad ? 700 : 0);
  const phase = useLoaderPhase(!done && !isCatalogSwitch, 200, isFirstLoad);

  useEffect(() => {
    if (!done) return;
    firstPageLoadDone = true;
    if (isCatalogSwitch) finishCatalogSwitch();
  }, [done, isCatalogSwitch]);

  return <XanLoader progress={progress} phase={phase} variant="page" />;
}

// Pro modal de compra: espera os dados do jogo (`dataReady`) e as imagens
// principais dentro de `rootRef` (a capa). Devolve se já pode mostrar e a
// fase da tela de carregamento.
export function useContentLoader(rootRef: RefObject<HTMLElement | null>, dataReady: boolean, maxWaitMs = 6000) {
  const [collect, setCollect] = useState<(() => Promise<void>[]) | null>(null);
  const [dataPromise] = useState(() => {
    let resolve: () => void = () => {};
    const promise = new Promise<void>((r) => (resolve = r));
    return { promise, resolve };
  });

  useEffect(() => {
    if (dataReady) dataPromise.resolve();
  }, [dataReady, dataPromise]);

  useEffect(() => {
    setCollect(() => () => {
      const root = rootRef.current;
      const images = root ? pendingImages(root, false).map(waitForImage) : [];
      return [...images, dataPromise.promise];
    });
  }, [rootRef, dataPromise]);

  const { progress, done } = useTaskProgress(collect, maxWaitMs);
  const ready = done || (dataReady && collect !== null && progress >= 1);
  const phase = useLoaderPhase(!ready, 150);
  return { ready, progress, phase };
}
