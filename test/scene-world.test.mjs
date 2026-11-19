// The whole picture put together, with a renderer that draws nothing but remembers: the graphics levels switch their parts
// on and off cleanly, each frame's passes go where they should, and a race can be sailed, watched from every camera and
// started again without anything being left behind.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { mock, ROOT } from './load.mjs';
import { installPage, fakeRenderer, FakeCanvas, assertFiniteTree, assertSoundGeometry, watchDispose, seedRandom, under } from './fake-page.mjs';

// the wait World.prepare gives up after keeps nobody waiting here
const later = globalThis.setTimeout;
globalThis.setTimeout = (f, ms, ...a) => { const t = later(f, ms, ...a); if (ms >= 1000) t.unref?.(); return t; };
// three as it is, but for the one class that needs a GPU
const real = pathToFileURL(join(ROOT, 'public/vendor/three@0.160.0/build/three.module.min.js')).href;
mock('three', `export * from '${real}'; export class WebGLRenderer { constructor(o) { return globalThis.__renderer(o); } }`);
globalThis.__renderer = () => fakeRenderer({ width: 1280, height: 720 });
installPage();
const THREE = await import('three');
const G = await import('../public/game/world.js');
const { World, makeWorld, ladderStep, beatOf, beatFrom, zoneMarks, flagTexture } = G;
const { Race, waveHeight, makeCourse } = await import('../public/game/sim.js');
const { skyAt } = await import('../public/game/light.js');
const { LOOKS, crewFrame } = await import('../public/game/yacht.js');

seedRandom(1234);
const close = (a, b, e = 1e-6, what = '') => assert.ok(Math.abs(a - b) <= e, `${what} ${a} is not ${b}`);
const newRace = (o = {}) => new Race({ preset: 'medium', seed: 7, fleet: 4, start: 1, autoTrim: true, ...o });
const world = new World(new FakeCanvas(1280, 720)), r = world.renderer;
let race = newRace();
world.setRace(race); world.resize(1280, 720); world.setQuality('high');
const sail = (n, dt = 1 / 30, each) => { for (let i = 0; i < n; i++) { race.step(dt); world.frame(dt, race.t, i * dt); world.render(world.camera); each?.(i); } };
sail(5);
// Before a boat leaves the scene her crew must have left the queue for their finest figures: crewFrame never ends if one
// of them is still in it (the bug the last test but one of this file records)
const clearCrew = (views = world.boatViews) => { for (const v of views) for (const c of v.crew) c.s.level(0); };
const restart = (o) => { clearCrew(); race = newRace(o); world.setRace(race); };

// ---------- the guides, in numbers ----------
test('the distance lines are every 50 m, or every 100 m on a long beat', () => {
  assert.equal(ladderStep(300), 50); assert.equal(ladderStep(600), 50); assert.equal(ladderStep(601), 100);
});

test('the guides show the beat being sailed, or the last one sailed', () => {
  const c = makeCourse(2, 300, 0);
  for (let i = 0; i < c.legs.length; i++) {
    const j = beatOf(c, i);
    assert.ok(j >= 0 && j <= c.legs.length - 1, `leg ${i}`);
    assert.ok(c.legInfo[j].beat, `leg ${i} looks to leg ${j}, a beat`);
    assert.ok(j <= Math.max(i, c.legInfo.findIndex((l) => l.beat)), 'never one still to come');
  }
  const from = beatFrom(c, beatOf(c, 1));
  assert.ok(Number.isFinite(from.x) && Number.isFinite(from.z));
});

test('the zones are round the gate and every mark, the windward mark too', () => {
  const c = makeCourse(1, 300, 0), z = zoneMarks(c);
  for (const m of c.gate) assert.ok(z.includes(m), 'the gate has one');
  assert.ok(z.includes(c.windward), 'a mark reached on a beat has one, for boats on the same tack');
  assert.ok(!z.includes(c.pin) && !z.includes(c.committee), 'the line has none');
});

