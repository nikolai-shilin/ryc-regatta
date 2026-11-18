// What the camera does after the scene is drawn: the bloom chain is rebuilt only when it must be, each pass goes to the
// right target in the right order, and the sea's mirror is a true reflection that hands the renderer back as it found it.
import test from 'node:test';
import assert from 'node:assert/strict';
import './load.mjs';
import { fakeRenderer, watchDispose } from './fake-page.mjs';

const THREE = await import('three');
const { Post, Mirror, OVERLAY, MIRRORED } = await import('../public/game/post.js');

const close = (a, b, e = 1e-6, what = '') => assert.ok(Math.abs(a - b) <= e, `${what} ${a} is not ${b}`);
const scene = () => new THREE.Scene();
function camera(x = 3, y = 12, z = 40, look = [0, 0, 0]) {
  const c = new THREE.PerspectiveCamera(50, 4 / 3, 0.5, 9000);
  c.position.set(x, y, z); c.lookAt(...look); c.updateMatrixWorld(true);
  return c;
}

// ---------- Post ----------
test('the overlay and the mirror draw on layers of their own', () => {
  assert.notEqual(OVERLAY, MIRRORED);
  assert.ok(OVERLAY > 0 && MIRRORED > 0, 'neither is the default layer');
});

test('it needs WebGL 2', () => {
  assert.equal(Post.supported(fakeRenderer()), true);
  assert.equal(Post.supported(fakeRenderer({ webgl2: false })), false);
});

test('the bloom chain halves the picture at every level', () => {
  const p = new Post(fakeRenderer({ width: 1600, height: 800 }));
  p.size();
  assert.deepEqual(p.mips.map((m) => [m.width, m.height]), [[800, 400], [400, 200], [200, 100], [100, 50], [50, 25]]);
  assert.deepEqual([p.rt.width, p.rt.height], [1600, 800]);
  close(p.mComp.uniforms.uAspect.value, 2);
});

test('the chain of a tiny picture stops at one pixel and never at none', () => {
  const p = new Post(fakeRenderer({ width: 3, height: 1 }));
  p.size();
  assert.equal(p.mips.length, 5);
  for (const m of p.mips) assert.ok(m.width >= 1 && m.height >= 1);
});

test('a canvas with no size yet is treated as one pixel, not divided by', () => {
  const p = new Post(fakeRenderer({ width: 0, height: 0 }));
  p.size();
  assert.deepEqual([p.w, p.h], [1, 1]);
  assert.equal(p.mComp.uniforms.uAspect.value, 1);
});

test('the chain is not rebuilt while the size stays the same', () => {
  const r = fakeRenderer(), p = new Post(r);
  p.size();
  const mips = p.mips.slice(), seen = mips.map(watchDispose);
  for (let i = 0; i < 5; i++) p.render(scene(), camera());
  assert.deepEqual(p.mips, mips);
  assert.deepEqual(seen.map((s) => s.count), [0, 0, 0, 0, 0]);
});

test('a new size disposes the old chain and builds another', () => {
  const r = fakeRenderer(), p = new Post(r);
  p.size();
  const old = p.mips.slice(), seen = old.map(watchDispose);
  r.setSize(1024, 512);
  p.size();
  assert.deepEqual(seen.map((s) => s.count), [1, 1, 1, 1, 1]);
  for (const m of p.mips) assert.ok(!old.includes(m));
  assert.deepEqual([p.mips[0].width, p.mips[0].height], [512, 256]);
  assert.deepEqual([p.rt.width, p.rt.height], [1024, 512]);
});

test('fewer bloom levels rebuild the chain at the next frame, and the same level does not', () => {
  const r = fakeRenderer(), p = new Post(r);
  p.size();
  const before = p.mips;
  p.setLevel({ bloomLevels: 5, samples: 4 });
  p.size();
  assert.equal(p.mips, before, 'nothing changed');
  const seen = before.map(watchDispose);
  p.setLevel({ bloomLevels: 3 });
  assert.equal(p.mips, before, 'not until the next frame');
  p.size();
  assert.equal(p.mips.length, 3);
  assert.deepEqual(seen.map((s) => s.count), [1, 1, 1, 1, 1]);
});

