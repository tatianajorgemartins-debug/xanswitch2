// Comparar a resposta digitada com o nome do personagem: ignora maiúsculas,
// acentos, espaços, hífens e pontuação, e aceita os apelidos de "aceitos".

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'e')
    .replace(/[^a-z0-9]/g, '');
}

export type ComNomes = { nome: string; aceitos?: string[] };

export function respostaConfere(resposta: string, alvo: ComNomes): boolean {
  const r = normalizar(resposta);
  if (!r) return false;
  return [alvo.nome, ...(alvo.aceitos ?? [])].some((n) => normalizar(n) === r);
}

// Nomes pro autocompletar: primeiro os que começam com o texto, depois os
// que contêm. Sem repetir nomes iguais (ex: três Ganondorf viram um só).
export function sugestoes(texto: string, nomes: readonly string[], max = 6): string[] {
  const t = normalizar(texto);
  if (!t) return [];
  const unicos = [...new Map(nomes.map((n) => [normalizar(n), n])).values()];
  const comeca = unicos.filter((n) => normalizar(n).startsWith(t));
  const contem = unicos.filter((n) => !normalizar(n).startsWith(t) && normalizar(n).includes(t));
  return [...comeca.sort((a, b) => a.localeCompare(b, 'pt-BR')), ...contem.sort((a, b) => a.localeCompare(b, 'pt-BR'))].slice(0, max);
}
