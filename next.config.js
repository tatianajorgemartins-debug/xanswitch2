/** @type {import('next').NextConfig} */
const nextConfig = {
  // Só no "npm run dev": deixa abrir o site pelo celular na mesma rede Wi-Fi
  // (http://IP-do-computador:3000). Não afeta o site publicado.
  allowedDevOrigins: ['192.168.*.*', '*.lhr.life', '*.app.lhr.life'],
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb'
    }
  },
  // O catálogo de produtos físicos mudou de /produtos-fisicos pra
  // /beedle-games — links antigos (já compartilhados ou no Google) levam pro
  // endereço novo, inclusive os de produto (/produtos-fisicos/12).
  redirects() {
    return [
      { source: '/produtos-fisicos', destination: '/beedle-games', permanent: true },
      { source: '/produtos-fisicos/:id', destination: '/beedle-games/:id', permanent: true },
      // O Ocarina Hero virou Zelda Tour: o endereço novo abre a mesma página.
      { source: '/testes/ocarina-hero', destination: '/testes/zelda-tour', permanent: true }
    ];
  },
  rewrites() {
    return [{ source: '/testes/zelda-tour', destination: '/testes/ocarina-hero' }];
  },
  // O site não usa o componente <Image> do Next hoje (usa <img> comum em
  // todo lugar), mas essa configuração fica pronta caso isso mude no
  // futuro — sem ela, o Next bloquearia imagens desses domínios.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co'
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com'
      }
    ]
  }
};

module.exports = nextConfig;
