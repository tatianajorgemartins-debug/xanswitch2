import type { MetadataRoute } from 'next';

// O "cartão de identidade" do site como aplicativo: é o que o Android lê pra
// instalar o XAN Switch na tela inicial (pelo Chrome, em "Instalar app") e o
// que o app da Play Store usa (ver android/README.md). Cores = fundo escuro
// do site (--bg em redesign.css), pra não piscar branco ao abrir.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'XAN Switch',
    short_name: 'XAN Switch',
    description: 'Catálogo de jogos digitais para Nintendo Switch — XAN Switch',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0716',
    theme_color: '#0a0716',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
}
