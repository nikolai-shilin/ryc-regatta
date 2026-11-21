// The dictionary's scenes (public/game/word-scenes.js) on the real World with a renderer that draws nothing: every word
// that has one sails it as it says (a tack goes through the wind, a gybe takes the boom across, a header heads her,
// the penalty turn is done, the port boat crosses astern, the rounding leaves the mark to port), the camera frames it
// in the part of the screen left open, and the race comes back as it was, nothing of the scenes left behind.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { mock, ROOT } from './load.mjs';
import { installPage, fakeRenderer, FakeCanvas, seedRandom } from './fake-page.mjs';

const later = globalThis.setTimeout;
globalThis.setTimeout = (f, ms, ...a) => { const t = later(f, ms, ...a); if (ms >= 1000) t.unref?.(); return t; };
const real = pathToFileURL(join(ROOT, 'public/vendor/three@0.160.0/build/three.module.min.js')).href;
mock('three', `export * from '${real}'; export class WebGLRenderer { constructor(o) { return globalThis.__renderer(o); } }`);
globalThis.__renderer = () => fakeRenderer({ width: 1280, height: 720 });
installPage();
const THREE = await import(real);
const { World } = await import('../public/game/world.js');
const { Race, D2R, wrap } = await import('../public/game/sim.js');
const { CLS } = await import('../public/game/classes.js');
const { createStage, sceneIds, TAGS } = await import('../public/game/word-scenes.js');
const words = (await import('../public/game/words.json', { with: { type: 'json' } })).default;
const { SCENES_3D } = await import('../lib/glossary.ts');

seedRandom(99);
const race = new Race({ preset: 'medium', seed: 7, fleet: 4, start: 1, autoTrim: true });
const world = new World(new FakeCanvas(1280, 720));
world.setRace(race); world.resize(1280, 720); world.setQuality('high');
for (let i = 0; i < 3; i++) world.frame(0, race.t, 1 / 30);
const L = CLS.loa, W = race.wind.dir();
const twaOf = (b) => wrap(b.wdir - b.h) / D2R;

let stage = null;
// a scene sailed for s seconds, the world drawing it as the page does
const sail = (s, each) => { for (let i = 0; i < s * 30; i++) { race.idle(1 / 30); stage.frame(1 / 30); world.frame(1 / 30, race.t, 1 / 30); each?.(world.race.boats, i / 30); } };
const boats = () => world.race.boats;

test('every word of the glossary is a scene, but the two this class has no sail for', () => {
  const all = words.en.flatMap((g) => g.terms.map((x) => x[0]));
  const ids = sceneIds();
  for (const id of ids) assert.ok(all.includes(id), `${id} is a word of the glossary`);
  // what can't be seen: an idea (the apparent wind, VMG), what's too small to make out (telltales), or a sail she
  // doesn't carry (her headsail is a genoa, her kite a gennaker)
  assert.deepEqual(all.filter((id) => !ids.includes(id)), ['apparent-wind', 'vmg', 'jib', 'spinnaker', 'telltales'], 'every other word has one');
  assert.ok(ids.includes('genoa') && ids.includes('gennaker'));
  const dinghy = sceneIds({ id: 'laser', kite: false, reef: false, zero: false, jib: false });
  for (const id of ['gennaker', 'spinnaker', 'reef', 'code-zero', 'jib', 'genoa']) assert.ok(!dinghy.includes(id), `a Laser has no ${id}`);
  // the Dragon: a genoa and a spinnaker on a pole; the J/70: a jib and a gennaker
  const dragon = sceneIds({ id: 'dragon', kite: true, reef: false, zero: false });
  for (const [id, has] of [['spinnaker', true], ['genoa', true], ['gennaker', false], ['jib', false]]) assert.equal(dragon.includes(id), has, `the Dragon, ${id}`);
  const j70 = sceneIds({ id: 'j70', kite: true, reef: false, zero: false });
  for (const [id, has] of [['spinnaker', false], ['genoa', false], ['gennaker', true], ['jib', true]]) assert.equal(j70.includes(id), has, `the J/70, ${id}`);
  for (const [k, v] of Object.entries(TAGS)) assert.equal(v.length, 8, `the tag ${k} in every language`);
  // the site's pages know which words to show in 3D (lib/glossary.ts SCENES_3D, /dictionary)
  assert.deepEqual([...SCENES_3D].sort(), [...ids].sort());
});

