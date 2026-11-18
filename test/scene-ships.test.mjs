// The big ships in the offing: each of the six kinds is built whole, a track is laid only through open water and clear of
// the course, no two ships come near each other, and the sea is left as it was found when each has gone by.
import test from 'node:test';
import assert from 'node:assert/strict';
import './load.mjs';
import { installPage, assertSoundGeometry, assertFiniteTree, boundsOf, watchDispose, seedRandom } from './fake-page.mjs';

installPage();
const THREE = await import('three');
const { Ships } = await import('../public/game/ships.js');
const { skyUniforms } = await import('../public/game/light.js');
const { VENUE } = await import('../public/game/venues.js');

seedRandom(90210);
const close = (a, b, e = 1e-6, what = '') => assert.ok(Math.abs(a - b) <= e, `${what} ${a} is not ${b}`);
const KN = 0.5144, NEAR = 1600, FAR = 5000, REACH = 8800, CLEAR = 1400, SEA = -5, ROOM = 400;
const open = () => -20;
const race = (marks = { windward: { x: 0, z: -900 }, leeward: { x: 0, z: 200 } }) => ({ course: { marks } });

function ships(ground = open, r = race()) { const s = new Ships(skyUniforms()); s.reset(r, ground); return s; }

// a ship of one kind: the first number drawn chooses her
const KINDS = { tanker: 0.1, container: 0.4, bulk: 0.65, cruise: 0.8, corvette: 0.9, submarine: 0.97 };
function one(kind) {
  const s = new Ships(skyUniforms()); s.reset(race(), open);
  for (const x of s.list) s.drop(x); s.list = [];
  const real = Math.random; let first = true;
  Math.random = () => { if (first) { first = false; return KINDS[kind]; } return real(); };
  try { return { s, ship: s.spawn(0.5) }; } finally { Math.random = real; }
}
const built = {}; // what is only looked at is built once
const ofKind = (kind) => (built[kind] ||= one(kind));
const along = (a, s) => ({ x: a.x0 + a.f.x * s, z: a.z0 + a.f.z * s });

// ---------- the ships themselves ----------
const SIZE = { tanker: [250, 44, 30], container: [300, 46, 40], bulk: [195, 30, 25], cruise: [285, 38, 50], corvette: [90, 12, 20], submarine: [95, 9, 10] };
const SPEEDS = { tanker: [11, 15], container: [15, 21], bulk: [11, 14.5], cruise: [16, 21], corvette: [15, 24], submarine: [10, 15] };
for (const [kind, [L, B, H]] of Object.entries(SIZE)) {
  test(`a ${kind} is the size of one, and built whole`, () => {
    const { ship } = ofKind(kind), g = ship.mesh.geometry, b = boundsOf(g);
    assertSoundGeometry(g, kind);
    assert.ok(b.size.z >= L && b.size.z < L * 1.2, `${b.size.z} m long`);
    assert.ok(b.size.x >= B && b.size.x < B * 1.3, `${b.size.x} m in the beam`);
    assert.ok(b.max.y >= H, `she stands ${b.max.y} m out of the water`);
    assert.ok(b.min.y < 0, 'and some of her is under it');
    close((b.min.x + b.max.x) / 2, 0, 1.5, 'she is built on her centreline');
  });

  test(`a ${kind}'s paint and glass are in range`, () => {
    const g = ofKind(kind).ship.mesh.geometry, C = g.attributes.color.array, S = g.attributes.aShine.array;
    for (let i = 0; i < C.length; i++) assert.ok(C[i] >= 0 && C[i] <= 1.01, `a colour of ${C[i]}`);
    for (let i = 0; i < S.length; i++) assert.ok(S[i] === 0 || S[i] === 1, `a shine of ${S[i]}`);
    assert.ok(S.includes(1) || kind === 'submarine', 'she has windows');
  });

  test(`a ${kind} goes at her own speed`, () => {
    for (let i = 0; i < 3; i++) {
      const v = one(kind).ship.v / KN;
      assert.ok(v >= SPEEDS[kind][0] && v <= SPEEDS[kind][1], `${v} kn`);
    }
  });

  test(`the water a ${kind} moves is sound, and her wake runs astern`, () => {
    const { ship } = ofKind(kind), g = ship.wake.geometry, A = g.attributes.aA.array, b = boundsOf(g), hull = boundsOf(ship.mesh.geometry);
    assertSoundGeometry(g, `${kind}'s wake`);
    for (let i = 0; i < A.length; i++) assert.ok(A[i] >= 0 && A[i] <= 0.96, `an alpha of ${A[i]}`);
    assert.ok(b.max.z > hull.max.z + hull.size.z * 3, `it reaches ${b.max.z} m astern`);
    close(b.min.x, -b.max.x, 1e-3, 'as wide to one side as to the other');
  });
}

