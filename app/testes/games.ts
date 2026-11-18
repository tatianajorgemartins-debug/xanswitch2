// Lista dos jogos interativos da página "Testes" (app/testes).
//
// PRA ADICIONAR UM JOGO NOVO:
//   1. coloque uma entrada aqui (a ordem da lista é a ordem na página);
//   2. desenhe a arte do card em TesteArt (TestesClient.tsx);
//   3. diga o que abre ao clicar em jogar (fim do TestesClient.tsx).
// O resto (grade, numeração, contador, vagas de "em breve") se ajusta sozinho.

export type TesteId = 'qual-link' | 'proximo-jogo' | 'silhueta' | 'ocarina-hero' | 'feed';

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
  theme: 'zelda' | 'arcade' | 'silhueta' | 'ocarina' | 'feed';
  // Jogo com página própria (ex: /testes/silhueta): o card vira um link.
  // Sem href, o jogo abre por cima da página (ver o fim do TestesClient.tsx).
  href?: string;
  // Selo "NOVO" no canto do card.
  isNew?: boolean;
};

export const TESTES: TesteGame[] = [
  {
    id: 'silhueta',
    kind: 'Desafio diário',
    title: 'Silhueta do Dia',
    description: 'Quem é esse personagem? Adivinhe pela silhueta. Um desafio novo por dia, igual pra todo mundo.',
    meta: ['4 níveis', '1 min'],
    reward: 'Sequência de dias 🔥',
    cta: 'Jogar o de hoje',
    theme: 'silhueta',
    href: '/testes/silhueta',
    isNew: true
  },
  {
    id: 'ocarina-hero',
    kind: 'Ritmo',
    title: 'Zelda Tour',
    description: 'As notas descem pela pista e você toca no tempo certo. Complete as Triforces, ative o especial e dobre os pontos.',
    meta: ['Música do Dia', 'Especial dourado'],
    reward: 'Recorde e triforces',
    cta: 'Tocar agora',
    theme: 'ocarina',
    href: '/testes/zelda-tour',
    isNew: true
  },
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
  },
  {
    id: 'feed',
    kind: 'Comunidade',
    title: 'Feed dos jogadores',
    description: 'Publique seus resultados, veja quem mandou bem hoje e solte um 🔥 nos melhores.',
    meta: ['Resultados ao vivo'],
    cta: 'Ver o feed',
    theme: 'feed',
    href: '/testes/feed'
  }
];

// Quantas vagas de "em breve" aparecem depois dos jogos: sempre fecha a
// linha da grade e deixa pelo menos uma à mostra.
export function comingSoonSlots(count: number, columns = 2): number {
  const rest = count % columns;
  return rest === 0 ? columns : columns - rest;
}
