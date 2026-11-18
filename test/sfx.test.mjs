// The game's own sounds (public/game/sfx.js) on a stand-in for the browser's AudioContext that records what is built,
// what is connected to what and what is scheduled: the noise, the wind, the water, the sails, the winch, the horn and the beep.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AUDIO_TICK, createSfx, noiseBuf, openAudio } from '../public/game/sfx.js';

const near = (a, b, e = 1e-6, msg) => assert.ok(Math.abs(a - b) <= e, msg ?? `${a} is not within ${e} of ${b}`);
const realRandom = Math.random;
// the same "random" numbers every run
function seed(n = 1) {
  let s = n >>> 0;
  Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 || 0.5; };
}
beforeEach(() => { Math.random = realRandom; seed(7); });

class Param {
  constructor(value = 0) { this.value = value; this.events = []; }
  setValueAtTime(v, t) { this.events.push(['set', v, t]); return this; }
  linearRampToValueAtTime(v, t) { this.events.push(['ramp', v, t]); return this; }
  exponentialRampToValueAtTime(v, t) { this.events.push(['exp', v, t]); return this; }
  setTargetAtTime(v, t, tc) { this.events.push(['target', v, t, tc]); return this; }
  get target() { return this.events.filter((e) => e[0] === 'target').at(-1)?.[1]; }
  get targets() { return this.events.filter((e) => e[0] === 'target').length; }
  get peak() { return this.events.find((e) => e[0] === 'ramp')?.[1]; }
}
class Node {
  constructor(ctx, kind, params = {}) { this.kind = kind; this.out = []; Object.assign(this, params); ctx.nodes.push(this); }
  connect(to) { this.out.push(to); return to; }
  start(...a) { this.started = a; }
  stop(t) { this.stopped = t; }
  setPeriodicWave(w) { this.wave = w; }
}
class Ctx {
  constructor({ sampleRate = 8000, panner = true } = {}) {
    this.sampleRate = sampleRate; this.currentTime = 0; this.nodes = []; this.waves = [];
    if (!panner) this.createStereoPanner = undefined;
  }
  createBuffer(ch, length, sampleRate) {
    const data = Array.from({ length: ch }, () => new Float32Array(length));
    return { numberOfChannels: ch, length, sampleRate, duration: length / sampleRate, getChannelData: (c) => data[c] };
  }
  createBufferSource() { return new Node(this, 'source', { playbackRate: new Param(1) }); }
  createBiquadFilter() { return new Node(this, 'filter', { frequency: new Param(350), Q: new Param(1), gain: new Param(0) }); }
  createGain() { return new Node(this, 'gain', { gain: new Param(1) }); }
  createStereoPanner() { return new Node(this, 'panner', { pan: new Param(0) }); }
  createConvolver() { return new Node(this, 'convolver'); }
  createOscillator() { return new Node(this, 'osc', { frequency: new Param(440) }); }
  createWaveShaper() { return new Node(this, 'shaper'); }
  createPeriodicWave(re, im) { const w = { re, im }; this.waves.push(w); return w; }
  of(kind, from = 0) { return this.nodes.slice(from).filter((n) => n.kind === kind); }
  filter(type, f, from = 0) { return this.of('filter', from).find((n) => n.type === type && n.frequency.value === f); }
}
const reaches = (a, b, seen = new Set()) => a === b || (!seen.has(a) && (seen.add(a), (a.out || []).some((n) => reaches(n, b, seen))));

// the sounds on a fresh context; clicksReady: the winch's clicks, which are made a moment later, are there already
function make({ bus, clicksReady = true, ...o } = {}) {
  const ctx = new Ctx(o), master = new Node(ctx, 'master');
  const timeout = globalThis.setTimeout, later = [];
  globalThis.setTimeout = (fn, ms) => { later.push({ fn, ms }); return 0; };
  let sfx;
  try { sfx = createSfx(ctx, master, bus?.(ctx)); } finally { globalThis.setTimeout = timeout; }
  if (clicksReady) later.forEach((l) => l.fn());
  return { ctx, master, sfx, later };
}
const buses = (signals = 1) => (ctx) => ({ boat: new Node(ctx, 'gain', { gain: new Param(1) }), signals: new Node(ctx, 'gain', { gain: new Param(signals) }) });
const rms = (d) => Math.sqrt(d.reduce((a, x) => a + x * x, 0) / d.length);
const lag1 = (d) => { let a = 0, b = 0; for (let i = 1; i < d.length; i++) { a += d[i] * d[i - 1]; b += d[i] * d[i]; } return a / b; };

