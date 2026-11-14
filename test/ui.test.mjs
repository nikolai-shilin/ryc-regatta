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
  // the files are served as they are: the proxy (which sends pages to their language) leaves /ui/ alone, as /game/
  assert.match(read('proxy.ts'), /matcher: \['\/\(\(\?!.*\bui\/\|/);
  assert.match(play, /<link rel="stylesheet" href="\/ui\/game\.css">/);
  // the race's overlays opt in: loading, the pause, the card before you leave
  for (const id of ['loading', 'pauseCard', 'confirmCard']) assert.match(play, new RegExp(`<div (id="${id}" class="[^"]*\\bbc\\b|class="[^"]*\\bbc\\b[^"]*" id="${id}")`), id);
});

test('the broadcast HUD has every word in both languages, and the game uses it', async () => {
  // the HUD imports sim.js, whose land.js fetches the bay's files: answered from the disk, as in sim.test.mjs
  const { readFile } = await import('node:fs/promises');
  globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u))));
  const { HUD_STRINGS: S } = await import('../public/game/hud-bc.js');
  const keys = (o) => Object.keys(o).sort();
  assert.deepEqual(keys(S.ru), keys(S.en));
  for (const [k, v] of Object.entries(S.en)) if (v && typeof v === 'object') assert.deepEqual(keys(S.ru[k]), keys(v), k); // the course shapes, the legs, the cameras
  for (const [k, v] of Object.entries(S.ru)) if (typeof v === 'function') assert.match(v(1, 4), /1/, k);
  const main = read('public/game/main.js'), play = read('public/play/index.html');
  assert.match(main, /import \{ createHud \} from '\.\/hud-bc\.js'/);
  assert.match(play, /\['\/game\/hud-bc\.js', \d+\]/); // the loader counts it in
  assert.doesNotMatch(main + play, /hud-next/);
});

test('the layline call: when the mark opens up on the other tack', async () => {
  const { laylineAt } = await import('../public/game/hud-bc.js');
  // the wind from the north, a 45° beat, the mark 500 m straight upwind; on starboard (heading 45° left of the wind)
  // at 3 m/s she reaches the port layline at (−250, −250), 354 m on: 118 s
  const r = Math.PI / 180, base = { mx: 0, mz: -500, W: 0, beat: 45 * r, v: 3 };
  assert.deepEqual(laylineAt({ ...base, x: 0, z: 0, h: -45 * r }), { kind: 'in', s: 118 });
  assert.deepEqual(laylineAt({ ...base, x: -250, z: -250, h: -45 * r }), { kind: 'now' }); // on it: tack
  assert.deepEqual(laylineAt({ ...base, x: -350, z: -250, h: -45 * r }), { kind: 'over' }); // 54° wide: past it
  assert.deepEqual(laylineAt({ ...base, x: -250, z: -250, h: 45 * r }), { kind: 'fetch' }); // tacked: laying the mark
  assert.deepEqual(laylineAt({ ...base, x: 250, z: 0, h: 45 * r }), { kind: 'in', s: 59 }); // the same on port, mirrored
  assert.equal(laylineAt({ ...base, x: 0, z: 0, h: 180 * r }), null); // running: no layline to call
  assert.equal(laylineAt({ ...base, mz: -5000, x: 0, z: 0, h: -45 * r }), null); // more than three minutes off
});

test('the call before the start: hold, bear away now, or late, from the time to burn', async () => {
  const { burnCall } = await import('../public/game/hud-bc.js');
  assert.deepEqual(burnCall(23, 40), { kind: 'hold', s: 23 }); // 23 s in hand, 40 s to go: hold 0:23, then bear away
  assert.equal(burnCall(23, 75), null); // the gun more than a minute off: no call yet
  assert.equal(burnCall(23, 0), null); // and none after it
  assert.equal(burnCall(null, 40), null); // not closing on the line: nothing to time
  assert.deepEqual(burnCall(2, 30), { kind: 'now' });
  assert.deepEqual(burnCall(-2.5, 30), { kind: 'now' });
  assert.deepEqual(burnCall(-8, 30), { kind: 'late' });
  // between the bands it keeps the call it had, so a second either way doesn't flick it back and forth
  assert.deepEqual(burnCall(4, 30, { kind: 'now' }), { kind: 'now' });
  assert.deepEqual(burnCall(4, 30, { kind: 'hold', s: 6 }), { kind: 'hold', s: 4 });
  assert.deepEqual(burnCall(4, 30), { kind: 'hold', s: 4 });
  assert.deepEqual(burnCall(-3.5, 30, { kind: 'now' }), { kind: 'now' });
  assert.deepEqual(burnCall(-3.5, 30, { kind: 'late' }), { kind: 'late' });
});

test('the line is square to the wind from its square bearing; veer and back against the first reading', async () => {
  const { squareBearing, veerBack } = await import('../public/game/hud-bc.js');
  const { makeCourse, D2R } = await import('../public/game/sim.js');
  for (const bias of [-8, -3, 0, 5, 8]) {
    const c = makeCourse(1, 260, bias * D2R, 6), sq = squareBearing(c);
    assert.equal(sq, (bias + 360) % 360, `bias ${bias}°`);
    // the HUD's line bias with the wind from there: neither end further upwind
    const W = sq * D2R, fav = (c.pin.x - c.committee.x) * Math.sin(W) + (c.pin.z - c.committee.z) * -Math.cos(W);
    assert.ok(Math.abs(fav) < 1e-6, `fav ${fav}`);
  }
  assert.equal(veerBack(5 * D2R, 2 * D2R), 3); // clockwise: veered
  assert.equal(veerBack(358 * D2R, 2 * D2R), -4); // anticlockwise through north: backed
  assert.equal(veerBack(1 * D2R, 357 * D2R), 4);
});

