// The home page, on a fixed day over a stand-in for the scores API: the challenge it opens with, today's ranking, the
// targets, what it tells search engines, and what it says when nobody has raced or the API is down.
// Run: node --test test/pages-home.test.mjs
import { mock } from './load.mjs';
import { test, mock as clock } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

clock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 18, 12) });
mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');
// next/image as the home page uses it: the hero's still is laid out by hand, from the image's own props
mock('next/image', `import { createElement } from 'react';
export const getImageProps = ({ fill, priority, ...p }) => ({ props: { ...p, srcSet: p.src + ' 1x' } });
export default function Image({ fill, priority, ...p }) { return createElement('img', p); }`);

const DAY = '2026-11-18';
const { dailyRace, KN, raceMinutes } = await import('../lib/race.ts');
const { VENUES, venueOf } = await import('../lib/venues.ts');
const { yachtOf } = await import('../lib/yachts.ts');
const { faqGroups, HOME } = await import('../lib/faq.ts');
const { DRILLS } = await import('../lib/drills.ts');
const { IYT_TOTAL } = await import('../lib/iyt.ts');
const { CHANNELS } = await import('../lib/social.ts');
const { tx } = await import('../lib/lang.ts');
const home = await import('../app/[lang]/page.tsx');

const row = (name, s) => ({ name, s, fl: 'GB' });
const five = [row('Anna Petrova', 300.4), row('Boris Ivanov', 312.9), row('Clara Weiss', 320), row(null, 330), row('Eve Stone', 340)];
const brief = (o = {}) => ({ d: DAY, w: 'w', races: 12, ranked: 5, top: five, s: five.map((r) => r.s), ...o });
const api = { down: false, plain: null, brief: null };
const reset = (o = {}) => Object.assign(api, { down: false, plain: { daily: { d: DAY, races: 12, top: five.slice(0, 3) } }, brief: brief() }, o);
const json = (x) => (x == null ? new Response('{}', { status: 404 }) : new Response(JSON.stringify(x)));
globalThis.fetch = async (url) => {
  if (api.down) throw new TypeError('fetch failed');
  return json(new URL(String(url)).searchParams.has('brief') ? api.brief : api.plain);
};

const LANGS = ['en', 'ru'];
const props = (lang) => ({ params: Promise.resolve({ lang }) });
const html = async (lang) => renderToStaticMarkup(await home.default(props(lang)));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const h1 = (h) => /<h1 class="ho-h1" id="home-h1">([^<]*)<\/h1>/.exec(h)[1];
const ld = (h) => JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(h)[1]);
const today = dailyRace();

test('home challenges you to beat today\'s best time', async () => {
  reset();
  assert.equal(h1(await html('en')), 'Beat 5:00.4 today');
  assert.equal(h1(await html('ru')), 'Побей 5:00.4 сегодня');
});

for (const [what, state] of [['nobody has finished', { brief: brief({ races: 0, ranked: 0, top: [], s: [] }), plain: { daily: { d: DAY, races: 0, top: [] } } }],
  ['the scores API is down', { down: true }],
  ['the only times are yesterday\'s', { brief: null, plain: { daily: { d: '2026-11-17', races: 40, top: [row('Yesterday Winner', 200)] } } }]]) {
  test(`home asks you to set the time when ${what}`, async () => {
    reset(state);
    const en = await html('en');
    assert.equal(h1(en), 'Set today’s time to beat');
    assert.ok(en.includes('No times yet today'));
    assert.ok(en.includes('Set the time to beat'));
    assert.ok(en.includes('The podium is still open ›'));
    assert.ok(!en.includes('Yesterday Winner'));
    assert.ok(en.includes('href="/play?race=today"'), 'the race can still be sailed');
    reset(state);
    const ru = await html('ru');
    assert.equal(h1(ru), 'Задай время дня');
    assert.ok(ru.includes('Сегодня ещё нет результатов'));
  });
}

