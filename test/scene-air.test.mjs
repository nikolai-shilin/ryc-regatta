// What flies over the course: the banner plane keeps its line, clears the hills and trails its banner; the jets at cruise
// cross the sky on straight tracks and leave it when their trails have gone; the airliners are built to their published
// sizes and lay their shadow across your boat. All picture, so what matters is that it stays where it should, for ever.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mock } from './load.mjs';
import { installPage, page, runIdle, assertSoundGeometry, assertFiniteTree, boundsOf, under, watchDispose, seedRandom, scriptRandom } from './fake-page.mjs';

// what the admin has put on the banner, as each test wants it
mock('public/game/sponsor.js', 'export const sponsor = () => Promise.resolve(globalThis.__sponsor ?? null);');
installPage();
const THREE = await import('three');
const { BannerPlane, BANNER } = await import('../public/game/plane.js');
const { Jets } = await import('../public/game/jets.js');
const { Airliner } = await import('../public/game/airliners.js');
const { TYPES, LIVERIES, airframe } = await import('../public/game/airliner-model.js');
const { HALF, route } = await import('../public/game/airports.js');
const { skyUniforms } = await import('../public/game/light.js');

seedRandom(4242);
const close = (a, b, e = 1e-6, what = '') => assert.ok(Math.abs(a - b) <= e, `${what} ${a} is not ${b}`);
const tick = () => new Promise((r) => setImmediate(r));
function camera(x = 0, y = 12, z = 30) {
  const c = new THREE.PerspectiveCamera(50, 16 / 9, 0.5, 9000);
  c.position.set(x, y, z); c.lookAt(x, 1, z - 60); c.updateMatrixWorld(true); c.updateProjectionMatrix();
  return c;
}
const finite = (v) => [v.x, v.y, v.z].every(Number.isFinite);

// ---------- the banner plane ----------
const SPEED = 28, ROPE = 45, DROP = 8 * Math.PI / 180, BANNER_H = 4.6, PASS = 1800;
function flying(ground = () => -10, cam = camera()) {
  const p = new BannerPlane();
  p.reset({}, ground);
  p.timer = 0;
  p.update(0.1, cam);
  assert.equal(p.on, true);
  return { p, cam };
}

test('the plane is about 7 m long and 10.7 m across, her nose forward, and sound', () => {
  const g = new BannerPlane().craft.children[0].geometry, b = boundsOf(g);
  assertSoundGeometry(g, 'the plane');
  close(b.size.x, 10.7, 0.01, 'her span');
  assert.ok(b.size.z > 6.7 && b.size.z < 7.4, `her length is ${b.size.z}`);
  assert.ok(b.min.z < -3.4 && b.max.z < 3.6, 'the spinner leads');
  assert.ok(g.attributes.color, 'she is painted');
});

test('she is hidden until a pass begins', () => {
  const p = new BannerPlane();
  assert.equal(p.group.visible, false);
  p.show(true); assert.equal(p.group.visible, true);
  p.reset({}); assert.equal(p.group.visible, false);
});

test('with no race set nothing happens', () => {
  const p = new BannerPlane();
  assert.doesNotThrow(() => p.update(1, camera()));
  assert.equal(p.on, false);
});

test('the first pass comes early in the sequence', () => {
  for (let i = 0; i < 40; i++) { const p = new BannerPlane(); p.reset({}); assert.ok(p.timer >= 15 && p.timer <= 30); }
});

test('she waits for her time, for the clock to run, and for the camera to settle', () => {
  const p = new BannerPlane(), c = camera();
  p.reset({}); p.timer = 5;
  p.update(1, c); assert.equal(p.on, false); close(p.timer, 4);
  p.timer = 0;
  p.update(0, c); assert.equal(p.on, false, 'not while the clock stands');
  p.update(1, c, false); assert.equal(p.on, false, 'not during the fly-in');
  p.update(1, c, true); assert.equal(p.on, true);
  assert.equal(p.group.visible, true);
});

test('a pass crosses the view side-on, 170 to 300 m off', () => {
  for (let i = 0; i < 20; i++) {
    const c = camera(i * 40, 12, -i * 25), { p } = flying(() => -10, c), look = c.getWorldDirection(new THREE.Vector3());
    assert.ok(p.D >= 170 && p.D <= 300, `${p.D} m off`);
    const across = Math.abs(p.f.x * look.x + p.f.z * look.z) / Math.hypot(look.x, look.z);
    assert.ok(across < Math.sin(0.5 + 1e-6), `she flies ${across} along the look`);
  }
});

test('she holds a straight line at her cruising speed', () => {
  const { p, cam } = flying(), a = p.p.clone();
  for (let i = 0; i < 100; i++) p.update(0.1, cam);
  const d = p.p.clone().sub(a);
  close(Math.hypot(d.x, d.z), SPEED * 10, 1e-6, 'the distance flown');
  close(d.x / Math.hypot(d.x, d.z), p.f.x, 1e-6); close(p.v.x, p.f.x * SPEED, 1e-9); close(p.v.z, p.f.z * SPEED, 1e-9);
});

