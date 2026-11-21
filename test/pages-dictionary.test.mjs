// The sailing dictionary at addresses of its own, for search engines and AI answer engines: /dictionary with every word,
// each a link to its page; /dictionary/<word> with its name as the heading, its definition, its group's other words and
// the ones before and after it, marked up as a DefinedTerm in the dictionary's set with the trail to it; the 3D scene
// in the page for the words the game sails (public/word-view), the guides' picture for the others. And the scene's page
// is kept out of search, as the other scenes are.
import './load.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

const { glossary, glossaryGroups, SCENES_3D, dictName } = await import('../lib/glossary.ts');
const { tx } = await import('../lib/lang.ts');
const index = await import('../app/[lang]/dictionary/page.tsx');
const termPage = await import('../app/[lang]/dictionary/[term]/page.tsx');

const SITE = 'https://www.sailupdown.com';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const props = (lang, more = {}) => ({ params: Promise.resolve({ lang, ...more }) });
const html = async (mod, lang, more) => renderToStaticMarkup(await mod.default(props(lang, more)));
const ldOf = (h) => JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(h)[1]);
const addressed = (path, lang) => (lang === 'en' ? path : `${path}?lang=${lang}`);

for (const lang of ['en', 'ru', 'de']) {
  const t = tx(lang), terms = glossary(t);

  test(`/dictionary (${lang}) is the race's dictionary over the water, every word in the page as sent, each a link to its own page`, async () => {
    const h = await html(index, lang);
    // the panel of the race's own (public/game/words.js): its look in the page, its parts
    assert.ok(h.includes('<style>') && h.includes('.wd-card {'), "words.js's look, in the page as sent");
    assert.match(h, /<div class="wd bc staged"/);
    assert.match(h, new RegExp(`<h1 id="dc-h">${esc(dictName(t))}</h1><span class="wd-n">${terms.length}</span>`));
    for (const x of terms) {
      assert.match(h, new RegExp(`<div class="wd-w" data-id="${x.id}"><dt><a class="wd-pick" href="/dictionary/${x.id}"><span class="wd-tn">${esc(x.term).replace(/[()]/g, '\\$&')}</span>`), x.id);
      assert.ok(h.includes(`<dd>${esc(x.def)}</dd>`), `${x.id}: its definition`);
    }
    assert.equal((h.match(/class="wd-3d"/g) || []).length, terms.filter((x) => SCENES_3D.includes(x.id)).length, 'the 3D mark on the words the game sails');
    assert.equal((h.match(/role="radio"/g) || []).length, glossaryGroups(t).length + 1, 'a tab for all, and one for each group');
    assert.match(h, /class="dc-foot"/);
    const ld = ldOf(h);
    assert.equal(ld['@type'], 'DefinedTermSet');
    assert.equal(ld.url, SITE + addressed('/dictionary', lang));
    assert.equal(ld.hasDefinedTerm.length, terms.length);
    for (const d of ld.hasDefinedTerm) assert.equal(d.url, SITE + addressed(`/dictionary/${terms.find((x) => x.term === d.name).id}`, lang));
  });

  test(`/dictionary/<word> (${lang}): the word, its definition, its group and the way on, as a DefinedTerm`, async () => {
    const groups = glossaryGroups(t);
    for (const x of terms) {
      const h = await html(termPage, lang, { term: x.id });
      assert.ok(h.includes(`<h1 class="hm-ph-h">${esc(x.term)}</h1>`), `${x.id}: its heading`);
      assert.ok(h.includes(esc(x.def)), `${x.id}: its definition`);
      // the 3D scene where the game sails it, the guides' picture where it doesn't
      assert.equal(h.includes('wd-scene'), SCENES_3D.includes(x.id), `${x.id}: 3D`);
      // its group's other words, linked
      for (const y of groups.find((g) => g.id === x.group).terms.filter((y) => y.id !== x.id)) assert.ok(h.includes(`href="/dictionary/${y.id}"`), `${x.id} → ${y.id}`);
      assert.match(h, /rel="prev"/); assert.match(h, /rel="next"/);
      if (x.see) assert.ok(h.includes(`href="${x.see}"`), `${x.id}: the guide that goes further`);
      const ld = ldOf(h), [term, trail] = ld['@graph'];
      assert.equal(ld['@context'], 'https://schema.org');
      assert.equal(term['@type'], 'DefinedTerm'); assert.equal(term.name, x.term); assert.equal(term.description, x.def);
      assert.equal(term.url, SITE + addressed(`/dictionary/${x.id}`, lang));
      assert.equal(term.inDefinedTermSet.url, SITE + addressed('/dictionary', lang));
      assert.deepEqual(trail.itemListElement.map((i) => i.item), ['/learn', '/dictionary', `/dictionary/${x.id}`].map((p) => SITE + addressed(p, lang)));
    }
  });

  test(`/dictionary/<word> (${lang}) is titled and described by the word, with its own address`, async () => {
    const x = terms.find((y) => y.id === 'layline');
    const meta = await termPage.generateMetadata(props(lang, { term: 'layline' }));
    assert.ok(meta.title.includes(x.term), meta.title);
    assert.ok(meta.description.startsWith(x.def), 'the definition, as an answer engine quotes it');
    assert.equal(meta.alternates.canonical, addressed('/dictionary/layline', lang));
  });
}

test('every word is a page, built at deploy; another is a 404', () => {
  assert.deepEqual(termPage.generateStaticParams().map((p) => p.term), glossary(tx('en')).map((x) => x.id));
  assert.equal(termPage.dynamicParams, false);
});

test('the 3D words are words of the glossary', () => {
  const ids = glossary(tx('en')).map((x) => x.id);
  for (const id of SCENES_3D) assert.ok(ids.includes(id), id);
});

test("the scene's page is the game's, kept out of search and out of the language routing, as the other scenes are", () => {
  const cfg = read('next.config.ts');
  assert.match(cfg, /\{ source: '\/word-view', destination: '\/word-view\/index\.html' \}/);
  assert.match(cfg, /\{ source: '\/word-view', headers: \[\{ key: 'x-robots-tag', value: 'noindex' \}\] \}/);
  assert.match(read('public/word-view/index.html'), /<meta name="robots" content="noindex">/);
  assert.match(read('proxy.ts'), /\|word-view\|/);
  assert.match(read('scripts/stamp-game.mjs'), /'\/word-view\/index\.html'/);
});

test('the files for AI answer engines name the dictionary and each word’s address', async () => {
  assert.match(read('app/llms.txt/route.ts'), /\[Sailing dictionary\]\(\$\{SITE\}\/dictionary\)/);
  assert.match(read('app/llms-full.txt/route.ts'), /\$\{SITE\}\/dictionary\/\$\{x\.id\}/);
});
