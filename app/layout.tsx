import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'XAN Switch — Catálogo',
  description: 'Catálogo de jogos digitais para Nintendo Switch — XAN Switch'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
