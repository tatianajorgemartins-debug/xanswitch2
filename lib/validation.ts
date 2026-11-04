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

// WhatsApp opcional informado na compra (ver StepChecklistAndEmail em
// PurchaseModal.tsx) — se o cliente informar, a chave do jogo vai por lá em
// vez do e-mail. Aceita o número do jeito que a pessoa digitar ("(21)
// 99999-9999", "21999999999", "+55 21 ...") e devolve só os números com o
// 55 do Brasil na frente (formato do link wa.me), ou null se não parecer um
// número brasileiro com DDD.
export function normalizeWhatsApp(raw: string | null | undefined): string | null {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.replace(/^0+/, '');
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) return null;
  if (digits[0] === '0' || digits[1] === '0') return null; // DDD não começa nem termina com 0
  return `55${digits}`;
}

// "5521999998888" → "(21) 99999-8888", pra mostrar no admin.
export function formatWhatsApp(normalized: string): string {
  const d = normalized.startsWith('55') ? normalized.slice(2) : normalized;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  return rest.length === 9 ? `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}` : `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}

// Nome do cookie que leva o WhatsApp da tela de compra até o servidor (ver
// lib/deliveryWhatsApp.ts). Fica no navegador do próprio cliente, então
// ninguém consegue trocar o WhatsApp do pedido de outra pessoa.
export const DELIVERY_WHATSAPP_COOKIE = 'xan_wa';
