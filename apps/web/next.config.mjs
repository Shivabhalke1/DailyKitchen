/** @type {import('next').NextConfig} */
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = {
  reactStrictMode: true,
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
