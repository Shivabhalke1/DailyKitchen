/** @type {import('next').NextConfig} */
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendOrigin = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/v1\/?$/, '')
  : 'https://dailykitchen.onrender.com';

const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: `${backendOrigin}/uploads/:path*`,
      },
    ];
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@dailykitchen/contracts': path.resolve(__dirname, 'src/shared/contracts/index.ts'),
      '@dailykitchen/shared-utils': path.resolve(__dirname, 'src/shared/utils/index.ts'),
      '@dailykitchen/tokens': path.resolve(__dirname, 'src/shared/tokens/index.ts'),
      '@dailykitchen/validation': path.resolve(__dirname, 'src/shared/validation/index.ts'),
    };
    return config;
  },
};

export default nextConfig;
