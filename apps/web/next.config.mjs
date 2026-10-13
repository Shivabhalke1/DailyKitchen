/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@dailykitchen/tokens',
    '@dailykitchen/contracts',
    '@dailykitchen/validation',
    '@dailykitchen/shared-utils',
  ],
};

export default nextConfig;
