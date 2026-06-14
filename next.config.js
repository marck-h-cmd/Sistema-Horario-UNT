/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['puppeteer', 'puppeteer-core', 'zod', 'ai', '@ai-sdk/groq'],
    serverMinification: false
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
      };
    }
    return config;
  },
  async redirects() {
    return [
      { source: '/docentes', destination: '/dashboard/docentes', permanent: false },
      { source: '/cursos', destination: '/dashboard/cursos', permanent: false },
      { source: '/aulas', destination: '/dashboard/ambientes', permanent: false },
      {
        source: '/laboratorios',
        destination: '/dashboard/ambientes?tipo=LABORATORIO',
        permanent: false,
      },
      { source: '/horarios', destination: '/dashboard/horarios', permanent: false },
      { source: '/reportes', destination: '/dashboard/reportes', permanent: false },
      {
        source: '/notificaciones',
        destination: '/dashboard/notificaciones',
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.CORS_ORIGIN || '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;