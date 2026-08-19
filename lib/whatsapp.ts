export function formatPriceBR(price: string | number): string {
  const n = typeof price === 'string' ? parseFloat(price) : price;
  if (Number.isNaN(n)) return '0,00';
  return n.toFixed(2).replace('.', ',');
}

// Builds a wa.me link with a pre-filled message for a given game.
// WHATSAPP_NUMBER should be set with country code, digits only, e.g. 5521999999999.
export function buildWhatsAppLink(gameName: string, price: string | number): string {
  const number = process.env.WHATSAPP_NUMBER;
  if (!number) {
    throw new Error(
      'WHATSAPP_NUMBER não está configurada. Adicione essa variável de ambiente no painel da Vercel (com o DDI, ex: 5521999999999).'
    );
  }
  const message = `Olá! Quero comprar: ${gameName} - R$ ${formatPriceBR(price)}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