// ---------- the context ----------
test('a sound card that cannot be closed, or fails to, still gets a context at 48 kHz', () => {
  class NoClose { constructor(o = {}) { this.sampleRate = o.sampleRate ?? 96000; } }
  assert.equal(openAudio(NoClose).sampleRate, 48000);
  class BadClose extends NoClose { close() { return Promise.reject(new Error('busy')); } }
  assert.equal(openAudio(BadClose).sampleRate, 48000);
});

test('the sounds that follow the race are given new values about thirty times a second', () => {
  assert.equal(AUDIO_TICK, 0.03);
});

// ---------- the noise ----------
for (const color of ['white', 'pink', 'brown']) {
  test(`${color} noise comes at the size asked for, each side at the same level`, () => {
    const b = noiseBuf(new Ctx(), color, 1.5);
    assert.deepEqual([b.numberOfChannels, b.length, b.sampleRate], [2, 12000, 8000]);
    for (const c of [0, 1]) near(rms(b.getChannelData(c)), 0.25, 1e-5);
    assert.notDeepEqual(b.getChannelData(0), b.getChannelData(1), 'a channel each side, so it is wide');
  });
}

test('noise is four seconds of stereo unless told otherwise, or one channel when asked', () => {
  const d = noiseBuf(new Ctx(), 'white');
  assert.deepEqual([d.numberOfChannels, d.length], [2, 32000]);
  assert.equal(noiseBuf(new Ctx(), 'white', 1, 1).numberOfChannels, 1);
});

test('white noise is rough, pink smoother and brown smoothest', () => {
  const [w, p, b] = ['white', 'pink', 'brown'].map((c) => lag1(noiseBuf(new Ctx(), c, 2, 1).getChannelData(0)));
  assert.ok(Math.abs(w) < 0.1, `white ${w}`);
  assert.ok(p > 0.4 && p < 0.95, `pink ${p}`);
  assert.ok(b > 0.95, `brown ${b}`);
});

test('the loop goes round without a click: its end runs into its start like any other two samples', () => {
  const d = noiseBuf(new Ctx(), 'brown', 2, 1).getChannelData(0);
  let step = 0;
  for (let i = 1; i < d.length; i++) step = Math.max(step, Math.abs(d[i] - d[i - 1]));
  assert.ok(Math.abs(d[0] - d[d.length - 1]) <= step * 1.5, `${Math.abs(d[0] - d[d.length - 1])} against steps of ${step}`);
});

test('noise made of silence stays silent, not a number divided by nothing', () => {
  Math.random = () => 0.5; // every sample exactly 0
  const d = noiseBuf(new Ctx(), 'white', 0.5, 1).getChannelData(0);
  assert.ok(d.every((x) => x === 0));
});

// ---------- what is built ----------
test('the sounds come with their noise: a mono white, a stereo pink and a stereo brown', () => {
  const { sfx } = make();
  assert.deepEqual([sfx.white.numberOfChannels, sfx.white.duration], [1, 2]);
  assert.deepEqual([sfx.pink.numberOfChannels, sfx.pink.duration], [2, 4]);
  assert.deepEqual([sfx.brown.numberOfChannels, sfx.brown.duration], [2, 4]);
});

test("the land's echo starts after 60 ms of silence and dies away, and comes back half as loud", () => {
  const { ctx, master } = make();
  const [air] = ctx.of('convolver');
  assert.equal(air.buffer.numberOfChannels, 2);
  near(air.buffer.duration, 2.6, 1e-3);
  const d = air.buffer.getChannelData(0), sr = ctx.sampleRate;
  assert.ok(d.subarray(0, Math.floor(sr * 0.06)).every((x) => x === 0));
  assert.ok(rms(d.subarray(Math.floor(sr * 0.1), Math.floor(sr * 0.9))) > 5 * rms(d.subarray(Math.floor(sr * 1.8), Math.floor(sr * 2.6))));
  assert.equal(air.out[0].gain.value, 0.5);
  assert.ok(reaches(air, master));
});

