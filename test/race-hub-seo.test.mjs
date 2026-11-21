// The race hub for search and AI engines: its heading says what the page is (today's sailing race at the venue, the
// first words read to a screen reader and a crawler alone), and its data gives the trail and today's race as an online
// sailing event for the UTC day, in the reader's language. Run: node --test test/race-hub-seo.test.mjs
import { mock } from './load.mjs';
import { test, mock as clock } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

clock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 18, 12) });
mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');
mock('next/server', 'export const connection = async () => {};');
globalThis.__sb = { auth: { getUser: async () => ({ data: { user: null } }) } };
globalThis.fetch = async () => { throw new Error('the scores API is down'); };

const { dailyRace } = await import('../lib/race.ts');
const { venueOf } = await import('../lib/venues.ts');
const hub = await import('../app/[lang]/race/page.tsx');
const SITE = 'https://www.sailupdown.com';
const page = async (lang) => renderToStaticMarkup(await hub.default({ params: Promise.resolve({ lang }) }));
const ldOf = (h) => JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(h)[1]);
const text = (s) => s.replace(/<[^>]+>/g, '').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

test('the hub’s heading names today’s sailing race and its venue', async () => {
  const v = venueOf(dailyRace().venue);
  const h1 = (h) => text(/<h1[^>]*>(.*?)<\/h1>/s.exec(h)[1]);
  assert.equal(h1(await page('en')), `Today’s sailing race: ${v.name[0]} ${v.nation}`);
  assert.equal(h1(await page('ru')), `Парусная гонка дня: ${v.name[1]} ${v.nation}`);
  assert.match(await page('en'), /<h1 class="bt-h bt-hero"><span class="vh">/, 'the words before the venue are for readers who can’t see the label over it');
});

test('the hub’s data: the trail, and today’s race as an online sailing event open to all for the UTC day', async () => {
  const d = dailyRace(), v = venueOf(d.venue);
  for (const [lang, q, name] of [['en', '', `Today’s race: ${v.name[0]}`], ['ru', '?lang=ru', `Гонка дня: ${v.name[1]}`]]) {
    const [crumbs, ev] = ldOf(await page(lang));
    assert.equal(crumbs['@type'], 'BreadcrumbList');
    assert.deepEqual(crumbs.itemListElement.map((x) => x.item), [`${SITE}/${q}`, `${SITE}/race${q}`]);
    assert.equal(ev['@type'], 'SportsEvent');
    assert.equal(ev.name, name);
    assert.equal(ev.sport, 'Sailing');
    assert.equal(ev.inLanguage, lang);
    assert.equal(ev.startDate, `${d.day}T00:00:00Z`);
    assert.equal(ev.endDate, `${d.day}T23:59:59Z`);
    assert.equal(ev.eventAttendanceMode, 'https://schema.org/OnlineEventAttendanceMode');
    assert.deepEqual(ev.location, { '@type': 'VirtualLocation', url: `${SITE}/race${q}` });
    assert.equal(ev.isAccessibleForFree, true);
    assert.equal(ev.offers.price, 0);
    assert.equal(ev.organizer.name, 'RYC');
    assert.ok(ev.description.includes(lang === 'ru' ? v.about[1] : v.about[0]));
  }
});
