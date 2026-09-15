export function formatPriceBR(price: string | number): string {
  const n = typeof price === 'string' ? parseFloat(price) : price;
  if (Number.isNaN(n)) return '0,00';
  return n.toFixed(2).replace('.', ',');
}

// Plain contact link (no pre-filled message), used by the header icon.
export function buildWhatsAppContactLink(): string | null {
  const number = process.env.WHATSAPP_NUMBER;
  return number ? `https://wa.me/${number}` : null;
}