test('over the sea she flies low enough to read and high enough to trail her banner clear', () => {
  for (let i = 0; i < 30; i++) {
    const { p, cam } = flying();
    for (let k = 0; k < 400; k++) {
      p.update(0.25, cam);
      if (!p.on) break;
      assert.ok(p.p.y > BANNER_H / 2 + ROPE * Math.sin(DROP) + 2.5 && p.p.y < 47, `at ${p.p.y} m`);
      const bottom = p.weight.position.y; assert.ok(bottom > 0, `the banner's foot is at ${bottom} m`);
    }
  }
});

test('she climbs to 45 m over any land on her track, and no steeper than she can', () => {
  const hill = (x, z) => 120 * Math.exp(-(x * x + z * z) / (260 * 260)) - 5;
  const hits = () => { let n = 0; return (x, z) => (++n <= 31 ? -10 : hill(x, z)); }; // the line is chosen over the sea
  const c = camera(0, 12, 200), { p } = flying(hits(), c);
  for (let i = 0; i < p.alts.length; i++) {
    const s = i * 20, g = hill(p.x0 + p.f.x * s, p.z0 + p.f.z * s);
    if (g > 0) assert.ok(p.alts[i] >= g + 45 - 1e-3, `${p.alts[i]} m over land of ${g} m`);
  }
  for (let i = 1; i < p.alts.length; i++) assert.ok(Math.abs(p.alts[i] - p.alts[i - 1]) <= 0.18 * 20 + 1e-4, 'her climb is limited');
});

test('she clears the land under the banner trailing behind her as well', () => {
  // the same line laid twice: once to learn where it runs, then with a ridge square across it, 100 m wide, at 900 m along
  const lay = (ground) => { const back = scriptRandom([0.5]), p = new BannerPlane(), cam = camera(); p.reset({}, ground); p.timer = 0; p.update(0.1, cam); back(); return p; };
  const l = lay(() => -10), ridge = (x, z) => (Math.abs((x - l.x0) * l.f.x + (z - l.z0) * l.f.z - 900) < 50 ? 80 : -10);
  const p = lay(ridge), at = (s) => p.alts[Math.round(s / 20)];
  assert.equal(p.x0, l.x0);
  assert.ok(at(810) >= 125, `already up as she reaches it: ${at(810)} m`);
  assert.ok(at(1060) >= 125, `still up while the banner crosses it: ${at(1060)} m`);
  assert.ok(at(1600) < at(1060), 'and down again when it is clear');
});

test('of the lines she tries she takes the first over open water', () => {
  let n = 0;
  const p = new BannerPlane(), cam = camera(); p.reset({}, () => (++n <= 31 ? 100 : -10)); p.timer = 0;
  p.update(0.1, cam);
  assert.equal(p.top, 0);
});

test('with land under all of them she takes the line with the least', () => {
  const tops = [90, 60, 75, 30, 88, 44, 52, 66, 71, 80, 95, 40];
  let n = 0;
  const p = new BannerPlane(), cam = camera(); p.reset({}, () => { const v = n < 372 ? tops[Math.floor(n / 31)] : 5; n++; return v; }); p.timer = 0;
  p.update(0.1, cam);
  assert.equal(p.top, 30);
});

test('the tow rope runs from her tail down and aft to the banner\'s pole', () => {
  const { p, cam } = flying();
  for (let i = 0; i < 300; i++) p.update(0.05, cam);
  const R = p.rope.geometry.attributes.position, v = (i) => new THREE.Vector3().fromBufferAttribute(R, i), hook = v(0), end = v(p.ropeN);
  close(hook.distanceTo(new THREE.Vector3(0, -0.05, 3.4).applyMatrix4(p.craft.matrixWorld)), 0, 1e-3, 'it starts at the hook');
  assert.ok(end.y < hook.y - ROPE * Math.sin(DROP) + 1e-3 + 0.01);
  close(hook.distanceTo(end), ROPE, 1, 'its length');
  assert.ok(((end.x - hook.x) * p.f.x + (end.z - hook.z) * p.f.z) < -40, 'it trails aft');
  const mid = v(p.ropeN / 2), straight = (hook.y + end.y) / 2;
  close(straight - mid.y, 1.4, 0.05, 'its sag');
  close(v(p.ropeN + 1).y - v(p.ropeN + 2).y, BANNER_H, 1e-3, 'the bridle spreads to the pole\'s two ends');
});

test('the banner streams aft of the pole, its full length and height', () => {
  const { p, cam } = flying();
  for (let i = 0; i < 200; i++) p.update(0.05, cam);
  const P = p.banner.geometry.attributes.position, pole = p.pole.position;
  for (let i = 0; i < P.count; i++) {
    const aft = -((P.getX(i) - pole.x) * p.f.x + (P.getZ(i) - pole.z) * p.f.z);
    assert.ok(aft > -1e-3 && aft < p.len + 1e-3, `${aft} m aft of the pole`);
  }
  const last = (65 * 5) - 1, aftEnd = -((P.getX(last) - pole.x) * p.f.x + (P.getZ(last) - pole.z) * p.f.z);
  close(aftEnd, p.len, 1e-3, 'the free end');
  close(P.getY(0) - P.getY(65 * 4), BANNER_H, 1e-3, 'its height at the pole');
  assertSoundGeometry(p.banner.geometry, 'the banner');
  assert.ok(p.banner.geometry.boundingSphere.radius > p.len / 2 - 1, 'its bounds follow it');
  close(p.weight.position.y, pole.y - BANNER_H / 2 - 0.2, 1e-6, 'the weight hangs under the pole');
});

