// The land round the course. Built for one venue here, and in a process of its own for each of the venues that between
// them have every kind of landmark: the hills, the town, the trees and the moored boats are sound, the ferries keep to the
// water, and the graphics levels and the camera switch the right things on and off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import './load.mjs';
import { installPage, seedRandom, assertSoundGeometry, assertShaderPatch, under } from './fake-page.mjs';

const VENUE_ID = process.env.SKOPEA_VENUE;
installPage(VENUE_ID ? { search: `?venue=${VENUE_ID}` } : {});
seedRandom(4711);
const THREE = await import('three');
const S = await import('../public/game/skopea.js');
const { Skopea, buildLand, inLandShadow, groundAt, CLOUD_GLSL, CLOUD_U } = S;
const { VENUE, SKOPEA } = await import('../public/game/land.js');
const { skyUniforms, skyAt } = await import('../public/game/light.js');
const { fakeRenderer } = await import('./fake-page.mjs');

const sky = () => ({ ...skyUniforms(), uRipple: { value: new THREE.Texture() } });
const finiteMatrices = (m, name) => { const a = m.instanceMatrix.array; for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) assert.fail(`${name}: instance matrix value ${i} is ${a[i]}`); };

// everything that can be said of a built land, whichever the venue
function check(land) {
  let meshes = 0;
  land.group.traverse((o) => {
    if (!(o.isMesh || o.isLine || o.isPoints)) return;
    meshes++;
    assertSoundGeometry(o.geometry, `${VENUE.id}: ${o.name || o.type}`, { lines: !o.isMesh });
    if (o.isInstancedMesh) { finiteMatrices(o, VENUE.id); assert.ok(o.count <= o.instanceMatrix.count, 'no more drawn than made'); }
  });
  assert.ok(meshes > 5, `${VENUE.id}: ${meshes} parts`);
}

// the ferries' and water taxis' routes, walked from one end to the other, their piers left out: how much of each lies on
// dry land; and the boats on them, which keep moving
function ferries(land) {
  let n = 0, onLand = 0, worst = null;
  for (const r of SKOPEA.meta.routes || []) {
    const pts = r.pts, cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const len = cum.at(-1);
    for (let d = 120; d < len - 120; d += 15) {
      let i = 1; while (i < cum.length - 1 && cum[i] < d) i++;
      const f = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]), x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, z = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f, g = groundAt(x, z);
      n++; if (g > 2) { onLand++; worst = worst && worst.g > g ? worst : { x: Math.round(x), z: Math.round(z), g: +g.toFixed(1), kind: r.kind }; }
    }
  }
  for (let t = 0; t < 2000; t += 13) land.movers.userData.update(t);
  land.movers.traverse((o) => assert.ok(Number.isFinite(o.position.x + o.position.y + o.position.z), 'a mover is somewhere'));
  return { n, onLand, worst };
}

if (VENUE_ID) {
  // a venue, in its own process: says how it went and leaves
  const land = new Skopea(sky());
  check(land);
  land.place({ x: 100, z: -50 });
  land.setLight(skyAt(10), fakeRenderer());
  for (const q of ['low', 'medium', 'high']) { land.setQuality(q); land.update(new THREE.Vector3(0, 10, 0), 5); }
  process.stdout.write(`\n@@${JSON.stringify({ id: VENUE.id, ...ferries(land) })}\n`);
  process.exit(0);
}

const land = new Skopea(sky());

test('the land is whole and sound', () => check(land));

test('it is built in the order that casts its shadows and mirrors its boats', () => {
  for (const k of ['land', 'far', 'trees', 'farTrees', 'town', 'boats', 'rocks', 'movers']) assert.ok(land[k], k);
  assert.equal(land.rocks.parent, land.boats, 'the rocks go with the boats, for the sea to mirror');
  land.group.traverse((o) => { if (o.isMesh && o.parent !== land.movers) assert.equal(o.matrixAutoUpdate, false, 'what stands still is not recalculated'); });
});

test('the sea is told how deep it is and how near the shore', () => {
  const W = land.waterU;
  for (const k of ['uSeabed', 'uShore', 'uCalm']) assert.ok(W[k].value.isTexture, k);
  assert.equal(W.uCsT, CLOUD_U.uCsT, 'and sees the same clouds');
});

