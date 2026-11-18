// The inflatable racing mark: its shape is the one measured in its comments, its textures are drawn once for each colour,
// and every mark set out shares them while lying turned its own way.
import test from 'node:test';
import assert from 'node:assert/strict';
import './load.mjs';
import { installPage, page, assertSoundGeometry, boundsOf, under, scriptRandom } from './fake-page.mjs';

installPage();
const THREE = await import('three');
const { buoy, warmMarks } = await import('../public/game/marks.js');
const { SEA } = await import('../public/game/yacht.js');

const close = (a, b, e = 1e-6, what = '') => assert.ok(Math.abs(a - b) <= e, `${what} ${a} is not ${b}`);
const bodyOf = (g) => g.children[0].children[0];
const H = 2.2, BASE = -0.5, DOME = 0.08;

test('the body stands 2.2 radii out of the water with a fifth of it below', () => {
  const b = boundsOf(bodyOf(buoy()).geometry);
  close(b.max.y, H + DOME, 1e-3, 'its top');
  close(b.min.y, BASE, 1e-3, 'its bottom');
});

test('the body is sound, and round, about a metre in radius', () => {
  const g = bodyOf(buoy()).geometry;
  assertSoundGeometry(g, 'the mark');
  const b = boundsOf(g);
  assert.ok(b.max.x > 0.95 && b.max.x < 1.04, `its radius is ${b.max.x}`);
  close(b.max.x, b.max.z, 0.03, 'as wide one way as the other');
  close(b.min.x, -b.max.x, 0.03);
});

test('its eight panels are blown out between their seams', () => {
  const P = bodyOf(buoy()).geometry.attributes.position;
  // the height of the belly: the radius at each angle round it
  const ring = new Map();
  for (let i = 0; i < P.count; i++) {
    const y = P.getY(i); if (Math.abs(y - 0.9) > 0.1) continue;
    const key = y.toFixed(3); if (!ring.has(key)) ring.set(key, []);
    ring.get(key).push([Math.atan2(P.getZ(i), P.getX(i)), Math.hypot(P.getX(i), P.getZ(i))]);
  }
  const [pts] = [...ring.values()], seam = (a) => Math.abs((((a / (2 * Math.PI)) * 8 + 100) % 1) - 0.5) > 0.48, mid = (a) => Math.abs((((a / (2 * Math.PI)) * 8 + 100) % 1) - 0.5) < 0.02;
  const atSeam = pts.filter(([a]) => seam(a)), atMiddle = pts.filter(([a]) => mid(a));
  assert.equal(atMiddle.length, 8, 'eight panels');
  assert.ok(atSeam.length >= 8);
  const r = (l) => l.reduce((s, [, x]) => s + x, 0) / l.length;
  close(r(atMiddle) / r(atSeam), 1 / 0.955, 3e-3, 'the bulge');
});

test('where the lathe closes its normals agree, so no seam shows down the side', () => {
  const g = bodyOf(buoy()).geometry, N = g.attributes.normal, P = g.attributes.position;
  const n = P.count / 97; // 96 segments: a column of the profile, 97 times
  assert.ok(Number.isInteger(n));
  for (let j = 0; j < n; j++) for (const k of [0, 1, 2]) close(N.getComponent(j, k), N.getComponent(96 * n + j, k), 1e-5, `normal ${j}`);
});

test('the textures run up it from the middle of the bottom to the middle of the top', () => {
  const g = bodyOf(buoy()).geometry, uv = g.attributes.uv, n = g.attributes.position.count / 97;
  assert.equal(uv.getY(0), 0);
  close(uv.getY(n - 1), 1, 1e-6);
  for (let j = 1; j < n; j++) assert.ok(uv.getY(j) > uv.getY(j - 1), `v rises along the profile at ${j}`);
});

test('the radius sets the size of the body and of everything on it', () => {
  const a = buoy('#ff7314', 1), b = buoy('#ff7314', 2);
  assert.equal(bodyOf(a).scale.x, 1); assert.equal(bodyOf(b).scale.x, 2);
  assert.equal(a.userData.R, 1); assert.equal(b.userData.R, 2);
  const size = (g) => new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()).x;
  assert.ok(Math.abs(size(b) / size(a) - 2) < 0.6, 'twice the width, give or take its mooring');
});

test('the handle and the valve stand on top of it', () => {
  const R = 1.5, g = buoy('#ff7314', R), top = (H + DOME) * R, turn = g.children[0];
  const parts = turn.children.slice(1);
  assert.ok(parts.length >= 7, 'a handle, two patches, a valve, its cap and two D-rings');
  for (const m of parts.slice(0, 5)) close(m.position.y, top, 0.05 * R, 'a fitting');
});

test('its two D-rings hang opposite each other on the strap', () => {
  const R = 1, rings = buoy('#ff7314', R).children[0].children.slice(-2);
  for (const d of rings) { close(d.position.y, 0.33 * R); close(Math.hypot(d.position.x, d.position.z), 1.035 * R, 1e-9); }
  close(rings[0].position.x, -rings[1].position.x, 1e-9); close(rings[0].position.z, -rings[1].position.z, 1e-9);
});

test('its mooring line runs from under its skirt down into the deep, and does not turn with it', () => {
  const g = buoy(), moor = g.children[1], b = boundsOf(moor.geometry);
  assertSoundGeometry(moor.geometry, 'the mooring');
  assert.ok(b.max.y <= BASE * 1.05 + 0.1, `its top is at ${b.max.y}`);
  assert.ok(b.min.y < -5, `its end is at ${b.min.y}`);
  assert.equal(moor.parent, g);
});

