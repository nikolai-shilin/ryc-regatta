// The venues: the list and each venue's own page, in English and in Russian, on a fixed day (today's race moves round
// the venues). Every venue is built, says what it should, and links on; any other address is a 404.
// Run: node --test test/pages-venues.test.mjs
import './load.mjs';
import { test, mock as clock } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

const NOW = Date.UTC(2026, 10, 18, 12);
clock.timers.enable({ apis: ['Date'], now: NOW });

const { VENUES } = await import('../lib/venues.ts');
const { VENUE_GUIDES, PAGES_DATE } = await import('../lib/venue-guides.ts');
const { dailyVenue } = await import('../lib/race.ts');
const { tx } = await import('../lib/lang.ts');
const { longDate, OG_IMAGE } = await import('../lib/seo.ts');
const list = await import('../app/[lang]/venues/page.tsx');
const one = await import('../app/[lang]/venues/[id]/page.tsx');

const LANGS = ['en', 'ru'];
const SITE = 'https://www.sailupdown.com';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const props = (lang, more = {}) => ({ params: Promise.resolve({ lang, ...more }) });
const html = async (mod, lang, more) => renderToStaticMarkup(await mod.default(props(lang, more)));
const ldOf = (h) => JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(h)[1]);
const addressed = (path, lang) => (lang === 'ru' ? `${path}?lang=ru` : path);
const today = dailyVenue();
const notToday = VENUES.find((v) => v.id !== today).id;

// ---------- the list ----------
for (const lang of LANGS) {
  const t = tx(lang);

  test(`/venues (${lang}) links every venue, by its name in the reader's language`, async () => {
    const h = await html(list, lang);
    for (const v of VENUES) {
      assert.ok(h.includes(`href="/venues/${v.id}"`), v.id);
      assert.ok(h.includes(esc(t(...v.name))), `${v.id}: its name`);
    }
  });

  test(`/venues (${lang}) names today's venue first in its structured data, then the rest once each`, async () => {
    const ld = ldOf(await html(list, lang));
    assert.equal(ld['@type'], 'ItemList');
    assert.equal(ld.itemListElement.length, VENUES.length);
    assert.equal(ld.itemListElement[0].url, SITE + addressed(`/venues/${today}`, lang));
    assert.deepEqual(ld.itemListElement.map((x) => x.position), VENUES.map((_, i) => i + 1));
    assert.equal(new Set(ld.itemListElement.map((x) => x.url)).size, VENUES.length);
  });

  test(`/venues (${lang}) says which venue today's race is at`, async () => {
    const name = t(...VENUES.find((v) => v.id === today).name);
    assert.ok((await html(list, lang)).includes(esc(t(`Over ${name}, today’s race`, `Над акваторией ${name} — гонка дня`))));
  });
}

test('/venues is titled, described and addressed for each language', async () => {
  const [en, ru] = await Promise.all(LANGS.map((l) => list.generateMetadata(props(l))));
  assert.match(en.title, /^The venues/);
  assert.match(ru.title, /^Акватории/);
  assert.notEqual(en.description, ru.description);
  assert.equal(en.alternates.canonical, '/venues');
  assert.equal(ru.alternates.canonical, '/venues?lang=ru');
  assert.deepEqual(ru.alternates.languages, { en: '/venues', ru: '/venues?lang=ru', es: '/venues?lang=es', de: '/venues?lang=de', tr: '/venues?lang=tr', fr: '/venues?lang=fr', it: '/venues?lang=it', 'x-default': '/venues' });
});

test('/venues counts as many venues in its title and description as the game has', async () => {
  const [en, ru] = await Promise.all(LANGS.map((l) => list.generateMetadata(props(l))));
  for (const text of [en.title, en.description, ru.title, ru.description]) assert.ok(text.includes(String(VENUES.length)), text);
});

test('/venues refuses a language the site does not have', async () => {
  await assert.rejects(html(list, 'pt'), (e) => e.kind === 'notFound');
});

// ---------- a venue ----------
test('every venue is built at deploy, and no other address is one', () => {
  assert.deepEqual(one.generateStaticParams(), VENUES.map((v) => ({ id: v.id })));
  assert.equal(one.dynamicParams, false);
  assert.equal(new Set(VENUES.map((v) => v.id)).size, VENUES.length, 'no venue twice');
});

test('every venue in the game has its guide, so none of the built pages is a 404', () => {
  assert.deepEqual(VENUES.filter((v) => !VENUE_GUIDES[v.id]).map((v) => v.id), []);
});

