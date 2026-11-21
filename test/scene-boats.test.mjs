// Every class of yacht the game can race, moulded parts and all: each is the size she should be, and sails a whole
// recorded race, tacks, gybes and spinnakers, with nothing on her going astray.
import test from 'node:test';
import assert from 'node:assert/strict';
import './load.mjs';
import { installPage, page, recordRace, assertSoundGeometry, assertShaderPatch, assertFiniteTree, under, seedRandom } from './fake-page.mjs';

installPage({ pathname: '/fleet-view' });
const THREE = await import('three');
const Y = await import('../public/game/yacht.js');
const B = await import('../public/game/boats3d.js');
const { CLASSES, CLASS_IDS } = await import('../public/game/classes.js');
const { D2R } = await import('../public/game/sim.js');

seedRandom(808);
const close = (a, b, e = 1e-6, what = '') => assert.ok(Math.abs(a - b) <= e, `${what} ${a} is not ${b}`);
const rec = await recordRace({ frames: 7200, every: 12 });
const { W, frames } = rec;
const OTHERS = CLASS_IDS.filter((id) => id !== 'jpk1050');
const make = (id, o = {}) => B.makeBoatView({ look: Y.LOOKS.Halcyon, label: { text: id, color: 0x00ff00 }, ...o }, CLASSES[id]);
const built = {}; // what is only looked at is built once
const boat = (id) => (built[id] ||= make(id));
const moment = (fn) => { const f = frames.find((x) => fn(x.b)); assert.ok(f, 'the race has such a moment'); return f; };
const still = (o = {}) => ({ ...frames[300].b, x: 0, z: 0, h: 0, v: 3, heel: 10, ...o });

test('every yacht\'s moulded parts were asked for on the fleet page', () => {
  for (const f of ['bavaria46.glb', 'laser.glb', 'optimist.glb', 'j70.glb', 'rs21.glb', 'ac75.glb', 'dragon.glb', 'jclass.glb', 'f50.glb']) assert.ok(page.fetched.some((u) => u.endsWith(f)), f);
});

test('each class gets a view of her own kind', () => {
  assert.ok(B.makeBoatView({ look: Y.LOOKS.Aurora }, CLASSES.jpk1050) instanceof Y.BoatView);
  const names = OTHERS.map((id) => boat(id).constructor.name);
  assert.equal(new Set(names.filter((n) => !['SportView'].includes(n))).size, OTHERS.length - 2, `views: ${names}`);
  assert.equal(boat('j70').constructor, boat('rs21').constructor, 'the two sportboats share one');
});

test('the two sportboats float high over the Dragon on the same water, the J/70\'s deeper hull the higher', () => {
  const floatY = (id) => { const v = boat(id); v.place(still(), 5, W); return v.root.position.y; };
  for (const [id, over] of [['rs21', 0.25], ['j70', 0.31]]) close(floatY(id) - floatY('dragon'), over, 1e-6, `the ${id}'s height over the Dragon`);
});