test('the banner ripples more at the free end than at the pole', () => {
  const { p, cam } = flying(), lat = (n) => { const P = p.banner.geometry.attributes.position, l = [-Math.cos(p.h), -Math.sin(p.h)]; return (P.getX(n) - p.pole.position.x) * l[0] + (P.getZ(n) - p.pole.position.z) * l[1]; };
  let near = 0, far = 0;
  for (let i = 0; i < 120; i++) { p.update(0.05, cam); near = Math.max(near, Math.abs(lat(0))); far = Math.max(far, Math.abs(lat(64))); }
  assert.ok(far > near * 3, `${far} at the free end, ${near} at the pole`);
});

test('her propeller turns', () => {
  const { p, cam } = flying(), a = p.prop.rotation.z;
  p.update(0.1, cam);
  close(p.prop.rotation.z - a, 4.7, 1e-9);
});

test('when the banner has gone by she is gone, and comes again in a minute or two', () => {
  const { p, cam } = flying();
  let t = 0;
  while (p.on && t < 200) { p.update(0.1, cam); t += 0.1; }
  assert.equal(p.on, false);
  assert.equal(p.group.visible, false);
  close(t, (PASS + ROPE + p.len) / SPEED, 0.5, 'the time of a pass');
  assert.ok(p.timer >= 60 && p.timer <= 120);
});

test('pass after pass she stays finite and comes round again', () => {
  const p = new BannerPlane(), cam = camera();
  p.reset({}, (x, z) => 40 * Math.sin(x / 300) * Math.cos(z / 260));
  let passes = 0, was = false;
  for (let i = 0; i < 12000; i++) {
    p.update(0.2, cam);
    if (p.on && !was) passes++;
    was = p.on;
    assert.ok(finite(p.p) && finite(p.v));
  }
  assert.ok(passes >= 4, `${passes} passes`);
  assertFiniteTree(p.group, 'the plane');
  assertSoundGeometry(p.banner.geometry, 'the banner');
  assertSoundGeometry(p.rope.geometry, 'the rope', { lines: true });
});

test('the banner\'s words are the game\'s own until the admin sets some', async () => {
  globalThis.__sponsor = null;
  const p = new BannerPlane(), map = p.banner.material.map;
  await tick();
  assert.equal(p.banner.material.map, map);
  assert.deepEqual(map.image.getContext('2d').texts.map((t) => t.text), BANNER);
  assert.equal(map.colorSpace, THREE.SRGBColorSpace);
});

test('the admin\'s words replace them, on a new texture, and the old one is let go', async () => {
  globalThis.__sponsor = { banner: ['HELLO', 'WORLD'] };
  const p = new BannerPlane(8), old = p.banner.material.map, seen = watchDispose(old);
  await tick();
  globalThis.__sponsor = null;
  const map = p.banner.material.map;
  assert.notEqual(map, old);
  assert.equal(seen.count, 1);
  assert.deepEqual(map.image.getContext('2d').texts.map((t) => t.text), ['HELLO', 'WORLD']);
  assert.equal(map.anisotropy, 8);
  assert.ok(p.len >= 30 && p.len <= 90);
});

test('one line alone has no red dot and no second part', async () => {
  globalThis.__sponsor = { banner: ['ONLY THIS', ''] };
  const p = new BannerPlane();
  await tick();
  globalThis.__sponsor = null;
  const x = p.banner.material.map.image.getContext('2d');
  assert.deepEqual(x.texts.map((t) => t.text), ['ONLY THIS']);
  assert.equal(x.counts.arc ?? 0, 0);
});

