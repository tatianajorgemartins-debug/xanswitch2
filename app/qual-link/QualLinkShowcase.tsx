'use client';

// Banner do "Qual Link é você?" na página inicial (no lugar do "Mais
// desejados", acima do "Qual será seu próximo jogo?"). É só a porta de
// entrada: o quiz em si abre por cima do catálogo (QualLinkQuiz.tsx).
// Os Links do banner vão se revezando, começando sempre pelos mesmos (pra
// servidor e navegador desenharem igual) e trocando depois de abrir.
import { useEffect, useState } from 'react';
import { LINK_ORDER, linkImage } from './quizData.ts';
import { QL_FONT_CLASSES } from './fonts.ts';
import './qual-link.css';

const ROTATE_MS = 3200;

export default function QualLinkShowcase({
  onOpen,
  variant = 'side'
}: {
  onOpen: () => void;
  // 'side' = coluna lateral do computador; 'compact' = faixa do celular.
  variant?: 'side' | 'compact';
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setStep((s) => s + 1), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, []);

  // botw (o mais conhecido) abre; depois anda pela lista.
  const start = LINK_ORDER.indexOf('botw');
  const main = LINK_ORDER[(start + step) % LINK_ORDER.length];
  const left = LINK_ORDER[(start + step + 6) % LINK_ORDER.length];

  return (
    <button
      type="button"
      className={`ql-showcase ql-showcase-${variant} ${QL_FONT_CLASSES}`}
      onClick={onOpen}
      aria-label="Fazer o quiz Qual Link é você? e ganhar um card colecionável"
    >
      <div className="ql-showcase-content">
        <p className="ql-showcase-seal">◆ Quiz Zelda · vale card ◆</p>
        <p className="ql-showcase-title">
          Qual <em>Link</em> é você?
        </p>
        <p className="ql-showcase-sub">10 perguntas, 13 heróis. Descubra o seu.</p>
        <span className="ql-showcase-cta">Começar a jornada</span>
      </div>
      <div className="ql-showcase-art" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={`l-${left}`} className="is-left" src={linkImage(left)} alt="" loading="lazy" decoding="async" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={`m-${main}`} className="is-main" src={linkImage(main)} alt="" loading="lazy" decoding="async" />
      </div>
    </button>
  );
}
