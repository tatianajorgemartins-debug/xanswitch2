// Regras e dados do "Silhueta do Dia" (sem tela). A tela fica em
// SilhuetaClient.tsx; os personagens, em data/jogos/personagens.json
// (adicionados pelo script scripts/sincronizar-personagens.mjs).
import { embaralhar, rngDe } from '@/lib/jogos/dia';
import { ativoEm, sortearDoDia, sortearTreino } from '@/lib/jogos/sorteio';
import { normalizar, respostaConfere } from '@/lib/jogos/respostas';

// Dia #1 do jogo. Não mude depois de publicado: muda a numeração e o
// personagem de todos os dias.
export const INICIO = '2026-11-16';
export const JOGO = 'silhueta';

export type NivelId = 'facil' | 'medio' | 'dificil' | 'insano';

export type Personagem = {
  id: string;
  nome: string;
  aceitos?: string[];
  franquia: string;
  jogo: string;
  estreia: number | null;
  tipo?: string;
  niveis: string[];
  imagem: string;
  ativo?: boolean;
  ativo_desde?: string;
  inativo_desde?: string;
  // Nome da franquia como está no catálogo da loja, se for diferente
  // (ex: "Legend Of Zelda"). Sem ele, o jogo tenta achar sozinho.
  franquia_loja?: string;
};

export type Nivel = {
  id: NivelId;
  nome: string;
  tentativas: number;
  resumo: string;
  // 'opcoes' = escolhe entre botões; 'digitar' = escreve o nome.
  resposta: 'opcoes' | 'digitar';
  // Quanto da figura aparece em cada tentativa (1 = inteira). Sem isso, a
  // silhueta aparece inteira o tempo todo.
  recortes?: number[];
  // Recorte girado/espelhado, com desfoque e ruído.
  embaralhado?: boolean;
  cronometro?: boolean;
};

export const NIVEIS: Nivel[] = [
  { id: 'facil', nome: 'Fácil', tentativas: 3, resumo: 'Silhueta inteira e opções pra escolher', resposta: 'opcoes' },
  { id: 'medio', nome: 'Médio', tentativas: 5, resumo: 'Silhueta inteira, você digita o nome', resposta: 'digitar' },
  {
    id: 'dificil',
    nome: 'Difícil',
    tentativas: 5,
    resumo: 'Só um pedaço, que vai abrindo a cada erro',
    resposta: 'digitar',
    recortes: [0.35, 0.48, 0.62, 0.78, 0.92]
  },
  {
    id: 'insano',
    nome: 'Insano',
    tentativas: 3,
    resumo: 'Pedacinho girado, sem dicas, contra o relógio',
    resposta: 'digitar',
    recortes: [0.2, 0.3, 0.42],
    embaralhado: true,
    cronometro: true
  }
];

// Quantas opções no Fácil. Com 4 opções e 3 tentativas, a dica "elimina 2"
// da 2ª tentativa deixaria só a resposta certa — com 6 sobram 2.
export const OPCOES_FACIL = 6;

// data/jogos/personagens.json → só o que o jogo usa (sem arquivo_original,
// revisar etc.), ignorando itens incompletos.
export function personagensDoJson(raw: Record<string, unknown>[]): Personagem[] {
  return raw
    .filter((p) => typeof p.id === 'string' && typeof p.nome === 'string' && typeof p.imagem === 'string')
    .map((p) => ({
      id: p.id as string,
      nome: p.nome as string,
      aceitos: Array.isArray(p.aceitos) ? (p.aceitos as string[]) : [],
      franquia: typeof p.franquia === 'string' ? p.franquia : '',
      jogo: typeof p.jogo === 'string' ? p.jogo : '',
      estreia: typeof p.estreia === 'number' ? p.estreia : null,
      ...(typeof p.tipo === 'string' && p.tipo ? { tipo: p.tipo } : {}),
      niveis: Array.isArray(p.niveis) ? (p.niveis as string[]) : [],
      imagem: p.imagem as string,
      ...(p.ativo === false ? { ativo: false } : {}),
      ...(typeof p.ativo_desde === 'string' ? { ativo_desde: p.ativo_desde } : {}),
      ...(typeof p.inativo_desde === 'string' ? { inativo_desde: p.inativo_desde } : {}),
      ...(typeof p.franquia_loja === 'string' ? { franquia_loja: p.franquia_loja } : {})
    }));
}

