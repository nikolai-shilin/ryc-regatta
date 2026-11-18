// The jury boat (public/game/jury.js), with her picture left out: she keeps out of the race area, off the land and clear
// of the yachts, stopping now and then to watch.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mock } from './load.mjs';

mock('public/game/committee.js', 'export class CommitteeBoat { constructor(...args) { this.args = args; this.root = { visible: true }; } }');
globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u)))); // land.js's bay files, from the disk
const { JuryBoat } = await import('../public/game/jury.js');
const { wrap } = await import('../public/game/sim.js');

const realRandom = Math.random;
function seed(n = 1) {
  let s = n >>> 0;
  Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
beforeEach(() => { Math.random = realRandom; seed(11); });

const OPEN = () => 400;
function aRace({ roomAt = OPEN, boats = [], finish = null } = {}) {
  const windward = { x: 0, z: -1000 };
  const course = { windward, marks: { windward, offset: { x: 60, z: -985 } }, gate: [{ x: -40, z: -30 }, { x: 40, z: -30 }], pin: { x: -120, z: 0 }, committee: { x: 120, z: 0 }, ...finish };
  return { course, wind: { p: { tws: 12 } }, boats, roomAt };
}
function jury(o) { const j = new JuryBoat(); j.reset(aRace(o)); return j; }
// under way at speed v, heading north, for a mark far ahead
function underWay(j, { x = 0, z = 0, v = 4, h = 0 } = {}) {
  Object.assign(j, { x, z, v, h, state: 'run', wp: { x, z: z - 3000, th: 0 }, cruise: 5, yawRate: 0 });
  return j;
}
const run = (j, secs, each, dt = 0.1) => { for (let t = 0; t < secs; t += dt) { each?.(t); j.update(dt, t); } };
// the area's own angle round its middle, for land drawn on one side of it
const angleOf = (j, x, z) => Math.atan2((z - j.E.z) / j.E.az, (x - j.E.x) / j.E.ax);

test('she is a sister ship of the committee boat, under way, with the jury on her banner', () => {
  const j = new JuryBoat();
  assert.deepEqual(j.cb.args, [1, 0, { underway: true, banner: 'JURY' }]);
  assert.equal(j.root, j.cb.root);
  assert.deepEqual([j.x, j.z, j.h, j.v], [0, 0, 0, 0]);
});

// ---------- the race area ----------
test('the race area holds every mark, the gate, the line, the water below it and the beat', () => {
  const j = jury(), c = j.race.course;
  for (const m of [...Object.values(c.marks), ...c.gate, c.pin, c.committee, { x: 0, z: 200 }, { x: 0, z: -1090 }]) assert.ok(j.out(m.x, m.z) < 1, `${m.x},${m.z}`);
  assert.ok(j.out(j.E.x + j.E.ax * 1.01, j.E.z) > 1, 'and ends at its edge');
});

test('the area leaves 110 m of water beyond what it has to hold', () => {
  const j = jury(), c = j.race.course;
  const far = Math.max(...[...Object.values(c.marks), c.pin, c.committee].map((m) => j.out(m.x, m.z)));
  assert.ok(far < 0.8, `the furthest mark is at ${far}`);
});

test('a finish line of its own, out to the left, is inside the race area too', () => {
  const finish = { finish: { a: { x: -900, z: -300 }, b: { x: -900, z: -200 } }, finishBoat: { x: -930, z: -250 } };
  const j = jury({ finish }), plain = jury();
  assert.ok(j.out(-930, -250) < 1);
  assert.ok(plain.out(-930, -250) > 1);
  assert.ok(j.E.x < plain.E.x);
});

// ---------- where she starts ----------
test('she starts stopped, out of the race area, to leeward of the line', () => {
  const j = jury();
  assert.equal(j.on, true);
  assert.equal(j.root.visible, true);
  assert.equal(j.state, 'idle');
  assert.equal(j.v, 0);
  assert.equal(j.wp, null);
  assert.ok(j.timer >= 5 && j.timer <= 25);
  assert.equal(j.th, Math.PI / 3);
  assert.ok(Math.abs(j.out(j.x, j.z) - 1.2) < 1e-9);
  assert.ok(j.z > j.E.z, 'on the leeward side');
});

for (const [r, dirn] of [[0.2, 1], [0.8, -1]]) {
  test(`she lies pointing the way she will go round (${dirn > 0 ? 'one way' : 'the other'})`, () => {
    Math.random = () => r;
    const j = jury();
    assert.equal(j.dirn, dirn);
    const a = j.at(j.th, 1.2), b = j.at(j.th + dirn * 0.001, 1.2), len = Math.hypot(b.x - a.x, b.z - a.z);
    const along = (Math.sin(j.h) * (b.x - a.x) - Math.cos(j.h) * (b.z - a.z)) / len;
    assert.ok(along > 0.999, `${along}`);
  });
}

test('where the first place is on land she starts at the next that has water', () => {
  const open = jury(), middle = open.E.z;
  const j = jury({ roomAt: (x, z) => (z > middle + 10 ? -50 : 400) }); // all the leeward side is land
  assert.equal(j.on, true);
  assert.equal(j.th, 0);
  assert.ok(j.race.roomAt(j.x, j.z) > 45);
});

test('with too little room anywhere she stays away, unseen, and does nothing', () => {
  const j = jury({ roomAt: () => 45 }); // not more than the 45 m she wants
  assert.equal(j.on, false);
  assert.equal(j.root.visible, false);
  const before = [j.x, j.z, j.h, j.v];
  run(j, 10);
  assert.deepEqual([j.x, j.z, j.h, j.v], before);
});

test('a race with water after one without brings her back', () => {
  const j = jury({ roomAt: () => 0 });
  j.reset(aRace());
  assert.equal(j.on, true);
  assert.equal(j.root.visible, true);
});

// ---------- where she goes next ----------
test('the next place is a little further round, outside the area, with the water all the way', () => {
  for (let n = 1; n <= 30; n++) {
    seed(n);
    const j = jury(), p = j.pick();
    const moved = wrap(p.th - j.th) * j.dirn;
    assert.ok(moved >= 0.3 - 1e-9 && moved <= 0.65 + 1e-9, `${moved}`);
    assert.ok(p.k >= 1.1 && p.k <= 1.4);
    assert.ok(j.out(p.x, p.z) >= 1.1 - 1e-9);
    for (let s = 1; s < 8; s++) assert.ok(j.out(j.x + (p.x - j.x) * s / 8, j.z + (p.z - j.z) * s / 8) >= 1);
  }
});

test('she wants 60 m of water round the place she makes for', () => {
  const j = jury();
  j.race.roomAt = () => 60;
  assert.equal(j.pick(), null);
  j.race.roomAt = () => 61;
  assert.ok(j.pick());
});

test('with no water ahead she goes round the other way', () => {
  Math.random = () => 0.2; // first of all she goes one way
  const j = jury();
  assert.equal(j.dirn, 1);
  seed(3);
  j.race.roomAt = (x, z) => (wrap(angleOf(j, x, z) - j.th) > 0.1 ? -30 : 400);
  const p = j.pick();
  assert.equal(j.dirn, -1);
  assert.ok(wrap(p.th - j.th) < 0);
});

test('a place she could only reach across the race area is no place to go', () => {
  const j = jury();
  j.x = j.E.x; j.z = j.E.z; // (she is in the middle of it: every way out starts inside)
  assert.equal(j.pick(), null);
});

test('with nowhere to go she says so, and still means to go round the way she was', () => {
  const j = jury(), dirn = j.dirn;
  j.race.roomAt = () => -5;
  assert.equal(j.pick(), null);
  assert.equal(j.dirn, dirn);
});

// ---------- stopped to watch ----------
test('stopped, she waits out her time and then makes for the next place', () => {
  const j = jury();
  j.timer = 1;
  run(j, 0.8);
  assert.equal(j.state, 'idle');
  run(j, 0.4);
  assert.equal(j.state, 'run');
  assert.ok(j.wp);
});

test('stopped with nowhere to go, she waits a while longer', () => {
  const j = jury();
  j.race.roomAt = () => -5;
  j.timer = 0.05;
  j.update(0.1, 0);
  assert.equal(j.state, 'idle');
  assert.ok(j.timer >= 10 && j.timer <= 20);
});

test('stopped, she stays where she is and swings only a little', () => {
  const j = jury();
  j.timer = 1e6;
  const [x, z, h] = [j.x, j.z, j.h];
  run(j, 120);
  assert.deepEqual([j.x, j.z, j.v], [x, z, 0]);
  assert.ok(Math.abs(wrap(j.h - h)) < 1.3, 'at most some 0.01 rad/s');
  assert.ok(Math.abs(j.yawRate) <= 0.01 + 1e-9);
});

// ---------- under way ----------
test('she gets up to 7 to 11 knots gently, and no faster', () => {
  const j = jury(), speeds = [];
  j.timer = 0;
  j.update(0.1, 0);
  j.wp = { x: j.x, z: j.z + 3000, th: j.th };
  j.update(1 / 60, 0);
  assert.ok(j.cruise >= 3.5 && j.cruise <= 5.5);
  j.v = 0;
  j.update(1, 0); // a long frame counts as a quarter of a second
  assert.ok(Math.abs(j.v - 0.125) < 1e-9);
  run(j, 40, () => speeds.push(j.v));
  assert.ok(Math.abs(j.v - j.cruise) < 0.05);
  assert.ok(Math.max(...speeds) <= j.cruise + 1e-9);
});

test('she eases off as she comes up to the place, and turns for it', () => {
  const j = underWay(jury(), { v: 5 });
  j.wp = { x: 30, z: -25, th: 0 }; // 39 m off on her starboard bow
  run(j, 3);
  assert.ok(j.v < 5, `${j.v}`);
  assert.ok(j.h > 0.05, 'turned towards it');
});

test('a long frame moves her no further than a quarter of a second', () => {
  const a = underWay(jury()), b = underWay(jury());
  a.update(5, 0);
  b.update(0.25, 0);
  assert.ok(Math.abs(a.z - b.z) < 1e-9);
});

test('at the place she may stop to watch for a while', () => {
  const j = underWay(jury());
  Object.assign(j.wp, { x: j.x, z: j.z - 5, th: 1.5 });
  Math.random = () => 0.2;
  j.update(0.1, 0);
  assert.equal(j.th, 1.5);
  assert.equal(j.cruise, null);
  assert.equal(j.state, 'idle');
  assert.ok(j.timer >= 20 && j.timer <= 70);
});

test('at the place she may go straight on to the next', () => {
  const j = jury();
  underWay(j, { x: j.x, z: j.z }); // (out where she starts: the way on is clear of the race area)
  const first = j.wp;
  Object.assign(first, { x: j.x, z: j.z - 5, th: j.th });
  Math.random = () => 0.5;
  j.update(0.1, 0);
  assert.equal(j.state, 'run');
  assert.notEqual(j.wp, first);
});

test('at the place with nowhere to go next she stops', () => {
  const j = underWay(jury());
  Object.assign(j.wp, { x: j.x, z: j.z - 5, th: j.th });
  j.race.roomAt = () => 44;
  Math.random = () => 0.5;
  j.update(0.1, 0);
  assert.equal(j.state, 'idle');
  assert.equal(j.wp, null);
  assert.ok(j.timer >= 10 && j.timer <= 20);
});

test('hour after hour she goes round the race area without ever entering it', () => {
  for (const n of [1, 2, 3]) {
    seed(n);
    const j = jury();
    let least = Infinity, moved = 0, lastX = j.x, lastZ = j.z;
    run(j, 3600, () => { least = Math.min(least, j.out(j.x, j.z)); moved += Math.hypot(j.x - lastX, j.z - lastZ); lastX = j.x; lastZ = j.z; }, 0.25);
    assert.ok(least >= 1, `she came to ${least} of the race area`);
    assert.ok(moved > 1000, 'and she really does go round');
  }
});

test('hour after hour in a bay she stays off the land', () => {
  for (const n of [4, 5, 6]) {
    seed(n);
    const area = jury();
    const room = (x, z) => (1.8 - area.out(x, z)) * 500; // water out to 1.8 times the race area, then the shore
    const j = jury({ roomAt: room });
    let least = Infinity;
    run(j, 3600, () => { least = Math.min(least, room(j.x, j.z)); }, 0.25);
    assert.ok(least > 15, `she came within ${least} m of the shore`);
  }
});

// ---------- the yachts ----------
const ahead = (j, d, off = 0) => ({ x: j.x + Math.sin(j.h + off) * d, z: j.z - Math.cos(j.h + off) * d });
function withYacht(d, off = 0) {
  const j = underWay(jury()), yacht = { x: 0, z: 0 };
  j.race.boats = [yacht];
  run(j, 8, () => Object.assign(yacht, ahead(j, d, off)));
  return j;
}

test('a yacht close ahead: she slows right down', () => {
  assert.ok(Math.abs(withYacht(40).v - 0.933) < 0.02, `${withYacht(40).v}`);
});

test('the closer the yacht, the slower she goes', () => {
  assert.ok(withYacht(30).v < withYacht(50).v);
  assert.ok(withYacht(50).v < withYacht(69).v);
});

test('a yacht over 70 m off does not trouble her', () => {
  assert.ok(withYacht(71).v > 4);
});

test('a yacht behind her or abeam does not slow her', () => {
  assert.ok(withYacht(40, Math.PI).v > 4);
  assert.ok(withYacht(40, Math.PI / 2).v > 4);
});

for (const [side, off, sign] of [['starboard', 0.4, -1], ['port', -0.4, 1]]) {
  test(`a yacht on her ${side} bow: she turns away from her`, () => {
    const j = underWay(jury()), yacht = { x: 0, z: 0 };
    j.race.boats = [yacht];
    run(j, 3, () => Object.assign(yacht, ahead(j, 45, off)));
    assert.equal(Math.sign(j.h), sign);
  });
}

test('a yacht very close ahead: she stops, and does not go astern', () => {
  const j = withYacht(5);
  assert.ok(j.v >= 0, `she is making ${j.v} m/s`);
});

test('a yacht right on top of her breaks nothing', () => {
  const j = underWay(jury());
  j.race.boats = [{ x: j.x, z: j.z }];
  j.update(0.1, 0);
  assert.ok(Number.isFinite(j.x) && Number.isFinite(j.h) && Number.isFinite(j.v));
});

test('stopped to watch, a yacht ahead does not set her moving', () => {
  const j = jury();
  j.timer = 1e6;
  j.race.boats = [ahead(j, 40)];
  run(j, 10);
  assert.equal(j.v, 0);
});

// ---------- the land ----------
// open water to the south, the shore 50 m to her north
const shore = (x, z) => z + 50;

test('shoaling water ahead: she slows and turns for deeper water, and never reaches the shore', () => {
  const j = underWay(jury());
  j.race.roomAt = shore;
  let least = Infinity;
  run(j, 40, () => { least = Math.min(least, shore(j.x, j.z)); });
  assert.ok(least > 0, `she came within ${least} m`);
  assert.ok(Math.abs(wrap(j.h)) > 0.7, `heading ${j.h}: she no longer points at the shore`);
});

test('she comes down to a crawl while the water ahead is shoal', () => {
  const j = underWay(jury(), { v: 5 });
  j.race.roomAt = () => 10; // shoal everywhere
  run(j, 5);
  assert.ok(Math.abs(j.v - 1.5) < 0.01, `${j.v}`);
});

test('barely moving, she pays no heed to the shoal ahead', () => {
  const j = underWay(jury(), { v: 0.4 });
  j.cruise = 0.4;
  j.race.roomAt = shore;
  j.update(0.1, 0);
  assert.ok(j.v >= 0.4, 'not slowed for it');
});
