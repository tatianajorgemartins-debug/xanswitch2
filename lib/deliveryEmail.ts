// Modelo do e-mail que entrega a chave do jogo pro cliente.
//
// Usado em dois lugares:
//   - no admin (AdminClient.tsx), pra mostrar a prévia do e-mail já com os
//     dados do pedido enquanto você cola a chave;
//   - no servidor (sendGameCodeAction em app/admin/actions.ts), pra montar
//     o e-mail de verdade que sai pelo Resend.
// Por isso este arquivo não lê variáveis de ambiente nem importa nada do
// servidor: tudo que ele precisa chega pelos parâmetros.
//
// Pra mudar o texto do e-mail, é só mexer aqui — a prévia do admin e o
// e-mail enviado mudam juntos.

export type DeliveryEmailData = {
  orderId: number;
  gameName: string;
  price: number;
  code: string;
  // Link do WhatsApp da loja (wa.me/...). Na prévia do admin vem null e o
  // e-mail mostra só o texto, sem link.
  whatsappUrl?: string | null;
};

const SITE_URL = 'https://www.xanswitch.com.br';
export const REDEEM_URL = 'https://ec.nintendo.com/redeem';

// Link do botão "Copiar" (página app/copiar).
function copyUrl(code: string): string {
  return `${SITE_URL}/copiar#${encodeURIComponent(code.trim())}`;
}

