/** @type {import('next').NextConfig} */
const nextConfig = {
  // Aumentar limite de tamanho do body para uploads grandes
  experimental: {
    serverActions: {
      bodySizeLimit: '1gb', // Limite de 1GB para uploads
    },
  },
  // Configurações para Vercel
  output: 'standalone', // Otimiza para produção no Vercel
};

module.exports = nextConfig;