test('the split at a mark: the boats round in order, then the rest nearest the mark first, with no time guessed', async () => {
  const { markSplit } = await import('../public/game/hud-bc.js');
  const rows = markSplit([
    { b: 'C', due: true, d: 140 }, { b: 'A', t: 462 }, { b: 'E', due: true, d: null }, { b: 'B', t: 471 }, { b: 'D', due: true, d: 60 },
  ]);
  assert.deepEqual(rows.map((r) => r.b), ['A', 'B', 'D', 'C', 'E']);
  assert.deepEqual(rows.map((r) => r.gap), [0, 9, null, null, null]);
  assert.deepEqual(markSplit([{ b: 'A', due: true, d: 80 }]).map((r) => r.gap), [null]); // nobody round yet: no gaps
});

// a selector list split at its own commas, not those inside :is(…) or :not(…)
function topLevel(list) {
  const out = []; let depth = 0, cur = '';
  for (const ch of list) {
    if (ch === '(') depth++; else if (ch === ')') depth--;
    if (ch === ',' && !depth) { out.push(cur); cur = ''; } else cur += ch;
  }
  return [...out, cur];
}

test('the pages laid out as the pause screen are in the broadcast look', () => {
  assert.match(read('app/[lang]/layout.tsx'), /import '@\/public\/ui\/tokens\.css';\nimport '@\/styles\/broadcast\.css';/); // the layer after the tokens
  for (const f of ['app/[lang]/race/page.tsx', 'app/[lang]/boat/page.tsx', 'components/free-setup.tsx', 'components/result-view.tsx']) {
    const roots = read(f).match(/className="scr bt-scr[^"]*"/g) || [];
    assert.ok(roots.length, f);
    for (const r of roots) assert.match(r, /\bbc\b/, `${f}: ${r}`);
  }
  // the home is in it too, and its header's Play now and name stay hidden on the pages not yet moved over
  assert.match(read('app/[lang]/page.tsx'), /className="scr help home bc"/);
  // and the reading pages
  for (const f of ['help', 'faq', 'learn', 'iyt', 'learn/[slug]', 'learn/glossary']) assert.match(read(`app/[lang]/${f}/page.tsx`), /className="scr help hp[^"]*\bbc"/, f);
  assert.match(read('styles/ryc.css'), /\.hm-brand-t, \.hm-play \{ display: none; \}/);
  // the layer reaches only the pages that opt in: every selector starts at .bc
  const layer = read('styles/broadcast.css').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@[^{]+\{/g, '');
  for (const m of layer.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    for (const part of topLevel(m[1])) assert.match(part.trim(), /^\.bc\b|^\.bt-scr\.bc\b/, part.trim());
  }
});

test('the course map: its colours are the tokens, and the boats\' labels never cover each other', async () => {
  const { mapPalette, placeLabels, MAP_TOKENS } = await import('../public/game/course-map.js');
  // read from the page, or the tokens' own values when it gives none
  for (const [k, [v, fall]] of Object.entries(MAP_TOKENS)) if (tokens[v] && !tokens[v].includes('var(')) assert.equal(tokens[v], fall, k);
  assert.equal(mapPalette().you, '#3db8ff');
  assert.equal(mapPalette((v) => (v === '--gold' ? ' #abcdef ' : '')).gold, '#abcdef');
  // a label goes right of its dot, else left; one with room nowhere is left out
  const size = 240, it = (x, y, w = 30) => ({ x, y, w, h: 12 });
  assert.deepEqual(placeLabels([it(100, 100)], { size, dots: [{ x: 100, y: 100 }] })[0], { x: 109, y: 94, w: 30, h: 12 }); // right of its dot
  // three in a row: the first's right side would cover the third's boat, so it goes left; the third has no room
  const dots = [{ x: 60, y: 100 }, { x: 130, y: 100 }, { x: 95, y: 100 }];
  const [a, b, c] = placeLabels(dots.map((d) => it(d.x, d.y)), { size, dots });
  assert.deepEqual([a.x, b.x, c], [60 - 9 - 30, 139, null]);
  assert.equal(placeLabels([it(235, 50)], { size })[0].x, 235 - 9 - 30); // at the edge: to the left
  assert.equal(placeLabels([it(50, 50)], { size, blocked: [{ x: 55, y: 40, w: 40, h: 20 }] })[0].x, 50 - 9 - 30); // clear of the caption and arrows
  // the pause card's and the leave dialog's new words are in both languages
  const main = read('public/game/main.js');
  for (const k of ['nextAt', 'howPort', 'howGate', 'howFinish', 'howStart', 'whereH', 'toK', 'mapYou', 'mapStart']) assert.equal(main.match(new RegExp(`\\b${k}: `, 'g'))?.length, 2, k);
  assert.match(read('public/play/index.html'), /<p class="p-line p-how" id="pHow"><\/p>/);
});
