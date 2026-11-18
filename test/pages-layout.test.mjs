// The frame round every page: the root layout, its metadata, the script in its <head> (run here against a stand-in for
// the browser), the viewport each page asks for, and the site's 404. Run: node --test test/pages-layout.test.mjs
import { mock, ROOT } from './load.mjs';
import { test, mock as clock } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

clock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 18, 12) });
mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');
mock('next/server', 'export const connection = async () => {};');
mock('next/image', `import { createElement } from 'react';
export const getImageProps = ({ fill, priority, ...p }) => ({ props: p });
export default function Image({ fill, priority, ...p }) { return createElement('img', p); }`);

const layout = await import('../app/[lang]/layout.tsx');
const notFoundPage = await import('../app/global-not-found.tsx');
const { READING, READING_VIEWPORT } = await import('../lib/no-zoom.ts');

const props = (lang) => ({ params: Promise.resolve({ lang }) });
const page = async (lang) => renderToStaticMarkup(await layout.default({ ...props(lang), children: createElement('main', { id: 'the-page' }, 'hello') }));
const headScript = (h) => /<head><script>(.*?)<\/script>/s.exec(h)[1];

// ---------- a stand-in for the browser, as much of it as the head script reads ----------
function browser({ cookie = '', hash = '', pathname = '/race', search = '', local = {}, session = {} } = {}) {
  const attrs = new Map(), style = new Map(), listeners = [], replaced = [];
  const store = (o) => ({ getItem: (k) => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, key: (i) => Object.keys(o)[i] ?? null, get length() { return Object.keys(o).length; } });
  const context = vm.createContext({
    URLSearchParams, atob, TextDecoder, Uint8Array,
    location: { hash, pathname, search },
    history: { state: { kept: true }, replaceState: (...a) => replaced.push(a) },
    localStorage: store(local), sessionStorage: store(session),
    document: { cookie, addEventListener: (type) => listeners.push(type),
      documentElement: { setAttribute: (k, v) => attrs.set(k, v), removeAttribute: (k) => attrs.delete(k), style: { setProperty: (k, v) => style.set(k, v), removeProperty: (k) => style.delete(k) } } },
    addEventListener: (type) => listeners.push(type),
  });
  return { context, attrs, style, listeners, replaced, session, run: (src) => vm.runInContext(src, context) };
}
const b64url = (s) => Buffer.from(s).toString('base64url');
const SESSION = `sb-abcdefgh-auth-token=base64-${b64url(JSON.stringify({ access_token: 'x.y.z', user: { email: 'anna@example.com', user_metadata: { display_name: 'Anna Petrova' } } }))}`;

// ---------- the layout ----------
test('both languages are built at deploy, and no others', () => {
  assert.deepEqual(layout.generateStaticParams(), [{ lang: 'en' }, { lang: 'ru' }]);
});

test('the layout marks the page\'s language and holds the page', async () => {
  for (const lang of ['en', 'ru']) {
    const h = await page(lang);
    assert.match(h, new RegExp(`^<html lang="${lang}"`));
    assert.ok(h.includes('<main id="the-page">hello</main>'));
  }
});

test('the layout refuses a language the site does not have', async () => {
  await assert.rejects(page('de'), (e) => e.kind === 'notFound');
  await assert.rejects(layout.generateMetadata(props('de')), (e) => e.kind === 'notFound');
});

test('every page starts from the site\'s name, its address and its icons', async () => {
  const [en, ru] = await Promise.all(['en', 'ru'].map((l) => layout.generateMetadata(props(l))));
  assert.equal(String(en.metadataBase), 'https://www.sailupdown.com/');
  assert.deepEqual(en.title, { default: 'Up and down — a free online sailing race game', template: '%s · Up and down' });
  assert.deepEqual(ru.title, { default: 'Up and down — парусная гонка и симулятор яхты онлайн', template: '%s · Up and down' });
  assert.notEqual(en.description, ru.description);
  assert.equal(en.applicationName, 'Up and down');
  assert.equal(en.icons.apple[0].url, '/apple-icon');
  assert.deepEqual(en.icons.icon.map((i) => i.url), ['/favicon.ico', '/icon']);
  assert.equal(en.openGraph.locale, 'en_GB');
  assert.equal(ru.openGraph.locale, 'ru_RU');
});

test('the search consoles\' ownership codes come from the environment, and only when set', async () => {
  const keys = ['GOOGLE_SITE_VERIFICATION', 'YANDEX_VERIFICATION', 'BING_SITE_VERIFICATION'];
  const saved = keys.map((k) => process.env[k]);
  keys.forEach((k) => delete process.env[k]);
  assert.deepEqual((await layout.generateMetadata(props('en'))).verification, {});
  process.env.GOOGLE_SITE_VERIFICATION = 'g-code'; process.env.YANDEX_VERIFICATION = 'y-code'; process.env.BING_SITE_VERIFICATION = 'b-code';
  assert.deepEqual((await layout.generateMetadata(props('en'))).verification, { google: 'g-code', yandex: 'y-code', other: { 'msvalidate.01': 'b-code' } });
  keys.forEach((k, i) => { if (saved[i] === undefined) delete process.env[k]; else process.env[k] = saved[i]; });
});

// ---------- the script in <head> ----------
test('the head script shows a guest as a guest', async () => {
  const b = browser();
  b.run(headScript(await page('en')));
  assert.equal(b.attrs.has('data-me'), false);
  assert.equal(b.style.has('--me-ini'), false);
});

