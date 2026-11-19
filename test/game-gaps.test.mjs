// The corners of the game's modules that the other tests don't reach: the sponsor's answer, the sky of each race, land
// files old and spoiled, the ground's height, the music at the gun and the finish, a join refused, two boats' rows eased
// between, the sets in the waves, a headsail change, a death roll, a river's stream, a hail, a name typed in the waiting room, and the
// build's stamping script as it is run.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import './load.mjs';
import { memoryRealtime } from './hub.mjs';

const def = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
const near = (a, b, e = 1e-9, msg) => assert.ok(Math.abs(a - b) <= e, msg ?? `${a} is not within ${e} of ${b}`);

let answerSponsor = null;
const asked = [];
def('location', { search: '', pathname: '/' });
const saved = new Map([['regatta.hour', '12.00']]);
let refuseStorage = false;
def('localStorage', { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => { if (refuseStorage) throw new Error('full'); saved.set(k, String(v)); } });
def('fetch', async (u) => {
  const s = String(u);
  if (s === '/sponsor') { asked.push(s); return answerSponsor(); }
  if (s.endsWith('.mp3')) return { arrayBuffer: async () => new ArrayBuffer(8) };
  return new Response(await readFile(new URL(s))); // land.js's bay files, from the disk
});

const { pickSky, skyAt, skyUniforms, HOURS, DAYTIMES } = await import('../public/game/light.js');
const { VENUE } = await import('../public/game/venues.js');
const { groundAt, MESH, TREE, SKOPEA } = await import('../public/game/land.js');
const { createMusic } = await import('../public/game/music.js');
const { realtime } = await import('../public/game/net.js');
const { lerpBoat, readBoat } = await import('../public/game/wire.js');
const { Boat, Race, makeWaves, waveGroup, waveHeight, seaSlope, HULL } = await import('../public/game/sim.js');
const { CLS } = await import('../public/game/classes.js');
const { Room, makeLink } = await import('../public/game/match.js');

const realRandom = Math.random;
// these numbers first, then the same "random" ones every run
function randoms(...first) {
  let s = 99;
  Math.random = () => { if (first.length) return first.shift(); s = (s * 16807) % 2147483647; return s / 2147483647; };
}
const restore = () => { Math.random = realRandom; };

// ---------- the sponsor ----------
let sponsors = 0;
const freshSponsor = () => import(`../public/game/sponsor.js?case=${++sponsors}`);

test("the sponsor's words are asked for once a page, however many ask", async () => {
  const { sponsor } = await freshSponsor();
  const words = { jib: 'https://x.example/a.png', main: null, banner: ['Hello'] };
  asked.length = 0;
  answerSponsor = () => ({ ok: true, json: async () => words });
  const first = sponsor(), second = sponsor();
  assert.equal(first, second);
  assert.deepEqual(await first, words);
  await sponsor();
  assert.deepEqual(asked, ['/sponsor']);
});

test('no sponsor on the server: the game keeps its own defaults', async () => {
  const { sponsor } = await freshSponsor();
  answerSponsor = () => ({ ok: false, json: async () => { throw new Error('not json'); } });
  assert.equal(await sponsor(), null);
});

test('no answer from the server: the game keeps its own defaults', async () => {
  const { sponsor } = await freshSponsor();
  answerSponsor = () => { throw new Error('offline'); };
  assert.equal(await sponsor(), null);
});

// ---------- the sky of a race ----------
const CLOCK = VENUE.tz - VENUE.lon / 15;

test('the first race of a visit is two hours from the last one of the visit before', () => {
  randoms();
  const { hour } = pickSky(null);
  restore();
  assert.ok(Math.abs(hour - 12) >= 2, `${hour}`);
});

test('each race has a new hour of the racing day, at least two hours from the last, and remembers it', () => {
  randoms();
  let last = pickSky(null).hour;
  for (let i = 0; i < 200; i++) {
    const { hour } = pickSky({ settings: { daily: '2026-11-18', daytime: 'morning' } });
    assert.ok(hour >= HOURS[0] && hour <= HOURS[1], `${hour}`);
    assert.ok(Math.abs(hour - last) >= 2, `${last} then ${hour}`);
    assert.equal(saved.get('regatta.hour'), hour.toFixed(2));
    last = hour;
  }
  restore();
});

test('about one race in seven is overcast', () => {
  pickSky({ settings: { daytime: 'midday' } }); // (the last hour known: the first of the day is far from it)
  randoms(0, 0.139);
  assert.equal(pickSky(null).overcast, true);
  pickSky({ settings: { daytime: 'midday' } });
  randoms(0, 0.14);
  assert.equal(pickSky(null).overcast, false);
  restore();
});

test('the sky is the light of its own hour', () => {
  pickSky({ settings: { daytime: 'midday' } });
  randoms(0, 0.9);
  const s = pickSky(null);
  restore();
  assert.equal(s.hour, HOURS[0]);
  assert.equal(s.elevation, skyAt(HOURS[0], false).elevation);
});

