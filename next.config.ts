import type { NextConfig } from 'next';

// The race itself is the static Three.js game in public/: its page is public/play/index.html, its code public/game/.
// /play serves that page, so the game and the Next.js pages share one origin (the Supabase session cookie and the
// settings in localStorage reach the race).
const config: NextConfig = {
  async rewrites() {
    return [
      { source: '/play', destination: '/play/index.html' },
      { source: '/boat-view', destination: '/boat-view/index.html' }, // the boat page's 3D preview, the game's own yacht
    ];
  },
  async headers() {
    return [
      { source: '/play', headers: [{ key: 'x-robots-tag', value: 'noindex' }] },
      { source: '/boat-view', headers: [{ key: 'x-robots-tag', value: 'noindex' }] },
      { source: '/game/:path*', headers: [{ key: 'cache-control', value: 'public, max-age=0, must-revalidate' }] },
    ];
  },
};

export default config;
