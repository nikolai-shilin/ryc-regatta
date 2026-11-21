// What search engines and browsers are told about the site as a whole: the sitemap, robots.txt, the web app manifest and
// the icons, and, over every page in both languages, that titles and addresses agree with the sitemap and that no link
// leads nowhere. Run: node --test test/pages-seo.test.mjs
import { mock, ROOT, exists } from './load.mjs';
import { test, mock as clock } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

clock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 18, 12) });
process.chdir(ROOT);
mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');
mock('next/server', 'export const connection = async () => {};');
mock('next/image', `import { createElement } from 'react';
export const getImageProps = ({ fill, priority, ...p }) => ({ props: { ...p, srcSet: p.src } });
export default function Image({ fill, priority, ...p }) { return createElement('img', p); }`);
let user = null;
globalThis.__sb = { auth: { getUser: async () => ({ data: { user } }), getClaims: async () => ({ data: null }), getSession: async () => ({ data: { session: null } }) }, rpc: async () => ({ data: false }), from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) };
globalThis.fetch = async () => new Response('{}', { status: 503 });

const DAY = '2026-11-18', SITE = 'https://www.sailupdown.com';
const { GUIDES, GUIDE_DATES } = await import('../lib/guides.ts');
const { VENUES } = await import('../lib/venues.ts');
const { YACHT_IDS } = await import('../lib/yachts.ts');
const { PAGES_DATE } = await import('../lib/venue-guides.ts');
const { glossary } = await import('../lib/glossary.ts');
const { tx } = await import('../lib/lang.ts');
const sitemap = (await import('../app/sitemap.ts')).default;
const robots = (await import('../app/robots.ts')).default;
const manifest = (await import('../app/manifest.ts')).default;
const icon = await import('../app/icon.tsx');
const appleIcon = await import('../app/apple-icon.tsx');

const entries = sitemap();
const urls = entries.map((e) => e.url);
const langOf = (u) => (/\?lang=(ru|es|de|tr|fr|it|pt)$/.exec(u) || [, 'en'])[1];
const paths = (lang) => urls.filter((u) => langOf(u) === lang).map((u) => u.slice(SITE.length).replace(/\?lang=(ru|es|de|tr|fr|it|pt)$/, ''));

const PUBLIC = ['/', '/race', '/race/drills', '/race/free', '/help', '/help/race', '/faq', '/boat', '/yachts', '/venues', '/players', '/iyt', '/social', '/sponsorship', '/learn', '/learn/glossary', '/rulebook',
  ...GUIDES.map((g) => `/learn/${g}`), ...VENUES.map((v) => `/venues/${v.id}`), ...YACHT_IDS.map((y) => `/yachts/${y}`),
  '/dictionary', ...glossary(tx('en')).map((x) => `/dictionary/${x.id}`)];

// ---------- the sitemap ----------
test('the sitemap lists every public page in English', () => assert.deepEqual([...paths('en')].sort(), [...PUBLIC].sort()));
test('the sitemap lists every public page in Russian', () => assert.deepEqual([...paths('ru')].sort(), [...PUBLIC].sort()));
test('the sitemap lists every public page in Spanish', () => assert.deepEqual([...paths('es')].sort(), [...PUBLIC].sort()));
test('the sitemap lists every public page in German', () => assert.deepEqual([...paths('de')].sort(), [...PUBLIC].sort()));
test('the sitemap lists every public page in Turkish', () => assert.deepEqual([...paths('tr')].sort(), [...PUBLIC].sort()));
test('the sitemap lists every public page in French', () => assert.deepEqual([...paths('fr')].sort(), [...PUBLIC].sort()));
test('the sitemap lists every public page in Italian', () => assert.deepEqual([...paths('it')].sort(), [...PUBLIC].sort()));
test('the sitemap lists every public page in Portuguese', () => assert.deepEqual([...paths('pt')].sort(), [...PUBLIC].sort()));

test('the sitemap lists no address twice', () => assert.equal(new Set(urls).size, urls.length));

test('every address in the sitemap is on the site itself', () => {
  for (const u of urls) assert.ok(u === `${SITE}/` || u.startsWith(`${SITE}/`), u);
});

for (const bad of ['/admin', '/auth', '/sign-in', '/settings', '/match', '/race/result', '/play', '/lang', '/sponsor', '/connect', '/push', '/og']) {
  test(`the sitemap has nothing at or under ${bad}`, () => {
    assert.deepEqual(urls.map((u) => u.slice(SITE.length)).filter((p) => p === bad || p.startsWith(`${bad}/`) || p.startsWith(`${bad}?`)), []);
  });
}

