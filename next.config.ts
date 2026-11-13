import type { NextConfig } from 'next';

// The race itself is the static Three.js game in public/: its page is public/play/index.html, its code public/game/.
// /play serves that page, so the game and the Next.js pages share one origin (the Supabase session cookie and the
// settings in localStorage reach the race).
const config: NextConfig = {
  // The game pictures in public/images are rendered at 3–4× and served at quality 90 (every <Image> snaps to the one
  // allowed quality), AVIF where the browser takes it, else WebP. They only change with a new render, so cache them long.
  images: { qualities: [90], formats: ['image/avif', 'image/webp'], minimumCacheTTL: 2678400 },
  async rewrites() {
    return [
      { source: '/play', destination: '/play/index.html' },
      { source: '/boat-view', destination: '/boat-view/index.html' }, // the boat page's 3D preview, the game's own yacht
      { source: '/hero-view', destination: '/hero-view/index.html' }, // the home page's hero: a race the game sails by itself
    ];
  },
  async headers() {
    return [
      { source: '/play', headers: [{ key: 'x-robots-tag', value: 'noindex' }] },
      { source: '/boat-view', headers: [{ key: 'x-robots-tag', value: 'noindex' }] },
      { source: '/hero-view', headers: [{ key: 'x-robots-tag', value: 'noindex' }] },
      { source: '/game/:path*', headers: [{ key: 'cache-control', value: 'public, max-age=0, must-revalidate' }] },
    ];
  },
};

export default config;
