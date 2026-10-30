// Lógica do "Qual será seu próximo jogo?" — as perguntas, como cada jogo do
// catálogo ganha "etiquetas" de estilo e como as respostas viram uma
// recomendação. Fica separado do visual (GameQuizModal.tsx) pra dar pra
// mexer nas perguntas sem encostar na tela.
//
// O banco não guarda gênero dos jogos, então as etiquetas são deduzidas do
// nome, da franquia e da descrição cadastrados no admin (ver TAG_KEYWORDS).
// Pra afinar a recomendação de um jogo, basta incluir palavras assim na
// descrição dele (ex.: "corrida", "multiplayer", "RPG").
import type { Item } from '../CatalogClient';

export type Tag =
  | 'aventura'
  | 'mundoaberto'
  | 'acao'
  | 'rpg'
  | 'plataforma'
  | 'corrida'
  | 'luta'
  | 'party'
  | 'puzzle'
  | 'esporte'
  | 'simulacao'
  | 'relaxante'
  | 'tiro'
  | 'terror'
  | 'estrategia'
  | 'musica'
  | 'desafio'
  | 'historia'
  | 'familia'
  | 'multiplayer'
  | 'competitivo'
  | 'fofo'
  | 'retro'
  | 'colecionar'
  | 'curto'
  | 'longo';

export const TAG_LABELS: Record<Tag, string> = {
  aventura: 'Aventura',
  mundoaberto: 'Mundo aberto',
  acao: 'Ação',
  rpg: 'RPG',
  plataforma: 'Plataforma',
  corrida: 'Corrida',
  luta: 'Luta',
  party: 'Diversão em grupo',
  puzzle: 'Quebra-cabeça',
  esporte: 'Esportes',
  simulacao: 'Simulação',
  relaxante: 'Jogo relaxante',
  tiro: 'Tiro',
  terror: 'Suspense',
  estrategia: 'Estratégia',
  musica: 'Ritmo e música',
  desafio: 'Desafio',
  historia: 'Boa história',
  familia: 'Para toda a família',
  multiplayer: 'Multijogador',
  competitivo: 'Competitivo',
  fofo: 'Visual fofo',
  retro: 'Estilo retrô',
  colecionar: 'Colecionar',
  curto: 'Partidas rápidas',
  longo: 'Muitas horas de jogo'
};

