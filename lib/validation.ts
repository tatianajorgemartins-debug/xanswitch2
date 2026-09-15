// Validação simples de e-mail — usada tanto no navegador (pra habilitar o
// botão "Continuar" na etapa de e-mail do checkout) quanto no servidor
// (defesa extra, caso alguém chame a Server Action diretamente sem passar
// pela tela). Não tenta cobrir todo o RFC de e-mail, só o formato básico
// "algo@algo.algo" — suficiente pra pegar erro de digitação comum.
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
