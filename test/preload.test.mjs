// The five pages that run the game's scene (public/play, public/boat-view, public/hero-view, public/fleet-view, public/venue-view) name every module they
// will load in <link rel="modulepreload">, so the browser asks for them all at once instead of one level of imports at
// a time (five round trips deep from main.js). npm test walks each page's imports and checks its list is exactly the
// modules it reaches: a module added to the game goes in the lists too, and one taken out leaves them. And on Vercel,
// scripts/stamp-game.mjs gives each of the game's modules its content's hash, ?v=, which next.config.ts caches for good
// (at that hash only).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES, hashOf, reach, stamp } from '../scripts/stamp-game.mjs';

const pub = fileURLToPath(new URL('../public', import.meta.url));

for (const page of PAGES) {
  test(`${page} preloads every module it reaches, and no other`, () => {
    const { html, reached, preloaded } = reach(pub, page);
    assert.deepEqual([...preloaded].sort(), reached);
    assert.equal(new Set(preloaded).size, preloaded.length, 'a module preloaded twice');
    // after the import map, so no module fetch starts before the map is known
    assert.ok(html.indexOf('rel="modulepreload"') > html.indexOf('type="importmap"'), 'the preloads come after the import map');
  });

  test(`${page} fetches the yacht at once`, () => {
    assert.match(readFileSync(join(pub, page), 'utf8'), /<link rel="preload" as="fetch" href="\/game\/yacht\.glb" crossorigin>/);
  });
}

test('the checked-in pages are unstamped: the hashes are added at the build, never by hand', () => {
  for (const page of PAGES) assert.doesNotMatch(readFileSync(join(pub, page), 'utf8'), /\?v=/, page);
});