// Palavras (sem acento, em minúsculas) que dão cada etiqueta a um jogo.
const TAG_KEYWORDS: Record<Tag, string[]> = {
  aventura: ['aventura', 'adventure', 'zelda', 'link', 'explor', 'jornada', 'lego', 'luigi', 'metroid', 'hollow knight', 'okami'],
  mundoaberto: ['mundo aberto', 'open world', 'breath of the wild', 'tears of the kingdom', 'skyrim', 'witcher', 'arceus', 'scarlet', 'violet', 'xenoblade', 'hogwarts', 'minecraft', 'red dead'],
  acao: ['acao', 'action', 'hack', 'bayonetta', 'devil may cry', 'hades', 'metroid', 'combate', 'combat', 'beat', 'hyrule warriors', 'souls', 'ninja', 'dead cells', 'god of war', 'astral chain', 'monster hunter'],
  rpg: ['rpg', 'pokemon', 'xenoblade', 'final fantasy', 'fire emblem', 'persona', 'dragon quest', 'octopath', 'tales of', 'ni no kuni', 'bravely', 'triangle strategy', 'shin megami', 'chrono', 'paper mario', 'mario & luigi', 'mario e luigi', 'witcher', 'skyrim', 'monster hunter', 'kingdom hearts', 'diablo', 'atelier', 'ys '],
  plataforma: ['plataforma', 'platform', 'super mario', 'mario bros', 'mario odyssey', 'mario wonder', 'kirby', 'donkey kong', 'sonic', 'celeste', 'hollow knight', 'metroid', 'rayman', 'yoshi', 'crash', 'cuphead', 'bowser', 'captain toad', 'shovel knight', 'ori '],
  corrida: ['kart', 'racing', 'corrida', 'race', 'rally', 'need for speed', 'f1', 'formula', 'crash team', 'speed', 'nascar', 'motogp', 'grid', 'hot wheels'],
  luta: ['smash', 'fighting', 'luta', 'tekken', 'street fighter', 'mortal kombat', 'arms', 'fighterz', 'guilty gear', 'king of fighters', 'brawl', 'pokken', 'boxe', 'wwe'],
  party: ['party', 'festa', 'overcooked', 'minigame', 'mini-game', 'mini game', '1-2-switch', 'jackbox', 'everybody', 'just dance', 'super mario party', 'wii party', 'clubhouse', 'fall guys', 'pico park'],
  puzzle: ['puzzle', 'quebra-cabeca', 'quebra cabeca', 'tetris', 'captain toad', 'portal', 'layton', 'picross', 'puyo', 'enigma', 'logica', 'baba is you', 'unravel', 'it takes two', 'brain'],
  esporte: ['fifa', 'ea sports', 'futebol', 'soccer', 'nba', 'tennis', 'tenis', 'golf', 'esporte', 'sports', 'strikers', 'rocket league', 'olimp', 'olympic', 'basquete', 'skate', 'tony hawk', 'pes ', 'efootball'],
  simulacao: ['animal crossing', 'stardew', 'simula', 'farm', 'fazenda', 'harvest', 'story of seasons', 'cozinha', 'cooking', 'life', 'vida', 'the sims', 'house flipper', 'rune factory', 'tomodachi', 'construir', 'build', 'minecraft', 'slime rancher'],
  relaxante: ['animal crossing', 'stardew', 'relax', 'tranquil', 'cozy', 'calm', 'aconchegante', 'fazenda', 'unpacking', 'slime rancher', 'story of seasons', 'harvest', 'pesca', 'fishing', 'jardim', 'garden'],
  tiro: ['splatoon', 'shooter', 'tiro', 'doom', 'metroid prime', 'call of duty', 'borderlands', 'wolfenstein', 'fps', 'fortnite', 'overwatch', 'apex', 'bioshock'],
  terror: ['terror', 'horror', 'resident evil', 'mansion', 'zumbi', 'zombie', 'outlast', 'little nightmares', 'five nights', 'fatal frame', 'dead by daylight', 'alien', 'medo', 'assombra'],
  estrategia: ['estrategia', 'strategy', 'fire emblem', 'advance wars', 'xcom', 'pikmin', 'civilization', 'rabbids', 'tatic', 'tactic', 'triangle strategy', 'into the breach', 'age of'],
  musica: ['ritmo', 'rhythm', 'musica', 'music', 'just dance', 'theatrhythm', 'taiko', 'cadence', 'guitar', 'danca', 'dance'],
  desafio: ['dificil', 'hard', 'souls', 'desafi', 'challeng', 'roguelike', 'roguelite', 'hollow knight', 'celeste', 'cuphead', 'hades', 'dead cells', 'ninja gaiden', 'sekiro', 'metroid dread'],
  historia: ['historia', 'story', 'narrativ', 'xenoblade', 'final fantasy', 'persona', 'zelda', 'octopath', 'emocion', 'witcher', 'enredo', 'trama', 'personagens', 'triangle strategy', 'fire emblem'],
  familia: ['familia', 'family', 'kids', 'crianca', 'kirby', 'yoshi', 'mario', 'lego', 'party', 'animal crossing', 'pokemon', 'disney', 'pikmin', 'toad', 'dk ', 'donkey kong'],
  multiplayer: ['multiplayer', 'multijogador', 'coop', 'co-op', 'cooperativ', 'online', 'amigos', '4 jogadores', 'quatro jogadores', 'party', 'kart', 'smash', 'overcooked', 'splatoon', 'it takes two', 'jogadores'],
  competitivo: ['smash', 'kart', 'splatoon', 'competitiv', 'ranked', 'esports', 'tetris 99', 'fortnite', 'street fighter', 'tekken', 'rocket league', 'fifa', 'versus'],
  fofo: ['kirby', 'yoshi', 'animal crossing', 'cute', 'fofo', 'adorav', 'pikmin', 'toad', 'chibi', 'poochy', 'slime rancher'],
  retro: ['retro', 'classic', 'classico', 'pixel', '8-bit', '16-bit', 'remaster', 'collection', 'colecao', 'coletanea', 'remake', 'origins', 'mega man', 'arcade', 'snes', 'nes ', 'trilogy', 'trilogia'],
  colecionar: ['pokemon', 'colecion', 'collect', 'monster', 'capturar', 'catch', 'cartas', 'card', 'animal crossing', 'lego'],
  curto: ['party', 'arcade', 'kart', 'smash', 'tetris', 'minigame', 'mini game', 'rapid', 'roguelike', 'roguelite', 'puzzle', 'esporte', 'fifa', 'rocket league'],
  longo: ['rpg', 'mundo aberto', 'open world', 'xenoblade', 'horas', 'hours', 'zelda', 'pokemon', 'animal crossing', 'stardew', 'witcher', 'skyrim', 'final fantasy', 'persona', 'monster hunter', 'dragon quest']
};

