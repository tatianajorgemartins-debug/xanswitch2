// Regras da sequência diária (streak) e das estatísticas — sem acessar o
// navegador, pra poderem ser testadas (tests/jogos/sequencia.test.ts). Quem
// guarda isso no aparelho é progresso.ts.
//
// Duas sequências:
//  - por jogo e nível: dias seguidos VENCENDO o desafio diário (perder zera);
//  - geral XAN: dias seguidos completando pelo menos um desafio diário de
//    qualquer jogo, vencendo ou não.
import { addDias } from './dia.ts';

export type EstadoSequencia = { atual: number; melhor: number; ultimoDia: string | null };

export const SEQUENCIA_VAZIA: EstadoSequencia = { atual: 0, melhor: 0, ultimoDia: null };

// Marcos que ganham comemoração (e chamam onMarcoSequencia em progresso.ts).
// Depois do último, a cada 30 dias.
export const MARCOS = [3, 7, 15, 30];

export function ehMarco(dias: number): boolean {
  return MARCOS.includes(dias) || (dias > 30 && dias % 30 === 0);
}

// Atualiza a sequência com o desafio do `dia`. `contou` = esse dia conta
// pra sequência (venceu, na do jogo; jogou, na geral). Jogar de novo no
// mesmo dia não muda nada.
export function avancarSequencia(e: EstadoSequencia, dia: string, contou: boolean): EstadoSequencia {
  if (e.ultimoDia === dia) return e;
  if (!contou) return { ...e, atual: 0, ultimoDia: dia };
  const seguido = e.ultimoDia !== null && addDias(e.ultimoDia, 1) === dia;
  const atual = seguido ? e.atual + 1 : 1;
  return { atual, melhor: Math.max(e.melhor, atual), ultimoDia: dia };
}

// A sequência como aparece hoje: se o último dia foi antes de ontem, ela já
// quebrou (mostra 0), mesmo que o número salvo seja outro.
export function sequenciaHoje(e: EstadoSequencia, hoje: string): number {
  if (!e.ultimoDia) return 0;
  return e.ultimoDia === hoje || addDias(e.ultimoDia, 1) === hoje ? e.atual : 0;
}

export type ResultadoDiario = {
  dia: string;
  venceu: boolean;
  // Em quantas tentativas acertou (ou o total, se perdeu).
  tentativas: number;
  // O que cada jogo quiser guardar pra redesenhar a tela de resultado.
  detalhe?: Record<string, unknown>;
};

export type StatsModo = {
  partidas: number;
  vitorias: number;
  // tentativas da vitória → quantas vezes ("X" = perdeu).
  distribuicao: Record<string, number>;
  sequencia: EstadoSequencia;
  ultimo: ResultadoDiario | null;
};

export const STATS_VAZIO: StatsModo = {
  partidas: 0,
  vitorias: 0,
  distribuicao: {},
  sequencia: SEQUENCIA_VAZIA,
  ultimo: null
};

export function registrarResultado(s: StatsModo, r: ResultadoDiario): StatsModo {
  if (s.ultimo?.dia === r.dia) return s; // já jogou esse dia
  const chave = r.venceu ? String(r.tentativas) : 'X';
  return {
    partidas: s.partidas + 1,
    vitorias: s.vitorias + (r.venceu ? 1 : 0),
    distribuicao: { ...s.distribuicao, [chave]: (s.distribuicao[chave] ?? 0) + 1 },
    sequencia: avancarSequencia(s.sequencia, r.dia, r.venceu),
    ultimo: r
  };
}
