// What the site reads from the scores server (lib/rating.ts, players.ts, today.ts, result.ts, day-brief.ts): what it asks
// for, what it does with an answer it can't use, and the names and words it makes of the answers.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import './load.mjs';

const { getRating, todayUtc } = await import('../lib/rating.ts');
const { getPlayers, getPlayer, KEY_RE } = await import('../lib/players.ts');
const { todayTop, TOP } = await import('../lib/today.ts');
const { getResult, describe, ordEn } = await import('../lib/result.ts');
const { readBrief, briefUrl, SCORES_API } = await import('../lib/day-brief.ts');
const { plainName, plainRows, cleanName, shortName, initials, noEmoji, NAME_MAX } = await import('../lib/name.ts');

let asked = [];
const answer = (fn) => { asked = []; globalThis.fetch = async (u, o) => { asked.push({ url: String(u), o }); return fn(String(u), o); }; };
const json = (v, status = 200) => Response.json(v, { status });
const down = () => { throw new Error('down'); };
beforeEach(() => answer(down));

// ---------- the day's rating ----------
const DAY = '2026-11-10';
const rating = (o = {}) => ({ d: DAY, w: 'medium', races: 4, guests: 1, rows: [{ k: 'a', name: 'Anna 🚤', s: 200 }], month: { m: '2026-11', days: 3, rows: [{ k: 'a', name: '🏆', pts: 9 }] }, days: [DAY], ...o });

test('the rating: names come without their emoji, in the day\'s rows and the month\'s', async () => {
  answer(() => json(rating()));
  const r = await getRating(DAY);
  assert.equal(r.rows[0].name, 'Anna');
  assert.equal(r.month.rows[0].name, null, 'nothing but an emoji: no name');
  assert.match(asked[0].url, new RegExp(`\\?day=${DAY}$`));
});

test('the rating: today\'s is kept five minutes, a past day\'s an hour', async () => {
  answer(() => json(rating()));
  await getRating(DAY);
  assert.equal(asked[0].o.next.revalidate, 3600);
  const today = todayUtc();
  answer(() => json(rating({ d: today })));
  await getRating(today);
  assert.equal(asked[0].o.next.revalidate, 300);
});

test('the rating: an answer without the list of days still shows', async () => {
  const { days, ...old } = rating();
  answer(() => json(old));
  assert.deepEqual((await getRating(DAY)).days, []);
});

test('the rating: anything it can\'t use is no rating at all', async () => {
  for (const fn of [down, () => json({}, 500), () => new Response('html'), () => json(null), () => json(rating({ d: '2026-11-09' })), () => json(rating({ rows: 'x' })),
    () => json(rating({ month: null })), () => json(rating({ month: { rows: 'x' } }))]) {
    answer(fn);
    assert.equal(await getRating(DAY), null);
  }
});

// ---------- the players ----------
test('the players: a page of them, without emoji in their names', async () => {
  answer(() => json({ total: 1, page: 2, pages: 3, per: 50, rows: [{ k: 'abcdefgh', name: '1️⃣ Anna' }] }));
  const r = await getPlayers(2);
  assert.equal(r.rows[0].name, 'Anna'); assert.equal(r.pages, 3);
  assert.match(asked[0].url, /\?players&page=2$/);
});

test('the players: an answer that isn\'t a list is none', async () => {
  for (const fn of [down, () => json({}, 503), () => json({ rows: 'x', pages: 1 }), () => json({ rows: [] }), () => json({ rows: [], pages: 'many' })]) {
    answer(fn);
    assert.equal(await getPlayers(1), null);
  }
});

test('a player\'s card: a key that can\'t be one is never asked for', async () => {
  for (const k of ['short', 'x'.repeat(65), 'has space1', '../../etc/x', 'a&admin=1x']) {
    assert.equal(KEY_RE.test(k), false, k);
    assert.equal(await getPlayer(k), null);
  }
  assert.equal(asked.length, 0);
});

test('a player\'s card: only the card of the player asked for', async () => {
  answer(() => json({ k: 'abcdefgh', name: 'Anna 🚤', pts: 3 }));
  assert.deepEqual(await getPlayer('abcdefgh'), { k: 'abcdefgh', name: 'Anna', pts: 3 });
  assert.match(asked[0].url, /\?player=abcdefgh$/);
  assert.equal(await getPlayer('zzzzzzzz'), null, 'the answer was someone else\'s');
  answer(() => json({}, 404));
  assert.equal(await getPlayer('abcdefgh'), null);
});

// ---------- today's fastest ----------
const today = todayUtc();
const brief = (n) => ({ d: today, w: 'light', races: 9, ranked: n, top: Array.from({ length: Math.min(n, 7) }, (_, i) => ({ name: `Anna Petrova${i}`, s: 100 + i, fl: 'ru' })), s: Array.from({ length: n }, (_, i) => 100 + i) });
const both = (plain, day) => answer((u) => (u.includes('&brief') ? day() : plain()));

