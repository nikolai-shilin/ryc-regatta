// The site's words and what search engines read of them: every guide, venue page, question and term is whole in both
// languages, every picture and link they name exists, and each page's title, card and canonical are right.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { exists } from './load.mjs';

const { tx } = await import('../lib/lang.ts');
const { GUIDES, GUIDE_DATES, guide, guideNo, isGuide } = await import('../lib/guides.ts');
const { faqGroups, HOME } = await import('../lib/faq.ts');
const { glossary, glossaryGroups, seeLabel } = await import('../lib/glossary.ts');
const { rulebook, entriesOf, ruleCount } = await import('../lib/rulebook.ts');
const { VENUES } = await import('../lib/venues.ts');
const { VENUE_GUIDES, PAGES_DATE } = await import('../lib/venue-guides.ts');
const { IYT_LEVELS, IYT_TOTAL } = await import('../lib/iyt.ts');
const { iytSample } = await import('../lib/iyt-sample.ts');
const { CHANNELS } = await import('../lib/social.ts');
const { SHARE_TARGETS } = await import('../lib/share.ts');
const { READING, READING_VIEWPORT, NO_ZOOM } = await import('../lib/no-zoom.ts');
const seo = await import('../lib/seo.ts');
const { safeNext } = await import('../lib/next-path.ts');
const { ruPlural, ruBoats, pickLang } = await import('../lib/lang.ts');
const { getLang, getT, titled } = await import('../lib/i18n.ts');

