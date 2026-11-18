// Life on the water: gulls wheel and settle and rise again, the pod comes to your bow and leaves, whales blow, breach and
// sound. All picture, so what matters is that each keeps to what it is doing, however long the race goes on.
import test from 'node:test';
import assert from 'node:assert/strict';
import './load.mjs';
import { installPage, assertSoundGeometry, assertSoundSkin, assertFiniteTree, boundsOf, under, seedRandom, scriptRandom } from './fake-page.mjs';

installPage();
const THREE = await import('three');
const { Wildlife } = await import('../public/game/wildlife.js');
const { makeWaves, waveHeight, wrap } = await import('../public/game/sim.js');
const { groundAt } = await import('../public/game/land.js');

seedRandom(777);
const W = makeWaves(0.4, 0.3);
const close = (a, b, e = 1e-6, what = '') => assert.ok(Math.abs(a - b) <= e, `${what} ${a} is not ${b}`);
const fwd = (h) => ({ x: Math.sin(h), z: -Math.cos(h) });

function setup({ h = 0.5, v = 3, level, boats = [] } = {}) {
  const scene = new THREE.Scene(), splashes = [], w = new Wildlife(scene, (x, z, n, up, size) => splashes.push({ x, z, n, up, size }));
  const player = { x: 0, z: 0, h, v };
  const race = { player, boats: [player, ...boats], wind: { dir: () => 0.4, p: { tws: 12 } }, course: { windward: { x: 0, z: -900 }, gate: [{ x: -40, z: 300 }, { x: 40, z: 300 }] } };
  if (level) w.setLevel(level);
  w.reset(race);
  const cam = new THREE.PerspectiveCamera(); cam.position.set(0, 10, 30);
  let t = 0;
  const step = (dt = 1 / 30, n = 1, each) => {
    for (let i = 0; i < n; i++) {
      t += dt;
      const f = fwd(player.h); player.x += f.x * player.v * dt; player.z += f.z * player.v * dt;
      cam.position.set(player.x, 10, player.z + 30);
      w.update(dt, t, W, cam, 400);
      each?.(t, i);
    }
  };
  return { scene, w, race, player, cam, splashes, step, now: () => t };
}
// keeps the gulls and whales out of a test about something else
const quiet = (w) => { for (const a of w.whales) a.timer = 1e9; w.pod.timer = 1e9; for (const b of w.gulls) { b.landT = 1e9; b.callT = 1e9; } };

// ---------- the shapes ----------
test('a gull is one skinned draw: a body and two wings of two bones each', () => {
  const { w } = setup();
  assert.equal(w.gulls.length, 13);
  for (const b of w.gulls) {
    const m = b.g.children[0];
    assert.ok(m.isSkinnedMesh);
    assert.equal(m.skeleton.bones.length, 5);
    assertSoundSkin(m.geometry, 5, 'a gull');
    assertSoundGeometry(m.geometry, 'a gull');
  }
});

test('a gull is 1.45 m across the wings', () => {
  const b = boundsOf(setup().w.gulls[0].g.children[0].geometry);
  close(b.size.x, 1.36, 0.15, 'her span');
  assert.ok(b.min.z < -0.3, 'her bill is at −z');
});

test('a dolphin is 2.5 m long and a humpback 13 m, both built whole', () => {
  const { w } = setup();
  const d = boundsOf(w.dolphins[0].m.geometry), m = boundsOf(w.whales[0].m.geometry);
  close(d.size.z, 2.5, 0.25, 'the dolphin'); close(m.size.z, 13, 1.2, 'the whale');
  assertSoundGeometry(w.dolphins[0].m.geometry, 'a dolphin'); assertSoundGeometry(w.whales[0].m.geometry, 'a whale');
  assert.ok(m.size.x > 7, 'her long flippers reach out');
});

