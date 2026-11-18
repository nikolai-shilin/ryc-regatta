// A player's name carries no emoji, wherever it is typed or read from (lib/name.ts, lib/me.ts, public/game/match-ui.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { EMOJI, NAME_MAX, cleanName, noEmoji, plainName, plainRows } = await import('../lib/name.ts');
const { readBrief } = await import('../lib/day-brief.ts');
const { readPassport } = await import('../lib/passport-share.ts');
const { readMe } = await import('../lib/me.ts');
const { clean } = await import('../public/game/match-ui.js');

const CASES = [
  ['Anna 🌊', 'Anna'],
  ['⛵Anna⛵', 'Anna'],
  ['Anna 🌊 Petrova', 'Anna Petrova'],
  ['👍🏽 Anna', 'Anna'], // a skin tone
  ['👨‍👩‍👧 Anna', 'Anna'], // joined into one
  ['🏳️‍🌈 Anna', 'Anna'], // a flag of a pictograph, a selector and a joiner
  ['🇷🇺 Анна', 'Анна'], // a country's
  ['🏴󠁧󠁢󠁥󠁮󠁧󠁿 Anna', 'Anna'], // England's, of tag characters
  ['❤️ Anna', 'Anna'],
  ['1️⃣ Anna', 'Anna'], // a keycap, its digit too
  ['🌊', ''],
];
// what isn't an emoji stays, though some of it is in Unicode's Emoji property (the digits, # and *)
const KEPT = ['Anna', 'Анна П.', 'Anna 1', 'No. 7', 'J#24', 'A*B', "O'Neil", 'Zoë', '李娜', 'أحمد', 'मीना'];

test('emoji are taken out of a name, and the spaces they leave', () => {
  for (const [s, want] of CASES) assert.equal(noEmoji(s), want, s);
});

test('letters, digits and marks of any script stay', () => {
  for (const s of KEPT) assert.equal(noEmoji(s), s);
});

test('a name saved is cut to length after its emoji are out', () => {
  assert.equal(cleanName(`${'🌊'.repeat(30)} Anna`), 'Anna');
  assert.equal(cleanName('a'.repeat(40)).length, NAME_MAX);
});

test('a name of nothing but emoji is no name', () => {
  assert.equal(plainName('🌊⛵'), null);
  assert.equal(plainName(null), null);
  assert.deepEqual(plainRows([{ k: 'a', name: 'Anna 🌊' }, { k: 'b', name: '🌊' }, { k: 'c', name: null }]),
    [{ k: 'a', name: 'Anna' }, { k: 'b', name: null }, { k: 'c', name: null }]);
});

test('the day in brief reads its names without emoji', () => {
  const b = readBrief({ d: '2026-11-18', top: [{ name: 'Anna 🌊', s: 300, fl: null }, { name: '⛵', s: 310, fl: null }], s: [300, 310] }, '2026-11-18');
  assert.deepEqual(b.top.map((r) => r.name), ['Anna', null]);
});

test('a shared passport shows its name without emoji', () => {
  assert.equal(readPassport({ n: 'Anna 🌊' }).n, 'Anna');
});

test('the session cookie gives the name without emoji', () => {
  const session = 'base64-' + Buffer.from(JSON.stringify({ user: { email: 'a@b.c', user_metadata: { display_name: '⛵ Anna 🌊' } } })).toString('base64url');
  globalThis.document = { cookie: `sb-abcdefghijklmnop-auth-token=${session}` };
  assert.equal(readMe().name, 'Anna');
  delete globalThis.document;
});

test('the match takes a name without emoji', () => {
  for (const [s, want] of CASES) assert.equal(clean(s), want, s);
  for (const s of KEPT) assert.equal(clean(s), s);
});

test('the copies of the pattern are the same', () => {
  for (const f of ['../lib/me.ts', '../public/game/match-ui.js']) {
    assert.ok(readFileSync(new URL(f, import.meta.url), 'utf8').includes(`/${EMOJI.source}/gu`), f);
  }
});
