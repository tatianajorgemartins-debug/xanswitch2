/** @type {import('next').NextConfig} */
const nextConfig = {
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
      { source: '/produtos-fisicos/:id', destination: '/beedle-games/:id', permanent: true }
    ];
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
