// The guides: /learn, each /learn/<guide> and the glossary, in English and in Russian. What a reader and a search engine
// get: the right words, the right addresses, the structured data, and a 404 for a guide that doesn't exist.
// Run: node --test test/pages-learn.test.mjs
import './load.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

const { GUIDES, GUIDE_DATES, guide } = await import('../lib/guides.ts');
const { glossaryGroups } = await import('../lib/glossary.ts');
const { tx } = await import('../lib/lang.ts');
const { READING_VIEWPORT } = await import('../lib/no-zoom.ts');
const index = await import('../app/[lang]/learn/page.tsx');
const glossaryPage = await import('../app/[lang]/learn/glossary/page.tsx');
const guidePage = await import('../app/[lang]/learn/[slug]/page.tsx');

const LANGS = ['en', 'ru'];
const SITE = 'https://www.sailupdown.com';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const props = (lang, more = {}) => ({ params: Promise.resolve({ lang, ...more }) });
const html = async (mod, lang, more) => renderToStaticMarkup(await mod.default(props(lang, more)));
const ldOf = (h) => JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(h)[1]);
const idsOf = (h) => [...h.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const addressed = (path, lang) => (lang === 'ru' ? `${path}?lang=ru` : path);

// ---------- /learn ----------
for (const lang of LANGS) {
  const t = tx(lang);

  test(`/learn (${lang}) has a card for every guide, in order, and the way to the glossary`, async () => {
    const h = await html(index, lang);
    assert.ok(h.includes(esc(t('Racing guides', 'Пособия по гонкам'))));
    const cards = [...h.matchAll(/href="\/learn\/([a-z]+)" class="gd-card"/g)].map((m) => m[1]);
    assert.deepEqual(cards, [...GUIDES]);
    for (const slug of GUIDES) {
      const g = guide(slug, t, lang);
      assert.ok(h.includes(esc(g.title)), `${slug}: its title`);
      assert.ok(h.includes(esc(g.description)), `${slug}: its description`);
    }
    assert.ok(h.includes('href="/learn/glossary" class="gd-banner"'));
  });
}

test('/learn counts its guides in the words of each language', async () => {
  assert.match(await html(index, 'en'), new RegExp(`Up and down · ${GUIDES.length} guides`));
  assert.match(await html(index, 'ru'), new RegExp(`Up and down · ${GUIDES.length} пособий`));
});

test('/learn is titled, described and addressed for each language', async () => {
  const [en, ru] = await Promise.all(LANGS.map((l) => index.generateMetadata(props(l))));
  assert.equal(en.title, 'Racing guides');
  assert.equal(ru.title, 'Пособия по гонкам');
  assert.match(en.description, /Short guides to sailboat racing/);
  assert.match(ru.description, /Короткие пособия/);
  assert.equal(en.alternates.canonical, '/learn');
  assert.equal(ru.alternates.canonical, '/learn?lang=ru');
  assert.deepEqual(en.alternates.languages, { en: '/learn', ru: '/learn?lang=ru', es: '/learn?lang=es', de: '/learn?lang=de', 'x-default': '/learn' });
  assert.equal(en.openGraph.images[0].url, '/og/page/learn?lang=en');
  assert.equal(ru.openGraph.images[0].url, '/og/page/learn?lang=ru');
  assert.equal(en.robots, undefined, 'a page to be found');
});

test('every guide page lets a reader zoom', () => {
  for (const mod of [index, glossaryPage, guidePage]) assert.deepEqual(mod.viewport, READING_VIEWPORT);
  assert.equal(READING_VIEWPORT.userScalable, true);
});

test('/learn refuses a language the site does not have', async () => {
  await assert.rejects(html(index, 'fr'), (e) => e.kind === 'notFound');
  await assert.rejects(index.generateMetadata(props('fr')), (e) => e.kind === 'notFound');
});

// ---------- a guide ----------
test('every guide is built at deploy, and no other address is one', () => {
  assert.deepEqual(guidePage.generateStaticParams(), GUIDES.map((slug) => ({ slug })));
  assert.equal(guidePage.dynamicParams, false);
  assert.equal(GUIDES.length, new Set(GUIDES).size, 'no guide twice');
});

for (const slug of GUIDES) {
  for (const lang of LANGS) {
    const t = tx(lang), g = guide(slug, t, lang);

    test(`guide ${slug} (${lang}) has its title, intro and every section, each a place to link to`, async () => {
      const h = await html(guidePage, lang, { slug });
      assert.match(h, new RegExp(`<h1 class="hm-ph-h">${esc(g.title).replace(/[()?]/g, '\\$&')}</h1>`));
      assert.ok(h.includes(esc(g.intro)));
      for (const s of g.sections) {
        assert.ok(h.includes(`id="${s.id}"`), `section ${s.id}`);
        assert.ok(h.includes(`href="#${s.id}"`), `${s.id} in the contents`);
        for (const p of s.p) assert.ok(h.includes(esc(p)), `${s.id}: its text`);
        if (s.tip) assert.ok(h.includes(esc(s.tip)), `${s.id}: its tip`);
      }
      const ids = idsOf(h);
      assert.equal(ids.length, new Set(ids).size, `no id twice: ${ids.filter((x, i) => ids.indexOf(x) !== i)}`);
    });

    test(`guide ${slug} (${lang}) sends the reader to the water and on to the next guide`, async () => {
      const h = await html(guidePage, lang, { slug });
      const next = guide(GUIDES[(GUIDES.indexOf(slug) + 1) % GUIDES.length], t, lang);
      assert.ok(h.includes(`href="${esc(g.try.href)}" class="gd-try-go"`));
      assert.ok(h.includes(`href="/learn/${next.slug}" class="gd-next-card"`), 'the next guide, the last going back to the first');
      assert.match(h, /href="\/learn\/glossary[^"]*" class="gd-next-card"/);
    });

    test(`guide ${slug} (${lang}) describes itself as an article for search engines`, async () => {
      const ld = ldOf(await html(guidePage, lang, { slug }));
      const url = SITE + addressed(`/learn/${slug}`, lang);
      assert.equal(ld['@type'], 'Article');
      assert.equal(ld.headline, g.title);
      assert.equal(ld.description, g.description);
      assert.equal(ld.inLanguage, lang);
      assert.equal(ld.url, url);
      assert.equal(ld.mainEntityOfPage, url);
      assert.equal(ld.datePublished, GUIDE_DATES[slug].published);
      assert.equal(ld.dateModified, GUIDE_DATES[slug].modified);
      assert.equal(ld.author.name, 'Nikolai Shilin');
      assert.ok(ld.image.startsWith(`${SITE}/`));
    });

    test(`guide ${slug} (${lang}) has its own title, canonical address, languages and share card`, async () => {
      const m = await guidePage.generateMetadata(props(lang, { slug }));
      assert.equal(m.title, g.title);
      assert.equal(m.description, g.description);
      assert.equal(m.alternates.canonical, addressed(`/learn/${slug}`, lang));
      assert.deepEqual(m.alternates.languages, { en: `/learn/${slug}`, ru: `/learn/${slug}?lang=ru`, es: `/learn/${slug}?lang=es`, de: `/learn/${slug}?lang=de`, 'x-default': `/learn/${slug}` });
      assert.equal(m.openGraph.type, 'article');
      assert.equal(m.openGraph.publishedTime, GUIDE_DATES[slug].published);
      assert.equal(m.openGraph.modifiedTime, GUIDE_DATES[slug].modified);
      assert.equal(m.openGraph.images[0].url, `/og/page/guide?g=${slug}&lang=${lang}`);
      assert.deepEqual(m.authors, [{ name: t('Nikolai Shilin', 'Николай Шилин') }]);
    });
  }

  test(`guide ${slug} reads differently in each language`, async () => {
    const [en, ru] = await Promise.all(LANGS.map((l) => guidePage.generateMetadata(props(l, { slug }))));
    assert.notEqual(en.title, ru.title);
    assert.notEqual(en.description, ru.description);
    assert.match(ru.title, /[а-яё]/i);
  });
}

test('the guide after the last one is the first', async () => {
  const h = await html(guidePage, 'en', { slug: GUIDES[GUIDES.length - 1] });
  assert.ok(h.includes(`href="/learn/${GUIDES[0]}" class="gd-next-card"`));
});

test('a guide that says when it was updated says "Updated", one never changed "Published"', async () => {
  for (const slug of GUIDES) {
    const { published, modified } = GUIDE_DATES[slug];
    const h = await html(guidePage, 'en', { slug });
    assert.match(h, published === modified ? /Published <time/ : /Updated <time/, slug);
    assert.ok(h.includes(`dateTime="${modified}"`) || h.includes(`datetime="${modified}"`), slug);
  }
});

for (const slug of ['nope', 'SAIL', 'sail ', '', 'constructor', '__proto__', '../admin']) {
  test(`the guide address ${JSON.stringify(slug)} is a 404 with no metadata of its own`, async () => {
    await assert.rejects(html(guidePage, 'en', { slug }), (e) => e.kind === 'notFound');
    assert.deepEqual(await guidePage.generateMetadata(props('en', { slug })), {});
  });
}

// ---------- the glossary ----------
for (const lang of LANGS) {
  const t = tx(lang), groups = glossaryGroups(t), terms = groups.flatMap((g) => g.terms);

  test(`the glossary (${lang}) has every term with its definition, each a place to link to`, async () => {
    const h = await html(glossaryPage, lang);
    for (const x of terms) {
      assert.ok(h.includes(`id="${x.id}"`), x.id);
      assert.ok(h.includes(`<dt>${esc(x.term)}</dt>`), x.term);
      assert.ok(h.includes(`<dd>${esc(x.def)}</dd>`), `${x.id}: its definition`);
    }
    const ids = idsOf(h);
    assert.equal(ids.length, new Set(ids).size, `no id twice: ${ids.filter((x, i) => ids.indexOf(x) !== i)}`);
  });

  test(`the glossary (${lang}) lists its topics with how many terms each has`, async () => {
    const h = await html(glossaryPage, lang);
    for (const g of groups) assert.match(h, new RegExp(`href="#${g.id}"[^>]*>${esc(g.title)}<span class="td">${g.terms.length}</span>`));
    assert.ok(h.includes(String(terms.length)), 'the sum of them in the introduction');
  });

  test(`the glossary (${lang}) marks its terms up for search engines`, async () => {
    const ld = ldOf(await html(glossaryPage, lang));
    const url = SITE + addressed('/learn/glossary', lang);
    assert.equal(ld['@type'], 'DefinedTermSet');
    assert.equal(ld['@id'], url);
    assert.equal(ld.inLanguage, lang);
    assert.equal(ld.hasDefinedTerm.length, terms.length);
    assert.deepEqual(ld.hasDefinedTerm[0], { '@type': 'DefinedTerm', '@id': `${url}#${terms[0].id}`, name: terms[0].term, description: terms[0].def, inDefinedTermSet: url });
  });
}

test('the glossary names how many guides there are, in words', async () => {
  const words = { 8: ['Eight guides, each ending in a race', 'Восемь пособий, и каждое заканчивается гонкой'] }[GUIDES.length];
  assert.ok(words, 'a number this test knows the words of');
  assert.ok((await html(glossaryPage, 'en')).includes(words[0]));
  assert.ok((await html(glossaryPage, 'ru')).includes(words[1]));
});

test('the glossary is titled, described and addressed for each language', async () => {
  const [en, ru] = await Promise.all(LANGS.map((l) => glossaryPage.generateMetadata(props(l))));
  assert.equal(en.title, 'Sailing racing glossary');
  assert.equal(ru.title, 'Словарь парусных гонок');
  assert.notEqual(en.description, ru.description);
  assert.equal(en.alternates.canonical, '/learn/glossary');
  assert.equal(ru.alternates.canonical, '/learn/glossary?lang=ru');
  assert.equal(ru.openGraph.locale, 'ru_RU');
  assert.equal(en.openGraph.locale, 'en_GB');
});
