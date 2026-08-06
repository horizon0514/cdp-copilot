import type { NextConfig } from 'next';

const config: NextConfig = {
  // The extension's lockfile sits one level up, and Turbopack would otherwise
  // infer the repo root as this app's root.
  turbopack: { root: import.meta.dirname },

  async headers() {
    return [
      // Carried over from the static site's vercel.json when it moved in here.
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        // The caller is a Chrome extension page, whose origin is a
        // chrome-extension:// URL that changes between an unpacked build and a
        // published one — so it cannot be enumerated here.
        //
        // Opening this up costs nothing: every route below authenticates with a
        // bearer token the browser does not attach on its own. CORS only guards
        // ambient credentials like cookies, and there are none. A hostile page
        // reaching this endpoint still has no token, and gets a 401.
        //
        // In production the extension bypasses CORS anyway, since pagehand.app
        // is in its static host_permissions. This is what makes localhost work,
        // where the permission is optional and rarely granted.
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'authorization, content-type' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
    ];
  },
};

export default config;
