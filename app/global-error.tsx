'use client';

import ErrorScreen from './ErrorScreen';

// Erro no layout raiz: o Next.js troca a página inteira por esta, por isso
// ela tem o próprio <html> e <body>.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0 }}>
        <title>XAN Switch</title>
        <ErrorScreen error={error} retry={retry} />
      </body>
    </html>
  );
}