test('the node helpers build what they are asked for, and leave alone what they are not', () => {
  const { ctx, sfx, master } = make();
  const f = sfx.node.filter('peaking', 900, 2, 6);
  assert.deepEqual([f.type, f.frequency.value, f.Q.value, f.gain.value], ['peaking', 900, 2, 6]);
  const plain = sfx.node.filter('lowpass', 500);
  assert.deepEqual([plain.Q.value, plain.gain.value], [1, 0]);
  assert.equal(sfx.node.gain().gain.value, 0);
  const s = sfx.node.src(sfx.pink), once = sfx.node.src(sfx.pink, false);
  assert.deepEqual([s.buffer, s.loop, once.loop], [sfx.pink, true, false]);
  const p = sfx.node.pan(3);
  assert.equal(p.pan.value, 1, 'no further than hard over');
  assert.equal(sfx.node.pan(-3).pan.value, -1);
  assert.deepEqual(p.out, [master]);
  assert.equal(ctx.of('panner').length > 0, true);
});

test('without a stereo panner in the browser a sound goes straight to where it was going', () => {
  const { sfx, master } = make({ panner: false });
  assert.equal(sfx.node.pan(0.5), master);
  assert.doesNotThrow(() => sfx.wind.update(12, 0.5, 1, 0.1));
  assert.doesNotThrow(() => sfx.crack(0.5, 0.5));
});

test('a send to the echo is as loud as the bus the sound goes to', () => {
  const { ctx, sfx } = make();
  const [air] = ctx.of('convolver'), from = sfx.node.gain(1);
  const plain = sfx.send(from, 0.5), via = sfx.send(from, 0.5, { gain: { value: 0.4 } });
  assert.equal(plain.gain.value, 0.5);
  near(via.gain.value, 0.2);
  assert.ok(reaches(from, air));
});

// ---------- the wind ----------
function windParts(ctx) {
  const lp = ctx.filter('lowpass', 400), bp = ctx.filter('bandpass', 1800), m1 = ctx.filter('bandpass', 400), m2 = ctx.filter('bandpass', 600);
  return { lp, bp, m1, m2, body: lp.out[0], hiss: bp.out[0], moan: m1.out[0], out: lp.out[0].out[0] };
}
const blowing = (aws, { pan = 0, k = 1 } = {}) => {
  Math.random = () => 0.5; // the gusts held still: the same for every wind
  const made = make(), w = windParts(made.ctx);
  made.sfx.wind.update(aws, pan, k, 0.1);
  return { ...made, w };
};

test('the wind plays from its three loops as soon as it is built', () => {
  const { ctx, master } = make();
  const { lp, bp, m1 } = windParts(ctx);
  const sources = ctx.of('source').filter((s) => s.out.includes(lp) || s.out.includes(bp) || s.out.includes(m1));
  assert.equal(sources.length, 3);
  for (const s of sources) { assert.equal(s.loop, true); assert.equal(s.started[0], 0); assert.ok(reaches(s, master)); }
});

test('the wind gets louder and deeper in its roar as it blows harder', () => {
  const light = blowing(5).w, fresh = blowing(20).w;
  assert.ok(fresh.body.gain.target > light.body.gain.target);
  assert.ok(fresh.lp.frequency.target > light.lp.frequency.target);
});

test('the hiss comes in above 5 knots', () => {
  assert.equal(blowing(5).w.hiss.gain.target, 0);
  assert.ok(blowing(15).w.hiss.gain.target > 0);
});

test("the rigging moans only from 13 knots, its pitch climbing with the wind, a fifth between its two tones", () => {
  assert.equal(blowing(13).w.moan.gain.target, 0);
  const a = blowing(18).w, b = blowing(30).w;
  assert.ok(a.moan.gain.target > 0);
  assert.ok(b.moan.gain.target > a.moan.gain.target);
  assert.ok(b.m1.frequency.target > a.m1.frequency.target);
  near(b.m2.frequency.target / b.m1.frequency.target, 1.49);
});

test('the wind stops growing at 35 knots', () => {
  const a = blowing(35).w, b = blowing(70).w;
  near(a.lp.frequency.target, b.lp.frequency.target);
  near(a.m1.frequency.target, b.m1.frequency.target);
});

test('paused (the Sea setting at 0), the wind is silent', () => {
  const { w } = blowing(25, { k: 0 });
  assert.deepEqual([w.body.gain.target, w.hiss.gain.target, w.moan.gain.target], [0, 0, 0]);
});

