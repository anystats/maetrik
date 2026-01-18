/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [],

  // Proxy API requests to backend server (avoids CORS issues)
  async rewrites() {
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
