// The admin's pictures on every boat's sails (public/game/yacht.js): the jib's banner taking the whole sail, turned to
// read up the luff when that makes it larger, and the gennaker's logo, large and upright on both faces of the kite.
// A page of its own: what /sponsor answers is asked for once a page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mock } from './load.mjs';
import { installPage, page, FakeImage } from './fake-page.mjs';

mock('public/game/sponsor.js', 'export const sponsor = () => Promise.resolve(globalThis.__sponsor ?? null);');
installPage();
globalThis.Image = class extends FakeImage { constructor() { super(900, 200); } }; // every picture a wide banner, 4.5:1
globalThis.__sponsor = { jib: '/images/ryc-jib-banner.svg', main: null, kite: '/flags/tr.svg', banner: null };
const Y = await import('../public/game/yacht.js');
const { LOOKS } = Y;
const settle = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r)); };
const RED = [174, 0, 0, 255];

// a jib's shape, tack at the origin: the luff to the head 1 m aft and 10 m up, the foot to the clew 4 m aft, 0.5 m up
const luffZ = (y) => y / 10, aftZ = (y) => (y < 0.5 ? 8 * y : 4 + ((1 - 4) * (y - 0.5)) / 9.5);

test('the box fitted to a sail stays on its cloth, clear of the luff, the leech and the foot', () => {
  for (const aspect of [4, 1, 0.25]) {
    const { w, h, zc, yc } = Y.fitBox(luffZ, aftZ, 0.6, 9.6, aspect, 0.1);
    assert.ok(w > 0.5, `aspect ${aspect}: ${w} m wide`);
    assert.ok(Math.abs(w / h - aspect) < 1e-9);
    for (let k = 0; k <= 20; k++) {
      const y = yc - h / 2 + (h * k) / 20;
      assert.ok(y >= 0.6 - 1e-9 && y <= 9.6 + 1e-9);
      assert.ok(zc - w / 2 >= luffZ(y) + 0.1 - 1e-6, `clear of the luff at ${y}`);
      assert.ok(zc + w / 2 <= aftZ(y) - 0.1 + 1e-6, `clear of the leech at ${y}`);
    }
  }
});

test('a wide banner comes out larger turned up a tall jib than lying across it', () => {
  const level = Y.fitBox(luffZ, aftZ, 0.6, 9.6, 4.5, 0.1), turned = Y.fitBox(luffZ, aftZ, 0.6, 9.6, 1 / 4.5, 0.1);
  assert.ok(turned.w * turned.h > 2 * level.w * level.h);
});

test('a picture printed on a colour of its own gives that colour; one with clear or unlike corners gives none', () => {
  page.paint = () => RED;
  assert.equal(Y.groundOf(new Image()), 'rgb(174,0,0)');
  page.paint = () => [174, 0, 0, 120];
  assert.equal(Y.groundOf(new Image()), null);
  page.paint = (x, y) => (x > 32 && y > 32 ? [0, 0, 255, 255] : RED);
  assert.equal(Y.groundOf(new Image()), null);
});

test('a banner on a colour dyes the whole jib, both faces, and reads up the luff', async () => {
  page.paint = () => RED;
  const t = Y.sailTexture('jib', LOOKS.Halcyon), v = t.version, W = t.image.width, H = t.image.height;
  await settle();
  assert.ok(t.version > v && t.back.version > 0, 'both faces redrawn');
  for (const c of [t.image, t.back.image]) {
    const x = c.getContext('2d');
    assert.ok(x.rects.some((r) => r.fill === 'rgb(174,0,0)' && r.x === 0 && r.y === 0 && r.w === W && r.h === H), 'the cloth dyed');
    assert.ok(x.rects.some((r) => r.fill === LOOKS.Halcyon.tape), 'its tapes drawn again over the colour');
    const strips = x.images.filter((d) => d.image.height === 1024);
    assert.equal(strips.length, 120, 'the banner turned (1024 px tall) and laid in strips');
    assert.equal(x.counts.rotate, 120, 'each strip turned through the luff\'s rake, along the line the jib furls on');
  }
  const turned = [t.image, t.back.image].map((c) => c.getContext('2d').images.find((d) => d.image.height === 1024).image);
  assert.notEqual(turned[0], turned[1], 'each face its own turn: the words stand on the luff on both, not mirrored on one');
  const [front, back] = turned.map((c) => c.getContext('2d').counts);
  assert.equal(front.rotate, 1); assert.equal(back.rotate, 1);
});

test('a banner on a ground of its own, the jib dyed that ground, is drawn a size larger than one on a clear ground', async () => {
  const width = async (paint) => {
    page.paint = paint;
    const t = Y.sailTexture('jib', LOOKS.Nomad);
    await settle();
    return t.image.getContext('2d').images.find((d) => d.image.height === 1024).args[6]; // each strip's width
  };
  const dyed = await width(() => RED), clear = await width(() => [0, 0, 0, 0]);
  assert.ok(Math.abs(dyed / clear - 1.15) < 1e-9, `${dyed} is not 1.15 × ${clear}`);
});

test('a picture with clear corners leaves the jib its own cloth', async () => {
  page.paint = () => [0, 0, 0, 0];
  const t = Y.sailTexture('jib', LOOKS.Nomad);
  await settle();
  assert.ok(!t.image.getContext('2d').rects.some((r) => /^rgb\(/.test(r.fill)));
  assert.ok(t.image.getContext('2d').images.length >= 120);
});

test('the gennaker carries the logo on both faces, within its cloth', async () => {
  page.paint = () => RED;
  const t = Y.sailTexture('kite', LOOKS.Aurora), v = t.version;
  assert.ok(t.back, 'the back face has a canvas of its own');
  const before = [t.image, t.back.image].map((c) => c.getContext('2d').images.length);
  await settle();
  assert.ok(t.version > v);
  [t.image, t.back.image].forEach((c, k) => {
    const drawn = c.getContext('2d').images.slice(before[k]);
    assert.equal(drawn.length, 1, 'one picture laid on each face');
    const [x0, y0] = drawn[0].args, { width: w, height: h } = drawn[0].image;
    assert.ok(x0 >= 0 && y0 >= 0 && x0 + w <= 512 && y0 + h <= 512, 'inside the sail');
    assert.ok(w > 200 && h > 120, `large: ${w} × ${h} px of the kite's 512`);
  });
  assert.ok(page.images.includes('/flags/tr.svg'));
});

test('a logo of one colour on a clear ground is printed in the boat\'s number colour; any other picture as it is', () => {
  const pic = () => { const c = document.createElement('canvas'); c.width = 100; c.height = 50; return c; };
  const tinted = (c) => c.getContext('2d').rects.some((r) => r.fill === '#123456' && r.w === 100 && r.h === 50);
  page.paint = (x, y) => (x > 30 && x < 70 && y > 10 && y < 40 ? [255, 255, 255, 255] : [0, 0, 0, 0]); // white, cut out
  assert.equal(tinted(Y.inked(pic(), '#123456')), true);
  page.paint = () => RED; // on a ground of its own
  assert.equal(tinted(Y.inked(pic(), '#123456')), false);
  page.paint = (x, y) => (x < 50 ? [255, 255, 255, 255] : y < 25 ? [0, 0, 0, 0] : [174, 0, 0, 255]); // two colours
  assert.equal(tinted(Y.inked(pic(), '#123456')), false);
  page.paint = () => [0, 0, 0, 0]; // nothing at all
  assert.equal(tinted(Y.inked(pic(), '#123456')), false);
});