test('each dolphin and whale flexes a copy of its own', () => {
  const { w } = setup();
  assert.notEqual(w.dolphins[0].m.geometry, w.dolphins[1].m.geometry);
  assert.notEqual(w.whales[0].m.geometry, w.whales[1].m.geometry);
  assert.equal(w.dolphins.length, 5); assert.equal(w.whales.length, 2);
});

test('before a race nothing moves', () => {
  const w = new Wildlife(new THREE.Scene(), () => {});
  assert.doesNotThrow(() => w.update(0.1, 0, W, new THREE.PerspectiveCamera(), 400));
  assert.equal(w.clock, 0);
});

// ---------- how many ----------
test('the level sets how many gulls come', () => {
  for (const [q, n] of [['high', 13], ['medium', 10], ['low', 7]]) {
    const { w } = setup({ level: q });
    assert.equal(w.gulls.filter((b) => b.on).length, n, q);
    assert.equal(w.gulls.filter((b) => b.g.visible).length, n);
  }
});

test('an unknown level is taken as high', () => {
  const { w } = setup({ level: 'ultra' });
  assert.equal(w.gulls.filter((b) => b.on).length, 13);
});

test('a lower level in the middle of a race sends the spare gulls away', () => {
  const { w, step } = setup();
  step(1 / 30, 5);
  w.setLevel('low');
  assert.equal(w.gulls.filter((b) => b.on).length, 7);
  for (const b of w.gulls.slice(7)) assert.equal(b.g.visible, false);
  const p = w.gulls[12].p.clone();
  step(1 / 30, 5);
  assert.ok(w.gulls[12].p.equals(p), 'and they stop being flown');
});

test('the pod comes smaller at a lower level', () => {
  const { w, step } = setup({ level: 'low' });
  quiet(w); w.pod.timer = 0;
  step(1 / 30, 1);
  assert.equal(w.pod.n, 3);
  assert.deepEqual(w.dolphins.map((d) => d.g.visible), [true, true, true, false, false]);
});

// ---------- the gulls ----------
test('a race opens with most gulls wheeling round you and a few sitting by the marks', () => {
  const { w, race } = setup();
  const fly = w.gulls.slice(0, 8), rest = w.gulls.slice(8);
  for (const b of fly) { assert.equal(b.mode, 'fly'); assert.ok(b.p.y > 0); }
  rest.forEach((b, i) => {
    assert.equal(b.mode, 'rest'); assert.equal(b.stay, true);
    const m = i % 3 === 2 ? race.course.gate[0] : race.course.windward, d = Math.hypot(b.p.x - m.x, b.p.z - m.z);
    assert.ok(d >= 25 - 1e-6 && d <= 60 + 1e-6, `${d} m from her mark`);
  });
});

test('a gull in flight keeps over the sea, at a gull\'s speed', () => {
  const { w, step } = setup();
  quiet(w);
  step(1 / 30, 3000, (t) => {
    for (const b of w.gulls) {
      if (b.mode !== 'fly') continue;
      assert.ok(b.p.y >= waveHeight(W, b.p.x, b.p.z, t) + 1.2, `at ${b.p.y} m`);
      const s = b.v.length(); assert.ok(s >= 4.9 && s <= 15.01, `at ${s} m/s`);
    }
  });
});

test('the flock stays round you as you sail on', () => {
  const { w, step, player } = setup({ v: 6 });
  quiet(w);
  step(1 / 15, 2500);
  for (const b of w.gulls.slice(0, 8)) assert.ok(Math.hypot(b.p.x - player.x, b.p.z - player.z) < 250, 'she has kept up');
});

test('a sitting gull rides the wave and turns her head to the wind', () => {
  const { w, step, now, race } = setup();
  quiet(w);
  const b = w.gulls[8]; b.yaw = 2;
  step(1 / 30, 900);
  close(b.p.y, waveHeight(W, b.p.x, b.p.z, now()) + 0.02, 1e-6, 'on the water');
  assert.ok(Math.abs(wrap(b.yaw - race.wind.dir())) < 0.01, `${b.yaw} against the wind\'s ${race.wind.dir()}`);
});

