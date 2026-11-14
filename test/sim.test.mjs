// The game's race, run headless in Node: npm test. The sim (public/game/sim.js) has no three.js in it; its one outside
// need is land.js fetching the bay's files, which is answered here from the disk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u))));
const sim = await import('../public/game/sim.js');
const site = await import('../lib/race.ts');
// the beat (start to windward mark) in each wind, as sim.js Race and api/game.mjs have it; and the server's floor (below)
const BEAT = { light: 200, medium: 260, strong: 280 }, FLOOR = 0.45;

// lib/race.ts is a copy of the game's dailyRace for the hub and Home: the same day must give the same race
test('the site and the game agree on today’s race, every day for a year and more', () => {
  const from = Date.UTC(2026, 0, 1);
  for (let d = 0; d < 546; d++) { // to 2027-06-30
    const day = new Date(from + d * 864e5);
    assert.deepEqual(site.dailyRace(day), sim.dailyRace(day), day.toISOString().slice(0, 10));
  }
});

// the shapes arrive on SHAPES_FROM; the wind, current and venue of every day were fixed before, and stay so
test('today’s wind and current don’t move', async () => {
  const before = JSON.parse(await readFile(new URL('./fixtures/daily-before.json', import.meta.url)));
  assert.equal(before.length, 546);
  for (const want of before) {
    const { day, seed, preset, current, venue } = sim.dailyRace(new Date(want.day));
    assert.deepEqual({ day, seed, preset, current, venue }, want, want.day);
  }
});

test('before SHAPES_FROM every day is up and down', () => {
  assert.equal(sim.SHAPES_FROM, '2026-11-20');
  assert.equal(site.SHAPES_FROM, sim.SHAPES_FROM);
  for (let t = Date.UTC(2026, 0, 1); t < Date.parse(sim.SHAPES_FROM); t += 864e5) assert.equal(sim.dailyRace(new Date(t)).course, 'wl');
});

test('the shapes come round in about the weights', () => {
  const count = { wl: 0, tri: 0, trap: 0, wlu: 0 }, from = Date.parse(sim.SHAPES_FROM);
  for (let d = 0; d < 365; d++) count[sim.dailyRace(new Date(from + d * 864e5)).course]++;
  assert.ok(count.wl / 365 >= 0.3 && count.wl / 365 <= 0.5, JSON.stringify(count));
  for (const k of ['tri', 'trap', 'wlu']) assert.ok(count[k] / 365 >= 0.12 && count[k] / 365 <= 0.28, JSON.stringify(count));
});

