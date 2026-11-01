// Os 13 Links do "Qual Link é você?" e onde ficam as imagens — separado
// dos textos (quizData.ts), pro banner da página inicial não precisar
// baixar o quiz inteiro. Imagens: public/quiz-zelda/ (ver
// scripts/convert-qual-link-images.mjs).

export type LinkId =
  | 'nes'
  | 'alttp'
  | 'la'
  | 'oot'
  | 'mm'
  | 'ww'
  | 'fs'
  | 'mc'
  | 'tp'
  | 'ss'
  | 'albw'
  | 'botw'
  | 'totk';

export const LINK_ORDER: LinkId[] = ['nes', 'alttp', 'la', 'oot', 'mm', 'ww', 'fs', 'mc', 'tp', 'ss', 'albw', 'botw', 'totk'];

export function linkImage(id: LinkId): string {
  return `/quiz-zelda/link-${id}.webp`;
}

// Arte quadrada do card colecionável (Link sobre fundo de Hyrule).
export function cardImage(id: LinkId): string {
  return `/quiz-zelda/card-${id}.webp`;
}