export function imagemUrl(p: Personagem, tipo: 'silhueta' | 'cor'): string {
  return `/jogos/silhueta/${p.imagem}-${tipo === 'silhueta' ? 's' : 'c'}.webp`;
}

export function personagemDoDia(lista: readonly Personagem[], nivel: NivelId, dia: string): Personagem | null {
  return sortearDoDia(lista, nivel, dia, INICIO, `${JOGO}:${nivel}`);
}

export function personagemTreino(lista: readonly Personagem[], nivel: NivelId, dia: string, evitar?: string): Personagem | null {
  return sortearTreino(lista, nivel, dia, evitar);
}

// As opções do Fácil: a resposta + nomes diferentes de outros personagens
// ativos, embaralhados. No diário, iguais pra todo mundo (semente do dia).
export function opcoesFacil(lista: readonly Personagem[], certo: Personagem, dia: string, aleatorio: boolean): string[] {
  const rng = aleatorio ? Math.random : rngDe(`${JOGO}:facil:opcoes:${dia}`);
  // Opções erradas: primeiro personagens conhecidos (do Fácil e do Médio),
  // pra não dar pra descartar fácil um nome que ninguém conhece.
  const grupos: string[][] = [[], []];
  const vistos = new Set([normalizar(certo.nome)]);
  for (const p of [...lista].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const n = normalizar(p.nome);
    if (!ativoEm(p, dia) || vistos.has(n)) continue;
    vistos.add(n);
    grupos[p.niveis.includes('facil') || p.niveis.includes('medio') ? 0 : 1].push(p.nome);
  }
  const erradas = [...embaralhar(grupos[0], rng), ...embaralhar(grupos[1], rng)].slice(0, OPCOES_FACIL - 1);
  return embaralhar([certo.nome, ...erradas], rng);
}

// Dica da 2ª tentativa do Fácil: duas opções erradas (ainda não escolhidas)
// que somem.
export function eliminadasFacil(opcoes: string[], certo: string, jaEscolhidas: string[], dia: string, aleatorio: boolean): string[] {
  const rng = aleatorio ? Math.random : rngDe(`${JOGO}:facil:elimina:${dia}`);
  const candidatas = opcoes.filter((o) => o !== certo && !jaEscolhidas.includes(o));
  return embaralhar(candidatas, rng).slice(0, 2);
}

// A franquia entrega a resposta? (ex: Donkey Kong, Kirby, Bayonetta)
export function franquiaEntregaNome(p: Personagem): boolean {
  const f = normalizar(p.franquia);
  const n = normalizar(p.nome);
  return Boolean(f) && (f.includes(n) || n.includes(f));
}

// Dicas de texto do personagem, na ordem em que vão aparecendo. Pula as que
// entregariam o nome. Ordem: franquia → jogo → ano de estreia → tipo.
export function dicasTexto(p: Personagem): { rotulo: string; valor: string }[] {
  const d: { rotulo: string; valor: string }[] = [];
  const nome = normalizar(p.nome);
  const entrega = (s: string) => {
    const t = normalizar(s);
    return t.includes(nome) || (t.length >= 4 && nome.includes(t));
  };
  if (p.franquia && !franquiaEntregaNome(p)) d.push({ rotulo: 'Franquia', valor: p.franquia });
  if (p.jogo && !entrega(p.jogo)) d.push({ rotulo: 'Jogo', valor: p.jogo });
  if (p.estreia) d.push({ rotulo: 'Estreia', valor: String(p.estreia) });
  if (p.tipo) d.push({ rotulo: 'Tipo', valor: p.tipo });
  return d;
}