for (const [daytime, hour] of Object.entries(DAYTIMES)) {
  test(`a custom race set to the ${daytime} is sailed at that hour under a clear sky`, () => {
    randoms(0.5, 0); // the dice said overcast
    const s = pickSky({ settings: { daytime } });
    restore();
    assert.deepEqual([s.hour, s.overcast], [hour, false]);
  });
}

test('a custom race at any time of day has the hour the dice give it', () => {
  pickSky({ settings: { daytime: 'midday' } });
  randoms(0, 0.9);
  const s = pickSky({ settings: { daytime: 'any' } });
  restore();
  assert.equal(s.hour, HOURS[0]);
});

test("today's race keeps its own hour whatever the set-up says", () => {
  pickSky({ settings: { daytime: 'midday' } });
  randoms(0, 0.9);
  const s = pickSky({ settings: { daily: '2026-11-18', daytime: 'sunset' } });
  restore();
  assert.equal(s.hour, HOURS[0]);
});

test('a day with a sea breeze is sunny, from the late morning to the late afternoon', () => {
  randoms();
  for (let i = 0; i < 100; i++) {
    const s = pickSky({ wind: { sea: {} } });
    assert.ok(s.hour >= 11 + CLOCK - 1e-9 && s.hour <= 16 + CLOCK + 1e-9, `${s.hour}`);
    assert.equal(s.overcast, false);
  }
  restore();
});

const addressed = (search, race = null) => {
  def('location', { search, pathname: '/' });
  randoms(0.5, 0.9);
  try { return pickSky(race); } finally { restore(); def('location', { search: '', pathname: '/' }); }
};

for (const [search, hour, overcast] of [['?light=day', 14.5, false], ['?light=morning', 9.5, false], ['?light=golden', 19, false], ['?light=overcast', 14, true]]) {
  test(`the old address ${search} still works`, () => {
    const s = addressed(search);
    assert.deepEqual([s.hour, s.overcast], [hour, overcast]);
  });
}

test('?hour= in the address wins, kept within the racing day', () => {
  assert.equal(addressed('?hour=13.25').hour, 13.25);
  assert.equal(addressed('?hour=0').hour, HOURS[0]);
  assert.equal(addressed('?hour=23.5').hour, HOURS[1]);
  assert.equal(addressed('?light=golden&hour=10').hour, 10);
});

for (const search of ['?hour=24', '?hour=-1', '?hour=soon']) {
  test(`${search} in the address is no hour at all`, () => {
    const { hour } = addressed(search);
    assert.ok(hour >= HOURS[0] && hour <= HOURS[1]);
    assert.notEqual(hour, 24);
  });
}

test('?sky= in the address decides the cloud', () => {
  assert.equal(addressed('?sky=overcast').overcast, true);
  pickSky({ settings: { daytime: 'midday' } });
  def('location', { search: '?sky=clear', pathname: '/' });
  randoms(0, 0.01); // the dice said overcast
  const s = pickSky(null);
  restore();
  def('location', { search: '', pathname: '/' });
  assert.equal(s.overcast, false);
});

test('?sky= overrules a custom race set to a clear time of day', () => {
  const s = addressed('?sky=overcast', { settings: { daytime: 'midday' } });
  assert.deepEqual([s.hour, s.overcast], [DAYTIMES.midday, true]);
});

test('a page with no address, or a browser that keeps nothing, still has a sky', () => {
  def('location', undefined);
  refuseStorage = true;
  randoms();
  try { assert.ok(Number.isFinite(pickSky(null).hour)); } finally { restore(); refuseStorage = false; def('location', { search: '', pathname: '/' }); }
});

test('the sky dome, the environment and the water share one set of uniforms, new each time it is asked for', () => {
  const u = skyUniforms(), v = skyUniforms();
  assert.deepEqual(Object.keys(u).sort(), ['uCloud', 'uCloudDark', 'uCloudLit', 'uFoamCol', 'uHorizon', 'uMie', 'uSkyAt', 'uSun', 'uSunCol', 'uTop']);
  assert.notEqual(u.uTop.value, v.uTop.value);
  assert.deepEqual([u.uSun.value.x, u.uSun.value.y, u.uSun.value.z], [0, 1, 0]);
  assert.deepEqual([u.uMie.value, u.uCloud.value], [0.1, 0]);
  assert.deepEqual([u.uFoamCol.value.r, u.uFoamCol.value.g, u.uFoamCol.value.b], [1, 1, 1]);
});

