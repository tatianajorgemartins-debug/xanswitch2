// Qual item (personagem, música…) é o desafio de cada dia.
//
// Regras:
//  - só entram os itens ativos naquele dia (ver ativoEm);
//  - não repete um item antes de passar por todos os outros do nível;
//  - adicionar itens novos NUNCA muda os dias que já passaram nem o de hoje:
//    item novo ganha "ativo_desde" = amanhã (o script de sincronização faz
//    isso), e o sorteio "repassa" os dias desde o lançamento olhando, em cada
//    dia, só os itens ativos naquela data. Os dias antigos continuam vendo a
//    mesma lista de antes, então dão o mesmo resultado.
import { addDias, diffDias, embaralhar, rngDe } from './dia.ts';

export type Sorteavel = {
  id: string;
  niveis?: string[];
  // false = fora do sorteio (sem apagar o cadastro).
  ativo?: boolean;
  // "AAAA-MM-DD": só entra no sorteio a partir desse dia.
  ativo_desde?: string;
  // "AAAA-MM-DD": com ativo false, até quando ele valeu (o script preenche).
  inativo_desde?: string;
};

export function ativoEm(item: Sorteavel, dia: string): boolean {
  if (item.ativo_desde && dia < item.ativo_desde) return false;
  if (item.ativo === false) return Boolean(item.inativo_desde) && dia < item.inativo_desde!;
  return true;
}

function poolDoDia<T extends Sorteavel>(lista: readonly T[], nivel: string | null, dia: string): T[] {
  return lista
    .filter((p) => ativoEm(p, dia) && (nivel === null || (p.niveis ?? []).includes(nivel)))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// O item do dia. `inicio` é o dia #1 do jogo; `chave` separa sorteios
// diferentes (ex: "silhueta:facil" e "silhueta:medio" têm ciclos próprios).
// nivel null = qualquer item.
export function sortearDoDia<T extends Sorteavel>(
  lista: readonly T[],
  nivel: string | null,
  dia: string,
  inicio: string,
  chave: string
): T | null {
  if (dia < inicio) {
    const pool = poolDoDia(lista, nivel, dia);
    return pool.length ? pool[Math.floor(rngDe(`${chave}:${dia}`)() * pool.length)] : null;
  }
  const dias = diffDias(inicio, dia);
  const usados = new Set<string>();
  let anterior: string | null = null;
  let escolhido: T | null = null;
  for (let i = 0; i <= dias; i++) {
    const d = addDias(inicio, i);
    const pool = poolDoDia(lista, nivel, d);
    if (pool.length === 0) {
      escolhido = null;
      continue;
    }
    let restantes = pool.filter((p) => !usados.has(p.id));
    if (restantes.length === 0) {
      // Passou por todos: começa um ciclo novo, sem repetir o de ontem.
      usados.clear();
      restantes = pool.length > 1 ? pool.filter((p) => p.id !== anterior) : pool;
    }
    escolhido = restantes[Math.floor(rngDe(`${chave}:${d}`)() * restantes.length)];
    usados.add(escolhido.id);
    anterior = escolhido.id;
  }
  return escolhido;
}

// Número do desafio ("#42"): dias desde o lançamento, começando em 1.
export function numeroDoDia(dia: string, inicio: string): number {
  return diffDias(inicio, dia) + 1;
}

// Sorteio livre (modo treino): qualquer item ativo hoje, evitando `evitar`.
export function sortearTreino<T extends Sorteavel>(lista: readonly T[], nivel: string | null, dia: string, evitar?: string): T | null {
  const pool = poolDoDia(lista, nivel, dia);
  const opcoes = pool.length > 1 ? pool.filter((p) => p.id !== evitar) : pool;
  if (!opcoes.length) return null;
  return embaralhar(opcoes, Math.random)[0];
}