test('the code flags are passed on from the committee boat', () => {
  assert.ok(flagTexture('P').isCanvasTexture);
});

// ---------- the renderer it sets up ----------
test('it sets the renderer up for the picture it draws', () => {
  assert.equal(r.toneMapping, THREE.ACESFilmicToneMapping);
  assert.equal(r.shadowMap.type, THREE.PCFSoftShadowMap);
  assert.equal(r.debug.checkShaderErrors, false, 'not on a visitor\'s machine');
});

test('its pixel ratio is held down however dense the screen', () => {
  const was = globalThis.devicePixelRatio; globalThis.devicePixelRatio = 3;
  const w = new World(new FakeCanvas(10, 10));
  assert.ok(w.renderer.getPixelRatio() <= 1.75);
  globalThis.devicePixelRatio = was;
});

test('a resize reaches the renderer and the camera', () => {
  world.resize(800, 400);
  close(world.camera.aspect, 2);
  assert.ok(world.renderer.getDrawingBufferSize(new THREE.Vector2()).x > 0);
  world.resize(1280, 720);
});

// ---------- the light ----------
test('the light of the hour reaches the sun, the sky, the haze and the sea', () => {
  const L = skyAt(9);
  world.setLight(L);
  assert.equal(world.light, L);
  assert.ok(world.sun.color.equals(L.sun));
  close(world.sun.intensity, L.sunI);
  close(world.renderer.toneMappingExposure, L.exposure);
  assert.ok(world.waterU.uDeep.value.equals(L.deep));
  assert.ok(world.scene.fog.color.equals(L.horizon));
  world.setLight(skyAt(14.5));
});

test('the sky\'s reflection is made anew for each light and the old one let go', () => {
  const old = world.scene.environment, seen = watchDispose(old);
  world.setLight(skyAt(11));
  assert.notEqual(world.scene.environment, old);
  assert.equal(seen.count, 1);
});

// ---------- the graphics levels ----------
test('High has every part on, Low the fewest', () => {
  world.setQuality('high');
  assert.ok(world.post && world.mirror && world.ocean && world.under);
  world.setQuality('low');
  assert.equal(world.post, null); assert.equal(world.mirror, null); assert.equal(world.ocean, null); assert.equal(world.under, null);
  world.setQuality('high');
  assert.ok(world.post && world.mirror && world.ocean && world.under);
  assert.equal(world.quality, 'high');
});

test('a part switched off lets go of what it held', () => {
  world.setQuality('high');
  const seen = [world.post.rt, world.mirror.rt, world.ocean.ping, world.under.rt].map(watchDispose);
  world.setQuality('low');
  assert.deepEqual(seen.map((s) => s.count), [1, 1, 1, 1]);
  world.setQuality('high');
});

test('asking for the level it is already at changes nothing', () => {
  world.setQuality('high');
  const { post, mirror, ocean } = world;
  world.setQuality('high');
  assert.equal(world.post, post); assert.equal(world.mirror, mirror); assert.equal(world.ocean, ocean);
});

test('a level that does not exist is ignored', () => {
  world.setQuality('high'); world.setQuality('ultra');
  assert.equal(world.quality, 'high');
});

test('a custom mix switches only the parts that differ', () => {
  world.setQuality('high');
  const { mirror, ocean } = world;
  world.setQuality('custom', { post: 'low' });
  assert.equal(world.post, null, 'the bloom went');
  assert.equal(world.mirror, mirror); assert.equal(world.ocean, ocean);
  world.setQuality('high');
});

test('every level can be sailed and drawn', () => {
  for (const q of ['low', 'medium', 'high']) {
    world.setQuality(q); sail(4);
    assert.ok(r.log.length > 0, q);
  }
});

