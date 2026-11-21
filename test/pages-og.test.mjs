// The share cards under /og: what each one says, in which language, over which picture, how long it is cached, and the
// plain picture when there is nothing to draw. The drawing itself is stood in for (it needs the build), but the card
// is laid out by the real lib/og.tsx and turned into a JPEG by the real sharp. Run: node --test test/pages-og.test.mjs
import { mock, ROOT } from './load.mjs';
import { test, mock as clock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

clock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 18, 12) });
process.chdir(ROOT);
mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');
mock('next/server', 'export const connection = async () => {};');
mock('next/image', `import { createElement } from 'react';
export const getImageProps = ({ fill, priority, ...p }) => ({ props: { ...p, srcSet: p.src } });
export default function Image({ fill, priority, ...p }) { return createElement('img', p); }`);
// the drawing: keeps what it was asked to draw, and answers with a real (one-pixel) PNG for sharp to turn into a JPEG
mock('next/og', `const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
export class ImageResponse extends Response {
  constructor(element, options = {}) { super(PNG, { headers: { 'content-type': 'image/png' } }); this.element = element; this.options = options; globalThis.__drawn = this; }
}`);
globalThis.__sb = { auth: { getUser: async () => ({ data: { user: null } }) } };

const DAY = '2026-11-18', YESTERDAY = '2026-11-17';
const { dailyRace } = await import('../lib/race.ts');
const { venueOf, VENUES } = await import('../lib/venues.ts');
const { yachtOf, YACHTS } = await import('../lib/yachts.ts');
const { GUIDES, guide } = await import('../lib/guides.ts');
const { DRILLS } = await import('../lib/drills.ts');
const { IYT_TOTAL } = await import('../lib/iyt.ts');
const { CHANNELS } = await import('../lib/social.ts');
const { tx } = await import('../lib/lang.ts');
const { card, C, W, H, URL_LABEL } = await import('../lib/og.tsx');
const { appIcon } = await import('../lib/app-icon.tsx');
const pageCard = await import('../app/og/page/[key]/route.tsx');
const passportCard = await import('../app/og/passport/route.tsx');
const resultCard = await import('../app/og/result/[id]/route.tsx');
const todayCard = await import('../app/og/today/route.tsx');

// ---------- the scores API ----------
const KEY = 'kAnna-0001', RACE = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const ratingOf = (d, rows) => ({ d, w: 'w', races: 5, guests: 0, rows, month: { m: d.slice(0, 7), days: 1, rows: [] }, days: [d] });
const player = (o = {}) => ({ k: KEY, name: 'Anna Petrova', pts: 1240, wins: 2, n: 30, ...o });
const shared = (o = {}) => ({ v: 1, id: RACE, at: Date.UTC(2026, 10, 18, 9), daily: DAY, preset: 'medium', length: 'short', laps: 1,
  course: { windward: [0, -260], gate: [[-22, -45], [22, -45]], pin: [-70, 0], committee: [70, 0] },
  boats: [{ me: true, done: true, dsq: false, secs: 300.4, track: [] }, { me: false, done: true, dsq: false, secs: 340, track: [] }], ...o });
const api = {};
const reset = (o = {}) => Object.assign(api, { down: false, rating: ratingOf(DAY, [{ k: 'a', name: 'Slow Sam', s: 340 }, { k: 'b', name: 'Fast Fiona', s: 300.4 }]),
  brief: { d: DAY, w: 'w', races: 5, ranked: 2, top: [{ name: 'Fast Fiona', s: 300.4, fl: null }], s: [300.4] }, plain: null,
  players: { total: 1234, page: 1, pages: 3, per: 50, rows: [] }, player: player(), result: shared() }, o);
const json = (x) => (x == null ? new Response('{}', { status: 404 }) : new Response(JSON.stringify(x)));
globalThis.fetch = async (url) => {
  if (api.down) throw new TypeError('fetch failed');
  const q = new URL(String(url)).searchParams;
  if (q.has('race')) return json(api.result);
  if (q.has('players')) return json(api.players);
  if (q.has('player')) return json(api.player?.k === q.get('player') ? api.player : null);
  if (q.has('brief')) return json(api.brief);
  if (q.has('day')) return json(api.rating);
  return json(api.plain);
};

