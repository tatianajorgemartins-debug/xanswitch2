// Recebe erros de JavaScript que acontecem no navegador dos clientes (ver
// instrumentation-client.ts) e só escreve no log do servidor, pra aparecer
// em "vercel logs". Não guarda nada no banco. Corpo limitado e campos
// cortados, pra ninguém usar isso pra encher os logs.
export async function POST(request: Request) {
  try {
    const text = (await request.text()).slice(0, 4000);
    const data = JSON.parse(text) as Record<string, unknown>;
    const field = (key: string, max: number) => String(data[key] ?? '').slice(0, max);
    console.error(
      '[client-error]',
      JSON.stringify({
        kind: field('kind', 40),
        message: field('message', 500),
        url: field('url', 300),
        userAgent: field('userAgent', 400),
        stack: field('stack', 2000)
      })
    );
  } catch {
    // Corpo inválido: ignora em silêncio.
  }
  return new Response(null, { status: 204 });
}
