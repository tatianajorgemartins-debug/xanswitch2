import type { Metadata, Viewport } from 'next';
import { preconnect } from 'react-dom';
import './globals.css';

export const metadata: Metadata = {
  title: 'XAN Switch — Catálogo',
  description: 'Catálogo de jogos digitais para Nintendo Switch — XAN Switch'
};

// Cor da barra de status do celular (e do app instalado) — o fundo escuro do site.
export const viewport: Viewport = {
  themeColor: '#0a0716'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // As capas vêm do Supabase Storage: abrir a conexão logo no começo
  // economiza um vaivém de rede antes da primeira imagem.
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) preconnect(process.env.NEXT_PUBLIC_SUPABASE_URL);
  return (
    // suppressHydrationWarning: o script do modo claro/escuro (ver Theme.tsx)
    // coloca data-theme no <html> antes do React carregar.
    <html lang="pt-BR" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