// ---------- asking for a card, and reading what was drawn ----------
const LANGS = ['en', 'ru'];
const req = (path) => new Request(`https://www.sailupdown.com${path}`);
const page = (key, query = '') => pageCard.GET(req(`/og/page/${key}${query}`), { params: Promise.resolve({ key }) });
const drawnText = () => renderToStaticMarkup(globalThis.__drawn.element).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
const bgUri = (name) => `data:image/jpeg;base64,${readFileSync(join(ROOT, 'lib/og-bg', `${name}.jpg`)).toString('base64')}`;
const drawnBg = () => renderToStaticMarkup(globalThis.__drawn.element).match(/<img src="(data:image\/jpeg;base64,[^"]+)"/)[1];
const isJpeg = async (res) => { const b = Buffer.from(await res.arrayBuffer()); return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff; };
const draw = async (key, query) => { reset(); const res = await page(key, query); assert.equal(res.status, 200, `/og/page/${key}${query || ''}`); return { res, text: drawnText() }; };

// each card: what it asks for, its picture, the words it must have in each language
const CARDS = {
  learn: { bg: 'aerial', en: `${GUIDES.length} short guides and a glossary`, ru: `${GUIDES.length} коротких пособий и словарь` },
  guide: { q: '?g=marks', bg: 'aerial', en: 'Racing guides · Guide 6 of 8', ru: 'Пособия по гонкам · Пособие 6 из 8' },
  glossary: { bg: 'wind', en: 'The words of sailboat racing', ru: 'Слова парусных гонок' },
  rulebook: { bg: 'fleet', en: 'The Racing Rules of Sailing in plain words', ru: 'Правила парусных гонок простыми словами' },
  yachts: { bg: 'fleet', en: `${YACHTS.length} yachts`, ru: `${YACHTS.length} яхт` },
  rating: { bg: 'fleet', en: 'Today’s leaderboard', ru: 'Рейтинг дня' },
  players: { bg: 'helm', en: 'Sailors racing signed in', ru: 'Гонщики с аккаунтом' },
  player: { q: `?p=${KEY}`, bg: 'helm', en: 'Player card', ru: 'Карточка игрока' },
  drills: { bg: 'start', en: `${DRILLS.length} drills`, ru: `${DRILLS.length} тренировок` },
  free: { bg: 'drone', en: `${VENUES.length} venues · ${YACHTS.length} yachts`, ru: 'Своя гонка' },
  match: { bg: 'drone', en: 'You and a friend, one on one', ru: 'Вы и друг, один на один' },
  iyt: { bg: 'helm', en: 'Questions, VHF to Yachtmaster Ocean', ru: 'Вопросов, от VHF до Yachtmaster Ocean' },
  help: { bg: 'trim', en: 'How to play', ru: 'Как играть' },
  faq: { bg: 'drone', en: 'About the game, the race and the rules', ru: 'Об игре, гонке и правилах' },
  social: { bg: 'fleet', en: 'Social media', ru: 'Соцсети' },
  sponsorship: { bg: 'fleet', en: 'Your brand in the race', ru: 'Ваш бренд в гонке' },
  boat: { bg: 'drone', en: 'Hull, sails, flag and number', ru: 'Корпус, паруса, флаг и номер' },
};
const LIVE = new Set(['rating', 'players', 'player']);

