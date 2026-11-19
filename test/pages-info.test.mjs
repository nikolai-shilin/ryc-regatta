// The pages that explain the game and whoever makes it: the questions, How to play, the exam trainer, the channels and
// sponsorship, in English and in Russian. Run: node --test test/pages-info.test.mjs
import './load.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

const { faqGroups } = await import('../lib/faq.ts');
const { tx } = await import('../lib/lang.ts');
const { IYT_LEVELS, IYT_TOTAL } = await import('../lib/iyt.ts');
const { CHANNELS } = await import('../lib/social.ts');
const { VENUES } = await import('../lib/venues.ts');
const { YACHT_IDS } = await import('../lib/yachts.ts');
const { READING_VIEWPORT } = await import('../lib/no-zoom.ts');
const { dailyRace } = await import('../lib/race.ts');
const faq = await import('../app/[lang]/faq/page.tsx');
const help = await import('../app/[lang]/help/page.tsx');
const iyt = await import('../app/[lang]/iyt/page.tsx');
const social = await import('../app/[lang]/social/page.tsx');
const sponsorship = await import('../app/[lang]/sponsorship/page.tsx');

const LANGS = ['en', 'ru'];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const props = (lang) => ({ params: Promise.resolve({ lang }) });
const html = async (mod, lang) => renderToStaticMarkup(await mod.default(props(lang)));
const ldOf = (h) => JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(h)[1]);
const idsOf = (h) => [...h.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);

// each page: its address, share card, and the words its title and heading must have in each language
const PAGES = [
  { name: 'faq', mod: faq, path: '/faq', card: 'faq', title: ['Sailing game FAQ: today’s race, controls, rules', 'Вопросы о парусной игре: гонка дня, управление, правила'], h1: ['FAQ', 'Вопросы и ответы'] },
  { name: 'help', mod: help, path: '/help', card: 'help', title: ['How to play: controls and racing rules', 'Как играть: управление и правила гонок'], h1: ['How to play', 'Как играть'] },
  { name: 'iyt', mod: iyt, path: '/iyt', card: 'iyt', title: ['Sailing certification exam practice', 'Тренажёр к экзамену на яхтенный сертификат'], h1: ['Prepare for your sailing certification exam for free', 'Подготовьтесь к экзамену на яхтенный сертификат бесплатно'] },
  { name: 'social', mod: social, path: '/social', card: 'social', title: ['Social media', 'Соцсети'], h1: ['Social media', 'Соцсети'] },
  { name: 'sponsorship', mod: sponsorship, path: '/sponsorship', card: 'sponsorship', title: ['Sponsor a sailing race game', 'Спонсорство парусной игры'], h1: ['Your brand in the race', 'Ваш бренд в гонке'] },
];

for (const { name, mod, path, card, title, h1 } of PAGES) {
  LANGS.forEach((lang, L) => {
    test(`/${name} (${lang}) opens with its heading, in the page's language, between the site's header and footer`, async () => {
      const h = await html(mod, lang);
      assert.ok(h.includes(`<h1 class="hm-ph-h">${esc(h1[L])}</h1>`), 'its heading');
      assert.equal(h.match(/<h1[ >]/g).length, 1, 'one heading');
      assert.match(h, new RegExp(`<div class="scr [^"]*" lang="${lang}"`));
      assert.match(h, /<header|<nav/);
      assert.match(h, /<footer/);
      const ids = idsOf(h);
      assert.equal(ids.length, new Set(ids).size, `no id twice: ${ids.filter((x, i) => ids.indexOf(x) !== i)}`);
    });

    test(`/${name} (${lang}) has its title, canonical address, languages and share card`, async () => {
      const m = await mod.generateMetadata(props(lang));
      const url = lang === 'ru' ? `${path}?lang=ru` : path;
      assert.equal(m.title, title[L]);
      assert.ok(m.description.length > 50, 'a description to show in search');
      assert.equal(m.alternates.canonical, url);
      assert.deepEqual(m.alternates.languages, { en: path, ru: `${path}?lang=ru`, es: `${path}?lang=es`, de: `${path}?lang=de`, tr: `${path}?lang=tr`, 'x-default': path });
      assert.equal(m.openGraph.url, url);
      assert.equal(m.openGraph.title, `${title[L]} · Up and down`);
      assert.equal(m.openGraph.locale, lang === 'ru' ? 'ru_RU' : 'en_GB');
      assert.equal(m.openGraph.images[0].url, `/og/page/${card}?lang=${lang}`);
      assert.equal(m.twitter.images[0].url, `/og/page/${card}?lang=${lang}`);
      assert.equal(m.robots, undefined, 'open to search');
    });
  });

  test(`/${name} says different things in each language`, async () => {
    const [en, ru] = await Promise.all(LANGS.map((l) => mod.generateMetadata(props(l))));
    assert.notEqual(en.description, ru.description);
    assert.match(ru.description, /[а-яё]/i);
    assert.doesNotMatch(en.description, /[а-яё]/i);
    assert.notEqual(await html(mod, 'en'), await html(mod, 'ru'));
  });

  test(`/${name} is a page a reader can zoom`, () => assert.deepEqual(mod.viewport, READING_VIEWPORT));

  test(`/${name} refuses a language the site doesn't have`, async () => {
    await assert.rejects(html(mod, 'fr'), (e) => e.kind === 'notFound');
    await assert.rejects(mod.generateMetadata(props('fr')), (e) => e.kind === 'notFound');
  });
}

