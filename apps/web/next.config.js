/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@repo/shared'], 
  experimental: {

    outputFileTracingRoot: require('path').join(__dirname, '../../'),
  },
  webpack: (config) => {
    // Fix lỗi module mongoose/mongodb khi chạy ở phía server nextjs
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
};

module.exports = nextConfig;