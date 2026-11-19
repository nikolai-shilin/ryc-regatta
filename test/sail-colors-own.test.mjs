// The admin's 'each boat's own' jib (/admin, 'sail_colors'; public/game/yacht.js sailColors): a banner printed on red
// goes on the jib as it is, and the cloth around it stays the colour its player picked. A page of its own: what
// /sponsor answers is asked for once a page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mock } from './load.mjs';
import { installPage, FakeImage } from './fake-page.mjs';

mock('public/game/sponsor.js', 'export const sponsor = () => Promise.resolve(globalThis.__sponsor ?? null);');
installPage({ paint: () => [174, 0, 0, 255] }); // every picture solid red to its corners
globalThis.Image = class extends FakeImage { constructor() { super(900, 200); } };
globalThis.__sponsor = { jib: '/images/ryc-jib-banner.svg', main: null, kite: null, colors: { jib: 'own', kite: null }, banner: null };
const Y = await import('../public/game/yacht.js');
const { LOOKS } = Y;
const settle = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r)); };

test('a jib kept each boat’s own carries the banner on its own cloth', async () => {
  const t = Y.sailTexture('jib', LOOKS.Halcyon), x = t.image.getContext('2d');
  await settle();
  assert.ok(!x.rects.some((r) => /^rgb\(/.test(r.fill)), 'not dyed the banner’s red');
  assert.equal(x.images.filter((d) => d.image.height === 1024).length, 120, 'the banner laid on it, turned');
});

test('a gennaker with no colour set keeps the boat’s own, painted once', async () => {
  const t = Y.sailTexture('kite', LOOKS.Aurora), dyed = () => t.image.getContext('2d').rects.filter((r) => r.w === 512 && r.h === 512 && r.x === 0).map((r) => r.fill);
  await settle();
  assert.deepEqual(dyed(), [LOOKS.Aurora.kite]);
});
