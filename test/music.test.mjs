// The soundtrack's director (public/game/music.js): what the music does at each moment of a race. Pure, so it runs in Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { createMusic, direct, MUSIC_STYLES, MUSIC_CHOICES, PLAYLIST, SONGS, piece: pieceFor } = await import('../public/game/music.js');

const racing = { clock: 120, done: false, place: 3, fleet: 5, dsq: false, ocs: false, pen: false, zone: false, near: 200, toMark: 300, markLeg: true, lastLeg: false, downwind: false, trend: 0 };
const at = (o) => direct({ ...racing, ...o });

test('four recorded tracks to pick from, Racing first', () => {
  assert.deepEqual(MUSIC_STYLES, ['racing', 'groove', 'riff', 'openwater']);
});

// what music.js says of each track's pieces: { name: [start, [bar lengths]] or [start, length] }
const tracks = () => {
  const src = readFileSync(new URL('../public/game/music.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('const TRACKS = '), src.indexOf('};\nconst ONE_SHOT')) + '}';
  return Function(`return (${body.replace('const TRACKS = ', '')})`)();
};

test('every track has its file and every piece the player asks for', () => {
  const T = tracks();
  assert.deepEqual(Object.keys(T), MUSIC_STYLES);
  for (const [id, t] of Object.entries(T)) {
    readFileSync(new URL(`../public/game/music-${id}.mp3`, import.meta.url));
    for (const n of ['calm', 'drive', 'dark', 'race', 'peak', 'build', 'finale']) assert.ok(t[n][1].length >= 4 && t[n][1].every((l) => l > 1 && l < 3), `${id} ${n}`);
    assert.ok(t.build[1].length > 4, `${id}: bars before the drop`);
    for (const n of ['crash', 'swell', 'hit']) assert.ok(t[n][1] > 0, `${id} ${n}`);
    // the pieces follow one another in the file, none overlapping the next
    const ps = Object.values(t).map(([at, l]) => [at, Array.isArray(l) ? l.reduce((a, b) => a + b, 0) : l]).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < ps.length; i++) assert.ok(ps[i][0] >= ps[i - 1][0] + ps[i - 1][1], `${id}: piece ${i}`);
  }
});

// Each track plays pieces of itself: the quiet part before the start, the groove, the drop when it goes well, its
// loudest part when it's close, the breakdown when it goes wrong
test('a track plays the piece of it that fits the moment', () => {
  const piece = (o) => { const d = at(o); return pieceFor(d.mood, d.int); };
  assert.equal(piece({ clock: -200 }), 'calm');
  assert.equal(piece({ clock: -50 }), 'drive');
  assert.equal(piece({ clock: -5 }), 'peak');
  assert.equal(piece({}), 'drive');
  assert.equal(piece({ downwind: true }), 'race');
  assert.equal(piece({ zone: true }), 'peak');
  assert.equal(piece({ ocs: true }), 'dark');
  assert.equal(piece({ done: true, place: 5 }), 'dark');
  assert.equal(piece({ done: true, place: 1 }), 'calm'); // after the ending, which the win's sting plays
});

test('the pre-start builds: calm, then tense in the last minute, then all in for the last ten seconds', () => {
  const far = at({ clock: -200 }), min = at({ clock: -50 }), ten = at({ clock: -5 });
  assert.equal(far.mood, 'calm');
  assert.equal(min.mood, 'tense');
  assert.equal(ten.mood, 'tense');
  assert.ok(far.int < min.int && min.int < ten.int);
  assert.ok(far.ten < min.ten && min.ten < ten.ten);
  assert.equal(ten.ten, 1);
});

test('upwind alone is calm; downwind is brighter and busier', () => {
  const up = at({}), down = at({ downwind: true });
  assert.equal(up.mood, 'calm');
  assert.equal(down.mood, 'up');
  assert.ok(down.int > up.int);
});

