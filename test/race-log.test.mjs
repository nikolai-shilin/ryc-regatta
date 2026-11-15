// The result page's tiles and the name step's place, worked out from a finished race (lib/race-log.ts), in Node: npm
// test. A result saved before the game kept each boat's leg times has none of them, and the page hides what it can't say.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { placeAmong, startOf, legTimes, bestLeg } = await import('../lib/race-log.ts');

const boat = (me, legT, secs, extra = {}) => ({ me, done: secs != null, dsq: false, secs, legT, ...extra });

test('a time among the day’s: after those faster, level with its own row', () => {
  const day = [222.9, 227.1, 228.4, 230.9, 250.1];
  assert.equal(placeAmong(day, 200), 1);
  assert.equal(placeAmong(day, 229), 4);
  assert.equal(placeAmong(day, 228.4), 3); // already on the board: its own row isn't faster
  assert.equal(placeAmong(day, 300), 6);
  assert.equal(placeAmong([], 240), 1);
});

test('the start: seconds after the gun, the place off the line and the end', () => {
  const boats = [boat(false, [1.2, 80], 200), boat(true, [3.4, 82], 205), boat(false, [0.6, 81], 210)];
  assert.deepEqual(startOf({ startT: 3.4, startAt: 0.9 }, boats), { late: 3.4, place: 3, end: 'boat' });
  assert.deepEqual(startOf({ startT: 0.6, startAt: 0.1 }, [boat(true, [0.6], 100), boat(false, [2], 110)]), { late: 0.6, place: 1, end: 'pin' });
  // an old result: the time after the gun only
  assert.deepEqual(startOf({ startT: 2 }, [boat(true, undefined, 100), boat(false, undefined, 110)]), { late: 2, place: null, end: null });
  assert.equal(startOf({ startT: null }, boats), null); // never crossed after the gun
});

test('leg times run from the start’s crossing, the last to the finish', () => {
  assert.deepEqual(legTimes(boat(true, [2, 62, 120], 200)), [60, 58, 80]);
  assert.deepEqual(legTimes(boat(false, [2, 62], null)), [60]); // didn't finish: the legs she did
  assert.deepEqual(legTimes(boat(true, undefined, 200)), []);
});

test('the best leg: the best place, then the biggest win or the smallest loss', () => {
  // legs: you 60, 50, 70; A 58, 55, 72; B 65, 52, 71 → leg 2 won by 2 s, leg 3 won by 1 s
  const boats = [boat(true, [0, 60, 110], 180), boat(false, [0, 58, 113], 185), boat(false, [0, 65, 117], 188)];
  assert.deepEqual(bestLeg(boats), { leg: 2, place: 1, of: 3, by: 2 });
  // never fastest: of the legs sailed 2nd (you 60 and 68; the fastest 56 and 65), the one nearest the fastest
  const slow = [boat(true, [0, 70, 130], 198), boat(false, [0, 60, 125], 190), boat(false, [0, 62, 118], 188)];
  assert.deepEqual(bestLeg(slow), { leg: 3, place: 2, of: 3, by: 3 });
  // a result saved before the leg times: nothing to say
  assert.equal(bestLeg([boat(true, undefined, 100), boat(false, undefined, 110)]), null);
});

const { costliest } = await import('../lib/race-log.ts');

test('where you lost most to the boat just ahead: the start or a leg, and nothing when you won', () => {
  const ahead = { ...boat(false, [2, 60, 130], 200), name: 'Nordic Star' };
  // late off the line by 1 s, then 2 s on leg 1, 6 s on leg 2, 0.5 s on leg 3
  const me = boat(true, [3, 63, 139], 209.5);
  assert.deepEqual(costliest([ahead, me]), { seg: 2, lost: 6, name: 'Nordic Star', gap: 9.5 });
  // 4 s late off the line and level after it: the start
  assert.equal(costliest([ahead, boat(true, [6, 64, 134], 204)])?.seg, 0);
  // you won: no one ahead
  assert.equal(costliest([boat(true, [1, 50, 120], 190), ahead]), null);
  // a result kept before the leg times
  assert.equal(costliest([boat(false, undefined, 200), boat(true, undefined, 210)]), null);
});