for (const [key, c] of Object.entries(CARDS)) {
  for (const lang of LANGS) {
    test(`the ${key} card (${lang}) is a JPEG with its own words`, async () => {
      const { res, text } = await draw(key, `${c.q ? `${c.q}&` : '?'}lang=${lang}`);
      assert.equal(res.headers.get('content-type'), 'image/jpeg');
      assert.ok(await isJpeg(res), 'a real JPEG');
      assert.ok(text.includes(c[lang]), `"${c[lang]}" in "${text}"`);
      assert.ok(text.includes(URL_LABEL), 'the site\'s address');
    });
  }

  test(`the ${key} card is drawn over its own picture, at the size chat apps want`, async () => {
    await draw(key, c.q);
    assert.equal(drawnBg(), bgUri(c.bg));
    assert.equal(globalThis.__drawn.options.width, 1200);
    assert.equal(globalThis.__drawn.options.height, 630);
    assert.deepEqual(globalThis.__drawn.options.fonts.map((f) => f.weight), [700, 800]);
  });

  test(`the ${key} card is cached ${LIVE.has(key) ? 'for minutes: it moves through the day' : 'for a long time: it only changes with a deploy'}`, async () => {
    const { res } = await draw(key, c.q);
    assert.match(res.headers.get('cache-control'), LIVE.has(key) ? /max-age=300, s-maxage=300/ : /max-age=86400, s-maxage=604800/);
  });
}

test('a card speaks English when the address names no language or one the site lacks', async () => {
  for (const q of ['', '?lang=nl', '?lang=']) assert.ok((await draw('help', q)).text.includes('How to play'), q);
});

// ---------- what isn't a card ----------
const isPlainPicture = (res, to = '/images/og-v10.jpg') => {
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), to);
  assert.equal(res.headers.get('cache-control'), 'public, max-age=60');
};

test('an unknown card is the site\'s own picture', async () => {
  reset();
  for (const key of ['nope', 'LEARN', 'venues', '']) isPlainPicture(await page(key));
});

for (const key of ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__']) {
  test(`/og/page/${key} is an unknown card too, not a server error`, async () => {
    reset();
    isPlainPicture(await page(key));
  });
}

test('a guide that doesn\'t exist is the site\'s own picture', async () => {
  reset();
  for (const q of ['', '?g=nope', '?g=constructor']) isPlainPicture(await page('guide', q));
});

for (const slug of GUIDES) {
  test(`the ${slug} guide's card names the guide in each language`, async () => {
    for (const lang of LANGS) {
      const g = guide(slug, tx(lang), lang);
      assert.ok((await draw('guide', `?g=${slug}&lang=${lang}`)).text.includes(g.short), `${slug} ${lang}`);
    }
  });
}

// ---------- the cards that read the scores ----------
test('the rating\'s card has the fastest sailor and their time, in gold, however the API lists them', async () => {
  const { text } = await draw('rating');
  assert.ok(text.includes('First · Fast Fiona'));
  assert.ok(text.includes('5:00.4'));
  assert.ok(!text.includes('Slow Sam'));
  assert.ok(renderToStaticMarkup(globalThis.__drawn.element).includes(`color:${C.gold}`));
});

test('the rating\'s card says today is on, with its venue and yacht', async () => {
  const d = dailyRace();
  const { text } = await draw('rating');
  assert.ok(text.includes(`Today’s leaderboard · ${venueOf(d.venue).name[0]} · ${yachtOf(d.yacht).name[0]}`));
  assert.ok(text.includes('Beat the time'));
  assert.ok(renderToStaticMarkup(globalThis.__drawn.element).includes(`background:${C.live}`), 'the red dot');
});

test('the rating\'s card of a day before is about that day, with no red dot', async () => {
  reset({ rating: ratingOf(YESTERDAY, [{ k: 'a', name: 'Old Olga', s: 280 }]) });
  await page('rating', `?day=${YESTERDAY}`);
  const text = drawnText(), d = dailyRace(new Date(`${YESTERDAY}T12:00:00Z`));
  assert.ok(text.includes(`Leaderboard · ${venueOf(d.venue).name[0]}`));
  assert.ok(text.includes('Tue 17 Nov') || text.includes('Tue, 17 Nov'), text);
  assert.ok(text.includes('See the leaderboard'));
  assert.ok(!renderToStaticMarkup(globalThis.__drawn.element).includes(`background:${C.live}`));
});

