// Lê, no servidor, o WhatsApp que o cliente informou na tela de compra.
//
// Por que um cookie em vez de mais um parâmetro em cada ação de compra: o
// pedido nasce em vários caminhos (Pix manual, Pix do Mercado Pago, lote,
// cartão, Pix + cartão, crédito parcelado). Ao clicar em "Continuar para o
// pagamento", a tela grava o número num cookie do próprio navegador do
// cliente (ou apaga, se ele deixou em branco), e cada caminho só lê daqui
// na hora de criar o pedido. Como o cookie é do navegador de quem está
// comprando, ninguém consegue mudar o WhatsApp do pedido de outra pessoa.
import { cookies } from 'next/headers';
import { DELIVERY_WHATSAPP_COOKIE, normalizeWhatsApp } from './validation';

export async function readDeliveryWhatsApp(): Promise<string | null> {
  try {
    const store = await cookies();
    return normalizeWhatsApp(store.get(DELIVERY_WHATSAPP_COOKIE)?.value);
  } catch {
    return null;
  }
}