test('no wind reading at all is a calm, never a broken number', () => {
  const { w } = blowing(undefined);
  assert.ok(Number.isFinite(w.body.gain.target));
  assert.ok(Number.isFinite(w.lp.frequency.target));
});

test('the wind is heard from its side, but never hard over', () => {
  near(blowing(12, { pan: 0.5 }).w.out.pan.target, 0.225);
  near(blowing(12, { pan: 9 }).w.out.pan.target, 0.45);
  near(blowing(12, { pan: -9 }).w.out.pan.target, -0.45);
});

test('the wind takes new values only every so often, however fast the screen', () => {
  const { ctx, sfx } = make(), { body } = windParts(ctx);
  sfx.wind.update(12, 0, 1, 0.008);
  assert.equal(body.gain.targets, 1);
  ctx.currentTime += AUDIO_TICK / 2;
  sfx.wind.update(12, 0, 1, 0.008);
  assert.equal(body.gain.targets, 1);
  ctx.currentTime += AUDIO_TICK;
  sfx.wind.update(12, 0, 1, 0.008);
  assert.equal(body.gain.targets, 2);
});

test('the gusts come and go, but the wind never falls silent in them', () => {
  const { ctx, sfx } = make(), { body } = windParts(ctx), seen = [];
  for (let i = 0; i < 400; i++) { ctx.currentTime += 0.05; sfx.wind.update(20, 0, 1, 0.05); seen.push(body.gain.target); }
  assert.ok(Math.max(...seen) > Math.min(...seen) * 1.2, 'gusts swell and die');
  assert.ok(Math.min(...seen) >= 0.176 * 0.2 - 1e-9, 'at least a fifth of its level');
});

// ---------- the water ----------
function waterParts(ctx) { const bp = ctx.filter('bandpass', 700); return { bp, rush: bp.out[0], out: bp.out[0].out[0] }; }
const sailing = (v, surf = false, k = 1) => { const m = make(), p = waterParts(m.ctx); m.sfx.water.update(v, surf, 0, k); return p; };

test('the water rushes louder and brighter the faster she goes', () => {
  near(sailing(3.4).rush.gain.target, 0.1);
  near(sailing(3.4).bp.frequency.target, 420 + 120 * 3.4);
  assert.ok(sailing(6).bp.frequency.target > sailing(3).bp.frequency.target);
});

test('surfing is louder still, up to a limit', () => {
  near(sailing(3.4, true).rush.gain.target, 0.17);
  near(sailing(30, true).rush.gain.target, 0.22);
  near(sailing(30).bp.frequency.target, 420 + 120 * 14, 1e-6, 'and no brighter than at 14 m/s');
});

test('paused, the water is silent', () => {
  assert.equal(sailing(5, true, 0).rush.gain.target, 0);
});

test('the water goes straight to the master, and takes new values only every so often', () => {
  const { ctx, sfx, master } = make(), { rush, out } = waterParts(ctx);
  assert.deepEqual(out.out, [master]);
  sfx.water.update(3, false, 0, 1);
  sfx.water.update(9, false, 0, 1);
  assert.equal(rush.gain.targets, 1);
  ctx.currentTime += AUDIO_TICK;
  sfx.water.update(9, false, 0, 1);
  assert.equal(rush.gain.targets, 2);
});

// ---------- the sails ----------
const flutterOf = (ctx) => ({ g: ctx.filter('bandpass', 650).out[0].out[0], lfo: ctx.of('osc')[0] });

test('a sail just luffing flutters, and flutters less once it is flogging hard', () => {
  const luff = make(), a = flutterOf(luff.ctx);
  luff.sfx.sails(0.5, 20, 1, 0);
  near(a.g.gain.target, 0.11);
  const flog = make(), b = flutterOf(flog.ctx);
  flog.sfx.sails(1, 20, 1, 0);
  near(b.g.gain.target, 0.044);
  const still = make(), c = flutterOf(still.ctx);
  still.sfx.sails(0, 20, 1, 0);
  assert.equal(c.g.gain.target, 0);
});

test('the flutter quickens with the wind, up to 30 knots', () => {
  const a = make(), f = flutterOf(a.ctx);
  assert.equal(f.lfo.frequency.value, 17);
  a.sfx.sails(0.5, 20, 1, 0);
  near(f.lfo.frequency.target, 21);
  const b = make(), g = flutterOf(b.ctx);
  b.sfx.sails(0.5, 60, 1, 0);
  near(g.lfo.frequency.target, 25);
});