test('a sitting gull folds her wings', () => {
  const { w, step } = setup();
  quiet(w); step(1 / 30, 2);
  const { sx, sh, tip } = w.gulls[8].wings[0];
  close(sh.rotation.y, -sx * 1.4); close(tip.scale.x, 0.6); close(tip.rotation.z, 0);
});

test('a boat coming close puts her up with a cry', () => {
  const { w, step, player } = setup();
  quiet(w);
  const b = w.gulls[8]; player.x = b.p.x + 10; player.z = b.p.z; player.v = 0;
  step(1 / 30, 1);
  assert.equal(b.mode, 'fly'); assert.equal(b.stay, false);
  assert.ok(b.v.y > 0, 'she climbs away');
  const up = w.events.find((e) => e.type === 'up'), cry = w.events.find((e) => e.type === 'call');
  assert.equal(up.player, true); assert.equal(up.p, b.p);
  assert.deepEqual([cry.n, cry.alarm], [3, true]);
});

test('another boat puts her up too, and the player is told it was not him', () => {
  const other = { x: 0, z: 0 }, { w, step, player } = setup({ boats: [other] });
  quiet(w);
  const b = w.gulls[8]; other.x = b.p.x + 5; other.z = b.p.z; player.x = b.p.x + 200; player.z = b.p.z; player.v = 0;
  step(1 / 30, 1);
  assert.equal(w.events.find((e) => e.type === 'up').player, false);
});

test('one that landed by you follows when she is left far behind, without a cry', () => {
  const { w, step, player } = setup();
  quiet(w);
  const b = w.gulls[8]; b.stay = false; player.x = b.p.x + 500; player.z = b.p.z; player.v = 0;
  step(1 / 30, 1);
  assert.equal(b.mode, 'fly');
  assert.equal(w.events.length, 0);
});

test('one set by the mark stays there however far off you are', () => {
  const { w, step, player } = setup();
  quiet(w);
  const b = w.gulls[8]; player.x = b.p.x + 5000; player.v = 0;
  step(1 / 30, 10);
  assert.equal(b.mode, 'rest');
});

test('now and then one goes down on the water ahead of you and settles there', () => {
  const { w, step, player } = setup({ v: 2 });
  quiet(w);
  const b = w.gulls[0]; b.landT = 0;
  step(1 / 30, 1);
  assert.equal(b.mode, 'land');
  const ahead = (b.lx - player.x) * fwd(player.h).x + (b.lz - player.z) * fwd(player.h).z;
  assert.ok(ahead > 40 && ahead < 200, `${ahead} m ahead`);
  let t = 0;
  while (b.mode === 'land' && t++ < 3000) step(1 / 30, 1);
  assert.equal(b.mode, 'rest');
  assert.ok(Math.hypot(b.p.x - b.lx, b.p.z - b.lz) < 1.5, 'where she meant to');
  assert.equal(b.v.length(), 0);
});

test('she will not go down in front of a boat lying still', () => {
  const { w, step } = setup({ v: 0 });
  quiet(w);
  const b = w.gulls[0]; b.landT = 0;
  step(1 / 30, 3);
  assert.equal(b.mode, 'fly');
});

test('if the boats get there first she stays up', () => {
  const other = { x: 1e5, z: 1e5 }, { w, step } = setup({ v: 2, boats: [other] });
  quiet(w);
  const b = w.gulls[0]; b.landT = 0;
  step(1 / 30, 1);
  other.x = b.lx; other.z = b.lz;
  step(1 / 30, 1);
  assert.equal(b.mode, 'fly');
  assert.ok(b.landT >= 30 && b.landT <= 90);
});