test('the back of the banner reads the same way round as its front', () => {
  const m = new BannerPlane().banner.material, sh = { fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  m.onBeforeCompile(sh);
  assert.match(sh.fragmentShader, /if \(!gl_FrontFacing\) bannerUv\.x = 1\.0 - bannerUv\.x;/);
  assert.doesNotMatch(sh.fragmentShader, /#include <map_fragment>/);
  assert.equal(m.side, THREE.DoubleSide);
});

test('an empty or malformed answer changes nothing', async () => {
  for (const s of [{ banner: [] }, { banner: 'text' }, {}]) {
    globalThis.__sponsor = s;
    const p = new BannerPlane(), map = p.banner.material.map;
    await tick();
    assert.equal(p.banner.material.map, map);
  }
  globalThis.__sponsor = null;
});

test('a very long banner is squeezed to the largest texture, and keeps its true length', async () => {
  globalThis.__sponsor = { banner: ['W'.repeat(200)] };
  const p = new BannerPlane();
  await tick();
  globalThis.__sponsor = null;
  const c = p.banner.material.map.image;
  assert.ok(c.width <= 4096, `${c.width} texels wide`);
  assert.equal(p.len, 90, 'as long as a banner goes');
});

// ---------- the jets ----------
const R = 4000, SEE = 120000, JET = 235, BIG = 3;
const newJets = () => new Jets(skyUniforms(), { value: 0 });

test('a jet is about 40 m long, and sound', () => {
  const g = newJets().jetGeo, b = boundsOf(g);
  assertSoundGeometry(g, 'the jet');
  assert.ok(b.size.z > 36 && b.size.z < 44, `${b.size.z} m long`);
  assert.ok(b.size.x > 34 && b.size.x < 37, `${b.size.x} m across`);
  assert.ok(b.min.z < -17, 'her nose is at −z');
});

test('a contrail is a ribbon: two sides at every step, aged from the engines back', () => {
  const g = newJets().trailGeo, u = g.attributes.aU, s = g.attributes.aSide;
  assertSoundGeometry(g, 'the trail');
  assert.equal(u.count, 97 * 2);
  assert.equal(u.getX(0), 0); assert.equal(u.getX(u.count - 1), 1);
  for (let i = 0; i < u.count; i += 2) { assert.equal(s.getX(i), -1); assert.equal(s.getX(i + 1), 1); assert.equal(u.getX(i), u.getX(i + 1)); }
});

test('before a race the sky is empty', () => {
  const j = newJets();
  j.update(10, camera());
  assert.equal(j.list.length, 0);
});

test('the sky is not empty when you get there: two or three already crossing it', () => {
  for (let i = 0; i < 30; i++) {
    const j = newJets();
    j.reset({ player: { x: 10, z: 20 } });
    assert.ok(j.list.length === 2 || j.list.length === 3);
    assert.equal(j.group.children.length, j.list.length * 2);
    for (const a of j.list) assert.ok(a.s >= 0.15 * a.len && a.s <= 0.8 * a.len);
  }
});

test('reset clears the sky of the last race\'s jets and disposes of their shaders', () => {
  const j = newJets(); j.reset();
  const old = j.list.slice(), seen = old.flatMap((a) => [watchDispose(a.trail.material), watchDispose(a.jet.material)]);
  j.reset({ player: { x: 0, z: 0 } });
  assert.deepEqual(seen.map((s) => s.count), seen.map(() => 1));
  for (const a of old) assert.ok(!j.group.children.includes(a.jet));
  assert.equal(j.group.children.length, j.list.length * 2);
});

test('a track passes within 45 km of the course, at cruise, and is as long as the haze allows', () => {
  const j = newJets(), o = { x: 500, z: -300 };
  for (let i = 0; i < 100; i++) {
    const a = j.spawn(o);
    const mx = a.x0 + a.f.x * a.len / 2, mz = a.z0 + a.f.z * a.len / 2, off = Math.hypot(mx - o.x, mz - o.z);
    assert.ok(off <= 45000 + 1e-6, `${off} m off`);
    close((mx - o.x) * a.f.x + (mz - o.z) * a.f.z, 0, 1e-6, 'its middle is the nearest point');
    close(Math.hypot(a.x0 - o.x, a.z0 - o.z), SEE, 1e-6, 'it starts at the edge of the haze');
    assert.ok(a.y >= 9500 && a.y <= 12000);
  }
});

test('she points the way she flies', () => {
  const j = newJets(), a = j.spawn({ x: 0, z: 0 });
  const nose = new THREE.Vector3(0, 0, -1).applyEuler(a.jet.rotation);
  close(nose.x, a.f.x, 1e-9); close(nose.z, a.f.z, 1e-9);
});

test('she is drawn on the sphere round the camera, in her true direction, at her angular size', () => {
  const j = newJets(), c = camera(100, 20, -40); j.reset({ player: { x: 0, z: 0 } }); j.timer = 1e9;
  j.update(1, c);
  for (const a of j.list) {
    const real = new THREE.Vector3(a.x0 + a.f.x * a.s, a.y, a.z0 + a.f.z * a.s), d = real.distanceTo(c.position);
    close(a.jet.position.distanceTo(c.position), R, 1e-6, 'on the sphere');
    close(a.jet.position.clone().sub(c.position).normalize().dot(real.sub(c.position).normalize()), 1, 1e-9, 'in her direction');
    close(a.jet.scale.x, BIG * R / d, 1e-9, 'at her size');
  }
});

test('her trail starts from where she really is', () => {
  const j = newJets(); j.reset(); j.timer = 1e9;
  j.update(2, camera());
  for (const a of j.list) { close(a.u.uJet.value.x, a.x0 + a.f.x * a.s, 1e-6); close(a.u.uJet.value.y, a.y); close(a.u.uAge.value, a.age); }
});

test('she fades into the haze with the distance', () => {
  const j = newJets(), c = camera(); j.timer = 1e9;
  const a = j.spawn({ x: 0, z: 0 }, 0);
  a.x0 = 0; a.z0 = 0; a.f = { x: 1, z: 0 }; a.s = 1000; j.update(0, c); close(a.fade.value, 1, 1e-9, 'near');
  a.s = 0.8 * SEE; j.update(0, c); close(a.fade.value, 0.5, 1e-2, 'half way into the haze');
  a.s = SEE; j.update(0, c); close(a.fade.value, 0, 1e-3, 'gone');
});

test('past the end of her track she is out of sight, and her trail stays until it has aged away', () => {
  const j = newJets(), c = camera(); j.timer = 1e9;
  const a = j.spawn({ x: 0, z: 0 }, 0);
  a.s = a.len + 1; j.update(0, c);
  assert.equal(a.jet.visible, false); assert.ok(j.list.includes(a));
  const seen = [watchDispose(a.jet.material), watchDispose(a.trail.material)];
  a.s = a.len + a.life * JET + 1; j.update(0.1, c);
  assert.ok(!j.list.includes(a));
  assert.deepEqual(seen.map((s) => s.count), [1, 1]);
  assert.ok(!j.group.children.includes(a.trail));
});

test('there are never more than five in the sky, and they stay finite however long the race', () => {
  const j = newJets(), c = camera(); j.reset({ player: { x: 0, z: 0 } });
  let most = 0, spawned = new Set(j.list);
  for (let i = 0; i < 6000; i++) {
    j.update(1, c, { player: { x: i, z: -i } });
    most = Math.max(most, j.list.length);
    for (const a of j.list) { spawned.add(a); assert.ok(finite(a.jet.position), 'position'); assert.ok(a.fade.value >= 0 && a.fade.value <= 1); }
  }
  assert.ok(most <= 5, `${most} at once`);
  assert.ok(spawned.size > 10, 'and new ones keep coming');
  assert.equal(j.group.children.length, j.list.length * 2, 'with nothing left behind');
});

test('no jet comes while the clock stands still', () => {
  const j = newJets(), c = camera(); j.reset(); j.timer = -1;
  const n = j.list.length;
  j.update(0, c);
  assert.equal(j.list.length, n);
});

test('with no race a new jet is laid across the camera\'s sky', () => {
  const j = newJets(), c = camera(5000, 10, 7000); j.timer = 0; j.reset(); j.timer = 0; j.list.length = 0; j.group.clear();
  j.update(1, c);
  assert.equal(j.list.length, 1);
  const a = j.list[0], mx = a.x0 + a.f.x * a.len / 2, mz = a.z0 + a.f.z * a.len / 2;
  assert.ok(Math.hypot(mx - 5000, mz - 7000) <= 45000 + 1);
});

// ---------- the airliners themselves ----------
for (const T of Object.values(TYPES)) {
  test(`the ${T.id} is built to her published dimensions`, () => {
    const a = airframe(T, LIVERIES[0]), b = boundsOf(a.paint);
    close(b.size.z, T.L, 0.08 * T.L, 'her length');
    close((b.min.z + b.max.z) / 2, 0, 0.06 * T.L, 'centred on her middle');
    assert.ok(b.size.x >= 2 * T.semi * 0.93 && b.size.x <= 2 * T.semi * 1.1, `a span of ${b.size.x} for ${2 * T.semi}`);
    assert.ok(b.max.y > T.fin.h * 0.9, 'her fin stands up');
  });

  test(`every part of the ${T.id} is sound, with unit normals and colours in range`, () => {
    for (const liv of [LIVERIES[0], LIVERIES[3]]) {
      const a = airframe(T, liv);
      for (const k of ['paint', 'metal', 'decal', 'up', 'down', 'fan']) {
        const g = a[k];
        assertSoundGeometry(g, `${T.id} ${k}`);
        const N = g.attributes.normal;
        for (let i = 0; i < N.count; i += 3) { const l = Math.hypot(N.getX(i), N.getY(i), N.getZ(i)); assert.ok(Math.abs(l - 1) < 0.02, `${k}: a normal of length ${l}`); }
        const C = g.attributes.color;
        if (C) for (let i = 0; i < C.count * 3; i++) assert.ok(C.array[i] >= 0 && C.array[i] <= 1.2, `${k}: a colour of ${C.array[i]}`);
      }
    }
  });

  test(`the ${T.id}'s wheels and flaps hang below her clean wing`, () => {
    const a = airframe(T, LIVERIES[1]), up = boundsOf(a.up), down = boundsOf(a.down);
    assert.ok(down.min.y < up.min.y - 1, `${down.min.y} with the wheels down, ${up.min.y} clean`);
    assert.ok(down.min.y < -T.R * T.q - T.gear.h * 0.9);
  });

  test(`the ${T.id}'s two engines and her lights are set either side of her`, () => {
    const a = airframe(T, LIVERIES[2]);
    assert.equal(a.fans.length, 2);
    close(a.fans[0][0], -a.fans[1][0], 1e-9, 'the fans');
    close(Math.abs(a.fans[0][0]), T.eng.x, 0.5, 'where the pylon is');
    close(a.fans[0][2], a.fans[1][2], 1e-9);
    const L = a.lights;
    close(L.tips[0][0], -L.tips[1][0], 1e-9, 'the tips');
    assert.ok(Math.abs(L.tips[0][0]) > T.semi * 0.9 && Math.abs(L.tips[0][0]) < T.semi * 1.1);
    close(L.lamps[0][0], -L.lamps[1][0], 1e-9, 'the lamps');
    assert.ok(L.beacon[1] > T.R * T.q);
    assert.equal(L.beacon[0], 0);
  });
}

test('every livery paints every type', () => {
  for (const liv of LIVERIES) for (const T of Object.values(TYPES)) {
    const a = airframe(T, liv), C = a.paint.attributes.color, body = new THREE.Color(liv.fin);
    let hit = 0;
    for (let i = 0; i < C.count; i += 7) if (Math.abs(C.getX(i) - body.r) < 0.06 && Math.abs(C.getY(i) - body.g) < 0.06 && Math.abs(C.getZ(i) - body.b) < 0.06) hit++;
    assert.ok(hit > 0, `${T.id} shows the fin colour ${liv.fin}`);
  }
});

test('an airframe is the same every time it is built', () => {
  const a = airframe(TYPES.a320, LIVERIES[0]), b = airframe(TYPES.a320, LIVERIES[0]);
  assert.deepEqual(a.paint.attributes.position.array, b.paint.attributes.position.array);
  assert.deepEqual(a.paint.attributes.color.array, b.paint.attributes.color.array);
});

test('the types differ as the real ones do: the long-haul pair is about twice the size', () => {
  assert.ok(TYPES.b77w.L > 1.8 * TYPES.b738.L && TYPES.a359.L > 1.7 * TYPES.a320.L);
  assert.equal(TYPES.b77w.wide, true); assert.equal(TYPES.a320.wide, false);
  assert.equal(TYPES.b77w.gear.axles, 3); assert.equal(TYPES.a359.gear.axles, 2);
});

// ---------- flying them ----------
function liner({ ground = () => -20, at = { x: 0, z: 0 }, player = { x: 0, z: 0 }, sun = [0.3, 0.85, 0.2], col = [1, 1, 1] } = {}) {
  const sky = skyUniforms();
  sky.uSun.value.set(...sun).normalize(); sky.uSunCol.value.setRGB(...col);
  const a = new Airliner(sky), race = { at, player: { ...player } };
  a.reset(race, ground);
  return { a, race, sky };
}
const flyTo = (a, s, cam, dt = 0.1) => { let n = 0; while (a.on && a.s < s && n++ < 40000) a.update(dt, cam); };

test('at Göcek she is on the runway the wind favours, with the next one built as the race loads', () => {
  const { a } = liner();
  assert.equal(a.ap.code, 'DLM');
  assert.ok(a.rw.f.z < 0, 'she lands towards −z, where the wind comes from');
  assert.ok(a.next && a.next.map, 'the next one is ready');
  assert.ok(a.timer > 0);
  assert.equal(a.group.visible, false); assert.equal(a.shade.visible, false);
});

test('a reset lets go of the airframe it had ready', () => {
  const { a, race } = liner(), n = a.next, seen = ['paint', 'metal', 'decal', 'up', 'down', 'fan'].map((k) => watchDispose(n[k])), map = watchDispose(n.map);
  a.reset(race);
  assert.deepEqual(seen.map((s) => s.count), [1, 1, 1, 1, 1, 1]);
  assert.equal(map.count, 1);
  assert.notEqual(a.next, n);
});

test('long-haul types come only where they fly to', () => {
  const { a } = liner();
  for (let i = 0; i < 60; i++) { a.next = null; a.build(); assert.equal(a.next.T.wide, false, 'Dalaman takes narrow-bodies'); }
  a.ap = { ...a.ap, wide: true };
  const seen = new Set();
  for (let i = 0; i < 200; i++) { a.next = null; a.build(); seen.add(a.next.T.id); }
  assert.ok(seen.has('b77w') || seen.has('a359'), 'somewhere wide they do');
  assert.ok(seen.has('b738') && seen.has('a320'));
});

test('build leaves one already built alone, and so does dress', () => {
  const { a } = liner(), n = a.next, m = n.map;
  a.build(); a.dress();
  assert.equal(a.next, n); assert.equal(a.next.map, m);
  a.next = null; assert.doesNotThrow(() => a.dress());
});

test('her shadow texture is her outline: dark at her middle, clear at the corners, soft at the edge', () => {
  const { a } = liner(), img = a.next.map.image.pixels, W = 256, al = (x, y) => img.data[(y * W + x) * 4 + 3];
  assert.equal(img.width, W);
  assert.ok(al(128, 128) > 200, 'her fuselage');
  for (const [x, y] of [[2, 2], [253, 2], [2, 253], [253, 253]]) assert.equal(al(x, y), 0, 'the corners');
  let soft = 0;
  for (let i = 0; i < W * W; i++) { const v = img.data[i * 4 + 3]; if (v > 0 && v < 255) soft++; }
  assert.ok(soft > 100, 'an edge the sun has softened');
});

test('she waits for her time, for the clock, and for the fly-in to end', () => {
  const { a } = liner(), c = camera();
  a.timer = 5; a.update(1, c); assert.equal(a.on, false); close(a.timer, 4);
  a.timer = 0; a.update(0, c); assert.equal(a.on, false);
  a.update(1, c, false); assert.equal(a.on, false);
  a.update(1, c); assert.equal(a.on, true);
});

test('coming in she has her wheels down near the field, and going out she is clean', () => {
  const inb = liner().a, back = scriptRandom([0.1]); assert.equal(inb.spawn(), true); back();
  assert.equal(inb.kind, 'in');
  const near = route('in', inb.rw, inb.at).flown < 22000;
  assert.equal(inb.gearDown, near); assert.equal(inb.parts.down.visible, near); assert.equal(inb.parts.up.visible, !near);
  const out = liner().a, b2 = scriptRandom([0.9]); assert.equal(out.spawn(), true); b2();
  assert.equal(out.kind, 'out'); assert.equal(out.gearDown, false);
  assert.equal(out.parts.up.visible, true); assert.equal(out.parts.down.visible, false);
});

test('she takes on the airframe made ready for her, and lights and fans go where it says', () => {
  const { a } = liner(), n = a.next;
  a.spawn();
  assert.equal(a.flying, n); assert.equal(a.next, null);
  for (const k of ['paint', 'metal', 'decal', 'up', 'down']) assert.equal(a.parts[k].geometry, n[k]);
  a.fans.forEach((f, i) => { assert.equal(f.geometry, n.fan); assert.deepEqual(f.position.toArray(), n.fans[i]); });
  assert.deepEqual(a.navs[0].position.toArray(), n.lights.tips[0]);
  assert.equal(a.shade.material.map, n.map);
  assert.equal(a.shade.scale.x, n.size);
});

test('with no airframe ready the pass is put off', () => {
  const { a } = liner();
  a.next = null;
  assert.equal(a.spawn(), false);
  assert.equal(a.on, false);
});

test('hills that would hold her too high keep her away', () => {
  const { a } = liner({ ground: () => 3000 });
  assert.equal(a.spawn(), false);
  assert.equal(a.on, false);
  a.timer = 0; a.update(1, camera());
  assert.equal(a.on, false);
  assert.ok(a.timer > 0, 'she tries again later');
});

test('her shadow crosses your boat when she is overhead', () => {
  for (const kind of [0.1, 0.9]) {
    const { a, race } = liner({ player: { x: 120, z: -300 } }), c = camera(120, 10, -260), back = scriptRandom([kind]);
    a.spawn(); back();
    flyTo(a, 0, c, 0.05);
    const O = a.castAt(a.p.y), d = Math.hypot(a.p.x + O.x - race.player.x, a.p.z + O.z - race.player.z);
    assert.ok(d < 12, `the shadow passes ${d.toFixed(1)} m off the boat`);
  }
});

test('her shadow finds a boat sailing across her track', () => {
  const { a, race } = liner({ player: { x: 0, z: 0 } }), c = camera(), back = scriptRandom([0.1]);
  a.spawn(); back();
  const vx = -a.f.z * 6, vz = a.f.x * 6; // 6 m/s square across her track
  let least = Infinity;
  while (a.on && a.s < 1500) {
    race.player.x += vx * 0.05; race.player.z += vz * 0.05;
    c.position.set(race.player.x, 10, race.player.z + 30);
    a.update(0.05, c);
    if (Math.abs(a.s) < HALF) { const O = a.castAt(a.p.y); least = Math.min(least, Math.hypot(a.p.x + O.x - race.player.x, a.p.z + O.z - race.player.z)); }
  }
  assert.ok(least < 30, `it comes within ${least.toFixed(1)} m`);
});

test('she keeps her height profile, and her speed along her track', () => {
  const back = scriptRandom([0.9]), { a } = liner(), c = camera();
  a.spawn(); back();
  flyTo(a, -3000, c);
  const p0 = a.p.clone(), s0 = a.s;
  a.update(0.1, c);
  close(a.p.distanceTo(p0), a.speed * 0.1, 0.8, 'the way she moves');
  close(a.s - s0, 105 * 0.1, 1e-9, 'climbing out at 105 m/s');
  close(a.p.y, a.altAt(a.s), 1e-6, 'at the height of her profile');
  close(a.craft.rotation.y, -a.h, 1e-9);
  assert.ok(a.v.y > 0, 'and climbing');
});

test('she flies nose first along her track', () => {
  const { a } = liner(), c = camera();
  a.spawn(); flyTo(a, -1000, c);
  const nose = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, a.craft.rotation.y, 0, 'YXZ'));
  close(nose.x, a.f.x, 1e-9); close(nose.z, a.f.z, 1e-9);
});