test('a tanker rides deep and a submarine lies lowest of all', () => {
  assert.ok(boundsOf(ofKind('submarine').ship.mesh.geometry).max.y < boundsOf(ofKind('tanker').ship.mesh.geometry).max.y / 2);
  assert.ok(boundsOf(ofKind('cruise').ship.mesh.geometry).max.y > boundsOf(ofKind('bulk').ship.mesh.geometry).max.y);
});

test('a draw at the very top of the range is still a ship', () => {
  const s = new Ships(skyUniforms()); s.ground = open; s.marks = [{ x: 0, z: 0 }];
  const real = Math.random; let first = true;
  Math.random = () => { if (first) { first = false; return 1; } return real(); };
  try { assert.ok(boundsOf(s.spawn(0).mesh.geometry).size.z > 90); } finally { Math.random = real; }
});

test('every kind turns up, in about the shares meant', () => {
  const n = {};
  for (let i = 0; i < 100; i++) {
    const s = new Ships(skyUniforms()); s.ground = open; s.marks = [{ x: 0, z: 0 }];
    const L = boundsOf(s.spawn(0).mesh.geometry).size.z;
    const k = L < 110 ? 'small' : L < 230 ? 'bulk' : 'big'; n[k] = (n[k] || 0) + 1;
  }
  assert.ok(n.big > 45 && n.big < 85, `${n.big} big ships of 100`);
  assert.ok(n.bulk > 5 && n.bulk < 32, `${n.bulk} bulk carriers`);
  assert.ok(n.small > 4 && n.small < 32, `${n.small} small ships`);
});

// ---------- where they go ----------
test('until a race is set no ship moves or appears', () => {
  const s = new Ships(skyUniforms());
  assert.doesNotThrow(() => s.update(100));
  assert.equal(s.list.length, 0);
  assert.equal(s.group.children.length, 0);
});

test('the offing is not empty when you get there: one or two already on their way', () => {
  for (let i = 0; i < 8; i++) {
    const s = ships();
    assert.ok(s.list.length === 1 || s.list.length === 2);
    assert.equal(s.group.children.length, s.list.length);
    for (const a of s.list) assert.ok(a.s >= 0.25 * a.len - 1e-6 && a.s <= 0.75 * a.len + 1e-6);
    assert.ok(s.timer >= 90 && s.timer <= 240);
  }
});

test('with no land given she treats it all as open sea', () => {
  const s = new Ships(skyUniforms()); s.reset(race());
  assert.ok(s.list.length >= 1);
});

test('with no race the marks are only the middle of the sea', () => {
  const s = new Ships(skyUniforms()); s.reset(null, open);
  assert.deepEqual(s.marks, [{ x: 0, z: 0 }]);
});

test('a track passes 1.6 to 5 km off the course and runs out to where the haze hides her', () => {
  for (let i = 0; i < 16; i++) {
    const s = new Ships(skyUniforms()); s.ground = open; s.marks = [{ x: 300, z: -200 }, { x: 700, z: 400 }];
    const a = s.spawn(0.5), m = { x: 500, z: 100 }, mid = along(a, a.len / 2), off = Math.hypot(mid.x - m.x, mid.z - m.z);
    assert.ok(off >= NEAR - 1e-6 && off <= FAR + 1e-6, `${off} m off`);
    close(Math.hypot(a.x0 - m.x, a.z0 - m.z), REACH, 1e-6, 'it starts');
    close((mid.x - m.x) * a.f.x + (mid.z - m.z) * a.f.z, 0, 1e-6, 'the middle of the track is its nearest');
  }
});

