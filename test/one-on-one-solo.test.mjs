// A race with one human is untouched by the race for two: the `multi` branches of sim.js. A computer boat that has finished
// still casts a wind shadow and can still be hit, a computer boat still hails, and the race ends as it always did. Each is
// held against the same water in a race for two, where it must be the other way round.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u))));
const { Race, D2R, lineD, FINISH_LIMIT_S, HULL } = await import('../public/game/sim.js');

// the race's other boat, as this race has her: a computer boat, or the second human
const WAYS = [['today\'s race', () => new Race({ preset: 'medium', length: 'short', seed: 11, fleet: 3, start: 1 })], ['one human named', () => new Race({ preset: 'medium', length: 'short', seed: 11, fleet: 3, start: 1, humans: [{ id: 'me', name: 'Me' }] })]];
const twoHumans = () => new Race({ preset: 'medium', length: 'short', seed: 11, fleet: 2, start: 1, humans: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], me: 'a' });
const said = (r, key, b) => r.messages.filter((m) => m.key === key && m.to === b);
const put = (r, b, p, h, v = 3) => Object.assign(b, { x: p.x, z: p.z, h, v, lastD: lineD(r.course, b), lastZ: p.z, auto: null, rudder: 0, yawRate: 0 });
const midBeat = (c) => ({ x: (c.pin.x + c.committee.x) / 4 + c.windward.x / 2, z: (c.pin.z + c.committee.z) / 4 + c.windward.z / 2 });
// after the gun, the player and the other boat on the beat; the rest of the fleet far off
function afloat(make) {
  const r = make(), P = r.player, o = r.boats.find((b) => b !== P);
  r.clock = 100;
  for (const b of r.boats) b.leg = 1;
  r.boats.filter((b) => b !== P && b !== o).forEach((b, i) => put(r, b, { x: 3000 + 100 * i, z: 3000 }, 0, 0));
  return { r, P, o, X: midBeat(r.course), W: r.wind.dir() };
}
const finished = (b) => Object.assign(b, { done: true, finish: 90, place: 1 });

const shadowOn = (make, home) => { // the player straight downwind of the other boat, 15 m
  const { r, P, o, X, W } = afloat(make);
  put(r, o, X, W - 50 * D2R); if (home) finished(o);
  put(r, P, { x: X.x - Math.sin(W) * 15, z: X.z + Math.cos(W) * 15 }, W - 50 * D2R);
  return r.windAt(P).shadow;
};
const backwindOn = (make, home) => { // the other boat close ahead and to leeward of the player, bending the wind back on her
  const { r, P, o, X, W } = afloat(make), h = W - 45 * D2R;
  put(r, P, X, h); put(r, o, { x: X.x - Math.sin(W) * 9 + Math.sin(h) * 6, z: X.z + Math.cos(W) * 9 - Math.cos(h) * 6 }, h); if (home) finished(o);
  return r.windAt(P).shadow;
};
const hitBy = (make, home) => { // the two hulls touching
  const { r, P, o, X, W } = afloat(make), h = W - 50 * D2R;
  put(r, o, X, h); put(r, P, { x: X.x + Math.cos(h) * 0.5, z: X.z + Math.sin(h) * 0.5 }, h); if (home) finished(o);
  const v = P.v;
  r.collide(1 / 60);
  return { bumps: said(r, 'bump', P).length, slowed: P.v < v };
};