test('the rating\'s card ignores a day it can\'t show', async () => {
  for (const day of ['nope', '2030-01-01', '2026-02-30']) assert.ok((await draw('rating', `?day=${day}`)).text.includes('Today’s leaderboard'), day);
});

test('the rating\'s card invites you to be first when there is no time, or no API', async () => {
  for (const set of [{ rating: ratingOf(DAY, []) }, { down: true }]) {
    reset(set);
    const res = await page('rating');
    assert.equal(res.status, 200);
    assert.ok(drawnText().includes('No time yet') && drawnText().includes('Be first'), JSON.stringify(Object.keys(set)));
  }
});

test('the rating\'s card calls a nameless winner a sailor', async () => {
  reset({ rating: ratingOf(DAY, [{ k: 'a', name: null, s: 300 }]) });
  await page('rating');
  assert.ok(drawnText().includes('First · a sailor'));
  reset({ rating: ratingOf(DAY, [{ k: 'a', name: null, s: 300 }]) });
  await page('rating', '?lang=ru');
  assert.ok(drawnText().includes('Первое место · гонщик'));
});

test('the players\' card counts them in the reader\'s digits', async () => {
  assert.ok((await draw('players')).text.includes('1,234'));
  assert.match((await draw('players', '?lang=ru')).text, /1\s234/);
});

test('the players\' card still says something with the API down or nobody signed up', async () => {
  for (const set of [{ down: true }, { players: { total: 0, page: 1, pages: 1, per: 50, rows: [] } }]) {
    reset(set);
    assert.equal((await page('players')).status, 200);
    assert.ok(drawnText().includes('Everyone who races'));
  }
});

test('a player\'s card has their name, points and wins', async () => {
  const { text } = await draw('player', `?p=${KEY}`);
  assert.ok(text.includes('Anna Petrova'));
  assert.ok(text.includes('1,240 points · 2 wins'));
  assert.ok((await draw('player', `?p=${KEY}&lang=ru`)).text.includes('2 победы'));
});

test('a player\'s card leaves out wins they haven\'t got, and says one win as one', async () => {
  reset({ player: player({ wins: 0 }) });
  await page('player', `?p=${KEY}`);
  assert.ok(!drawnText().includes('wins') && !drawnText().includes('win '));
  reset({ player: player({ wins: 1 }) });
  await page('player', `?p=${KEY}`);
  assert.ok(drawnText().includes('· 1 win'));
});

test('a player with no name is a sailor on their card', async () => {
  reset({ player: player({ name: null }) });
  await page('player', `?p=${KEY}`);
  assert.ok(drawnText().includes('A sailor'));
});

test('a card for no such player is the players\' card', async () => {
  for (const q of ['?p=short', '?p=kNobody-001', '']) assert.ok((await draw('player', q)).text.includes('The players'), q);
});

test('a match\'s card has its code, venue and boat', async () => {
  const { text } = await draw('match', '?c=k7m2qz&v=cowes&b=j70');
  assert.ok(text.includes('K7M2QZ'));
  assert.ok(text.includes(`1-on-1 race · ${venueOf('cowes').name[0]} · ${yachtOf('j70').name[0]}`));
});

test('a match\'s card with a bad code shows none, and an unknown venue the first', async () => {
  const { text } = await draw('match', '?c=bad&v=atlantis&b=titanic');
  assert.ok(!text.includes('BAD'));
  assert.ok(text.includes(`1-on-1 race · ${VENUES[0].name[0]} · ${yachtOf(null).name[0]}`));
});

test('a 1-on-1 result\'s card says who won, by how much, where and in what, and calls to race the winner', async () => {
  const { text } = await draw('duel', '?v=gocek&b=j70&w=Alex+P.&l=Anna+K.&m=1.8');
  assert.ok(text.includes(`1-on-1 race · ${venueOf('gocek').name[0]} · ${yachtOf('j70').name[0]}`), text);
  assert.ok(text.includes('1.8 s ahead of Anna K.'), text); assert.ok(text.includes('Alex P. won'), text); assert.ok(text.includes('Race the winner'), text);
  const ru = (await draw('duel', '?v=gocek&b=j70&w=Alex&l=Anna&m=1.8&lang=ru')).text;
  assert.ok(ru.includes('на 1,8 с впереди Anna') && ru.includes('Alex побеждает'), ru);
  assert.ok((await draw('duel', '?v=gocek&w=Alex&l=Anna')).text.includes('ahead of Anna'), 'no margin: no number');
});