test('the flutter goes to the boat bus', () => {
  const { ctx } = make({ bus: buses() });
  assert.ok(reaches(flutterOf(ctx).g, ctx.nodes[1]));
});

test('a sail cracks each time it fills the other way, if it is flogging', () => {
  const { ctx, sfx } = make(), before = ctx.nodes.length;
  sfx.sails(0.8, 10, 1, 1); // a whole second: it is bound to fill the other way
  assert.equal(ctx.of('source', before).length, 2, 'the thump of the cloth and its snap');
});

for (const [name, flog, k, dt] of [['a sail barely flogging', 0.1, 1, 1], ['a paused game', 0.8, 0, 1], ['a frame too short to turn it', 0.8, 1, 0]]) {
  test(`no crack from ${name}`, () => {
    const { ctx, sfx } = make(), before = ctx.nodes.length;
    sfx.sails(flog, 10, k, dt);
    assert.equal(ctx.of('source', before).length, 0);
  });
}

test('the flutter is given new values only every so often', () => {
  const { ctx, sfx } = make(), { g } = flutterOf(ctx);
  sfx.sails(0.5, 10, 1, 0);
  sfx.sails(0.9, 10, 1, 0);
  assert.equal(g.gain.targets, 1);
  ctx.currentTime += AUDIO_TICK;
  sfx.sails(0.9, 10, 1, 0);
  assert.equal(g.gain.targets, 2);
});

test('a crack is a thump and a snap, the snap a moment later and quieter', () => {
  const { ctx, sfx } = make(), before = ctx.nodes.length;
  ctx.currentTime = 2;
  sfx.crack(0.4, 0.3);
  const [thump, snap] = ctx.of('source', before);
  assert.equal(thump.buffer, sfx.brown);
  assert.equal(snap.buffer, sfx.pink);
  assert.equal(thump.started[0], 2);
  near(snap.started[0], 2.003);
  const [a, b] = [thump, snap].map((s) => s.out[0].out[0]);
  near(a.gain.peak, 0.38);
  near(b.gain.peak, 0.22);
  assert.equal(ctx.of('panner', before)[0].pan.value, 0.3);
});

test('a crack too faint to hear is not made', () => {
  const { ctx, sfx } = make(), before = ctx.nodes.length;
  sfx.crack(0.003);
  assert.equal(ctx.nodes.length, before);
});

test('a crack goes where it is sent, and to the boat bus if not told', () => {
  const { ctx, sfx } = make({ bus: buses() });
  const boat = ctx.nodes[1], other = new Node(ctx, 'other'), before = ctx.nodes.length;
  sfx.crack(0.5);
  assert.ok(reaches(ctx.of('source', before)[0], boat));
  const next = ctx.nodes.length;
  sfx.crack(0.5, 0, other, 9);
  assert.ok(reaches(ctx.of('source', next)[0], other));
  assert.equal(ctx.of('source', next)[0].started[0], 9);
});

test('every burst fades in, dies away and starts inside its loop', () => {
  const { ctx, sfx } = make(), before = ctx.nodes.length;
  sfx.slap(1);
  for (const s of ctx.of('source', before)) {
    const [at, offset, dur] = s.started, e = s.out[0].out[0].gain.events;
    assert.ok(offset >= 0 && offset <= s.buffer.duration - 0.6);
    assert.deepEqual(e.map((x) => x[0]), ['set', 'ramp', 'exp']);
    near(e[2][1], 0.0005);
    near(e[2][2] + 0.05, at + dur);
  }
});

// ---------- the one-shots ----------
test('a slam is a thud, a boom and the splash a moment after', () => {
  const { ctx, sfx } = make(), before = ctx.nodes.length;
  ctx.currentTime = 1;
  sfx.slap(0.5);
  const s = ctx.of('source', before);
  assert.deepEqual(s.map((x) => x.buffer), [sfx.brown, sfx.pink, sfx.pink]);
  assert.deepEqual(s.map((x) => x.started[0]), [1, 1, 1.03]);
  [0.35, 0.11, 0.08].forEach((p, i) => near(s[i].out[0].out[0].gain.peak, p));
  assert.ok(ctx.filter('lowpass', 150, before) && ctx.filter('bandpass', 420, before) && ctx.filter('highpass', 1600, before));
});

