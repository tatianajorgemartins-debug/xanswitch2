'use client';

// "Meus resultados de quiz" em Minha conta (AccountModal.tsx): todos os
// resultados que a pessoa tirou jogando logada, do mais recente pro mais
// antigo. Tocar num deles reabre o resultado completo no quiz. Mesmo
// formato do botão "Coleção de cards": só busca no servidor na primeira
// vez que a pessoa abre.
import { useState } from 'react';
import { getAccessToken } from '@/lib/wishlist';
import { getMyQuizResultsAction, type QuizHistoryItem } from './quizCardActions';
import { LINKS, linkImage } from './quizData.ts';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function QuizHistory({ onOpen }: { onOpen: (answers: number[] | null) => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<QuizHistoryItem[] | null>(null);
  const [error, setError] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || items !== null) return;
    setError(false);
    const result = await getAccessToken()
      .then((token) => getMyQuizResultsAction(token))
      .catch(() => null);
    if (result === null) setError(true);
    else setItems(result);
  }

  return (
    <>
      <button
        type="button"
        className={`account-collection-toggle account-quiz-toggle${open ? ' is-open' : ''}`}
        onClick={toggle}
        aria-expanded={open}
      >
        <span className="account-collection-toggle-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={20} height={20}>
            <path d="M12 3l9 16H3z" strokeLinejoin="round" />
            <path d="M7.5 11h9M12 11v8" strokeLinecap="round" />
          </svg>
        </span>
        <span className="account-collection-toggle-text">
          <strong>Meus resultados de quiz</strong>
          <span>{open ? 'toque pra esconder' : 'todos os Links que você já tirou'}</span>
        </span>
        <svg
          className="account-collection-toggle-chevron"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          width={16}
          height={16}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="account-quiz-list">
          {error ? (
            <p className="account-quiz-empty">Não foi possível carregar agora. Feche e abra de novo.</p>
          ) : items === null ? (
            <p className="account-quiz-empty">Carregando...</p>
          ) : items.length === 0 ? (
            <div className="account-quiz-empty">
              <p>Você ainda não fez nenhum quiz com a conta conectada.</p>
              <button type="button" className="btn primary" onClick={() => onOpen(null)}>
                Fazer o “Qual Link é você?”
              </button>
            </div>
          ) : (
            <>
              {items.map((item) => (
                <button key={item.id} type="button" className="account-quiz-item" onClick={() => onOpen(item.answers)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={linkImage(item.resultId)} alt="" loading="lazy" />
                  <span className="account-quiz-item-text">
                    <strong>{LINKS[item.resultId].nome}</strong>
                    <span>
                      {LINKS[item.resultId].arquetipo} · {formatDate(item.createdAt)}
                    </span>
                  </span>
                  <span className="account-quiz-item-go" aria-hidden="true">
                    →
                  </span>
                </button>
              ))}
              <button type="button" className="account-quiz-again" onClick={() => onOpen(null)}>
                Fazer o quiz de novo
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