test('a word shown puts the race away, its boats on the water instead; closed, the race is back as it was', () => {
  const was = { race: world.race, views: world.boatViews, wakes: world.wakes, contacts: world.contacts, guides: world.showGuides, mode: world.mode, kids: world.scene.children.length };
  stage = createStage({ world, race, lang: 'en' });
  assert.equal(stage.show('beat'), true);
  assert.notEqual(world.race, race);
  assert.equal(world.race.course, race.course, "the race's own course");
  assert.equal(world.race.wind, race.wind, 'its wind and sea');
  assert.equal(boats().length, 1);
  assert.ok(was.views.every((v) => !v.root.visible), "the race's boats are put away");
  assert.equal(typeof world.shot, 'function');
  sail(1);
  stage.close(); stage = null;
  assert.equal(world.race, race); assert.equal(world.boatViews, was.views); assert.equal(world.wakes, was.wakes); assert.equal(world.contacts, was.contacts);
  assert.equal(world.showGuides, was.guides); assert.equal(world.mode, was.mode); assert.equal(world.shot, null);
  assert.ok(was.views.every((v) => v.root.visible));
  assert.equal(world.scene.children.length, was.kids, 'nothing of the scenes left in the scene');
  assert.ok(!world.camera.view?.enabled, 'the camera frames the whole screen again');
  world.frame(0, race.t, 1 / 30);
});

test('each scene sails, its boats where they should be, finite, and the camera on them', () => {
  stage = createStage({ world, race, lang: 'ru' });
  stage.view({ x: 440, y: 0, w: 840, h: 720 });
  // this race's: an up-and-down course has no wing or offset mark
  assert.ok(!stage.ids.includes('wing-mark') && !stage.ids.includes('offset-mark'));
  assert.equal(stage.show('wing-mark'), false);
  for (const id of stage.ids) {
    assert.equal(stage.show(id), true, id);
    sail(2);
    for (const b of boats()) assert.ok(Number.isFinite(b.x) && Number.isFinite(b.z) && Number.isFinite(b.h) && (b.v >= 0 || id === 'backing'), `${id}: a boat sails`);
    const c = world.camera.position;
    assert.ok(Number.isFinite(c.x) && c.y > 0, `${id}: the camera above the water`);
    const near = Math.min(...boats().map((b) => Math.hypot(b.x - c.x, b.z - c.z)));
    assert.ok(near < 40 * L, `${id}: the camera by the boats (${near.toFixed(0)} m)`);
    assert.ok(world.camera.view.enabled && world.camera.view.offsetX < 0, `${id}: the picture's middle moved into the open part`);
  }
  // the tags in the language asked for
  stage.show('windward'); sail(0.5);
  const tags = world.boatViews.map((v) => v.tag).filter((s) => s.visible).map((s) => s.userData.text.replace(/false$/, ''));
  assert.deepEqual(tags.sort(), ['Наветренная', 'Подветренная']);
});

test('a tack goes through the wind and a gybe takes the boom across, as the words say', () => {
  stage.show('tack');
  const side0 = Math.sign(twaOf(boats()[0]));
  sail(8);
  assert.equal(Math.sign(twaOf(boats()[0])), -side0, 'on the other tack');
  assert.ok(Math.abs(twaOf(boats()[0])) < 60, 'close-hauled again');
  stage.show('gybe');
  const boom0 = boats()[0].boom;
  sail(8);
  assert.equal(boats()[0].boom, -boom0, 'the boom across');
  assert.ok(Math.abs(twaOf(boats()[0])) > 120, 'still off the wind');
});

test('luffing turns her towards the wind, bearing away from it; in irons she stops', () => {
  stage.show('luff'); sail(1.5); const a = Math.abs(twaOf(boats()[0])); sail(5);
  assert.ok(Math.abs(twaOf(boats()[0])) < a - 30, 'luffed');
  stage.show('bear-away'); sail(1.5); const b = Math.abs(twaOf(boats()[0])); sail(6);
  assert.ok(Math.abs(twaOf(boats()[0])) > b + 60, 'borne away');
  stage.show('in-irons'); sail(2);
  assert.ok(boats()[0].v < 1, 'no way on');
  assert.equal(boats()[0].trim, 'irons');
});