test('shadows off leave the sea\'s shade off too', async () => {
  world.setQuality('low'); await pass();
  assert.equal(world.seaShadeU.uSeaShadeOn.value, world.gfx.shadows !== 'low' ? 1 : 0);
  world.setQuality('high'); await pass();
  assert.equal(world.seaShadeU.uSeaShadeOn.value, 1);
});

// ---------- a frame's passes ----------
const pass = async () => { await world.ready(); r.log.length = 0; world.render(world.camera); return r.log.slice(); };

test('a frame on High draws the mirror, the shade, the hulls under water, the scene and last the labels', async () => {
  world.setQuality('high'); await world.ready(); sail(2);
  const L = await pass(), T = L.map((e) => e.target);
  assert.ok(T.includes(world.mirror.rt), 'the mirror');
  assert.ok(T.includes(world.seaShade.rt), 'the sea\'s shade');
  assert.ok(T.includes(world.under.rt), 'the hulls under water');
  assert.ok(T.includes(world.post.rt), 'the scene');
  assert.equal(L.at(-1).target, null, 'the screen last');
  assert.equal(L.at(-1).scene, world.scene, 'and the labels on top');
  assert.equal(L.at(-1).autoClear, false, 'without wiping what is there');
  assert.ok(T.indexOf(world.mirror.rt) < T.indexOf(world.post.rt), 'the reflection is ready before the water is drawn');
});

test('the renderer and the camera are left as they were found', async () => {
  world.setQuality('high');
  await pass();
  assert.equal(r.autoClear, true); assert.equal(r.shadowMap.autoUpdate, true);
  assert.ok(world.camera.layers.isEnabled(0)); assert.ok(!world.camera.layers.isEnabled(1));
  assert.equal(world.scene.matrixWorldAutoUpdate, true);
});

test('on Low the scene goes straight to the screen', async () => {
  world.setQuality('low'); await world.ready(); sail(1);
  const L = await pass();
  assert.equal(L.at(-1).target, null); assert.equal(L.at(-1).scene, world.scene);
  world.setQuality('high');
});

test('nothing is drawn while the shaders are compiling', async () => {
  await world.ready();
  world.preparing = Promise.resolve(); r.log.length = 0;
  world.render(world.camera);
  assert.equal(r.log.length, 0);
  world.preparing = null;
});

test('the reflection is used only when the mirror drew', async () => {
  world.setQuality('high'); await world.ready(); world.mode = 'top';
  sail(2); await pass();
  assert.equal(world.reflU.uReflOn.value, 0, 'from straight above it is left out');
  world.mode = 'drone'; sail(2); await pass();
  assert.equal(world.reflU.uReflOn.value, 1);
  assert.equal(world.reflU.uRefl.value, world.mirror.rt.texture);
});

test('shaders are compiled ahead, and the wait for them ends', async () => {
  world.setQuality('high');
  const before = r.compiled.length, job = world.prepare();
  assert.equal(world.ready(), job);
  assert.ok(r.compiled.length > before + 3, 'each pass\'s variants');
  await job;
  assert.equal(world.preparing, null);
  await world.ready();
});

test('a failure while compiling does not hold the race up', async () => {
  const c = r.compile; r.compile = () => { throw new Error('context lost'); };
  await world.prepare();
  r.compile = c;
  assert.equal(world.preparing, null);
  assert.equal(r.getRenderTarget(), null);
});

// ---------- the race on the water ----------
test('there is a boat in the scene for every boat in the race', () => {
  assert.equal(world.boatViews.length, race.boats.length);
  for (const v of world.boatViews) assert.equal(v.root.parent, world.scene);
});

test('the land is moved so the race lies where it was laid in the bay', () => {
  assert.equal(world.skopea.group.position.x, -race.at.x || 0);
  assert.equal(world.skopea.group.position.z, -race.at.z || 0);
});

test('each boat is drawn where the race has her', () => {
  sail(3);
  race.boats.forEach((b, i) => { const v = world.boatViews[i]; close(v.root.position.x, b.x, 1e-6); close(v.root.position.z, b.z, 1e-6); });
});