const LANGS = ['en', 'ru'];
const CYR = /[а-яё]/i;
const said = (s, where) => assert.ok(typeof s === 'string' && s.trim().length > 0 && !/undefined|\[object/.test(s), `${where}: ${JSON.stringify(s)}`);
const inLang = (s, lang, where) => { said(s, where); if (lang === 'ru') assert.match(s, CYR, `${where} is not in Russian: ${s}`); };
const unique = (list, what) => assert.equal(new Set(list).size, list.length, `${what} repeat: ${list.filter((x, i) => list.indexOf(x) !== i)}`);

// ---------- the guides ----------
for (const lang of LANGS) {
  const t = tx(lang);
  for (const slug of GUIDES) test(`the guide "${slug}" is whole in ${lang}`, () => {
    const g = guide(slug, t, lang);
    assert.equal(g.slug, slug);
    for (const k of ['title', 'short', 'description', 'kicker', 'intro']) inLang(g[k], lang, `${slug}.${k}`);
    assert.ok(g.sections.length >= 3, 'sections');
    unique(g.sections.map((s) => s.id), 'section ids');
    for (const s of g.sections) {
      inLang(s.h, lang, `${slug}.${s.id}.h`);
      assert.ok(s.p.length > 0, `${slug}.${s.id} has no text`);
      for (const p of s.p) inLang(p, lang, `${slug}.${s.id}.p`);
      if (s.tip) inLang(s.tip, lang, `${slug}.${s.id}.tip`);
    }
    for (const m of g.more) { said(m.label, `${slug}.more`); assert.match(m.href, /^(\/|https:\/\/)/, m.href); }
    said(g.try.label, `${slug}.try`); said(g.try.text, `${slug}.try`); assert.match(g.try.href, /^\//);
  });
}

test('a guide\'s further reading on this site leads to pages that exist', () => {
  for (const lang of LANGS) for (const slug of GUIDES) for (const m of guide(slug, tx(lang), lang).more) {
    const a = /^\/learn\/([a-z]+)/.exec(m.href);
    if (a && a[1] !== 'glossary') assert.ok(isGuide(a[1]), `${slug} links to ${m.href}`);
  }
});

test('a guide\'s picture is on the disk', () => {
  for (const slug of GUIDES) {
    const { img } = guide(slug, tx('en'), 'en');
    if (!img) continue;
    assert.ok(exists(`public${img.src}`), img.src);
    assert.ok(img.width > 0 && img.height > 0); said(img.alt, `${slug}.img.alt`);
  }
});

test('every guide has its dates, and was changed no earlier than it was published', () => {
  assert.deepEqual(Object.keys(GUIDE_DATES).sort(), [...GUIDES].sort());
  for (const { published, modified } of Object.values(GUIDE_DATES)) {
    assert.match(published, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(modified >= published);
  }
});

test('the guides are numbered in their order, and only they are guides', () => {
  GUIDES.forEach((slug, i) => assert.equal(guideNo(slug), i + 1));
  assert.equal(isGuide('sail'), true);
  assert.equal(isGuide('glossary'), false);
  assert.equal(isGuide('constructor'), false);
});

// ---------- the questions ----------
test('every question and answer is there in both languages, each with its own id', () => {
  const en = faqGroups(tx('en')), ru = faqGroups(tx('ru'));
  assert.deepEqual(ru.map((g) => g.items.map((f) => f.id)), en.map((g) => g.items.map((f) => f.id)));
  unique(en.map((g) => g.id), 'groups');
  unique(en.flatMap((g) => g.items.map((f) => f.id)), 'questions');
  for (const g of ru) { inLang(g.title, 'ru', g.id); inLang(g.kicker, 'ru', g.id); for (const f of g.items) { inLang(f.q, 'ru', f.id); inLang(f.a, 'ru', f.id); } }
  for (const g of en) for (const f of g.items) { said(f.q, f.id); said(f.a, f.id); }
});

test('the questions on the home page are real questions', () => {
  const ids = faqGroups(tx('en')).flatMap((g) => g.items.map((f) => f.id));
  for (const id of HOME) assert.ok(ids.includes(id), id);
});

// ---------- the glossary ----------
test('every term is defined in both languages, and in one group', () => {
  const en = glossary(tx('en')), ru = glossary(tx('ru'));
  assert.deepEqual(ru.map((x) => x.id), en.map((x) => x.id));
  unique(en.map((x) => x.id), 'terms');
  for (const x of ru) { inLang(x.term, 'ru', x.id); inLang(x.def, 'ru', x.id); }
  const grouped = glossaryGroups(tx('en')).flatMap((g) => g.terms.map((x) => x.id));
  assert.deepEqual([...grouped].sort(), en.map((x) => x.id).sort());
  for (const g of glossaryGroups(tx('ru'))) { inLang(g.title, 'ru', g.id); assert.ok(g.terms.length > 0, g.id); }
});

test('a term that says "see" leads to a guide, and names it', () => {
  for (const lang of LANGS) for (const x of glossary(tx(lang)).filter((y) => y.see)) {
    const slug = /^\/learn\/([a-z]+)/.exec(x.see)?.[1];
    if (slug) assert.ok(isGuide(slug), `${x.id}: ${x.see}`);
    inLang(seeLabel(x.see, tx(lang), lang), lang, `${x.id}.see`);
  }
});

// ---------- the rule book ----------
const RULE_NUMBERS = [[1, 6], [10, 23], [25, 37], [40, 56], [60, 65], [69, 72], [75, 80], [85, 92]].flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => String(a + i)));

test('the rule book has every rule of Parts 1 to 7, in the book\'s order, and every appendix', () => {
  const parts = rulebook(tx('en'));
  const numbers = parts.filter((p) => p.id.startsWith('part-')).flatMap(entriesOf).map((x) => x.no.split('.')[0]);
  assert.deepEqual([...new Set(numbers)], RULE_NUMBERS);
  assert.equal(ruleCount(parts), RULE_NUMBERS.length);
  assert.deepEqual(entriesOf(parts.find((p) => p.id === 'appendices')).map((x) => x.no), [...'ABCDEFGHJMNPRST']);
});

test('every entry of the rule book is whole in both languages, with its own address', () => {
  const en = rulebook(tx('en')), ru = rulebook(tx('ru'));
  assert.deepEqual(ru.flatMap(entriesOf).map((x) => x.id), en.flatMap(entriesOf).map((x) => x.id));
  unique([...en.map((p) => p.id), ...en.flatMap((p) => p.sections.map((s) => s.id).filter(Boolean)), ...en.flatMap(entriesOf).map((x) => x.id)], 'rule book ids');
  for (const p of ru) {
    for (const k of ['chip', 'title', 'intro']) inLang(p[k], 'ru', `${p.id}.${k}`);
    for (const s of p.sections) { if (s.title) inLang(s.title, 'ru', `${p.id} section`); if (s.intro) inLang(s.intro, 'ru', `${p.id} section`); }
    for (const x of entriesOf(p)) { inLang(x.title, 'ru', x.id); inLang(x.text, 'ru', x.id); }
  }
  for (const x of en.flatMap(entriesOf)) { said(x.title, x.id); said(x.text, x.id); assert.doesNotMatch(x.text, CYR, `${x.id} is not in English`); }
});

test('a rule that leads to a guide leads to one that exists, and to a section it has', () => {
  for (const x of rulebook(tx('en')).flatMap(entriesOf).filter((y) => y.see)) {
    const [, slug, hash] = /^\/learn\/([a-z]+)(?:#(.+))?$/.exec(x.see);
    assert.ok(isGuide(slug), `${x.id}: ${x.see}`);
    if (hash) assert.ok(guide(slug, tx('en'), 'en').sections.some((s) => s.id === hash), `${x.id}: ${x.see}`);
  }
});

test('the guides, the questions and the game cite the rules by their 2025–2028 numbers', () => {
  for (const lang of LANGS) {
    const t = tx(lang);
    const words = [...GUIDES.flatMap((slug) => guide(slug, t, lang).sections.flatMap((s) => [s.h, ...s.p, s.tip || ''])), ...faqGroups(t).flatMap((g) => g.items.map((f) => f.a))].join('\n');
    assert.doesNotMatch(words, /(rules?|правил[оа]|правилу) 2[12]\b(?!\.)/i, lang);
    assert.match(words, /(rule|правил[оу]) 43\b/, lang);
  }
  const game = readFileSync(new URL('../public/game/main.js', import.meta.url), 'utf8');
  assert.equal([...game.matchAll(/exonerated: '[^']*\((rule|правило) 43\)'/g)].length, 2);
});

// ---------- the venue pages ----------
test('every venue has a page, and no page is without a venue', () => {
  assert.deepEqual(Object.keys(VENUE_GUIDES).sort(), VENUES.map((v) => v.id).sort());
  assert.match(PAGES_DATE, /^\d{4}-\d{2}-\d{2}$/);
});

for (const v of VENUES) test(`the venue page of ${v.id} is whole in both languages`, () => {
  const g = VENUE_GUIDES[v.id];
  for (const k of ['title', 'description', 'intro']) { said(g[k][0], `${v.id}.${k}`); inLang(g[k][1], 'ru', `${v.id}.${k}`); }
  assert.ok(g.description[0].length <= 155, `the description is ${g.description[0].length} characters`);
  assert.ok(g.description[1].length <= 155, `the Russian description is ${g.description[1].length} characters`);
  assert.equal(g.sections.length, 3);
  for (const s of g.sections) {
    said(s.h[0], v.id); inLang(s.h[1], 'ru', v.id);
    assert.ok(s.p.length > 0);
    for (const p of s.p) { said(p[0], v.id); inLang(p[1], 'ru', v.id); }
  }
});

test('no two venue pages share a title or a description', () => {
  unique(Object.values(VENUE_GUIDES).map((g) => g.title[0]), 'titles');
  unique(Object.values(VENUE_GUIDES).map((g) => g.description[0]), 'descriptions');
});

// ---------- the trainer's card ----------
test('the courses add up to the total the page says', () => {
  assert.equal(IYT_TOTAL, IYT_LEVELS.reduce((a, l) => a + l.n, 0));
  assert.equal(IYT_TOTAL, 6100, 'the trainer has 6100 questions');
  for (const l of IYT_LEVELS) { said(l.name[0], 'level'); inLang(l.text[1], 'ru', l.name[0]); assert.ok(l.n > 0); }
});

test('the sample question has four answers, and the right one among them', () => {
  for (const lang of LANGS) {
    const q = iytSample(lang);
    inLang(q.question, lang, 'question'); inLang(q.why, lang, 'why');
    assert.deepEqual(q.options.map((o) => o[0]), ['A', 'B', 'C', 'D']);
    assert.ok(q.options.some((o) => o[0] === q.answer));
    assert.match(q.figure, /^https:\/\/iyt\.rycrentals\.com\//);
  }
  assert.match(iytSample('ru').more, /\/ru\/racing-rules\//);
  assert.doesNotMatch(iytSample('en').more, /\/ru\//);
  assert.match(iytSample('ru').figure, /lang=ru/);
});

test('every channel is on an app the share sheet knows', () => {
  const apps = SHARE_TARGETS.map((t) => t.id);
  for (const c of CHANNELS) { assert.ok(apps.includes(c.app), c.app); assert.match(c.url, /^https:\/\//); inLang(c.what[1], 'ru', c.name); }
});

// ---------- zooming ----------
test('the reading pages zoom, and the game\'s screens don\'t', () => {
  for (const p of ['/learn', '/learn/sail', '/faq', '/help', '/iyt', '/social']) assert.match(p, READING, p);
  for (const p of ['/', '/race', '/boat', '/yachts', '/venues', '/learning', '/helpful', '/socially']) assert.doesNotMatch(p, READING, p);
  assert.equal(READING_VIEWPORT.userScalable, true);
  assert.ok(READING_VIEWPORT.maximumScale >= 2, 'at least 200%, as accessibility checks ask');
  assert.ok(NO_ZOOM.includes(READING.toString()), 'the inlined script leaves the same pages alone');
});

test('the inlined zoom lock is a script a browser can parse', () => {
  assert.doesNotThrow(() => new Function(NO_ZOOM));
  assert.doesNotMatch(NO_ZOOM, /<\/script/i);
});

// ---------- where sign-in sends you ----------
test('only a path on this site is gone to after signing in', () => {
  for (const ok of ['/', '/race', '/race/free?wind=light', '/boat#top']) assert.equal(safeNext(ok), ok);
  for (const bad of [null, undefined, '', 'race', '//evil.test', 'https://evil.test', '/\\evil.test', '/\t/evil.test', '/\n/evil.test', '/\r/evil.test', '/x\x7f']) assert.equal(safeNext(bad), '/race', JSON.stringify(bad));
  assert.equal(safeNext('//evil.test', '/'), '/');
});

// ---------- the language ----------
test('a count in Russian takes its right form', () => {
  const said = { 1: '1 лодка', 2: '2 лодки', 4: '4 лодки', 5: '5 лодок', 11: '11 лодок', 12: '12 лодок', 14: '14 лодок', 20: '20 лодок', 21: '21 лодка', 22: '22 лодки', 25: '25 лодок', 101: '101 лодка', 111: '111 лодок', 0: '0 лодок' };
  for (const [n, s] of Object.entries(said)) assert.equal(ruBoats(Number(n)), s);
  assert.equal(ruPlural(-1, ['a', 'b', 'c']), 'a');
});

test('the reader\'s language: the address, the cookie, then the browser', () => {
  assert.equal(pickLang('ru', 'en', 'en'), 'ru');
  assert.equal(pickLang(null, 'ru', 'en'), 'ru');
  assert.equal(pickLang(null, null, 'ru-RU,ru;q=0.9'), 'ru');
  for (const a of ['uk-UA', 'be', 'kk-KZ', 'RU']) assert.equal(pickLang(null, null, a), 'ru', a);
  for (const a of ['en-GB', 'de', 'rus', 'ruby', null, '']) assert.equal(pickLang('de', 'fr', a), 'en', String(a));
});

test('a page\'s language comes from its address, and any other is not found', async () => {
  assert.equal(await getLang(Promise.resolve({ lang: 'ru' })), 'ru');
  const { lang, t } = await getT(Promise.resolve({ lang: 'en' }));
  assert.equal(lang, 'en'); assert.equal(t('a', 'б'), 'a');
  await assert.rejects(getLang(Promise.resolve({ lang: 'de' })), (e) => e.kind === 'notFound');
});

test('a page\'s title in the reader\'s language', async () => {
  const meta = titled('Settings', 'Настройки', { path: '/settings', description: ['About', 'О чём'], index: false });
  const ru = await meta({ params: Promise.resolve({ lang: 'ru' }) });
  assert.equal(ru.title, 'Настройки'); assert.equal(ru.description, 'О чём');
  assert.equal(ru.alternates.canonical, '/settings?lang=ru');
  assert.deepEqual(ru.robots, { index: false, follow: true });
  const en = await titled('Settings', 'Настройки')({ params: Promise.resolve({ lang: 'en' }) });
  assert.equal(en.title, 'Settings'); assert.equal(en.description, undefined); assert.equal(en.robots, undefined);
});

// ---------- what search engines and link previews read ----------
test('each language has an address of its own', () => {
  assert.equal(seo.langUrl('/faq', 'en'), '/faq');
  assert.equal(seo.langUrl('/faq', 'ru'), '/faq?lang=ru');
  assert.deepEqual(seo.languages('/faq'), { en: '/faq', ru: '/faq?lang=ru', 'x-default': '/faq' });
});

test('a page\'s meta: the title with the site\'s name, its canonical and both languages', () => {
  const m = seo.pageMeta('ru', { title: 'Вопросы', description: 'Описание', path: '/faq' });
  assert.equal(m.title, 'Вопросы');
  assert.equal(m.openGraph.title, `Вопросы · ${seo.NAME}`);
  assert.equal(m.openGraph.url, '/faq?lang=ru');
  assert.equal(m.openGraph.locale, 'ru_RU'); assert.deepEqual(m.openGraph.alternateLocale, ['en_GB']);
  assert.equal(m.alternates.canonical, '/faq?lang=ru');
  assert.equal(m.alternates.languages['x-default'], '/faq');
  assert.equal(m.twitter.card, 'summary_large_image');
  assert.equal(m.robots, undefined);
});

test('a title can stand alone, and a page can be kept out of search', () => {
  const m = seo.pageMeta('en', { title: 'Whole title', absolute: true, index: false });
  assert.deepEqual(m.title, { absolute: 'Whole title' });
  assert.equal(m.openGraph.title, 'Whole title');
  assert.deepEqual(m.robots, { index: false, follow: true });
  assert.equal(m.alternates, undefined); assert.equal(m.description, undefined); assert.equal(m.openGraph.url, undefined);
});

test('the share card: the site\'s picture, today\'s, or the page\'s own', () => {
  const day = new Date().toISOString().slice(0, 10);
  assert.equal(seo.pageMeta('en', { title: 'x' }).openGraph.images[0].url, seo.OG_IMAGE.url);
  assert.ok(exists(`public${seo.OG_IMAGE.url}`), 'the picture is on the disk');
  assert.equal(seo.pageMeta('ru', { title: 'x', today: true }).openGraph.images[0].url, `/og/today?lang=ru&d=${day}`);
  assert.equal(seo.pageMeta('en', { title: 'x', card: '/og/page/yachts' }).openGraph.images[0].url, '/og/page/yachts?lang=en');
  assert.equal(seo.pageMeta('en', { title: 'x', card: '/og/page/player?p=k' }).twitter.images[0].url, '/og/page/player?p=k&lang=en');
  assert.equal(seo.pageMeta('en', { title: 'x', card: '/og/page/rating', live: true }).openGraph.images[0].url, `/og/page/rating?lang=en&d=${day}`);
});

test('the card\'s description for those who can\'t see it follows the language', () => {
  assert.equal(seo.pageMeta('en', { title: 'x' }).openGraph.images[0].alt, 'A race in the game');
  assert.equal(seo.pageMeta('ru', { title: 'x' }).openGraph.images[0].alt, 'Гонка в игре');
  assert.match(seo.pageMeta('ru', { title: 'x', today: true }).openGraph.images[0].alt, /^Гонка дня/);
  assert.equal(seo.pageMeta('en', { title: 'x', card: '/c' }).openGraph.images[0].alt, `x · ${seo.NAME}`);
});

test('structured data can\'t close its own script tag', () => {
  const { __html } = seo.jsonLd({ a: '</script><script>alert(1)</script>' });
  assert.doesNotMatch(__html, /</);
  assert.deepEqual(JSON.parse(__html), { a: '</script><script>alert(1)</script>' });
});

test('a byline\'s date, as each language says it', () => {
  assert.equal(seo.longDate('2026-11-17', 'en'), '17 November 2026');
  assert.match(seo.longDate('2026-11-17', 'ru'), /^17 ноября 2026/);
});

test('the home page\'s title and description are there in both languages, short enough for a search result', () => {
  for (const pair of [seo.HOME_TITLE, seo.HOME_DESC]) { said(pair[0], 'home'); inLang(pair[1], 'ru', 'home'); }
  assert.ok(seo.HOME_TITLE[0].length <= 70, `${seo.HOME_TITLE[0].length} characters`);
});