test('today\'s fastest: the first five from the day\'s rating, in short names, with the tenth time', async () => {
  both(() => json({ daily: { d: today, w: 'x', races: 2, top: [] } }), () => json(brief(12)));
  const r = await todayTop();
  assert.equal(r.top.length, TOP); assert.equal(r.n, 5); assert.equal(r.ranked, 12); assert.equal(r.tenth, 109);
  assert.deepEqual(r.top[0], { name: 'Anna P.', s: 100, fl: 'ru' });
  assert.equal(r.w, 'light'); assert.equal(r.races, 9);
});

test('today\'s fastest: fewer than ten ranked have no tenth time', async () => {
  both(() => json({}), () => json(brief(9)));
  assert.equal((await todayTop()).tenth, null);
});

test('today\'s fastest: what the brief lacks comes from the plain answer', async () => {
  both(() => json({ daily: { w: 'strong', races: 7 } }), () => json({ ...brief(1), w: undefined, races: 0 }));
  const r = await todayTop();
  assert.equal(r.w, 'strong'); assert.equal(r.races, 7);
});

test('today\'s fastest: without the rating, the plain answer\'s first three still show', async () => {
  const top = [{ name: '🚤 Anna', s: 1 }, { name: 'Bob', s: 2 }, { name: 'Cy', s: 3 }, { name: 'Di', s: 4 }];
  for (const day of [down, () => json({}, 500), () => json({ d: 'another day' })]) {
    both(() => json({ daily: { d: today, w: 'x', top } }), day);
    const r = await todayTop();
    assert.equal(r.n, 3); assert.equal(r.races, 0);
    assert.deepEqual(r.top.map((x) => x.name), ['Anna', 'Bob', 'Cy']);
  }
});

test('today\'s fastest: nothing to be had is nothing', async () => {
  for (const plain of [down, () => json({}, 500), () => json({}), () => json({ daily: { top: 'x' } })]) {
    both(plain, down);
    assert.equal(await todayTop(), null);
  }
});

// ---------- a day in brief ----------
test('the brief: asked for by the day, on the server given', () => {
  assert.equal(briefUrl('2026-11-10'), `${SCORES_API}?day=2026-11-10&brief`);
  assert.equal(briefUrl('a&b', 'https://x.test'), 'https://x.test?day=a%26b&brief');
});

test('the brief: read as it comes, with its names cleaned', () => {
  const b = readBrief({ d: DAY, w: 'light', races: '3', ranked: 2, top: [{ name: 'Anna 🚤', s: '100', fl: 'ru' }, { name: 5, s: 101, fl: 7 }], s: ['100', 101] }, DAY);
  assert.deepEqual(b, { d: DAY, w: 'light', races: 3, ranked: 2, top: [{ name: 'Anna', s: 100, fl: 'ru' }, { name: null, s: 101, fl: null }], s: [100, 101] });
});

test('the brief: with no count of the ranked, the times are counted', () => {
  assert.equal(readBrief({ d: DAY, top: [], s: [1, 2, 3] }, DAY).ranked, 3);
});

test('the brief: an older server\'s whole rating is read as one, its first ten named', () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ name: `N${i}`, s: i + 1 }));
  const b = readBrief({ d: DAY, races: 12, rows }, DAY);
  assert.equal(b.ranked, 12); assert.equal(b.top.length, 10); assert.equal(b.s.length, 12); assert.equal(b.w, null);
});

test('the brief: another day\'s answer, or one with no times, is none', () => {
  assert.equal(readBrief(null, DAY), null);
  assert.equal(readBrief({ d: '2026-11-09', s: [], top: [] }, DAY), null);
  assert.equal(readBrief({ d: DAY }, DAY), null);
  assert.equal(readBrief({ d: DAY, s: [1] }, DAY), null, 'times with no top');
});

// ---------- a shared result ----------
const ID = 'AAAAAAAA-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const result = (o = {}) => ({ v: 1, id: ID, at: Date.UTC(2026, 10, 13, 10), daily: null, preset: 'medium', length: 'short', laps: 1,
  course: { windward: [0, -300], gate: [[-20, 0], [20, 0]], pin: [-50, 0], committee: [50, 0] },
  boats: [{ me: false, done: true, dsq: false, secs: 220, track: [] }, { me: true, done: true, dsq: false, secs: 225.7, track: [] }, { me: false, done: true, dsq: false, secs: 240, track: [] }], ...o });

test('a shared result: an id that isn\'t one is never asked for', async () => {
  for (const id of ['', 'x', `${ID}0`, `${ID}&admin=1`]) assert.equal(await getResult(id), null);
  assert.equal(asked.length, 0);
});

test('a shared result: asked for in small letters, and kept a day', async () => {
  answer(() => json(result()));
  assert.equal((await getResult(ID)).v, 1);
  assert.ok(asked[0].url.endsWith(`?race=${ID.toLowerCase()}`));
  assert.equal(asked[0].o.next.revalidate, 86400);
});

test('a shared result: one the page can\'t read is none', async () => {
  for (const fn of [down, () => json({}, 404), () => new Response('html'), () => json(null), () => json(result({ v: 2 })), () => json(result({ boats: 'x' })),
    () => json(result({ boats: [{ me: false }] }))]) {
    answer(fn);
    assert.equal(await getResult(ID), null);
  }
});