test('the marks ride the sea', () => {
  sail(3);
  assert.ok(world.buoys.length >= 3);
  for (const { obj, p } of world.buoys) if (!obj.userData.boat) close(obj.position.y, waveHeight(world.W, p.x, p.z, race.t) * 0.9, 1e-6, 'a mark');
});

test('the next mark is pointed out, and the pointers go when she has finished', () => {
  sail(2);
  assert.ok(world.pointers.some((p) => p.visible));
  race.player.done = true; sail(1);
  assert.ok(world.pointers.every((p) => !p.visible));
  race.player.done = false; sail(1);
});

test('the guides can be switched off', () => {
  world.showGuides = false; sail(1);
  assert.equal(world.ladder.group.visible, false); assert.equal(world.lay.group.visible, false);
  world.showGuides = true; sail(1);
  assert.equal(world.ladder.group.visible, true);
});

test('a boat at speed throws foam from her bow, a boat stopped none', () => {
  const b = { x: 0, z: 0, h: 0, v: 0.3, twa: 1, slope: 0 }, at = world.foamI;
  world.spawnFoam(b, 1); assert.equal(world.foamI, at);
  world.spawnFoam({ ...b, v: 5 }, 1);
  assert.notEqual(world.foamI, at);
});

test('spray comes over the bow only slamming upwind in a breeze', () => {
  const b = { x: 0, z: 0, h: 0, v: 6, tws: 18, twa: 0.6, slope: 0.2 }, at = () => world.foamI, was = at();
  world.spawnSpray({ ...b, tws: 8 }, 1, race); world.spawnSpray({ ...b, twa: 2.5 }, 1, race); world.spawnSpray({ ...b, slope: 0 }, 1, race); world.spawnSpray({ ...b, v: 1 }, 1, race);
  assert.equal(at(), was, 'not in any of those');
  world.spawnSpray(b, 10, race);
  assert.notEqual(at(), was);
});

test('a foiler flying throws a rooster tail', () => {
  const was = world.foamI; world.spawnFoilSpray({ x: 0, z: 0, h: 0, v: 20, twa: 1, boom: 1 }, 1);
  assert.notEqual(world.foamI, was);
  const f = world.foam[(world.foamI + world.foamMax - 1) % world.foamMax];
  assert.equal(f.spray, true); assert.ok(f.vy > 0);
});

test('a splash is smaller with the wakes turned down', () => {
  const count = (q) => { world.setQuality(q); const a = world.foamI; world.splash(1, 2, 100, 0, 1); return (world.foamI - a + world.foamMax) % world.foamMax; };
  assert.equal(count('high'), 100); assert.equal(count('low'), 40);
  world.setQuality('high');
});

test('a splash thrown up is spray, half of it, and the rest stays on the water', () => {
  const a = world.foamI; world.splash(5, 6, 20, 4, 2);
  const made = Array.from({ length: 20 }, (_, i) => world.foam[(a + i) % world.foamMax]);
  assert.equal(made.filter((f) => f.spray).length, 10);
  for (const f of made) assert.ok(Math.hypot(f.x - 5, f.z - 6) <= 2 * 0.7 + 1e-9);
});

test('spent foam is put away below the sea', () => {
  world.foam[0].age = 1e9; world.foam[0].spray = false; sail(1);
  const g = world.foamPts.geometry.attributes;
  assert.equal(g.position.getY(0), -50); assert.equal(g.aAlpha.getX(0), 0);
});

// ---------- how a hull moves ----------
test('a hull lags the sea and settles onto it', () => {
  const v = { root: new THREE.Group(), tilt: new THREE.Group(), drawnL: 10.45 }, b = { v: 0, twa: 0.5, aws: 10 };
  world.settle(v, 1 / 30, b, 0);
  for (let i = 0; i < 8; i++) v.root.position.y = 1, world.settle(v, 1 / 30, b, i / 30);
  assert.ok(v.sea.y > 0 && v.sea.y < 1, `she is on her way up, at ${v.sea.y}`);
  for (let i = 0; i < 900; i++) v.root.position.y = 1, world.settle(v, 1 / 30, b, i / 30);
  close(v.sea.y, 1, 0.01, 'and gets there');
});