test('the winch is silent for the moment its clicks are being made', () => {
  const { ctx, sfx, later } = make({ clicksReady: false }), before = ctx.nodes.length;
  sfx.click();
  assert.equal(ctx.nodes.length, before);
  assert.equal(later[0].ms, 60, 'made a moment after the tap that woke the sound');
  later[0].fn();
  sfx.click();
  assert.equal(ctx.of('source', before).length, 1);
});

test("a winch's click is a short struck note, as loud as a sample can be", () => {
  const { ctx, sfx } = make(), before = ctx.nodes.length;
  sfx.click();
  const [s] = ctx.of('source', before), d = s.buffer.getChannelData(0);
  assert.equal(s.loop, false);
  assert.equal(s.buffer.length, Math.floor(ctx.sampleRate * 0.07));
  near(d.reduce((a, x) => Math.max(a, Math.abs(x)), 0), 1);
  assert.ok(Math.abs(d[0]) + Math.abs(d[1]) > Math.abs(d.at(-1)) + Math.abs(d.at(-2)), 'it dies away');
});

test('no two clicks sound quite alike, and each goes where it is told', () => {
  const { ctx, sfx } = make({ bus: buses() }), boat = ctx.nodes[1], other = new Node(ctx, 'other');
  const before = ctx.nodes.length, buffers = new Set();
  for (let i = 0; i < 40; i++) sfx.click(1, 0.2);
  const clicks = ctx.of('source', before);
  for (const s of clicks) {
    buffers.add(s.buffer);
    assert.ok(s.playbackRate.value >= 0.95 && s.playbackRate.value <= 1.05);
    const g = s.out[0].gain.value;
    assert.ok(g >= 0.32 * 0.8 - 1e-9 && g <= 0.32 * 1.1 + 1e-9);
    assert.ok(reaches(s, boat));
  }
  assert.equal(buffers.size, 4);
  const next = ctx.nodes.length;
  sfx.click(0.5, 0, other, 3);
  const [s] = ctx.of('source', next);
  assert.ok(reaches(s, other));
  assert.equal(s.started[0], 3);
});

test('a sheet eased out rasps, as loud as it is asked to be', () => {
  const { ctx, sfx } = make(), before = ctx.nodes.length;
  sfx.ease(0.5);
  const [s] = ctx.of('source', before);
  assert.equal(s.buffer, sfx.pink);
  const f = s.out[0];
  assert.equal(f.type, 'bandpass');
  assert.ok(f.frequency.value >= 1800 && f.frequency.value <= 2800);
  near(f.out[0].gain.peak, 0.14);
  sfx.ease();
  near(ctx.of('source', before)[1].out[0].out[0].gain.peak, 0.28);
});

// ---------- the horn ----------
function blow(args, o = {}) {
  const made = make(o), before = made.ctx.nodes.length;
  made.sfx.horn(...args);
  const reeds = made.ctx.of('osc', before).filter((n) => n.wave);
  const lp = made.ctx.of('filter', before).find((f) => f.type === 'lowpass');
  return { ...made, before, reeds, lp, level: lp?.out[0] };
}

test('a long horn lasts 2.3 s and a short one under a second', () => {
  const long = blow([true, 0]), short = blow([false, 0]);
  near(long.reeds[0].stopped - long.reeds[0].started[0], 2.5);
  near(short.reeds[0].stopped - short.reeds[0].started[0], 1.15);
});

test('a horn is two reeds a little apart, sliding up to pitch, with a vibrato', () => {
  const { reeds, ctx, before } = blow([true, 0]);
  assert.equal(reeds.length, 2);
  const pitch = (o) => o.frequency.events[1][1];
  near(pitch(reeds[1]) / pitch(reeds[0]), 1.0045);
  assert.ok(pitch(reeds[0]) >= 392 * 0.994 && pitch(reeds[0]) <= 392 * 1.006);
  near(reeds[0].frequency.events[0][1] / pitch(reeds[0]), 0.88);
  const vib = ctx.of('osc', before).find((o) => !o.wave);
  assert.ok(vib.frequency.value >= 4.5 && vib.frequency.value <= 6);
  assert.ok(vib.out[0].out.includes(reeds[0].frequency), 'the vibrato bends the pitch of the reeds');
});