for (const id of OTHERS) {
  test(`the ${id} is sound, every part of her`, () => {
    const v = boat(id);
    for (const m of under(v.root, (o) => o.isMesh && !o.isSkinnedMesh)) assertSoundGeometry(m.geometry, `${id}: a part of her`);
    for (const m of under(v.root, (o) => o.isLine)) assertSoundGeometry(m.geometry, `${id}: a line`, { lines: true });
    assertFiniteTree(v.root, id);
  });

  test(`the ${id} is drawn at her own length`, () => {
    const v = boat(id), cls = CLASSES[id];
    close(v.drawnL, cls.drawnL ?? cls.loa, 0.6, 'her drawn length');
    const hulls = under(v.tilt, (o) => o.isMesh && !o.isSkinnedMesh && o.geometry.boundingBox !== undefined);
    assert.ok(hulls.length > 0);
    const box = new THREE.Box3().setFromObject(v.tilt).getSize(new THREE.Vector3());
    assert.ok(box.z >= cls.loa * 0.9, `${box.z} m along her for ${cls.loa} m`);
    assert.ok(box.y > 2, `she stands ${box.y} m tall`);
  });

  test(`the ${id} has her crew and they stay aboard`, () => {
    const v = make(id), cls = CLASSES[id];
    assert.ok(v.crew.length >= 1, 'someone aboard');
    for (let i = 0; i < frames.length; i += 2) {
      v.update(frames[i].b, frames[i].t, W, false);
      for (const c of v.crew) {
        assert.ok(Math.abs(c.z ?? 0) < cls.loa * 0.75, `${id}: a sailor ${c.z} m along her`);
        assert.ok(Math.abs(c.x ?? 0) < Math.max(cls.beam * 1.3, 2.3), `${id}: a sailor ${c.x} m off her centreline`);
      }
    }
  });

  test(`the ${id} sails a whole race and nothing goes wild`, () => {
    const v = make(id, { player: true, label: null }), scene = new THREE.Scene(); scene.add(v.root);
    v.setCrewNear(true, 1);
    for (const [i, f] of frames.entries()) {
      v.update(f.b, f.t, W, true);
      Y.feel(v, rec.dt);
      if (i % 100 === 0) {
        Y.crewFrame();
        assert.equal(v.root.position.x, f.b.x); assert.equal(v.root.position.z, f.b.z);
        close(v.root.rotation.y, -f.b.h, 1e-9);
      }
    }
    assertFiniteTree(v.root, id);
    for (const s of [v.main, v.jib, v.kite]) if (s?.userData?.g) assertSoundGeometry(s.userData.g, `${id}: a sail`);
  });

  test(`the ${id} shows less of herself far off, and never loses her sails`, () => {
    const v = make(id);
    v.setDetail(false);
    assert.ok(v.small.length > 0);
    for (const o of v.small) assert.equal(o.visible, false);
    for (const s of [v.main, v.jib]) if (s) assert.ok(s.children.every((m) => m.visible), `${id}: her sails show`);
    v.setDetail(true);
    for (const o of v.small) assert.equal(o.visible, true);
    v.setCrewNear(false);
    for (const c of v.crew) assert.equal(c.s.lo.visible, true);
  });

  test(`every painted patch on the ${id} gives its uniforms a value`, () => {
    const seen = new Set();
    for (const m of under(boat(id).root, (o) => o.isMesh)) {
      const mat = m.material;
      if (seen.has(mat) || mat.onBeforeCompile === THREE.Material.prototype.onBeforeCompile || mat.isShaderMaterial) continue;
      seen.add(mat);
      assertShaderPatch(mat, mat.isMeshPhysicalMaterial ? THREE.ShaderLib.physical : THREE.ShaderLib.standard, `${id}: a material`);
    }
    assert.ok(seen.size >= 1);
  });

  test(`the ${id} heels the way the boat heels and hoists her sail on the side it is on`, () => {
    const v = make(id);
    for (let i = 0; i < 80; i++) v.update(still({ twa: 0.9, boom: 1, sail: 25, heel: 12 }), i * 0.05, [], false);
    const a = v.tilt.rotation.z;
    for (let i = 0; i < 80; i++) v.update(still({ twa: -0.9, boom: -1, sail: 25, heel: 12 }), 4 + i * 0.05, [], false);
    assert.ok(Math.sign(a) === 1 && Math.sign(v.tilt.rotation.z) === -1, `${a} then ${v.tilt.rotation.z}`);
    if (v.mainPivot) assert.ok(Math.abs(v.mainPivot.rotation.y) > 0.1, 'her boom is out');
  });
}

test('a yacht with a kite flies it when the race says so', () => {
  const f = moment((b) => b.kite && b.kiteFill > 0.95);
  for (const id of OTHERS.filter((x) => CLASSES[x].kite)) {
    const v = make(id);
    for (let i = 0; i < 30; i++) v.update(f.b, f.t + i * 0.1, W, false);
    assert.equal(v.kite.visible, true, id);
    for (let i = 0; i < 30; i++) v.update(still({ kite: false, kiteFill: 0 }), f.t + 5 + i * 0.1, W, false);
    assert.equal(v.kite.visible, false, id);
  }
});

