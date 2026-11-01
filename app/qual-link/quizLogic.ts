// Regras do "Qual Link é você?" (os textos ficam em quizData.ts).
//
// - Cada opção dá 3 pontos ao Link principal e 1 ao secundário.
// - Vence quem tiver mais pontos. Desempate: quem foi escolhido mais vezes
//   como principal; persistindo, quem foi principal na pergunta mais recente.
// - Afinidade de cada Link = pontos obtidos ÷ pontuação máxima possível
//   daquele Link (somando, pergunta a pergunta, o máximo que ele pode
//   ganhar numa só resposta).
//
// Sem nada de React aqui: o script de simulação
// (scripts/simulate-qual-link.mts) usa este mesmo arquivo.
import { LINK_ORDER, PERGUNTAS, type LinkId, type QuizQuestion } from './quizData.ts';

export const PRIMARY_POINTS = 3;
export const SECONDARY_POINTS = 1;

// answers[i] = índice da opção escolhida na pergunta i (na ordem ORIGINAL
// de quizData.ts, não na ordem embaralhada mostrada na tela).
export type Answers = number[];

export type Score = { id: LinkId; points: number; primaryCount: number; lastPrimary: number };

function maxPossible(questions: QuizQuestion[]): Record<LinkId, number> {
  const max = Object.fromEntries(LINK_ORDER.map((id) => [id, 0])) as Record<LinkId, number>;
  for (const q of questions) {
    for (const id of LINK_ORDER) {
      let best = 0;
      for (const opt of q.opcoes) {
        if (opt.principal === id) best = Math.max(best, PRIMARY_POINTS);
        else if (opt.secundario === id) best = Math.max(best, SECONDARY_POINTS);
      }
      max[id] += best;
    }
  }
  return max;
}

const MAX_POINTS = maxPossible(PERGUNTAS);

export function scoreAnswers(answers: Answers, questions: QuizQuestion[] = PERGUNTAS): Score[] {
  const scores = new Map<LinkId, Score>(
    LINK_ORDER.map((id) => [id, { id, points: 0, primaryCount: 0, lastPrimary: -1 }])
  );
  answers.forEach((optionIndex, questionIndex) => {
    const opt = questions[questionIndex]?.opcoes[optionIndex];
    if (!opt) return;
    const primary = scores.get(opt.principal)!;
    primary.points += PRIMARY_POINTS;
    primary.primaryCount += 1;
    primary.lastPrimary = questionIndex;
    scores.get(opt.secundario)!.points += SECONDARY_POINTS;
  });
  return [...scores.values()].sort(
    (a, b) => b.points - a.points || b.primaryCount - a.primaryCount || b.lastPrimary - a.lastPrimary
  );
}

export function winner(answers: Answers): LinkId {
  return scoreAnswers(answers)[0].id;
}

// Top 3 com a % de afinidade (pontos ÷ máximo possível do Link).
export function affinity(answers: Answers, count = 3): { id: LinkId; percent: number }[] {
  return scoreAnswers(answers)
    .slice(0, count)
    .map((s) => ({ id: s.id, percent: Math.round((s.points / Math.max(1, MAX_POINTS[s.id])) * 100) }));
}

export function shuffledOrder(length: number, random: () => number = Math.random): number[] {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