test('a boat close by, the mark near and the last leg each raise the stakes', () => {
  const base = at({ toMark: 500 });
  assert.ok(at({ toMark: 500, near: 20 }).int > base.int);
  assert.ok(at({ toMark: 500, near: 20 }).ten > base.ten);
  assert.ok(at({ toMark: 60 }).int > base.int);
  assert.ok(at({ toMark: 500, lastLeg: true }).ten > base.ten);
});

test('a fight for mark-room is the tensest moment of a leg', () => {
  const z = at({ zone: true });
  assert.equal(z.mood, 'tense');
  assert.ok(z.int >= 0.85 && z.ten >= 0.9);
});

test('a place gained is bright, a place lost is dark', () => {
  assert.equal(at({ trend: 1 }).mood, 'up');
  assert.equal(at({ trend: -1 }).mood, 'dark');
});

test('a penalty, or being over at the start, turns it dark', () => {
  assert.equal(at({ pen: true }).mood, 'dark');
  assert.equal(at({ ocs: true }).mood, 'dark');
});

test('leading the last leg with clear water is a run home', () => {
  assert.equal(at({ lastLeg: true, place: 1, near: 150, toMark: 400 }).mood, 'up');
});

test('the finish: first wins, the top third is glad, the rest and a disqualification are sad', () => {
  assert.equal(at({ done: true, place: 1 }).mood, 'win');
  assert.equal(at({ done: true, place: 2 }).mood, 'up');
  assert.equal(at({ done: true, place: 5 }).mood, 'lose');
  assert.equal(at({ done: true, place: null, dsq: true }).mood, 'lose');
});

test('every answer is in range', () => {
  for (const o of [{}, { clock: -300 }, { clock: -1 }, { zone: true, near: 5, lastLeg: true, toMark: 10 }, { done: true, place: 1 }]) {
    const d = at(o);
    assert.ok(d.int >= 0 && d.int <= 1 && d.ten >= 0 && d.ten <= 1, JSON.stringify(d));
    assert.ok(['calm', 'tense', 'up', 'dark', 'win', 'lose'].includes(d.mood));
  }
});

// ---------- the player, on a clock of our own: what it queues, and so what is heard ----------
async function player(style = 'racing') {
  const clips = [], targets = [];
  const param = (value = 1) => ({ value, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime(v) { targets.push(v); } });
  const node = (more = {}) => ({ connect: (d) => d, disconnect() {}, gain: param(), frequency: param(), Q: param(), threshold: param(), ratio: param(), ...more });
  const ctx = {
    currentTime: 0, sampleRate: 44100, createGain: () => node(), createBiquadFilter: () => node(), createDynamicsCompressor: () => node(),
    createBufferSource() {
      const c = { stopAt: Infinity };
      return node({ playbackRate: param(), start(when, off, dur) { Object.assign(c, { when: Math.max(when, ctx.currentTime), off, dur }); clips.push(c); }, stop(t = ctx.currentTime) { c.stopAt = t; } });
    },
    decodeAudioData(b, ok) { ok({ sampleRate: 44100, getChannelData() { const d = new Float32Array(44100); d[8820] = 1; return d; } }); }, // (the blip at 0.2 s: no shift)
  };
  globalThis.fetch = async () => ({ arrayBuffer: async () => new ArrayBuffer(8) });
  const m = createMusic(ctx, node());
  m.setStyle(style);
  await new Promise((r) => setImmediate(r));
  const run = (until, each) => { while (ctx.currentTime < until) { ctx.currentTime += 1 / 60; each?.(); m.update(); } };
  return { m, ctx, clips, targets, run };
}
// the silence between what was queued, from the first bar up to `to`
const holes = (clips, to) => {
  const iv = clips.map((c) => [c.when, Math.min(c.when + c.dur, c.stopAt)]).filter(([a, b]) => b > a && a < to).sort((a, b) => a[0] - b[0]);
  let reach = iv[0][1], most = 0;
  for (const [a, b] of iv) { most = Math.max(most, a - reach); reach = Math.max(reach, b); }
  return most;
};
const startsPiece = (c, id, name) => Math.abs(c.off + 0.015 - tracks()[id][name][0]) < 0.002; // (a bar's fade begins 15 ms before its line)

