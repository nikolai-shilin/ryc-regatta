// Every setting builds the same race on both screens, wherever it is sailed; and whatever is saved or sent as a race's
// settings, or as a saved race, comes out as something the game can use. The venue is read once, from the address, so each
// venue is tried in a process of its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dice, junk, wild, mutate } from './one-on-one-junk.mjs';

globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u))));
const { cleanSettings, Match, raceFor, goodStart } = await import('../public/game/match.js');

const here = { venue: 'palma', yacht: 'jpk1050' };
const CHOICES = { preset: ['medium', 'light', 'strong'], length: ['short', 'medium', 'long'], course: ['wl', 'tri', 'trap', 'wlu'], laps: [1, 2], start: [1, 3, 5], current: [0, 1], daytime: ['any', 'morning', 'midday', 'afternoon', 'evening', 'sunset'] };
const person = (id, name) => ({ id, name, look: null });
const url = (p) => new URL(p, import.meta.url).href;

// One venue: a run through every choice, each race built as each screen builds it, the two compared as they stand, stepped
// alike, and sailed for a while over the hub. Prints what differed.
const child = (venue, yacht, runs) => `
  import { readFile } from 'node:fs/promises';
  globalThis.location = { search: '?venue=${venue}&boat=${yacht}' };
  globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u))));
  const { cleanSettings, Match, raceFor, Host, Guest, makeLink } = await import('${url('../public/game/match.js')}');
  const { controlsOf } = await import('${url('../public/game/wire.js')}');
  const { memoryRealtime } = await import('${url('./hub.mjs')}');
  const { VENUE } = await import('${url('../public/game/venues.js')}'), { CLS } = await import('${url('../public/game/sim.js')}');
  if (VENUE.id !== '${venue}' || CLS.id !== '${yacht}') throw new Error('not the venue or yacht asked for: ' + VENUE.id + ', ' + CLS.id);
  const CHOICES = ${JSON.stringify(CHOICES)}, here = { venue: '${venue}', yacht: '${yacht}' }, out = [], DT = 1 / 60, runs = ${runs};
  const person = (id, name) => ({ id, name, look: null });
  const round = (v) => JSON.parse(JSON.stringify(v, (k, x) => (typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x)));
  // the race as it stands before anything has moved
  const built = (r) => round({ course: r.course, seq: r.seq, clock: r.clock, flags: r.flags, flag: r.prepFlag, at: r.at, startK: r.startK, stream: r.stream, current: r.current, curSide: r.curSide, tidePh: r.tidePh, seed: r.seed, multi: r.multi,
    boats: r.boats.map((b) => ({ id: b.id, name: b.name, x: b.x, z: b.z, h: b.h, v: b.v, sheet: b.sheet, jib: b.jibSheet, small: b.smallJib, trim: b.autoTrim, crew: b.crew, leg: b.leg })),
    wind: r.wind.p, dir: r.wind.dir(), waves: r.waves.map((w) => [w.A, w.dir, w.dx, w.dz]) });
  const points = (r) => { const c = r.course; return [c.pin, c.committee, c.windward, { x: 0, z: -80 }, { x: c.windward.x / 2 + 40, z: c.windward.z / 2 }]; };
  const air = (r) => points(r).map((p) => { const w = r.wind.at(p.x, p.z), s = r.currentAt(p.x, p.z); return [w.dir, w.tws, s.x, s.z]; });
  const differ = (what, a, b, set) => { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) { let i = 0; while (x[i] === y[i]) i++; out.push({ what, set, host: x.slice(Math.max(0, i - 40), i + 40), guest: y.slice(Math.max(0, i - 40), i + 40) }); } };
  for (let i = 0; i < 24; i++) {
    const pick = (k, n) => CHOICES[k][(i * n + (i >> 2)) % CHOICES[k].length];
    const raw = { ...here, preset: pick('preset', 1), length: pick('length', 1), course: pick('course', 1), laps: pick('laps', 1), start: pick('start', 1), current: pick('current', 1), daytime: pick('daytime', 1) };
    const set = cleanSettings(raw, here), seed = 100 + i * 37;
    try {
      // the host's own, and the guest's as it comes over the wire and she repairs it
      const start = { settings: set, seed, host: person('hostid', 'Host'), guest: person('guestid', 'Guest') }, wired = JSON.parse(JSON.stringify(start));
      const pair = () => [raceFor(new Match({ start }), 'hostid'), raceFor(new Match({ start: { ...wired, settings: cleanSettings(wired.settings, here) } }), 'guestid')];
      const [a, b] = pair();
      differ('as built', built(a), built(b), raw);
      if (runs !== !!VENUE.runs) out.push({ what: 'the river test is at a river', set: raw });
      if (a.player.id !== 'hostid' || b.player.id !== 'guestid') out.push({ what: 'whose boat', set: raw });
      if (a.seq[0].t !== -60 * raw.start) out.push({ what: 'the sequence', set: raw });
      if (VENUE.runs && !(Math.hypot(a.current.x, a.current.z) > 0)) out.push({ what: 'a river runs whatever the setting', set: raw });
      if (!VENUE.runs && !raw.current && (a.current.x || a.current.z)) out.push({ what: 'no current was asked for', set: raw });
      for (let n = 0; n < 300; n++) { a.advance(DT); b.advance(DT); }
      differ('wind and current stepped alike', round(air(a)), round(air(b)), raw);
      // sailed over the hub, as the two screens sail it
      const clock = { t: 1e6 }, now = () => clock.t, rt = memoryRealtime(), [hr, gr] = pair();
      const hl = makeLink(rt, 'SET222'), gl = makeLink(rt, 'SET222');
      await hl.all.join(); await gl.all.join();
      const H = new Host({ race: hr, link: hl, guestId: 'guestid', now }), G = new Guest({ race: gr, link: gl, me: 'guestid', now });
      await H.joined; await G.joined;
      for (let n = 0; n < 420; n++) { clock.t += 1000 * DT; H.tick(DT); hr.messages.length = 0; G.input(controlsOf(G.me)); G.frame(DT); gr.messages.length = 0; }
      if (Math.abs(hr.t - gr.t) > 0.1) out.push({ what: 'the time of the race', set: raw, host: hr.t, guest: gr.t });
      const [p, q] = [air(hr), air(gr)];
      p.forEach((row, k) => row.forEach((v, j) => { if (Math.abs(v - q[k][j]) > [0.01, 0.1, 0.01, 0.01][j]) out.push({ what: 'wind or current on the water, ' + j, set: raw, host: v, guest: q[k][j] }); }));
      differ('the boats\\' order', hr.boats.map((b) => b.id), gr.boats.map((b) => b.id), raw);
      H.stop(); G.stop();
    } catch (e) { out.push({ what: 'threw', set: raw, error: String(e.stack) }); }
  }
  console.log(JSON.stringify(out));`;