test('each mark is set out turned its own way', () => {
  const put = scriptRandom([0.25]); const a = buoy().children[0].rotation.y; put();
  const back = scriptRandom([0.75]); const b = buoy().children[0].rotation.y; back();
  close(a, Math.PI / 2); close(b, 1.5 * Math.PI);
});

test('it casts a shadow and lies in others\'', () => {
  const m = bodyOf(buoy());
  assert.equal(m.castShadow, true); assert.equal(m.receiveShadow, true);
});

test('all marks share one shape, and one look to each colour', () => {
  const a = bodyOf(buoy('#123456')), b = bodyOf(buoy('#123456')), c = bodyOf(buoy('#654321'));
  assert.equal(a.geometry, b.geometry); assert.equal(a.geometry, c.geometry);
  assert.equal(a.material, b.material); assert.notEqual(a.material, c.material);
  assert.equal(a.material.normalMap, c.material.normalMap, 'the relief is the same on every colour');
  assert.notEqual(a.material.map, c.material.map);
});

test('a colour is drawn the first time it is asked for and never again', () => {
  buoy('#0a0b0c');
  const n = page.canvases.length;
  buoy('#0a0b0c'); buoy('#0a0b0c');
  assert.equal(page.canvases.length, n);
  buoy('#0c0b0a');
  assert.equal(page.canvases.length, n + 2, 'a colour map and a roughness map');
});

test('warmMarks draws the two colours of the course ahead of the first race', () => {
  warmMarks();
  const n = page.canvases.length;
  buoy('#ff7314'); buoy('#ffd21a');
  assert.equal(page.canvases.length, n, 'nothing left to draw when the marks are set');
});

test('the club\'s name goes round its band twice, in the band', () => {
  const m = bodyOf(buoy('#11aa33')).material, x = m.map.image.getContext('2d');
  const names = x.texts.filter((t) => t.text === 'RYC REGATTA');
  assert.equal(names.length, 2);
  assert.match(names[0].font, /^900 \d+px/);
  assert.equal(m.map.image.width, 1024); assert.equal(m.map.image.height, 1024);
});

test('the colour map is sRGB and wraps round the seam; the roughness is plain data', () => {
  const m = bodyOf(buoy('#aa1133')).material;
  assert.equal(m.map.colorSpace, THREE.SRGBColorSpace);
  assert.equal(m.map.wrapS, THREE.RepeatWrapping);
  assert.equal(m.roughnessMap.wrapS, THREE.RepeatWrapping);
  assert.notEqual(m.roughnessMap.colorSpace, THREE.SRGBColorSpace);
});

test('its relief is a true normal map: every texel a unit vector pointing out of the surface', () => {
  const img = bodyOf(buoy()).material.normalMap.image.pixels;
  assert.equal(img.width, 512); assert.equal(img.height, 512);
  const d = img.data;
  let tilted = 0;
  for (let o = 0; o < d.length; o += 4 * 7) {
    const n = [d[o], d[o + 1], d[o + 2]].map((v) => (v / 255 - 0.5) * 2), l = Math.hypot(...n);
    assert.ok(Math.abs(l - 1) < 0.03, `a normal of length ${l}`);
    assert.ok(n[2] > 0, 'it faces outward');
    assert.equal(d[o + 3], 255);
    if (Math.abs(n[0]) > 0.05 || Math.abs(n[1]) > 0.05) tilted++;
  }
  assert.ok(tilted > 100, 'and it has something on it');
});

test('under the water its skirt is its colour, darkened and filmed green', () => {
  const m = bodyOf(buoy('#ffffff')).material, u = m.userData.under;
  assert.ok(u.r < 1 && u.g < 1 && u.b < 1);
  assert.ok(u.g > u.b, 'green more than blue');
});

test('its wet line is sewn into the physical material, driven by the same sea as the hulls', () => {
  const m = bodyOf(buoy()).material, S = THREE.ShaderLib.physical;
  const sh = { uniforms: {}, vertexShader: S.vertexShader, fragmentShader: S.fragmentShader };
  m.onBeforeCompile(sh);
  assert.equal(sh.uniforms.uTime, SEA.uTime); assert.equal(sh.uniforms.uW, SEA.uW); assert.equal(sh.uniforms.uWs, SEA.uWs);
  assert.match(sh.vertexShader, /vWP = \(modelMatrix \* vec4\(transformed, 1\.0\)\)\.xyz;/);
  assert.match(sh.fragmentShader, /float markSea\(vec2 xz\)/);
  assert.match(sh.fragmentShader, /float swellG\(int i, vec2 xz\)/);
  assert.match(sh.fragmentShader, /float wet = 1\.0 - smoothstep/);
  assert.match(sh.fragmentShader, /material\.roughness = mix\(material\.roughness, 0\.08, wet \* 0\.85\)/);
  assert.equal(m.customProgramCacheKey(), 'markWet');
});

test('nothing in the whole mark is out of place', () => {
  const g = buoy('#ff7314', 1.05);
  for (const m of under(g)) assertSoundGeometry(m.geometry, 'a part of the mark');
  const box = new THREE.Box3().setFromObject(g);
  assert.ok(box.max.y < 3 && box.min.y > -7, `from ${box.min.y} to ${box.max.y}`);
});
