// The colours the admin dyes every boat's jib and gennaker (/admin, 'sail_colors'; public/game/yacht.js sailColors), over
// what each player picked: here one colour for every jib, with no ad on it, and one for every gennaker.
// A page of its own: what /sponsor answers is asked for once a page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mock } from './load.mjs';
import { installPage } from './fake-page.mjs';

mock('public/game/sponsor.js', 'export const sponsor = () => Promise.resolve(globalThis.__sponsor ?? null);');
installPage();
globalThis.__sponsor = { jib: null, main: null, kite: null, colors: { jib: '#123456', kite: '#ff0000' }, banner: null };
const Y = await import('../public/game/yacht.js');
const { LOOKS } = Y;
const settle = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r)); };

test('every jib is dyed the admin’s colour on both faces, with no ad on it', async () => {
  const t = Y.sailTexture('jib', LOOKS.Halcyon), v = t.version, W = t.image.width, H = t.image.height;
  await settle();
  assert.ok(t.version > v);
  for (const c of [t.image, t.back.image]) {
    const rects = c.getContext('2d').rects;
    assert.ok(rects.some((r) => r.fill === '#123456' && r.w === W && r.h === H), 'the cloth dyed');
    assert.ok(rects.some((r) => r.fill === LOOKS.Halcyon.batten), 'its battens drawn again');
  }
});

test('a headsail that carries no ad keeps its own cloth', async () => {
  const t = Y.sailTexture('jib', LOOKS.Halcyon, { hd: { z: 1, y: 10 }, clew: { z: 4, y: 0.5 }, noAd: true });
  await settle();
  assert.ok(!t.image.getContext('2d').rects.some((r) => r.fill === '#123456'));
});

test('every gennaker is painted again in the admin’s colour, on both faces', async () => {
  const t = Y.sailTexture('kite', LOOKS.Aurora), v = t.version;
  await settle();
  assert.ok(t.version > v);
  for (const c of [t.image, t.back.image]) assert.ok(c.getContext('2d').rects.some((r) => r.fill === '#ff0000' && r.w === 512 && r.h === 512), 'dyed all over');
});