test('a change of multisampling remakes the scene\'s target and leaves the bloom alone', () => {
  const r = fakeRenderer(), p = new Post(r);
  p.size();
  const rt = watchDispose(p.rt), mips = p.mips;
  p.setLevel({ samples: 4 });
  assert.equal(rt.count, 0);
  p.setLevel({ samples: 0 });
  assert.equal(p.rt.samples, 0);
  assert.equal(rt.count, 1);
  p.size();
  assert.equal(p.mips, mips);
});

test('setLook changes what it is given and keeps the rest', () => {
  const p = new Post(fakeRenderer());
  p.setLook({ threshold: 3 });
  assert.equal(p.mPre.uniforms.uThr.value, 3);
  assert.equal(p.mComp.uniforms.uBloomK.value, 0.32);
  p.setLook({ strength: 0, vignette: 0 });
  assert.equal(p.mComp.uniforms.uBloomK.value, 0, 'a strength of nothing is a value, not an absence');
  assert.equal(p.mComp.uniforms.uVig.value, 0);
  assert.equal(p.mPre.uniforms.uThr.value, 3);
});

test('a frame goes scene, prefilter, down the chain, back up, and last to the screen', () => {
  const r = fakeRenderer(), p = new Post(r), s = scene(), c = camera();
  p.render(s, c);
  const M = p.mips, L = r.log;
  assert.equal(L.length, 1 + 1 + (M.length - 1) * 2 + 1);
  assert.equal(L[0].target, p.rt); assert.equal(L[0].scene, s); assert.equal(L[0].camera, c);
  assert.equal(L[1].target, M[0]); assert.equal(L[1].material, p.mPre);
  for (let i = 1; i < M.length; i++) { assert.equal(L[1 + i].target, M[i]); assert.equal(L[1 + i].material, p.mDown); }
  for (let i = 0; i < M.length - 1; i++) { assert.equal(L[1 + M.length + i].target, M[M.length - 2 - i]); assert.equal(L[1 + M.length + i].material, p.mUp); }
  assert.equal(L.at(-1).target, null); assert.equal(L.at(-1).material, p.mComp);
});

test('the way up adds onto the larger step and every other pass clears', () => {
  const r = fakeRenderer(), p = new Post(r);
  p.render(scene(), camera());
  for (const e of r.log.slice(1)) assert.equal(e.autoClear, e.material !== p.mUp, 'autoClear in a pass');
  assert.equal(r.autoClear, true, 'and the renderer\'s own setting is back afterwards');
  assert.equal(p.mUp.blending, THREE.AdditiveBlending);
});

test('each blur step reads the step before it, at that step\'s texel size', () => {
  const r = fakeRenderer({ width: 1000, height: 500 }), p = new Post(r);
  const seen = [], real = r.render;
  r.render = (a, b) => { const m = a.children[0]?.material; if (m === p.mDown || m === p.mUp) seen.push([m, m.uniforms.uIn.value, m.uniforms.uTexel.value.x]); real(a, b); };
  p.render(scene(), camera());
  const M = p.mips, n = M.length;
  for (let i = 1; i < n; i++) { assert.equal(seen[i - 1][1], M[i - 1].texture); close(seen[i - 1][2], 1 / M[i - 1].width); }
  for (let i = n - 1, k = n - 1; i > 0; i--, k++) { assert.equal(seen[k][1], M[i].texture); close(seen[k][2], 0.5 / M[i].width); }
});

test('the composite is given the scene and the widest bloom', () => {
  const p = new Post(fakeRenderer());
  p.render(scene(), camera());
  assert.equal(p.mComp.uniforms.uScene.value, p.rt.texture);
  assert.equal(p.mComp.uniforms.uBloom.value, p.mips[0].texture);
});