// O que cada nível mostra depois de `erros` erros.
//   Fácil:   1 erro → 1ª dica; 2 erros → some 2 opções (feito na tela).
//   Médio:   1, 2, 3 erros → 1, 2, 3 dicas; 4 erros → imagem 30% colorida.
//   Difícil: o recorte abre a cada erro; a partir de 2 erros, a 1ª dica.
//   Insano:  só o recorte abre; nenhuma dica.
export function ajudas(nivel: Nivel, p: Personagem, erros: number): { textos: { rotulo: string; valor: string }[]; cor: number } {
  const todas = dicasTexto(p);
  switch (nivel.id) {
    case 'facil':
      return { textos: erros >= 1 ? todas.slice(0, 1) : [], cor: 0 };
    case 'medio':
      return { textos: todas.slice(0, Math.min(erros, 3)), cor: erros >= 4 ? 0.3 : 0 };
    case 'dificil':
      return { textos: erros >= 2 ? todas.slice(0, 1) : [], cor: 0 };
    default:
      return { textos: [], cor: 0 };
  }
}

// Quanto da figura aparece com `erros` erros (1 = inteira).
export function recorteAtual(nivel: Nivel, erros: number): number {
  if (!nivel.recortes) return 1;
  return nivel.recortes[Math.min(erros, nivel.recortes.length - 1)];
}

// O personagem cadastrado que bate com o que a pessoa digitou (pra não
// gastar tentativa com erro de digitação ou nome que não existe no jogo).
export function personagemDaResposta(lista: readonly Personagem[], texto: string): Personagem | null {
  return lista.find((p) => respostaConfere(texto, p)) ?? null;
}

// "Jogo · Franquia · estreou em 1981", sem repetir nada.
export function infoPersonagem(p: Personagem): string {
  const partes = [p.jogo, p.franquia].filter(Boolean);
  const unicas = partes.filter((x, i) => partes.findIndex((y) => normalizar(y) === normalizar(x)) === i);
  return [...unicas, p.estreia ? `estreou em ${p.estreia}` : null].filter(Boolean).join(' · ');
}

// Franquia como está no catálogo da loja, pro link "Ver jogos de … na loja".
export function franquiaNaLoja(p: Personagem, franquiasLoja: readonly string[]): string | null {
  if (p.franquia_loja) return franquiasLoja.includes(p.franquia_loja) ? p.franquia_loja : null;
  const limpa = (s: string) => normalizar(s.replace(/^the\s+/i, ''));
  const alvo = limpa(p.franquia);
  if (!alvo) return null;
  return (
    franquiasLoja.find((f) => limpa(f) === alvo) ??
    franquiasLoja.find((f) => limpa(f).includes(alvo) || (limpa(f).length >= 4 && alvo.includes(limpa(f)))) ??
    null
  );
}

// "0:42"
export function formatarTempo(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Título do resultado ("Silhueta do Dia #42 · Difícil") — no compartilhar e
// no feed.
export function tituloResultado(numero: number | null, nivel: Nivel): string {
  return `Silhueta do Dia${numero ? ` #${numero}` : ' · Treino'} · ${nivel.nome}`;
}

// Texto do botão "Compartilhar" (não revela a resposta).
export function textoCompartilhar(o: {
  numero: number;
  nivel: Nivel;
  erros: number;
  venceu: boolean;
  sequencia: number;
  tempo?: string;
}): string {
  return [
    tituloResultado(o.numero, o.nivel),
    placar(o),
    `🔥 Sequência: ${o.sequencia} ${o.sequencia === 1 ? 'dia' : 'dias'}`,
    'xanswitch.com.br'
  ].join('\n');
}

// "⬛⬛🟩 3/5 · ⏱️ 0:42"
export function placar(o: { nivel: Nivel; erros: number; venceu: boolean; tempo?: string }): string {
  const quadrados = '⬛'.repeat(o.erros) + (o.venceu ? '🟩' : '');
  const conta = o.venceu ? `${o.erros + 1}/${o.nivel.tentativas}` : `X/${o.nivel.tentativas}`;
  return `${quadrados} ${conta}${o.tempo ? ` · ⏱️ ${o.tempo}` : ''}`;
}
