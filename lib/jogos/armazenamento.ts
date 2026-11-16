// Tudo que os jogos guardam no aparelho fica no localStorage com chaves que
// começam com "xan_jogos_". Qualquer falha (aba anônima, armazenamento
// cheio ou bloqueado) é engolida: o jogo continua, só não salva.

const PREFIXO = 'xan_jogos_';

export function ler<T>(chave: string, padrao: T): T {
  try {
    const bruto = window.localStorage.getItem(PREFIXO + chave);
    return bruto === null ? padrao : (JSON.parse(bruto) as T);
  } catch {
    return padrao;
  }
}

export function gravar(chave: string, valor: unknown): void {
  try {
    window.localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
  } catch {
    // sem armazenamento: segue sem salvar
  }
}