// ---------- the questions ----------
for (const lang of LANGS) {
  const groups = faqGroups(tx(lang)), items = groups.flatMap((g) => g.items);

  test(`/faq (${lang}) has every question and answer under its group, and a chip for each group`, async () => {
    const h = await html(faq, lang);
    for (const g of groups) {
      assert.ok(h.includes(`id="q-${g.id}"`), g.id);
      assert.ok(h.includes(`href="#q-${g.id}"`), `${g.id}: its chip`);
      assert.match(h, new RegExp(`${esc(g.title)}<span class="td">${g.items.length}</span>`), `${g.id}: its count`);
    }
    for (const f of items) {
      assert.ok(h.includes(esc(f.q)), f.q);
      assert.ok(h.includes(esc(f.a)), `${f.id}: its answer`);
    }
  });

  test(`/faq (${lang}) gives search engines every question with its answer`, async () => {
    const ld = ldOf(await html(faq, lang));
    assert.equal(ld['@type'], 'FAQPage');
    assert.equal(ld.inLanguage, lang);
    assert.deepEqual(ld.mainEntity, items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })));
  });
}

test('no question is asked twice', () => {
  const ids = faqGroups(tx('en')).flatMap((g) => g.items.map((f) => f.id));
  assert.equal(ids.length, new Set(ids).size);
});

const todayWhat = (lang) => faqGroups(tx(lang)).flatMap((g) => g.items).find((f) => f.id === 'today-what').a;

test('the questions count all the venues, in English', () => {
  assert.ok(todayWhat('en').includes(`one of ${VENUES.length} famous regatta venues`));
});

test('the questions count all the venues, in Russian', () => {
  assert.ok(todayWhat('ru').includes(`одна из ${VENUES.length} знаменитых`));
});

test('the questions say how many boats you race today', () => {
  assert.equal(dailyRace().fleet - 1, 4, 'the rivals in today\'s race');
  assert.ok(!todayWhat('en').includes('against five boats'));
  assert.ok(!todayWhat('ru').includes('против пяти лодок'));
});

// ---------- How to play ----------
test('/help has the parts a player comes to it for, in each language', async () => {
  const en = await html(help, 'en'), ru = await html(help, 'ru');
  for (const words of ['Wind ring', 'Start clock and flags', 'Port keeps clear of starboard', 'Rule 10']) assert.ok(en.includes(words), words);
  for (const words of ['Кольцо ветра', 'Часы старта и флаги', 'Левый галс уступает правому', 'Правило 10']) assert.ok(ru.includes(words), words);
});

