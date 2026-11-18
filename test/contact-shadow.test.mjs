// Three things sailors asked for: a wind shadow as long as a real one (some six or seven mast heights, for every class,
// fading as it goes), a contact you can hear, as hard as it was, and a sail number of four digits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u))));
const sim = await import('../public/game/sim.js');
const { CLASSES } = await import('../public/game/classes.js');
const { createSfx } = await import('../public/game/sfx.js');
const { cleanBoat, DEFAULT_BOAT } = await import('../lib/boat.ts');
const { D2R, lineD, shadowReach } = sim;

const HUMANS = [{ id: 'h', name: 'Host' }, { id: 'g', name: 'Guest' }];
const duel = () => new sim.Race({ preset: 'medium', length: 'short', seed: 11, fleet: 2, start: 1, humans: HUMANS, me: 'h' });
const put = (r, b, p, h, v = 3) => Object.assign(b, { x: p.x, z: p.z, h, v, lastD: lineD(r.course, b), lastZ: p.z, auto: null, rudder: 0, yawRate: 0 });
const JPK_MAST = 16.2;

// ---------- the wind shadow ----------
for (const c of Object.values(CLASSES)) {
  test(`the ${c.id}'s wind shadow reaches six to seven of her mast heights`, () => {
    const heights = shadowReach(c) / (JPK_MAST * c.frame);
    assert.ok(heights >= 6 && heights <= 7, `${heights} mast heights`);
  });
}

// the shadow a boat feels `d` metres straight downwind of the other
function shadowAt(d) {
  const r = duel(), [h, g] = r.humans, W = r.wind.at(0, 0).dir;
  put(r, h, { x: 0, z: 0 }, W + 150 * D2R); put(r, g, { x: -Math.sin(W) * d, z: Math.cos(W) * d }, W + 150 * D2R);
  return r.windAt(g).shadow;
}

test('the shadow is still there six mast heights down, gone past seven, and fades on the way', () => {
  assert.ok(shadowAt(6 * JPK_MAST) > 0, 'six mast heights');
  assert.equal(shadowAt(7 * JPK_MAST), 0, 'seven mast heights');
  assert.ok(shadowAt(20) > shadowAt(50) && shadowAt(50) > shadowAt(90));
});

// ---------- the contact ----------
function bump(hd2, v) {
  const r = duel(), [h, g] = r.humans, H = 0.7;
  r.clock = 100;
  put(r, h, { x: 0, z: 0 }, H, v);
  put(r, g, { x: Math.sin(H) * 9, z: -Math.cos(H) * 9 }, H + hd2, v);
  r.collide(1 / 60);
  return r.messages.find((m) => m.key === 'bump' && m.to === h).arg;
}

test('a contact says how hard it was: a touch gently, a head-on collision at full strength', () => {
  const touch = bump(0, 3), headOn = bump(Math.PI, 4);
  assert.ok(touch > 0 && touch < 0.3, `a touch: ${touch}`);
  assert.equal(headOn, 1);
});

// a stand-in for the browser's AudioContext, which remembers every gain's loudest moment and where the sound goes
class Param {
  constructor(v = 0) { this.value = v; this.peak = 0; }
  setValueAtTime() { return this; }
  linearRampToValueAtTime(v) { this.peak = Math.max(this.peak, v); return this; }
  exponentialRampToValueAtTime() { return this; }
  setTargetAtTime() { return this; }
}
class Node {
  constructor(ctx, extra = {}) { this.out = []; Object.assign(this, extra); ctx.nodes.push(this); }
  connect(to) { this.out.push(to); return to; }
  start() { this.started = true; }
  stop() {}
  setPeriodicWave() {}
}
class Ctx {
  sampleRate = 8000; currentTime = 0; nodes = [];
  createBuffer(ch, length, sampleRate) { const d = Array.from({ length: ch }, () => new Float32Array(length)); return { numberOfChannels: ch, length, sampleRate, duration: length / sampleRate, getChannelData: (c) => d[c] }; }
  createBufferSource() { return new Node(this, { playbackRate: new Param(1), isSource: true }); }
  createBiquadFilter() { return new Node(this, { frequency: new Param(350), Q: new Param(1), gain: new Param(0) }); }
  createGain() { return new Node(this, { gain: new Param(1) }); }
  createStereoPanner() { return new Node(this, { pan: new Param(0) }); }
  createConvolver() { return new Node(this); }
  createOscillator() { return new Node(this, { frequency: new Param(440) }); }
  createWaveShaper() { return new Node(this); }
  createPeriodicWave() { return {}; }
}
const reaches = (a, b, seen = new Set()) => a === b || (!seen.has(a) && (seen.add(a), a.out.some((n) => reaches(n, b, seen))));

function crunch(hard) {
  const ctx = new Ctx(), master = new Node(ctx), boat = new Node(ctx, { gain: new Param(1) });
  const timeout = globalThis.setTimeout; globalThis.setTimeout = () => 0;
  let sfx; try { sfx = createSfx(ctx, master, { boat }); } finally { globalThis.setTimeout = timeout; }
  const from = ctx.nodes.length;
  sfx.collide(hard);
  const made = ctx.nodes.slice(from);
  return { sources: made.filter((n) => n.isSource), loudest: Math.max(...made.map((n) => n.gain?.peak ?? 0)), boat };
}

test('the collision is heard on the boat’s own sounds, and the harder it is the louder', () => {
  const soft = crunch(0.2), hard = crunch(1);
  assert.ok(hard.sources.length >= 3, 'a thud, the hull’s boom and the crack of it');
  for (const s of hard.sources) { assert.equal(s.started, true); assert.ok(reaches(s, hard.boat), 'through Settings › Sound’s boat level'); }
  assert.ok(hard.loudest > soft.loudest * 1.5, `${soft.loudest} then ${hard.loudest}`);
});

// ---------- the sail number ----------
test('a sail number keeps four digits, and no more', () => {
  assert.equal(cleanBoat({ ...DEFAULT_BOAT, num: '4420' }).num, '4420');
  assert.equal(cleanBoat({ ...DEFAULT_BOAT, num: '44205' }).num, '4420');
});
