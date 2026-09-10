export function formatPriceBR(price: string | number): string {
  const n = typeof price === 'string' ? parseFloat(price) : price;
  if (Number.isNaN(n)) return '0,00';
  return n.toFixed(2).replace('.', ',');
}

// Monta o link do wa.me usado depois que o cliente diz "já paguei" no modal
// de compra (etapa 4). A mensagem já vem com os dados do pedido preenchidos,
// pra você não precisar perguntar "qual jogo?" e "quanto pagou?" de novo —
// e pra continuar a conversa de forma organizada até a verificação manual.
// WHATSAPP_NUMBER deve ter o DDI, só números, ex: 5521999999999.
export function buildWhatsAppPaymentLink(gameName: string, price: string | number): string {
  const number = process.env.WHATSAPP_NUMBER;
  if (!number) {
    throw new Error(
      'WHATSAPP_NUMBER não está configurada. Adicione essa variável de ambiente no painel da Vercel (com o DDI, ex: 5521999999999).'
    );
  }
  const message = `Acabei de pagar via Pix, segue meu comprovante:\n\nJogo: ${gameName}\nValor: R$ ${formatPriceBR(price)}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

// Plain contact link (no pre-filled message), used by the header icon.
export function buildWhatsAppContactLink(): string | null {
  const number = process.env.WHATSAPP_NUMBER;
  return number ? `https://wa.me/${number}` : null;
}