test('a header heads her and a lift lifts her, as the wind shifts on the scene alone', () => {
  for (const [id, sgn] of [['header', -1], ['lift', 1]]) {
    stage.show(id); sail(1.5);
    const h0 = boats()[0].h;
    sail(6);
    const turned = wrap(boats()[0].h - h0) / D2R; // starboard tack: a header turns her to port (h down), a lift to starboard
    assert.ok(turned * sgn > 8, `${id}: ${turned.toFixed(1)}°`);
    assert.ok(Math.abs(Math.abs(twaOf(boats()[0])) - Math.abs(twaOf(boats()[0]))) < 1);
  }
  assert.equal(race.wind.dir(), W, "the race's wind never moved");
});

test('the port boat crosses astern of the starboard one, never touching', () => {
  stage.show('starboard');
  let min = Infinity;
  sail(12, ([s, p]) => { min = Math.min(min, Math.hypot(s.x - p.x, s.z - p.z)); });
  assert.ok(min > 1.1 * L, `${(min / L).toFixed(2)} lengths apart at the closest`);
});

test('luffing and bearing away beside another boat: she goes higher, or lower, and the two never touch', () => {
  for (const [w, s, higher] of [['luff', 5, true], ['bear-away', 6, false]]) {
    stage.show(w);
    assert.equal(boats().length, 2, w);
    let near = Infinity;
    sail(1.5); const a = Math.abs(twaOf(boats()[0])), o = Math.abs(twaOf(boats()[1]));
    sail(s, ([p, q]) => { near = Math.min(near, Math.hypot(p.x - q.x, p.z - q.z)); });
    const d = Math.abs(twaOf(boats()[0])) - a;
    assert.ok(higher ? d < -30 : d > 50, `${w}: ${d.toFixed(0)}°`);
    assert.equal(boats()[0].tag, higher ? 'higher' : 'lower');
    assert.ok(near > 1.3 * L, `${w}: ${(near / L).toFixed(2)} lengths apart at the closest`);
    if (higher) assert.ok(Math.abs(twaOf(boats()[1])) < o - 30, 'the windward boat comes up after her');
    else assert.ok(Math.abs(Math.abs(twaOf(boats()[1])) - o) < 8, 'the other sails on close-hauled');
  }
});

test('the wind’s arrow lies on the water beside the boat, pointing down the wind, where the words name the wind', () => {
  const { arrow } = stage.extras;
  for (const w of ['tack', 'gybe', 'luff', 'bear-away', 'by-the-lee', 'crash-gybe', 'favoured-end', 'line-bias']) {
    stage.show(w); sail(0.5);
    assert.ok(arrow.visible, w);
    const line = w.includes('end') || w === 'line-bias', b = line ? race.course.committee : boats()[0];
    const up = { x: Math.sin(race.wind.dir()), z: -Math.cos(race.wind.dir()) }, dx = arrow.position.x - b.x, dz = arrow.position.z - b.z;
    if (line) assert.ok(dx * up.x + dz * up.z > 2 * L, `${w}: upwind of the line`);
    else assert.ok(Math.abs(dx * up.z - dz * up.x) > 1.5 * L, `${w}: alongside her, clear of her`);
    const tip = new THREE.Vector3(1, 0, 0).applyEuler(arrow.rotation);
    assert.ok(tip.x * up.x + tip.z * up.z < -0.99, `${w}: pointing down the wind`);
  }
  stage.show('reach'); sail(0.2);
  assert.equal(arrow.visible, false, 'not where the words don’t need it');
});

