// Busca tolerante do catálogo (CatalogClient.tsx): ignora acentos e
// maiúsculas ("pokemon" acha "Pokémon") e aceita pequenos erros de
// digitação ("zeldaa" acha "Zelda", "mairo" acha "Mario"). Cada palavra
// digitada precisa bater com alguma palavra do nome — por pedaço (começo,
// meio) ou por ser quase igual. Sem biblioteca: o catálogo tem poucas
// dezenas de jogos, então a conta direta é instantânea.

export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Quantas letras precisam mudar pra uma palavra virar a outra (distância de
// Levenshtein, com duas letras trocadas de lugar contando como 1 erro —
// "mairo" -> "mario"), parando cedo quando passa do limite.
function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let prevPrev: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        curr[j] = Math.min(curr[j], prevPrev[j - 2] + 1);
      }
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > limit) return limit + 1;
    prevPrev = prev;
    prev = curr;
  }
  return prev[b.length];
}

// Palavras curtas precisam bater certinho; a partir de 4 letras aceita 1
// erro, a partir de 7, 2.
function allowedErrors(word: string): number {
  if (word.length >= 7) return 2;
  if (word.length >= 4) return 1;
  return 0;
}

function wordMatches(queryWord: string, nameWords: string[], nameJoined: string, fuzzy: boolean): boolean {
  if (nameJoined.includes(queryWord)) return true;
  const limit = fuzzy ? allowedErrors(queryWord) : 0;
  if (limit === 0) return false;
  return nameWords.some(
    (w) =>
      editDistance(queryWord, w, limit) <= limit ||
      // Ainda digitando: compara com o começo da palavra do mesmo tamanho
      // (só a partir de 5 letras — antes disso dá falso positivo, tipo
      // "kong" achar "KINGdom").
      (queryWord.length >= 5 &&
        w.length > queryWord.length && editDistance(queryWord, w.slice(0, queryWord.length), limit) <= limit)
  );
}

// fuzzy: aceita erros de digitação. O catálogo usa primeiro sem (só o que
// bate certinho) e só liga o fuzzy quando nada bateu — assim quem digita
// certo não vê resultados "parecidos" misturados.
export function matchesSearch(name: string, query: string, fuzzy = true): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  const nameNorm = normalizeText(name);
  const nameWords = nameNorm.split(' ');
  return q.split(' ').every((word) => wordMatches(word, nameWords, nameNorm, fuzzy));
}

// Nomes de franquia como vêm do admin podem estar sem acento ("Pokemon");
// aqui só a EXIBIÇÃO ganha a grafia certa — o valor usado no filtro
// continua o mesmo.
const DISPLAY_FIXES: Record<string, string> = {
  pokemon: 'Pokémon'
};

export function displayFranchise(name: string): string {
  return DISPLAY_FIXES[normalizeText(name)] ?? name;
}