for (const [what, make] of WAYS) {
  test(`${what}: a computer boat that has finished still casts her wind shadow`, () => {
    const racing = shadowOn(make, false), home = shadowOn(make, true);
    assert.ok(racing > 0, 'in her lee'); assert.equal(home, racing, 'the same, finished or not');
    assert.equal(shadowOn(twoHumans, true), 0, '(in a race for two, a boat home casts none)');
    assert.ok(shadowOn(twoHumans, false) > 0);
  });

  test(`${what}: a computer boat that has finished still bends the wind back on a boat to windward`, () => {
    const racing = backwindOn(make, false), home = backwindOn(make, true);
    assert.ok(racing > 0, 'her backwind'); assert.equal(home, racing);
    assert.equal(backwindOn(twoHumans, true), 0, '(in a race for two, none)');
  });

  test(`${what}: a computer boat that has finished can still be hit`, () => {
    assert.deepEqual(hitBy(make, true), { bumps: 1, slowed: true });
    assert.deepEqual(hitBy(make, false), { bumps: 1, slowed: true });
    assert.deepEqual(hitBy(twoHumans, true), { bumps: 0, slowed: false }, '(in a race for two, a boat home is out of the way)');
  });

  test(`${what}: a computer boat hails the human who must keep clear, once in seven seconds`, () => {
    const { r, P, o, X, W } = afloat(make), V = 3.4, T = 5, at = (h) => ({ x: X.x - Math.sin(h) * V * T, z: X.z + Math.cos(h) * V * T });
    const meet = () => { put(r, o, at(W - 45 * D2R), W - 45 * D2R, V); put(r, P, at(W + 45 * D2R), W + 45 * D2R, V); }; // she on starboard, the player on port
    meet(); r.step(1 / 60);
    assert.equal(said(r, 'hail', P).length, 1, 'port is hailed');
    assert.equal(said(r, 'hail', P)[0].arg.who, o.name);
    assert.equal(P.log.hails[said(r, 'hail', P)[0].arg.rule], 1, 'and it is in her log');
    meet(); r.step(1 / 60);
    assert.equal(said(r, 'hail', P).length, 1, 'not again at once');
    r.clock += 7.5; meet(); r.step(1 / 60);
    assert.equal(said(r, 'hail', P).length, 2, 'and again after');
    r.clock += 8; meet(); finished(o); r.step(1 / 60);
    assert.equal(said(r, 'hail', P).length, 2, 'a boat home hails nobody');
  });

  test(`${what}: a computer boat hails nobody who has right of way`, () => {
    const { r, P, o, X, W } = afloat(make), V = 3.4, T = 5, at = (h) => ({ x: X.x - Math.sin(h) * V * T, z: X.z + Math.cos(h) * V * T });
    put(r, o, at(W + 45 * D2R), W + 45 * D2R, V); put(r, P, at(W - 45 * D2R), W - 45 * D2R, V); // the player on starboard
    r.step(1 / 60);
    assert.equal(said(r, 'hail', P).length, 0);
  });

  test(`${what}: the race ends at the player's own finish, and no limit runs for her`, () => {
    const { r, P, o } = afloat(make);
    finished(o);
    assert.equal(r.multi, false);
    r.clock = 90 + FINISH_LIMIT_S + 60;
    r.step(1 / 60);
    assert.equal(r.over, false, 'a computer boat home ends nothing, however long ago');
    assert.equal(P.dnf, false); assert.equal(r.validAt, null); assert.equal(r.winner, null);
    r.forfeit(P);
    assert.equal(r.over, false, 'nor can the race be given up'); assert.equal(r.forfeited, null); assert.equal(P.dnf, false);
    const c = r.course, m = { x: (c.pin.x + c.committee.x) / 2, z: (c.pin.z + c.committee.z) / 2 };
    P.leg = c.legs.length - 1;
    const up = 2 + HULL / 2; // her bow 2 m above the line, heading down across it
    put(r, P, { x: m.x + c.normal.x * up, z: m.z + c.normal.z * up }, Math.atan2(-c.normal.x, c.normal.z), 4);
    for (let i = 0; i < 120 && !P.done; i++) r.step(1 / 60);
    assert.equal(P.done, true); assert.equal(r.over, true, 'her finish ends it');
    assert.equal(r.winner, null, 'and no 1-on-1 winner is named');
    assert.equal(r.margin, null);
  });
}