test('a 1-on-1 result\'s card without both names, or with markup in them, is not drawn as given', async () => {
  for (const q of ['?w=Alex', '?l=Anna', '?w=&l=Anna', '?w=%3C%3E&l=Anna']) assert.equal((await page('duel', q)).status, 302, q);
  const { text } = await draw('duel', '?w=%3Cb%3EAlex%3C%2Fb%3E&l=Anna');
  assert.ok(!text.includes('<b>'));
});

test('the exam\'s card has the questions there are, the channels\' card the first channel', async () => {
  assert.ok((await draw('iyt')).text.includes(IYT_TOTAL.toLocaleString('en-GB')));
  assert.ok((await draw('social')).text.includes(CHANNELS[0].handle));
});

// ---------- every card a page names ----------
test('every drawn card a page names in its metadata is one that exists', async () => {
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : f === 'page.tsx' ? [p] : []; });
  const seen = new Set();
  reset();
  for (const file of walk(join(ROOT, 'app/[lang]'))) {
    const mod = await import(file);
    const params = Promise.resolve({ lang: 'en', slug: GUIDES[0], id: file.includes('yachts') ? 'j70' : file.includes('venues') ? VENUES[0].id : RACE, code: 'K7M2QZ', day: YESTERDAY });
    const m = await mod.generateMetadata({ params, searchParams: Promise.resolve({}) });
    const url = m.openGraph?.images?.[0]?.url || '';
    if (url.startsWith('/og/page/')) seen.add(url);
  }
  assert.ok(seen.size >= 12, 'the pages were read');
  for (const url of seen) {
    const key = /^\/og\/page\/([^?]+)/.exec(url)[1];
    assert.equal((await page(key, url.slice(url.indexOf('?')))).status, 200, url);
  }
});

// ---------- a passport's card ----------
const passport = (q) => passportCard.GET(req(`/og/passport${q}`));

test('a passport\'s card puts the streak first', async () => {
  reset();
  const res = await passport('?s=5&v=12&vs=3&n=Anna');
  assert.ok(await isJpeg(res));
  const text = drawnText();
  assert.ok(text.includes('Anna’s passport') && text.includes('Days in a row') && text.includes('5'));
});

test('a passport with no streak counts the venues', async () => {
  await passport('?s=1&v=2&vs=3');
  const text = drawnText();
  assert.ok(text.includes('A sailor’s passport') && text.includes('Venues raced') && text.includes(`2 / ${VENUES.length}`), text);
});

test('a passport\'s card says the days in the form Russian wants', async () => {
  for (const [s, words] of [[2, 'Дня подряд'], [5, 'Дней подряд'], [21, 'День подряд']]) {
    await passport(`?s=${s}&v=1&vs=1&lang=ru`);
    assert.ok(drawnText().includes(words), `${s}: ${drawnText()}`);
  }
  await passport('?s=1&v=2&vs=3&n=Анна&lang=ru');
  assert.ok(drawnText().includes('Паспорт: Анна') && drawnText().includes('Пройдено акваторий'));
});

test('a passport\'s card takes no markup from its address, and is cached for good', async () => {
  const res = await passport(`?s=5&v=1&vs=1&n=${encodeURIComponent('<b>Anna</b>')}`);
  assert.ok(!renderToStaticMarkup(globalThis.__drawn.element).includes('<b>Anna'));
  assert.match(res.headers.get('cache-control'), /immutable/);
  assert.equal(globalThis.__drawn.options.width, 1200);
});

