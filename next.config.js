/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb'
    }
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