// ---------- land files, each read by a page of its own ----------
const LAND = new URL('../public/game/land.js', import.meta.url).href;
const CHILD = `
const fix = JSON.parse(process.env.LAND_FIXTURE);
const seen = [], warned = [];
const { readFile } = await import('node:fs/promises');
globalThis.location = { search: fix.search || '', pathname: '/' };
console.warn = (m) => warned.push(m);
globalThis.fetch = async (u) => {
  const name = String(u).split('/game/')[1];
  seen.push(name);
  const f = fix.files?.[name];
  if (f) return new Response(f.json ? JSON.stringify(f.json) : Buffer.from(f.bin, 'base64'));
  return new Response(await readFile(new URL(String(u))));
};
const land = await import(fix.land);
process.stdout.write(JSON.stringify({ seen, warned, venue: land.VENUE.id, origin: land.SKOPEA.meta.origin, far: land.SKOPEA.parts.far ? [...land.SKOPEA.parts.far] : null,
  room: land.roomAt(0, 0), ground: (fix.probe || []).map(([x, z]) => land.groundAt(x, z)) }));
`;
function page(fixture) {
  const env = { ...process.env, LAND_FIXTURE: JSON.stringify({ land: LAND, ...fixture }) };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', CHILD], { env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

// a small venue of its own: 200 m across, three of its four quarters drawn, the ground rising 10 m each 100 m eastward
const N = 7;
function smallLand(far) {
  const buf = new ArrayBuffer(36 + far.length * 2);
  new Int8Array(buf, 0, 9).fill(10); // 40 m of room everywhere
  new Uint8Array(buf, 12, 1)[0] = 0b10000000; // the root split in four
  new Uint8Array(buf, 16, 1)[0] = 0b11100000; // all but the last drawn
  new Int16Array(buf, 20, 8).set([100, 200, 300, 100, 200, 300, 100, 200]);
  new Int16Array(buf, 36, far.length).set(far);
  const meta = { origin: [1, 2], home: [0, 0], mid: [0, 0], landmarks: [], terrain: { ext: 100, n: 2 }, room: { x0: -40, z0: -40, cell: 40, nx: 3, nz: 3 }, far: { n: N, k: 2 },
    parts: [{ n: 'room', t: 'i8', len: 9 }, { n: 'tree', t: 'bits', len: 5 }, { n: 'drawn', t: 'bits', len: 4 }, { n: 'heights', t: 'i16', len: 8 }, { n: 'far', t: 'i16', len: far.length }] };
  return { 'skopea.json': { json: meta }, 'skopea.bin': { bin: Buffer.from(buf).toString('base64') } };
}
const flat = (cells = {}) => { const a = new Array(N * N).fill(10); for (const [k, v] of Object.entries(cells)) { const [i, j] = k.split(','); a[+i * N + +j] = v; } return a; };
const at = (far, i, j) => far[i * N + j];

test("a venue not baked in the new format yet is sailed in Göcek's land, and says so", () => {
  const r = page({ search: '?venue=palma', files: { 'venues/palma.json': { json: { old: true } }, 'venues/palma.bin': { bin: 'AAAA' } } });
  assert.deepEqual(r.seen, ['venues/palma.json', 'venues/palma.bin', 'skopea.json', 'skopea.bin']);
  assert.equal(r.venue, 'palma', 'under its own name');
  assert.deepEqual(r.origin, SKOPEA.meta.origin);
  assert.equal(r.warned.length, 1);
  assert.match(r.warned[0], /^palma: its land isn't baked/);
});

test('a land file that the host has already unpacked is read as it is', () => {
  const r = page({ files: smallLand(flat()) });
  assert.deepEqual(r.origin, [1, 2]);
  assert.equal(r.room, 40);
  assert.deepEqual(r.warned, []);
});

test('a junk pixel standing up out of the far land is brought down to its neighbours', () => {
  const { far } = page({ files: smallLand(flat({ '1,1': 500 })) });
  assert.equal(at(far, 1, 1), 10);
});

test('a real hill in the far land is left standing', () => {
  const hill = flat({ '3,3': 300, '2,2': 200, '2,3': 200, '2,4': 200, '3,2': 200, '3,4': 200, '4,2': 200, '4,3': 200, '4,4': 200 });
  assert.deepEqual(page({ files: smallLand(hill) }).far, hill);
});

test('a hole in the far land is not filled', () => {
  const pit = flat({ '3,3': -500 });
  assert.deepEqual(page({ files: smallLand(pit) }).far, pit);
});

test('a needle of two cells in the far land goes too', () => {
  const { far } = page({ files: smallLand(flat({ '3,3': 900, '3,4': 400 })) });
  assert.deepEqual([at(far, 3, 3), at(far, 3, 4)], [10, 10]);
});

// ---------- the ground's height ----------
test('the ground is at its height on each part of a small venue, and under the sea where nothing is drawn', () => {
  const probe = [[-100, -100], [0, -100], [100, -100], [-50, -50], [50, -25], [-25, 50], [50, 50], [100, 100], [101, 0], [0, -101], [-101, 0], [0, 101]];
  const { ground } = page({ files: smallLand(flat()), probe });
  [10, 20, 30, 15, 25, 17.5].forEach((h, i) => near(ground[i], h, 1e-9, `at ${probe[i]}: ${ground[i]}`));
  assert.deepEqual(ground.slice(6, 8), [-10, -10], 'the quarter not drawn');
  assert.deepEqual(ground.slice(8), [-20, -20, -20, -20], 'off the map');
});

test('in the real bay, the middle of any triangle of the land is at the mean height of its corners', () => {
  const { pos, idx } = MESH, step = Math.max(1, Math.floor(idx.length / 3 / 800));
  let checked = 0;
  for (let t = 0; t < idx.length / 3; t += step) {
    const c = [0, 1, 2].map((k) => idx[t * 3 + k] * 3);
    const [x, y, z] = [0, 1, 2].map((o) => (pos[c[0] + o] + pos[c[1] + o] + pos[c[2] + o]) / 3);
    near(groundAt(x, z), y, 1e-3, `triangle ${t}`);
    checked++;
  }
  assert.ok(checked >= 500);
});

test('in the real bay, a part of the map with nothing drawn is under the sea', () => {
  const { D, L, I, J } = TREE, { n, ext } = SKOPEA.meta.terrain, cell = (2 * ext) / n;
  const k = D.indexOf(0), s = n >> L[k];
  assert.equal(groundAt(-ext + (J[k] + 0.5) * s * cell, -ext + (I[k] + 0.5) * s * cell), -10);
});

test('in the real bay, beyond the map there is nothing', () => {
  const { ext } = SKOPEA.meta.terrain;
  assert.equal(groundAt(ext + 1, 0), -20);
  assert.equal(groundAt(0, -ext - 1), -20);
});

// ---------- the music at the big moments ----------
const trackList = () => {
  const src = readFileSync(new URL('../public/game/music.js', import.meta.url), 'utf8');
  return Function(`return (${src.slice(src.indexOf('const TRACKS = '), src.indexOf('};\nconst ONE_SHOT')).replace('const TRACKS = ', '')}})`)();
};
const T = trackList().racing;
const barAt = (name, k) => T[name][0] + T[name][1].slice(0, k).reduce((a, b) => a + b, 0);
async function player({ style = 'racing' } = {}) {
  const clips = [], targets = [];
  const param = (value = 1) => ({ value, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime(v) { targets.push(v); } });
  const node = (more = {}) => ({ connect: (d) => d, disconnect() {}, gain: param(), frequency: param(), Q: param(), threshold: param(), ratio: param(), ...more });
  const ctx = {
    currentTime: 0, sampleRate: 44100, createGain: () => node(), createBiquadFilter: () => node(), createDynamicsCompressor: () => node(),
    createBufferSource() {
      const c = { stopAt: Infinity };
      return node({ playbackRate: param(), start(when, off, dur) { Object.assign(c, { when: Math.max(when, ctx.currentTime), off, dur }); clips.push(c); }, stop(t = ctx.currentTime) { c.stopAt = t; } });
    },
    decodeAudioData(b, ok) { ok({ sampleRate: 44100, getChannelData() { const d = new Float32Array(44100); d[8820] = 1; return d; } }); },
  };
  const m = createMusic(ctx, node());
  m.setStyle(style);
  await new Promise((r) => setImmediate(r));
  const run = (until) => { while (ctx.currentTime < until) { ctx.currentTime += 1 / 60; m.update(); } };
  return { m, ctx, clips, targets, run };
}
const isBar = (c, name, k) => Math.abs(c.off + 0.015 - barAt(name, k)) < 0.002;
const heard = (clips, name, k, from) => clips.find((c) => c.when >= from && isBar(c, name, k));

test('the race lost at the finish: the tape stops into the dark piece and the sound closes in', async () => {
  const { m, ctx, clips, targets, run } = await player();
  run(10);
  const t = ctx.currentTime;
  targets.length = 0;
  m.sting('lose');
  assert.equal(m.state.mood, 'lose');
  assert.equal(m.state.pend, null);
  assert.ok(targets.includes(700), 'the lowpass closes');
  run(14);
  const dark = heard(clips, 'dark', 0, t);
  assert.ok(dark && dark.when - t < 0.7, `the dark piece ${dark ? (dark.when - t).toFixed(2) : 'never'} s after`);
});

test('a fresh race takes the music back to the quiet of the pre-start', async () => {
  const { m, ctx, clips, targets, run } = await player();
  m.set({ int: 0.9, ten: 0.9, mood: 'tense' });
  run(10);
  m.sting('lose');
  run(12);
  const t = ctx.currentTime;
  targets.length = 0;
  m.reset();
  assert.deepEqual([m.state.mood, m.state.pend], ['calm', null]);
  assert.deepEqual([m.state.int, m.state.ten], [0.2, 0.25]);
  assert.ok(targets.includes(20000), 'the lowpass opens');
  run(t + 1);
  const calm = heard(clips, 'calm', 0, t);
  assert.ok(calm && calm.when - t < 0.2, 'from the first bar of the calm');
});

test('a fresh race with no music chosen only sets the dials', () => {
  const param = () => ({ value: 1, setTargetAtTime() {} }), node = () => ({ connect: (d) => d, gain: param(), threshold: param(), ratio: param() });
  const m = createMusic({ currentTime: 0, createGain: node, createDynamicsCompressor: node }, node());
  assert.doesNotThrow(() => m.reset());
  assert.deepEqual([m.state.int, m.state.ten, m.state.mood], [0.2, 0.25, 'calm']);
});

test("the build's drop lands on the gun", async () => {
  const { m, ctx, clips, run } = await player();
  run(5);
  const gun = ctx.currentTime + 8, drop = T.build[1].length - 4;
  m.riser(8);
  run(gun + 1);
  const bar = heard(clips, 'build', drop, 0);
  assert.ok(bar, 'the drop was queued');
  near(bar.when + 0.015, gun, 0.03, `the drop at ${bar.when + 0.015}, the gun at ${gun}`);
});

test('a riser longer than the whole build starts from its first bar', async () => {
  const { m, ctx, clips, run } = await player();
  run(5);
  const t = ctx.currentTime, all = T.build[1].slice(0, -4).reduce((a, b) => a + b, 0);
  m.riser(60);
  run(t + 60 - all + 1);
  const first = heard(clips, 'build', 0, t);
  assert.ok(first);
  near(first.when + 0.015, t + 60 - all, 0.03);
});

test('at the gun the build goes on into the race by itself', async () => {
  const { m, ctx, clips, run } = await player();
  run(5);
  m.riser(8);
  run(ctx.currentTime + 8);
  const t = ctx.currentTime;
  m.sting('gun');
  run(t + 0.5);
  assert.equal(heard(clips, 'race', 0, t), undefined, 'the race piece is not cut in from its top');
  assert.equal(m.state.mood, 'up');
});

for (const [name, dur] of [['under a second', 0.9], ['too short for a bar of the build', 1.2]]) {
  test(`a riser ${name} is no riser: the gun brings the race in itself`, async () => {
    const { m, ctx, clips, run } = await player();
    run(5);
    m.riser(dur);
    const t = ctx.currentTime;
    run(t + 0.5);
    assert.equal(clips.filter((c) => c.when >= t && T.build[0] - 0.02 <= c.off && c.off < T.build[0] + 30).length, 0);
    m.sting('gun');
    run(ctx.currentTime + 0.5);
    assert.ok(heard(clips, 'race', 0, t));
  });
}

test('a riser with no music playing does nothing', async () => {
  const { m, ctx, clips, run } = await player();
  m.setStyle(null);
  m.riser(8);
  run(ctx.currentTime + 9);
  assert.equal(clips.length, 0);
});

const accentAt = (clips, at, from) => clips.find((c) => c.when >= from && Math.abs(c.off + 0.003 - at) < 0.002);
for (const [kind, name, skip] of [['round', 'crash', 0], ['hit', 'hit', 0], ['swell', 'swell', 1.2]]) {
  test(`the ${kind} accent is played from the track's own ${name}`, async () => {
    const { m, ctx, clips, run } = await player();
    run(10);
    const t = ctx.currentTime;
    m.sting(kind);
    assert.ok(accentAt(clips, T[name][0] + skip, t));
  });
}

test('a place gained is the end of the swell, and the crash it rises into', async () => {
  const { m, ctx, clips, run } = await player();
  run(10);
  const t = ctx.currentTime;
  m.sting('gain');
  const swell = accentAt(clips, T.swell[0] + T.swell[1] - 0.6, t), crash = accentAt(clips, T.crash[0], t);
  assert.ok(swell && crash);
  near(crash.when - swell.when, 0.6, 0.01);
});

test('the small accents keep three seconds apart', async () => {
  const { m, ctx, clips, run } = await player();
  run(10);
  const t = ctx.currentTime;
  m.sting('round');
  run(t + 2);
  const soon = ctx.currentTime;
  m.sting('round');
  assert.equal(accentAt(clips, T.crash[0], soon), undefined);
  run(t + 3.5);
  const later = ctx.currentTime;
  m.sting('round');
  assert.ok(accentAt(clips, T.crash[0], later));
});

// ---------- a join refused ----------
class FakeSocket {
  static all = [];
  constructor() { this.sent = []; this.readyState = 0; FakeSocket.all.push(this); }
  send(s) { this.sent.push(JSON.parse(s)); }
  open() { this.readyState = 1; this.onopen?.({}); }
  recv(frame) { this.onmessage?.({ data: JSON.stringify(frame) }); }
  close() { this.readyState = 3; }
}
function joining() {
  const rt = realtime({ url: 'https://abc.supabase.co', key: 'KEY', WebSocket: FakeSocket });
  const joined = rt.channel('match:ABC123').join(), s = FakeSocket.all.at(-1);
  s.open();
  return { rt, joined, s, ref: s.sent.find((f) => f.event === 'phx_join').ref };
}

test('a join the server refuses fails, saying why', async (t) => {
  const { rt, joined, s, ref } = joining();
  t.after(() => rt.close());
  s.recv({ topic: 'realtime:match:ABC123', event: 'phx_reply', payload: { status: 'error', response: { reason: 'full' } }, ref });
  await assert.rejects(joined, /^Error: join refused: \{"reason":"full"\}$/);
});

test('a refusal with no reason says what the server did say', async (t) => {
  const { rt, joined, s, ref } = joining();
  t.after(() => rt.close());
  s.recv({ topic: 'realtime:match:ABC123', event: 'phx_reply', payload: { status: 'error' }, ref });
  await assert.rejects(joined, /join refused: \{"status":"error"\}/);
});

test('a second refusal of a join already refused is ignored', async (t) => {
  const { rt, joined, s, ref } = joining();
  t.after(() => rt.close());
  const frame = { topic: 'realtime:match:ABC123', event: 'phx_reply', payload: { status: 'error' }, ref };
  s.recv(frame);
  await assert.rejects(joined);
  assert.doesNotThrow(() => s.recv(frame));
});

// ---------- two boats' rows eased between ----------
const row = (o = {}) => ({ ...readBoat(new Array(60).fill(0)), ...o });

test('between two snapshots the numbers are eased, and what is not a number stays the first one', () => {
  const a = row({ x: 10, z: -4, v: 2, kite: true, leg: 2, trim: 'in' }), b = row({ x: 20, z: 4, v: 6, kite: false, leg: 3, trim: 'out' });
  const m = lerpBoat(a, b, 0.25);
  assert.deepEqual([m.x, m.z, m.v], [12.5, -2, 3]);
  assert.deepEqual([m.kite, m.leg, m.trim], [true, 2, 'in']);
  assert.equal(a.x, 10, 'the rows themselves are left as they were');
});

test('an angle is eased the short way round', () => {
  for (const k of ['h', 'twa', 'awa', 'wdir']) {
    const m = lerpBoat(row({ [k]: 3.1 }), row({ [k]: -3.1 }), 0.5);
    near(Math.abs(m[k]), Math.PI, 1e-9, `${k}: ${m[k]}`);
  }
  near(lerpBoat(row({ h: 1 }), row({ h: 2 }), 0.5).h, 1.5);
});

test('all the way to the second snapshot the numbers are its numbers', () => {
  const b = row({ x: 7, heel: 12, h: -2.5 });
  const m = lerpBoat(row({ x: 1, heel: -3, h: 2.5 }), b, 1);
  assert.equal(m.x, 7); assert.equal(m.heel, 12); near(m.h, -2.5);
});

// ---------- the sets in the waves ----------
const SEA = makeWaves(1.2, 0.4);

test('the sets swell each train by at most a third, and the short ones less', () => {
  SEA.forEach((p, i) => {
    const most = i < 3 ? 0.35 : 0.2;
    for (let n = 0; n < 300; n++) {
      const g = waveGroup(p, i, n * 37.1, n * -13.3, n * 2.9);
      assert.ok(g >= 1 - most - 1e-9 && g <= 1 + most + 1e-9, `train ${i}: ${g}`);
    }
  });
});

test('a set travels at half the speed of its waves', () => {
  const i = 0, p = SEA[i], c = Math.cos(-0.2), s = Math.sin(-0.2);
  const dx = p.dx * c - p.dz * s, dz = p.dx * s + p.dz * c, speed = p.w / (2 * p.k), t = 40;
  near(waveGroup(p, i, 15 + dx * speed * t, 8 + dz * speed * t, t), waveGroup(p, i, 15, 8, 0), 1e-9);
});

test('the sea is no higher than its trains and their sets allow, and flat without any', () => {
  const most = SEA.reduce((a, p, i) => a + p.A * (i < 3 ? 1.35 : 1.2), 0);
  for (let n = 0; n < 300; n++) assert.ok(Math.abs(waveHeight(SEA, n * 11.3, n * 7.7, n * 0.9)) <= most);
  assert.equal(waveHeight([], 5, 5, 5), 0);
  assert.equal(waveHeight(makeWaves(0, 0), 5, 5, 5), 0);
});

test('the slope of the sea is the rise of the sea, sets and all', () => {
  const p = [SEA[0]], e = 0.001;
  // (the set's own slope is small beside the wave's: a ninth of it at most)
  for (const [x, z, t] of [[3, 4, 1], [40, -9, 7], [-22, 31, 13]]) {
    const rise = (waveHeight(p, x + p[0].dx * e, z + p[0].dz * e, t) - waveHeight(p, x - p[0].dx * e, z - p[0].dz * e, t)) / (2 * e);
    assert.ok(Math.abs(seaSlope(p, x, z, t, p[0].dx, p[0].dz) - rise) <= p[0].A * p[0].k * 0.11, `${seaSlope(p, x, z, t, p[0].dx, p[0].dz)} against ${rise}`);
  }
});

test('the slope is level along the crests, and the opposite way round going the other way', () => {
  const p = [SEA[0]];
  near(seaSlope(p, 3, 4, 1, -p[0].dz, p[0].dx), 0, 1e-12);
  near(seaSlope(SEA, 3, 4, 1, 0.6, 0.8), -seaSlope(SEA, 3, 4, 1, -0.6, -0.8), 1e-12);
});

test('asked for the long swell alone, the slope has only the first trains', () => {
  assert.equal(seaSlope(SEA, 3, 4, 1, 1, 0, 0), 0);
  near(seaSlope(SEA, 3, 4, 1, 1, 0, 3), seaSlope(SEA.slice(0, 3), 3, 4, 1, 1, 0), 1e-12);
  near(seaSlope(SEA, 3, 4, 1, 1, 0), seaSlope(SEA, 3, 4, 1, 1, 0, SEA.length), 1e-12);
});

// ---------- a headsail change ----------
test('changing to the small jib takes the crew half a minute, and they say so', () => {
  const b = new Boat();
  b.events.length = 0;
  assert.equal(b.setJib(true), true);
  assert.deepEqual(b.jibJob, { small: true, t: 30, total: 30 });
  assert.deepEqual(b.events, ['jibStart']);
});

test('one headsail change at a time', () => {
  const b = new Boat();
  b.setJib(true);
  b.events.length = 0;
  assert.equal(b.setJib(false), false);
  assert.deepEqual(b.jibJob.small, true);
  assert.deepEqual(b.events, []);
});

test('the jib already set is not set again', () => {
  const b = new Boat();
  assert.equal(b.setJib(false), false);
  assert.equal(b.jibJob ?? null, null);
  b.smallJib = true;
  assert.equal(b.setJib(true), false);
  assert.equal(b.setJib(false), true);
  assert.equal(b.jibJob.small, false);
});

test('a yacht with no small jib cannot change to one', () => {
  const had = CLS.j3;
  CLS.j3 = false;
  try {
    const b = new Boat();
    assert.equal(b.setJib(true), false);
    assert.equal(b.jibJob ?? null, null);
  } finally { CLS.j3 = had; }
});

// ---------- a crash gybe with the kite up ----------
const running = (tws, rand) => { const b = new Boat({ v: 5 }); Object.assign(b, { tws, kite: true, kiteType: 'gen', boom: 1, heel: 5 }); if (rand != null) b._race = { rand: () => rand }; b.events.length = 0; return b; };

test('a crash gybe in a breeze with the kite up is a death roll', () => {
  const b = running(16, 0.9);
  b.flipBoom(true);
  assert.ok(b.events.includes('deathRoll'));
  assert.deepEqual([b.boom, b.broachT, b.heel], [-1, 4, 48]);
  near(b.v, 3);
});

for (const [name, tws, rand] of [['in a blow', 20, 0.9], ['when the luck is out', 16, 0.1]]) {
  test(`a death roll ${name} wraps the kite round the forestay`, () => {
    const b = running(tws, rand);
    b.flipBoom(true);
    assert.equal(b.kiteJob.messy, true);
    assert.equal(b.kiteJob.up, false);
  });
}

// ---------- the race's small questions ----------
test('a race standing idle lets the time go by, and not its clock', () => {
  const r = { t: 10, clock: -5 };
  Race.prototype.idle.call(r, 0.5);
  assert.deepEqual(r, { t: 10.5, clock: -5 });
});

test('how far a boat is from the line, and how far along it: at her bow', () => {
  const course = { pin: { x: -100, z: 0 }, normal: { x: 0, z: 1 }, dir: { x: 1, z: 0 }, len: 200 };
  // the middle of her hull 30 m above the line, heading away from it (+z): her bow half a hull further
  const { d, t } = Race.prototype.lineInfo.call({ course }, { x: 50, z: 30, h: Math.PI });
  assert.ok(Math.abs(d - (30 + HULL / 2)) < 1e-9); assert.ok(Math.abs(t - 0.75) < 1e-9);
});

// ---------- a river's stream ----------
const river = (room) => ({ current: { x: 2, z: -1 }, stream: 'flow', t: 0, tidePh: 0, roomAt: () => room });
const STILL_Z = -0.8 * 170; // (where the river's own unevenness along its length is nil)

test('a river runs at its full speed out in the stream', () => {
  const c = Race.prototype.currentAt.call(river(240), 0, STILL_Z);
  near(c.x, 2); near(c.z, -1);
});

test('a river runs slower near its banks, in the same direction, and never stops', () => {
  const half = Race.prototype.currentAt.call(river(60), 0, STILL_Z);
  near(half.x, 1); near(half.z, -0.5);
  const bank = Race.prototype.currentAt.call(river(0), 0, STILL_Z);
  near(bank.x, 0.7); near(bank.z, -0.35);
});

test('a river is a little uneven along its length and through the race', () => {
  const r = river(240), a = Race.prototype.currentAt.call(r, 0, STILL_Z), along = Race.prototype.currentAt.call(r, 0, 100);
  assert.notEqual(along.x, a.x);
  r.t = 225;
  const later = Race.prototype.currentAt.call(r, 0, STILL_Z);
  near(later.x, 2 * 1.08);
});

test('still water is still, in a river or out of it', () => {
  const r = { ...river(240), current: { x: 0, z: 0 } };
  assert.equal(Race.prototype.currentAt.call(r, 5, 5), r.current);
});

// ---------- a hail ----------
function hailing(h) {
  const said = [], P = { name: 'Me' };
  return { said, P, race: { player: P, clock: 50, youCanHail: () => h, say: (key, arg, to) => said.push({ key, arg, to }) } };
}

test('a hail with nobody to hail is only heard by you', () => {
  const { race, said, P } = hailing(null);
  Race.prototype.hail.call(race);
  assert.deepEqual(said, [{ key: 'youHail', arg: { rule: null }, to: P }]);
});

test('hailed for room to tack, a computer skipper looks to her duty and tacks after a moment', () => {
  const ai = { skill: 0.6 }, o = { ai };
  const { race, said, P } = hailing({ o, rule: '20' });
  Race.prototype.hail.call(race, P);
  assert.deepEqual(said, [{ key: 'youHail', arg: { rule: '20' }, to: P }]);
  assert.equal(ai.alertT, 50);
  near(ai.respondT, 50 + 1 + 2.5 * 0.4);
  assert.deepEqual(race.r20, { hailer: P, hailed: o, t: 50, tacked: true });
});

test('the better the skipper, the sooner she answers the hail', () => {
  const when = (skill) => { const ai = { skill }; Race.prototype.hail.call(hailing({ o: { ai }, rule: '20' }).race); return ai.respondT; };
  assert.ok(when(0.9) < when(0.3));
});

test('hailed for anything else, a computer skipper only looks up', () => {
  const ai = { skill: 0.6 };
  const { race } = hailing({ o: { ai }, rule: '18' });
  Race.prototype.hail.call(race);
  assert.equal(ai.alertT, 50);
  assert.equal(ai.respondT, undefined);
  assert.equal(race.r20, undefined);
});

test('a human you hail hears it from you, and it goes in her log', () => {
  const o = { human: true, log: { hails: { 20: 1 } } };
  const { race, said, P } = hailing({ o, rule: '20' });
  Race.prototype.hail.call(race, P);
  assert.deepEqual(said[1], { key: 'hail', arg: { who: 'Me', rule: '20' }, to: o });
  assert.deepEqual(o.log.hails, { 20: 2 });
  assert.equal(race.r20, undefined, 'she answers for herself');
});

test("a human's first hail of a rule starts her count", () => {
  const o = { human: true, log: { hails: {} } };
  Race.prototype.hail.call(hailing({ o, rule: '18' }).race);
  assert.deepEqual(o.log.hails, { 18: 1 });
});

// ---------- a name typed in the waiting room ----------
async function waitingRoom() {
  const hub = memoryRealtime(), now = () => 1000;
  const room = async (id, host) => { const r = new Room({ link: makeLink(hub, 'ABC234'), me: { id, name: id, look: {} }, host, settings: host ? { venue: 'palma' } : null, now, every: 0 }); await r.joined; return r; };
  const host = await room('host', true), guest = await room('guest', false);
  return { host, guest };
}

test('a name typed in the waiting room is told to the other at once', async () => {
  const { host, guest } = await waitingRoom();
  guest.rename('Ann');
  assert.equal(guest.me.name, 'Ann');
  assert.equal(host.guest.name, 'Ann');
  host.rename('Bob');
  assert.equal(guest.host.name, 'Bob');
});

test('a name typed during a race is told when the waiting room opens again', async () => {
  const { host, guest } = await waitingRoom();
  guest.pause(true);
  guest.rename('Ann');
  assert.equal(host.guest.name, 'guest');
  guest.pause(false);
  assert.equal(host.guest.name, 'Ann');
});

test('a name typed after leaving is told to nobody', async () => {
  const { host, guest } = await waitingRoom();
  const sent = [], send = guest.link.all.send;
  guest.leave();
  guest.link.all.send = (...a) => { sent.push(a); return send(...a); };
  guest.rename('Ann');
  assert.deepEqual(sent, []);
  assert.equal(guest.me.name, 'Ann');
  assert.equal(host.guest, null);
});

// ---------- the stamping script, as the build runs it ----------
const SCRIPT = fileURLToPath(new URL('../scripts/stamp-game.mjs', import.meta.url));
const PAGES = ['/play/index.html', '/boat-view/index.html', '/hero-view/index.html', '/fleet-view/index.html', '/venue-view/index.html', '/venues-view/index.html'];
const HTML = '<script type="importmap">{"imports":{"three":"/vendor/three.js"}}</script><link rel="modulepreload" href="/game/a.js"><script type="module" src="/game/a.js"></script>';
const SOURCE = 'export const a = 1;\n', HASH = createHash('sha256').update(SOURCE).digest('hex').slice(0, 10);
const dirs = [];
after(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });
function site() {
  const dir = mkdtempSync(join(tmpdir(), 'stamp-cli-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'game'));
  writeFileSync(join(dir, 'game/a.js'), SOURCE);
  for (const p of PAGES) { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), HTML); }
  return dir;
}
function stampRun(args, vercel) {
  const env = { ...process.env };
  delete env.VERCEL; delete env.NODE_TEST_CONTEXT;
  if (vercel) env.VERCEL = '1';
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}

test('off Vercel the script leaves the pages as they are', () => {
  const dir = site();
  assert.match(stampRun([dir]), /not on Vercel, the game pages stay unstamped/);
  for (const p of PAGES) assert.equal(readFileSync(join(dir, p), 'utf8'), HTML, p);
});

test('--force stamps the pages of the folder it is given', () => {
  const dir = site();
  assert.match(stampRun(['--force', dir]), /the game's modules in \/play\/index\.html.* carry their hashes/);
  for (const p of PAGES) {
    const html = readFileSync(join(dir, p), 'utf8');
    assert.ok(html.includes(`<script type="module" src="/game/a.js?v=${HASH}"`), p);
    assert.ok(html.includes(`<link rel="modulepreload" href="/game/a.js?v=${HASH}">`), p);
    assert.ok(html.includes(`"/game/a.js":"/game/a.js?v=${HASH}"`), p);
  }
});

test('on Vercel the script stamps without being told', () => {
  const dir = site();
  assert.match(stampRun([dir], true), /carry their hashes/);
  assert.ok(readFileSync(join(dir, PAGES[0]), 'utf8').includes(`?v=${HASH}`));
});