export type Franchise = 'mario' | 'zelda' | 'pokemon' | 'fofos' | 'metroid' | 'fora';

const FRANCHISE_KEYWORDS: Record<Exclude<Franchise, 'fora'>, string[]> = {
  mario: ['mario', 'luigi', 'bowser', 'peach', 'wario', 'toad'],
  zelda: ['zelda', 'link', 'hyrule'],
  pokemon: ['pokemon', 'pikachu', 'eevee', 'pokken'],
  fofos: ['kirby', 'yoshi', 'donkey kong', 'pikmin', 'animal crossing'],
  metroid: ['metroid', 'samus', 'fire emblem', 'xenoblade', 'splatoon']
};

type Effect = {
  tags?: Partial<Record<Tag, number>>;
  franchise?: Franchise;
  budget?: number | null; // teto de preço; null = sem limite
  platform?: 'switch1' | 'switch2' | 'any';
  fame?: 'famous' | 'hidden';
  sale?: number; // peso dado a jogos em promoção
};

export type QuizOption = { label: string; emoji: string; effect: Effect };
export type QuizQuestion = { id: string; text: string; options: QuizOption[] };

// O banco de perguntas. A cada rodada, entram 5 delas sorteadas (sempre
// incluindo a de orçamento — ver pickQuestions), em ordem aleatória.
export const QUESTION_POOL: QuizQuestion[] = [
  {
    id: 'estilo',
    text: 'O que mais te empolga em um jogo?',
    options: [
      { emoji: '🗺️', label: 'Explorar mundos enormes', effect: { tags: { aventura: 3, mundoaberto: 3 } } },
      { emoji: '🏁', label: 'Correr e competir', effect: { tags: { corrida: 4, competitivo: 2 } } },
      { emoji: '⚔️', label: 'Batalhas com estratégia', effect: { tags: { rpg: 3, estrategia: 3 } } },
      { emoji: '🍄', label: 'Pular e superar fases', effect: { tags: { plataforma: 4, desafio: 1 } } }
    ]
  },
  {
    id: 'modo',
    text: 'Como você prefere jogar?',
    options: [
      { emoji: '🎧', label: 'Sozinho, no meu ritmo', effect: { tags: { historia: 2, aventura: 2, rpg: 1 } } },
      { emoji: '🛋️', label: 'Com amigos no sofá', effect: { tags: { party: 3, multiplayer: 3 } } },
      { emoji: '🌐', label: 'Online contra outros', effect: { tags: { competitivo: 3, multiplayer: 2, tiro: 1 } } },
      { emoji: '🎲', label: 'Tanto faz!', effect: {} }
    ]
  },
  {
    id: 'tempo',
    text: 'Quanto tempo você costuma jogar por vez?',
    options: [
      { emoji: '⏱️', label: 'Uns 15 a 30 minutos', effect: { tags: { curto: 3, party: 1, puzzle: 1, corrida: 1 } } },
      { emoji: '🕐', label: 'Mais ou menos 1 hora', effect: { tags: { plataforma: 2, acao: 2 } } },
      { emoji: '🌙', label: 'Várias horas seguidas', effect: { tags: { longo: 3, rpg: 2, mundoaberto: 1 } } },
      { emoji: '📅', label: 'Fins de semana inteiros', effect: { tags: { longo: 3, simulacao: 2, rpg: 1 } } }
    ]
  },
  {
    id: 'humor',
    text: 'Qual é a sua vibe hoje?',
    options: [
      { emoji: '🌿', label: 'Relaxar e desligar', effect: { tags: { relaxante: 4, simulacao: 2, fofo: 1 } } },
      { emoji: '⚡', label: 'Adrenalina pura', effect: { tags: { acao: 3, corrida: 2, luta: 2, tiro: 1 } } },
      { emoji: '😂', label: 'Dar risada com a galera', effect: { tags: { party: 4, multiplayer: 2 } } },
      { emoji: '🧠', label: 'Pensar e resolver', effect: { tags: { puzzle: 4, estrategia: 2 } } }
    ]
  },
  {
    id: 'universo',
    text: 'Qual universo te chama mais?',
    options: [
      { emoji: '⭐', label: 'O do encanador mais famoso', effect: { franchise: 'mario', tags: { plataforma: 1, familia: 1 } } },
      { emoji: '🗡️', label: 'Reinos, espadas e lendas', effect: { franchise: 'zelda', tags: { aventura: 2 } } },
      { emoji: '⚡', label: 'Capturar e treinar monstrinhos', effect: { franchise: 'pokemon', tags: { colecionar: 2, rpg: 1 } } },
      { emoji: '🎈', label: 'Personagens fofos e coloridos', effect: { franchise: 'fofos', tags: { fofo: 2 } } },
      { emoji: '🚀', label: 'Quero algo fora do óbvio', effect: { franchise: 'fora' } }
    ]
  },
  {
    id: 'dificuldade',
    text: 'Qual nível de dificuldade você curte?',
    options: [
      { emoji: '🧸', label: 'Tranquilo, sem estresse', effect: { tags: { familia: 2, relaxante: 2 } } },
      { emoji: '⚖️', label: 'Equilibrado', effect: { tags: { aventura: 1, plataforma: 1 } } },
      { emoji: '🔥', label: 'Desafiador', effect: { tags: { desafio: 3, acao: 1 } } },
      { emoji: '💀', label: 'Quero sofrer (no bom sentido)', effect: { tags: { desafio: 5, acao: 2 } } }
    ]
  },
  {
    id: 'orcamento',
    text: 'Quanto você quer investir no próximo jogo?',
    options: [
      { emoji: '🪙', label: 'Até R$ 100', effect: { budget: 100 } },
      { emoji: '💵', label: 'Até R$ 200', effect: { budget: 200 } },
      { emoji: '💰', label: 'Até R$ 300', effect: { budget: 300 } },
      { emoji: '💎', label: 'O jogo certo vale qualquer preço', effect: { budget: null } }
    ]
  },
  {
    id: 'console',
    text: 'Em qual console você vai jogar?',
    options: [
      { emoji: '🎮', label: 'Nintendo Switch', effect: { platform: 'switch1' } },
      { emoji: '🆕', label: 'Nintendo Switch 2', effect: { platform: 'switch2' } },
      { emoji: '🤷', label: 'Tenho os dois / tanto faz', effect: { platform: 'any' } }
    ]
  },
  {
    id: 'historia',
    text: 'Que tipo de história te prende?',
    options: [
      { emoji: '🏰', label: 'Épica e emocionante', effect: { tags: { historia: 3, rpg: 2, aventura: 1 } } },
      { emoji: '🌈', label: 'Leve e divertida', effect: { tags: { fofo: 2, familia: 2, party: 1 } } },
      { emoji: '🕯️', label: 'Sombria e misteriosa', effect: { tags: { terror: 4, acao: 1 } } },
      { emoji: '🙅', label: 'História? Quero é jogar!', effect: { tags: { corrida: 2, esporte: 2, luta: 2, puzzle: 1 } } }
    ]
  },
  {
    id: 'companhia',
    text: 'Com quem você vai jogar mais?',
    options: [
      { emoji: '🙋', label: 'Só eu', effect: { tags: { historia: 2, rpg: 1, aventura: 1 } } },
      { emoji: '👨‍👩‍👧', label: 'Com a família e as crianças', effect: { tags: { familia: 3, party: 2, fofo: 1 } } },
      { emoji: '👯', label: 'Com os amigos', effect: { tags: { multiplayer: 3, party: 2, luta: 1 } } },
      { emoji: '💑', label: 'Com meu par', effect: { tags: { multiplayer: 2, puzzle: 1, simulacao: 1 } } }
    ]
  },
  {
    id: 'poder',
    text: 'Se pudesse escolher um superpoder…',
    options: [
      { emoji: '💨', label: 'Supervelocidade', effect: { tags: { corrida: 3, plataforma: 1 } } },
      { emoji: '💪', label: 'Superforça', effect: { tags: { luta: 3, acao: 2 } } },
      { emoji: '🧩', label: 'Supermente', effect: { tags: { puzzle: 3, estrategia: 2 } } },
      { emoji: '🔮', label: 'Magia', effect: { tags: { rpg: 3, aventura: 2 } } }
    ]
  },
  {
    id: 'cenario',
    text: 'Onde você gostaria de passar umas horas?',
    options: [
      { emoji: '🏯', label: 'Num reino de fantasia', effect: { tags: { aventura: 2, rpg: 2 } } },
      { emoji: '🏝️', label: 'Numa ilha tranquila', effect: { tags: { simulacao: 3, relaxante: 2 } } },
      { emoji: '🏟️', label: 'Numa pista ou num estádio', effect: { tags: { corrida: 2, esporte: 3 } } },
      { emoji: '🏚️', label: 'Numa mansão assombrada', effect: { tags: { terror: 4 } } }
    ]
  },
  {
    id: 'fama',
    text: 'Você prefere…',
    options: [
      { emoji: '🏆', label: 'Os sucessos que todo mundo joga', effect: { fame: 'famous' } },
      { emoji: '💎', label: 'Joias escondidas', effect: { fame: 'hidden' } },
      { emoji: '🤝', label: 'Tanto faz, quero que seja bom', effect: {} }
    ]
  },
  {
    id: 'promocao',
    text: 'Promoção pesa na sua escolha?',
    options: [
      { emoji: '🏷️', label: 'Muito! Adoro um desconto', effect: { sale: 4 } },
      { emoji: '👍', label: 'Seria um bônus', effect: { sale: 1.5 } },
      { emoji: '🎯', label: 'Não, quero o jogo certo', effect: {} }
    ]
  },
  {
    id: 'visual',
    text: 'Qual estilo visual mais te agrada?',
    options: [
      { emoji: '🍭', label: 'Fofo e colorido', effect: { tags: { fofo: 3, familia: 1 } } },
      { emoji: '🌄', label: 'Épico e grandioso', effect: { tags: { mundoaberto: 2, historia: 1, acao: 1 } } },
      { emoji: '👾', label: 'Retrô e pixelado', effect: { tags: { retro: 4, plataforma: 1 } } },
      { emoji: '🎌', label: 'Estilo anime', effect: { tags: { rpg: 2, luta: 1 } } }
    ]
  },
  {
    id: 'colecao',
    text: 'Você é do tipo que…',
    options: [
      { emoji: '📦', label: 'Coleciona tudo que vê pela frente', effect: { tags: { colecionar: 4 } } },
      { emoji: '💯', label: 'Precisa fechar o jogo em 100%', effect: { tags: { plataforma: 2, aventura: 2, longo: 1 } } },
      { emoji: '🏡', label: 'Gosta de construir e decorar', effect: { tags: { simulacao: 4 } } },
      { emoji: '🎬', label: 'Só quer curtir a jornada', effect: { tags: { historia: 2, aventura: 1 } } }
    ]
  },
  {
    id: 'ritmo',
    text: 'Música e ritmo combinam com você?',
    options: [
      { emoji: '🕺', label: 'Sim, adoro dançar', effect: { tags: { musica: 4, party: 1 } } },
      { emoji: '🎵', label: 'Gosto de uma boa trilha sonora', effect: { tags: { historia: 1, aventura: 1 } } },
      { emoji: '🔇', label: 'Não faz diferença', effect: {} }
    ]
  },
  {
    id: 'competicao',
    text: 'Perder pros amigos te deixa…',
    options: [
      { emoji: '😤', label: 'Querendo revanche na hora', effect: { tags: { competitivo: 3, luta: 2, corrida: 1 } } },
      { emoji: '😆', label: 'Rindo junto', effect: { tags: { party: 3 } } },
      { emoji: '🤝', label: 'Prefiro jogar no mesmo time', effect: { tags: { multiplayer: 2, puzzle: 1 } } },
      { emoji: '🧘', label: 'Nem ligo, jogo sozinho', effect: { tags: { historia: 1, relaxante: 1 } } }
    ]
  }
];