test('a flying gull calls now and then', () => {
  const { w, step } = setup();
  quiet(w);
  const b = w.gulls[0]; b.callT = 0;
  step(1 / 30, 1);
  const e = w.events.find((x) => x.type === 'call');
  assert.equal(e.alarm, false); assert.ok(e.n >= 1 && e.n <= 4); assert.equal(e.p, b.p);
  assert.ok(b.callT >= 10 && b.callT <= 40);
});

test('no more than twelve sounds wait to be read', () => {
  const { w } = setup();
  w.events.length = 0;
  for (let i = 0; i < 30; i++) w.emit({ type: 'call', i });
  assert.equal(w.events.length, 12);
  assert.equal(w.events[11].i, 11, 'the first ones are kept');
});

test('a gull a long way from the camera is not drawn', () => {
  const { w, step, cam } = setup();
  quiet(w);
  const b = w.gulls[0], r = w.gulls[8];
  step(1 / 30, 1);
  assert.equal(b.g.visible, true);
  b.p.set(cam.position.x + 2000, 20, cam.position.z); r.p.set(cam.position.x + 2000, 0, cam.position.z);
  step(1 / 30, 1);
  assert.equal(b.g.visible, false); assert.equal(r.g.visible, false);
});

test('in flight she flaps in bouts and glides between, her wings within a gull\'s reach', () => {
  const { w, step } = setup();
  quiet(w);
  const b = w.gulls[0], arms = [];
  step(1 / 30, 1800, () => arms.push(b.wings[0].sh.rotation.z * b.wings[0].sx));
  assert.ok(Math.max(...arms) > 0.5, 'she beats up');
  assert.ok(Math.min(...arms) < -0.2, 'and down');
  for (const a of arms) assert.ok(Math.abs(a) < 0.85);
});

// ---------- the dolphins ----------
const podAt = (s, state) => { const { w } = s; quiet(w); w.pod.state = 'away'; w.pod.timer = 0; s.step(1 / 30, 1); assert.equal(w.pod.state, 'come'); if (state) w.pod.state = state; };

test('they are rare: the pod turns up a few minutes in', () => {
  for (let i = 0; i < 20; i++) { const { w } = setup(); assert.equal(w.pod.state, 'away'); assert.ok(w.pod.timer >= 180 && w.pod.timer <= 480); assert.ok(w.dolphins.every((d) => !d.g.visible)); }
});

test('they come in from one side, some way off', () => {
  const s = setup(); podAt(s);
  for (const d of s.w.dolphins) assert.ok(Math.hypot(d.x - s.player.x, d.z - s.player.z) > 70, 'from afar');
});

test('no dolphin swims faster than 8.5 m/s', () => {
  const s = setup({ v: 6 }); podAt(s);
  const last = s.w.dolphins.map((d) => ({ x: d.x, z: d.z }));
  s.step(1 / 30, 600, () => s.w.dolphins.forEach((d, i) => {
    const v = Math.hypot(d.x - last[i].x, d.z - last[i].z) * 30;
    assert.ok(v <= 8.5 + 1e-6, `${v} m/s`);
    last[i].x = d.x; last[i].z = d.z;
  }));
});

test('they take station at your bow, ride it, then drop astern and go', () => {
  const s = setup({ v: 4 }), { w } = s; podAt(s);
  const seen = [];
  let guard = 0;
  while (w.pod.state !== 'away' && guard++ < 60000) { s.step(1 / 15, 1); if (seen.at(-1) !== w.pod.state) seen.push(w.pod.state); if (w.pod.state === 'ride') for (const d of w.dolphins) assert.ok(Math.hypot(d.x - s.player.x, d.z - s.player.z) < 25, 'by the bow'); }
  assert.deepEqual(seen, ['come', 'ride', 'go', 'away']);
  assert.ok(w.pod.timer >= 480 && w.pod.timer <= 900, 'and they are not back for a while');
  assert.ok(w.dolphins.every((d) => !d.g.visible));
});

