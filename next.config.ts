import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';
import { hashes } from './scripts/stamp-game.mjs';

const FOREVER = [{ key: 'cache-control', value: 'public, max-age=31536000, immutable' }];

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
  // the fleet and the yachts were two pages of the same scene: one now, /yachts. The passport is on the player card
  // now: a link someone shared keeps its passport in the address, and with none it is your own. The badges are gone:
  // a link to their page goes to the race hub
  async redirects() {
    return [
      { source: '/fleet', destination: '/yachts', permanent: true },
      { source: '/passport', has: [{ type: 'query', key: 'v' }], destination: '/players', permanent: true },
      { source: '/passport', destination: '/players?me=1', permanent: true },
      { source: '/race/badges', destination: '/race', permanent: true },
      { source: '/learn/rulebook', destination: '/rulebook', permanent: true }, // the rule book's first address
    ];
  },
  async rewrites() {
    return [
      { source: '/play', destination: '/play/index.html' },
      { source: '/boat-view', destination: '/boat-view/index.html' }, // the boat page's 3D preview, the game's own yacht
      { source: '/hero-view', destination: '/hero-view/index.html' }, // the home page's hero: a race the game sails by itself
      { source: '/fleet-view', destination: '/fleet-view/index.html' }, // the fleet page's scene: every yacht afloat together
      { source: '/venue-view', destination: '/venue-view/index.html' }, // a venue page's scene: the drone over a race on its course
      { source: '/venues-view', destination: '/venues-view/index.html' }, // the list of venues' scene: the drone off your boat and round the water
      { source: '/word-view', destination: '/word-view/index.html' }, // the sailing dictionary's scene: a word sailed on the water
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
      { source: '/word-view', headers: [{ key: 'x-robots-tag', value: 'noindex' }] },
      { source: '/game/:path*', headers: [{ key: 'cache-control', value: 'public, max-age=0, must-revalidate' }] },
      { source: '/ui/:path*', headers: [{ key: 'cache-control', value: 'public, max-age=0, must-revalidate' }] }, // the design system's, as the game's
      // The game's files, /play's stylesheets and the logo on its cards at their hashed address (scripts/stamp-game.mjs,
      // at the build): a new version has a new address, so the browser keeps it for good. Only at this build's own
      // hash, though: Vercel serves a file at any ?v=, and an old build still answering while this one goes live would
      // otherwise hand out its old file as this one's, to be kept for a year (stamp-game.mjs, hashes()).
      ...Object.entries(hashes(fileURLToPath(new URL('./public', import.meta.url))))
        .map(([source, v]) => ({ source, has: [{ type: 'query' as const, key: 'v', value: v }], headers: FOREVER })),
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
