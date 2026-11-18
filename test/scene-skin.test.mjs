// rigidSkin: a jointed figure made one skinned mesh. Whatever the parts, every vertex follows real bones with weights that
// sum to one, the parts stay where the bones hold them, and their colours come out as they were asked for.
import test from 'node:test';
import assert from 'node:assert/strict';
import './load.mjs';
import { assertSoundGeometry, assertSoundSkin, boundsOf } from './fake-page.mjs';

const THREE = await import('three');
const { rigidSkin } = await import('../public/game/skin.js');

// an arm: a root bone with an elbow 1 m along x, and a box on each
function arm() {
  const root = new THREE.Bone(), elbow = new THREE.Bone();
  elbow.position.x = 1; root.add(elbow);
  return { root, elbow, bones: [root, elbow], box: () => new THREE.BoxGeometry(0.2, 0.2, 0.2) };
}
const SPHERE = new THREE.Sphere(new THREE.Vector3(0.5, 0, 0), 3);
const material = new THREE.MeshBasicMaterial({ vertexColors: true });

test('every vertex follows its own part\'s bone with its whole weight', () => {
  const { root, elbow, bones, box } = arm();
  const m = rigidSkin([[box(), root], [box(), elbow]], bones, root, material, SPHERE);
  const g = m.geometry, n = box().attributes.position.count;
  assertSoundSkin(g, 2);
  assertSoundGeometry(g);
  assert.equal(g.attributes.position.count, 2 * n);
  for (let i = 0; i < 2 * n; i++) {
    assert.equal(g.attributes.skinIndex.getX(i), i < n ? 0 : 1);
    assert.equal(g.attributes.skinWeight.getX(i), 1);
  }
});

test('a part sits where its bone holds it in the rest pose', () => {
  const { root, elbow, bones, box } = arm();
  const m = rigidSkin([[box(), elbow]], bones, root, material, SPHERE);
  const b = boundsOf(m.geometry);
  assert.ok(Math.abs(b.min.x - 0.9) < 1e-6 && Math.abs(b.max.x - 1.1) < 1e-6, `from ${b.min.x} to ${b.max.x}`);
});

test('the part\'s own geometry is left as it was', () => {
  const { root, elbow, bones, box } = arm(), own = box(), before = own.attributes.position.array.slice();
  rigidSkin([[own, elbow]], bones, root, material, SPHERE);
  assert.deepEqual(own.attributes.position.array, before);
  assert.equal(own.attributes.skinIndex, undefined);
});

test('a blend shares a vertex with the next bone and leaves the rest to its own', () => {
  const { root, elbow, bones, box } = arm();
  const blend = (x) => (x > 0 ? [[elbow, 0.25]] : []);
  const m = rigidSkin([[box(), root, null, blend]], bones, root, material, SPHERE), g = m.geometry;
  assertSoundSkin(g, 2);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const out = P.getX(i) > 0;
    assert.equal(g.attributes.skinWeight.getX(i), out ? 0.75 : 1);
    assert.equal(g.attributes.skinWeight.getY(i), out ? 0.25 : 0);
    if (out) assert.equal(g.attributes.skinIndex.getY(i), 1);
  }
});

test('a blend across three other bones still sums to one', () => {
  const a = new THREE.Bone(), b = new THREE.Bone(), c = new THREE.Bone(), d = new THREE.Bone();
  a.add(b, c, d);
  const m = rigidSkin([[new THREE.BoxGeometry(1, 1, 1), a, null, () => [[b, 0.2], [c, 0.3], [d, 0.1]]]], [a, b, c, d], a, material, SPHERE);
  assertSoundSkin(m.geometry, 4);
  assert.ok(Math.abs(m.geometry.attributes.skinWeight.getX(0) - 0.4) < 1e-6);
  assert.deepEqual([1, 2, 3].map((k) => m.geometry.attributes.skinIndex.getComponent(0, k)), [1, 2, 3]);
});

test('a colour paints a part, and a shade darkens it vertex by vertex', () => {
  const { root, bones, box } = arm(), g = box(), n = g.attributes.position.count;
  g.setAttribute('shade', new THREE.BufferAttribute(new Float32Array(n).fill(0.5), 1));
  const m = rigidSkin([[g, root, new THREE.Color(0.8, 0.4, 0.2)]], bones, root, material, SPHERE), col = m.geometry.attributes.color;
  for (let i = 0; i < n; i++) {
    assert.ok(Math.abs(col.getX(i) - 0.4) < 1e-6 && Math.abs(col.getY(i) - 0.2) < 1e-6 && Math.abs(col.getZ(i) - 0.1) < 1e-6);
  }
  assert.equal(m.geometry.attributes.shade, undefined, 'the shade is spent on the colour, not sent to the GPU');
});

test('a colour given as a function is asked at each vertex, in the part\'s own frame', () => {
  const { root, elbow, bones, box } = arm();
  const red = new THREE.Color(1, 0, 0), blue = new THREE.Color(0, 0, 1);
  // the elbow's part stands 1 m along x in the figure, but its own frame is centred on 0
  const m = rigidSkin([[box(), elbow, (x) => (x > 0 ? red : blue)]], bones, root, material, SPHERE), g = m.geometry;
  for (let i = 0; i < g.attributes.position.count; i++) assert.equal(g.attributes.color.getX(i), g.attributes.position.getX(i) > 1 ? 1 : 0);
});

test('the mesh is bound to a skeleton of the bones given, with the root among its children', () => {
  const { root, elbow, bones, box } = arm();
  const m = rigidSkin([[box(), root], [box(), elbow]], bones, root, material, SPHERE);
  assert.ok(m.isSkinnedMesh);
  assert.deepEqual(m.skeleton.bones, bones);
  assert.equal(root.parent, m);
  assert.equal(m.material, material);
});

test('moving a bone moves its part and no other', () => {
  const { root, elbow, bones, box } = arm();
  const m = rigidSkin([[box(), root], [box(), elbow]], bones, root, material, SPHERE);
  const rest = m.getVertexPosition(0, new THREE.Vector3()).clone(), last = m.geometry.attributes.position.count - 1, restEnd = m.getVertexPosition(last, new THREE.Vector3()).clone();
  elbow.position.y = 2; m.updateMatrixWorld(true); m.skeleton.update();
  assert.ok(m.getVertexPosition(0, new THREE.Vector3()).distanceTo(rest) < 1e-6, 'the root\'s part stayed');
  assert.ok(Math.abs(m.getVertexPosition(last, new THREE.Vector3()).y - restEnd.y - 2) < 1e-6, 'the elbow\'s part rose with it');
});

test('its bounds are its own copy of the sphere that holds every pose', () => {
  const { root, bones, box } = arm(), s = SPHERE.clone();
  const m = rigidSkin([[box(), root]], bones, root, material, s);
  assert.notEqual(m.boundingSphere, s);
  assert.equal(m.boundingSphere.radius, 3);
  s.radius = 9;
  assert.equal(m.boundingSphere.radius, 3);
});
