// The two committee boats: the motor cruiser and the Lagoon catamaran. Their flags go up and down their halyards as the
// race flies them, each is built whole from her moulded parts, and her end of the line is on the side it should be.
import test from 'node:test';
import assert from 'node:assert/strict';
import './load.mjs';
import { installPage, page, assertSoundGeometry, assertShaderPatch, assertFiniteTree, boundsOf, under, scriptRandom, seedRandom } from './fake-page.mjs';

installPage();
const THREE = await import('three');
const { CommitteeBoat, COMMITTEE_L, COMMITTEE_BOTTOM, flagTexture, bannerTexture, finishes, RoundedBoxGeometry, tube, rod, Flag, officer } = await import('../public/game/committee.js');
const { LagoonCommittee, lagoonReady, LAGOON_WL } = await import('../public/game/lagoon.js');

seedRandom(31337);
const close = (a, b, e = 1e-6, what = '') => assert.ok(Math.abs(a - b) <= e, `${what} ${a} is not ${b}`);
const NONE = { cls: false, P: false, X: false, sub: false }, ALL = { cls: true, P: true, X: true, sub: true };
const painted = (t) => t.image.getContext('2d').rects.map((r) => r.fill);
const lib = THREE.ShaderLib.physical;

// ---------- flags ----------
test('each code flag is drawn in its own colours', () => {
  const want = { P: ['#1f4fa8', '#fff'], U: ['#fff', '#d22'], B: ['#111'], X: ['#fff', '#1f4fa8'], blue: ['#1f4fa8'], orange: ['#ff6a10'] };
  for (const [k, cols] of Object.entries(want)) {
    const seen = painted(flagTexture(k));
    for (const c of cols) assert.ok(seen.includes(c), `${k} shows ${c}`);
    assert.equal(flagTexture(k).colorSpace, THREE.SRGBColorSpace);
  }
});

test('the first substitute and the burgee are pennants, cut to a point', () => {
  for (const k of ['sub', 'burgee']) {
    const x = flagTexture(k).image.getContext('2d');
    assert.ok(x.counts.fill >= 2); assert.equal(x.rects.length, 0);
  }
});

test('the class flag carries the class\'s letter', () => {
  const x = flagTexture('anything').image.getContext('2d');
  assert.equal(x.texts[0].text, 'R');
  assert.equal(x.rects[0].fill, '#f2c230');
});

test('the banner says who she is, and what she is told to', () => {
  assert.equal(bannerTexture().image.getContext('2d').texts[0].text, 'RACE COMMITTEE');
  assert.equal(bannerTexture('JURY').image.getContext('2d').texts[0].text, 'JURY');
  assert.equal(bannerTexture().anisotropy, 4);
});

test('a flag flies from its hoist, the hoist staying on the halyard', () => {
  const f = new Flag(flagTexture('P'), 1.2, 0.8), P = f.mesh.geometry.attributes.position;
  f.update(3, 0.5, 8);
  for (let i = 0; i < P.count; i++) if (f.base[i * 3 + 2] < 1e-6) { close(P.getX(i), 0, 1e-9, 'x at the hoist'); close(P.getZ(i), 0, 1e-9, 'z at the hoist'); }
  assert.ok(Math.max(...P.array.filter((_, i) => i % 3 === 0).map(Math.abs)) > 0.01, 'and the fly ripples');
  assertSoundGeometry(f.mesh.geometry, 'a flag');
});

test('a flag points downwind, give or take a little swing', () => {
  const f = new Flag(flagTexture('P'), 1, 1);
  for (let t = 0; t < 20; t += 0.37) { f.update(t, 1.1, 6); assert.ok(Math.abs(f.pivot.rotation.y - 1.1) <= 0.12 + 1e-9); }
});

test('the harder it blows the harder a flag flogs, up to a limit', () => {
  const amp = (wind) => { const f = new Flag(flagTexture('P'), 1, 1); let m = 0; for (let t = 0; t < 6; t += 0.11) { f.update(t, 0, wind); for (let i = 0; i < f.mesh.geometry.attributes.position.count; i++) m = Math.max(m, Math.abs(f.mesh.geometry.attributes.position.getX(i))); } return m; };
  assert.ok(amp(10) > amp(1) * 1.5);
  close(amp(60), 0.16, 0.01, 'the limit');
});

