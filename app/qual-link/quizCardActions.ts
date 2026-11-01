'use server';

// O card de 1 ponto do "Qual Link é você?": só pra quem está logado, um por
// conta. O servidor recalcula o resultado a partir das respostas (não
// confia num "deu o Link X" vindo do navegador) e confere o token da conta
// com o próprio Supabase, igual às outras ações de card (ver
// app/cardActions.ts).
import { claimQuizCard, createPointAdjustment, getQuizResultsByEmail, saveQuizResult } from '@/lib/db';
import { verifyAccessToken } from '@/lib/supabaseAuthServer';
import { LINKS, PERGUNTAS, type LinkId } from './quizData.ts';
import { winner } from './quizLogic.ts';

const QUIZ_ID = 'qual-link';
const QUIZ_CARD_POINTS = 1;

export type QuizCardResult =
  // granted: card novo agora. already: a conta já tinha o card (resultId é
  // o Link que saiu na primeira vez — refazer o quiz não troca o card).
  | { status: 'granted' | 'already'; resultId: LinkId }
  | { status: 'login' }
  | { status: 'error'; error: string };

function validAnswers(answers: unknown): answers is number[] {
  return (
    Array.isArray(answers) &&
    answers.length === PERGUNTAS.length &&
    answers.every((a, i) => Number.isInteger(a) && a >= 0 && a < PERGUNTAS[i].opcoes.length)
  );
}

export async function claimQuizCardAction(accessToken: string | null, answers: number[]): Promise<QuizCardResult> {
  const email = await verifyAccessToken(accessToken);
  if (!email) return { status: 'login' };

  if (!validAnswers(answers)) return { status: 'error', error: 'Termine o quiz pra ganhar o card.' };

  const resultId = winner(answers);
  try {
    const { inserted, card } = await claimQuizCard(QUIZ_ID, email, resultId);
    if (!inserted) return { status: 'already', resultId: card.result_id as LinkId };
    await createPointAdjustment({
      customer_email: email,
      points: QUIZ_CARD_POINTS,
      note: `Card do quiz "Qual Link é você?" (${LINKS[resultId].nome})`
    });
    return { status: 'granted', resultId };
  } catch (err) {
    console.error('[quiz] Falha ao dar o card:', err);
    return { status: 'error', error: 'Não foi possível guardar seu card agora. Tente de novo em instantes.' };
  }
}

// --- Histórico: todos os resultados de quem joga logado ---

// Guarda uma jogada (chamado a cada quiz terminado com a conta conectada).
// O resultado é recalculado aqui a partir das respostas.
export async function saveQuizResultAction(accessToken: string | null, answers: number[]): Promise<{ ok: boolean }> {
  const email = await verifyAccessToken(accessToken);
  if (!email || !validAnswers(answers)) return { ok: false };
  try {
    await saveQuizResult(QUIZ_ID, email, winner(answers), answers);
    return { ok: true };
  } catch (err) {
    console.error('[quiz] Falha ao salvar o resultado:', err);
    return { ok: false };
  }
}

export type QuizHistoryItem = { id: number; resultId: LinkId; answers: number[]; createdAt: string };

// Os resultados da própria pessoa, do mais recente pro mais antigo (pro
// "Meus resultados de quiz" em Minha conta).
export async function getMyQuizResultsAction(accessToken: string | null): Promise<QuizHistoryItem[] | null> {
  const email = await verifyAccessToken(accessToken);
  if (!email) return null;
  try {
    const rows = await getQuizResultsByEmail(email);
    return rows
      .filter((r) => r.quiz === QUIZ_ID && r.result_id in LINKS && validAnswers(r.answers))
      .map((r) => ({
        id: r.id,
        resultId: r.result_id as LinkId,
        answers: r.answers,
        createdAt: new Date(r.created_at).toISOString()
      }));
  } catch (err) {
    console.error('[quiz] Falha ao listar resultados:', err);
    return [];
  }
}
