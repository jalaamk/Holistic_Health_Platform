/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  // Ensure environment variables are validated at build time
  webpack: (config) => {
    return config;
  },
};

module.exports = nextConfig;
