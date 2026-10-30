// Texto de parcelamento que aparece embaixo do preço nos cards de jogo
// (catálogo, destaques, mais desejados). Fica num lugar só pra trocar fácil.
//
// Hoje os juros das parcelas são pagos pelo cliente e variam por cartão
// (configuração do Mercado Pago — "Checkout > Parcelamento"), então não dá
// pra mostrar o valor exato da parcela: mostra só o máximo de parcelas.
// Se um dia ativar parcelas SEM juros, troque INTEREST_FREE_INSTALLMENTS
// pelo número delas e o texto vira "ou Nx de R$ X sem juros".
export const MAX_INSTALLMENTS = 12;
export const INTEREST_FREE_INSTALLMENTS = 0;

export function installmentsLabel(cardPrice: number): string {
  if (INTEREST_FREE_INSTALLMENTS > 1) {
    const each = (cardPrice / INTEREST_FREE_INSTALLMENTS).toFixed(2).replace('.', ',');
    return `ou ${INTEREST_FREE_INSTALLMENTS}x de R$ ${each} sem juros`;
  }
  return `em até ${MAX_INSTALLMENTS}x no cartão`;
}