test('she comes out of the haze small and is full size over the course', () => {
  const { a } = liner(), c = camera();
  a.spawn(); a.s = -HALF + 50; a.update(0.1, c);
  assert.ok(a.craft.scale.x < 0.1, `${a.craft.scale.x} of her size`);
  a.s = 0; a.update(0.1, c);
  assert.equal(a.craft.scale.x, 1);
});

test('her landing lights blaze when she points at you and dim when she has gone by', () => {
  const { a } = liner(), c = camera();
  a.spawn(); flyTo(a, -2000, c);
  const towards = a.lamps[0].material.opacity;
  flyTo(a, 2000, c);
  const away = a.lamps[0].material.opacity;
  assert.ok(towards > 0.7, `${towards} coming`); close(away, 0.08, 1e-6, 'going');
});

test('her beacon and strobes flash, the strobes twice in each beat', () => {
  const { a } = liner(), c = camera();
  a.spawn(); a.s = -1000;
  const seen = new Set(), strobes = new Set();
  for (let i = 0; i < 100; i++) { a.update(0.02, c); seen.add(a.beacon.material.opacity); strobes.add(a.strobes[0].material.opacity); }
  assert.deepEqual([...seen].sort(), [0, 1]); assert.deepEqual([...strobes].sort(), [0, 1]);
});

