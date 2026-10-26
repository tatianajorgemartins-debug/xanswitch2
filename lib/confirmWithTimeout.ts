import type { ConfirmOrderResult } from '@/app/orderActions';

// Tempo máximo esperando o servidor confirmar o pedido. Depois disso (ou
// se a conexão cair no meio), o botão para de carregar e o cliente vê uma
// mensagem pra tentar de novo, em vez de ficar girando pra sempre.
const CONFIRM_TIMEOUT_MS = 25000;

export const CONFIRM_CONNECTION_ERROR =
  'Não conseguimos confirmar agora (a conexão falhou ou demorou demais). Se você já fez o pagamento, não pague de novo: é só apertar o botão de confirmar outra vez. Se o pedido já tinha chegado, ele não é registrado em dobro.';

export async function confirmWithTimeout(run: () => Promise<ConfirmOrderResult>): Promise<ConfirmOrderResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ConfirmOrderResult>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, error: CONFIRM_CONNECTION_ERROR }), CONFIRM_TIMEOUT_MS);
  });
  try {
    return await Promise.race([run(), timeout]);
  } catch {
    return { ok: false, error: CONFIRM_CONNECTION_ERROR };
  } finally {
    clearTimeout(timer);
  }
}
