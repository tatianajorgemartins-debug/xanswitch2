// Validação simples de e-mail — usada tanto no navegador (pra habilitar o
// botão "Continuar" na etapa de e-mail do checkout) quanto no servidor
// (defesa extra, caso alguém chame a Server Action diretamente sem passar
// pela tela). Não tenta cobrir todo o RFC de e-mail, só o formato básico
// "algo@algo.algo" — suficiente pra pegar erro de digitação comum.
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Opções de "como você conheceu a loja?", mostradas como caixinhas de marcar
// (opcional) na tela de pagamento — ver ReferralSourcePicker em
// PurchaseModal.tsx. Lista compartilhada entre o componente (navegador) e a
// Server Action que salva o pedido (servidor), pra os dois sempre
// concordarem sobre quais valores são válidos.
export const REFERRAL_SOURCES = ['Zelda Brasil', 'Nintendólatras', 'Instagram da loja', 'Outro'] as const;
export type ReferralSource = (typeof REFERRAL_SOURCES)[number];

export function isValidReferralSource(value: string): value is ReferralSource {
  return (REFERRAL_SOURCES as readonly string[]).includes(value);
}