test('her fans turn', () => {
  const { a } = liner(), c = camera();
  a.spawn(); a.s = -500; a.update(0.1, c);
  const r = a.fans[0].rotation.z; a.update(0.1, c);
  close(a.fans[0].rotation.z - r, 1.3, 1e-9);
});

test('her shadow lies on the water near you when the sun is up', () => {
  const { a } = liner(), c = camera();
  a.spawn(); flyTo(a, 0, c, 0.05);
  assert.equal(a.shade.visible, true);
  assert.equal(a.shade.position.y, 0.5);
  const O = a.castAt(a.p.y);
  close(a.shade.position.x, a.p.x + O.x, 1e-6); close(a.shade.rotation.y, -a.h, 1e-9);
  assert.ok(a.shade.material.opacity > 0 && a.shade.material.opacity <= 0.46);
});

test('no sun, no shadow: not at dusk, nor under a dark sky', () => {
  const low = liner({ sun: [0.9, 0.1, 0] }).a, c = camera();
  low.spawn(); flyTo(low, 0, c, 0.05);
  assert.equal(low.shade.visible, false, 'the sun is too low');
  const dark = liner({ col: [0, 0, 0] }).a;
  dark.spawn(); flyTo(dark, 0, c, 0.05);
  assert.equal(dark.shade.visible, false, 'there is no sunlight');
});

