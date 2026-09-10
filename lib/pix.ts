// Este arquivo monta o "Pix Copia e Cola" (o texto/BR Code) e a imagem do
// QR Code, usando os dados de QUEM RECEBE o pagamento (você). Tudo acontece
// no navegador da pessoa que está comprando — não existe gateway de
// pagamento, conta bancária conectada ou API paga envolvida aqui. É
// literalmente o mesmo texto que você geraria pedindo um "Pix com valor" no
// app do seu banco, só que gerado automaticamente com o preço do jogo.
//
// Onde configurar seus dados: veja o arquivo .env.example na raiz do
// projeto. As variáveis começam com NEXT_PUBLIC_ porque elas PRECISAM ir
// para o navegador do cliente (é lá que o QR Code é desenhado) — isso é
// seguro porque nome, cidade e chave Pix não são segredos: é exatamente o
// que qualquer pessoa veria ao te mandar um Pix pelo app do banco dela.

import { createStaticPix, hasError } from 'pix-utils';

// O padrão Pix (Banco Central) limita esses campos a um tamanho fixo de
// caracteres. Se o valor configurado passar do limite, cortamos aqui pra
// não quebrar a geração do QR Code — mas o ideal é já configurar dentro do
// limite (veja o comentário no .env.example).
const MERCHANT_NAME_MAX = 25;
const MERCHANT_CITY_MAX = 15;

function readReceiverConfig() {
  const pixKey = process.env.NEXT_PUBLIC_PIX_KEY ?? '';
  const merchantName = (process.env.NEXT_PUBLIC_PIX_RECEIVER_NAME ?? '').slice(0, MERCHANT_NAME_MAX);
  const merchantCity = (process.env.NEXT_PUBLIC_PIX_RECEIVER_CITY ?? '').slice(0, MERCHANT_CITY_MAX);
  return { pixKey, merchantName, merchantCity };
}

export type PixPayload = {
  /** O texto "Pix Copia e Cola" — a pessoa cola isso no app do banco dela. */
  brCode: string;
  /** Imagem do QR Code já pronta como data URL (pode ir direto num <img src="">). */
  qrCodeImage: string;
};

/**
 * Monta o Pix (BR Code + QR Code) para o valor de um pedido específico.
 *
 * @param amount preço do jogo em reais (ex: 199.9)
 * @param description texto curto que aparece como identificador do pedido
 *   dentro do próprio Pix (alguns apps de banco mostram isso pro pagador).
 *   Usamos o nome do jogo, mas cortado, porque esse campo também tem limite
 *   de tamanho no padrão Pix.
 */
export async function generatePixPayload(amount: number, description: string): Promise<PixPayload> {
  const { pixKey, merchantName, merchantCity } = readReceiverConfig();

  if (!pixKey || !merchantName || !merchantCity) {
    throw new Error(
      'Dados do Pix não configurados. Defina NEXT_PUBLIC_PIX_KEY, NEXT_PUBLIC_PIX_RECEIVER_NAME e NEXT_PUBLIC_PIX_RECEIVER_CITY (veja o .env.example).'
    );
  }

  const pix = createStaticPix({
    pixKey,
    merchantName,
    merchantCity,
    transactionAmount: amount,
    // "infoAdicional" é o texto extra que aparece no Pix — limitamos porque
    // o padrão também tem um tamanho máximo para esse campo.
    infoAdicional: description.slice(0, 40),
  });

  // createStaticPix nunca lança erro — ele retorna um objeto de erro que
  // precisamos checar manualmente com hasError(). Isso normalmente só
  // acontece se um dos dados acima (chave, nome, cidade) estiver fora do
  // formato/tamanho esperado pelo padrão Pix.
  if (hasError(pix)) {
    throw new Error(`Não foi possível gerar o Pix: ${pix.message}`);
  }

  const brCode = pix.toBRCode();
  const qrCodeImage = await pix.toImage();

  return { brCode, qrCodeImage };
}