test('a pod that cannot catch you gives up after a minute', () => {
  const s = setup({ v: 14 }), { w } = s; podAt(s);
  let guard = 0;
  while (w.pod.state === 'come' && guard++ < 4000) s.step(1 / 15, 1);
  assert.equal(w.pod.state, 'go');
  assert.ok(w.pod.timer < -59 && w.pod.timer > -62, `at ${w.pod.timer} s`);
});

test('they breathe in short arcs through the surface, and never fly off', () => {
  const s = setup({ v: 4 }), { w } = s; podAt(s, 'ride'); w.pod.timer = 1e9;
  let high = -9, low = 9;
  s.step(1 / 30, 3000, (t) => w.dolphins.forEach((d) => {
    const depth = d.g.position.y - waveHeight(W, d.x, d.z, t);
    high = Math.max(high, depth); low = Math.min(low, depth);
    assert.ok(depth >= -1.7 - 1e-6 && depth <= 1.1 + 1e-6, `at ${depth} m`);
  }));
  assert.ok(high > -0.1, 'they do break the surface');
  close(low, -1.7, 1e-6, 'and swim just under it');
});

test('they splash where they break the surface', () => {
  const s = setup({ v: 4 }), { w } = s; podAt(s, 'ride'); w.pod.timer = 1e9;
  s.step(1 / 15, 600); // on station by now
  s.splashes.length = 0;
  let n = 0;
  s.step(1 / 30, 1200, () => {
    for (const e of s.splashes.splice(0)) { n++; assert.ok([4, 12].includes(e.n)); assert.ok(Math.hypot(e.x - s.player.x, e.z - s.player.z) < 25, 'by the boat'); }
  });
  assert.ok(n > 4, `${n} splashes`);
});

test('a dolphin\'s tail beats and her head does not', () => {
  const s = setup({ v: 4 }), { w } = s; podAt(s, 'ride'); w.pod.timer = 1e9;
  const d = w.dolphins[0], P = d.m.geometry.attributes.position, seen = new Set();
  s.step(1 / 30, 60, () => {
    let tail = 0;
    for (let i = 0; i < P.count; i++) {
      const dy = P.getY(i) - d.base[i * 3 + 1], s0 = (d.base[i * 3 + 2] + 1.25) / 2.5;
      close(P.getX(i), d.base[i * 3], 1e-9, 'nothing moves sideways');
      if (s0 <= 0.45) close(dy, 0, 1e-9, 'forward of the tail');
      else tail = Math.max(tail, Math.abs(dy));
    }
    seen.add(tail.toFixed(3));
  });
  assert.ok(seen.size > 5, 'it moves');
  for (const v of seen) assert.ok(+v <= 0.035 * 2.5 * 1.2, `a stroke of ${v} m`); // (the flukes reach a little past her tail's end)
});

test('a dolphin out of sight is not bent', () => {
  const s = setup({ v: 4, level: 'low' }), { w } = s; podAt(s);
  s.step(1 / 30, 60);
  assert.deepEqual(w.dolphins[4].m.geometry.attributes.position.array, w.dolphins[4].base);
});

// ---------- the whales ----------
function whaleUp(s, seq, i = 0) {
  const w = s.w.whales[i];
  Object.assign(w, { state: 'up', x: s.player.x + 300, z: s.player.z, h: 0, u: 0, seq });
  w.g.visible = true;
  return w;
}

test('they come later than the dolphins, the second later still', () => {
  for (let i = 0; i < 20; i++) {
    const [a, b] = setup().w.whales;
    assert.ok(a.timer >= 240 && a.timer <= 600); assert.ok(b.timer >= 900 && b.timer <= 1800);
    assert.equal(a.state, 'deep'); assert.equal(a.g.visible, false);
  }
});

