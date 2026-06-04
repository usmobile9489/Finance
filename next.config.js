/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  transpilePackages: ['@hebcal/core'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabaseusercontent.com',
      },
    ],
  },
}

module.exports = nextConfig
