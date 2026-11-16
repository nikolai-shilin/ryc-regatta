// The debrief never names the same leg as your best and as where you lost most, and the badges page's "so far": how near
// the kept results and the log have come to each badge not yet earned (lib/race-log.ts bestLeg, lib/badges.ts
// badgeNear), in Node: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { bestLeg, costliest, goodLeg } = await import('../lib/race-log.ts');
const { badgeNear } = await import('../lib/badges.ts');

const boat = (me, legT, secs, extra = {}) => ({ me, done: secs != null, dsq: false, secs, legT, ...extra });

test('the best leg skips the one the debrief says cost you most', () => {
  // you: 2nd of 3 on leg 1 but 20 s down there on A, who finished just ahead; 3rd of 3 on leg 2
  const boats = [boat(false, [0, 100], 170, { name: 'A' }), boat(true, [0, 120], 191), boat(false, [0, 125], 195)];
  const lost = costliest(boats);
  assert.equal(lost.seg, 1);
  assert.equal(bestLeg(boats).leg, 1);
  assert.equal(bestLeg(boats, lost.seg).leg, 2);
  // leg 2 placed you last of three: no best leg rather than that one
  assert.equal(goodLeg(boats, lost.seg), null);
  // apart, the best leg is the best leg
  assert.equal(goodLeg(boats, 2)?.leg, 1);
});

test('so far: the best of the kept results, and the log’s counts', () => {
  const me = (pct, head, lift, place, n, hails) => ({ boats: Array.from({ length: n }, (_, i) => ({ me: i === place - 1, done: true, dsq: false, secs: 200 + i })),
    log: { pct, head, lift, hails: { a: hails }, legPlaces: [0, place + 1] } });
  const near = badgeNear([me(88, 1, 0, 3, 5, 4), me(91, 0, 1, 2, 5, 2)], { streak: 3, venues: 5, of: 30, drills: { a: 3, b: 2 }, drillIds: ['a', 'b', 'c'] });
  assert.deepEqual(near.speed, { v: 91, of: 95, unit: 'pct' });
  assert.deepEqual(near.shifts, { v: 1, of: 2, unit: 'n' }); // a race with a tack on a lift doesn't count
  assert.equal(near.podium.v, 2);
  assert.equal(near.win.v, 2);
  assert.equal(near.clean.v, 2);
  assert.deepEqual(near.comeback, { v: 1, of: 2, unit: 'places' });
  assert.deepEqual(near.streak7, { v: 3, of: 7, unit: 'n' });
  assert.deepEqual(near.venues28, { v: 5, of: 30, unit: 'n' });
  assert.deepEqual(near.drills, { v: 1, of: 3, unit: 'n' });
  // a small fleet's place isn't a podium's
  assert.equal(badgeNear([me(80, 0, 0, 1, 3, 0)], { streak: 0, venues: 0, of: 30, drills: {}, drillIds: [] }).podium, undefined);
});