test('a lowered flag does no work', () => {
  const f = new Flag(flagTexture('P'), 1, 1), v = f.mesh.geometry.attributes.position.version;
  f.pivot.visible = false;
  f.update(1, 0, 5);
  assert.equal(f.mesh.geometry.attributes.position.version, v);
});

test('a pennant is cut out of its cloth, a square flag is not', () => {
  assert.equal(new Flag(flagTexture('sub'), 1, 1, true).mat.alphaTest, 0.5);
  assert.equal(new Flag(flagTexture('P'), 1, 1).mat.alphaTest, 0);
});

// ---------- the bits she is built from ----------
test('a rounded box is the size it was asked for, and centred', () => {
  const g = new RoundedBoxGeometry(1.3, 0.42, 0.55, 3, 0.06), b = boundsOf(g);
  assertSoundGeometry(g, 'a rounded box');
  close(b.size.x, 1.3, 0.01, 'w'); close(b.size.y, 0.42, 0.01, 'h'); close(b.size.z, 0.55, 0.01, 'd');
  for (const k of ['x', 'y', 'z']) close(b.min[k], -b.max[k], 0.01, k);
});

test('a rod runs from one point to the other', () => {
  const a = [1, 2, 3], b = [4, -2, 8], g = rod(a, b, 0.05), B = boundsOf(g);
  assertSoundGeometry(g, 'a rod');
  close(B.min.x, 1, 0.06); close(B.max.x, 4, 0.06); close(B.min.y, -2, 0.06); close(B.max.y, 2, 0.06);
});

test('a rod straight down is still a rod', () => {
  const g = rod([0, 5, 0], [0, 0, 0], 0.05);
  assertSoundGeometry(g, 'a rod downward');
  close(boundsOf(g).size.y, 5, 1e-6);
});

test('a tube follows its points', () => {
  const g = tube([[0, 0, 0], [1, 0, 0], [2, 1, 0]], 0.02), b = boundsOf(g);
  assertSoundGeometry(g, 'a tube');
  close(b.max.x, 2, 0.05); close(b.max.y, 1, 0.05);
});

test('her finishes are made once and shared by every committee boat', () => {
  assert.equal(finishes(), finishes());
  assert.equal(finishes().gel.clearcoat, 0.8);
});

test('the deck\'s baked shade darkens the sun on it as well as the sky\'s light', () => {
  const F = finishes();
  const sh = assertShaderPatch(F.deck, lib, 'the deck');
  assert.match(sh.fragmentShader, /texture2D\(aoMap, vAoMapUv\)/);
  assert.equal(F.deck.customProgramCacheKey(), 'cbDeck');
  assert.equal(F.deck.aoMap, F.teak.aoMap, 'one shade for both decks');
  assert.deepEqual([F.deck.aoMap.image.width, F.deck.aoMap.image.height], [147, 480]);
});

// ---------- the race officers ----------
test('an officer wears what he is given, a little over life size', () => {
  const s = officer(0, '#c8342b', 'horn'), jacket = new THREE.Color('#c8342b'), C = s.mesh.geometry.attributes.color;
  assert.equal(s.g.scale.x, 1.1);
  let worn = 0;
  for (let i = 0; i < C.count; i++) if (Math.abs(C.getX(i) - jacket.r) < 0.12 && Math.abs(C.getY(i) - jacket.g) < 0.12 && Math.abs(C.getZ(i) - jacket.b) < 0.12) worn++;
  assert.ok(worn > 100, `${worn} vertices of her jacket`);
});

test('each pose puts the right thing in his hands', () => {
  const extras = (pose) => { const s = officer(1, '#123456', pose); return s.upper.children.filter((o) => o.isMesh && o.geometry.type !== 'BufferGeometry').map((m) => m.geometry.type); };
  assert.ok(extras('glasses').includes('BoxGeometry'));
  assert.ok(extras('horn').includes('CylinderGeometry'));
  assert.ok(extras('board').includes('BoxGeometry'));
  assert.deepEqual(extras('halyard'), []);
  assert.deepEqual(extras('wheel'), []);
});

test('the halyard pose has one hand up and the other hauling', () => {
  const s = officer(2, '#123456', 'halyard'), [l, r] = s.arms;
  assert.ok(r.rotation.z > l.rotation.z + 1);
});

// ---------- the motor cruiser ----------
const boat = (...a) => new CommitteeBoat(...a);

