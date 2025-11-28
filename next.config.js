/** @type {import('next').NextConfig} */
const nextConfig = {
  // Aumentar limite de tamanho do body para uploads grandes
  experimental: {
    serverActions: {
      bodySizeLimit: '1gb', // Limite de 1GB para uploads
    },
  },
  // Removido output: 'standalone' para compatibilidade com diferentes plataformas
  // O Vercel funciona melhor sem isso, e outras plataformas também
};

module.exports = nextConfig;