test('no track comes within 1.4 km of a mark', () => {
  const marks = { a: { x: 0, z: 0 }, b: { x: 2500, z: 1500 }, c: { x: -1800, z: 2600 } };
  for (let i = 0; i < 20; i++) {
    const s = new Ships(skyUniforms()); s.ground = open; s.marks = [{ x: 0, z: 0 }, ...Object.values(marks)];
    const a = s.spawn(0.5);
    if (!a) continue;
    for (const m of s.marks) assert.ok(Math.abs((m.x - a.x0) * -a.f.z + (m.z - a.z0) * a.f.x) >= CLEAR - 1e-6, 'clear of the mark');
  }
});

test('marks too spread out to pass leave no track at all', () => {
  const s = new Ships(skyUniforms()); s.ground = open;
  s.marks = Array.from({ length: 72 }, (_, i) => ({ x: 5000 * Math.cos(i * Math.PI / 36), z: 5000 * Math.sin(i * Math.PI / 36) })); // a ring every track must cross
  for (let i = 0; i < 5; i++) assert.ok(s.spawn(0) === null);
});

test('a track is laid in open water all the way, and with room either side of it', () => {
  // an island to the north, a cape to the east: most tracks are refused
  const land = (x, z) => (Math.hypot(x, z + 4000) < 1500 || x > 6000 ? 30 : -20);
  let laid = 0;
  for (let i = 0; i < 30; i++) {
    const s = new Ships(skyUniforms()); s.ground = land; s.marks = [{ x: 0, z: 0 }];
    const a = s.spawn(0.2);
    if (!a) continue;
    laid++;
    const nx = -a.f.z, nz = a.f.x;
    for (let d = 0; d <= a.len; d += 45) for (const side of [-ROOM, 0, ROOM]) {
      const p = along(a, d);
      assert.ok(land(p.x + nx * side, p.z + nz * side) < SEA, `land at ${d} m along, ${side} m off`);
    }
  }
  assert.ok(laid > 3, `${laid} tracks found`);
});

test('a venue shut in by its hills sees no ships', () => {
  const s = ships(() => 12);
  assert.equal(s.list.length, 0);
  assert.ok(s.spawn(0) === null);
  s.timer = 0; s.update(1);
  assert.equal(s.list.length, 0);
  assert.ok(s.timer > 0, 'and it tries again later');
});

test('shallows are not open water', () => {
  assert.equal(ships(() => -4).list.length, 0);
});

test('no new ship is laid to pass within 600 m of one out there', () => {
  for (let run = 0; run < 5; run++) {
    const s = ships();
    for (let i = 0; i < 3; i++) s.spawn(Math.random() * 0.5);
    for (let i = 0; i < s.list.length; i++) for (let j = i + 1; j < s.list.length; j++) {
      const a = s.list[i], b = s.list[j];
      const T = Math.min((a.len - a.s) / a.v, (b.len - b.s) / b.v);
      for (let t = 0; t <= T; t += 5) {
        const p = along(a, a.s + a.v * t), q = along(b, b.s + b.v * t);
        assert.ok(Math.hypot(p.x - q.x, p.z - q.z) > 595, `${Math.hypot(p.x - q.x, p.z - q.z)} m apart ${t} s on`);
      }
    }
  }
});

test('two ships at the same speed on the same heading are kept apart too', () => {
  const s = ships(); s.list.length = 0;
  const a = s.spawn(0.5);
  const b = { ...a, x0: a.x0 + 200, s: a.s };
  s.list.push(b);
  const c = s.spawn(0.5);
  if (c) assert.ok(Math.hypot(along(c, c.s).x - along(b, b.s).x, along(c, c.s).z - along(b, b.s).z) > 595);
});