test('a whale surfaces 150 to 380 m off, well clear of every boat, and swims across', () => {
  const other = { x: 200, z: -100 }, s = setup({ boats: [other] });
  for (let i = 0; i < 200; i++) {
    const w = s.w.whales[0];
    assert.equal(s.w.place(w, s.player), true);
    const d = Math.hypot(w.x - s.player.x, w.z - s.player.z);
    assert.ok(d >= 150 && d <= 380, `${d} m off`);
    assert.ok(Math.hypot(w.x - other.x, w.z - other.z) >= 120, 'clear of the other boat');
  }
});

test('with no room for her she stays down and looks again in ten seconds', () => {
  const s = setup(), w = s.w.whales[0];
  s.w.nearestBoat = () => 0;
  w.timer = 0;
  s.w.whale(w, 0.1, 0, W, s.player);
  assert.equal(w.state, 'deep'); close(w.timer, 10);
});

test('a surfacing is some breaths and a dive, and then she is gone for ten minutes or more', () => {
  const s = setup({ v: 0 }), { w } = s; quiet(w);
  const a = w.whales[0]; a.timer = 0;
  s.step(1 / 15, 1);
  assert.equal(a.state, 'up'); assert.equal(a.g.visible, true);
  const kinds = a.seq.map((q) => q.kind);
  assert.equal(kinds.at(-1), 'dive');
  const breaths = kinds.filter((k) => k === 'breath').length;
  assert.ok(breaths >= 3 && breaths <= 5, `${breaths} breaths`);
  let guard = 0;
  while (a.state === 'up' && guard++ < 20000) s.step(1 / 15, 1);
  assert.equal(a.state, 'deep'); assert.equal(a.g.visible, false);
  assert.ok(a.timer >= 600 && a.timer <= 1200);
});

test('sometimes she starts with a breach', () => {
  const s = setup({ v: 0 }), a = s.w.whales[0]; quiet(s.w); a.timer = 0;
  // four numbers lay her course, and the fifth is the chance of a breach
  const back = scriptRandom([0.5, 0.5, 0.5, 0.5, 0.1], Math.random);
  s.w.whale(a, 1 / 30, 0, W, s.player);
  back();
  assert.equal(a.seq[0].kind, 'breach');
});

test('she blows at the height of each breath, with as much mist as the level allows', () => {
  for (const [q, n] of [['high', 70], ['medium', 49], ['low', 28]]) {
    const s = setup({ v: 0, level: q }), { w } = s; quiet(w);
    const a = whaleUp(s, [{ kind: 'breath', dur: 6 }, { kind: 'glide', dur: 50 }]);
    const before = w.mist.i;
    s.step(1 / 30, 6 * 30 * 0.32);
    assert.equal(w.mist.i - before, n, q);
    assert.ok(s.splashes.some((e) => e.n === 8), 'and the sea washes off her back');
    assert.equal(a.seq[0].kind, 'breath');
  }
});

test('the blow comes out of her blowhole', () => {
  const s = setup({ v: 0 }), { w } = s; quiet(w);
  const a = whaleUp(s, [{ kind: 'breath', dur: 6 }, { kind: 'glide', dur: 50 }]);
  let at = null;
  const real = w.mist.puff.bind(w.mist);
  w.mist.puff = (p, n) => { at = p.clone(); real(p, n); };
  s.step(1 / 30, 6 * 30 * 0.32);
  assert.ok(at, 'she blew');
  assert.ok(at.distanceTo(a.g.position) < 6 && at.distanceTo(a.g.position) > 2, 'near her head');
  const toNose = at.clone().sub(a.g.position), nose = fwd(a.h);
  assert.ok(toNose.x * nose.x + toNose.z * nose.z > 2, 'forward of her middle');
});

test('a breach bursts clear of the water and falls back with a great splash', () => {
  const s = setup({ v: 0 }), { w } = s; quiet(w);
  const a = whaleUp(s, [{ kind: 'breach', dur: 5 }, { kind: 'glide', dur: 50 }]);
  let high = -99, roll = 0;
  s.step(1 / 30, 5 * 30 + 3, (t) => { high = Math.max(high, a.g.position.y); roll = Math.max(roll, a.g.rotation.z); });
  assert.ok(high > 1.5, `she reaches ${high} m`);
  close(roll, 1.7, 0.02, 'she falls on her side');
  assert.deepEqual(s.splashes.filter((e) => e.n >= 30).map((e) => e.n), [30, 90, 60]);
  assert.equal(a.seq[0].kind, 'glide');
});

