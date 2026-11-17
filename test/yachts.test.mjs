// The yachts the site shows (lib/yachts.ts): what the yachts page (components/fleet-view.tsx) reads of each. Its
// summary looks two specs up by name, Length and Crew, so a yacht without one fails the whole page (it did, the day
// the J Class came, with a 500).
import test from 'node:test';
import assert from 'node:assert/strict';

test('every yacht has the specs the yachts page reads by name, and six in all', async () => {
  const { YACHTS, YACHT_IDS } = await import('../lib/yachts.ts');
  assert.deepEqual(YACHTS.map((y) => y.id).sort(), [...YACHT_IDS].sort(), 'every id has its yacht');
  for (const y of YACHTS) {
    const ks = y.specs.map((s) => s.k[0]);
    for (const k of ['Length', 'Crew']) assert.ok(ks.includes(k), `${y.id}: no ${k}`);
    assert.equal(y.specs.length, 6, `${y.id}: ${y.specs.length} specs`);
    for (const s of y.specs) assert.ok(s.v?.[0] && s.v?.[1], `${y.id}: ${s.k[0]} has no value in both languages`);
  }
});

test('every class the game sails has its yacht on the site, with the game’s course numbers', async () => {
  const { YACHTS } = await import('../lib/yachts.ts');
  const { CLASSES } = await import('../public/game/classes.js');
  for (const id of Object.keys(CLASSES)) {
    const y = YACHTS.find((x) => x.id === id);
    assert.ok(y, `${id}: not on the site`);
    assert.equal(y.courseK, CLASSES[id].courseK, `${id}: courseK`);
    assert.equal(y.lineK, CLASSES[id].lineK, `${id}: lineK`);
  }
});