test('her shadow is not drawn on the land', () => {
  const { a } = liner(), c = camera();
  a.spawn(); a.ground = () => 2; flyTo(a, 0, c, 0.05);
  assert.equal(a.shade.visible, false);
});

test('her shadow is not drawn far from you', () => {
  const { a } = liner(), c = camera(5000, 10, 5000);
  a.spawn(); flyTo(a, 0, c, 0.05);
  assert.equal(a.shade.visible, false);
});

test('what you hear left her a while ago: the sound arrives late by the distance it came', () => {
  const { a } = liner(), c = camera(600, 5, 400);
  a.spawn(); flyTo(a, 300, c, 0.05);
  const o = a.sound, f = a.f, here = a.point(a.s, new THREE.Vector3()), back = (here.x - o.p.x) * f.x + (here.z - o.p.z) * f.z;
  assert.ok(back > 0, 'it comes from behind where she is now');
  close(back / a.speed, o.p.distanceTo(c.position) / 343, 0.01, 'the seconds it took');
  close(o.v.x, f.x * a.speed, 1e-9);
  assert.equal(o.out, a.kind === 'out');
});

test('her sound is loudest over the course and dies away at the ends of her track', () => {
  const { a } = liner(), c = camera();
  a.spawn(); flyTo(a, 0, c);
  const mid = a.sound.level;
  a.s = HALF + 480; a.hear(c.position);
  assert.ok(mid > 0.99); assert.ok(a.sound.level < mid);
});