// (the sea, a river that always runs, a strait, a tide, a lake; the JPK and a big class, whose course is laid to her size)
for (const [venue, yacht, what, runs] of [['palma', 'jpk1050', 'the open sea', false], ['st-petersburg', 'jpk1050', 'a river', true], ['istanbul', 'jpk1050', 'a strait', true], ['cowes', 'jclass', 'a tide, in a bigger class', false], ['garda', 'optimist', 'a lake, in the smallest', false]]) {
  test(`every setting builds the same race on both screens: ${what} (${venue})`, async () => {
    const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', child(venue, yacht, runs)], { maxBuffer: 1e7 });
    assert.deepEqual(JSON.parse(stdout), []);
  });
}

// ---------- whatever is saved or sent ----------
function assertSettings(o) {
  assert.deepEqual(Object.keys(o).sort(), ['course', 'current', 'daytime', 'laps', 'length', 'preset', 'start', 'venue', 'yacht']);
  for (const [k, list] of Object.entries(CHOICES)) assert.ok(list.includes(o[k]), `${k}: ${String(o[k])}`);
  for (const k of ['venue', 'yacht']) assert.ok(typeof o[k] === 'string' && o[k].length > 0 && o[k].length <= 64, `${k}: ${String(o[k]).slice(0, 80)}`);
}
for (const seed of [3, 2026]) {
  test(`cleanSettings: any junk at all gives settings the game can sail, the same again on the other screen (junk seed ${seed})`, () => {
    const g = dice(seed);
    for (let i = 0; i < 3000; i++) {
      const s = g.int(3) ? Object.fromEntries(Object.keys({ ...CHOICES, ...here }).filter(() => g.int(2)).map((k) => [k, wild(g)])) : wild(g);
      let o;
      try { o = cleanSettings(s, here); } catch (e) { assert.fail(`junk seed ${seed}, try ${i}: ${e.stack}`); }
      assertSettings(o);
      assert.deepEqual(cleanSettings(JSON.parse(JSON.stringify(o)), here), o, 'what the host sends, the guest keeps');
    }
  });
}

