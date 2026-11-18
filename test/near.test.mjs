// The debrief never names the same leg as your best and as where you lost most (lib/race-log.ts bestLeg), in Node:
// npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { bestLeg, costliest, goodLeg } = await import('../lib/race-log.ts');

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
