// Roda no navegador antes do resto do site (ver a doc de
// instrumentation-client do Next.js). Duas coisas:
//
// 1. Remendos (polyfills) pra navegadores um pouco antigos, como iPhones com
//    iOS 15 e Androids desatualizados: o próprio Next.js usa .at() e
//    Object.hasOwn, que só existem a partir do Safari 15.4. Sem isso, o site
//    quebrava logo ao abrir nesses aparelhos (a famosa "tela preta").
// 2. Registro de erros: qualquer erro de JavaScript no navegador do cliente
//    é enviado pra /api/client-error e aparece nos logs da Vercel, com o
//    navegador e a página, pra dar pra investigar o que aconteceu.

function definePolyfill(target: object, name: string, value: unknown) {
  if (name in target) return;
  try {
    Object.defineProperty(target, name, { value, writable: true, configurable: true, enumerable: false });
  } catch {}
}

function at(this: ArrayLike<unknown>, index: number) {
  const length = this.length;
  let i = Math.trunc(index) || 0;
  if (i < 0) i += length;
  return i < 0 || i >= length ? undefined : this[i];
}

definePolyfill(Array.prototype, 'at', at);
definePolyfill(String.prototype, 'at', function (this: string, index: number) {
  return at.call(this, index);
});
definePolyfill(Object, 'hasOwn', (object: object, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(Object(object), key)
);

const REPORT_URL = '/api/client-error';
let reportsSent = 0;

function reportClientError(kind: string, message: unknown, stack?: unknown) {
  // Limite por visita, pra um erro em loop não inundar os logs.
  if (reportsSent >= 5) return;
  reportsSent += 1;
  try {
    const body = JSON.stringify({
      kind,
      message: String(message ?? '').slice(0, 500),
      stack: String(stack ?? '').slice(0, 2000),
      url: window.location.pathname + window.location.search,
      userAgent: navigator.userAgent
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(REPORT_URL, new Blob([body], { type: 'application/json' }));
    } else {
      fetch(REPORT_URL, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(
        () => {}
      );
    }
  } catch {}
}

try {
  window.addEventListener('error', (event) => {
    reportClientError('error', event.message, event.error?.stack);
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as { message?: string; stack?: string } | undefined;
    reportClientError('unhandledrejection', reason?.message ?? reason, reason?.stack);
  });
} catch {}

// Usado pelas telas de erro (app/error.tsx e app/global-error.tsx).
(window as unknown as { __xanReportError?: typeof reportClientError }).__xanReportError = reportClientError;