test('she is a sound 13 m cruiser', () => {
  const b = boat(), box = new THREE.Box3().setFromObject(b.root);
  assert.equal(COMMITTEE_L, 13); assert.match(COMMITTEE_BOTTOM, /^#[0-9a-f]{6}$/);
  const hull = under(b.root, (o) => o.isMesh && o.geometry.attributes.band)[0];
  assert.ok(hull, 'the moulded hull came in from committee.glb');
  const size = boundsOf(hull.geometry).size;
  assert.ok(size.z > 12 && size.z < 16, `${size.z} m long`);
  assert.ok(size.x > 3.8 && size.x < 4.9, `${size.x} m in the beam`);
  assert.ok(box.max.y > 8.8, 'with her mast above all');
  for (const m of under(b.root)) assertSoundGeometry(m.geometry, 'a part of her', { lines: !m.isMesh });
  assertFiniteTree(b.root, 'the committee boat');
});

test('everything solid on her casts and takes shadows', () => {
  for (const m of under(boat().root, (o) => o.isMesh)) { assert.equal(m.castShadow, true); assert.equal(m.receiveShadow, true); }
});

test('her hull\'s wet line is her own, on her own length', () => {
  const a = boat(), b = boat();
  assert.notEqual(a.sea, b.sea);
  close(a.sea.uHalfL.value, 6.5);
});

test('she flies four signal halyards, the orange flag and her burgee', () => {
  const b = boat();
  assert.deepEqual(Object.keys(b.flags).sort(), ['P', 'X', 'cls', 'sub']);
  assert.ok(b.orange); assert.ok(b.burgee);
  assert.equal(b.officers.length, 5);
  assert.equal(b.flags.sub.mat.alphaTest, 0.5, 'the first substitute is a pennant');
});

test('the orange flag stands on the side the pin lies, where the line meets her', () => {
  const s = boat(1, 3).orange.pivot.position, p = boat(-1, 3).orange.pivot.position;
  assert.ok(s.x > 0); assert.ok(p.x < 0); close(s.x, -p.x, 1e-9);
  close(s.z, 3);
  close(boat(1, 100).orange.pivot.position.z, 3.9, 1e-9, 'held to her side deck');
  close(boat(1, -100).orange.pivot.position.z, 2.8, 1e-9);
});

test('her officers face the line, whichever side it is', () => {
  const s = boat(1), p = boat(-1);
  close(s.officers[0].s.g.rotation.y, 0); close(p.officers[0].s.g.rotation.y, Math.PI);
  assert.ok(s.officers[0].s.g.position.x > 0); assert.ok(p.officers[0].s.g.position.x < 0);
  assert.equal(s.officers[0].steady, true, 'binoculars held steady');
  assert.equal(s.officers[1].steady, false);
});

test('under way she is a sister ship with no signals, no anchor and a helmsman', () => {
  const b = boat(1, 0, { underway: true, banner: 'JURY' }), n = boat();
  assert.deepEqual(Object.keys(b.flags), []);
  assert.equal(b.orange, undefined);
  assert.equal(b.officers.length, 3);
  assert.equal(b.officers[0].steady, true, 'at the wheel');
  const tris = (x) => under(x.root, (o) => o.isMesh).reduce((s, m) => s + m.geometry.attributes.position.count, 0);
  assert.ok(tris(b) < tris(n), 'fewer parts on her');
  const texts = under(b.root, (o) => o.isMesh && o.material.map?.image?.getContext).flatMap((m) => m.material.map.image.getContext('2d').texts.map((t) => t.text));
  assert.ok(texts.includes('JURY'));
});

test('under way only her burgee flies', () => {
  const b = boat(1, 0, { underway: true }), r0 = b.burgee.pivot.rotation.y;
  assert.doesNotThrow(() => b.update(1, 0.1, ALL, 'P', 0.7, 8));
  assert.notEqual(b.burgee.pivot.rotation.y, r0);
});

test('on her first frame the flags are shown as they stand, without being hoisted', () => {
  const b = boat();
  b.update(0, 0.016, { cls: true, P: false, X: true, sub: false }, 'P', 0, 5);
  assert.equal(b.flags.cls.h, 1); assert.equal(b.flags.P.h, 0);
  assert.equal(b.flags.cls.pivot.visible, true); assert.equal(b.flags.P.pivot.visible, false);
  assert.ok(b.flags.cls.pivot.position.distanceTo(b.flags.cls.top) < 1e-9);
  assert.ok(b.flags.P.pivot.position.distanceTo(b.flags.P.bot) < 1e-9);
});

test('a flag is hoisted up its halyard in a second and a half, not switched', () => {
  const b = boat(), f = b.flags.P;
  b.update(0, 0.016, NONE, 'P', 0, 5);
  let t = 0, last = 0;
  while (f.h < 1 && t < 3) { t += 0.05; b.update(t, 0.05, { ...NONE, P: true }, 'P', 0, 5); assert.ok(f.h > last); last = f.h; }
  close(t, 1.4, 0.06, 'the time');
  assert.equal(f.h, 1);
  assert.ok(f.pivot.position.distanceTo(f.top) < 1e-9, 'at the block');
});

test('half way up it is half way along its halyard', () => {
  const b = boat(), f = b.flags.X;
  b.update(0, 0.016, NONE, 'P', 0, 5);
  b.update(0.7, 0.7, { ...NONE, X: true }, 'P', 0, 5);
  close(f.h, 0.5, 1e-9);
  assert.ok(f.pivot.position.distanceTo(new THREE.Vector3().lerpVectors(f.bot, f.top, 0.5)) < 1e-9);
});

test('a flag comes down as it went up, and is put away when it is down', () => {
  const b = boat(), f = b.flags.P;
  b.update(0, 0.016, { ...NONE, P: true }, 'P', 0, 5);
  let t = 0;
  while (f.h > 0 && t < 3) { t += 0.1; b.update(t, 0.1, NONE, 'P', 0, 5); }
  close(t, 1.4, 0.11);
  assert.equal(f.pivot.visible, false);
});

test('after a long stall the flags are simply where they should be', () => {
  const b = boat(), f = b.flags.P;
  b.update(0, 0.016, NONE, 'P', 0, 5);
  b.update(9, 5, { ...NONE, P: true }, 'P', 0, 5);
  assert.equal(f.h, 1);
});

test('the preparatory flag is P, U or black as the race says', () => {
  const b = boat(), P = b.flags.P.mat;
  const P0 = P.map;
  b.update(0, 0.016, NONE, 'U', 0, 5); assert.equal(P.map, b.prepTex.U); assert.notEqual(P.map, P0);
  const v = P.version;
  b.update(0.1, 0.016, NONE, 'U', 0, 5); assert.equal(P.version, v, 'nothing to do when it is already up');
  b.update(0.2, 0.016, NONE, 'B', 0, 5); assert.equal(P.map, b.prepTex.B);
  b.update(0.3, 0.016, NONE, null, 0, 5); assert.equal(P.map, P0, 'and P when the race has not said');
});

test('a finish boat flies the blue flag on the class flag\'s halyard', () => {
  const b = boat();
  assert.equal(b.finishing(), b);
  assert.ok(painted(b.flags.cls.mat.map).includes('#1f4fa8'));
});

test('hours at anchor leave her sound', () => {
  const b = boat();
  for (let i = 0; i < 3000; i++) b.update(i * 0.05, 0.05, { cls: i % 400 < 200, P: i % 300 < 90, X: i % 500 < 40, sub: false }, 'P', Math.sin(i * 0.01), 4 + 3 * Math.sin(i * 0.03));
  assertFiniteTree(b.root, 'the committee boat');
  for (const f of Object.values(b.flags)) { assert.ok(f.h >= 0 && f.h <= 1); assertSoundGeometry(f.mesh.geometry, 'a flag'); }
});

// ---------- the Lagoon ----------
const cat = (...a) => new LagoonCommittee(...a);

test('her model has come in, and she can be sent out', () => {
  assert.equal(lagoonReady, true);
  assert.equal(LAGOON_WL, 12.3);
  assert.ok(page.fetched.some((u) => u.endsWith('lagoon42.glb')));
});

test('she is a sound catamaran: two hulls, 12.8 m long and 7.5 m across', () => {
  const b = cat(), hull = under(b.root, (o) => o.isMesh && o.geometry.attributes.band)[0], s = boundsOf(hull.geometry).size;
  assert.ok(s.z > 12 && s.z < 14, `${s.z} m long`);
  assert.ok(s.x > 6.8 && s.x < 8.2, `${s.x} m across`);
  assert.deepEqual(b.hulls.map((h) => h.x), [-2.95, 2.95]);
  for (const h of b.hulls) { assert.equal(h.loa, 12.3); assert.equal(h.wlb, 1.35); }
  for (const m of under(b.root)) assertSoundGeometry(m.geometry, 'a part of her', { lines: !m.isMesh });
  assertFiniteTree(b.root, 'the catamaran');
});

test('her mast stands nearly 20 m up', () => {
  const box = new THREE.Box3().setFromObject(cat().root);
  assert.ok(box.max.y > 20 && box.max.y < 23, `${box.max.y} m`);
});

test('she rolls less than the motor cruiser, being so beamy', () => {
  const b = cat();
  assert.equal(b.roll, 0.16); assert.equal(b.pitch, 0.3);
  assert.equal(b.bottom, '#1e2126');
  close(b.sea.uHalfL.value, 6.4);
});

test('the orange flag stands on the hull nearer the line', () => {
  const s = cat(1, 4.5).orange.pivot.position, p = cat(-1, 4.5).orange.pivot.position;
  assert.ok(s.x > 2.95); assert.ok(p.x < -2.95); close(s.x, -p.x, 1e-9);
  close(cat(1, 100).orange.pivot.position.z, 4.9); close(cat(1, -100).orange.pivot.position.z, 4.2);
});

test('her flags run on the spreaders, as the cruiser\'s do on the yard', () => {
  const b = cat();
  assert.deepEqual(Object.keys(b.flags).sort(), ['P', 'X', 'cls', 'sub']);
  for (const f of Object.values(b.flags)) { assert.ok(f.top.y > 9 && f.top.y < 9.2); assert.ok(f.bot.y < f.top.y); }
  assert.ok(b.flags.cls.top.x > 0); assert.ok(b.flags.P.top.x < 0);
});

test('she runs her signals with the cruiser\'s own routine', () => {
  const b = cat(), f = b.flags.P;
  assert.equal(b.update, CommitteeBoat.prototype.update);
  b.update(0, 0.016, NONE, 'P', 0.3, 6);
  b.update(0.7, 0.7, { ...NONE, P: true }, 'P', 0.3, 6);
  close(f.h, 0.5, 1e-9);
  b.update(1, 0.016, NONE, 'B', 0.3, 6);
  assert.equal(f.mat.map, b.prepTex.B);
  assert.equal(b.finishing(), b);
  assert.ok(painted(b.flags.cls.mat.map).includes('#1f4fa8'));
});

test('her crew are at their stations, and her helmsman holds his glasses steady', () => {
  const b = cat(), p = cat(-1);
  assert.equal(b.officers.length, 5);
  assert.equal(b.officers[0].steady, true);
  close(p.officers[0].s.g.rotation.y, Math.PI);
  assert.ok(b.officers[1].s.g.position.x > 0); assert.ok(p.officers[1].s.g.position.x < 0);
});

test('the net she stands on lets shadows through it', () => {
  const nets = under(cat().root, (o) => o.isMesh && o.material.alphaTest);
  assert.ok(nets.length > 0, 'she has one');
  for (const m of nets) assert.equal(m.receiveShadow, false);
});

test('the shader patches on her decks all give their uniforms a value', () => {
  const seen = new Set();
  for (const m of under(cat().root, (o) => o.isMesh)) {
    const mat = m.material;
    if (seen.has(mat) || mat.onBeforeCompile === THREE.Material.prototype.onBeforeCompile) continue;
    seen.add(mat);
    assertShaderPatch(mat, lib, mat.name || 'a material of the Lagoon');
  }
  assert.ok(seen.size >= 3, `${seen.size} patched materials`);
});

test('hours at anchor leave her sound too', () => {
  const b = cat();
  for (let i = 0; i < 1500; i++) b.update(i * 0.05, 0.05, { cls: i % 400 < 200, P: i % 300 < 90, X: false, sub: i % 700 < 30 }, 'U', Math.cos(i * 0.01), 6);
  assertFiniteTree(b.root, 'the catamaran');
});

test('the same random draw gives the same flag\'s swing, and another a different one', () => {
  const put = scriptRandom([0.5]); const a = new Flag(flagTexture('P'), 1, 1); put();
  const again = scriptRandom([0.5]); const b = new Flag(flagTexture('P'), 1, 1); again();
  assert.equal(a.phase, b.phase); close(a.phase, 3);
});
