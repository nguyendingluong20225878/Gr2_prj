/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  experimental: {

    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  webpack: (config) => {
    // Fix lỗi module mongoose/mongodb khi chạy ở phía server nextjs
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
      // Thêm alias @ để resolve đúng thư mục
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        '@': require('path').resolve(__dirname),
        '@gr2/shared$': path.resolve(__dirname, '../../core/shared/dist/index.js'),
        '@gr2/shared': path.resolve(__dirname, '../../core/shared/dist'),
        mongoose: path.resolve(__dirname, '../../node_modules/mongoose'),
      };
    return config;
  },
};

module.exports = nextConfig;