test('past the end of her track she is unseen and heard until the last of it has reached you', () => {
  const { a } = liner(), c = camera();
  a.spawn(); a.s = HALF + 100; a.update(0.1, c);
  assert.equal(a.on, true); assert.equal(a.group.visible, false); assert.equal(a.shade.visible, false);
});

test('when her pass is over the next is built while the page is idle, a step at a time', () => {
  const { a } = liner(), c = camera();
  a.spawn(); a.s = HALF + 3000; a.update(0.1, c);
  assert.equal(a.on, false); assert.equal(a.sound.level, 0);
  assert.equal(a.next, null, 'not during the frame');
  assert.ok(page.idle.length > 0);
  runIdle();
  assert.ok(a.next, 'built');
  assert.ok(a.next.map, 'and dressed');
});

test('where the page has no idle callback the next one is built a moment later instead', () => {
  const { a } = liner(), c = camera(), idle = globalThis.requestIdleCallback, wait = globalThis.setTimeout, waits = [];
  a.spawn();
  globalThis.requestIdleCallback = undefined; globalThis.setTimeout = (f, ms) => { waits.push(ms); f(); return 0; };
  try { a.s = HALF + 3000; a.update(0.1, c); } finally { globalThis.requestIdleCallback = idle; globalThis.setTimeout = wait; }
  assert.deepEqual(waits, [200, 200]);
  assert.ok(a.next?.map);
});

test('the airframe she flew is let go when the next one takes over', () => {
  const { a } = liner(), c = camera();
  a.spawn();
  const old = a.flying, seen = ['paint', 'fan'].map((k) => watchDispose(old[k]));
  a.s = HALF + 3000; a.update(0.1, c); runIdle();
  assert.deepEqual(seen.map((s) => s.count), [0, 0], 'she is still in the parts until then');
  a.spawn();
  assert.deepEqual(seen.map((s) => s.count), [1, 1]);
});

test('pass after pass she stays finite', () => {
  const { a, race } = liner({ ground: (x, z) => 200 * Math.sin(x / 1500) * Math.cos(z / 1300) - 50 }), c = camera();
  let passes = 0, was = false;
  for (let i = 0; i < 9000; i++) {
    race.player.x += 0.3; race.player.z -= 0.2;
    a.update(0.5, c);
    runIdle();
    if (a.on && !was) passes++;
    was = a.on;
    assert.ok(finite(a.p) && finite(a.sound.p), `at step ${i}`);
    assert.ok(a.sound.level >= 0 && a.sound.level <= 1);
  }
  assert.ok(passes >= 2, `${passes} passes`);
  assertFiniteTree(a.group, 'the airliner');
});

test('the whole aeroplane is drawn from sound geometry', () => {
  const { a } = liner();
  a.spawn();
  for (const m of under(a.craft, (o) => o.isMesh && !o.isSprite)) assertSoundGeometry(m.geometry, 'a part of her');
  assert.equal(a.lamps.length + a.navs.length + a.strobes.length + 1, 7, 'two lamps, two navs, two strobes and a beacon');
});
