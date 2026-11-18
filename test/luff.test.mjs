// Rule 11 as the rules define it: of two boats overlapped on the same tack, the leeward boat is the one on the other's
// leeward side, wherever the wind's own line would put her. A boat luffing the one to windward of her keeps her right of way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u))));
const sim = await import('../public/game/sim.js');
const { D2R, lineD } = sim;

// `lee` lies `abeam` metres on the leeward side of `wind` and `ahead` metres in front of her, on the same tack, `twa` off the wind
function pair({ twa = 45, ahead = 0, abeam = 4, luff = 0, tack = -1 }) {
  const r = new sim.Race({ preset: 'medium', length: 'short', seed: 11, fleet: 2, start: 1 }), [wind, lee] = r.boats, W = r.wind.at(0, 0).dir;
  r.clock = 100;
  const h = W - tack * twa * D2R, fx = Math.sin(h), fz = -Math.cos(h), rx = Math.cos(h), rz = Math.sin(h); // (r: her starboard side)
  const set = (b, hd, x, z) => Object.assign(b, { x, z, h: hd, v: 3, leg: 1, twa: Math.atan2(Math.sin(W - hd), Math.cos(W - hd)), tws: 12, wdir: W, tackSide: tack, boom: tack, lastD: lineD(r.course, { x, z }), lastZ: z, auto: null, rudder: 0, yawRate: 0, sinceTack: 60, hist: [], helm: [] });
  set(wind, h, 0, 0);
  set(lee, h + tack * luff * D2R, -tack * rx * abeam + fx * ahead, -tack * rz * abeam + fz * ahead);
  return { r, wind, lee };
}

for (const tack of [-1, 1]) for (const twa of [45, 90, 150]) for (const ahead of [-8, -4, 0, 4, 8]) {
  test(`${tack < 0 ? 'port' : 'starboard'} tack, ${twa}° off the wind, ${ahead} m ahead: the windward boat keeps clear`, () => {
    const { r, wind, lee } = pair({ twa, ahead, tack });
    for (const [a, b] of [[wind, lee], [lee, wind]]) assert.deepEqual(r.rightOfWay(a, b), { giver: wind, rule: '11' });
  });
}

test('luffing, her bow turned towards the boat to windward, she is still the leeward boat', () => {
  for (const luff of [10, 20, 30]) for (const ahead of [-4, 0, 3, 6]) {
    const { r, wind, lee } = pair({ ahead, abeam: 3.5, luff });
    assert.equal(r.rightOfWay(lee, wind).giver, wind, `luff ${luff}°, ${ahead} m ahead`);
  }
});

test('a contact while luffing costs the windward boat the penalty turn', () => {
  const { r, wind, lee } = pair({ ahead: 5, abeam: 3 });
  r.foul(lee, wind);
  assert.ok(wind.pen, 'the windward boat owes a turn');
  assert.equal(lee.pen, null);
});
