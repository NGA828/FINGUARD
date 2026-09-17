/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Le navigateur ne parle qu'au frontend ; le serveur relaie vers l'API NestJS.
    return [{ source: '/api/:path*', destination: 'http://localhost:4000/api/:path*' }];
  },
};

export default nextConfig;
