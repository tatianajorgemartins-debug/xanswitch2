'use client';

// "Qual Link é você?" — quiz de personalidade em tela cheia, por cima do
// catálogo (aberto pelo banner da página inicial ou direto em /qual-link).
// Três telas: abertura → 10 perguntas → resultado. Textos em quizData.ts,
// regras em quizLogic.ts.
//
// Card de 1 ponto: quem termina logado ganha o card do seu Link (um por
// conta — ver quizCardActions.ts). Quem não está logado vê "Entrar e ganhar
// meu card": as respostas ficam guardadas no navegador (PENDING_KEY) e,
// voltando do login (inclusive do Google, que recarrega a página), o quiz
// reabre no resultado e guarda o card sozinho.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getAccessToken } from '@/lib/wishlist';
import { CollectibleCard } from '../CollectibleCard';
import { LINKS, LINK_ORDER, PERGUNTAS, cardImage, linkImage, type LinkId } from './quizData.ts';
import { affinity, shuffledOrder, winner, type Answers } from './quizLogic.ts';
import { claimQuizCardAction, type QuizCardResult } from './quizCardActions';
import { renderStoryImage } from './storyImage.ts';
import { QL_FONT_CLASSES } from './fonts.ts';
import { clearQualLinkLoginFlag } from './loginFlag';
import './qual-link.css';

export const PENDING_KEY = 'xan-qual-link-pending';
const ZELDA_URL = '/franquia/Legend%20Of%20Zelda';
const SITE = 'xanswitch.com.br';
const ADVANCE_MS = 250;

type Screen = 'intro' | 'question' | 'result';

// Eventos pro Google Analytics / Meta Pixel — o site ainda não tem nenhum
// dos dois instalado; quando tiver, os eventos já saem sozinhos daqui.
function track(event: 'quiz_start' | 'quiz_complete' | 'quiz_cta_click', params: Record<string, string> = {}) {
  const w = window as unknown as {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  };
  try {
    w.gtag?.('event', event, { quiz: 'qual-link', ...params });
    w.fbq?.('trackCustom', event, { quiz: 'qual-link', ...params });
  } catch {
    // analytics nunca pode quebrar o quiz
  }
}

function readPending(): Answers | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null');
    return Array.isArray(parsed) && parsed.length === PERGUNTAS.length ? parsed : null;
  } catch {
    return null;
  }
}
function savePending(answers: Answers) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(answers));
  } catch {
    // sem armazenamento: só não dá pra retomar depois do login do Google
  }
}
function clearPending() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // nada a fazer
  }
}

