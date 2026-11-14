// The broadcast design system's one source, public/ui/tokens.css: the site imports it (app/[lang]/layout.tsx) and the
// game links it (public/play/index.html), so a value changed there changes both. npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const css = read('public/ui/tokens.css');
const tokens = Object.fromEntries([...css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
// a fluid size, clamp(min, …, max), is on the scale by its largest value: the size the designs are drawn at
const px = (v) => Number((/clamp\([^,]+,[^,]+,\s*([\d.]+)px\)/.exec(v) || /^([\d.]+)px$/.exec(v) || [])[1]);

test('the type scale, the 4px grid and the control heights are the designed ones', () => {
  const type = { label: 12, small: 14, body: 16, lead: 18, row: 20, title: 24, h3: 32, h2: 44, h1: 72, display: 104, hero: 132 };
  for (const [k, v] of Object.entries(type)) assert.equal(px(tokens[`--fs-${k}`]), v, `--fs-${k}`);
  for (const n of [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20]) assert.equal(px(tokens[`--s-${n}`]), n * 4, `--s-${n}`);
  assert.deepEqual(['s', 'm', 'l', 'xl'].map((k) => px(tokens[`--h-${k}`])), [32, 44, 56, 72]);
  // the fluid headline sizes never go below the next step down
  for (const [k, min] of [['h2', 32], ['h1', 44], ['display', 72], ['hero', 72]]) {
    const lo = Number(/clamp\(([\d.]+)px/.exec(tokens[`--fs-${k}`])?.[1] ?? px(tokens[`--fs-${k}`]));
    assert.ok(lo >= min, `--fs-${k} starts at ${lo}px`);
  }
});

test('one colour per meaning, and white in eleven strengths', () => {
  assert.deepEqual(
    ['--you', '--gold', '--up', '--down', '--live', '--buoy', '--ground', '--surface', '--ink-on'].map((k) => tokens[k]),
    ['#3db8ff', '#f5c400', '#2ee6a0', '#ff8a3d', '#ff3b30', '#ff7a1a', '#070d16', '#0b1420', '#04121e'],
  );
  const whites = Object.keys(tokens).filter((k) => /^--w-\d\d$/.test(k));
  assert.equal(whites.length, 11);
  for (const k of whites) assert.equal(tokens[k], `rgba(255, 255, 255, ${Number(k.slice(4)) / 100})`, k);
});

test('the tokens are scoped to .bc, so pages not yet moved over keep their look', () => {
  assert.doesNotMatch(css, /(^|\n)\s*:root\s*\{/);
  assert.match(css, /(^|\n)\.bc\s*\{/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('the site and the game load the tokens and both Sofia Sans faces with Cyrillic', () => {
  const layout = read('app/[lang]/layout.tsx');
  assert.match(layout, /import '@\/public\/ui\/tokens\.css'/);
  for (const f of ['Sofia_Sans', 'Sofia_Sans_Condensed']) assert.match(layout, new RegExp(`${f}\\(\\{ subsets: \\[[^\\]]*'cyrillic'`), f);
  assert.match(css, /--cond: var\(--f-sofia-c, 'Sofia Sans Condensed'\)/);
  assert.match(css, /--sans: var\(--f-sofia, 'Sofia Sans'\)/);
  const play = read('public/play/index.html');
  assert.match(play, /<link rel="stylesheet" href="\/ui\/tokens\.css">/);
  assert.match(play, /family=Sofia\+Sans\+Condensed:wght@[\d.;]+&amp;family=Sofia\+Sans:wght@[\d.;]+/);
});

test('the broadcast HUD has every word in both languages, and the game uses it', async () => {
  // the HUD imports sim.js, whose land.js fetches the bay's files: answered from the disk, as in sim.test.mjs
  const { readFile } = await import('node:fs/promises');
  globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u))));
  const { HUD_STRINGS: S } = await import('../public/game/hud-bc.js');
  const keys = (o) => Object.keys(o).sort();
  assert.deepEqual(keys(S.ru), keys(S.en));
  assert.deepEqual(keys(S.ru.shape), keys(S.en.shape));
  for (const [k, v] of Object.entries(S.ru)) if (typeof v === 'function') assert.match(v(1, 4), /1/, k);
  const main = read('public/game/main.js'), play = read('public/play/index.html');
  assert.match(main, /import \{ createHud \} from '\.\/hud-bc\.js'/);
  assert.match(play, /\['\/game\/hud-bc\.js', \d+\]/); // the loader counts it in
  assert.doesNotMatch(main + play, /hud-next/);
});

test('the pages laid out as the pause screen are in the broadcast look', () => {
  assert.match(read('app/[lang]/layout.tsx'), /import '@\/public\/ui\/tokens\.css';\nimport '@\/styles\/broadcast\.css';/); // the layer after the tokens
  for (const f of ['app/[lang]/race/page.tsx', 'app/[lang]/boat/page.tsx', 'components/free-setup.tsx', 'components/result-view.tsx']) {
    const roots = read(f).match(/className="scr bt-scr[^"]*"/g) || [];
    assert.ok(roots.length, f);
    for (const r of roots) assert.match(r, /\bbc\b/, `${f}: ${r}`);
  }
  // the home is in it too, and its header's Play now and name stay hidden on the pages not yet moved over
  assert.match(read('app/[lang]/page.tsx'), /className="scr help home bc"/);
  assert.match(read('styles/ryc.css'), /\.hm-brand-t, \.hm-play \{ display: none; \}/);
  // the layer reaches only the pages that opt in: every selector starts at .bc
  const layer = read('styles/broadcast.css').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@[^{]+\{/g, '');
  for (const m of layer.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    for (const part of m[1].split(/,(?![^(]*\))/)) assert.match(part.trim(), /^\.bc\b|^\.bt-scr\.bc\b/, part.trim());
  }
});
