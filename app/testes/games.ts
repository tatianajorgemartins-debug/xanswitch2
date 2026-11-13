// Lista dos jogos interativos da página "Testes" (app/testes).
//
// PRA ADICIONAR UM JOGO NOVO:
//   1. coloque uma entrada aqui (a ordem da lista é a ordem na página);
//   2. desenhe a arte do card em TesteArt (TestesClient.tsx);
//   3. diga o que abre ao clicar em jogar (fim do TestesClient.tsx).
// O resto (grade, numeração, contador, vagas de "em breve") se ajusta sozinho.

export type TesteId = 'qual-link' | 'proximo-jogo';

export type TesteGame = {
  id: TesteId;
  // Tipo do jogo, mostrado na etiqueta do card (Quiz, Sorteio, Desafio…).
  kind: string;
  title: string;
  description: string;
  // Informações curtas: duração, quantidade de perguntas etc.
  meta: string[];
  // O que a pessoa ganha jogando (opcional).
  reward?: string;
  cta: string;
  // Cores do card — ver .teste-card.theme-* em testes.css.
  theme: 'zelda' | 'arcade';
  // Selo "NOVO" no canto do card.
  isNew?: boolean;
};

export const TESTES: TesteGame[] = [
  {
    id: 'qual-link',
    kind: 'Quiz',
    title: 'Qual Link é você?',
    description: 'São 13 heróis de The Legend of Zelda. Responda e descubra qual deles tem a sua personalidade.',
    meta: ['10 perguntas', '2 min'],
    reward: 'Vale um card colecionável',
    cta: 'Começar a jornada',
    theme: 'zelda'
  },
  {
    id: 'proximo-jogo',
    kind: 'Quiz + sorteio',
    title: 'Qual será seu próximo jogo?',
    description: 'Conte do que você gosta e a roleta escolhe, no catálogo da loja, o jogo que mais combina com você.',
    meta: ['Perguntas rápidas', '1 min'],
    reward: 'Indicação sob medida',
    cta: 'Descobrir meu jogo',
    theme: 'arcade'
  }
];

// Quantas vagas de "em breve" aparecem depois dos jogos: sempre fecha a
// linha da grade e deixa pelo menos uma à mostra.
export function comingSoonSlots(count: number, columns = 2): number {
  const rest = count % columns;
  return rest === 0 ? columns : columns - rest;
}
