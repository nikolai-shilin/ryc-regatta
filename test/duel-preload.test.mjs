// The race's files fetched while Match found waits (lib/duel-preload.ts): at the addresses /play's import map gives (as
// stamped on Vercel, and as checked in), the land first, then the yachts, three.js and the modules; the yachts' models
// are the game's own; progress after each file; nothing more once stopped. And the card's line (components/duel-finder.tsx).
// Run: node --test test/duel-preload.test.mjs
import './load.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { plain } from './fake-dom.mjs';

const { raceFiles, preloadRace, MODELS } = await import('../lib/duel-preload.ts');
const { DuelFinderView } = await import('../components/duel-finder.tsx');
const { parseSeek } = await import('../lib/duel-seek.ts');
const PLAY = readFileSync(new URL('../public/play/index.html', import.meta.url), 'utf8');

test('as checked in: the land, the yacht, the shared models, three.js and every module /play preloads', () => {
  const f = raceFiles(PLAY, 'phuket', 'j70');
  assert.deepEqual(f.slice(0, 6), ['/game/venues/phuket.json', '/game/venues/phuket.bin', '/game/j70.glb', '/game/yacht.glb', '/game/committee.glb', '/vendor/three@0.160.0/build/three.module.min.js']);
  const pre = [...PLAY.matchAll(/<link rel="modulepreload" href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(pre.length > 20);
  assert.deepEqual(f.slice(6), pre.filter((p) => p !== f[5]), 'the modules in /play\'s order, three.js once');
  assert.deepEqual(raceFiles(PLAY, 'gocek', 'jpk1050').slice(0, 4), ['/game/skopea.json', '/game/skopea.bin', '/game/yacht.glb', '/game/committee.glb'], 'Göcek\'s land, and no model of her own for the JPK');
  for (const p of f.filter((x) => x.startsWith('/game/'))) assert.ok(readdirSync(new URL(`../public${p.slice(0, p.lastIndexOf('/'))}`, import.meta.url)).includes(p.slice(p.lastIndexOf('/') + 1)), p);
});

test('as stamped on Vercel: each at its hashed address, so the game finds it in the cache', () => {
  const html = `<script type="importmap">{"imports":{"three":"/vendor/three@0.160.0/build/three.module.min.js","/game/main.js":"/game/main.js?v=f1e9261314","/game/venues/phuket.json":"/game/venues/phuket.json?v=11","/game/venues/phuket.bin":"/game/venues/phuket.bin?v=97480f8dbc","/game/j70.glb":"/game/j70.glb?v=c76924d385","/game/yacht.glb":"/game/yacht.glb?v=0945ac1f0a","/game/committee.glb":"/game/committee.glb?v=4bd165dbc9"}}</script>
<link rel="modulepreload" href="/game/main.js?v=f1e9261314">`;
  assert.deepEqual(raceFiles(html, 'phuket', 'j70'), ['/game/venues/phuket.json?v=11', '/game/venues/phuket.bin?v=97480f8dbc', '/game/j70.glb?v=c76924d385', '/game/yacht.glb?v=0945ac1f0a', '/game/committee.glb?v=4bd165dbc9', '/vendor/three@0.160.0/build/three.module.min.js', '/game/main.js?v=f1e9261314']);
  assert.deepEqual(raceFiles('<p>no map</p>', 'antigua', 'laser'), ['/game/venues/antigua.json', '/game/venues/antigua.bin', '/game/laser.glb', '/game/yacht.glb', '/game/committee.glb']);
});

test('the yachts\' models are the ones the game loads for its classes', () => {
  const src = readFileSync(new URL('../public/game/boats3d.js', import.meta.url), 'utf8');
  assert.deepEqual([...new Set([...src.matchAll(/loadModel\('([a-z0-9]+)\.glb'/g)].map((m) => m[1]))].sort(), [...MODELS].sort());
  assert.match(readFileSync(new URL('../public/game/yacht.js', import.meta.url), 'utf8'), /fileAt\('yacht\.glb'\)/);
  assert.match(readFileSync(new URL('../public/game/committee.js', import.meta.url), 'utf8'), /fileAt\('committee\.glb'\)/);
});

test('each file fetched once, six at a time, progress after each; stopping fetches no more; a failure is passed over', async () => {
  const asked = [], said = [];
  let open = 0, most = 0;
  globalThis.fetch = async (u) => {
    asked.push(String(u));
    if (u === '/play') return { text: async () => PLAY };
    open++; most = Math.max(most, open);
    for (let i = 0; i < 3; i++) await Promise.resolve(); // (a few ticks, not the fake clock's setTimeout)
    open--;
    if (String(u).endsWith('committee.glb')) throw new Error('offline');
    return { arrayBuffer: async () => new ArrayBuffer(4) };
  };
  await preloadRace('phuket', 'j70', (x) => said.push(x));
  const files = raceFiles(PLAY, 'phuket', 'j70');
  assert.deepEqual(asked, ['/play', ...files]);
  assert.equal(most, 6);
  assert.equal(said[0], 0); assert.equal(said.at(-1), 1); assert.equal(said.length, files.length + 1);
  assert.ok(said.every((x, i) => i === 0 || x > said[i - 1]), 'only ever forward');

  asked.length = 0; said.length = 0;
  const ac = new AbortController();
  await preloadRace('phuket', 'j70', (x) => { said.push(x); if (said.length === 3) ac.abort(); }, ac.signal);
  assert.ok(asked.length < files.length / 2, `${asked.length} asked after stopping`);
  globalThis.fetch = async () => { throw new Error('offline'); };
  said.length = 0;
  await preloadRace('phuket', 'j70', (x) => said.push(x));
  assert.deepEqual(said, [], '/play itself not there: nothing');
});

const SETTINGS = { venue: 'phuket', yacht: 'j70', preset: 'medium', length: 'short', course: 'wl', laps: 1, start: 1, current: 0, daytime: 'any' };
const pair = parseSeek({ status: 'found', pair: { id: '0b8f1c2e-1111-4222-8333-944455556666', code: 'K7M2QZ', role: 'host', settings: SETTINGS, them: { name: 'Anna K.', rating: 1585, races: 40 }, me: { rating: 1540, races: 41, ok: null }, them_ok: null, left: 8, minutes: 6 } }).pair;
const n = () => {};
const card = (o) => plain(renderToStaticMarkup(DuelFinderView({ lang: 'en', signed: true, phase: 'found', look: { waited: 0, band: 100, online: 1 }, pair, said: false, left: 8, note: '', longWait: false, find: n, stop: n, ready: n, decline: n, ...o })));

test('Match found says how far the race has loaded, then that it opens at once', () => {
  assert.match(card({ loaded: 0.46 }), /Phuket · J\/70 · medium breeze · .* Loading Phuket · 46% Your chance/);
  assert.match(card({ loaded: 1 }), /Phuket is loaded: the race opens at once/);
  assert.doesNotMatch(card({ loaded: null }), /Loading|loaded/);
  assert.match(card({ loaded: 0.5, lang: 'ru' }), /Загружается Пхукет · 50%/);
});