test('places in English end as they should', () => {
  const said = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 10: '10th', 11: '11th', 12: '12th', 13: '13th', 14: '14th', 21: '21st', 22: '22nd', 23: '23rd', 101: '101st', 111: '111th', 112: '112th', 113: '113th' };
  for (const [n, s] of Object.entries(said)) assert.equal(ordEn(Number(n)), s);
});

test('the race in words, in English', () => {
  const d = describe(result(), 'en');
  assert.equal(d.place, 2); assert.equal(d.time, '3:45.7');
  assert.equal(d.headline, '2nd in 3:45.7');
  assert.equal(d.kind, 'Free race');
  assert.equal(d.detail, 'Medium breeze 12 kn · 3 boats · up and down, short, 1 lap');
  assert.equal(d.call, 'Sail today’s race');
  assert.equal(d.kn, 12); assert.equal(d.length, 'Short'); assert.equal(d.boats, 3);
});

test('the race in words, in Russian', () => {
  const d = describe(result({ preset: 'strong', length: 'long', laps: 2 }), 'ru');
  assert.equal(d.headline, '2-е место · 3:45.7');
  assert.equal(d.kind, 'Свободная гонка');
  assert.match(d.detail, /^Сильный ветер 19 уз · 3 лодки · .*, длинная, 2 круга$/);
  assert.equal(d.length, 'Длинная');
});

test('the race of the day says its date, and dares you only while it can still be sailed', () => {
  const past = describe(result({ daily: '2026-11-13' }), 'en');
  assert.equal(past.kind, 'Race of the day · Fri 13 Nov');
  assert.equal(past.call, 'Sail today’s race');
  assert.equal(describe(result({ daily: today }), 'en').call, 'Beat this time');
  assert.equal(describe(result({ daily: today }), 'ru').call, 'Побей это время');
});

test('a disqualified boat, or one with no time, has no time to beat', () => {
  const boats = (o) => [{ me: true, done: true, dsq: false, secs: 200, track: [], ...o }];
  for (const b of [boats({ dsq: true }), boats({ secs: null })]) {
    const d = describe(result({ daily: today, boats: b }), 'en');
    assert.equal(d.time, null); assert.equal(d.headline, 'Disqualified'); assert.equal(d.call, 'Sail today’s race');
  }
  assert.equal(describe(result({ boats: boats({ dsq: true }) }), 'ru').headline, 'Дисквалификация');
});

test('a length the page doesn\'t know is left out of the words', () => {
  const d = describe(result({ length: 'odd' }), 'en');
  assert.equal(d.length, '');
  assert.equal(d.detail, 'Medium breeze 12 kn · 3 boats · up and down, 1 lap');
});

test('a time just short of the minute reads as the next minute', () => {
    const boats = [{ me: true, done: true, dsq: false, secs: 119.97, track: [] }];
    assert.equal(describe(result({ boats }), 'en').time, '2:00.0');
  });

// ---------- names ----------
test('a name loses its emoji and keeps every script\'s letters and digits', () => {
  assert.equal(noEmoji('Anna 🚤 Petrova'), 'Anna Petrova');
  assert.equal(noEmoji('1️⃣ Анна 2'), 'Анна 2');
  assert.equal(noEmoji('🇷🇺 Иван'), 'Иван');
  assert.equal(noEmoji('👍🏽 Bob'), 'Bob');
  assert.equal(noEmoji('李雷 7'), '李雷 7');
  assert.equal(noEmoji('👨‍👩‍👧 Fam'), 'Fam');
});

test('a name of nothing but emoji is no name', () => {
  for (const n of ['🚤', '  ', '', null, undefined]) assert.equal(plainName(n), null);
  assert.deepEqual(plainRows([{ name: '🚤', s: 1 }, { name: 'Bob', s: 2 }]), [{ name: null, s: 1 }, { name: 'Bob', s: 2 }]);
});

test('the name saved for the ranking is cut to its length', () => {
  assert.equal(cleanName('x'.repeat(40)).length, NAME_MAX);
  assert.equal(cleanName(' 🚤 Anna '), 'Anna');
});

test('the short name: the first word and the second\'s first letter', () => {
  assert.equal(shortName('Anna Petrova'), 'Anna P.');
  assert.equal(shortName('Anna'), 'Anna');
  assert.equal(shortName('  Анна   Петрова Иванова '), 'Анна П.');
  assert.equal(shortName('x'.repeat(30)), 'x'.repeat(20));
  assert.equal(shortName('Anna 🚤x'), 'Anna 🚤.', 'a letter is never cut in half');
  for (const n of ['', '   ', null]) assert.equal(shortName(n), null);
});

test('the avatar\'s letters: from the name, else the address', () => {
  assert.equal(initials('Anna Petrova', 'x@y.z'), 'AP');
  assert.equal(initials('anna', 'x@y.z'), 'A');
  assert.equal(initials('', 'anna.petrova@mail.test'), 'AP');
  assert.equal(initials('', ''), '·');
  assert.equal(initials('анна петрова', ''), 'АП');
});