test('the favoured end shows ahead of the line square to the wind', () => {
  const { square } = stage.extras;
  stage.show('favoured-end'); sail(0.2);
  assert.ok(square.visible);
  const p = square.geometry.attributes.position, dx = p.getX(1) - p.getX(0), dz = p.getZ(1) - p.getZ(0);
  const up = { x: Math.sin(race.wind.dir()), z: -Math.cos(race.wind.dir()) };
  assert.ok(Math.abs(dx * up.x + dz * up.z) / Math.hypot(dx, dz) < 1e-6, 'square to the wind');
  stage.show('tack'); sail(0.2);
  assert.equal(square.visible, false);
});

test('the crash gybe is tagged as the danger it is, in red', () => {
  stage.show('crash-gybe'); sail(14);
  assert.equal(boats()[0].tag, 'danger');
  assert.equal(boats()[0].warn, true);
});

test('the umpire watches from a RIB by the boat taking her penalty, the flag up in her colour', () => {
  stage.show('umpire');
  const { rib } = stage.extras;
  assert.ok(rib.visible && boats()[0].pen);
  let far = 0, done = -1;
  sail(16, ([b], t) => { far = Math.max(far, Math.hypot(rib.position.x - b.x, rib.position.z - b.z)); if (done < 0 && !b.pen) done = t; });
  assert.ok(done > 0, 'the turn completed');
  assert.ok(far < 6 * L, `kept by her: ${(far / L).toFixed(1)} lengths at most`);
  assert.equal(rib.userData.flag.material.color.getHexString(), '3db8ff');
  stage.show('reach'); sail(0.2);
  assert.equal(rib.visible, false);
});

test('the penalty turn is done, a tack and a gybe, and she sails on', () => {
  stage.show('penalty');
  assert.ok(boats()[0].pen);
  let done = -1;
  sail(20, ([b], t) => { if (done < 0 && !b.pen) done = t; });
  assert.ok(done > 0, 'the turn completed');
});

test('a rounding leaves the windward mark to port and bears away onto the run, the inside boat nearer it', () => {
  stage.show('mark-room');
  const M = race.course.marks.mark;
  let closest = [Infinity, Infinity];
  sail(22, (bs) => { bs.forEach((b, i) => { closest[i] = Math.min(closest[i], Math.hypot(b.x - M.x, b.z - M.z)); }); });
  for (const b of boats()) assert.ok(Math.abs(twaOf(b)) > 100, 'on the run');
  assert.ok(closest[0] < closest[1], 'the inside one nearer the mark');
  assert.ok(closest[0] > 0.6 * L && closest[0] < 3 * L, `close by, not hitting it: ${(closest[0] / L).toFixed(2)} lengths`);
});

test('by the lee she runs on with the boom where it was; further, it crashes across; backing the main, she goes astern', () => {
  stage.show('by-the-lee');
  const boom = boats()[0].boom;
  sail(16);
  assert.equal(boats()[0].boom, boom, 'no gybe');
  assert.ok(boats()[0].byLee > 2, `by the lee ${boats()[0].byLee.toFixed(1)}°`);
  stage.show('crash-gybe');
  const b0 = boats()[0].boom;
  sail(14);
  assert.equal(boats()[0].boom, -b0, 'the boom came across on its own');
  assert.equal(boats()[0].auto, null, 'nobody gybed her');
  stage.show('backing'); sail(6);
  assert.ok(boats()[0].v < 0 && boats()[0].backing, 'going astern');
});

test('an oscillating wind swings her to and fro; a persistent one turns her one way for good', () => {
  stage.show('oscillating');
  const hs = [];
  sail(12, ([b]) => hs.push(b.h));
  const span = (Math.max(...hs.map((h) => wrap(h - hs[0]))) - Math.min(...hs.map((h) => wrap(h - hs[0])))) / D2R;
  assert.ok(span > 14, `swung ${span.toFixed(0)}°`);
  stage.show('persistent'); sail(1); const h0 = boats()[0].h; sail(15);
  assert.ok(wrap(boats()[0].h - h0) / D2R > 14, 'lifted for good');
});

test('a word with no scene gives the race back; the stage closes clean', () => {
  assert.equal(stage.show('nonsense'), false);
  assert.equal(world.race, race);
  assert.equal(stage.show('reach'), true);
  assert.notEqual(world.race, race);
  stage.close(); stage = null;
  assert.equal(world.race, race);
  world.frame(0, race.t, 1 / 30);
});

