// Capas da vitrine do "Qual será seu próximo jogo?" — separado da lógica
// do quiz (gameQuiz.ts, com as perguntas e as palavras-chave de cada
// gênero), pra página inicial não precisar baixar tudo isso só pra mostrar
// a esteirinha de capas.
import type { Item } from '../CatalogClient';

export function shuffle<T>(list: T[]): T[] {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Jogos que podem ser sorteados: jogos completos (não DLC/atualização), já
// lançados e com capa — senão a esteira e o resultado ficariam sem imagem.
export function eligibleItems(items: Item[]): Item[] {
  const withCover = items.filter((it) => !it.isUpcoming && it.imageUrl);
  const base = withCover.filter((it) => it.gameType === 'base');
  return base.length > 0 ? base : withCover;
}

// Capas sorteadas pra vitrine do quiz, intercalando franquias: embaralha,
// separa por franquia e vai pegando uma de cada (assim não saem quatro
// Bayonettas seguidas só porque são as primeiras do catálogo).
export function variedCovers(items: Item[], count: number): Item[] {
  const groups = new Map<string, Item[]>();
  for (const it of shuffle(eligibleItems(items))) {
    const key = (it.franchise ?? it.name).toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  const queues = shuffle([...groups.values()]);
  const picked: Item[] = [];
  while (picked.length < count && queues.some((q) => q.length > 0)) {
    for (const q of queues) {
      const next = q.shift();
      if (next && picked.length < count) picked.push(next);
    }
  }
  return picked;
}