export const QUESTIONS_PER_ROUND = 5;

function shuffle<T>(list: T[]): T[] {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pickQuestions(): QuizQuestion[] {
  // Orçamento sempre entra: sem ela, o quiz poderia indicar um jogo caro
  // pra quem só queria gastar pouco.
  const required = QUESTION_POOL.filter((q) => q.id === 'orcamento');
  const rest = shuffle(QUESTION_POOL.filter((q) => q.id !== 'orcamento')).slice(0, QUESTIONS_PER_ROUND - required.length);
  return shuffle([...required, ...rest]);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function itemText(item: Item): string {
  return normalize(` ${item.name} ${item.franchise ?? ''} ${item.description ?? ''} `);
}

export function tagsOf(item: Item): Set<Tag> {
  const text = itemText(item);
  const tags = new Set<Tag>();
  for (const [tag, words] of Object.entries(TAG_KEYWORDS) as [Tag, string[]][]) {
    if (words.some((w) => text.includes(w))) tags.add(tag);
  }
  return tags;
}

function franchiseOf(item: Item): Franchise | null {
  // Franchise and name weigh more than the description (a description can
  // mention "Mario" just as a comparison).
  const text = normalize(` ${item.name} ${item.franchise ?? ''} `);
  for (const [franchise, words] of Object.entries(FRANCHISE_KEYWORDS) as [Exclude<Franchise, 'fora'>, string[]][]) {
    if (words.some((w) => text.includes(w))) return franchise;
  }
  return null;
}

// Jogos que podem ser sorteados: jogos completos (não DLC/atualização), já
// lançados e com capa — senão a esteira e o resultado ficariam sem imagem.
export function eligibleItems(items: Item[]): Item[] {
  const withCover = items.filter((it) => !it.isUpcoming && it.imageUrl);
  const base = withCover.filter((it) => it.gameType === 'base');
  return base.length > 0 ? base : withCover;
}

export type Recommendation = {
  item: Item;
  compatibility: number; // 0–100
  reasons: string[];
};

export function recommend(items: Item[], answers: QuizOption[]): Recommendation | null {
  const pool = eligibleItems(items);
  if (pool.length === 0) return null;

  const wanted: Partial<Record<Tag, number>> = {};
  let franchise: Franchise | null = null;
  let budget: number | null | undefined;
  let platform: 'switch1' | 'switch2' | 'any' = 'any';
  let fame: 'famous' | 'hidden' | null = null;
  let saleWeight = 0;

  for (const { effect } of answers) {
    for (const [tag, w] of Object.entries(effect.tags ?? {}) as [Tag, number][]) {
      wanted[tag] = (wanted[tag] ?? 0) + w;
    }
    if (effect.franchise) franchise = effect.franchise;
    if (effect.budget !== undefined) budget = effect.budget;
    if (effect.platform) platform = effect.platform;
    if (effect.fame) fame = effect.fame;
    if (effect.sale) saleWeight += effect.sale;
  }

  // Pontuação máxima possível só com as etiquetas — base da "compatibilidade".
  const tagTotal = Object.values(wanted).reduce((sum, w) => sum + (w ?? 0), 0);

  const scored = pool.map((item) => {
    const tags = tagsOf(item);
    let tagScore = 0;
    const matched: { tag: Tag; weight: number }[] = [];
    for (const [tag, w] of Object.entries(wanted) as [Tag, number][]) {
      if (tags.has(tag)) {
        tagScore += w;
        matched.push({ tag, weight: w });
      }
    }

    // Jogos com muitas etiquetas (ex.: Mario Kart = corrida, família,
    // multijogador, competitivo…) somariam pontos em quase toda resposta e
    // ganhariam sempre. Dividir pela raiz da quantidade de etiquetas
    // equilibra: conta mais acertar no que o jogo É do que ser "de tudo".
    let score = (tagScore / Math.sqrt(Math.max(3, tags.size))) * 2;
    const itemFranchise = franchiseOf(item);
    if (franchise && franchise !== 'fora' && itemFranchise === franchise) score += 7;
    if (franchise === 'fora' && itemFranchise === null) score += 4;

    let fitsBudget = true;
    if (budget !== undefined && budget !== null) {
      if (item.price <= budget) score += 3;
      else {
        fitsBudget = false;
        // Passar do orçamento pesa bastante, e mais quanto mais caro.
        score -= 8 + ((item.price - budget) / budget) * 12;
      }
    }

    if (platform === 'switch1' && item.platform === 'switch2') score -= 30;
    if (platform === 'switch2' && (item.platform === 'switch2' || item.platform === 'both')) score += 2;

    if (fame === 'famous' && item.isBestseller) score += 4;
    if (fame === 'hidden' && !item.isBestseller) score += 3;
    if (saleWeight > 0 && item.isOnSale) score += saleWeight;

    // Um pouquinho de sorte, pra duas pessoas com respostas parecidas não
    // receberem sempre exatamente o mesmo jogo.
    score += Math.random() * 2.5;

    return { item, score, tagScore, matched, fitsBudget, franchiseHit: !!franchise && franchise !== 'fora' && itemFranchise === franchise };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  const ratio = tagTotal > 0 ? Math.min(1, best.tagScore / (tagTotal * 0.55)) : 0.6;
  let compatibility = 72 + ratio * 22 + (best.franchiseHit ? 3 : 0) + (best.fitsBudget ? 2 : -6);
  compatibility = Math.round(Math.max(68, Math.min(99, compatibility)));

  const reasons = best.matched
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((m) => TAG_LABELS[m.tag]);
  if (best.franchiseHit) reasons.unshift('Seu universo favorito');
  if (budget !== undefined && budget !== null && best.fitsBudget) reasons.push('Cabe no seu orçamento');
  if (saleWeight > 0 && best.item.isOnSale) reasons.push('Está em promoção');

  return { item: best.item, compatibility, reasons: reasons.slice(0, 4) };
}

// Capas aleatórias pra esteira do sorteio, com o jogo vencedor numa posição
// fixa perto do fim (WINNER_INDEX) — é nele que a esteira para.
export const REEL_LENGTH = 40;
export const WINNER_INDEX = 34;

export function buildReel(items: Item[], winner: Item): Item[] {
  const pool = eligibleItems(items).filter((it) => it.id !== winner.id);
  const source = pool.length > 0 ? pool : [winner];
  const reel: Item[] = [];
  let bag: Item[] = [];
  for (let i = 0; i < REEL_LENGTH; i++) {
    if (i === WINNER_INDEX) {
      reel.push(winner);
      continue;
    }
    if (bag.length === 0) bag = shuffle(source);
    reel.push(bag.pop()!);
  }
  return reel;
}