function formatPriceBR(price: number): string {
  return price.toFixed(2).replace('.', ',');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Vídeo explicando o resgate passo a passo (Google Drive). As mensagens
// trazem só um resumo bem curto e mandam o cliente assistir o vídeo.
export const TUTORIAL_VIDEO_URL = 'https://drive.google.com/file/d/11IvJUXH8TSlEwayy9EmrZxVXpFVfMiOL/view?usp=drivesdk';

// Resumo do resgate — o detalhe está no vídeo.
const REDEEM_SUMMARY_TEXT =
  'Resumindo: com o saldo da eShop zerado, você muda a região da sua Conta Nintendo pra Japão, resgata o código em ec.nintendo.com/redeem e volta a região pro Brasil. O jogo aparece pra baixar no console.';
const REDEEM_SUMMARY_HTML =
  'Resumindo: com o <strong>saldo da eShop zerado</strong>, você muda a região da sua Conta Nintendo pra <strong>Japão</strong>, resgata o código em <a href="https://ec.nintendo.com/redeem" style="color:#7b3fe4">ec.nintendo.com/redeem</a> e volta a região pro <strong>Brasil</strong>. O jogo aparece pra baixar no console.';

export function buildDeliverySubject(gameName: string): string {
  return `Seu código de ${gameName} chegou! 🎮`;
}

export function buildDeliveryHtml(d: DeliveryEmailData): string {
  const game = escapeHtml(d.gameName);
  const code = d.code.trim()
    ? escapeHtml(d.code.trim())
    : '<span style="color:#9a8fb5;font-weight:400">(a chave que você colar aparece aqui)</span>';
  const help = d.whatsappUrl
    ? `responder este e-mail ou chamar a gente no <a href="${escapeHtml(d.whatsappUrl)}" style="color:#7b3fe4">WhatsApp</a>`
    : 'responder este e-mail ou chamar a gente no WhatsApp';
  // E-mail não roda JavaScript: o botão "Copiar" abre a página /copiar do
  // site, que copia o código (ele vai depois do #, então não chega no
  // servidor). Sem código ainda (prévia do admin vazia), não tem botão.
  const copyButton = d.code.trim()
    ? `<td width="1" class="copy-cell" style="padding-left:10px;vertical-align:middle">
                    <a href="${escapeHtml(copyUrl(d.code))}" style="display:inline-block;background:#7b3fe4;border-radius:10px;padding:10px 14px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;white-space:nowrap"><img src="${SITE_URL}/email/copy-icon.png" width="16" height="16" alt="" style="vertical-align:-3px;margin-right:6px;border:0" />Copiar</a>
                  </td>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  /* Celular: o botão Copiar desce pra baixo do código. */
  @media (max-width: 480px) {
    .code-cell, .copy-cell { display: block !important; width: auto !important; text-align: center !important; }
    .code-cell { font-size: 20px !important; letter-spacing: 1px !important; }
    .copy-cell { padding: 12px 0 0 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f4f1fa;font-family:Arial,Helvetica,sans-serif;color:#1d1530">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1fa;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
        <tr><td style="background:#1a1033;padding:20px 24px;color:#ffffff;font-size:20px;font-weight:700">
          XAN Switch
        </td></tr>
        <tr><td style="padding:24px">
          <p style="margin:0 0 12px;font-size:16px">Olá! 👋</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.5">
            Obrigado pela compra! Aqui está o código do seu jogo <strong>${game}</strong>.
          </p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px">
            <tr><td style="border:2px dashed #7b3fe4;border-radius:12px;padding:16px;text-align:center">
              <div style="font-size:12px;color:#6b5f87;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Seu código</div>
              <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                <tr>
                  <td class="code-cell" style="font-family:'Courier New',monospace;font-size:22px;font-weight:700;letter-spacing:2px;color:#1d1530;overflow-wrap:anywhere;vertical-align:middle">${code}</td>
                  ${copyButton}
                </tr>
              </table>
            </td></tr>
          </table>

          <p style="margin:0 0 6px;font-size:13px;color:#6b5f87">
            Pedido #${d.orderId} · ${game} · R$ ${formatPriceBR(d.price)}
          </p>

          <h3 style="margin:22px 0 10px;font-size:16px">Como resgatar</h3>
          <p style="margin:0 0 14px;font-size:14px;line-height:1.5">
            Assista o vídeo com o passo a passo antes de começar — leva só alguns minutos:
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px">
            <tr><td style="background:#7b3fe4;border-radius:10px">
              <a href="${TUTORIAL_VIDEO_URL}" style="display:inline-block;padding:12px 20px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none">▶ Ver o vídeo do tutorial</a>
            </td></tr>
          </table>
          <p style="margin:0 0 16px;font-size:13.5px;line-height:1.5;color:#4a4060">
            ${REDEEM_SUMMARY_HTML}
          </p>
          <p style="margin:0 0 4px;font-size:14px;line-height:1.5">
            Travou em alguma etapa? É só ${help} que a gente te ajuda na hora.
          </p>
          <p style="margin:16px 0 0;font-size:14px">Bom jogo! 🎮<br/>Equipe XAN Switch</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// Versão em texto puro, enviada junto com o HTML: alguns programas de
// e-mail só mostram ela, e ter as duas ajuda o e-mail a não cair no spam.
export function buildDeliveryText(d: DeliveryEmailData): string {
  const help = d.whatsappUrl
    ? `responder este e-mail ou chamar a gente no WhatsApp: ${d.whatsappUrl}`
    : 'responder este e-mail ou chamar a gente no WhatsApp';
  return [
    'Olá!',
    '',
    `Obrigado pela compra! Aqui está o código do seu jogo ${d.gameName}.`,
    '',
    `SEU CÓDIGO: ${d.code.trim()}`,
    '',
    `Pedido #${d.orderId} · ${d.gameName} · R$ ${formatPriceBR(d.price)}`,
    '',
    'COMO RESGATAR',
    `Assista o vídeo com o passo a passo antes de começar: ${TUTORIAL_VIDEO_URL}`,
    '',
    REDEEM_SUMMARY_TEXT,
    '',
    `Travou em alguma etapa? É só ${help} que a gente te ajuda na hora.`,
    '',
    'Bom jogo!',
    'Equipe XAN Switch'
  ].join('\n');
}

// Mensagem de WhatsApp com a chave — usada quando o cliente informou o
// WhatsApp na compra. O admin abre o WhatsApp (wa.me) com este texto já
// escrito; é só apertar enviar. *texto* vira negrito no WhatsApp.
export function buildDeliveryWhatsAppText(d: Pick<DeliveryEmailData, 'orderId' | 'gameName' | 'price' | 'code'>): string {
  return [
    'Olá! 👋 Aqui é da *XAN Switch*.',
    '',
    `Obrigado pela compra! Segue o código do seu jogo *${d.gameName}*:`,
    '',
    `🔑 *${d.code.trim()}*`,
    '',
    `Pedido #${d.orderId} · R$ ${formatPriceBR(d.price)}`,
    '',
    '*Como resgatar:*',
    `▶ Assista o vídeo com o passo a passo antes de começar: ${TUTORIAL_VIDEO_URL}`,
    '',
    REDEEM_SUMMARY_TEXT,
    '',
    'Travou em alguma etapa? É só me chamar aqui que eu te ajudo na hora.',
    '',
    'Bom jogo! 🎮'
  ].join('\n');
}