test('the labels are drawn after the picture has reached the screen', () => {
  const r = fakeRenderer(), p = new Post(r);
  let at = null;
  p.render(scene(), camera(), () => { at = { target: r.getRenderTarget(), passes: r.log.length }; });
  assert.equal(at.target, null);
  assert.equal(at.passes, r.log.length);
});

test('one bloom level goes straight from the prefilter to the screen', () => {
  const r = fakeRenderer(), p = new Post(r);
  p.setLevel({ bloomLevels: 1 });
  p.render(scene(), camera());
  assert.deepEqual(r.log.map((e) => e.target), [p.rt, p.mips[0], null]);
});

test('dispose lets go of the scene\'s target and the whole chain', () => {
  const p = new Post(fakeRenderer());
  p.size();
  const seen = [p.rt, ...p.mips].map(watchDispose);
  p.dispose();
  assert.deepEqual(seen.map((s) => s.count), [1, 1, 1, 1, 1, 1]);
});

test('dispose lets go of its shaders and its quad too', () => {
  const p = new Post(fakeRenderer());
  const seen = [p.mPre, p.mDown, p.mUp, p.mComp, p.quad.geometry].map(watchDispose);
  p.dispose();
  assert.deepEqual(seen.map((s) => s.count), [1, 1, 1, 1, 1]);
});

// ---------- Mirror ----------
test('the mirror\'s camera sees only what the sea reflects', () => {
  const m = new Mirror(fakeRenderer());
  assert.ok(m.cam.layers.isEnabled(MIRRORED));
  assert.ok(!m.cam.layers.isEnabled(0));
});

test('its target is a little wider than half the picture, and follows the scale', () => {
  const r = fakeRenderer({ width: 1000, height: 500 }), m = new Mirror(r);
  m.render(scene(), camera());
  assert.deepEqual([m.rt.width, m.rt.height], [600, 300]);
  m.setScale(0.25);
  m.render(scene(), camera());
  assert.deepEqual([m.rt.width, m.rt.height], [300, 150]);
});

test('its target is not resized while the picture keeps its size', () => {
  const r = fakeRenderer(), m = new Mirror(r);
  m.render(scene(), camera());
  const seen = watchDispose(m.rt);
  m.render(scene(), camera());
  assert.equal(seen.count, 0);
});

test('it refuses to draw from under the surface', () => {
  for (const y of [-3, 0, 0.05]) {
    const r = fakeRenderer(), m = new Mirror(r);
    assert.equal(m.render(scene(), camera(0, y, 10)), false, `a camera at ${y} m`);
    assert.equal(r.log.length, 0);
    assert.equal(r.clears.length, 0);
    assert.equal(r.getRenderTarget(), null);
  }
});

test('from just over the surface it draws', () => {
  const r = fakeRenderer(), m = new Mirror(r);
  assert.equal(m.render(scene(), camera(0, 0.06, 10)), true);
  assert.equal(r.log.length, 1);
});

test('it draws the scene with its own camera into its own target, cleared to nothing', () => {
  const r = fakeRenderer(), m = new Mirror(r), s = scene();
  m.render(s, camera());
  assert.equal(r.log[0].scene, s); assert.equal(r.log[0].camera, m.cam); assert.equal(r.log[0].target, m.rt);
  assert.equal(r.clears[0].target, m.rt);
  assert.equal(r.clears[0].alpha, 0, 'alpha 0 where nothing is reflected, so the water keeps its sky');
  assert.deepEqual(r.clears[0].clearColor, { r: 0, g: 0, b: 0 });
});

test('it leaves the sun\'s shadow map alone while it draws', () => {
  const r = fakeRenderer(), m = new Mirror(r);
  m.render(scene(), camera());
  assert.equal(r.log[0].shadowAuto, false);
  assert.equal(r.shadowMap.autoUpdate, true);
  r.shadowMap.autoUpdate = false;
  m.render(scene(), camera());
  assert.equal(r.shadowMap.autoUpdate, false, 'off stays off');
});