test('on a triangle the wing mark is rounded to port, and she goes on down towards the gate', () => {
  const tri = new Race({ preset: 'medium', seed: 7, fleet: 4, start: 1, autoTrim: true, course: 'tri' });
  world.setRace(tri); for (let i = 0; i < 2; i++) world.frame(0, tri.t, 1 / 30);
  stage = createStage({ world, race: tri, lang: 'en' });
  assert.ok(stage.ids.includes('wing-mark') && !stage.ids.includes('offset-mark'));
  assert.equal(stage.show('wing-mark'), true);
  const w = tri.course.marks.wing, G = tri.course.gate;
  let closest = Infinity;
  const run = (n) => { for (let i = 0; i < n * 30; i++) { tri.idle(1 / 30); stage.frame(1 / 30); world.frame(1 / 30, tri.t, 1 / 30); const b = world.race.boats[0]; closest = Math.min(closest, Math.hypot(b.x - w.x, b.z - w.z)); } };
  run(16);
  const b = world.race.boats[0], gm = { x: (G[0].x + G[1].x) / 2, z: (G[0].z + G[1].z) / 2 }, gd = Math.hypot(gm.x - b.x, gm.z - b.z);
  assert.ok(closest < 3 * L && closest > 0.4 * L, `passed by the mark: ${(closest / L).toFixed(2)} lengths`);
  assert.ok(((gm.x - b.x) * Math.sin(b.h) - (gm.z - b.z) * Math.cos(b.h)) / gd > 0.85, 'then heading on for the gate');
  assert.ok(b.boom < 0, 'gybed round it, onto port');
  stage.close(); stage = null;
  world.setRace(race);
});

test('every tag, in every language, fits its label whole: none is cut off at the edges', async () => {
  const { labelSprite } = await import('../public/game/yacht.js');
  for (const [k, names] of Object.entries(TAGS)) for (const name of names) {
    const s = labelSprite('#ffffff'), x = s.material.map.image.getContext('2d'), W = s.material.map.image.width;
    s.userData.set(name, false);
    const t = x.texts.at(-1), half = x.measureText(name).width / 2;
    assert.equal(t.text, name);
    assert.ok(t.x - half >= 0 && t.x + half <= W, `${k} "${name}" runs off its ${W} px label`);
    assert.match(t.font, /\b30px\b/, `${k} "${name}" is set at full size`);
  }
});

test('where the open water is a narrow strip, every tag stays inside it, its pill slid in over the boat near an edge', () => {
  const r = { x: 680, y: 0, w: 600, h: 720 }; // the panel at the side of a screen held upright (/dictionary at 864 x 1080, as 4:5)
  const cam = world.camera, p = new THREE.Vector3(), s = new THREE.Vector3();
  for (const lang of ['ru', 'fr', 'en']) {
    stage = createStage({ world, race, lang }); stage.view(r);
    for (const id of ['mark-room', 'port', 'ocs', 'general-recall', 'windward']) {
      assert.equal(stage.show(id), true, id);
      let seen = 0, slid = 0;
      sail(6, () => world.boatViews.forEach((v) => {
        const tag = v.tag; if (!tag?.visible || !v.root.visible) return;
        tag.getWorldPosition(p); tag.getWorldScale(s); p.project(cam);
        const spr = s.x * cam.projectionMatrix.elements[0] / 2 * 1280, pill = spr * tag.userData.w / tag.material.map.image.width;
        const mid = (p.x + 1) / 2 * 1280 - (tag.center.x - 0.5) * spr;
        assert.ok(mid - pill / 2 >= r.x + 7 && mid + pill / 2 <= r.x + r.w + -7, `${lang} ${id}: the tag "${tag.userData.text}" inside the open water`);
        seen++; if (Math.abs(tag.center.x - 0.5) > 0.01) slid++;
      }));
      assert.ok(seen > 0, `${lang} ${id}: its tags are shown`);
      if (lang === 'ru' && id === 'mark-room') assert.ok(slid > 0, 'near the edge a tag is slid in');
    }
    stage.close(); stage = null;
  }
  world.frame(0, race.t, 1 / 30);
});