test('the ground is high on land and below zero at sea', () => {
  let high = 0, low = 0;
  for (let x = -6000; x <= 6000; x += 300) for (let z = -6000; z <= 6000; z += 300) { const g = groundAt(x, z); assert.ok(Number.isFinite(g)); if (g > 5) high++; if (g < 0) low++; }
  assert.ok(high > 20 && low > 20, `${high} points on land, ${low} at sea`);
});

test('a race is laid at its place in the bay', () => {
  land.place({ x: 320, z: -140 });
  assert.deepEqual(land.group.position.toArray(), [-320, 0, 140]);
  assert.ok(land.group.matrixWorld.elements[12] === -320, 'and the matrices know it');
  land.place({ x: 0, z: 0 });
});

test('the light of the hour thins the haze and paints the lakes', () => {
  const r = fakeRenderer();
  land.setLight(skyAt(9), r);
  assert.ok(r.log.length > 0, 'the land\'s shadows were drawn from where the sun is');
  const n = r.log.length;
  land.setLight(skyAt(12));
  assert.equal(r.log.length, n, 'with no renderer they are left as they are');
});

test('the clouds\' shadows run on the race\'s clock', () => {
  land.update(new THREE.Vector3(), 42);
  assert.equal(CLOUD_U.uCsT.value, 42);
  assert.match(CLOUD_GLSL, /cloudShade/);
});

test('fewer trees are drawn at the lower levels, and none of the far ones on Low', () => {
  const near = land.trees.children[0], far = land.farTrees.children[0];
  land.setQuality('high');
  assert.equal(near.count, near.userData.max); assert.equal(far.count, far.userData.max);
  assert.equal(land.far.geometry.index, land.far.userData.full);
  land.setQuality('medium');
  assert.equal(near.count, Math.round(near.userData.max * 0.45)); assert.equal(far.count, Math.round(far.userData.max * 0.4));
  land.setQuality('low');
  assert.equal(near.count, Math.round(near.userData.max * 0.25)); assert.equal(far.count, 0);
  assert.equal(land.far.geometry.index, land.far.userData.coarse);
  assert.equal(land.rigging, false); assert.equal(land.rocksOn, false);
  land.setQuality('high');
  assert.equal(land.rigging, true);
});

test('the shore\'s rocks show near the camera and not far off, nor at all on Low', () => {
  const tiles = land.rocks.userData.tiles;
  assert.ok(tiles.length > 0);
  const t = tiles[0], at = new THREE.Vector3(t.x + land.group.position.x, 10, t.z + land.group.position.z);
  land.setQuality('high');
  land.update(at, 0); assert.equal(t.mesh.visible, true);
  land.update(at.clone().setX(at.x + 1e5), 0); assert.equal(t.mesh.visible, false);
  land.setQuality('low');
  land.update(at, 0); assert.equal(t.mesh.visible, false);
  land.setQuality('high');
});

test('a moored boat near the camera is drawn as she is and taken out of the far batch', () => {
  const tiles = land.boats.userData.tiles;
  if (!tiles.length) return;
  const b = tiles.find((x) => x.far.length && x.near.length) ?? tiles[0], at = new THREE.Vector3(b.x + land.group.position.x, 10, b.z + land.group.position.z);
  land.update(at.clone().setX(at.x + 1e5), 0); assert.equal(b.isNear, false);
  for (const m of b.near) assert.equal(m.visible, false);
  land.update(at, 0); assert.equal(b.isNear, true);
  for (const m of b.near) assert.equal(m.visible, !m.userData.rig || land.rigging !== false);
});

test('near trees are drawn in full round the camera and as crowns beyond', () => {
  const m = land.trees.children.find((x) => x.userData.lod);
  if (!m) return;
  const c = m.boundingSphere.center, at = new THREE.Vector3(c.x + land.group.position.x, 10, c.z + land.group.position.z);
  land.update(at, 0); assert.deepEqual([m.visible, m.userData.lod.visible], [true, false]);
  land.update(at.clone().setX(at.x + 1e5), 0); assert.deepEqual([m.visible, m.userData.lod.visible], [false, true]);
});

