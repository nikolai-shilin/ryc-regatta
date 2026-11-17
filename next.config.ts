import type { NextConfig } from 'next';

// The race itself is the static Three.js game in public/: its page is public/play/index.html, its code public/game/.
// /play serves that page, so the game and the Next.js pages share one origin (the Supabase session cookie and the
// settings in localStorage reach the race).
const config: NextConfig = {
  // the site's 404 as a document of its own (app/global-not-found.tsx): the root layout under app/[lang]/ can't render one
  experimental: { globalNotFound: true },
  // what the share cards are drawn from, read from disk (lib/og.tsx): the face, the game's pictures behind them, the logo
  outputFileTracingIncludes: { '/og/**/*': ['./lib/og-fonts/*.ttf', './lib/og-bg/*.jpg', './public/images/brand-icon.svg'] },
  // The game pictures in public/images are rendered at 3–4× and served at quality 90 (every <Image> snaps to the one
  // allowed quality), AVIF where the browser takes it, else WebP. They only change with a new render, so cache them long.
  images: { qualities: [90], formats: ['image/avif', 'image/webp'], minimumCacheTTL: 2678400 },
  // the fleet and the yachts were two pages of the same scene: one now, /yachts
  async redirects() {
    return [{ source: '/fleet', destination: '/yachts', permanent: true }];
  },
  async rewrites() {
    return [
      { source: '/play', destination: '/play/index.html' },
      { source: '/boat-view', destination: '/boat-view/index.html' }, // the boat page's 3D preview, the game's own yacht
      { source: '/hero-view', destination: '/hero-view/index.html' }, // the home page's hero: a race the game sails by itself
      { source: '/fleet-view', destination: '/fleet-view/index.html' }, // the fleet page's scene: every yacht afloat together
      { source: '/venue-view', destination: '/venue-view/index.html' }, // a venue page's scene: the drone over a race on its course
      { source: '/venues-view', destination: '/venues-view/index.html' }, // the list of venues' scene: the drone off your boat and round the water
    ];
  },
  async headers() {
    return [
      { source: '/play', headers: [{ key: 'x-robots-tag', value: 'noindex' }] },
      { source: '/boat-view', headers: [{ key: 'x-robots-tag', value: 'noindex' }] },
      { source: '/hero-view', headers: [{ key: 'x-robots-tag', value: 'noindex' }] },
      { source: '/fleet-view', headers: [{ key: 'x-robots-tag', value: 'noindex' }] },
      { source: '/venue-view', headers: [{ key: 'x-robots-tag', value: 'noindex' }] },
      { source: '/venues-view', headers: [{ key: 'x-robots-tag', value: 'noindex' }] },
      { source: '/game/:path*', headers: [{ key: 'cache-control', value: 'public, max-age=0, must-revalidate' }] },
      // a module at its hashed address (scripts/stamp-game.mjs, at the build): a new version has a new address
      { source: '/game/:path*', has: [{ type: 'query', key: 'v' }], headers: [{ key: 'cache-control', value: 'public, max-age=31536000, immutable' }] },
      { source: '/ui/:path*', headers: [{ key: 'cache-control', value: 'public, max-age=0, must-revalidate' }] }, // the design system's, as the game's
      // /play's stylesheets and the logo on its cards at their hashed address (scripts/stamp-game.mjs), as the game's modules
      { source: '/ui/:path*', has: [{ type: 'query', key: 'v' }], headers: [{ key: 'cache-control', value: 'public, max-age=31536000, immutable' }] },
      { source: '/logo-black.svg', has: [{ type: 'query', key: 'v' }], headers: [{ key: 'cache-control', value: 'public, max-age=31536000, immutable' }] },
      // three.js, served from here rather than a CDN (the version is in the path, so a file there never changes)
      { source: '/vendor/:path*', headers: [{ key: 'cache-control', value: 'public, max-age=31536000, immutable' }] },
      // the country flags (the flag picker shows some 250 at once) and the pictures as they are, outside next/image (the
      // badges, the bot's logo on the sail, the OG card): they hardly ever change and carry no hash, so a day without
      // asking, then a month of answering from the cache while the browser checks in the background
      { source: '/flags/:path*', headers: [{ key: 'cache-control', value: 'public, max-age=86400, stale-while-revalidate=2592000' }] },
      { source: '/images/:path*', headers: [{ key: 'cache-control', value: 'public, max-age=86400, stale-while-revalidate=2592000' }] },
    ];
  },
};

export default config;