test('cleanSettings keeps every good choice as it is', () => {
  for (const [k, list] of Object.entries(CHOICES)) for (const v of list) assert.equal(cleanSettings({ [k]: v }, here)[k], v);
  assert.equal(cleanSettings({ venue: 'garda', yacht: 'ac75' }, here).venue, 'garda');
  assert.equal(cleanSettings({ venue: 'garda', yacht: 'ac75' }, here).yacht, 'ac75');
  assert.equal(cleanSettings({ laps: '2', current: true }, here).laps, 2, 'a number saved as text');
  assert.equal(cleanSettings({ laps: '2', current: true }, here).current, 1);
  for (const bad of [{ toString: 1 }, { valueOf: 1, toString: 1 }, ['palma'], 7, true, '']) assert.equal(cleanSettings({ venue: bad }, here).venue, 'palma', `venue ${JSON.stringify(bad)}`);
  assert.equal(cleanSettings({ laps: { valueOf: 1, toString: 1 }, start: [3] }, here).laps, 1);
  assert.equal(cleanSettings({ start: [3] }, here).start, 1, 'an array is no number');
});

test('junk settings repaired on both screens build the same race', () => {
  const g = dice(99);
  for (let i = 0; i < 12; i++) {
    const s = Object.fromEntries(Object.keys(CHOICES).map((k) => [k, g.int(2) ? junk(g) : g.pick(CHOICES[k])])), set = cleanSettings(s, here), seed = 500 + i;
    const start = { settings: set, seed, host: person('h', 'Host'), guest: person('g', 'Guest') };
    const a = raceFor(new Match({ start }), 'h'), b = raceFor(new Match({ start: { ...start, settings: cleanSettings(JSON.parse(JSON.stringify(set)), here) } }), 'g');
    assert.deepEqual(JSON.parse(JSON.stringify(b.course)), JSON.parse(JSON.stringify(a.course)));
    assert.deepEqual(b.boats.map((x) => [x.id, x.x, x.z, x.h]), a.boats.map((x) => [x.id, x.x, x.z, x.h]));
  }
});

const START = { settings: { ...here, preset: 'medium' }, seed: 4242, host: person('h', 'Host'), guest: person('g', 'Guest') };
const SAVED = { start: START, state: 'over', result: { winner: 'g', margin: 3.5, forfeited: null, abandoned: false, marks: { h: 'DSQ' } }, leftBy: 'h' };
function assertMatch(m, ctx) {
  if (m === null) return;
  assert.ok(m instanceof Match, ctx);
  assert.ok(goodStart(m.start), ctx);
  assert.equal(m.state, 'over', ctx);
  const r = m.result, ids = [m.hostId, m.guestId];
  assert.equal(typeof r.abandoned, 'boolean', ctx);
  for (const v of [r.winner, r.forfeited]) assert.ok(v === null || ids.includes(v), ctx);
  assert.ok(r.margin === null || Number.isFinite(r.margin), ctx);
  assert.ok(m.leftBy === null || ids.includes(m.leftBy), ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(Match.from(m.toJSON()))), JSON.parse(JSON.stringify(m)), `${ctx}: saved and opened again, the same`);
}
for (const seed of [8, 1118]) {
  test(`Match.from: any junk at all opens as a race over, or as no race, and never throws (junk seed ${seed})`, () => {
    const g = dice(seed);
    let raced = 0;
    for (let i = 0; i < 3000; i++) {
      const j = [() => wild(g), () => ({ start: wild(g) }), () => mutate(SAVED, g), () => ({ ...SAVED, [g.pick(['state', 'result', 'leftBy'])]: wild(g) }), () => ({ ...SAVED, result: mutate(SAVED.result, g) })][g.int(5)]();
      let m;
      try { m = Match.from(j); } catch (e) { assert.fail(`junk seed ${seed}, try ${i}: ${e.stack}`); }
      assertMatch(m, `junk seed ${seed}, try ${i}`);
      if (m) raced++;
    }
    assert.ok(raced > 500, `${raced} of them were still a race`);
  });
}

test('Match.from keeps a race sailed to its end, and opens one still on the water as abandoned', () => {
  const m = Match.from(SAVED);
  assert.deepEqual(m.result, SAVED.result, 'the winner, the margin and the marks');
  assert.equal(m.leftBy, 'h');
  const on = Match.from({ ...SAVED, state: 'race', result: null });
  assert.equal(on.result.abandoned, true);
  for (const nothing of [null, undefined, 7, 'x', [], {}, { start: {} }, { start: { ...START, seed: 'x' } }, { start: { ...START, host: null } }, { start: { ...START, guest: { id: 'h' } } }]) assert.equal(Match.from(nothing), null, JSON.stringify(nothing));
  assert.equal(Match.from({ ...SAVED, result: { ...SAVED.result, margin: 'x' } }).result.abandoned, true, 'a result that can\'t be read is no result');
  const round = {}; round.me = round;
  assert.equal(Match.from(round), null, 'what can\'t be read at all');
});