test('the ferries keep moving, and their routes stay on the water', () => {
  const { n, onLand, worst } = ferries(land);
  assert.equal(onLand, 0, `${onLand} of ${n} points of the routes are on dry land, the worst ${JSON.stringify(worst)}`);
});

// ---------- the land's shadow on everything else ----------
test('a boat\'s materials are dimmed where the land\'s shadow falls, once only', () => {
  const m = new THREE.MeshStandardMaterial(), g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
  assert.equal(inLandShadow(g), g);
  const patched = m.onBeforeCompile;
  inLandShadow(g);
  assert.equal(m.onBeforeCompile, patched, 'not patched twice');
  const sh = assertShaderPatch(m, THREE.ShaderLib.standard, 'a boat\'s paint');
  assert.match(sh.fragmentShader, /reflectedLight\.directDiffuse \*= sun;/);
  assert.match(m.customProgramCacheKey(), /landshade$/);
});

test('the material\'s own patch still runs first', () => {
  const m = new THREE.MeshStandardMaterial(), g = new THREE.Group(); let ran = 0;
  m.onBeforeCompile = (sh) => { ran++; sh.fragmentShader += '\n// mine'; };
  m.customProgramCacheKey = () => 'mine';
  g.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
  inLandShadow(g);
  const sh = assertShaderPatch(m, THREE.ShaderLib.standard, 'a patched paint');
  assert.equal(ran, 1); assert.match(sh.fragmentShader, /\/\/ mine/);
  assert.equal(m.customProgramCacheKey(), 'mine|landshade');
});

test('what is not lit by the sun is left alone', () => {
  const m = new THREE.MeshBasicMaterial(), g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(), m), new THREE.Object3D());
  inLandShadow(g);
  assert.equal(m.userData.landShade, undefined);
});

test('a mesh of several materials has each of them dimmed', () => {
  const a = new THREE.MeshLambertMaterial(), b = new THREE.MeshPhongMaterial(), g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(), [a, b]));
  inLandShadow(g);
  assert.ok(a.userData.landShade && b.userData.landShade);
});

test('a page with a scene behind it builds the land a breath at a time', async () => {
  let breaths = 0;
  await buildLand(async () => { breaths++; });
  assert.equal(breaths, 8);
  const l = new Skopea(sky());
  assert.ok(l.land && l.town);
  check(l);
});

// ---------- every kind of landmark ----------
const VENUES = ['st-petersburg', 'los-angeles', 'fethiye', 'monaco', 'dubai', 'miami', 'san-diego', 'sydney', 'phuket', 'malta', 'chicago', 'marseille', 'saint-malo', 'tbilisi-sea', 'athens', 'sint-maarten', 'marstrand', 'palma', 'qingdao', 'lake-geneva', 'marmaris', 'barcelona',
  'rio', 'new-york', 'gold-coast', 'san-francisco', 'trieste', 'istanbul', 'kiel', 'cape-town', 'les-sables', 'split', 'hobart'];
const self = fileURLToPath(import.meta.url);
const run = (id) => new Promise((res) => {
  const p = spawn(process.execPath, [self], { env: { ...process.env, SKOPEA_VENUE: id, NODE_TEST_CONTEXT: undefined }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { err += d; });
  p.on('close', (code) => res({ id, code, report: /@@(.*)/.exec(out)?.[1], err }));
});

test('every kind of landmark, at every venue that has one, is built sound', { timeout: 240000 }, async () => { // (a process per venue: slow while the whole suite runs beside it)
  const queue = VENUES.slice(), done = [];
  await Promise.all(Array.from({ length: 8 }, async () => { while (queue.length) done.push(await run(queue.shift())); }));
  for (const r of done) assert.equal(r.code, 0, `${r.id}: ${r.err.split('\n').filter((l) => /Error|assert/i.test(l)).slice(0, 3).join(' | ').slice(0, 400)}`);
  assert.equal(done.length, VENUES.length);
  const aground = done.map((r) => ({ id: r.id, ...JSON.parse(r.report) })).filter((r) => r.onLand);
  assert.deepEqual(aground.map((r) => `${r.id}: ${r.onLand} of ${r.n} points, ${JSON.stringify(r.worst)}`), [], 'the ferries\' routes keep off the land');
  assert.ok(SKOPEA.meta, 'the land file was read');
});