// ---------- a result's card ----------
const result = (id, q = '') => resultCard.GET(req(`/og/result/${id}${q}`), { params: Promise.resolve({ id }) });

test('a result\'s card has the place, the time and the boats', async () => {
  reset();
  const res = await result(RACE);
  assert.ok(await isJpeg(res));
  const text = drawnText();
  assert.ok(text.includes('Race of the day · 2 boats'), text);
  assert.ok(text.includes('Finished 1st of 2') && text.includes('5:00.4'), text);
  assert.ok(text.includes('Beat this time'), 'it was today\'s race');
  assert.match(res.headers.get('cache-control'), /immutable/);
});

test('first place is on a gold plate, any other on blue', async () => {
  reset();
  await result(RACE);
  assert.ok(renderToStaticMarkup(globalThis.__drawn.element).includes(`background:${C.gold}`));
  reset({ result: shared({ boats: [{ me: false, done: true, dsq: false, secs: 290, track: [] }, { me: true, done: true, dsq: false, secs: 300, track: [] }] }) });
  await result(RACE);
  const h = renderToStaticMarkup(globalThis.__drawn.element);
  assert.ok(h.includes(`background:${C.you}`) && !h.includes(`background:${C.gold}`));
  assert.ok(drawnText().includes('Finished 2nd of 2'));
});

test('a custom race and an old race ask you to sail today\'s', async () => {
  reset({ result: shared({ daily: null }) });
  await result(RACE);
  assert.ok(drawnText().includes('Custom race · 2 boats') && drawnText().includes('Sail today’s race'));
  reset({ result: shared({ daily: YESTERDAY }) });
  await result(RACE);
  assert.ok(drawnText().includes('Sail today’s race') && !drawnText().includes('Beat this time'));
});

test('a disqualified boat\'s card says so, with no time', async () => {
  reset({ result: shared({ boats: [{ me: true, done: false, dsq: true, secs: 300, track: [] }] }) });
  await result(RACE);
  assert.ok(drawnText().includes('Disqualified') && !drawnText().includes('5:00.0'));
  reset({ result: shared({ boats: [{ me: true, done: false, dsq: true, secs: 300, track: [] }] }) });
  await result(RACE, '?lang=ru');
  assert.ok(drawnText().includes('Дисквалификация'));
});

test('a result\'s card speaks Russian', async () => {
  reset();
  await result(RACE, '?lang=ru');
  const text = drawnText();
  assert.ok(text.includes('Гонка дня · 2 лодки') && text.includes('Финиш: 1-е место из 2'), text);
});

test('a race that isn\'t online is the site\'s own picture', async () => {
  for (const set of [{ result: null }, { down: true }, { result: { v: 2 } }]) {
    reset(set);
    isPlainPicture(await result(RACE));
  }
  reset();
  isPlainPicture(await result('not-a-race-id'));
});

// ---------- today's card ----------
const todays = (q = '') => todayCard.GET(req(`/og/today${q}`));

test('today\'s card has the race, the venue, the yacht and the time to beat', async () => {
  reset();
  const d = dailyRace(), res = await todays();
  assert.ok(await isJpeg(res));
  const text = drawnText();
  assert.ok(text.includes(`Today’s race · ${venueOf(d.venue).name[0]} · ${yachtOf(d.yacht).name[0]}`), text);
  assert.ok(text.includes('Time to beat · Fast F.') && text.includes('5:00.4'), text);
  assert.ok(text.includes('Wed 18 Nov') || text.includes('Wed, 18 Nov'), text);
  assert.match(res.headers.get('cache-control'), /max-age=300/);
});

test('today\'s card speaks Russian', async () => {
  reset();
  const d = dailyRace();
  await todays('?lang=ru');
  assert.ok(drawnText().includes(`Гонка дня · ${venueOf(d.venue).name[1]} · ${yachtOf(d.yacht).name[1]}`));
  assert.ok(drawnText().includes('Лучшее время'));
});