test('the sitemap ties each page\'s languages together, with absolute addresses', () => {
  for (const e of entries) {
    const path = e.url.slice(SITE.length).replace(/\?lang=(ru|es|de|tr|fr|it|pt)$/, '');
    assert.deepEqual(e.alternates.languages, { en: SITE + path, ru: `${SITE}${path}?lang=ru`, es: `${SITE}${path}?lang=es`, de: `${SITE}${path}?lang=de`, tr: `${SITE}${path}?lang=tr`, fr: `${SITE}${path}?lang=fr`, it: `${SITE}${path}?lang=it`, pt: `${SITE}${path}?lang=pt`, 'x-default': SITE + path }, e.url);
  }
});

test('the pages that change every day say today', () => {
  for (const path of ['/', '/race', '/players']) for (const u of [SITE + path, `${SITE}${path}?lang=ru`]) {
    const e = entries.find((x) => x.url === u);
    assert.equal(e.lastModified, DAY, u);
    assert.equal(e.changeFrequency, 'daily', u);
  }
});

test('a guide\'s date in the sitemap is when it last changed, and a venue\'s and a yacht\'s when their pages were written', () => {
  for (const g of GUIDES) assert.equal(entries.find((e) => e.url === `${SITE}/learn/${g}`).lastModified, GUIDE_DATES[g].modified, g);
  assert.equal(entries.find((e) => e.url === `${SITE}/venues/${VENUES[0].id}`).lastModified, PAGES_DATE);
  assert.equal(entries.find((e) => e.url === `${SITE}/yachts/${YACHT_IDS[0]}`).lastModified, PAGES_DATE);
  assert.equal(entries.find((e) => e.url === `${SITE}/venues/${VENUES[0].id}`).changeFrequency, 'weekly');
});

test('a page with no known date claims none', () => {
  for (const path of ['/help', '/faq', '/boat', '/iyt']) assert.equal(entries.find((e) => e.url === SITE + path).lastModified, undefined, path);
});

test('the home page ranks first, and every priority is one a sitemap can have', () => {
  assert.equal(entries.find((e) => e.url === `${SITE}/`).priority, 1);
  for (const e of entries) assert.ok(e.priority > 0 && e.priority <= 1, e.url);
});

// ---------- robots.txt ----------
const rules = robots().rules;
// as a crawler reads it: the longest rule that matches wins, a tie goes to allow, $ ties a rule to the address's end
const crawlable = (path) => {
  const hit = (rule) => (rule.endsWith('$') ? path === rule.slice(0, -1) : path.startsWith(rule));
  const allow = [rules.allow].flat().filter(hit), deny = rules.disallow.filter(hit);
  const len = (a) => Math.max(-1, ...a.map((r) => r.length));
  return len(allow) >= len(deny);
};

test('robots.txt speaks to every crawler and names the sitemap', () => {
  assert.equal(rules.userAgent, '*');
  assert.equal(robots().sitemap, `${SITE}/sitemap.xml`);
});

for (const path of ['/auth/callback', '/auth/sign-out', '/auth/telegram', '/lang', '/lang?to=ru', '/sponsor', '/match/K7M2QZ', '/match/new', '/call/K7M2QZ']) {
  test(`robots.txt keeps crawlers off ${path}`, () => assert.equal(crawlable(path), false));
}

for (const path of PUBLIC) {
  test(`robots.txt lets crawlers read ${path}`, () => assert.equal(crawlable(path), true));
}

test('robots.txt blocks the game\'s ad feed and not the sponsorship page', () => {
  assert.equal(crawlable('/sponsor'), false);
  assert.equal(crawlable('/sponsorship'), true);
});

test('the private pages crawlers may read carry a noindex they can see', async () => {
  for (const [path, file] of [['/admin', 'admin/page.tsx'], ['/admin/players', 'admin/players/page.tsx'], ['/settings', 'settings/page.tsx'], ['/sign-in', 'sign-in/page.tsx']]) {
    assert.equal(crawlable(path), true, `${path}: blocked, its noindex would never be read`);
    const m = await (await import(join(ROOT, 'app/[lang]', file))).generateMetadata({ params: Promise.resolve({ lang: 'en' }) });
    assert.deepEqual(m.robots, { index: false, follow: true }, path);
  }
});