test('a small boat bobs quicker than a big one', () => {
  const rise = (L) => { const v = { root: new THREE.Group(), tilt: new THREE.Group(), drawnL: L }; world.settle(v, 1 / 30, { v: 0, twa: 0.5, aws: 0 }, 0); for (let i = 0; i < 15; i++) { v.root.position.y = 1; world.settle(v, 1 / 30, { v: 0, twa: 0.5, aws: 0 }, i / 30); } return v.sea.y; };
  assert.ok(rise(4) > rise(30));
});

test('after a pause she is put back where the sea is at once', () => {
  const v = { root: new THREE.Group(), tilt: new THREE.Group(), drawnL: 10 }, b = { v: 2, twa: 0.5, aws: 8 };
  world.settle(v, 1 / 30, b, 0); v.root.position.y = 3;
  world.settle(v, 2, b, 2);
  close(v.sea.y, 3, 0.3);
});

test('her speed reaches the wet line on her hull', () => {
  const u = { uSpd: { value: 0 } }, v = { root: new THREE.Group(), tilt: new THREE.Group(), drawnL: 10, hullSea: [u] };
  world.settle(v, 1 / 30, { v: 5, twa: 0.5, aws: 8 }, 0);
  assert.ok(u.uSpd.value > 0.9);
  world.settle(v, 1 / 30, { v: 12, ride: 1, twa: 0.5, aws: 8 }, 0);
  assert.equal(u.uSpd.value, 0, 'flying, nothing touches the water');
});

// ---------- the cameras ----------
test('each camera can be flown for a while and stays in the sky', () => {
  world.intro = null;
  for (const mode of ['drone', 'helm', 'top']) {
    world.mode = mode;
    sail(90, 1 / 30, () => { const p = world.camera.position; assert.ok(Number.isFinite(p.x + p.y + p.z), mode); assert.ok(p.y > 0.05, `${mode}: the camera is under water at ${p.y} m`); });
  }
  world.mode = 'drone';
});

test('the opening fly-around plays and ends', () => {
  world.flyIn(1);
  assert.ok(world.intro);
  sail(50);
  assert.equal(world.intro, null);
});

test('the helm camera has a lens from the moment the world is made', () => {
  const w = new World(new FakeCanvas(32, 32));
  assert.equal(w.helmFov, 68); assert.equal(w.lookHold, 0);
});

test('zooming is held within its limits, in each camera\'s own way', () => {
  world.resetView(); world.mode = 'drone'; world.dist = 30;
  world.zoom(0.001); assert.equal(world.dist, 8); world.zoom(1e4); assert.equal(world.dist, 110);
  world.mode = 'helm'; world.zoom(0.001); assert.equal(world.helmFov, 30); world.zoom(1e4); assert.equal(world.helmFov, 80);
  world.mode = 'drone';
});

test('dragging turns the view, except from straight above', () => {
  world.mode = 'drone'; world.orbit = 0; world.drag(100); close(world.orbit, -0.6);
  world.mode = 'top'; world.drag(100); close(world.orbit, -0.6);
  world.mode = 'helm'; world.look = 0; world.drag(100); close(world.look, -0.5); world.drag(1e5); assert.equal(world.look, -2.6);
  world.mode = 'drone'; world.resetView();
  assert.deepEqual([world.orbit, world.look, world.dist, world.helmFov], [0, 0, 34, 68]);
});

test('at the helm you are the helmsman: your own figure is not in the way', () => {
  world.mode = 'helm'; sail(2);
  assert.equal(world.boatViews[0].crew[0].g.visible, false);
  world.mode = 'drone'; sail(2);
  assert.equal(world.boatViews[0].crew[0].g.visible, true);
});

