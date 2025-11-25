/** @type {import('next').NextConfig} */
const nextConfig = {
  // Aumentar limite de tamanho do body para uploads grandes
  experimental: {
    serverActions: {
      bodySizeLimit: '1gb', // Limite de 1GB para uploads
    },
  },
};

module.exports = nextConfig;