// ---------- the manifest and the icons ----------
test('the manifest installs the game under its name, opening at home', () => {
  const m = manifest();
  assert.equal(m.short_name, 'Up and down');
  assert.match(m.name, /^Up and down/);
  assert.equal(m.start_url, '/');
  assert.equal(m.scope, '/');
  assert.equal(m.display, 'standalone');
  assert.match(m.theme_color, /^#[0-9a-f]{6}$/);
  assert.ok(m.description.length > 20);
});

test('the manifest\'s icons are the ones the site draws, at their own sizes', () => {
  const [big, apple] = manifest().icons;
  assert.deepEqual([big.src, big.sizes, big.type], ['/icon', `${icon.size.width}x${icon.size.height}`, icon.contentType]);
  assert.deepEqual([apple.src, apple.sizes, apple.type], ['/apple-icon', `${appleIcon.size.width}x${appleIcon.size.height}`, appleIcon.contentType]);
});

for (const [name, mod, px] of [['the icon', icon, 512], ['the Apple icon', appleIcon, 180]]) {
  test(`${name} is the logo as a square PNG of ${px} px`, async () => {
    assert.deepEqual(mod.size, { width: px, height: px });
    assert.equal(mod.contentType, 'image/png');
    const img = await mod.default();
    assert.deepEqual(img.options, { width: px, height: px });
    assert.equal(img.element.type, 'img');
    assert.equal(img.element.props.width, px);
    assert.match(img.element.props.src, /^data:image\/svg\+xml;base64,[A-Za-z0-9+/]+=*$/);
    assert.match(Buffer.from(img.element.props.src.split(',')[1], 'base64').toString(), /<svg/);
  });
}

// ---------- every page, in both languages ----------
const pagesDir = join(ROOT, 'app/[lang]');
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : f === 'page.tsx' ? [p] : []; });
const RACE = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
// the addresses to try of each page: its dynamic parts filled in with every value it is built for
const instances = (route) => {
  if (route === '/learn/[slug]') return GUIDES.map((slug) => [`/learn/${slug}`, { slug }]);
  if (route === '/venues/[id]') return VENUES.map((v) => [`/venues/${v.id}`, { id: v.id }]);
  if (route === '/yachts/[id]') return YACHT_IDS.map((id) => [`/yachts/${id}`, { id }]);
  if (route === '/dictionary/[term]') return glossary(tx('en')).map((x) => [`/dictionary/${x.id}`, { term: x.id }]);
  if (route === '/match/[code]') return [['/match/K7M2QZ', { code: 'K7M2QZ' }]];
  if (route === '/call/[code]') return [['/call/K7M2QZ', { code: 'K7M2QZ' }]];
  if (route === '/race/rating/[day]') return [['/race/rating/2026-11-17', { day: '2026-11-17' }]];
  if (route === '/race/result/[id]') return [[`/race/result/${RACE}`, { id: RACE }]];
  assert.ok(!route.includes('['), `${route}: a dynamic page this file doesn't know`);
  return [[route, {}]];
};
const SIGNED_IN = { id: 'u', email: 'a@example.com', user_metadata: { display_name: 'Anna' }, app_metadata: {} };
const sweep = [];
for (const file of walk(pagesDir)) {
  const route = `/${relative(pagesDir, file).replace(/\/?page\.tsx$/, '')}`;
  const mod = await import(file);
  for (const [path, params] of instances(route)) for (const lang of ['en', 'ru']) {
    const props = { params: Promise.resolve({ lang, ...params }), searchParams: Promise.resolve(path === '/sign-in/code' ? { email: 'a@example.com' } : {}) };
    user = path === '/sign-in/name' ? SIGNED_IN : null;
    const meta = await mod.generateMetadata(props);
    const html = renderToStaticMarkup(await mod.default(props));
    sweep.push({ route, path, lang, meta, html });
  }
}
user = null;
const indexed = sweep.filter((p) => p.meta.robots?.index !== false);

test('every page was opened, in both languages', () => {
  assert.equal(new Set(sweep.map((p) => p.route)).size, 42); // (42: /race/month, your month day by day)
  assert.equal(sweep.length % 2, 0);
});

test('every page open to search is in the sitemap, and nothing else is', () => {
  assert.deepEqual([...new Set(indexed.map((p) => p.path))].sort(), [...PUBLIC].sort());
});

test('every page open to search names its own canonical address, the one the sitemap gives', () => {
  for (const p of indexed) {
    const url = p.lang === 'ru' ? `${p.path}?lang=ru` : p.path;
    assert.equal(p.meta.alternates?.canonical, url, `${p.path} ${p.lang}`);
    assert.ok(urls.includes(SITE + url), `${url} is in the sitemap`);
    assert.deepEqual(p.meta.alternates.languages, { en: p.path, ru: `${p.path}?lang=ru`, es: `${p.path}?lang=es`, de: `${p.path}?lang=de`, tr: `${p.path}?lang=tr`, fr: `${p.path}?lang=fr`, it: `${p.path}?lang=it`, pt: `${p.path}?lang=pt`, 'x-default': p.path }, p.path);
    assert.equal(p.meta.openGraph.url, url, `${p.path}: its share link`);
  }
});

test('a page kept out of search has no canonical address', () => {
  const hidden = sweep.filter((p) => p.meta.robots?.index === false);
  assert.ok(hidden.length > 0);
  for (const p of hidden) assert.equal(p.meta.alternates, undefined, p.path);
});