test('the AC75 lifts out of the water when she flies, her windward arm canted up', () => {
  const v = make('ac75');
  for (let i = 0; i < 200; i++) v.update(still({ v: 20, ride: 1, twa: 0.7, boom: 1 }), i * 0.05, [], false);
  assert.ok(v.root.position.y > 1, `at ${v.root.position.y} m`);
  const [a, b] = v.arms.map((g) => Math.abs(g.userData.cant));
  assert.ok(Math.max(a, b) > 1.5 && Math.min(a, b) < 0.2, `the arms at ${a} and ${b}`);
  for (let i = 0; i < 200; i++) v.update(still({ v: 0.5, ride: 0, twa: 0.7, boom: 1 }), 10 + i * 0.05, [], false);
  assert.ok(v.root.position.y < 1, 'and settles when she stops');
  assert.ok(Math.abs(v.arms[0].userData.cant) < 0.2 && Math.abs(v.arms[1].userData.cant) < 0.2, 'both arms down');
});

// the F50 flies on her leeward board, the windward one raised; her six stand in the windward hull and, when she tacks,
// run across the nets to the other one, a few seconds' crossing, their feet on the net
test('the F50 flies on her leeward board, and her crew cross the nets to the new windward hull', () => {
  const v = make('f50'), HX = 3.7;
  let t = 0;
  const sail = (o, n) => { for (let i = 0; i < n; i++) v.update(still({ v: 22, ride: 1, ...o }), (t += 0.05), [], false); };
  sail({ twa: 0.7, boom: 1 }, 200);
  assert.ok(v.root.position.y > 1, `flying at ${v.root.position.y} m`);
  const up = (sx) => v.boards.find((g) => Math.sign(g.position.x) === sx).userData.up;
  assert.ok(up(1) > 2 && up(-1) < 0.2, `the windward board up ${up(1)}, the leeward ${up(-1)}`);
  for (const c of v.crew) close(c.x, HX, 0.05, 'in the windward hull:');
  sail({ twa: -0.7, boom: -1 }, 20); // a second after the tack: on their way, on the net
  const mid = v.crew.filter((c) => Math.abs(c.x) < HX - 0.7);
  assert.ok(mid.length >= 3, `${mid.length} of six out on the net`);
  for (const c of mid) close(c.y, 0.99, 0.05, 'their feet on the net:');
  sail({ twa: -0.7, boom: -1 }, 80);
  for (const c of v.crew) close(c.x, -HX, 0.05, 'across in the new windward hull:');
  assert.ok(up(-1) > 2 && up(1) < 0.2, 'and the boards changed over');
});

test('the Optimist\'s and the Laser\'s insides are kept dry by a lid the sea stops at', () => {
  assert.equal(B.DRY_ORDER, 0.5);
  for (const id of ['laser', 'optimist']) {
    const lids = under(boat(id).root, (o) => o.isMesh && o.userData.dry);
    assert.ok(lids.length >= 1, id);
    for (const l of lids) { assert.equal(l.renderOrder, B.DRY_ORDER); assert.equal(l.material.colorWrite, false); assert.equal(l.castShadow, false); }
  }
});

test('a boat\'s heel is drawn as her class shows it: a dinghy is sailed flat', () => {
  const heel = (id) => { const v = make(id); v.update(still({ heel: 20, twa: 0.8, boom: 1 }), 1, [], false); return Math.abs(v.tilt.rotation.z) / D2R; };
  assert.ok(heel('laser') < heel('bavaria46'), `${heel('laser')} against ${heel('bavaria46')}`);
});

test('a reef brings the head of a racing main down the mast', () => {
  const top = (v) => { let m = -9; const P = v.main.userData.g.attributes.position; for (let i = 0; i < P.count; i++) m = Math.max(m, P.getY(i)); return m; };
  const v = make('dragon');
  v.update(still({ reefFill: 0 }), 1, [], false); const full = top(v);
  v.update(still({ reefFill: 1 }), 2, [], false);
  assert.ok(top(v) <= full, `${top(v)} against ${full}`);
});

test('no yacht carries more sailors than her class races with', () => {
  for (const id of OTHERS) assert.ok(boat(id).crew.length <= CLASSES[id].crew, `${id}: ${boat(id).crew.length} aboard, ${CLASSES[id].crew} in her class`);
});

test('the boats\' looks follow what the player chose', () => {
  const v = make('j70', { look: Y.lookFrom({ hull: '#102030', deck: 'hull' }) });
  const hull = under(v.tilt, (o) => o.isMesh && o.material.color?.getHexString?.() === '102030');
  assert.ok(hull.length > 0, 'her hull is the colour chosen');
});