test('a dive arches her down with her flukes up, and the flukes slip in with a splash', () => {
  const s = setup({ v: 0 }), { w } = s; quiet(w);
  const a = whaleUp(s, [{ kind: 'dive', dur: 10 }]);
  let pitch = 0, y = 0;
  s.step(1 / 30, 10 * 30 - 2, () => { pitch = Math.min(pitch, a.g.rotation.x); y = a.g.position.y; });
  close(pitch, -1.25, 0.01, 'she tips right over');
  assert.ok(y < -8, `and she is down at ${y} m`);
  assert.ok(s.splashes.some((e) => e.n === 18));
});

test('between surfacings her depth never jumps', () => {
  const s = setup({ v: 0 }), { w } = s; quiet(w);
  const a = whaleUp(s, [{ kind: 'glide', dur: 3 }, { kind: 'breath', dur: 6 }, { kind: 'glide', dur: 4 }, { kind: 'breath', dur: 6 }, { kind: 'glide', dur: 4 }, { kind: 'dive', dur: 10 }]);
  let last = null;
  s.step(1 / 30, 32 * 30, () => {
    if (a.state === 'up' && last !== null) assert.ok(Math.abs(a.g.position.y - last) < 0.25, `a step of ${a.g.position.y - last} m`);
    last = a.g.position.y;
  });
});

test('she swims at her own speed, along her heading', () => {
  const s = setup({ v: 0 }), { w } = s; quiet(w);
  const a = whaleUp(s, [{ kind: 'glide', dur: 100 }]), x = a.x, z = a.z;
  s.step(1 / 30, 300);
  close(Math.hypot(a.x - x, a.z - z), 1.6 * 10, 0.15, 'ten seconds at 1.6 m/s');
});

test('a boat closing on her sends her down after this breath', () => {
  const other = { x: 1e5, z: 0 }, s = setup({ v: 0, boats: [other] }), { w } = s; quiet(w);
  const a = whaleUp(s, [{ kind: 'glide', dur: 5 }, { kind: 'breath', dur: 6 }, { kind: 'glide', dur: 9 }, { kind: 'breath', dur: 6 }, { kind: 'dive', dur: 10 }]);
  s.step(1 / 30, 3);
  assert.equal(a.seq.length, 5);
  other.x = a.x + 30; other.z = a.z;
  s.step(1 / 30, 1);
  assert.deepEqual(a.seq.map((q) => q.kind), ['glide', 'dive']);
});

test('once she is diving or breaching no boat changes what she does', () => {
  const other = { x: 1e5, z: 0 }, s = setup({ v: 0, boats: [other] }), { w } = s; quiet(w);
  const a = whaleUp(s, [{ kind: 'breach', dur: 5 }, { kind: 'breath', dur: 6 }, { kind: 'glide', dur: 9 }, { kind: 'dive', dur: 10 }]);
  other.x = a.x + 30; other.z = a.z;
  s.step(1 / 30, 3);
  assert.equal(a.seq.length, 4);
});

