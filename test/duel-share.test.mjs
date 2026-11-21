// A 1-on-1 result, shared (lib/duel-share.ts): the race's own link with who won, who lost and by how much; read back for its
// card and the invite page's title; and the gap to the other boat at each mark on the result page (components/result-view.tsx
// LegGap). Run: node --test test/duel-share.test.mjs
import './load.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { plain } from './fake-dom.mjs';

const { duelShareUrl, duelFrom } = await import('../lib/duel-share.ts');
const { LegGap } = await import('../components/result-view.tsx');
const { tx } = await import('../lib/lang.ts');

test("the shared link is the race's own, with the result in its address", () => {
  const u = new URL(duelShareUrl('https://www.sailupdown.com', 'K7M2QZ', { venue: 'gocek', yacht: 'j70', winner: 'Alex P.', loser: 'Anna K.', margin: 1.83 }));
  assert.equal(u.pathname, '/match/K7M2QZ');
  assert.deepEqual(Object.fromEntries(u.searchParams), { v: 'gocek', b: 'j70', w: 'Alex P.', l: 'Anna K.', m: '1.8', utm_source: 'share', utm_medium: 'duel' });
  assert.equal(new URL(duelShareUrl('https://x', 'K7M2QZ', { venue: 'gocek', winner: 'A', loser: 'B', margin: null })).searchParams.has('m'), false);
  assert.equal(duelShareUrl('https://x', 'K7M2QZ', { venue: 'gocek', winner: '', loser: 'B', margin: 1 }), null, 'a nameless boat: nothing to share');
});

test('the result is read back clean: names cut to 16 characters with no markup or emoji, a margin within reason', () => {
  const q = (o) => (k) => o[k] ?? null;
  assert.deepEqual(duelFrom(q({ w: 'Alex P.', l: 'Anna K.', m: '1.8' })), { w: 'Alex P.', l: 'Anna K.', m: 1.8 });
  assert.deepEqual(duelFrom(q({ w: '<b>Alex</b>😀', l: 'A'.repeat(40), m: '9999' })), { w: 'bAlex/b', l: 'A'.repeat(16), m: null });
  assert.equal(duelFrom(q({ w: 'Alex' })), null);
  assert.equal(duelFrom(q({ w: 'Alex', l: 'Anna', m: 'abc' })).m, null);
});

const boat = (o) => ({ name: 'Anna K.', me: false, color: null, done: true, dsq: false, secs: 300, track: [], legT: [40, 120, 200], ...o });
const gap = (me, other, i, finish = false, lang = 'en') => plain(renderToStaticMarkup(LegGap({ me: boat({ me: true, name: 'Alex', ...me }), other: boat(other), i, finish, t: tx(lang), lang })));
test('each mark says how far ahead of the other boat you rounded it, or behind her, and the finish your margin', () => {
  assert.equal(gap({ legT: [40, 117, 210] }, {}, 1), '+3.0 s on Anna K.');
  assert.equal(gap({ legT: [40, 117, 210] }, {}, 2), '10.0 s behind Anna K.');
  assert.equal(gap({ legT: [40] }, {}, 0), 'level with Anna K.');
  assert.equal(gap({ secs: 298.2 }, { secs: 300 }, 2, true), '+1.8 s on Anna K.');
  assert.equal(gap({ legT: [40, 117, 190] }, { legT: [40, 120] }, 2), 'ahead of Anna K.', 'a mark she never reached');
  assert.equal(gap({ legT: [] }, {}, 2), '', 'a mark you never reached: nothing');
  assert.equal(gap({ legT: [40, 117] }, {}, 1, false, 'ru'), '+3,0 с у Anna K.');
  assert.match(renderToStaticMarkup(LegGap({ me: boat({ me: true, legT: [40, 117] }), other: boat({}), i: 1, finish: false, t: tx('en'), lang: 'en' })), /color:var\(--up\)/);
});