test('a stall of the page of up to two seconds leaves no hole in the music, whenever it comes', async () => {
  for (let at = 8; at < 12; at += 0.13) {
    const { ctx, clips, run } = await player();
    run(at); ctx.currentTime += 2; run(at + 10);
    assert.ok(holes(clips, at + 8) < 0.02, `a stall at ${at.toFixed(2)} s: ${holes(clips, at + 8).toFixed(2)} s of silence`);
  }
});

test('a place lost: the dark piece comes in under the tape stopping, with no silence between', async () => {
  const { m, ctx, clips, run } = await player();
  run(10); const t = ctx.currentTime; m.sting('loss'); run(13);
  const dark = clips.find((c) => c.when >= t && startsPiece(c, 'racing', 'dark'));
  assert.ok(dark && dark.when - t < 0.4, `the dark piece ${dark ? (dark.when - t).toFixed(2) : 'never'} s after the tape began to stop`);
});

test('a mood that turns after its phrase line was queued still takes that line', async () => {
  const { m, clips, run } = await player(), T = tracks().racing.calm[1], line = 0.08 + T[0] + T[1] + T[2] + T[3];
  run(line - 3); m.set({ int: 0.3, ten: 0.6, mood: 'dark' });
  run(line - 1); m.set({ int: 0.3, ten: 0.6, mood: 'dark' });
  run(line + 3);
  const dark = clips.find((c) => startsPiece(c, 'racing', 'dark'));
  assert.ok(dark && Math.abs(dark.when + 0.015 - line) < 0.03, `dark at ${dark?.when.toFixed(2)}, the line at ${line.toFixed(2)}`);
});

test('the music stays down through the gaps between a voice’s words', async () => {
  const { m, targets, run } = await player(); let i = 0;
  run(5); targets.length = 0;
  run(8, () => m.voices(Math.floor(i++ / 9) % 2 ? 0 : 0.5)); // words of 150 ms with 150 ms between them
  assert.equal(targets.filter((v) => v === 0.35).length, 1); assert.equal(targets.filter((v) => v === 1).length, 0);
});

test('after the winner’s ending the music goes on without waiting out its silent tail', async () => {
  for (const [id, quiet] of Object.entries({ racing: 0.45, groove: 0.6, openwater: 1.1 })) {
    const { m, ctx, clips, run } = await player(id), T = tracks()[id].finale[1], len = T.reduce((a, b) => a + b, 0);
    run(10); m.sting('win'); const t = ctx.currentTime + 0.05; run(t + len + 3);
    const calm = clips.find((c) => c.when > t + 5 && startsPiece(c, id, 'calm'));
    assert.ok(calm && Math.abs(calm.when - (t + len - quiet)) < 0.1, `${id}: calm ${calm ? (calm.when - t - len).toFixed(2) : 'never'} s from the ending's end`);
  }
});

// the race hub and the free race's set-up loop each track's pre-start (components/race-music.tsx): its start and length there
test('the race screens loop each track’s pre-start where music.js has it', () => {
  const T = tracks();
  const src = readFileSync(new URL('../components/race-music.tsx', import.meta.url), 'utf8');
  const calm = Function(`return (${/export const CALM[^=]*= (\{[\s\S]*?\});/.exec(src)[1]})`)();
  assert.deepEqual(Object.keys(calm), MUSIC_STYLES);
  for (const [id, [at, len]] of Object.entries(calm)) {
    assert.equal(at, T[id].calm[0], `${id} start`);
    assert.ok(Math.abs(len - T[id].calm[1].reduce((a, b) => a + b, 0)) < 1e-3, `${id} length`);
  }
});