// "O Herói Original" → "Herói Original" (o "Você é o" já vem antes).
function shortName(id: LinkId): string {
  const nome = LINKS[id].nome;
  return nome.startsWith('O ') ? nome.slice(2) : nome;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export default function QualLinkQuiz({
  user,
  resumePending,
  onClose,
  onRequestLogin
}: {
  user: User | null;
  // Voltando do login: abre direto no resultado guardado e pega o card.
  resumePending: boolean;
  onClose: () => void;
  onRequestLogin: () => void;
}) {
  const [screen, setScreen] = useState<Screen>('intro');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => PERGUNTAS.map(() => null));
  // Ordem embaralhada das opções de cada pergunta (sorteada a cada jogada).
  const [orders, setOrders] = useState<number[][]>(() => PERGUNTAS.map((q) => q.opcoes.map((_, i) => i)));
  const [picked, setPicked] = useState<number | null>(null);
  const [claim, setClaim] = useState<QuizCardResult | { status: 'idle' | 'claiming' }>({ status: 'idle' });
  const [toast, setToast] = useState<string | null>(null);
  const [savingImage, setSavingImage] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const advanceTimer = useRef<number | null>(null);

  // Fechar o quiz cancela o reabrir automático depois do login.
  const handleClose = useCallback(() => {
    clearQualLinkLoginFlag();
    onClose();
  }, [onClose]);

  const complete = answers.every((a) => a !== null);
  const finalAnswers = useMemo(() => (complete ? (answers as Answers) : null), [answers, complete]);
  const resultId = finalAnswers ? winner(finalAnswers) : null;
  const top3 = finalAnswers ? affinity(finalAnswers) : [];

  // Voltando do login com respostas guardadas: pula direto pro resultado.
  useEffect(() => {
    if (!resumePending) return;
    const pending = readPending();
    if (pending) {
      setAnswers(pending);
      setScreen('result');
    }
  }, [resumePending]);

  // Trava a rolagem da página por trás e fecha com Esc.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      // Com o popup de conta aberto por cima, o Esc fecha só ele.
      if (e.key === 'Escape' && !document.querySelector('.purchase-modal-overlay')) handleClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [handleClose]);

  // Cada troca de tela volta pro topo e põe o foco no título (leitor de
  // tela e teclado começam do lugar certo).
  useEffect(() => {
    rootRef.current?.scrollTo({ top: 0 });
    rootRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
  }, [screen, index]);

  useEffect(() => () => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
  }, []);

  const claimCard = useCallback(async (list: Answers) => {
    setClaim({ status: 'claiming' });
    const token = await getAccessToken().catch(() => null);
    const result = await claimQuizCardAction(token, list).catch(
      () => ({ status: 'error', error: 'A conexão falhou. Tente de novo.' }) as QuizCardResult
    );
    if (result.status === 'granted' || result.status === 'already') {
      clearPending();
      clearQualLinkLoginFlag();
    }
    setClaim(result);
  }, []);

  // Terminou logado (ou acabou de entrar na conta): guarda o card sozinho.
  useEffect(() => {
    if (screen !== 'result' || !finalAnswers || !user) return;
    if (claim.status !== 'idle' && claim.status !== 'login') return;
    claimCard(finalAnswers);
  }, [screen, finalAnswers, user, claim.status, claimCard]);

  function start() {
    track('quiz_start');
    setOrders(PERGUNTAS.map((q) => shuffledOrder(q.opcoes.length)));
    setAnswers(PERGUNTAS.map(() => null));
    setIndex(0);
    setPicked(null);
    setClaim({ status: 'idle' });
    setScreen('question');
  }

  function choose(optionIndex: number) {
    if (picked !== null) return;
    setPicked(optionIndex);
    const next = answers.slice();
    next[index] = optionIndex;
    setAnswers(next);
    advanceTimer.current = window.setTimeout(() => {
      setPicked(null);
      if (index < PERGUNTAS.length - 1) {
        setIndex(index + 1);
      } else {
        const list = next as Answers;
        savePending(list);
        track('quiz_complete', { result: winner(list) });
        setScreen('result');
      }
    }, ADVANCE_MS);
  }

  function back() {
    if (picked !== null) return;
    if (index === 0) setScreen('intro');
    else setIndex(index - 1);
  }

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(null), 2600);
  }

  function shareText(id: LinkId): string {
    return `Fiz o quiz 'Qual Link é você?' da @xan.switch e deu: ${LINKS[id].nome} — ${LINKS[id].arquetipo}! E você, qual Link é? ${SITE}`;
  }

  async function copyResult(id: LinkId) {
    try {
      await navigator.clipboard.writeText(shareText(id));
      showToast('Resultado copiado!');
    } catch {
      showToast('Não consegui copiar automaticamente.');
    }
  }

  async function share(id: LinkId) {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Qual Link é você?', text: shareText(id), url: `https://www.${SITE}/qual-link` });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      }
    }
    copyResult(id);
  }

  async function saveImage(id: LinkId) {
    setSavingImage(true);
    try {
      const blob = await renderStoryImage(id);
      const file = new File([blob], `qual-link-${id}.png`, { type: 'image/png' });
      // No celular, compartilhar a imagem direto é mais prático que baixar.
      const touch = window.matchMedia('(pointer: coarse)').matches;
      if (touch && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Qual Link é você?' }).catch(() => {});
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
    } catch {
      showToast('Não foi possível gerar a imagem.');
    } finally {
      setSavingImage(false);
    }
  }

  function requestLogin() {
    if (finalAnswers) savePending(finalAnswers);
    onRequestLogin();
  }

  return (
    <div className={`ql-overlay ${QL_FONT_CLASSES}`} role="dialog" aria-modal="true" aria-label="Quiz Qual Link é você?">
      <div className="ql-scroll" ref={rootRef}>
        <button type="button" className="ql-close" onClick={handleClose} aria-label="Fechar o quiz">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={18} height={18} aria-hidden="true">
            <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" />
          </svg>
        </button>

        <div className="ql-frame">
          {screen === 'intro' && (
            <div className="ql-intro">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="ql-logo" src="/quiz-zelda/logo-xan.webp" alt="Xan Switch" width={150} height={62} />
              <p className="ql-seal">Quiz de personalidade</p>
              <h1 className="ql-title" tabIndex={-1} data-autofocus>
                Qual <em>Link</em> é você?
              </h1>
              <p className="ql-lead">
                Treze heróis, uma lenda. Responda com o coração e descubra qual Link carrega a sua personalidade.
              </p>
              <div className="ql-strip" aria-hidden="true">
                {LINK_ORDER.map((id) => (
                  <div key={id} className="ql-strip-item">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={linkImage(id)} alt="" loading="lazy" decoding="async" />
                  </div>
                ))}
              </div>
              <button type="button" className="ql-btn" onClick={start}>
                Começar a jornada
              </button>
              <p className="ql-meta">10 perguntas · 13 resultados · ~3 minutos</p>
              <p className="ql-card-hint">
                ◆ Termine logado na sua conta e ganhe um <strong>card colecionável de 1 ponto</strong> com o seu Link.
              </p>
            </div>
          )}

          {screen === 'question' && (
            <div className="ql-question" key={index}>
              <span className="ql-bignum" aria-hidden="true">
                {pad(index + 1)}
              </span>
              <p className="ql-seal">
                Pergunta {pad(index + 1)} · {index + 1}/{PERGUNTAS.length}
              </p>
              <div
                className="ql-progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={PERGUNTAS.length}
                aria-valuenow={index + 1}
                aria-label="Progresso do quiz"
              >
                <span style={{ width: `${((index + 1) / PERGUNTAS.length) * 100}%` }} />
              </div>
              <h2 className="ql-question-title" tabIndex={-1} data-autofocus>
                {PERGUNTAS[index].pergunta}
              </h2>
              <div className="ql-options">
                {orders[index].map((optionIndex, position) => {
                  const selected = picked === optionIndex || (picked === null && answers[index] === optionIndex);
                  return (
                    <button
                      key={optionIndex}
                      type="button"
                      className={`ql-option${selected ? ' is-selected' : ''}`}
                      onClick={() => choose(optionIndex)}
                      aria-pressed={selected}
                    >
                      <span className="ql-option-letter" aria-hidden="true">
                        {'ABCDE'[position]}
                      </span>
                      <span>{PERGUNTAS[index].opcoes[optionIndex].texto}</span>
                    </button>
                  );
                })}
              </div>
              <button type="button" className="ql-back" onClick={back}>
                ← Voltar
              </button>
            </div>
          )}

          {screen === 'result' && resultId && (
            <div className="ql-result">
              <p className="ql-seal">Seu resultado</p>
              <div className="ql-result-art">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={linkImage(resultId)} alt={LINKS[resultId].nome} />
              </div>
              <p className="ql-result-you">Você é o</p>
              <h2 className="ql-title ql-result-name" tabIndex={-1} data-autofocus>
                {shortName(resultId)}
              </h2>
              <p className="ql-result-game">{LINKS[resultId].jogo}</p>
              <p className="ql-archetype">◆ {LINKS[resultId].arquetipo} ◆</p>
              <ul className="ql-traits">
                {LINKS[resultId].tracos.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <p className="ql-text">{LINKS[resultId].descricao}</p>
              <div className="ql-boxes">
                <div className="ql-box">
                  <p className="ql-box-label">Ponto forte</p>
                  <p>{LINKS[resultId].forte}</p>
                </div>
                <div className="ql-box">
                  <p className="ql-box-label">Cuidado com</p>
                  <p>{LINKS[resultId].cuidado}</p>
                </div>
              </div>
              <blockquote className="ql-quote">
                <p className="ql-box-label">Frase da sua jornada</p>
                {LINKS[resultId].frase}
              </blockquote>

              <div className="ql-affinity">
                <p className="ql-seal">Sua afinidade</p>
                {top3.map((a) => (
                  <div key={a.id} className="ql-affinity-row">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={linkImage(a.id)} alt="" loading="lazy" />
                    <div className="ql-affinity-info">
                      <span>{LINKS[a.id].nome}</span>
                      <div className="ql-affinity-bar">
                        <span style={{ width: `${a.percent}%` }} />
                      </div>
                    </div>
                    <strong>{a.percent}%</strong>
                  </div>
                ))}
              </div>

              <div className="ql-reward">
                <p className="ql-seal">Sua recompensa</p>
                {claim.status === 'granted' || claim.status === 'already' ? (
                  <>
                    <div className="ql-reward-card">
                      <CollectibleCard
                        gameName={`Qual Link é você? · ${LINKS[claim.resultId].nome}`}
                        imageUrl={cardImage(claim.resultId)}
                        points={1}
                      />
                    </div>
                    <p className="ql-reward-text">
                      {claim.status === 'granted'
                        ? '✓ Card guardado na sua coleção, com +1 ponto pra trocar por desconto!'
                        : 'Você já ganhou o card deste quiz (é um por conta). Ele está na sua coleção, em Minha conta.'}
                    </p>
                  </>
                ) : claim.status === 'claiming' || (user && claim.status === 'idle') ? (
                  <p className="ql-reward-text">Guardando seu card...</p>
                ) : claim.status === 'error' ? (
                  <>
                    <p className="ql-reward-text is-error">{claim.error}</p>
                    <button type="button" className="ql-btn is-ghost" onClick={() => finalAnswers && claimCard(finalAnswers)}>
                      Tentar de novo
                    </button>
                  </>
                ) : (
                  <>
                    <p className="ql-reward-text">
                      Entre na sua conta pra ganhar o <strong>card colecionável do seu Link</strong>, que vale{' '}
                      <strong>1 ponto</strong>. Um card por conta.
                    </p>
                    <button type="button" className="ql-btn" onClick={requestLogin}>
                      Entrar e ganhar meu card
                    </button>
                  </>
                )}
              </div>

              <div className="ql-actions">
                <button type="button" className="ql-btn" onClick={() => share(resultId)}>
                  Compartilhar
                </button>
                <button type="button" className="ql-btn is-ghost" onClick={() => copyResult(resultId)}>
                  Copiar resultado
                </button>
                <button type="button" className="ql-btn is-ghost" onClick={() => saveImage(resultId)} disabled={savingImage}>
                  {savingImage ? 'Gerando imagem...' : 'Baixar imagem pros stories'}
                </button>
                <button type="button" className="ql-btn is-ghost" onClick={start}>
                  Refazer o quiz
                </button>
              </div>
              <a className="ql-cta" href={ZELDA_URL} onClick={() => track('quiz_cta_click', { result: resultId })}>
                Ver jogos de Zelda na loja →
              </a>
            </div>
          )}
        </div>
      </div>
      {toast && (
        <p className="ql-toast" role="status">
          {toast}
        </p>
      )}
    </div>
  );
}
