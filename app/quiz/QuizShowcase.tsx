'use client';

// Mostruário "Qual será seu próximo jogo?" — fica no lugar dos banners
// rotativos de "Mais aguardados" na página inicial (ver PromoSection.tsx).
// É só a porta de entrada: perguntas, sorteio e resultado vivem
// exclusivamente dentro do pop-up (GameQuizModal.tsx), que só é baixado
// quando a pessoa clica no botão.
import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Item } from '../CatalogClient';
import { fallbackToOriginal, imageSrcSet } from '@/lib/imageVariants';
import { eligibleItems } from './gameQuiz';
import './quiz.css';

const GameQuizModal = dynamic(() => import('./GameQuizModal'), { ssr: false });

export default function QuizShowcase({
  items,
  onOpenGame,
  variant = 'side'
}: {
  items: Item[];
  onOpenGame: (item: Item) => void;
  // 'side' = coluna lateral do computador; 'compact' = faixa do celular.
  variant?: 'side' | 'compact';
}) {
  const [open, setOpen] = useState(false);
  // Capas da esteirinha decorativa (repetidas pra dar a volta sem emenda).
  const covers = useMemo(() => eligibleItems(items).slice(0, 10), [items]);

  if (covers.length === 0) return null;

  return (
    <>
      <div className={`quiz-showcase quiz-showcase-${variant}`}>
        <div className="quiz-showcase-belt" aria-hidden>
          <div className="quiz-showcase-belt-track">
            {[...covers, ...covers].map((it, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${it.id}-${i}`}
                src={it.imageUrl!}
                srcSet={imageSrcSet(it.imageUrl!)}
                sizes="90px"
                onError={fallbackToOriginal}
                alt=""
                loading="lazy"
              />
            ))}
          </div>
        </div>
        <div className="quiz-showcase-shade" aria-hidden />
        <div className="quiz-showcase-deco" aria-hidden>
          <span className="deco-pad" />
          <span className="deco-btn a">A</span>
          <span className="deco-btn b">B</span>
          <span className="deco-star s1">✦</span>
          <span className="deco-star s2">✦</span>
          <span className="deco-star s3">★</span>
        </div>
        <div className="quiz-showcase-content">
          <h2 className="quiz-showcase-title">Qual será seu próximo jogo?</h2>
          <p className="quiz-showcase-sub">Responda algumas perguntas e descubra qual jogo combina com você!</p>
          <button type="button" className="quiz-showcase-cta" onClick={() => setOpen(true)}>
            <span>
              Descubra meu
              <br />
              próximo jogo
              <svg className="quiz-showcase-cta-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M7.5 6h9a5.5 5.5 0 0 1 5.3 7l-1.1 3.9A2.9 2.9 0 0 1 15.9 18l-2.4-2.4h-3L8.1 18a2.9 2.9 0 0 1-4.8-1.1L2.2 13A5.5 5.5 0 0 1 7.5 6Zm-.5 3v1.5H5.5V12H7v1.5h1.5V12H10v-1.5H8.5V9H7Zm9.5 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-2 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
              </svg>
            </span>
          </button>
        </div>
      </div>
      {open && <GameQuizModal items={items} onClose={() => setOpen(false)} onOpenGame={onOpenGame} />}
    </>
  );
}
