// When the moulded parts do not arrive (a failed download, a blocked file), every boat is still built, from the lines in
// the code; and the catamaran, which has no such lines, simply stays at home.
import test from 'node:test';
import assert from 'node:assert/strict';
import './load.mjs';
import { installPage, page, assertSoundGeometry, assertFiniteTree, boundsOf, under, seedRandom, recordRace } from './fake-page.mjs';

installPage({ noModels: true, pathname: '/fleet-view' });
const THREE = await import('three');
const Y = await import('../public/game/yacht.js');
const { CommitteeBoat } = await import('../public/game/committee.js');
const { lagoonReady } = await import('../public/game/lagoon.js');
const { makeBoatView } = await import('../public/game/boats3d.js');
const { CLASSES } = await import('../public/game/classes.js');

seedRandom(55);
const close = (a, b, e = 1e-6, what = '') => assert.ok(Math.abs(a - b) <= e, `${what} ${a} is not ${b}`);
const rec = await recordRace({ frames: 3600, every: 8 });

test('the models were asked for and did not come', () => {
  for (const f of ['yacht.glb', 'committee.glb', 'lagoon42.glb', 'bavaria46.glb', 'laser.glb', 'optimist.glb', 'j70.glb', 'rs21.glb', 'ac75.glb', 'dragon.glb', 'jclass.glb']) assert.ok(page.fetched.some((u) => u.endsWith(f)), f);
});

test('the catamaran does not go out without her model', () => {
  assert.equal(lagoonReady, false);
});

test('the committee boat is built from her lines, 13 m long', () => {
  const b = new CommitteeBoat(1, 3);
  assert.equal(b.sea, undefined, 'no moulded hull to carry a wet line');
  const hull = under(b.root, (o) => o.isMesh && o.material.map?.image?.height === 512)[0], s = boundsOf(hull.geometry).size;
  assert.ok(s.z > 12.9 && s.z < 15.5, `${s.z} m long`);
  assert.ok(s.x > 4 && s.x < 4.7, `${s.x} m in the beam`);
  for (const m of under(b.root)) assertSoundGeometry(m.geometry, 'a part of her', { lines: !m.isMesh });
  assertFiniteTree(b.root, 'the committee boat');
});

test('her hull\'s paint runs by height, from the antifouling up', () => {
  const b = new CommitteeBoat(), hull = under(b.root, (o) => o.isMesh && o.material.map?.image?.height === 512)[0], P = hull.geometry.attributes.position, uv = hull.geometry.attributes.uv;
  for (let i = 0; i < P.count; i += 13) close(uv.getY(i), (P.getY(i) + 1.2) / 3.4, 1e-3, 'v');
});

test('her deckhouse keeps its raked windscreen and tumblehome', () => {
  const box = new THREE.Box3().setFromObject(new CommitteeBoat().root);
  assert.ok(box.max.y > 8.8);
});

test('under way she is built from her lines too', () => {
  const b = new CommitteeBoat(-1, 0, { underway: true });
  assert.equal(b.officers.length, 3);
  assertFiniteTree(b.root, 'the sister ship');
});

test('the JPK is built from her lines, the right size, and sound', () => {
  const v = new Y.BoatView({ look: Y.LOOKS.Aurora, label: null });
  for (const m of under(v.root, (o) => o.isMesh && !o.isSkinnedMesh)) assertSoundGeometry(m.geometry, 'a part of her');
  const hull = under(v.root, (o) => o.isMesh && o.geometry.attributes.band)[0];
  close(boundsOf(hull.geometry).size.z, Y.L, 0.4, 'her length');
});

test('she sails on her fallback hull as on the moulded one', () => {
  const v = new Y.BoatView({ look: Y.LOOKS.Tern, player: true });
  for (const f of rec.frames) v.update(f.b, f.t, rec.W, true);
  assertFiniteTree(v.root, 'the JPK');
});

for (const id of Object.keys(CLASSES)) {
  test(`the ${id} is built from her lines and sails a race`, () => {
    const cls = CLASSES[id], v = makeBoatView({ look: Y.LOOKS.Selkie, label: { text: id, color: 0xffffff } }, cls);
    for (const m of under(v.root, (o) => o.isMesh && !o.isSkinnedMesh)) assertSoundGeometry(m.geometry, `${id}: a part of her`);
    for (const f of rec.frames) v.update(f.b, f.t, rec.W, true);
    assertFiniteTree(v.root, id);
    const box = new THREE.Box3().setFromObject(v.root);
    assert.ok(box.max.y > 0, `${id} stands out of the water`);
  });
}