// ---------- changing things ----------
test('your boat can be dressed anew: the old one comes off the water and is let go', () => {
  const old = world.boatViews[0], g = under(old.root, (o) => o.isMesh && !o.material.isShaderMaterial).find((m) => m.geometry.attributes.position.count > 12).geometry, seen = watchDispose(g);
  clearCrew([old]);
  world.setPlayerLook({ ...LOOKS.player, hull: '#aa3300' });
  assert.notEqual(world.boatViews[0], old);
  assert.equal(old.root.parent, null); assert.equal(world.boatViews[0].root.parent, world.scene);
  assert.equal(seen.count, 1, 'what she was made of is let go');
  sail(2);
});

test('the figures on board can be hidden', () => {
  world.setFigures(false); sail(1);
  assert.ok(world.boatViews.every((v) => v.crew.every((c) => !c.s.mesh.visible)));
  world.setFigures(true); sail(1);
});

test('race after race nothing is left behind in the scene', () => {
  world.setQuality('high');
  const counts = [];
  for (let k = 0; k < 4; k++) {
    restart({ seed: 20 + k }); sail(6);
    counts.push(world.scene.children.length);
    assert.equal(world.boatViews.length, race.boats.length);
  }
  // (the two committee boats take turns, the catamaran with a hull more in the water)
  assert.ok(counts[2] <= counts[0] && counts[3] <= counts[1], `the scene holds ${counts}`);
});

test('a bigger fleet and a longer course can be set', () => {
  restart({ seed: 41, fleet: 8, laps: 2, length: 'medium' }); sail(4);
  assert.equal(world.boatViews.length, 8);
});

test('the other courses are laid out too', () => {
  for (const course of ['wl', 'wlu', 'tri', 'trap', 'zero']) {
    restart({ seed: 50, course }); sail(3);
    assert.ok(world.buoys.length >= 2, course);
    for (const g of [world.ladder.group, world.lay.group]) for (const m of g.children) assertSoundGeometry(m.geometry, `${course}: a guide`);
  }
  restart();
});

test('a race sailed from start to first mark leaves the picture sound', () => {
  restart({ seed: 77 }); world.intro = null;
  sail(450, 1 / 10);
  assertFiniteTree(world.scene, 'the world');
  assertSoundGeometry(world.foamPts.geometry, 'the foam', { lines: true });
  for (const w of world.wakes) assertSoundGeometry(w.mesh.geometry, 'a wake');
});

test('starting a new race while sailors wait for their figures does not freeze the page', async () => {
  restart({ seed: 90 });
  // the modelled sailor has come in, and a boat's crew have just been asked for theirs
  const pilot = world.boatViews[0], v = world.boatViews[1];
  pilot.setDetail(true); pilot.setCrewNear(true, 2);
  for (let i = 0; i < 400 && !pilot.crew.every((c) => c.s.hi); i++) { await new Promise((res) => setImmediate(res)); crewFrame(); }
  v.setDetail(true); v.setCrewNear(true, 2);
  // (show is counted, so that the endless loop ends in an error here and not in a hung test run)
  const crew = v.crew.map((c) => c.s), shows = crew.map((s) => s.show);
  let calls = 0;
  crew.forEach((s, i) => { s.show = () => { if (++calls > 500) throw new Error('crewFrame is going round for ever'); shows[i](); }; });
  race = newRace({ seed: 91 }); world.setRace(race);
  try {
    assert.doesNotThrow(() => { race.step(1 / 30); world.frame(1 / 30, race.t, 0); });
  } finally {
    crew.forEach((s, i) => { s.show = shows[i]; s.level(0); });
    crewFrame();
  }
});

test('a page with a scene behind it gets its world in slices', async () => {
  const w = await makeWorld(new FakeCanvas(320, 200));
  assert.ok(w instanceof World);
  assert.ok(w.skopea.land);
});
