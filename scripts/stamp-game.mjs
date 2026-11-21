// npm run build runs this first (prebuild). On Vercel it gives each of the game's modules an address with its content's
// hash, /game/sim.js?v=1a2b3c4d5e, in the five pages that run the game's scene (public/play, public/boat-view,
// public/hero-view, public/fleet-view, public/venue-view): the import map sends every import of /game/sim.js there, the <link rel="modulepreload"> lists and
// /play's <script src> name it, and next.config.ts serves an address with the right ?v= as immutable (hashes()). So a returning visitor's
// browser takes the modules from its cache without asking the server again, and a deploy that changes a module changes
// its address: a page can't get yesterday's sim.js with today's world.js. The game's files that aren't modules (the
// land, the music, the yacht: some 2 MB each) get the same in the import map, and the modules that fetch them ask it
// for their address (import.meta.resolve: land.js, music.js, yacht.js, boats3d.js), so a returning player doesn't ask
// for them again either, and main.js asks the same for its voices, calls and gulls. /play's own stylesheets
// (/ui/tokens.css, /ui/game.css, which hold up its first paint) and the RYC logo on its cards get the same ?v=, so a
// returning player's page doesn't wait on the server to say they haven't changed.
//
// Off Vercel it does nothing, so a local build leaves the checked-in pages as they are (and npm run dev never sees
// it); `node scripts/stamp-game.mjs --force [public dir]` stamps anyway. It is idempotent: a stamped page stamped
// again comes out the same. test/preload.test.mjs uses reach() to check the pages' preload lists.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PAGES = ['/play/index.html', '/boat-view/index.html', '/hero-view/index.html', '/fleet-view/index.html', '/venue-view/index.html', '/venues-view/index.html', '/word-view/index.html'];
const THREE = '/vendor/three@0.160.0/build/three.module.min.js';
const ADDONS = '/vendor/three@0.160.0/examples/jsm/';

const reader = (dir) => (p) => readFileSync(`${dir}${p}`, 'utf8');
const bare = (u) => u.replace(/\?v=[0-9a-f]+$/, '');

// a specifier as the pages' import map resolves it (before any stamping), from the module at `from`
function resolve(spec, from) {
  if (spec === 'three') return THREE;
  if (spec.startsWith('three/addons/')) return ADDONS + spec.slice('three/addons/'.length);
  return new URL(spec, `http://x${from}`).pathname;
}
const importsOf = (src) => [...src.matchAll(/^\s*import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm)].map((m) => m[1]);

// every module a page loads, by path, sorted; and the ones its <link rel="modulepreload"> name (without ?v=)
export function reach(dir, page) {
  const read = reader(dir);
  const html = read(page);
  const entry = [
    ...[...html.matchAll(/<script type="module" src="([^"]+)"/g)].map((m) => bare(m[1])),
    ...[...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].flatMap((m) => importsOf(m[1]).map((s) => resolve(s, page))),
  ];
  const seen = new Set();
  const walk = (p) => {
    if (seen.has(p)) return;
    seen.add(p);
    if (p !== THREE) for (const s of importsOf(read(p))) walk(resolve(s, p));
  };
  entry.forEach(walk);
  const preloaded = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((m) => bare(m[1]));
  return { html, reached: [...seen].sort(), preloaded };
}

// the game's files that aren't modules, by path: what the modules fetch (the land, the music, the yacht)
const ASSET = /\.(mp3|m4a|glb|bin|json)$/;
export const assetsOf = (dir) => readdirSync(`${dir}/game`, { recursive: true }).map(String).filter((f) => ASSET.test(f)).map((f) => `/game/${f.split('\\').join('/')}`).sort();

// a page's stylesheets from /ui/ and the logo, where a page names them (stamped already or not)
const PLAIN = /(<link rel="stylesheet" href="|<img [^>]*?src=")(\/ui\/[^"?]+\.css|\/logo-black\.svg)(?:\?v=[0-9a-f]+)?"/g;

// a file's hash, as its ?v=: the first ten hex of the sha-256 of its bytes
export const hashOf = (dir, p) => createHash('sha256').update(readFileSync(`${dir}${p}`)).digest('hex').slice(0, 10);

// Every file a stamped page can name, by path, with its hash: all of /game/, /ui/'s stylesheets and the logo.
// next.config.ts caches an address for good only when its ?v= is the hash of the file this build serves there. Vercel
// answers any ?v= with the file it has (its cache keeps one copy per path, whatever the query), so while a deploy goes
// live, a page of the new build can ask the old one for world.js?v=new and get the old world.js. Marked immutable,
// that old file stayed in the browser under the new address for a year, and every reload ran it with the new main.js
// ("world.setFigures is not a function", 18 November). With the hash checked, the old build's answer comes back to be
// revalidated, and the next load gets the right file.
export function hashes(dir) {
  const game = readdirSync(`${dir}/game`, { recursive: true, withFileTypes: true }).filter((f) => f.isFile())
    .map((f) => `/game/${join(f.parentPath ?? f.path, f.name).slice(`${dir}/game/`.length).split('\\').join('/')}`);
  const ui = readdirSync(`${dir}/ui`).filter((f) => f.endsWith('.css')).map((f) => `/ui/${f}`);
  return Object.fromEntries([...game, ...ui, '/logo-black.svg'].sort().map((p) => [p, hashOf(dir, p)]));
}

export function stamp(dir) {
  const hash = (p) => hashOf(dir, p);
  const files = Object.fromEntries(assetsOf(dir).map((p) => [p, `${p}?v=${hash(p)}`]));
  for (const page of PAGES) {
    const { html, reached } = reach(dir, page);
    const v = Object.fromEntries(reached.filter((p) => p.startsWith('/game/')).map((p) => [p, `${p}?v=${hash(p)}`]));
    const out = html
      .replace(/(<script type="importmap">)(.*?)(<\/script>)/, (_, a, json, b) => {
        const map = JSON.parse(json);
        map.imports = { ...Object.fromEntries(Object.entries(map.imports).filter(([k]) => !k.startsWith('/game/'))), ...v, ...files };
        return a + JSON.stringify(map) + b;
      })
      .replace(/(<link rel="modulepreload" href="|<script type="module" src=")([^"]+)"/g, (m, a, href) => (v[bare(href)] ? `${a}${v[bare(href)]}"` : m))
      // the yacht fetched at once, at the address the game will ask for: at another the browser fetches her twice
      .replace(/(<link rel="preload" as="fetch" href=")([^"]+)"/g, (m, a, href) => (files[bare(href)] ? `${a}${files[bare(href)]}"` : m))
      .replace(PLAIN, (_, a, p) => `${a}${p}?v=${hash(p)}"`);
    writeFileSync(`${dir}${page}`, out);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const force = process.argv.includes('--force');
  const dir = process.argv.slice(2).find((a) => !a.startsWith('--')) || fileURLToPath(new URL('../public', import.meta.url));
  if (!process.env.VERCEL && !force) console.log('stamp-game: not on Vercel, the game pages stay unstamped');
  else { stamp(dir); console.log(`stamp-game: the game's modules in ${PAGES.join(', ')} carry their hashes`); }
}
