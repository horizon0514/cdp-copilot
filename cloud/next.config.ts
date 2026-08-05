import type { NextConfig } from 'next';

const config: NextConfig = {
  // The extension's lockfile sits one level up, and Turbopack would otherwise
  // infer the repo root as this app's root.
  turbopack: { root: import.meta.dirname },

  // Carried over from the static site's vercel.json when it moved in here.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default config;