test('it hands back the render target and the clear colour it found', () => {
  const r = fakeRenderer(), m = new Mirror(r), rt = new THREE.WebGLRenderTarget(4, 4);
  r.setRenderTarget(rt); r.setClearColor(0x336699, 0.4);
  m.render(scene(), camera());
  assert.equal(r.getRenderTarget(), rt);
  close(r.getClearAlpha(), 0.4);
  const c = r.getClearColor(new THREE.Color());
  close(c.r, 0x33 / 255); close(c.g, 0x66 / 255); close(c.b, 0x99 / 255);
});

test('the camera is reflected in the plane of the sea', () => {
  const m = new Mirror(fakeRenderer());
  m.render(scene(), camera(7, 15, -20));
  assert.deepEqual([m.cam.position.x, m.cam.position.y, m.cam.position.z], [7, -15, -20]);
});

test('the mirror looks up at what the camera looks down at', () => {
  const c = camera(5, 20, 30, [0, 2, -10]), m = new Mirror(fakeRenderer());
  m.render(scene(), c);
  const a = c.getWorldDirection(new THREE.Vector3()), b = m.cam.getWorldDirection(new THREE.Vector3());
  close(b.x, a.x, 1e-5, 'x'); close(b.y, -a.y, 1e-5, 'y'); close(b.z, a.z, 1e-5, 'z');
});

test('a point over the sea and its reflection fall on the same place in the two pictures', () => {
  const c = camera(5, 20, 30, [0, 2, -10]), m = new Mirror(fakeRenderer());
  m.render(scene(), c);
  // the point on the mirror's texture that `matrix` gives a point on the water is where the mirror drew it
  const p = new THREE.Vector4(4, 0, -8, 1).applyMatrix4(m.matrix), u = p.x / p.w, v = p.y / p.w;
  assert.ok(u > 0 && u < 1 && v > 0 && v < 1, `the point in view lands on the texture, at ${u}, ${v}`);
  // straight down the middle of the view, the water's point lies at the middle of the texture across
  const look = c.getWorldDirection(new THREE.Vector3()), t = -c.position.y / look.y, w = c.position.clone().addScaledVector(look, t);
  const q = new THREE.Vector4(w.x, w.y, w.z, 1).applyMatrix4(m.matrix);
  close(q.x / q.w, 0.5, 1e-3, 'across');
});

test('its view is wider than the camera\'s by the same factor on both axes', () => {
  const c = camera(), m = new Mirror(fakeRenderer());
  m.render(scene(), c);
  close(m.cam.projectionMatrix.elements[0], c.projectionMatrix.elements[0] / 1.2, 1e-5);
  close(m.cam.projectionMatrix.elements[5], c.projectionMatrix.elements[5] / 1.2, 1e-5);
});

test('its near plane is the sea: what lies under the water is clipped, what stands on it is kept', () => {
  const c = camera(0, 20, 40, [0, 0, 0]), m = new Mirror(fakeRenderer());
  m.render(scene(), c);
  const clipZ = (x, y, z) => { const p = new THREE.Vector4(x, y, z, 1).applyMatrix4(m.cam.matrixWorldInverse).applyMatrix4(m.cam.projectionMatrix); return p.z / p.w; };
  assert.ok(clipZ(0, 1, 0) >= -1, 'a point above the sea is in front of the near plane');
  assert.ok(clipZ(0, -1, 0) < -1, 'a point below the sea is behind it');
});

test('the inverse of its projection is kept true', () => {
  const m = new Mirror(fakeRenderer());
  m.render(scene(), camera());
  const id = m.cam.projectionMatrix.clone().multiply(m.cam.projectionMatrixInverse).elements;
  id.forEach((v, i) => close(v, i % 5 === 0 ? 1 : 0, 1e-6, `element ${i}`));
});

test('dispose lets go of its target', () => {
  const m = new Mirror(fakeRenderer()), seen = watchDispose(m.rt);
  m.dispose();
  assert.equal(seen.count, 1);
});
