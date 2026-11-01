// Marca "o quiz pediu login": o catálogo (CatalogClient.tsx) vê isso ao
// carregar — inclusive voltando do login do Google, que recarrega a página —
// e reabre o quiz no resultado pra guardar o card. Fica num arquivo à parte
// pra o catálogo não precisar baixar o quiz inteiro só pra ler a marca.
export const QUAL_LINK_LOGIN_FLAG = 'xan-qual-link-login';

export function clearQualLinkLoginFlag() {
  try {
    sessionStorage.removeItem(QUAL_LINK_LOGIN_FLAG);
  } catch {
    // nada a fazer
  }
}
