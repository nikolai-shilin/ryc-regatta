// The J Class's two headsails: the yankee flies outside the staysail, and however hard the two flog in a tack the
// staysail's cloth never comes through the yankee's.
import test from 'node:test';
import assert from 'node:assert/strict';
import './load.mjs';
import { installPage, recordRace, seedRandom } from './fake-page.mjs';

installPage({ pathname: '/fleet-view' });
const THREE = await import('three');
const Y = await import('../public/game/yacht.js');
const B = await import('../public/game/boats3d.js');
const { CLASSES } = await import('../public/game/classes.js');
const { D2R } = await import('../public/game/sim.js');

seedRandom(4242);
const { W, frames } = await recordRace({ frames: 600, every: 12 });
const base = frames[frames.length - 1].b;
const boatAt = (o) => ({ ...base, x: 0, z: 0, h: 0, v: 3, heel: 8, kite: false, kiteFill: 0, kiteJob: null, boom: 0, depower: 0, ...o });

// a sail's cloth where it lies in the boat
function cloth(sail, pivot) {
  const { rows, cols, g } = sail.userData, p = g.attributes.position, v = new THREE.Vector3(), a = [];
  for (let i = 0; i <= rows; i++) { const r = []; for (let j = 0; j <= cols; j++) { v.fromBufferAttribute(p, i * (cols + 1) + j).applyQuaternion(pivot.quaternion).add(pivot.position); r.push(v.toArray()); } a.push(r); }
  return { a, rows, cols };
}
// how far to leeward of the staysail the yankee lies, at each point of the staysail that has the yankee alongside it
function gaps(view) {
  const Y0 = cloth(view.jib, view.jibPivot), S = cloth(view.stay, view.stayPivot), lee = -Math.sign(view.sailSide), out = [], tris = [];
  for (let i = 0; i < Y0.rows; i++) for (let j = 0; j < Y0.cols; j++) { const [a, b, c, d] = [Y0.a[i][j], Y0.a[i][j + 1], Y0.a[i + 1][j], Y0.a[i + 1][j + 1]]; tris.push([a, b, c], [b, d, c]); }
  for (const row of S.a) for (const [x, y, z] of row) for (const [a, b, c] of tris) {
    const det = (b[1] - a[1]) * (c[2] - a[2]) - (c[1] - a[1]) * (b[2] - a[2]);
    if (Math.abs(det) < 1e-9) continue;
    const s = ((y - a[1]) * (c[2] - a[2]) - (c[1] - a[1]) * (z - a[2])) / det, t = ((b[1] - a[1]) * (z - a[2]) - (y - a[1]) * (b[2] - a[2])) / det;
    if (s < 0 || t < 0 || s + t > 1) continue;
    out.push(lee * (a[0] + s * (b[0] - a[0]) + t * (c[0] - a[0]) - x));
    break;
  }
  return out;
}
const make = () => B.makeBoatView({ look: Y.LOOKS.Halcyon }, CLASSES.jclass);
const sail = (view, b, n, t0 = 100) => { for (let i = 0; i < n; i++) view.update(b, t0 + i / 30, W, false); };

test('flogging head to wind, the staysail stays inside the yankee', () => {
  const view = make();
  for (const tack of [1, -1]) for (const twa of [24, 14, 8]) {
    const b = boatAt({ twa: tack * twa * D2R, awa: tack * twa * D2R, aws: 13, sail: 6, jibSail: 6, trim: 'irons', luff: 1 });
    sail(view, b, 90, 50 + twa); // settled on this tack: as they change over, on the centreline, neither is outside
    for (let k = 0; k < 12; k++) {
      sail(view, b, 8, 100 + k * 3 + twa);
      const g = gaps(view);
      assert.ok(g.length > 50, 'the two sails lie alongside each other');
      assert.ok(Math.min(...g) > 0, `at ${tack * twa}° the staysail came ${(-Math.min(...g)).toFixed(2)} m through the yankee`);
    }
  }
});

// two flat sails, the outer 4 m by 4 m lying on top of the inner one
const flat = (x, rows = 4, cols = 4) => { const a = new Float32Array((rows + 1) * (cols + 1) * 3); for (let i = 0, q = 0; i <= rows; i++) for (let j = 0; j <= cols; j++, q += 3) a.set([x, i, j], q); return { a, rows, cols }; };

test('the outer sail is laid to leeward of the inner, its luff left on its stay', () => {
  const outer = flat(0), inner = flat(0.5);
  assert.ok(B.drapeOver(outer, inner, 1, 0.3) > 0);
  const x = (r, c) => outer.a[(r * 5 + c) * 3];
  assert.ok(Math.abs(x(2, 2) - 0.8) < 1e-6, `the middle lies at ${x(2, 2)}`);
  for (let r = 0; r <= 4; r++) assert.equal(x(r, 0), 0, `row ${r} of the luff`);
});

test('her sheets stay on the clew when it is pushed out', () => {
  const view = make(), b = boatAt({ twa: 14 * D2R, awa: 14 * D2R, aws: 13, sail: 6, jibSail: 6, trim: 'irons', luff: 1 });
  let seen = 0;
  for (let k = 0; k < 40; k++) {
    sail(view, b, 3, 100 + k);
    if (!view.jib.userData.draped) continue;
    seen++;
    const { cols, g } = view.jib.userData, clew = new THREE.Vector3().fromBufferAttribute(g.attributes.position, cols).applyQuaternion(view.jibPivot.quaternion).add(view.jibPivot.position);
    for (const s of [view.jibSheet, view.lazySheet]) assert.ok(clew.distanceTo(new THREE.Vector3().fromBufferAttribute(s.geometry.attributes.position, 0)) < 1e-3, 'the sheet is on the clew');
  }
  assert.ok(seen > 0, 'the yankee was laid over the staysail');
});

test('in the moment of a tack, with both on the centreline, neither sail is outside', () => {
  const outer = flat(0), inner = flat(0.5);
  assert.equal(B.drapeOver(outer, inner, 0.1, 0.3), 0);
  assert.equal(B.drapeOver(outer, inner, -0.1, 0.3), 0);
});

test('past the inner sail\'s edge the outer falls back to its own shape', () => {
  const outer = flat(0, 4, 12), inner = flat(0.5, 4, 4);
  B.drapeOver(outer, inner, 1, 0.3, 2.5);
  const x = (c) => outer.a[(2 * 13 + c) * 3];
  assert.ok(Math.abs(x(4) - 0.8) < 1e-6, 'at the edge it is still over it');
  assert.ok(x(5) < x(4) && x(5) > x(6), 'then it falls away');
  assert.equal(x(7), 0, 'and beyond its reach it is left alone');
});

test('sailing well trimmed, the yankee sets as she always has', () => {
  const b = boatAt({ twa: 40 * D2R, awa: 28 * D2R, aws: 14, sail: 12, jibSail: 12, trim: 'ok', luff: 0 });
  const view = make();
  sail(view, b, 90);
  const g = gaps(view);
  assert.ok(Math.min(...g) > 0.3, `the slot between them is ${Math.min(...g).toFixed(2)} m`);
  assert.equal(view.jib.userData.draped, 0, 'nothing on her needed moving');
});
