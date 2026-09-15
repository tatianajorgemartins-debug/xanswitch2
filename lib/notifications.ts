// Avisa você (a dona da loja) sempre que um pedido é confirmado pelo cliente
// ("Já paguei — confirmar pedido"). Dois canais, sempre tentados os dois:
//
//   Canal A — E-mail (Resend): o principal, sempre ativo. Veja no README a
//   seção "Notificação automática de novo pedido" pra saber onde configurar
//   a chave.
//
//   Canal B — WhatsApp (CallMeBot): um bônus opcional. Se a chave não
//   estiver configurada, ou se o envio falhar por qualquer motivo, isso
//   NUNCA deve travar o pedido do cliente — o e-mail já é a garantia
//   principal, e o pedido em si já foi salvo no banco antes desta função
//   ser chamada (ver app/orderActions.ts). Por isso os dois envios abaixo
//   engolem os próprios erros e só registram um log no servidor.

type OrderNotification = {
  items: { gameName: string; price: number }[];
  total: number;
  customerEmail: string;
};

function formatPriceBR(price: number): string {
  return price.toFixed(2).replace('.', ',');
}

function buildSubject(items: OrderNotification['items']): string {
  return items.length === 1 ? `Novo pedido — ${items[0].gameName}` : `Novo pedido — ${items.length} jogos`;
}

function buildGamesList(items: OrderNotification['items']): string {
  return items.map((it) => `${it.gameName} (R$ ${formatPriceBR(it.price)})`).join(', ');
}

async function sendOrderEmail(order: OrderNotification): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ORDER_NOTIFICATION_EMAIL;
  if (!apiKey || !to) {
    console.error(
      '[notifications] RESEND_API_KEY ou ORDER_NOTIFICATION_EMAIL não configurados — e-mail de novo pedido não enviado.'
    );
    return;
  }

  const horario = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const linhasJogos = order.items.map((it) => `<li>${it.gameName} — R$ ${formatPriceBR(it.price)}</li>`).join('');

  // Chamado direto via fetch na API HTTP do Resend, sem precisar instalar o
  // pacote deles — é só uma requisição POST comum com a chave no header.
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'XAN Switch <onboarding@resend.dev>',
      to,
      subject: buildSubject(order.items),
      html: `
        <p><strong>Jogo(s):</strong></p>
        <ul>${linhasJogos}</ul>
        <p><strong>Total:</strong> R$ ${formatPriceBR(order.total)}</p>
        <p><strong>E-mail do cliente:</strong> ${order.customerEmail}</p>
        <p><strong>Horário:</strong> ${horario}</p>
      `
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend respondeu ${res.status}: ${body}`);
  }
}

async function sendOrderWhatsApp(order: OrderNotification): Promise<void> {
  const apiKey = process.env.CALLMEBOT_API_KEY;
  const phone = process.env.WHATSAPP_NUMBER;
  // Bônus opcional — sem chave configurada, simplesmente não envia (não é
  // um erro, é uma escolha válida não usar esse canal).
  if (!apiKey || !phone) return;

  const text = `Novo pedido!\nJogo(s): ${buildGamesList(order.items)}\nTotal: R$ ${formatPriceBR(
    order.total
  )}\nE-mail: ${order.customerEmail}`;

  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(text)}&apikey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CallMeBot respondeu ${res.status}`);
  }
}

// Chamada depois que o pedido já foi salvo no banco (ver
// confirmOrderAction / confirmBulkOrderAction em app/orderActions.ts).
// Nunca lança erro pra quem chamou — o pior cenário aceitável aqui é você
// não receber o aviso automático, e ainda assim conseguir ver o pedido na
// hora certa em /admin > Pedidos.
export async function notifyNewOrder(order: OrderNotification): Promise<void> {
  await sendOrderEmail(order).catch((err) => {
    console.error('[notifications] Falha ao enviar e-mail de novo pedido:', err);
  });

  await sendOrderWhatsApp(order).catch((err) => {
    console.error('[notifications] Falha ao enviar WhatsApp (CallMeBot) de novo pedido:', err);
  });
}
