// The way back (public/game/trail.js): every back arrow, and every way out of the race, goes to the page you came from.
// npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { step, back } from '../public/game/trail.js';

const walk = (...moves) => moves.reduce((t, [p, how]) => step(t, p, how), []);
const link = (p) => [p, {}];
const load = (p, from) => [p, { full: true, from }];

test('back goes to the page before, as the browser’s back', () => {
  const t = walk(link('/'), link('/race'), link('/settings'), link('/boat?from=settings'));
  assert.deepEqual(back(t, '/boat?from=settings', '/race'), { trail: t.slice(0, 3), go: 1, to: '/settings' });
  const s = back(t, '/boat?from=settings', '/race').trail;
  assert.deepEqual(back(s, '/settings', '/race'), { trail: t.slice(0, 2), go: 1, to: '/race' });
});

test('with nothing behind you it goes to the arrow’s own page', () => {
  assert.deepEqual(back(walk(link('/settings')), '/settings', '/race'), { trail: [{ p: '/race', n: 0 }], to: '/race' });
  assert.deepEqual(back([], '/fleet', '/race'), { trail: [{ p: '/race', n: 0 }], to: '/race' });
});

test('the race is never gone back to: from the result, back is the page before it', () => {
  const t = walk(link('/'), link('/race/rating'), load('/play?race=today', '/race/rating'), load('/race/result/abc', '/play?race=today'));
  const r = back(t, '/race/result/abc', '/race');
  assert.equal(r.to, '/race/rating');
  assert.equal(r.go, undefined); // the race's entries are behind it: a link there, not the browser's back
  assert.deepEqual(r.trail.at(-1), { p: '/race/rating', n: 0 });
  // …and from that page, back is a link too: the history behind it is no longer the trail's
  assert.equal(back(r.trail, '/race/rating', '/').go, undefined);
  assert.equal(back(r.trail, '/race/rating', '/').to, '/');
});

test('leaving the race goes back to where it was started from', () => {
  const t = walk(link('/'), link('/race/free'), load('/play?race=free', '/race/free'));
  assert.deepEqual(back(t, '/play?race=free', '/race'), { trail: t.slice(0, 2), go: 1, to: '/race/free' });
  // a race loaded again in place (a new day) is two entries back
  const again = step(t, '/play?race=today', { full: true, from: '/play?race=free' });
  assert.equal(back(again, '/play?race=today', '/race').go, 2);
});

test('the language switch, signing in and the page itself are stepped over', () => {
  // /lang sends you back to the page you were on: the same page, one more history entry
  const t = walk(link('/race'), link('/settings'), load('/settings', '/settings'));
  assert.deepEqual(back(t, '/settings', '/race'), { trail: [{ p: '/race', n: 0 }], go: 2, to: '/race' });
  // signed in, back from the page signing in brought you to skips its pages
  const s = walk(link('/'), link('/race'), link('/sign-in?next=/race'), link('/sign-in/code?next=/race'), link('/race'));
  assert.equal(back(s, '/race', '/').to, '/');
  // …while within it, back is its previous step
  assert.equal(back(s.slice(0, 4), '/sign-in/code?next=/race', '/race').to, '/sign-in?next=/race');
});

test('the browser’s own back and forward keep the trail in step', () => {
  let t = walk(link('/'), link('/race'), link('/settings'));
  t = step(t, '/race', { pop: true });
  assert.deepEqual(t.map((s) => s.p), ['/', '/race']);
  t = step(t, '/settings', { pop: true }); // forward
  assert.deepEqual(t.map((s) => s.p), ['/', '/race', '/settings']);
  // a full load from this site starts the trail from the page it came from
  assert.deepEqual(walk(load('/settings', '/race')), [{ p: '/race', n: 0 }, { p: '/settings', n: 1 }]);
  // a reload changes nothing
  assert.deepEqual(step(t, '/settings', { full: true, reload: true, from: '/race' }), t);
});
