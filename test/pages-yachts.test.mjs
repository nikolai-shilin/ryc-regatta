// The yachts: the fleet, each yacht's own page and your boat, in English and in Russian. Every yacht is built and says
// what she is, and where the back arrow goes follows where you came from. Run: node --test test/pages-yachts.test.mjs
import './load.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

const { YACHTS, YACHT_IDS } = await import('../lib/yachts.ts');
const { PAGES_DATE } = await import('../lib/venue-guides.ts');
const { tx } = await import('../lib/lang.ts');
const { longDate } = await import('../lib/seo.ts');
const fleet = await import('../app/[lang]/yachts/page.tsx');
const one = await import('../app/[lang]/yachts/[id]/page.tsx');
const boat = await import('../app/[lang]/boat/page.tsx');

const LANGS = ['en', 'ru'];
const SITE = 'https://www.sailupdown.com';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const props = (lang, more = {}, q = {}) => ({ params: Promise.resolve({ lang, ...more }), searchParams: Promise.resolve(q) });
const html = async (mod, lang, more, q) => renderToStaticMarkup(await mod.default(props(lang, more, q)));
const ldOf = (h) => JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(h)[1]);
const addressed = (path, lang) => (lang === 'ru' ? `${path}?lang=ru` : path);
const backOf = (h) => /<a href="([^"]+)" class="bt-back" aria-label="([^"]+)"/.exec(h).slice(1);
const headingOf = (h) => /<h1 class="bt-h fl-h">([^<]+)<\/h1>/.exec(h)[1];

// ---------- the fleet ----------
test('/yachts opens on the whole fleet and tours it', async () => {
  const h = await html(fleet, 'en');
  assert.equal(headingOf(h), 'From the Optimist to the AC75');
  assert.ok(h.includes('aria-label="Stop the tour"'), 'the tour is running');
  assert.ok((await html(fleet, 'ru')).includes('aria-label="Остановить облёт"'));
});

test('/yachts?y= opens on that yacht and stays there', async () => {
  for (const id of YACHT_IDS) {
    const y = YACHTS.find((x) => x.id === id), h = await html(fleet, 'en', {}, { y: id });
    assert.equal(headingOf(h), esc(y.name[0]), id);
    assert.ok(h.includes('aria-label="Tour the fleet"'), `${id}: the tour is not running`);
  }
});

test('/yachts?y= with a yacht that does not exist is the plain tour', async () => {
  for (const y of ['titanic', 'J70', '', 'constructor']) {
    const h = await html(fleet, 'en', {}, { y });
    assert.equal(headingOf(h), 'From the Optimist to the AC75', y);
    assert.ok(h.includes('aria-label="Stop the tour"'), y);
  }
});

test('/yachts goes back to the race hub, or to the custom race when it was opened from there', async () => {
  assert.deepEqual(backOf(await html(fleet, 'en')), ['/race', 'Back to the race hub']);
  assert.deepEqual(backOf(await html(fleet, 'ru')), ['/race', 'Назад в меню гонок']);
  assert.deepEqual(backOf(await html(fleet, 'en', {}, { from: 'free' })), ['/race/free', 'Back to the custom race']);
  assert.deepEqual(backOf(await html(fleet, 'ru', {}, { from: 'free' })), ['/race/free', 'Назад к своей гонке']);
  assert.deepEqual(backOf(await html(fleet, 'en', {}, { from: 'https://evil.example' })), ['/race', 'Back to the race hub']);
});

test('/yachts is titled, described and addressed for each language', async () => {
  const [en, ru] = await Promise.all(LANGS.map((l) => fleet.generateMetadata(props(l))));
  assert.match(en.title, /^The yachts/);
  assert.match(ru.title, /^Яхты/);
  assert.notEqual(en.description, ru.description);
  assert.equal(en.alternates.canonical, '/yachts');
  assert.equal(ru.alternates.canonical, '/yachts?lang=ru');
  assert.equal(en.openGraph.images[0].url, '/og/page/yachts?lang=en');
  assert.equal(ru.openGraph.images[0].url, '/og/page/yachts?lang=ru');
});

test('/yachts says how many yachts the game really has', async () => {
  assert.equal(YACHT_IDS.length, 9, 'the description says nine: change both together');
  const [en, ru] = await Promise.all(LANGS.map((l) => fleet.generateMetadata(props(l))));
  assert.match(en.description, /^The nine yachts/);
  assert.match(ru.description, /^Девять яхт/);
});

// ---------- a yacht ----------
test('every yacht is built at deploy, and no other address is one', () => {
  assert.deepEqual(one.generateStaticParams(), YACHT_IDS.map((id) => ({ id })));
  assert.equal(one.dynamicParams, false);
  assert.deepEqual([...YACHT_IDS].sort(), YACHTS.map((y) => y.id).sort(), 'the list of ids is the list of yachts');
});

for (const y of YACHTS) {
  for (const lang of LANGS) {
    const t = tx(lang), name = t(...y.name);

    test(`${y.id} (${lang}) has her name, her line, the way back and who wrote it`, async () => {
      const h = await html(one, lang, { id: y.id });
      assert.equal(headingOf(h), esc(name));
      assert.ok(h.includes(esc(t(...y.tagline))), 'her line');
      assert.deepEqual(backOf(h)[0], '/race');
      assert.ok(h.includes(esc(t('Nikolai Shilin', 'Николай Шилин'))), 'the byline');
      assert.ok(h.includes(esc(longDate(PAGES_DATE, lang))), 'the date');
      assert.ok(h.includes(`aria-label="${t('Tour the fleet', 'Облететь флот')}"`), 'she stays on the screen');
    });

    test(`${y.id} (${lang}) links to every yacht in the reader's language`, async () => {
      const h = await html(one, lang, { id: y.id });
      for (const id of YACHT_IDS) assert.ok(h.includes(`href="${addressed(`/yachts/${id}`, lang)}"`), id);
      assert.match(h, new RegExp(`href="${addressed(`/yachts/${y.id}`, lang).replace('?', '\\?')}" role="radio" aria-checked="true"`), 'she is the one marked');
    });

    test(`${y.id} (${lang}) is an article about her, for search engines`, async () => {
      const ld = ldOf(await html(one, lang, { id: y.id }));
      const url = SITE + addressed(`/yachts/${y.id}`, lang);
      assert.equal(ld['@type'], 'Article');
      assert.equal(ld.headline, t(`The ${name}`, name));
      assert.equal(ld.description, t(...y.tagline));
      assert.equal(ld.url, url);
      assert.equal(ld.mainEntityOfPage, url);
      assert.equal(ld.inLanguage, lang);
      assert.equal(ld.datePublished, PAGES_DATE);
      assert.deepEqual(ld.about, { '@type': 'Thing', name: y.name[0], description: y.kind[0] });
    });

    test(`${y.id} (${lang}) has her own title, canonical address, languages and share card`, async () => {
      const m = await one.generateMetadata(props(lang, { id: y.id }));
      assert.equal(m.title, t(`The ${name}: race her in a 3D sailing game`, `${name}: гонки в 3D-парусной игре`));
      assert.ok(m.description.startsWith(t(...y.tagline)));
      assert.equal(m.alternates.canonical, addressed(`/yachts/${y.id}`, lang));
      assert.deepEqual(m.alternates.languages, { en: `/yachts/${y.id}`, ru: `/yachts/${y.id}?lang=ru`, es: `/yachts/${y.id}?lang=es`, de: `/yachts/${y.id}?lang=de`, tr: `/yachts/${y.id}?lang=tr`, fr: `/yachts/${y.id}?lang=fr`, it: `/yachts/${y.id}?lang=it`, pt: `/yachts/${y.id}?lang=pt`, 'x-default': `/yachts/${y.id}` });
      assert.equal(m.openGraph.images[0].url, `/og/page/yachts?lang=${lang}`);
      assert.deepEqual(m.authors, [{ name: t('Nikolai Shilin', 'Николай Шилин') }]);
    });
  }

  test(`${y.id} is described differently in each language`, async () => {
    const [en, ru] = await Promise.all(LANGS.map((l) => one.generateMetadata(props(l, { id: y.id }))));
    assert.notEqual(en.title, ru.title);
    assert.notEqual(en.description, ru.description);
  });
}

for (const id of ['titanic', 'J70', '', 'constructor', '__proto__']) {
  test(`the yacht address ${JSON.stringify(id)} is a 404 with no metadata of its own`, async () => {
    await assert.rejects(html(one, 'en', { id }), (e) => e.kind === 'notFound');
    assert.deepEqual(await one.generateMetadata(props('en', { id })), {});
  });
}

// ---------- your boat ----------
test('/boat goes back to the race hub, or to Settings when it was opened from there', async () => {
  assert.deepEqual(backOf(await html(boat, 'en')), ['/race', 'Back to the race hub']);
  assert.deepEqual(backOf(await html(boat, 'ru')), ['/race', 'Назад в меню гонок']);
  assert.deepEqual(backOf(await html(boat, 'en', {}, { from: 'settings' })), ['/settings', 'Back to settings']);
  assert.deepEqual(backOf(await html(boat, 'ru', {}, { from: 'settings' })), ['/settings', 'Назад в настройки']);
  assert.deepEqual(backOf(await html(boat, 'en', {}, { from: '//evil.example' })), ['/race', 'Back to the race hub']);
});

test('/boat shows the boat in 3D in the reader\'s language', async () => {
  assert.ok((await html(boat, 'en')).includes('title="Your yacht in 3D"'));
  assert.match(await html(boat, 'ru'), /<div class="scr bt-scr bc" lang="ru">/);
});

test('/boat is titled, described and addressed for each language', async () => {
  const [en, ru] = await Promise.all(LANGS.map((l) => boat.generateMetadata(props(l))));
  assert.match(en.title, /^Your yacht/);
  assert.match(ru.title, /^Твоя яхта/);
  assert.notEqual(en.description, ru.description);
  assert.equal(en.alternates.canonical, '/boat');
  assert.equal(ru.alternates.canonical, '/boat?lang=ru');
  assert.equal(en.openGraph.images[0].url, '/og/page/boat?lang=en');
});

test('/yachts tells search engines its trail and the nine yachts, each at her own page', async () => {
  for (const lang of LANGS) {
    const h = await html(fleet, lang);
    const [crumbs, list] = ldOf(h);
    assert.equal(crumbs['@type'], 'BreadcrumbList');
    assert.deepEqual(crumbs.itemListElement.map((x) => x.item), [SITE + addressed('/', lang), SITE + addressed('/yachts', lang)]);
    assert.equal(list['@type'], 'ItemList');
    assert.equal(list.itemListElement.length, YACHTS.length);
    list.itemListElement.forEach((x, i) => {
      assert.equal(x.position, i + 1);
      assert.equal(x.url, SITE + addressed(`/yachts/${YACHTS[i].id}`, lang));
      assert.equal(x.name, lang === 'ru' ? YACHTS[i].name[1] : YACHTS[i].name[0]);
    });
  }
});