for (const lang of LANGS) {
  const t = tx(lang), v = venueOf(today.venue), boat = yachtOf(today.yacht);

  test(`home (${lang}) says where today's race is and in what`, async () => {
    reset();
    const h = await html(lang);
    assert.ok(h.includes(esc(t(`Live · today’s race · ${t(...v.name)} · ${t(...boat.name)}`, `Эфир · гонка дня · ${t(...v.name)} · ${t(...boat.name)}`))));
    const mins = raceMinutes({ ...today, timeK: boat.timeK });
    assert.ok(h.includes(t(`About ${mins} minutes`, `Около ${mins} минут`)), 'how long it takes at her pace');
  });

  test(`home (${lang}) ranks today's five, with the gaps and how many have raced`, async () => {
    reset();
    const h = await html(lang);
    for (const name of ['Anna P.', 'Boris I.', 'Clara W.', 'Eve S.']) assert.ok(h.includes(name), name);
    assert.ok(h.includes(t('No name', 'Без имени')), 'someone with no name');
    assert.ok(h.includes('<small>+12.5</small>'), 'the gap to the first');
    assert.ok(h.includes(t('12 races', 'заездов: 12')));
    assert.ok(h.includes('href="/race/rating"'));
  });

  test(`home (${lang}) answers its short list of questions`, async () => {
    reset();
    const h = await html(lang), all = faqGroups(t).flatMap((g) => g.items);
    assert.ok(HOME.length > 0);
    for (const id of HOME) {
      const f = all.find((x) => x.id === id);
      assert.ok(f, `${id} is a question there is`);
      assert.ok(h.includes(esc(f.q)), id);
    }
  });

  test(`home (${lang}) counts the venues and drills there really are, and the exam's questions`, async () => {
    reset();
    const h = await html(lang);
    assert.ok(h.includes(t(`${VENUES.length} venues, one a day`, `${VENUES.length} акватор`)), 'the venues');
    assert.ok(h.includes(t(`${DRILLS.length} drills`, `Упражнений: ${DRILLS.length}`)), 'the drills');
    assert.ok(h.includes(`${IYT_TOTAL}`) && h.includes(t(`Sailing exam practice · ${IYT_TOTAL} questions`, `Тренажёр к яхтенному экзамену · ${IYT_TOTAL} вопросов`)), 'the exam');
  });

  test(`home (${lang}) tells search engines what the game is, in the page's language`, async () => {
    reset();
    const graph = ld(await html(lang))['@graph'];
    const game = graph.find((x) => x['@type'] === 'VideoGame');
    assert.equal(game.inLanguage, lang);
    assert.equal(game.url, 'https://www.sailupdown.com/');
    assert.equal(game.isAccessibleForFree, true);
    assert.equal(game.offers.price, 0);
    assert.equal(game.gameLocation.length, VENUES.length);
    assert.deepEqual(graph.find((x) => x['@type'] === 'WebSite').sameAs, CHANNELS.map((c) => c.url));
    assert.equal(graph.find((x) => x['@type'] === 'Organization').name, 'RYC');
  });

  test(`home (${lang}) has one heading and no id twice`, async () => {
    reset();
    const h = await html(lang);
    assert.equal(h.match(/<h1[ >]/g).length, 1);
    const ids = [...h.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(ids.length, new Set(ids).size, `twice: ${ids.filter((x, i) => ids.indexOf(x) !== i)}`);
  });
}

test('home says "55 акваторий" in Russian, in the form that number takes', async () => {
  reset();
  assert.ok((await html('ru')).includes(`${VENUES.length} акваторий, по одной в день`));
});

test('with ten ranked today the club racer\'s target is the top ten', async () => {
  const ten = Array.from({ length: 12 }, (_, i) => 300 + i * 5);
  reset({ brief: brief({ ranked: 12, s: ten }) });
  const h = await html('en');
  assert.ok(h.includes('Top ten under 5:45.0'));
  assert.ok(h.includes('Today: 5:45.0 is 10th of 12 ›'));
  assert.ok(!h.includes('Make the podium'));
});

test('with fewer than ten ranked the club racer\'s target is the podium, at the third time', async () => {
  reset();
  const h = await html('en');
  assert.ok(h.includes('Make the podium'));
  assert.ok(h.includes('Today: 5:20.0 is 3rd ›'));
  assert.ok(!h.includes('Top ten under'));
});

test('the time to beat is credited to whoever holds it', async () => {
  reset();
  assert.ok((await html('en')).includes('Anna P. holds it.'));
  reset({ brief: brief({ top: [row(null, 300.4)], s: [300.4], ranked: 1 }) });
  assert.ok((await html('en')).includes('No name holds it.'));
});

test('the ticker opens with how many have raced today, and only says what is true', async () => {
  reset();
  assert.match(await html('en'), /<span class="ho-tick-t">12 races sailed today<\/span>/);
  reset({ brief: brief({ races: 1, ranked: 1, top: [five[0]], s: [300.4] }), plain: null });
  assert.match(await html('en'), /<span class="ho-tick-t">1 race sailed today<\/span>/);
  reset({ down: true });
  assert.match(await html('en'), /<span class="ho-tick-t">Nobody has finished today’s race yet<\/span>/);
  reset({ down: true });
  assert.match(await html('ru'), /<span class="ho-tick-t">Гонку дня ещё никто не прошёл<\/span>/);
});

test('the wind shows on the ranking until someone has raced', async () => {
  reset({ brief: brief({ races: 0, ranked: 0, top: [], s: [] }), plain: null });
  const word = { light: 'Light', medium: 'Medium', strong: 'Strong' }[today.preset];
  assert.ok((await html('en')).includes(`${word} · ${KN[today.preset]} kn`));
});

test('every way on from home goes to a page of the game', async () => {
  reset();
  const h = await html('en');
  for (const href of ['/race/free', '/help', '/venues', '/race/drills', '/faq', '/iyt', '/help#h-today', '/help#h-screen', '/help#h-views']) assert.ok(h.includes(`href="${href}"`), href);
});

test('home is titled as it stands, addressed for each language, with today\'s share card', async () => {
  const [en, ru] = await Promise.all(LANGS.map((l) => home.generateMetadata(props(l))));
  assert.deepEqual(en.title, { absolute: 'Up and down — a free online sailing race game' });
  assert.deepEqual(ru.title, { absolute: 'Up and down — парусная гонка и симулятор яхты онлайн' });
  assert.notEqual(en.description, ru.description);
  assert.equal(en.alternates.canonical, '/');
  assert.equal(ru.alternates.canonical, '/?lang=ru');
  assert.deepEqual(en.alternates.languages, { en: '/', ru: '/?lang=ru', 'x-default': '/' });
  assert.equal(en.openGraph.images[0].url, `/og/today?lang=en&d=${DAY}`);
  assert.equal(ru.openGraph.images[0].url, `/og/today?lang=ru&d=${DAY}`);
  assert.equal(en.robots, undefined);
});

test('home refuses a language the site does not have', async () => {
  reset();
  await assert.rejects(html('de'), (e) => e.kind === 'notFound');
  await assert.rejects(home.generateMetadata(props('de')), (e) => e.kind === 'notFound');
});
