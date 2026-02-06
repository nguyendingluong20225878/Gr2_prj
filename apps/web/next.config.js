/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@gr2/shared'], 
  experimental: {

    outputFileTracingRoot: require('path').join(__dirname, '../../'),
  },
  webpack: (config) => {
    // Fix lỗi module mongoose/mongodb khi chạy ở phía server nextjs
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
      // Thêm alias @ để resolve đúng thư mục
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        '@': require('path').resolve(__dirname),
      };
    return config;
  },
};

module.exports = nextConfig;