test('today\'s card leaves out a nameless best', async () => {
  reset({ brief: { d: DAY, races: 1, ranked: 1, top: [{ name: null, s: 300.4, fl: null }], s: [300.4] } });
  await todays();
  assert.match(drawnText(), /Time to beat 5:00\.4/);
});

for (const [what, set] of [['nobody has finished', { brief: { d: DAY, races: 0, ranked: 0, top: [], s: [] } }], ['the API is down', { down: true }],
  ['the only times are yesterday\'s', { brief: null, plain: { daily: { d: YESTERDAY, races: 9, top: [{ name: 'Yesterday Winner', s: 200 }] } } }]]) {
  test(`today's card asks you to be first when ${what}`, async () => {
    reset(set);
    assert.equal((await todays()).status, 200);
    const text = drawnText();
    assert.ok(text.includes('No time yet today') && text.includes('Be first'), text);
    assert.ok(!text.includes('Yesterday Winner'));
  });
}

// ---------- how a card is laid out ----------
const base = { bg: 'drone', kind: 'K', call: 'Go' };
const fontSizes = () => [...renderToStaticMarkup(globalThis.__drawn.element).matchAll(/font-size:(\d+)px;font-weight:700;line-height:0\.\d+/g)].map((m) => +m[1]);

test('a card is the shape chat apps expect', () => assert.deepEqual([W, H], [1200, 630]));

test('a short figure is drawn big and a long one smaller, so each fits', async () => {
  await card({ ...base, hero: { label: 'L', value: '5:00' } });
  const short = fontSizes()[0];
  await card({ ...base, hero: { label: 'L', value: '12,345,678,901' } });
  const long = fontSizes()[0];
  assert.equal(short, 140);
  assert.ok(long < short);
  assert.ok(long * 14 * 0.52 <= 660, 'it fits the words\' width');
});

test('a name is sized to break into two lines at most, and never below the smallest size', async () => {
  await card({ ...base, hero: { label: 'L', value: 'Yes', wrap: true } });
  assert.equal(fontSizes()[0], 100);
  await card({ ...base, hero: { label: 'L', value: 'Several rather long words that go on and on for quite a while', wrap: true } });
  assert.ok(fontSizes()[0] < 100);
  await card({ ...base, hero: { label: 'L', value: 'x'.repeat(200), wrap: true } });
  assert.equal(fontSizes()[0], 48);
});

test('the plate takes its room from the figure beside it', async () => {
  await card({ ...base, hero: { label: 'L', value: '12:34.5' } });
  const free = fontSizes()[0];
  await card({ ...base, hero: { label: 'L', value: '12:34.5', plate: { text: '1st', bg: C.gold } } });
  assert.ok(fontSizes()[0] < free);
  assert.ok(drawnText().includes('1st'));
});

test('a card shows its tag only when it has one, and the red dot only when live', async () => {
  await card({ ...base, hero: { label: 'L', value: 'V' } });
  assert.ok(!renderToStaticMarkup(globalThis.__drawn.element).includes(`background:${C.live}`));
  await card({ ...base, tag: { text: 'THE TAG' }, hero: { label: 'L', value: 'V' } });
  assert.ok(drawnText().includes('THE TAG'));
  assert.ok(!renderToStaticMarkup(globalThis.__drawn.element).includes(`background:${C.live}`));
  await card({ ...base, tag: { text: 'THE TAG', live: true }, hero: { label: 'L', value: 'V' } });
  assert.ok(renderToStaticMarkup(globalThis.__drawn.element).includes(`background:${C.live}`));
});

test('a card always ends on its one action', async () => {
  await card({ ...base, call: 'Do this', hero: { label: 'L', value: 'V' } });
  assert.ok(drawnText().includes('Do this →'));
});

test('the app\'s icon is the logo, as big as asked', async () => {
  for (const px of [180, 512]) {
    const img = await appIcon(px);
    assert.deepEqual(img.options, { width: px, height: px });
    assert.equal(img.element.props.height, px);
    assert.match(img.element.props.src, /^data:image\/svg\+xml;base64,/);
  }
});
