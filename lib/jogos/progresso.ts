// O progresso salvo dos jogos diários: estatísticas por jogo e nível, e a
// sequência geral XAN. As regras ficam em sequencia.ts; aqui só se lê e grava.
import { ler, gravar } from './armazenamento';
import { diaEm } from './dia';
import {
  ehMarco,
  avancarSequencia,
  registrarResultado,
  sequenciaHoje,
  SEQUENCIA_VAZIA,
  STATS_VAZIO,
  type EstadoSequencia,
  type ResultadoDiario,
  type StatsModo
} from './sequencia';

// Mudou o formato salvo? Suba a versão e converta em carregar().
const VERSAO = 1;
const CHAVE = 'progresso';

type Progresso = {
  v: number;
  // "silhueta:facil", "ocarina:dia"…
  modos: Record<string, StatsModo>;
  geral: EstadoSequencia;
};

function carregar(): Progresso {
  const p = ler<Progresso | null>(CHAVE, null);
  if (!p || p.v !== VERSAO || typeof p.modos !== 'object') return { v: VERSAO, modos: {}, geral: SEQUENCIA_VAZIA };
  return p;
}

export function chaveModo(jogo: string, modo: string): string {
  return `${jogo}:${modo}`;
}

export function statsDe(jogo: string, modo: string): StatsModo {
  return carregar().modos[chaveModo(jogo, modo)] ?? STATS_VAZIO;
}

// Resultado do desafio de `dia` nesse modo, se a pessoa já jogou.
export function resultadoDoDia(jogo: string, modo: string, dia: string = diaEm()): ResultadoDiario | null {
  const u = statsDe(jogo, modo).ultimo;
  return u && u.dia === dia ? u : null;
}

export function sequenciaGeralHoje(hoje: string = diaEm()): { atual: number; melhor: number } {
  const g = carregar().geral;
  return { atual: sequenciaHoje(g, hoje), melhor: g.melhor };
}

// Salva o resultado do desafio diário. Devolve as estatísticas novas e, se a
// sequência geral acabou de bater um marco (3, 7, 15, 30 dias…), o marco.
export function registrarDiario(
  jogo: string,
  modo: string,
  resultado: ResultadoDiario
): { stats: StatsModo; geral: { atual: number; melhor: number }; marco: number | null } {
  const p = carregar();
  const chave = chaveModo(jogo, modo);
  const antes = p.modos[chave] ?? STATS_VAZIO;
  const stats = registrarResultado(antes, resultado);
  const geralAntes = p.geral;
  const geral = avancarSequencia(geralAntes, resultado.dia, true);
  const marco = geral.atual !== geralAntes.atual && ehMarco(geral.atual) ? geral.atual : null;
  gravar(CHAVE, { ...p, modos: { ...p.modos, [chave]: stats }, geral } satisfies Progresso);
  if (marco) onMarcoSequencia(marco);
  return { stats, geral: { atual: geral.atual, melhor: geral.melhor }, marco };
}

// ---------- Ponto de integração: marcos de sequência ----------
//
// Chamado uma vez quando a sequência geral XAN chega a 3, 7, 15 ou 30 dias
// (e depois a cada 30). Hoje só avisa a página com o evento
// "xan-jogos:marco" (detail: { dias }) — a comemoração na tela é dos jogos.
//
// PRA LIGAR AO PROGRAMA DE PONTOS/CUPONS DA LOJA: coloque aqui a chamada pro
// servidor (ex: uma server action que dá pontos pra quem está logado).
// Lembre que isto roda no navegador e o localStorage pode ser editado pela
// pessoa: o prêmio de verdade tem que ser conferido no servidor.
export function onMarcoSequencia(dias: number): void {
  try {
    window.dispatchEvent(new CustomEvent('xan-jogos:marco', { detail: { dias } }));
  } catch {
    // fora do navegador: nada a fazer
  }
}