test('a horn is heard late, as sound takes a second for 343 m, and from no further than 220 m', () => {
  const at = (d, when = 0) => blow([true, d, 0, when]).reeds[0].started[0];
  near(at(0), 0.02);
  near(at(171.5), 0.52);
  near(at(1000), at(220));
  near(at(0, 3), 3.02, 1e-6, 'a second horn, later');
});

test('a horn further off is quieter, and closer is louder, within limits', () => {
  const peak = (d) => blow([true, d]).level.gain.peak;
  near(peak(110), 0.11);
  near(peak(1000), 0.11 * 0.35);
  near(peak(5), 0.11 * 1.4);
  assert.ok(peak(200) < peak(100));
});

test('a horn further off is duller', () => {
  const f = (d) => blow([true, d]).lp.frequency.value;
  near(f(0), 17000);
  near(f(450), 17000 * Math.exp(-1), 1e-6);
  assert.equal(f(5000), 2200);
});

test('the horn goes to the signals bus, panned towards her, and echoes off the land', () => {
  const { ctx, reeds, before } = blow([true, 120, 1], { bus: buses(0.8) });
  const signals = ctx.nodes[2], [air] = ctx.of('convolver');
  assert.ok(reaches(reeds[0], signals));
  assert.ok(reaches(reeds[0], air));
  near(ctx.of('panner', before)[0].pan.value, 0.8);
});

test('the echo of a horn grows with its distance and goes with the signals volume', () => {
  const echo = (d, level) => {
    const { ctx, level: g } = blow([true, d], { bus: buses(level) }), [air] = ctx.of('convolver');
    return g.out.find((n) => n.out.includes(air)).gain.value;
  };
  near(echo(0, 1), 0.55);
  near(echo(300, 1), 0.8);
  near(echo(900, 1), 0.8);
  near(echo(0, 0.5), 0.275);
});

test('with the signals turned off a horn makes no sound at all, not even its echo', () => {
  const { ctx, before } = blow([true, 100], { bus: buses(0) });
  assert.equal(ctx.nodes.length, before);
});

test('with no buses the horn goes to the master', () => {
  const { reeds, master } = blow([true]);
  assert.ok(reaches(reeds[0], master));
});

test("the horn's reed is brassy, its odd harmonics strongest, and made once for every horn", () => {
  const { ctx, sfx } = make(), before = ctx.nodes.length;
  sfx.horn(true);
  sfx.horn(false);
  const reeds = ctx.of('osc', before).filter((o) => o.wave);
  assert.equal(reeds.length, 4);
  assert.equal(new Set(reeds.map((o) => o.wave)).size, 1);
  const { re, im } = reeds[0].wave;
  assert.deepEqual([re.length, im.length], [25, 25]);
  assert.ok(re.every((x) => x === 0));
  assert.equal(im[0], 0, 'no steady offset');
  near(im[1], 1);
  for (let h = 2; h < 24; h += 2) assert.ok(im[h] < im[h - 1] && im[h] < im[h + 1], `harmonic ${h}`);
});

test("the horn is driven through a curve that is even on both sides and ends at full level", () => {
  const { ctx, before } = blow([true, 100]);
  const [sh] = ctx.of('shaper', before), c = sh.curve;
  assert.equal(sh.oversample, '2x');
  assert.equal(c.length, 1024);
  near(c[0], -1); near(c.at(-1), 1);
  for (let i = 0; i < c.length; i += 97) near(c[i], -c[c.length - 1 - i], 1e-5);
  assert.ok(c[600] > (600 / 1023) * 2 - 1, 'it pushes the middle up: a driven reed');
});

// ---------- the beep ----------
test('the start timer beeps short each second and long in the last three', () => {
  const beepOf = (last) => {
    const m = make({ bus: buses() }), before = m.ctx.nodes.length;
    m.ctx.currentTime = 4;
    m.sfx.beep(last);
    return { ...m, o: m.ctx.of('osc', before)[0] };
  };
  const short = beepOf(false), long = beepOf(true);
  near(short.o.stopped - 4, 0.1);
  near(long.o.stopped - 4, 0.24);
  assert.deepEqual([short.o.type, short.o.frequency.value], ['square', 3150]);
  assert.equal(short.o.started[0], 4);
  assert.ok(reaches(short.o, short.ctx.nodes[2]), 'on the signals bus');
  const g = short.o.out[0].out[0];
  assert.equal(g.gain.peak, 0.16);
  assert.deepEqual(g.gain.events.at(-1).slice(0, 2), ['ramp', 0]);
});
