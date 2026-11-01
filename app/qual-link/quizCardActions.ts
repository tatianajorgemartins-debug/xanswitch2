'use server';

// O card de 1 ponto do "Qual Link é você?": só pra quem está logado, um por
// conta. O servidor recalcula o resultado a partir das respostas (não
// confia num "deu o Link X" vindo do navegador) e confere o token da conta
// com o próprio Supabase, igual às outras ações de card (ver
// app/cardActions.ts).
import { claimQuizCard, createPointAdjustment } from '@/lib/db';
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

export async function claimQuizCardAction(accessToken: string | null, answers: number[]): Promise<QuizCardResult> {
  const email = await verifyAccessToken(accessToken);
  if (!email) return { status: 'login' };

  const valid =
    Array.isArray(answers) &&
    answers.length === PERGUNTAS.length &&
    answers.every((a, i) => Number.isInteger(a) && a >= 0 && a < PERGUNTAS[i].opcoes.length);
  if (!valid) return { status: 'error', error: 'Termine o quiz pra ganhar o card.' };

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
