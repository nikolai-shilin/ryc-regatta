// The F50's physics, sailed in a steady wind against what is known of the boat: she lifts off at about 15 knots of boat
// speed and, from SailGP's own trials of the T-foils, in 7-8.6 knots of wind she foils on a reach but not upwind or
// downwind; through a tack in a breeze she stays on her foils, bottoming out in the teens; luffed head to wind at speed
// she comes off her foils within seconds and stops in some eight of her lengths, not hundreds of metres.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

globalThis.location = { search: '?venue=palma&boat=f50' };
globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u))));
const sim = await import('../public/game/sim.js');
const { CLS } = await import('../public/game/classes.js');
const { D2R, KN } = sim;
const kn = (v) => v / KN;

// her alone, in a steady wind from the north with no sea
function setup(tws) {
  const r = new sim.Race({ preset: 'medium', fleet: 2, seed: 3, autoTrim: true });
  const P = r.player; P.autoTrim = true;
  r.wind.at = () => ({ dir: 0, tws, gust: 0 }); r.wind.dir = () => 0; r.wind.p.waves = 0;
  r.boats = [P];
  return { r, P };
}
const hFor = (twa) => -twa * D2R;
const hold = (r, P, twa, secs, each) => { for (let i = 0; i < secs * 30; i++) { if (!P.auto) r.steerTo(P, hFor(twa)); r.step(1 / 30); each?.(i / 30); } };
const flying = (P, tws, twa) => { P.h = hFor(twa); P.v = 25 * KN; P.fly = true; P.ride = 1; };

test('the page sails the F50', () => assert.equal(CLS.id, 'f50'));

test('she lifts off at some 15 knots on a reach, from 7 knots of wind and not in 6', () => {
  for (const [tws, lifts] of [[6, false], [7, true], [12, true]]) {
    const { r, P } = setup(tws); P.h = hFor(95); P.v = 4 * KN; let at = null;
    hold(r, P, 95, 60, () => { if (P.fly && at === null) at = kn(P.v); });
    assert.equal(at !== null, lifts, `${tws} knots of wind`);
    if (lifts) assert.ok(at > 14.5 && at < 16.5, `lifted at ${at} knots`);
  }
});

test('in 6 knots of wind she flies on a reach but comes down upwind and deep downwind', () => {
  for (const [twa, up] of [[48, false], [95, true], [160, false]]) {
    const { r, P } = setup(6); flying(P, 6, twa);
    hold(r, P, twa, 90);
    assert.equal(!!P.fly, up, `at ${twa}° off the wind, ${kn(P.v).toFixed(1)} knots`);
  }
});

test('from 10 knots of wind she tacks on her foils, bottoming out in the teens', () => {
  for (const tws of [10, 14, 20]) {
    const twa = sim.beatAngle(tws) + 2, { r, P } = setup(tws); flying(P, tws, twa);
    hold(r, P, twa, 30);
    let low = P.v, off = 0;
    P.tackOrGybe();
    for (let i = 0; i < 20 * 30; i++) { if (!P.auto) r.steerTo(P, hFor(-twa)); r.step(1 / 30); low = Math.min(low, P.v); if (!P.fly) off += 1 / 30; }
    assert.equal(off, 0, `${tws} knots: off her foils ${off.toFixed(1)} s`);
    assert.ok(kn(low) > 12 && kn(low) < 21, `${tws} knots: down to ${kn(low).toFixed(1)}`);
  }
});

test('luffed head to wind at speed she is off her foils within seconds and stops in some eight lengths', () => {
  const { r, P } = setup(16); flying(P, 16, sim.beatAngle(16));
  hold(r, P, sim.beatAngle(16), 20);
  const x0 = P.x, z0 = P.z; let t = 0, down = null;
  while (P.v > 8 * KN && t < 60) { P.rudder = 0; P.h = 0; r.step(1 / 30); t += 1 / 30; if (!P.fly && down === null) down = t; }
  const d = Math.hypot(P.x - x0, P.z - z0);
  assert.ok(down !== null && down < 14, `off her foils at ${down}`);
  assert.ok(d > 60 && d < 180, `${Math.round(d)} m to slow below 8 knots`);
});

// her boards and T-rudders hold her sideways far harder than a keel (classes.js leeK): close-hauled on her foils her
// track runs within a degree and a half of her heading, and through a tack she slides sideways at under a knot, where a
// keelboat's leeway at her speeds had her skidding at 1.4 knots, like a sledge on snow
test('her foils hold her: little leeway close-hauled, and no skid through a tack', () => {
  const { r, P } = setup(14), twa = sim.beatAngle(14); flying(P, 14, twa);
  hold(r, P, twa, 30);
  let x0 = P.x, z0 = P.z;
  hold(r, P, twa, 10);
  const off = Math.abs(((Math.atan2(P.x - x0, -(P.z - z0)) - P.h) / D2R + 540) % 360 - 180);
  assert.ok(off < 1.5, `close-hauled her track is ${off.toFixed(1)}° off her heading`);
  let px = P.x, pz = P.z, worst = 0;
  P.tackOrGybe();
  for (let i = 0; i < 12 * 30; i++) {
    if (!P.auto) r.steerTo(P, hFor(-twa)); r.step(1 / 30);
    const vx = (P.x - px) * 30, vz = (P.z - pz) * 30; px = P.x; pz = P.z;
    worst = Math.max(worst, Math.abs(vx * Math.cos(P.h) + vz * Math.sin(P.h)));
  }
  assert.ok(kn(worst) < 1, `through a tack she slid sideways at ${kn(worst).toFixed(2)} knots`);
});