test("stamped, each page's game modules carry their content's hash, in the import map, the preloads and /play's script", () => {
  const dir = mkdtempSync(join(tmpdir(), 'stamp-'));
  try {
    // the pages and the code, not the land and the sounds
    cpSync(pub, dir, { recursive: true, filter: (s) => !/\/(venues|images|flags)$|\.(bin|mp3|m4a|glb)$/.test(s) });
    stamp(dir);
    const once = PAGES.map((p) => readFileSync(join(dir, p), 'utf8'));
    for (const [i, page] of PAGES.entries()) {
      const html = once[i];
      const { reached, preloaded } = reach(dir, page);
      assert.deepEqual([...preloaded].sort(), reached, `${page}: stamping kept the list`);
      const map = JSON.parse(/<script type="importmap">(.*?)<\/script>/.exec(html)[1]).imports;
      assert.equal(map.three, '/vendor/three@0.160.0/build/three.module.min.js');
      for (const p of reached.filter((p) => p.startsWith('/game/'))) {
        const v = `${p}?v=${createHash('sha256').update(readFileSync(join(pub, p))).digest('hex').slice(0, 10)}`;
        assert.equal(map[p], v, `${page}: the import map's ${p}`);
        assert.ok(html.includes(`<link rel="modulepreload" href="${v}">`), `${page}: the preload of ${p}`);
      }
      // the vendor's files keep their own addresses (their version is in the path already)
      for (const p of reached.filter((p) => p.startsWith('/vendor/'))) assert.ok(html.includes(`<link rel="modulepreload" href="${p}">`), p);
    }
    assert.match(once[0], /<script type="module" src="\/game\/main\.js\?v=[0-9a-f]{10}"><\/script>/);
    // /play's stylesheets and logo too, every one of them, at their content's hash
    const at = (p) => `${p}?v=${createHash('sha256').update(readFileSync(join(pub, p))).digest('hex').slice(0, 10)}`;
    for (const p of ['/ui/tokens.css', '/ui/game.css']) assert.ok(once[0].includes(`<link rel="stylesheet" href="${at(p)}">`), p);
    assert.doesNotMatch(once[0], /href="\/ui\/[^"?]+"|src="\/logo-black\.svg"/, 'a stylesheet or a logo left unstamped');
    assert.ok(once[0].includes(`src="${at('/logo-black.svg')}"`), 'the logo');
    stamp(dir);
    assert.deepEqual(PAGES.map((p) => readFileSync(join(dir, p), 'utf8')), once, 'stamping twice changes nothing');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('stamped, the yacht and the land are preloaded at the very address the game asks for, so neither comes twice', async () => {
  const { runInNewContext } = await import('node:vm');
  const dir = mkdtempSync(join(tmpdir(), 'stamp-'));
  try {
    cpSync(pub, dir, { recursive: true, filter: (s) => /\/(yacht\.glb|skopea\.bin)$/.test(s) || !/\/(venues|images|flags)$|\.(bin|mp3|m4a|glb)$/.test(s) });
    stamp(dir);
    for (const page of PAGES.filter((p) => p !== '/fleet-view/index.html')) { // (the fleet's land is Garda's, whose files aren't copied here)
      const html = readFileSync(join(dir, page), 'utf8'), text = /<script type="importmap">(.*?)<\/script>/.exec(html)[1], map = JSON.parse(text).imports;
      assert.match(map['/game/yacht.glb'], /\?v=[0-9a-f]{10}$/);
      assert.ok(html.includes(`<link rel="preload" as="fetch" href="${map['/game/yacht.glb']}" crossorigin>`), `${page}: the yacht`);
      assert.ok(html.indexOf('type="importmap"') < html.indexOf("l.rel = 'preload'"), `${page}: the map is there for the land's preload to read`);
      const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((x) => x.includes("l.rel = 'preload'")), links = [];
      runInNewContext(script, { Date, Math, JSON, URLSearchParams, location: { search: '?venue=gocek' }, localStorage: { getItem: () => null }, history: { replaceState() {} },
        document: { querySelector: () => ({ textContent: text }), createElement: () => ({}), head: { appendChild: (l) => links.push(l.href) } } });
      assert.ok(links.includes(map['/game/skopea.bin']), `${page}: the land`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an address is cached for good only at its own hash: the rest of /game/ and /ui/ revalidates, and the build stamps', async () => {
  const { default: config } = await import('../next.config.ts');
  const rules = await config.headers();
  const at = (source) => rules.findIndex((r) => r.source === source && !r.has);
  for (const plain of ['/game/:path*', '/ui/:path*']) {
    assert.ok(at(plain) >= 0, plain);
    assert.deepEqual(rules[at(plain)].headers, [{ key: 'cache-control', value: 'public, max-age=0, must-revalidate' }], plain);
  }
  // no rule caches a file for good at any ?v= (Vercel would hand an old build's file out at a new build's address)
  assert.ok(!rules.some((r) => r.has && r.has.some((h) => h.key === 'v' && !h.value)), 'a ?v= rule without its hash');
  const forever = new Map(rules.filter((r) => r.has && r.has[0].key === 'v').map((r) => {
    assert.ok(rules.indexOf(r) > Math.max(at('/game/:path*'), at('/ui/:path*')), `${r.source}: after the plain rules, so it wins`);
    assert.deepEqual(r.headers, [{ key: 'cache-control', value: 'public, max-age=31536000, immutable' }], r.source);
    return [`${r.source}?v=${r.has[0].value}`, r];
  }));
  // every hashed address a stamped page names is one of them, at the hash of the file served there
  const dir = mkdtempSync(join(tmpdir(), 'stamp-'));
  try {
    cpSync(pub, dir, { recursive: true, filter: (s) => !/\/(images|flags)$|\.(bin|mp3|m4a|glb)$/.test(s) });
    stamp(dir);
    const named = new Set(PAGES.flatMap((p) => [...readFileSync(join(dir, p), 'utf8').matchAll(/"(\/[^"?]+\?v=[0-9a-f]{10})"/g)].map((m) => m[1])));
    assert.ok(named.size > 100, `${named.size} addresses`);
    for (const u of named) assert.ok(forever.has(u), `${u} is cached for good`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  assert.ok(forever.has(`/game/world.js?v=${hashOf(pub, '/game/world.js')}`));
  assert.ok(!forever.has('/game/world.js?v=0a713b9fc9'), 'an old hash is not');
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts.prebuild, 'node scripts/stamp-game.mjs');
});