test('the head script marks a signed-in player before the first paint', async () => {
  const b = browser({ cookie: SESSION });
  b.run(headScript(await page('en')));
  assert.equal(b.attrs.has('data-me'), true);
  assert.equal(b.style.get('--me-ini'), '"AP"');
  assert.equal(b.style.get('--me-name'), '"Anna Petrova"');
});

test('the head script survives a session cookie it can\'t read', async () => {
  const b = browser({ cookie: 'sb-abcdefgh-auth-token=base64-@@@not-json' });
  b.run(headScript(await page('en')));
  assert.equal(b.attrs.has('data-me'), false);
});

test('the head script keeps Telegram\'s launch data for the race and takes it off the address', async () => {
  const b = browser({ hash: '#tgWebAppData=abc&tgWebAppVersion=8.0', pathname: '/race', search: '?x=1' });
  b.run(headScript(await page('en')));
  assert.deepEqual(JSON.parse(b.session.__telegram__initParams), { tgWebAppData: 'abc', tgWebAppVersion: '8.0' });
  assert.equal(b.replaced.length, 1);
  assert.equal(b.replaced[0][2], '/race?x=1', 'a copied link carries no launch data');
});

test('the head script leaves any other hash alone', async () => {
  const b = browser({ hash: '#h-today' });
  b.run(headScript(await page('en')));
  assert.equal(b.replaced.length, 0);
  assert.equal(b.session.__telegram__initParams, undefined);
});

test('the head script marks a device that has raced before, and only such a device', async () => {
  const src = headScript(await page('en'));
  const marked = (local) => { const b = browser({ local }); b.run(src); return b.attrs.has('data-back'); };
  assert.equal(marked({}), false);
  assert.equal(marked({ 'regatta-log': JSON.stringify({ d: {} }) }), false);
  assert.equal(marked({ 'regatta-log': 'not json' }), false);
  assert.equal(marked({ 'regatta-log': JSON.stringify({ d: { '2026-11-17': 300 } }) }), true);
  assert.equal(marked({ other: '1', 'regatta-result-abc': '{}' }), true);
});

test('the head script stops the zoom on the 3D screens and leaves it on the reading pages', async () => {
  const src = headScript(await page('en'));
  const stops = (pathname) => { const b = browser({ pathname }); b.run(src); return b.listeners.includes('gesturestart'); };
  for (const path of ['/', '/race', '/yachts', '/venues/cowes']) assert.equal(stops(path), true, path);
  for (const path of ['/learn', '/learn/sail', '/faq', '/help', '/iyt', '/social']) assert.equal(stops(path), false, path);
});

// ---------- the viewport each page asks for ----------
const pagesDir = join(ROOT, 'app/[lang]');
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : f === 'page.tsx' ? [p] : []; });
const routeOf = (f) => `/${relative(pagesDir, f).replace(/\/?page\.tsx$/, '')}`.replace(/\[[^\]]+\]/g, 'x');
const routes = await Promise.all(walk(pagesDir).map(async (f) => ({ path: routeOf(f), reading: (await import(f)).viewport === READING_VIEWPORT })));

test('every page under the reading addresses says it can be zoomed', () => {
  assert.deepEqual(routes.filter((r) => READING.test(r.path) && !r.reading).map((r) => r.path), []);
});

test('a page that says it can be zoomed is not locked by the head script', () => {
  assert.deepEqual(routes.filter((r) => r.reading && !READING.test(r.path)).map((r) => r.path), []);
});

test('the layout\'s own viewport keeps the 3D screens from zooming', () => {
  assert.equal(layout.viewport.userScalable, false);
  assert.equal(layout.viewport.maximumScale, 1);
  assert.equal(layout.viewport.viewportFit, 'cover');
});

// ---------- the 404 ----------
const notFound = async () => renderToStaticMarkup(await notFoundPage.default());
const withLang = (lang) => { globalThis.__request = { cookies: lang === undefined ? {} : { lang } }; };

test('the 404 speaks the language the address was given', async () => {
  withLang('ru');
  const ru = await notFound();
  assert.match(ru, /^<html lang="ru"/);
  assert.ok(ru.includes('Такой страницы нет'));
  withLang('en');
  const en = await notFound();
  assert.match(en, /^<html lang="en"/);
  assert.ok(en.includes('This page isn’t here'));
});

test('the 404 falls back on English for no language or one the site does not have', async () => {
  for (const lang of [undefined, 'de', '']) {
    withLang(lang);
    assert.match(await notFound(), /^<html lang="en"/, String(lang));
  }
});

test('the 404 offers the way back to the race and to home', async () => {
  withLang('en');
  const h = await notFound();
  assert.match(h, /<a href="\/race" class="pill pill-primary pill-s">/);
  assert.match(h, /<a href="\/" class="pill pill-s">/);
});

test('the 404 is titled in its language and kept out of search', async () => {
  withLang('ru');
  assert.deepEqual(await notFoundPage.generateMetadata(), { title: 'Страница не найдена · Up and down', robots: { index: false } });
  withLang('en');
  assert.deepEqual(await notFoundPage.generateMetadata(), { title: 'Page not found · Up and down', robots: { index: false } });
});

test('the 404\'s head script marks a signed-in player, and goes on to stop the zoom', async () => {
  withLang('en');
  const h = await notFound();
  const b = browser({ cookie: SESSION, pathname: '/no-such-page' });
  b.run(headScript(h));
  assert.equal(b.attrs.has('data-me'), true);
  assert.equal(b.listeners.includes('gesturestart'), true);
});