// ---------- the mist ----------
test('a blow rises, spreads on the wind and fades away', () => {
  const s = setup(), m = s.w.mist, at = new THREE.Vector3(10, 2, -5);
  m.puff(at, 20);
  const P = m.pts.geometry.attributes.position, A = m.pts.geometry.attributes.aA, Sz = m.pts.geometry.attributes.aS, ys = [];
  for (let i = 0; i < 20; i++) m.update(0.05, 400, 3, 0);
  for (let i = 0; i < 20; i++) { if (A.getX(i) > 0) ys.push(P.getY(i)); assert.ok(A.getX(i) >= 0 && A.getX(i) <= 0.75); assert.ok(Sz.getX(i) >= 0.9 && Sz.getX(i) <= 5); }
  assert.ok(ys.length > 10, 'most of it is showing');
  assert.ok(ys.every((y) => y > 2), 'above the blowhole');
  for (let i = 0; i < 200; i++) m.update(0.05, 300, 3, 0);
  for (let i = 0; i < 20; i++) { assert.equal(A.getX(i), 0, 'gone'); assert.equal(P.getY(i), -50, 'and put away'); close(Sz.getX(i), 5); }
  assert.equal(m.u.uScale.value, 300);
});

test('the wind takes the mist downwind', () => {
  const { w } = setup(), m = w.mist;
  m.puff(new THREE.Vector3(), 30);
  for (let i = 0; i < 30; i++) m.update(0.05, 400, 4, -2);
  const q = m.p.slice(0, 30), x = q.reduce((a, b) => a + b.x, 0) / 30, z = q.reduce((a, b) => a + b.z, 0) / 30;
  assert.ok(x > 1, `drifted ${x} m`); assert.ok(z < -0.4, `drifted ${z} m`);
});

test('the mist re-uses its oldest drops', () => {
  const m = setup().w.mist, n = m.p.length;
  m.puff(new THREE.Vector3(), n + 15);
  assert.equal(m.i, 15);
});

// ---------- the long run ----------
test('a whole afternoon of it stays finite, whatever comes and goes', () => {
  const other = { x: 80, z: 40 }, s = setup({ v: 5, boats: [other] }), { w, player } = s;
  w.pod.timer = 5; w.whales[0].timer = 8; w.whales[1].timer = 40;
  const states = new Set();
  s.step(0.1, 25000, (t, i) => {
    player.h += 0.002 * Math.sin(i * 0.01);
    other.x = player.x + 80 * Math.cos(i * 0.001); other.z = player.z + 80 * Math.sin(i * 0.001);
    states.add(w.pod.state); for (const a of w.whales) states.add(a.state);
    assert.ok(w.events.length <= 12); w.events.length = 0;
  });
  assert.ok(['come', 'ride', 'go', 'away', 'up', 'deep'].every((k) => states.has(k)), `saw ${[...states]}`);
  assertFiniteTree(s.scene, 'the wildlife');
  for (const m of under(s.scene, (o) => o.isPoints || (o.isMesh && !o.isSkinnedMesh))) assertSoundGeometry(m.geometry, 'an animal', { lines: true });
});

test('a frame with no time in it moves nothing', () => {
  const s = setup(), { w } = s; quiet(w);
  s.step(1 / 30, 5);
  const before = w.gulls.map((b) => b.p.clone());
  s.player.v = 0;
  s.step(0, 3);
  w.gulls.forEach((b, i) => { if (b.mode === 'fly') assert.ok(b.p.distanceTo(before[i]) < 1e-9); });
});

test('a whale never comes up on dry land', () => {
  // a boat in Göcek's bay with the shore on her bow
  let spot = null;
  for (let x = -3000; x <= 3000 && !spot; x += 100) for (let z = -3000; z <= 3000 && !spot; z += 100) {
    if (groundAt(x, z) >= -2) continue;
    for (let a = 0; a < 8 && !spot; a++) { const f = fwd(a * Math.PI / 4); if (groundAt(x + f.x * 250, z + f.z * 250) > 5) spot = { x, z, h: a * Math.PI / 4 }; }
  }
  assert.ok(spot, 'there is such a place');
  const s = setup(); Object.assign(s.player, spot);
  const whale = s.w.whales[0];
  for (let i = 0; i < 300; i++) { s.w.place(whale, s.player); assert.ok(groundAt(whale.x, whale.z) <= 0, `at ${whale.x}, ${whale.z} the land stands ${groundAt(whale.x, whale.z)} m high`); }
});