// ---------- the playlist: whole songs in rotation, streamed by one audio element ----------
function songPlayer({ stored = null, refuse = false } = {}) {
  const store = new Map(stored === null ? [] : [['regatta-song', String(stored)]]);
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const els = [];
  globalThis.Audio = class {
    paused = true; attr = null; on = {}; duration = 300; currentTime = 0; refuse = refuse;
    constructor() { els.push(this); }
    set src(u) { this.attr = u; this.paused = true; }
    getAttribute() { return this.attr; }
    addEventListener(k, f) { this.on[k] = f; }
    play() { if (this.refuse) return Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })); this.paused = false; this.on.playing?.(); return Promise.resolve(); }
    pause() { this.paused = true; }
  };
  const param = () => ({ value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} });
  const node = () => ({ connect: (d) => d, disconnect() {}, gain: param(), threshold: param(), ratio: param() });
  const ctx = { currentTime: 0, state: 'running', createGain: node, createDynamicsCompressor: node, createMediaElementSource: node };
  const m = createMusic(ctx, node());
  const song = () => SONGS.findIndex((f) => els[0].attr.endsWith(f)) + 1;
  return { m, els, store, song, ctx };
}

test('the playlist is the first choice, and its songs are there, the same in the game and on the site', () => {
  assert.equal(MUSIC_CHOICES[0], PLAYLIST);
  assert.deepEqual(MUSIC_CHOICES.slice(1), MUSIC_STYLES);
  assert.equal(SONGS.length, 3);
  for (const f of SONGS) assert.ok(readFileSync(new URL(`../public/game/${f}`, import.meta.url)).length > 1e6, f);
  const opts = readFileSync(new URL('../lib/opts.ts', import.meta.url), 'utf8');
  assert.deepEqual(Function(`return ${/export const SONGS = (\[.*?\]);/.exec(opts)[1]}`)(), SONGS);
});

test('the songs follow one another and come round again', () => {
  const { m, els, song } = songPlayer();
  m.setStyle(PLAYLIST);
  assert.equal(els.length, 1);
  const heard = [song()];
  for (let i = 0; i < 3; i++) { els[0].on.ended(); heard.push(song()); }
  assert.deepEqual(heard, [1, 2, 3, 1]);
  assert.equal(els.length, 1, 'one element for all of them');
});

test('the next visit starts on the next song', () => {
  const a = songPlayer(); a.m.setStyle(PLAYLIST);
  assert.equal(a.song(), 1); assert.equal(a.store.get('regatta-song'), '1');
  const b = songPlayer({ stored: 2 }); b.m.setStyle(PLAYLIST);
  assert.equal(b.song(), 3); assert.equal(b.store.get('regatta-song'), '0');
});

test('a song the browser refuses waits for the first tap, and the rotation doesn’t move on without it', async () => {
  const { m, els, store } = songPlayer({ refuse: true });
  m.setStyle(PLAYLIST);
  await new Promise((r) => setImmediate(r));
  assert.ok(els[0].paused); assert.equal(store.get('regatta-song'), undefined);
  els[0].refuse = false; m.wake();
  assert.ok(!els[0].paused); assert.equal(store.get('regatta-song'), '1');
});

test('a song that won’t load is skipped, and none loading doesn’t spin', async () => {
  const { m, els, song, ctx } = songPlayer();
  m.setStyle(PLAYLIST);
  els[0].on.error(); assert.equal(song(), 2);
  els[0].on.error(); assert.equal(song(), 3);
  els[0].paused = true; els[0].on.error(); // the third in a row: it stops trying
  let tries = 0; const play = els[0].play; els[0].play = function () { tries++; return play.call(this); };
  ctx.state = 'running'; m.update(); m.update();
  assert.equal(tries, 0);
});

test('paused, the song stops once it has faded; back, it goes on from where it was', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { m, els } = songPlayer();
  m.setStyle(PLAYLIST); els[0].currentTime = 42;
  m.pause(true); assert.ok(!els[0].paused, 'still fading');
  t.mock.timers.tick(1300); assert.ok(els[0].paused);
  m.pause(false); assert.ok(!els[0].paused); assert.equal(els[0].currentTime, 42);
});

test('leaving the playlist for a track stops the song', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  globalThis.fetch = async () => ({ arrayBuffer: async () => new ArrayBuffer(8) });
  const { m, els } = songPlayer();
  m.setStyle(PLAYLIST); m.setStyle(null);
  t.mock.timers.tick(1300); assert.ok(els[0].paused);
});
