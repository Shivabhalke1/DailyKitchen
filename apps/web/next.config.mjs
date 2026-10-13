/** @type {import('next').NextConfig} */
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@dailykitchen/tokens',
    '@dailykitchen/contracts',
    '@dailykitchen/validation',
    '@dailykitchen/shared-utils',
  ],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@dailykitchen/contracts': path.resolve(__dirname, '../../packages/contracts/src/index.ts'),
      '@dailykitchen/shared-utils': path.resolve(__dirname, '../../packages/shared-utils/src/index.ts'),
      '@dailykitchen/tokens': path.resolve(__dirname, '../../packages/tokens/src/index.ts'),
      '@dailykitchen/validation': path.resolve(__dirname, '../../packages/validation/src/index.ts'),
    };
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default nextConfig;
