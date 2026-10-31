'use client';

// Janela (pop-up) do "Qual será seu próximo jogo?". Toda a experiência
// acontece aqui dentro, trocando só o conteúdo entre as etapas:
// apresentação → perguntas → análise → sorteio (esteira) → resultado.
//
// Fechar a janela desmonta este componente inteiro, então as respostas da
// rodada somem junto — abrir de novo começa uma rodada nova do zero.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Item } from '../CatalogClient';
import { fallbackToOriginal, imageSrcSet } from '@/lib/imageVariants';
import { installmentsLabel } from '@/lib/installments';
import {
  buildReel,
  pickQuestions,
  recommend,
  variedCovers,
  WINNER_INDEX,
  type QuizOption,
  type Recommendation
} from './gameQuiz';

type Step = 'intro' | 'quiz' | 'processing' | 'reel' | 'result';

const PROCESSING_MESSAGES = [
  'Analisando suas respostas…',
  'Comparando com o catálogo XanSwitch…',
  'Calculando a compatibilidade…',
  'Preparando o sorteio…'
];

export default function GameQuizModal({
  items,
  onClose,
  onOpenGame
}: {
  items: Item[];
  onClose: () => void;
  onOpenGame: (item: Item) => void;
}) {
  const [step, setStep] = useState<Step>('intro');
  const [questions, setQuestions] = useState(() => pickQuestions());
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<QuizOption[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [result, setResult] = useState<Recommendation | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Trava a rolagem da página por trás e fecha com ESC.
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, []);

  // Cada etapa nova começa do topo da janela.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step, current]);

  function start() {
    setQuestions(pickQuestions());
    setCurrent(0);
    setAnswers([]);
    setChosen(null);
    setResult(null);
    setStep('quiz');
  }

  function answer(option: QuizOption, index: number) {
    if (chosen !== null) return;
    setChosen(index);
    const nextAnswers = [...answers, option];
    // Pequena pausa pra pessoa ver a opção marcada antes de trocar.
    window.setTimeout(() => {
      setAnswers(nextAnswers);
      setChosen(null);
      if (current + 1 < questions.length) {
        setCurrent(current + 1);
      } else {
        setResult(recommend(items, nextAnswers));
        setStep('processing');
      }
    }, 320);
  }

  function back() {
    if (current === 0) {
      setStep('intro');
      return;
    }
    setAnswers(answers.slice(0, -1));
    setCurrent(current - 1);
  }

  function viewGame() {
    if (!result) return;
    const item = result.item;
    onClose();
    onOpenGame(item);
  }

  const modal = (
    <div className="quiz-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className={`quiz-modal quiz-step-${step}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-modal-title"
        tabIndex={-1}
      >
        <button type="button" className="quiz-close" onClick={onClose} aria-label="Fechar">
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2.6">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div ref={bodyRef} className="quiz-body">
          {step === 'intro' && <Intro items={items} onStart={start} />}

          {step === 'quiz' && (
            <div className="quiz-question" key={questions[current].id}>
              <div className="quiz-progress">
                <span className="quiz-progress-label">
                  Pergunta {current + 1} de {questions.length}
                </span>
                <div className="quiz-progress-bar">
                  <div style={{ width: `${((current + (chosen !== null ? 1 : 0)) / questions.length) * 100}%` }} />
                </div>
              </div>
              <h2 id="quiz-modal-title" className="quiz-question-text">
                {questions[current].text}
              </h2>
              <div className="quiz-options">
                {questions[current].options.map((option, i) => (
                  <button
                    key={option.label}
                    type="button"
                    className={`quiz-option${chosen === i ? ' is-chosen' : ''}`}
                    onClick={() => answer(option, i)}
                    disabled={chosen !== null && chosen !== i}
                  >
                    <span className="quiz-option-emoji" aria-hidden>
                      {option.emoji}
                    </span>
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
              <button type="button" className="quiz-back" onClick={back} disabled={chosen !== null}>
                ← Voltar
              </button>
            </div>
          )}

          {step === 'processing' && <Processing onDone={() => setStep(result ? 'reel' : 'result')} />}

          {step === 'reel' && result && <Reel items={items} winner={result.item} onDone={() => setStep('result')} />}

          {step === 'result' && (
            <Result result={result} onViewGame={viewGame} onRestart={start} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function Intro({ items, onStart }: { items: Item[]; onStart: () => void }) {
  const covers = useMemo(() => variedCovers(items, 5), [items]);
  return (
    <div className="quiz-intro">
      <div className="quiz-intro-covers" aria-hidden>
        {covers.map((it, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={it.id}
            src={it.imageUrl!}
            srcSet={imageSrcSet(it.imageUrl!)}
            sizes="120px"
            onError={fallbackToOriginal}
            alt=""
            style={{ '--i': i - (covers.length - 1) / 2 } as React.CSSProperties}
          />
        ))}
      </div>
      <span className="quiz-kicker">Descubra seu próximo jogo</span>
      <h2 id="quiz-modal-title" className="quiz-title">
        Qual será seu próximo jogo?
      </h2>
      <p className="quiz-lead">
        Responda 5 perguntas rápidas sobre o seu jeito de jogar. A gente cruza tudo com o catálogo da XanSwitch e
        sorteia o jogo que mais combina com você.
      </p>
      <ul className="quiz-intro-steps">
        <li>
          <b>1</b> Responda as perguntas
        </li>
        <li>
          <b>2</b> Veja a esteira girar
        </li>
        <li>
          <b>3</b> Descubra seu jogo
        </li>
      </ul>
      <button type="button" className="quiz-primary" onClick={onStart} autoFocus>
        Começar
      </button>
    </div>
  );
}

function Processing({ onDone }: { onDone: () => void }) {
  const [message, setMessage] = useState(0);
  useEffect(() => {
    const tick = window.setInterval(() => setMessage((m) => Math.min(m + 1, PROCESSING_MESSAGES.length - 1)), 650);
    const done = window.setTimeout(onDone, 2600);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="quiz-processing" role="status">
      <div className="quiz-spinner" aria-hidden>
        <span />
        <span />
        <span />
        <span />
      </div>
      <h2 id="quiz-modal-title" className="quiz-processing-text" key={message}>
        {PROCESSING_MESSAGES[message]}
      </h2>
    </div>
  );
}

function Reel({ items, winner, onDone }: { items: Item[]; winner: Item; onDone: () => void }) {
  const reel = useMemo(() => buildReel(items, winner), [items, winner]);
  const windowRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [landed, setLanded] = useState(false);

  useLayoutEffect(() => {
    const win = windowRef.current;
    const track = trackRef.current;
    if (!win || !track) return;
    const card = track.children[WINNER_INDEX] as HTMLElement | undefined;
    if (!card) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduced ? 900 : 4600;
    // Para com o vencedor bem no centro, com um desvio pequeno pra não
    // parecer "certinho" demais (e depois se ajusta pro centro exato).
    const center = card.offsetLeft + card.offsetWidth / 2 - win.clientWidth / 2;
    const jitter = (Math.random() - 0.5) * card.offsetWidth * 0.5;

    track.style.transition = 'none';
    track.style.transform = 'translateX(0px)';
    // Força o navegador a aplicar a posição inicial antes de animar.
    void track.offsetWidth;
    track.style.transition = `transform ${duration}ms cubic-bezier(0.08, 0.72, 0.16, 1)`;
    track.style.transform = `translateX(${-(center + jitter)}px)`;

    const settle = window.setTimeout(() => {
      track.style.transition = 'transform 380ms ease-out';
      track.style.transform = `translateX(${-center}px)`;
      setLanded(true);
    }, duration + 60);
    const done = window.setTimeout(onDone, duration + 1500);
    return () => {
      window.clearTimeout(settle);
      window.clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reel]);

  return (
    <div className="quiz-reel-step">
      <span className="quiz-kicker">Sorteando seu jogo</span>
      <h2 id="quiz-modal-title" className="quiz-reel-title">
        {landed ? 'Temos um vencedor!' : 'A esteira está girando…'}
      </h2>
      <div ref={windowRef} className={`quiz-reel${landed ? ' is-landed' : ''}`}>
        <div className="quiz-reel-pointer" aria-hidden />
        <div ref={trackRef} className="quiz-reel-track">
          {reel.map((it, i) => (
            <div key={`${it.id}-${i}`} className={`quiz-reel-card${i === WINNER_INDEX ? ' is-winner' : ''}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.imageUrl!}
                srcSet={imageSrcSet(it.imageUrl!)}
                sizes="140px"
                onError={fallbackToOriginal}
                alt=""
                loading="eager"
                decoding="async"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Result({
  result,
  onViewGame,
  onRestart,
  onClose
}: {
  result: Recommendation | null;
  onViewGame: () => void;
  onRestart: () => void;
  onClose: () => void;
}) {
  if (!result) {
    return (
      <div className="quiz-result quiz-result-empty">
        <h2 id="quiz-modal-title" className="quiz-title">
          Ops! Não achamos jogos pra sortear agora.
        </h2>
        <p className="quiz-lead">Tente de novo daqui a pouco ou dê uma olhada no catálogo completo.</p>
        <button type="button" className="quiz-primary" onClick={onClose}>
          Ver catálogo
        </button>
      </div>
    );
  }
  const { item, compatibility, reasons } = result;
  const description = item.description
    ? item.description.length > 280
      ? `${item.description.slice(0, 277).trimEnd()}…`
      : item.description
    : null;

  return (
    <div className="quiz-result">
      <div className="quiz-result-cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.imageUrl!}
          srcSet={imageSrcSet(item.imageUrl!)}
          sizes="(max-width: 640px) 60vw, 300px"
          onError={fallbackToOriginal}
          alt={item.name}
        />
      </div>
      <div className="quiz-result-info">
        <span className="quiz-kicker">Seu próximo jogo é</span>
        <h2 id="quiz-modal-title" className="quiz-result-name">
          {item.name}
        </h2>

        <div className="quiz-compat">
          <div className="quiz-compat-head">
            <span>Compatibilidade</span>
            <strong>{compatibility}%</strong>
          </div>
          <div className="quiz-compat-bar">
            <div style={{ width: `${compatibility}%` }} />
          </div>
        </div>

        {reasons.length > 0 && (
          <ul className="quiz-reasons">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}

        {description && <p className="quiz-result-desc">{description}</p>}

        <div className="quiz-result-price">
          {item.originalPriceLabel && <span className="old">R$ {item.originalPriceLabel}</span>}
          <span className="now">R$ {item.priceLabel}</span>
          <span className="inst">{installmentsLabel(item.price)}</span>
        </div>

        <div className="quiz-result-actions">
          <button type="button" className="quiz-primary" onClick={onViewGame}>
            Ver o jogo
          </button>
          <button type="button" className="quiz-secondary" onClick={onRestart}>
            Jogar de novo
          </button>
        </div>
      </div>
    </div>
  );
}
