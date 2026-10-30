// Botão fixo de WhatsApp no canto inferior direito (catálogo de jogos e de
// produtos físicos). A mensagem já vai preenchida — e, com um jogo/produto
// aberto, inclui o nome dele, pra atender sem precisar perguntar "qual?".
// Fica acima da janela do jogo; no celular, com a janela aberta, sobe pra
// não cobrir a barra de compra presa no pé (ver .floating-whatsapp no CSS).
export default function FloatingWhatsApp({
  baseUrl,
  productName,
  modalOpen
}: {
  baseUrl: string | null;
  productName?: string | null;
  modalOpen: boolean;
}) {
  if (!baseUrl) return null;
  const message = productName
    ? `Olá! Vim pelo site da XAN Switch e tenho uma dúvida sobre ${productName}.`
    : 'Olá! Vim pelo site da XAN Switch.';
  const href = `${baseUrl}?text=${encodeURIComponent(message)}`;

  return (
    <a
      className={`floating-whatsapp${modalOpen ? ' is-over-modal' : ''}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={productName ? `Tirar dúvida sobre ${productName} no WhatsApp` : 'Falar com a XAN Switch no WhatsApp'}
      title="Falar no WhatsApp"
    >
      <svg viewBox="0 0 24 24" width={28} height={28} fill="currentColor" aria-hidden="true">
        <path d="M12 2.2a9.7 9.7 0 00-8.3 14.8L2.3 21.8l4.9-1.3A9.7 9.7 0 1012 2.2zm0 17.7a8 8 0 01-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1112 19.9zm4.4-6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.6 6.6 0 01-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.7-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 00-.7.3 2.8 2.8 0 00-.9 2.1 4.9 4.9 0 001 2.6 11.2 11.2 0 004.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 001.7-1.2 2.1 2.1 0 00.1-1.2c0-.1-.2-.2-.4-.3z" />
      </svg>
    </a>
  );
}