test('she points the way she goes', () => {
  const { ship } = one('tanker'), nose = new THREE.Vector3(0, 0, -1).applyEuler(ship.g.rotation);
  close(nose.x, ship.f.x, 1e-9); close(nose.z, ship.f.z, 1e-9);
});

test('she steams along her track at her speed, rolling only a little', () => {
  const s = ships();
  s.timer = 1e9;
  const a = s.list[0], p0 = a.s;
  for (let i = 0; i < 300; i++) s.update(0.1);
  close(a.s, p0 + a.v * 30, 1e-6);
  const at = along(a, a.s);
  close(a.g.position.x, at.x, 1e-6); close(a.g.position.z, at.z, 1e-6); assert.equal(a.g.position.y, 0);
  assert.ok(Math.abs(a.mesh.rotation.x) <= 0.002 && Math.abs(a.mesh.rotation.z) <= 0.004);
  assert.equal(a.wake.rotation.x, 0, 'her wake lies on the water');
});

test('at the end of her track she is gone, and what she was made of let go', () => {
  const s = ships(); s.timer = 1e9;
  const a = s.list[0], seen = [watchDispose(a.mesh.geometry), watchDispose(a.wake.geometry)];
  a.s = a.len + 1;
  s.update(0.1);
  assert.ok(!s.list.includes(a));
  assert.ok(!s.group.children.includes(a.g));
  assert.deepEqual(seen.map((w) => w.count), [1, 1]);
});

test('a new race clears the offing of the last one\'s ships', () => {
  const s = ships(), old = s.list.slice(), seen = old.map((a) => watchDispose(a.mesh.geometry));
  s.reset(race(), open);
  assert.deepEqual(seen.map((w) => w.count), old.map(() => 1));
  assert.equal(s.group.children.length, s.list.length);
  for (const a of old) assert.ok(!s.list.includes(a));
});

test('a new ship comes along now and then, starting at the far end of her track', () => {
  const s = ships(); s.timer = 0; s.list.slice().forEach((a) => s.drop(a)); s.list = [];
  s.update(0.1);
  assert.equal(s.list.length, 1);
  close(s.list[0].s, s.list[0].v * 0.1, 1e-6);
  assert.ok(s.timer >= 150 && s.timer <= 360);
});

test('none comes while the clock stands still', () => {
  const s = ships(), n = s.list.length; s.timer = -1;
  s.update(0);
  assert.equal(s.list.length, n);
});

test('never more than three are out there, for all of a long race', () => {
  const s = ships();
  let most = 0, seen = new Set(s.list);
  for (let i = 0; i < 6000; i++) {
    s.update(3);
    most = Math.max(most, s.list.length);
    for (const a of s.list) { seen.add(a); assert.ok(a.s >= 0 && a.s <= a.len); }
  }
  assert.ok(most <= 3 && most >= 2, `${most} at once`);
  assert.ok(seen.size > 6, `${seen.size} ships in all`);
  assert.equal(s.group.children.length, s.list.length, 'nothing is left behind in the scene');
  assertFiniteTree(s.group, 'the ships');
});

// ---------- how they are drawn ----------
test('her wake goes on the water after her, without writing to the depth', () => {
  const { s, ship } = one('cruise');
  assert.equal(ship.wake.renderOrder, 1);
  assert.equal(s.foamMat.depthWrite, false); assert.equal(s.foamMat.transparent, true);
  assert.equal(s.mat.side, THREE.DoubleSide);
});

test('the haze on them is the land\'s, on the ships and their wakes alike', () => {
  const s = new Ships(skyUniforms());
  s.setLight({ fogFar: 5000 });
  close(s.mat.uniforms.uHazeL.value, 5000 * 2.4 * (VENUE.look.haze ?? 1));
  assert.equal(s.foamMat.uniforms.uHazeL, s.mat.uniforms.uHazeL);
});

test('the foam\'s clock runs with the race', () => {
  const s = ships(); s.timer = 1e9;
  s.update(0.5); s.update(0.25);
  close(s.time.value, 0.75);
  assert.equal(s.foamMat.uniforms.uTime, s.time);
});