// today's venue: every venue in turn, never the same two days running; and the play page's preloader (an inline copy
// in public/play/index.html) fetches the same venue's land as the game then asks for
test('today’s race goes round the venues, and the play page preloads the day’s', async () => {
  const { ROUNDS, dailyVenue, landFiles, venueById } = await import('../public/game/venues.js');
  const html = await readFile(new URL('../public/play/index.html', import.meta.url), 'utf8');
  const script = html.match(/<script>(\(function \(\) \{ var v = 'gocek';[\s\S]*?)<\/script>/)[1];
  const { runInNewContext } = await import('node:vm');
  const from = Date.UTC(2026, 0, 1);
  let prev = null;
  for (let d = 0; d < 400; d++) {
    const now = from + d * 864e5, day = new Date(now), v = dailyVenue(day);
    assert.notEqual(v, prev, `${day.toISOString().slice(0, 10)}: not yesterday’s venue`); prev = v;
    // a round: the days are counted in rounds of the venues there are, from 1970 or from the day the last one joined
    const n = Math.floor(now / 864e5), e = ROUNDS.findLastIndex((r) => n >= r.n0), { n0, ids } = ROUNDS[e], len = ids.length;
    if ((n - n0) % len === 0 && !(ROUNDS[e + 1] && n + len > ROUNDS[e + 1].n0)) {
      const round = new Set(Array.from({ length: len }, (_, i) => dailyVenue(new Date(now + i * 864e5))));
      assert.ok(round.size >= len - 2, 'every venue comes round');
      if (n0 > 0) assert.equal(round.size, len, 'all of them, the new one among them');
    }
    const links = [];
    class FakeDate extends Date { constructor(...a) { super(...(a.length ? a : [now])); } }
    FakeDate.parse = Date.parse;
    runInNewContext(script, {
      Date: FakeDate, Math, JSON, URLSearchParams, location: { search: '?race=today' }, localStorage: { getItem: () => null },
      document: { createElement: () => ({}), head: { appendChild: (l) => links.push(l.href) } },
    });
    assert.deepEqual(links.sort(), landFiles(venueById(v)).map((f) => '/game/' + f).sort(), day.toISOString().slice(0, 10));
  }
});

test('the site’s course numbers are the game’s', () => {
  assert.deepEqual(site.COURSE_LEN, sim.COURSE_LEN);
  assert.deepEqual(site.BEAT_LEN, BEAT);
});

// the course as a set of rounding marks keyed by leg, with what each leg is: a beat into the windward mark, a reach
// to the wing; the triangle's finish is the start line (null)
test('the course lists its marks and legs', () => {
  const c = sim.makeCourse(2, 260, 0, 5, 'tri');
  assert.deepEqual(Object.keys(c.marks), ['mark', 'wing']);
  assert.deepEqual(c.legInfo.map((l) => l.beat), [false, true, false, false, true, false, false]);
  assert.equal(c.finish, null);
  assert.equal(sim.legAim(c, c.legs.indexOf('gate')).x, (c.gate[0].x + c.gate[1].x) / 2);
  // a zone (mark-room) at the gate and the wing, none at the windward mark; the beats are the legs up to it
  const at = (k) => c.legs.indexOf(k);
  assert.equal(sim.hasZone(c, at('gate')), true);
  assert.equal(sim.hasZone(c, at('wing')), true);
  assert.equal(sim.hasZone(c, at('mark')), false);
  assert.deepEqual(c.legs.map((_, i) => sim.isBeat(c, i)), c.legs.map((k) => k === 'mark'));
  assert.deepEqual(sim.legTargets(c, at('start')), [c.pin, c.committee]);
  assert.deepEqual(sim.legTargets(c, at('gate')), [c.gate[0], c.gate[1]]);
});

// the new shapes, laid for each wind's beat with the line square: the angles off the wind (from −z) of their legs
const offWind = (p, q) => Math.acos(-(q.z - p.z) / Math.hypot(q.x - p.x, q.z - p.z)) / sim.D2R;
const mid = (a, b) => ({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
test('the trapezoid is laid as the spec says', () => {
  for (const preset of ['light', 'medium', 'strong']) {
    const c = sim.makeCourse(1, BEAT[preset] * sim.COURSE_LEN.short, 0, 5, 'trap'), { mark, mark2 } = c.marks;
    const g = mid(...c.gate), f = mid(c.finish.a, c.finish.b), reach = offWind(mark, mark2), home = offWind(g, f);
    assert.ok(reach >= 110 && reach <= 120, `${preset}: the reach to mark 2 is ${reach.toFixed(1)}° off the wind`);
    assert.ok(mark2.x < mark.x && mark2.z > mark.z, `${preset}: mark 2 is out to the left, below mark 1`);
    assert.ok(Math.abs(g.x - mark2.x) < 1, `${preset}: the gate is straight down the run from mark 2`);
    assert.ok(home >= 80 && home <= 100, `${preset}: the reach home is ${home.toFixed(1)}° off the wind`);
    assert.ok(c.finish.through.x > 0.99, `${preset}: the finish is crossed going right`);
    assert.deepEqual(c.legs, ['start', 'mark', 'mark2', 'gate', 'finish']);
  }
  // each lap after the first beats back up to mark 2 and runs down again
  const c = sim.makeCourse(2, 260, 0, 5, 'trap');
  assert.deepEqual(c.legs, ['start', 'mark', 'mark2', 'gate', 'mark2', 'gate', 'finish']);
  assert.deepEqual(c.legs.map((_, i) => sim.isBeat(c, i)), [false, true, false, false, true, false, false]);
  assert.deepEqual(c.legs.map((_, i) => sim.hasZone(c, i)), [false, false, true, true, false, true, false]);
});
test('the upwind finish is laid as the spec says', () => {
  for (const preset of ['light', 'medium', 'strong']) {
    const c = sim.makeCourse(1, BEAT[preset] * sim.COURSE_LEN.short, 0, 5, 'wlu'), w = c.windward, o = c.marks.offset;
    const f = mid(c.finish.a, c.finish.b);
    assert.ok(o.x - w.x >= -60 && o.x - w.x <= -50, `${preset}: the offset mark is ${(o.x - w.x).toFixed(1)} m across`);
    assert.ok(o.z - w.z >= 0 && o.z - w.z <= 20, `${preset}: the offset mark is ${(o.z - w.z).toFixed(1)} m below`);
    assert.ok(f.x > w.x && f.z > w.z, `${preset}: the finish is below and to the right of the windward mark`);
    assert.ok(c.finish.through.z < -0.99, `${preset}: the finish is crossed going upwind`);
    const up = offWind(mid(...c.gate), f); // the last leg is a beat: the finish lies close to dead upwind of the gate
    assert.ok(up <= 15, `${preset}: the finish is ${up.toFixed(1)}° off dead upwind from the gate`);
    assert.deepEqual(c.legs, ['start', 'mark', 'offset', 'gate', 'finish']);
    assert.deepEqual(c.legs.map((_, i) => sim.isBeat(c, i)), [false, true, false, false, true]);
    assert.deepEqual(c.legs.map((_, i) => sim.hasZone(c, i)), [false, false, true, true, false]);
  }
});
// the trapezoid's finish line lies out to the left of the start: in any fleet, any wind and either skew of the line,
// its ends and its committee boat are well outside the first beat's left side (the starboard layline from the pin)
test('the trapezoid’s finish is clear of the start and the first beat', () => {
  for (const preset of ['light', 'medium', 'strong']) for (let fleet = 5; fleet <= 10; fleet++) for (const bias of [-8, 8]) {
    const c = sim.makeCourse(1, BEAT[preset], bias * sim.D2R, fleet, 'trap'), p = c.pin, beat = sim.beatAngle(sim.PRESETS[preset].tws) * sim.D2R;
    for (const [name, q] of [['pin', c.finish.a], ['boat end', c.finish.b], ['committee boat', c.finishBoat]]) {
      // how far outside the layline: left of it and below, + (it runs up to the left from the pin, close-hauled)
      const out = -(q.x - p.x) * Math.cos(beat) + (q.z - p.z) * Math.sin(beat);
      assert.ok(out >= 30, `${preset}, fleet ${fleet}, bias ${bias}°: the finish ${name} is ${out.toFixed(1)} m outside the layline`);
    }
  }
});
// each finish line's committee boat lies beyond its right-hand end, as the start's does; none on the start line's finish
test('a finish line of its own has its committee boat', () => {
  for (const type of ['trap', 'wlu']) {
    const c = sim.makeCourse(1, 260, 0, 5, type), { a, b } = c.finish, fb = c.finishBoat;
    assert.ok(Math.abs(Math.hypot(fb.x - b.x, fb.z - b.z) - 5) < 0.01 && Math.hypot(fb.x - a.x, fb.z - a.z) > Math.hypot(b.x - a.x, b.z - a.z), type);
    assert.ok((b.x - a.x) * -c.finish.through.z + (b.z - a.z) * c.finish.through.x > 0, `${type}: the boat end is on the right, crossing`);
  }
  for (const type of ['wl', 'tri']) assert.equal(sim.makeCourse(1, 260, 0, 5, type).finishBoat, null);
});
test('an unknown course is up and down', () => {
  for (const course of ['trap', 'wlu', 'tri', 'wl']) assert.equal(new sim.Race({ course, seed: 3 }).course.type, course);
  assert.equal(new sim.Race({ course: 'zigzag', seed: 3 }).course.type, 'wl');
});
// a length the venue doesn't offer at all is sailed at the longest it has
test('a skipped length is sailed at the longest the venue has', async () => {
  const { VENUE, laidLength } = await import('../public/game/venues.js'), was = VENUE.skip;
  VENUE.skip = ['long'];
  try {
    assert.equal(laidLength(VENUE, 'long'), 'medium');
    assert.equal(laidLength(VENUE, 'medium'), 'medium');
    const a = new sim.Race({ preset: 'medium', length: 'long', seed: 3 }), b = new sim.Race({ preset: 'medium', length: 'medium', seed: 3 });
    assert.equal(a.course.windward.z, b.course.windward.z);
  } finally { VENUE.skip = was; }
});
// a shape the venue doesn't offer at that length (its `skip` list) is sailed as up and down; at other lengths it isn't
test('a skipped shape falls back to up and down', async () => {
  const { VENUE } = await import('../public/game/venues.js'), was = VENUE.skip;
  VENUE.skip = ['trap:long'];
  try {
    assert.equal(new sim.Race({ course: 'trap', length: 'long', seed: 3 }).course.type, 'wl');
    assert.equal(new sim.Race({ course: 'trap', length: 'medium', seed: 3 }).course.type, 'trap');
    assert.equal(new sim.Race({ course: 'wlu', length: 'long', seed: 3 }).course.type, 'wlu');
  } finally { VENUE.skip = was; }
});

// sail a race to the end with only the computer boats racing; their finishing times. onLeg(i, leg): the i-th computer
// boat has just begun leg `leg`
function sail(opts, onLeg) {
  const r = new sim.Race(opts), others = r.boats.filter((b) => b !== r.player), at = others.map((b) => b.leg);
  for (let n = 0; n < 60 * 60 * 40 && !others.every((b) => b.done); n++) {
    r.step(1 / 60);
    if (onLeg) others.forEach((b, i) => { if (b.leg !== at[i]) onLeg(i, (at[i] = b.leg)); });
  }
  return others.map((b) => (b.done && !b.dsq ? Math.round(b.finish * 10) / 10 : null));
}

test('the same seed sails the same race', () => {
  const opts = { preset: 'medium', length: 'short', laps: 1, fleet: 5, seed: 4242 };
  assert.deepEqual(sail(opts), sail(opts));
});

// The scores server (api/game.mjs in the iyt-test repo) keeps no time under FLOOR seconds a metre of beat a lap:
// half of what the computer boats take, so that no one sailing the game well is ever turned away. Keep the two in step.
for (const preset of ['light', 'medium', 'strong']) {
  test(`the computer boats in ${preset} wind finish well above the server's floor`, () => {
    const times = sail({ preset, length: 'short', laps: 1, fleet: 5, seed: 11 }).filter((x) => x != null);
    assert.ok(times.length >= 3, 'most of the fleet finishes');
    const floor = FLOOR * BEAT[preset] * sim.COURSE_LEN.short;
    assert.ok(Math.min(...times) > floor * 1.5, `fastest ${Math.min(...times)} s, floor ${floor} s`);
  });
}

// The new shapes, sailed headless by the computer boats: one lap in every wind, and two laps in strong wind (the
// trapezoid's re-beat from the gate to mark 2 and the repeated laps; strong wind is where the fastest time comes
// nearest the floor), each race sailed once, for both tests. Every boat that finishes went round every mark in turn,
// and well above the server's floor.
const shapeRuns = new Map();
function shapeRun(course, preset, laps) {
  const key = `${course} ${preset} ${laps}`, opts = { course, preset, laps, length: 'short', fleet: 5, seed: 11 };
  if (!shapeRuns.has(key)) {
    const seen = [], times = sail(opts, (i, leg) => (seen[i] ||= []).push(leg));
    shapeRuns.set(key, { times, seen, legs: new sim.Race(opts).course.legs });
  }
  return shapeRuns.get(key);
}
const LEGS = {
  trap: (laps) => ['start', 'mark', 'mark2', 'gate', ...Array.from({ length: laps - 1 }, () => ['mark2', 'gate']).flat(), 'finish'],
  wlu: (laps) => ['start', ...Array.from({ length: laps }, () => ['mark', 'offset', 'gate']).flat(), 'finish'],
};
for (const course of ['trap', 'wlu']) for (const [preset, laps] of [['light', 1], ['medium', 1], ['strong', 1], ['strong', 2]]) {
  test(`${course} ${preset} ${laps}: the computer boats sail every leg in order`, () => {
    const { times, seen, legs } = shapeRun(course, preset, laps);
    assert.deepEqual(legs, LEGS[course](laps));
    assert.ok(times.filter((x) => x != null).length >= 3, `only ${times.filter((x) => x != null).length} finished`);
    times.forEach((x, i) => { if (x != null) assert.deepEqual(seen[i], legs.map((_, j) => j).slice(1), `boat ${i}`); });
  });
  test(`${course} ${preset} ${laps}: the computer boats finish well above the server's floor`, () => {
    const times = shapeRun(course, preset, laps).times.filter((x) => x != null), floor = FLOOR * BEAT[preset] * sim.COURSE_LEN.short * laps;
    assert.ok(times.length >= 3, 'most of the fleet finishes');
    assert.ok(Math.min(...times) > floor * 1.5, `fastest ${Math.min(...times)} s, floor ${floor} s`);
  });
}

// the upwind finish lies just by the windward mark, so a boat beating up to the mark can sail across it: that's not a
// finish. On her last leg the same crossing is one, between its ends and going upwind only.
test('the upwind finish line doesn’t finish a boat before her last leg', () => {
  const r = new sim.Race({ course: 'wlu', preset: 'medium', fleet: 5, seed: 11, laps: 2 }), c = r.course, b = r.player, f = c.finish;
  r.clock = 30;
  const across = (leg, x, dz) => { // from 10 m on one side of the line to 10 m on the other
    Object.assign(b, { leg, done: false, lastF: undefined });
    for (let s = -10; s <= 10; s++) { b.x = x; b.z = f.a.z + dz * s; r.progress(b); }
  };
  const fx = (f.a.x + f.b.x) / 2;
  across(c.legs.indexOf('mark'), fx, -1);
  assert.equal(b.done, false, 'beating up to the windward mark');
  assert.equal(b.leg, c.legs.indexOf('mark'));
  across(c.legs.lastIndexOf('mark'), fx, -1);
  assert.equal(b.done, false, 'beating up to the windward mark on the last lap');
  across(c.legs.indexOf('finish'), Math.min(f.a.x, f.b.x) - 8, -1);
  assert.equal(b.done, false, 'outside the line’s pin end');
  across(c.legs.indexOf('finish'), Math.max(f.a.x, f.b.x) + 8, -1);
  assert.equal(b.done, false, 'outside the line’s boat end');
  across(c.legs.indexOf('finish'), fx, 1);
  assert.equal(b.done, false, 'crossing it downwind');
  across(c.legs.indexOf('finish'), fx, -1);
  assert.equal(b.done, true, 'up across it on her last leg');
});

// a finish line of its own is a mark of the last leg only: brushing its pin or its committee boat on the way up to
// the windward mark is no foul, on the finish leg it is (rule 31); the windward mark itself is a mark all along
test('the upwind finish’s pin and boat are marks only on the finish leg', () => {
  const r = new sim.Race({ course: 'wlu', preset: 'medium', fleet: 5, seed: 11 }), c = r.course, b = r.player;
  r.clock = 30;
  const touch = (leg, m) => { Object.assign(b, { leg, pen: null, touchT: 0, done: false, x: m.x + 1, z: m.z, h: 0 }); r.collide(1 / 60); return !!b.pen; };
  const mark = c.legs.indexOf('mark'), fin = c.legs.indexOf('finish');
  assert.equal(touch(mark, c.finish.a), false, 'the finish pin, beating up to the windward mark');
  assert.equal(touch(mark, c.finishBoat), false, 'the finish boat, beating up to the windward mark');
  assert.equal(touch(fin, c.finish.a), true, 'the finish pin, on the finish leg');
  assert.equal(touch(fin, c.finishBoat), true, 'the finish boat, on the finish leg');
  assert.equal(touch(mark, c.windward), true, 'the windward mark');
});

// Trapezoid mark 2 is rounded twice: from the reach on the first lap, and from the beat after. Each time, circling it
// the wrong way or sailing past it on the wrong side doesn't count; rounding it to port does.
test('trapezoid mark 2 counts only when rounded to port', () => {
  const r = new sim.Race({ course: 'trap', preset: 'medium', fleet: 5, seed: 11, laps: 2 }), c = r.course, b = r.player, m = c.marks.mark2;
  r.clock = 30;
  for (const leg of [2, 4]) {
    assert.equal(c.legs[leg], 'mark2');
    // o: the mark's outside on this leg (upwind, by her wind, after the beat), p: square to it, to its right looking out
    const o = c.legInfo[leg].out || { x: Math.sin(b.wdir), z: -Math.cos(b.wdir) }, p = { x: -o.z, z: o.x };
    const sailPath = (pts) => { Object.assign(b, { leg, rnd: null }); for (const [fp, fo] of pts) { b.x = m.x + p.x * fp + o.x * fo; b.z = m.z + p.z * fp + o.z * fo; r.progress(b); } };
    const circle = (from, to) => Array.from({ length: Math.abs(to - from) / 5 + 1 }, (_, i) => (from + Math.sign(to - from) * 5 * i) * sim.D2R).map((a) => [15 * Math.cos(a), 15 * Math.sin(a)]);
    sailPath(circle(0, -540)); // one and a half times round it clockwise, from its right
    assert.equal(b.leg, leg, `leg ${leg}: circled clockwise`);
    sailPath(Array.from({ length: 25 }, (_, i) => [-15, -60 + 5 * i])); // straight past it, leaving it to starboard
    assert.equal(b.leg, leg, `leg ${leg}: past it on the wrong side`);
    r.messages.length = 0;
    sailPath(circle(-60, 200)); // round it to port: up its right side, across outside it, away on its left
    assert.equal(b.leg, leg + 1, `leg ${leg}: rounded to port`);
    assert.ok(r.messages.some((x) => x.key === 'roundedMark2'), 'the player hears it');
  }
});

// The venues a free race can go to (public/game/venues.js; the set-up page's list is lib/venues.ts). Each one's land,
// baked by blender/venues.py, must be there, at the venue's own position and turned to its wind; and every course,
// in every shape the venue offers at each length and in every wind, must be laid with its marks, gate, line and
// finish line well clear of the shore. Each venue is sailed in a Node of its own, since
// the game picks its venue once, from the address, as the page loads.
test('the set-up page lists the game’s venues', async () => {
  const { VENUES } = await import('../public/game/venues.js');
  const page = await readFile(new URL('../lib/venues.ts', import.meta.url), 'utf8');
  assert.deepEqual([...page.matchAll(/\{ id: '([a-z-]+)', name: \['([^']+)', '([^']+)'\]/g)].map((m) => [m[1], m[2], m[3]]), VENUES.map((v) => [v.id, ...v.name]));
});
// the shapes a venue doesn't offer at some length: the same list on the set-up page as in the game
test('the set-up page’s skip lists are the game’s', async () => {
  const { VENUES } = await import('../public/game/venues.js');
  const page = await readFile(new URL('../lib/venues.ts', import.meta.url), 'utf8');
  const skips = [...page.matchAll(/\{ id: '([a-z-]+)',(.*)/g)].map((m) => [m[1], [...(m[2].match(/skip: \[([^\]]*)\]/)?.[1] || '').matchAll(/'([^']+)'/g)].map((s) => s[1])]);
  assert.deepEqual(skips, VENUES.map((v) => [v.id, v.skip || []]));
});
// today's race goes to every venue on the short course, in any shape: none may be skipped there
test('no venue skips a shape on the short course', async () => {
  const { VENUES, shapeOffered, lengthOffered } = await import('../public/game/venues.js');
  for (const v of VENUES) for (const shape of sim.SHAPES) assert.ok(shapeOffered(v, shape, 'short'), `${v.id}: ${shape}`);
  for (const v of VENUES) assert.ok(lengthOffered(v, 'short'), `${v.id}: the short course`);
});

const { execFileSync } = await import('node:child_process');
const { VENUES } = await import('../public/game/venues.js');
for (const v of VENUES) {
  test(`${v.name[0]}: the land is baked, and every course is laid in clear water`, () => {
    const code = `
      import { readFile } from 'node:fs/promises';
      globalThis.location = { search: '?venue=${v.id}' };
      globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u))));
      const sim = await import(${JSON.stringify(new URL('../public/game/sim.js', import.meta.url).href)});
      const { SKOPEA, MESH } = await import(${JSON.stringify(new URL('../public/game/land.js', import.meta.url).href)});
      const { VENUE, shapeOffered, lengthOffered } = await import(${JSON.stringify(new URL('../public/game/venues.js', import.meta.url).href)});
      let worst = Infinity, where = '', under = '';
      // the bridges too low for a mast: no two of a course's marks on either side of one
      const low = (SKOPEA.meta.landmarks || []).filter((l) => l.a && l.b && (l.deck ?? Infinity) < 25);
      const side = (p, q, w) => Math.sign((q[0] - p[0]) * (w[1] - p[1]) - (q[1] - p[1]) * (w[0] - p[0]));
      const across = (p, q, a, b) => side(p, q, a) * side(p, q, b) < 0 && side(a, b, p) * side(a, b, q) < 0;
      for (const preset of ['light', 'medium', 'strong']) for (const length of ['short', 'medium', 'long']) for (const course of sim.SHAPES) {
        if (!shapeOffered(VENUE, course, length) || !lengthOffered(VENUE, length)) continue;
        const r = new sim.Race({ preset, length, course, fleet: 7, laps: 1, seed: 1 }), c = r.course;
        const f = c.finish ? [c.finish.a, c.finish.b, c.finishBoat] : [];
        const ms = [...Object.values(c.marks), ...c.gate, c.pin, c.committee, ...f];
        for (const m of ms) {
          const room = r.roomAt(m.x, m.z);
          if (room < worst) { worst = room; where = course + ' ' + preset + ' ' + length; }
        }
        const xz = ms.map((m) => [m.x + r.at.x, m.z + r.at.z]);
        for (const l of low) for (const p of xz) for (const q of xz) if (across(p, q, l.a, l.b)) under = course + ' ' + preset + ' ' + length;
      }
      console.log(JSON.stringify({ origin: SKOPEA.meta.origin, turn: SKOPEA.meta.turn ?? 0, worst, where, under, corners: MESH.corners, heights: SKOPEA.parts.heights.length }));`;
    const out = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' }));
    assert.deepEqual(out.origin, [v.lat, v.lon], 'baked at the venue’s position');
    assert.equal(out.turn, v.wind, 'turned to the venue’s wind'); // Göcek's own bake isn't turned: its wind is north
    assert.ok(out.worst >= 60, `a mark only ${Math.round(out.worst)} m from the shore (${out.where})`);
    assert.equal(out.under, '', 'a course across a bridge too low for a mast');
    assert.equal(out.corners, out.heights, 'the terrain the game builds from the quadtree has a height for each of its corners');
  });
}

// the result page's scene (lib/finish.ts): a result kept before the game kept the finish has only the boats' thinned
// tracks, so each boat is put where her track had her at your finishing time; that must land her close to where she was
test('a result without the finish kept puts the fleet close to where it was as you finished', async () => {
  const { finishScene } = await import('../lib/finish.ts');
  const r = new sim.Race({ preset: 'medium', fleet: 6, laps: 1, length: 'short', start: 1, seed: 777 }), P = r.player;
  P.ai = { ...r.boats.find((b) => b.ai).ai, lineT: 0.5, skill: 0.9 }; P.autoTrim = true; // the computer sails yours too
  let at = null;
  for (let n = 0; n < 60 * 60 * 40 && !r.boats.every((b) => b.done); n++) {
    r.step(1 / 60);
    if (P.done && !at) at = new Map(r.boats.map((b) => [b, { x: b.x, z: b.z }]));
  }
  assert.ok(at, 'you finished');
  // thinned as main.js finishToPage keeps them
  const thin = (tr) => { const k = Math.max(1, Math.ceil(tr.length / 160)); return tr.filter((_, i) => i % k === 0 || i === tr.length - 1).map(([x, z]) => [Math.round(x), Math.round(z)]); };
  const xz = (m) => [m.x, m.z], c = r.course;
  const res = { daily: null, preset: 'medium', length: 'short', laps: 1, start: 1, current: false,
    course: { windward: xz(c.windward), gate: c.gate.map(xz), pin: xz(c.pin), committee: xz(c.committee), legs: c.legs },
    boats: r.standings().map((b) => ({ name: b === P ? null : b.name, me: b === P, done: b.done, dsq: b.dsq, secs: b.done ? Math.round(b.finish * 10) / 10 : null, track: thin(b.track) })) };
  const scene = finishScene(res);
  assert.equal(scene.boats.length, r.boats.length);
  for (const s of scene.boats) {
    const b = s.me ? P : r.boats.find((o) => o.name === s.name), was = at.get(b);
    assert.ok(Math.hypot(s.x - was.x, s.z - was.z) < 40, `${s.name || 'you'}: ${Math.round(Math.hypot(s.x - was.x, s.z - was.z))} m from where she was`);
  }
});

// Up and down and the triangle, one lap (test/golden.mjs --write made the fixture): the same finishes, leg times and
// tracks, to the tenth, so 'wl' and 'tri' sail on unchanged from here on. Rewrite the fixture only when a change to the
// sailing is meant, and whenever Göcek's land is baked again (the races are sailed in its bay, round its shore).
test('up and down and the triangle sail exactly as the fixture has them', async () => {
  const { goldenRuns } = await import('./golden.mjs');
  const fixture = JSON.parse(await readFile(new URL('./fixtures/courses-golden.json', import.meta.url), 'utf8'));
  assert.deepEqual(goldenRuns(), fixture);
});

// the site's copy of the geometry (lib/race.ts) lays every shape where the game does
test('the site lays every shape where the game does', () => {
  const near = (p, q, what) => assert.ok(Math.hypot(p[0] - q.x, p[1] - q.z) < 0.5, `${what}: ${p} vs ${q.x},${q.z}`);
  for (const shape of ['wl', 'tri', 'trap', 'wlu']) for (const preset of ['light', 'medium', 'strong'])
    for (const length of ['short', 'medium', 'long']) for (const fleet of [5, 7]) for (const laps of [1, 2]) {
      const c = sim.makeCourse(laps, BEAT[preset] * sim.COURSE_LEN[length], 0, fleet, shape);
      const g = site.plannedCourse(preset, length, fleet, shape), at = `${shape} ${preset} ${length} ${fleet}`;
      assert.equal(g.type, shape);
      near(g.windward, c.windward, `${at} windward`);
      near(g.pin, c.pin, `${at} pin`); near(g.committee, c.committee, `${at} committee`);
      c.gate.forEach((p, i) => near(g.gate[i], p, `${at} gate ${i}`));
      assert.deepEqual(Object.keys(g.marks).sort(), Object.keys(c.marks).sort(), `${at} marks`);
      for (const k of Object.keys(c.marks)) near(g.marks[k], c.marks[k], `${at} ${k}`);
      if (c.wing) near(g.wing, c.wing, `${at} wing`);
      assert.equal(!!g.finish, !!c.finish, `${at} finish`);
      if (c.finish) { near(g.finish[0], c.finish.a, `${at} finish a`); near(g.finish[1], c.finish.b, `${at} finish b`); }
      assert.deepEqual(site.courseLegs(laps, shape), c.legs, `${at} legs ${laps}`);
    }
});

// the course's length on the site's pages (lib/race.ts legDistances, courseDistance) is the game's: each leg from the
// last one's aim to its own (the middle of the line, of the gate, of the finish line), with no bias in the wind
test('the site measures the trapezoid and the upwind finish leg by leg as the game lays them', () => {
  const d = (p, q) => Math.hypot(q.x - p.x, q.z - p.z);
  for (const shape of ['trap', 'wlu']) for (const preset of ['light', 'medium', 'strong'])
    for (const length of ['short', 'medium', 'long']) for (const fleet of [5, 7]) for (const laps of [1, 2]) {
      const c = sim.makeCourse(laps, BEAT[preset] * sim.COURSE_LEN[length], 0, fleet, shape), at = `${shape} ${preset} ${length} ${fleet} ${laps}`;
      const want = c.legs.map((_, i) => (i ? d(sim.legAim(c, i - 1), sim.legAim(c, i)) : 0));
      const got = site.legDistances(site.plannedCourse(preset, length, fleet, shape), c.legs);
      assert.equal(got.length, want.length, at);
      got.forEach((g, i) => assert.ok(Math.abs(g - want[i]) < 1, `${at} leg ${i} (${c.legs[i]}): ${g.toFixed(1)} vs ${want[i].toFixed(1)} m`));
      const total = want.reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(site.courseDistance(site.plannedCourse(preset, length, fleet, shape), laps) - total) < 2, `${at} total`);
    }
});