for (const lang of LANGS) {
  const t = tx(lang);

  test(`each venue's page (${lang}) has its name, its guide and who wrote it`, async () => {
    for (const v of VENUES) {
      const g = VENUE_GUIDES[v.id], h = await html(one, lang, { id: v.id });
      assert.ok(h.includes(`<h1 class="bt-h fl-h">${esc(t(...v.name))}</h1>`), `${v.id}: its name as the heading`);
      assert.ok(h.includes(esc(t(...g.intro))), `${v.id}: the introduction`);
      assert.ok(h.includes(`href="/venues"`), `${v.id}: back to the list`);
      assert.ok(h.includes(esc(t('Nikolai Shilin', 'Николай Шилин'))), `${v.id}: the byline`);
      assert.ok(h.includes(esc(longDate(PAGES_DATE, lang))), `${v.id}: the date`);
      assert.ok(h.includes(`${String(VENUES.indexOf(v) + 1).padStart(2, '0')} / ${VENUES.length}`), `${v.id}: its number`);
    }
  });

  test(`each venue's page (${lang}) is an article about a place, for search engines`, async () => {
    for (const v of VENUES) {
      const g = VENUE_GUIDES[v.id], ld = ldOf(await html(one, lang, { id: v.id }));
      const url = SITE + addressed(`/venues/${v.id}`, lang);
      assert.equal(ld['@type'], 'Article', v.id);
      assert.equal(ld.headline, t(...g.title), v.id);
      assert.equal(ld.description, t(...g.description), v.id);
      assert.equal(ld.url, url, v.id);
      assert.equal(ld.inLanguage, lang, v.id);
      assert.equal(ld.datePublished, PAGES_DATE, v.id);
      assert.deepEqual(ld.about, { '@type': 'Place', name: v.name[0], address: { '@type': 'PostalAddress', addressCountry: v.nation, addressRegion: v.place[0] } }, v.id);
    }
  });

  test(`each venue's page (${lang}) has its own title, canonical address and languages`, async () => {
    for (const v of VENUES) {
      const g = VENUE_GUIDES[v.id], m = await one.generateMetadata(props(lang, { id: v.id }));
      assert.equal(m.title, t(...g.title), v.id);
      assert.equal(m.description, t(...g.description), v.id);
      assert.equal(m.alternates.canonical, addressed(`/venues/${v.id}`, lang), v.id);
      assert.deepEqual(m.alternates.languages, { en: `/venues/${v.id}`, ru: `/venues/${v.id}?lang=ru`, es: `/venues/${v.id}?lang=es`, de: `/venues/${v.id}?lang=de`, tr: `/venues/${v.id}?lang=tr`, fr: `/venues/${v.id}?lang=fr`, it: `/venues/${v.id}?lang=it`, 'x-default': `/venues/${v.id}` }, v.id);
      assert.equal(m.openGraph.type, 'article', v.id);
      assert.equal(m.openGraph.publishedTime, PAGES_DATE, v.id);
      assert.equal(m.openGraph.images[0].url, OG_IMAGE.url, v.id);
    }
  });
}

test('each venue reads differently in each language', async () => {
  for (const v of VENUES) {
    const [en, ru] = await Promise.all(LANGS.map((l) => one.generateMetadata(props(l, { id: v.id }))));
    assert.notEqual(en.title, ru.title, v.id);
    assert.notEqual(en.description, ru.description, v.id);
  }
});

test('no two venues share a title or a description', () => {
  for (const key of ['title', 'description']) for (const L of [0, 1]) {
    const all = VENUES.map((v) => VENUE_GUIDES[v.id][key][L]);
    assert.equal(new Set(all).size, all.length, `${key} ${LANGS[L]}`);
  }
});

test('each venue links on to the next four, going round past the last', async () => {
  const last = VENUES[VENUES.length - 1];
  const h = await html(one, 'en', { id: last.id });
  for (const o of VENUES.slice(0, 4)) assert.ok(h.includes(`href="/venues/${o.id}"`), o.id);
});

test('the venue of today\'s race invites you to sail it now', async () => {
  const en = await html(one, 'en', { id: today }), ru = await html(one, 'ru', { id: today });
  assert.match(en, /href="\/play\?race=today"/);
  assert.ok(en.includes('Sail today’s race here'));
  assert.ok(ru.includes('Пройди гонку дня здесь'));
});

test('another venue says the next day today\'s race comes to it', async () => {
  // found here by walking the days as the page should, from tomorrow on
  let day = null;
  for (let i = 1; i < 92 && !day; i++) { const d = new Date(NOW + i * 864e5); if (dailyVenue(d) === notToday) day = d.toISOString().slice(0, 10); }
  assert.ok(day, 'the race comes round within three months');
  const en = await html(one, 'en', { id: notToday }), ru = await html(one, 'ru', { id: notToday });
  assert.ok(en.includes(longDate(day, 'en')), `${notToday}: ${day}`);
  assert.ok(ru.includes(longDate(day, 'ru')));
  assert.ok(!en.includes('Sail today’s race here'));
});

for (const id of ['atlantis', 'COWES', '', 'constructor', '__proto__', '../../etc/passwd']) {
  test(`the venue address ${JSON.stringify(id)} is a 404 with no metadata of its own`, async () => {
    await assert.rejects(html(one, 'en', { id }), (e) => e.kind === 'notFound');
    assert.deepEqual(await one.generateMetadata(props('en', { id })), {});
  });
}
