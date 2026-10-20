import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'XAN Switch — Catálogo',
  description: 'Catálogo de jogos digitais para Nintendo Switch — XAN Switch'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: o script do modo claro/escuro (ver Theme.tsx)
    // coloca data-theme no <html> antes do React carregar.
    <html lang="pt-BR" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