test('every page open to search has a title and a description in its language', () => {
  for (const p of indexed) {
    const title = typeof p.meta.title === 'string' ? p.meta.title : p.meta.title.absolute;
    assert.ok(title.length >= 5, `${p.path}: title`);
    assert.ok(p.meta.description?.length >= 50, `${p.path}: description`);
    if (p.lang === 'ru') assert.match(p.meta.description, /[а-яё]/i, `${p.path}: Russian`);
    else assert.doesNotMatch(p.meta.description, /[а-яё]/i, `${p.path}: English`);
  }
});

test('no two pages open to search share a title or a description', () => {
  for (const lang of ['en', 'ru']) for (const key of ['title', 'description']) {
    const all = indexed.filter((p) => p.lang === lang).map((p) => JSON.stringify(p.meta[key]));
    assert.deepEqual(all.filter((x, i) => all.indexOf(x) !== i), [], `${key} ${lang}`);
  }
});

test('every page has a share picture of the size the chat apps want', () => {
  for (const p of sweep) {
    const img = p.meta.openGraph.images[0];
    assert.ok(img.url, p.path);
    if (img.width) assert.deepEqual([img.width, img.height], [1200, 630], p.path);
    assert.equal(p.meta.twitter.card, 'summary_large_image', p.path);
  }
});

test('every page says which language it is in', () => {
  for (const p of sweep) {
    const openers = [...p.html.matchAll(/<div class="scr [^"]*" lang="(en|ru)"/g)].map((m) => m[1]);
    assert.ok(openers.includes(p.lang), `${p.path} ${p.lang}`);
    assert.ok(!openers.some((l) => l !== p.lang), `${p.path}: no other language`);
  }
});

test('the structured data on every page can be read, and stays inside its script tag', () => {
  let n = 0;
  for (const p of sweep) for (const m of p.html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    const ld = JSON.parse(m[1]);
    assert.equal(ld['@context'], 'https://schema.org', p.path);
    n++;
  }
  assert.ok(n > 100, 'the pages that have it were all read');
});

// ---------- every link ----------
const unesc = (s) => s.replace(/&amp;/g, '&').replace(/&#x27;/g, "'");
const hrefs = (html) => [...html.matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)].map((m) => unesc(m[1]));
const ROUTES = [...new Set(sweep.map((p) => p.route))].map((r) => [r, new RegExp(`^${r.replace(/\[[^\]]+\]/g, '[^/]+')}$`)]);
const SERVED = new Set(['/play', '/lang', '/sponsor', '/auth/sign-out', '/llms.txt', '/llms-full.txt', '/sitemap.xml', '/robots.txt']); // by route handlers and next.config.ts
const known = { '/learn/': GUIDES, '/venues/': VENUES.map((v) => v.id), '/yachts/': YACHT_IDS };

function missing(path) {
  if (SERVED.has(path) || exists(`public${path}`)) return false;
  for (const [prefix, ids] of Object.entries(known)) {
    if (path.startsWith(prefix) && path !== '/learn/glossary') return !ids.includes(path.slice(prefix.length));
  }
  return !ROUTES.some(([, re]) => re.test(path));
}

test('the link check below can tell a page that exists from one that does not', () => {
  for (const path of ['/', '/race', '/learn/sail', '/learn/glossary', '/venues/cowes', '/yachts/j70', '/race/rating/2026-11-17', '/play', '/images/og-v10.jpg']) assert.equal(missing(path), false, path);
  for (const path of ['/nope', '/learn/nope', '/venues/atlantis', '/yachts/titanic', '/race/nope', '/admin/nope']) assert.equal(missing(path), true, path);
});

test('every link on the site goes to a page that exists', () => {
  const dead = new Set();
  for (const p of sweep) for (const h of hrefs(p.html)) {
    if (!h.startsWith('/') || h.startsWith('//')) continue;
    const path = h.split(/[?#]/)[0];
    if (missing(path)) dead.add(`${p.path} -> ${h}`);
  }
  assert.deepEqual([...dead], []);
});

test('every link to a place on a page finds that place', () => {
  const page = new Map(sweep.filter((p) => p.lang === 'en').map((p) => [p.path, p.html]));
  const dead = new Set();
  for (const p of sweep.filter((x) => x.lang === 'en')) for (const h of hrefs(p.html)) {
    if (!h.includes('#')) continue;
    const [to, id] = h.split('#');
    const target = to === '' ? p.html : to.startsWith('/') ? page.get(to.split('?')[0]) : undefined;
    if (target !== undefined && id && !target.includes(`id="${id}"`)) dead.add(`${p.path} -> ${h}`);
  }
  assert.deepEqual([...dead], []);
});

test('no page links to the site by its full address, or out over plain http', () => {
  const bad = new Set();
  for (const p of sweep) for (const h of hrefs(p.html)) if (h.startsWith('http://') || h.startsWith(SITE)) bad.add(`${p.path} -> ${h}`);
  assert.deepEqual([...bad], []);
});