test('/help names the sections its contents link to', async () => {
  const h = await html(help, 'en');
  const links = [...h.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
  assert.ok(links.length >= 5, 'a table of contents');
  for (const id of links) assert.ok(h.includes(`id="${id}"`), `#${id} is on the page`);
});

// ---------- the exam trainer ----------
for (const lang of LANGS) {
  const t = tx(lang), n = (v) => v.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB');

  test(`/iyt (${lang}) lists every level with how many questions it has`, async () => {
    const h = await html(iyt, lang);
    for (const l of IYT_LEVELS) {
      assert.ok(h.includes(esc(t(...l.name))), l.name[0]);
      assert.ok(h.includes(esc(t(...l.text))), `${l.name[0]}: what it covers`);
      assert.ok(h.includes(n(l.n)), `${l.name[0]}: its questions`);
    }
    assert.ok(h.includes(n(IYT_TOTAL)), 'the sum of them');
  });
}

test('/iyt opens the trainer in Telegram, and in the browser in the reader\'s language', async () => {
  const en = await html(iyt, 'en'), ru = await html(iyt, 'ru');
  for (const h of [en, ru]) assert.ok(h.includes('href="https://t.me/iyt_test_bot?startapp"'));
  assert.ok(en.includes('href="https://iyt.rycrentals.com/"'));
  assert.ok(ru.includes('href="https://iyt.rycrentals.com/ru"'));
  assert.ok(en.includes('https://www.rycrentals.com/en/deals'));
  assert.ok(ru.includes('https://www.rycrentals.com/deals'));
});

test('/iyt describes the trainer as a free web application', async () => {
  const ld = ldOf(await html(iyt, 'en'));
  assert.equal(ld['@type'], 'WebApplication');
  assert.equal(ld.offers.price, '0');
});

// ---------- the channels ----------
for (const lang of LANGS) {
  test(`/social (${lang}) links every channel, opening apart from the site`, async () => {
    const h = await html(social, lang);
    assert.ok(CHANNELS.length > 0);
    for (const c of CHANNELS) {
      assert.ok(h.includes(`href="${c.url}" target="_blank" rel="noopener"`), c.url);
      assert.ok(h.includes(esc(c.handle)), c.handle);
      assert.ok(h.includes(esc(c.what[lang === 'ru' ? 1 : 0])), `${c.handle}: what it posts`);
    }
  });
}

test('/social says which language a channel posts in, in the reader\'s words', async () => {
  const c = CHANNELS[0];
  const words = { ru: ['In Russian', 'На русском'], en: ['In English', 'На английском'], both: ['In English and Russian', 'На русском и английском'] }[c.lang];
  assert.ok((await html(social, 'en')).includes(`${c.name} · ${words[0]}`));
  assert.ok((await html(social, 'ru')).includes(`${c.name} · ${words[1]}`));
});

// ---------- sponsorship ----------
test('/sponsorship counts the venues and yachts the game really has', async () => {
  const h = await html(sponsorship, 'en');
  assert.ok(h.includes(`one of the game’s ${VENUES.length} venues`));
  assert.ok(h.includes(String(YACHT_IDS.length)));
});

test('/sponsorship sends a sponsor to the racing contact', async () => {
  for (const lang of LANGS) {
    const h = await html(sponsorship, lang);
    assert.ok((h.match(/href="https:\/\/t\.me\/fullcrimp" target="_blank" rel="noopener"/g) || []).length >= 3, `${lang}: at the top, at the package and at the foot`);
    assert.ok(h.includes('href="#options"') && h.includes('id="options"'), `${lang}: See the options goes to the options`);
  }
});

test('/sponsorship offers every sail at the venues a sponsor chooses, with pictures of the game that exist', async () => {
  const { existsSync } = await import('node:fs');
  for (const lang of LANGS) {
    const h = await html(sponsorship, lang);
    assert.ok(h.includes('sp-opt-wide'), `${lang}: the venue set's card`);
    for (const pic of h.match(/sp-[a-z-]+-v\d\.jpg/g) || []) assert.ok(existsSync(new URL(`../public/images/${pic}`, import.meta.url)), `${lang}: ${pic}`);
  }
  const en = await html(sponsorship, 'en');
  assert.ok(en.includes('All the sails at your venues') && en.includes(`Any of the ${VENUES.length}`));
  for (const pic of ['sp-flock-v3', 'sp-flock-side-v4', 'sp-jib-v3', 'sp-main-v3', 'sp-fleet-v3']) assert.ok(en.includes(pic), pic);
});
