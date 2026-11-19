// The site's admin: the pictures and words sold on the boats and the plane, today's race and the week ahead, the players'
// table, and the numbers on how the game is played and how it runs, in both languages. npm test.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from './load.mjs';
import { choose, click, clock, dom, done, englishIn, fire, h, hrefs, mount, plain, reset, settle, spyRouter, ssr, type } from './fake-dom.mjs';

mock('app/[lang]/admin/actions.ts', 'export const sponsorChanged = async () => { globalThis.__sponsor = (globalThis.__sponsor || 0) + 1; };');
mock('lib/supabase/server.ts', 'export const getAccount = async () => globalThis.__account ?? null; export const supabaseServer = async () => globalThis.__sb;');

const { BannerForm } = await import('../components/admin-form.tsx');
const { SailPresets } = await import('../components/admin-sails.tsx');
const insight = await import('../components/admin-insight.tsx');
const { PlayersTable } = await import('../components/admin-players-table.tsx');
const { AdminPlayers } = await import('../components/admin-players.tsx');
const { AdminLogs } = await import('../components/admin-logs.tsx');
const { AdminSchedule } = await import('../components/admin-schedule.tsx');
const { ADMIN_PAGES, STAT_DAYS, pickDays, adminTitle, adminLoad, adminRpc, AdminShell, AdminHub, AdminMissing } = await import('../components/admin-shell.tsx');
const { AdminRacing, AdminPerf, Tile, Table, hasStats } = await import('../components/admin-stats.tsx');
const { IconFlag } = await import('../components/ui.tsx');
const { dailyRace, KN, SHAPE_NAME } = await import('../lib/race.ts');
const { venueOf } = await import('../lib/venues.ts');
const { yachtOf } = await import('../lib/yachts.ts');
const { tx } = await import('../lib/lang.ts');

beforeEach(() => { reset(); globalThis.__sponsor = 0; globalThis.__account = null; URL.createObjectURL = () => 'blob:preview'; URL.revokeObjectURL = (u) => { revoked.push(u); }; revoked.length = 0; });
afterEach(done);
const revoked = [];

// a value on a tile, and a table's rows as text
const tile = (html, k) => { const m = new RegExp(`adm-tile-k">${k}</span><b>(.*?)</b>`).exec(html); return m ? plain(m[1]) : null; };
const tableOf = (html, title) => {
  const at = html.indexOf(`<h3 class="adm-tab-h">${title}</h3>`);
  if (at < 0) return null;
  const body = html.slice(at, html.indexOf('</section>', at));
  return [...body.matchAll(/<tr><th scope="row">(.*?)<\/th>(.*?)<\/tr>/g)].map((m) => [plain(m[1]), ...[...m[2].matchAll(/<td>(.*?)<\/td>/g)].map((c) => plain(c[1]))]);
};

// ---------- the sail ads ----------
const fakeSb = ({ uploadError = null, rowError = null } = {}) => {
  const log = [];
  return {
    log,
    storage: { from: (b) => ({
      upload: async (p, f, o) => { log.push(['upload', b, p, o.contentType]); return { error: uploadError }; },
      getPublicUrl: (p) => ({ data: { publicUrl: `https://cdn.test/${p}` } }),
      remove: async (ps) => { log.push(['remove', ...ps]); return {}; },
    }) },
    from: (t) => ({
      upsert: async (r) => { log.push(['upsert', t, r.key, r.value]); return { error: rowError }; },
      delete: () => ({ eq: async (k, v) => { log.push(['delete', t, k, v]); return { error: rowError }; } }),
    }),
  };
};
const PNG = { name: 'logo.png', type: 'image/png', size: 1000 };

// ---------- the plane's banner ----------
test('with no words set the banner reads the game’s own', () => {
  const words = plain(ssr(h(BannerForm, { lang: 'en', current: null })));
  assert.match(words, /RYCRENTALS.COM RENT YACHTS HERE!/);
  assert.doesNotMatch(words, /Back to the RYC banner/);
});

test('the banner shows the words as they are typed, and counts them', async () => {
  const v = await mount(h(BannerForm, { lang: 'en', current: null }));
  await type(v.$('#adm-ban-a'), 'ACME');
  assert.equal(v.$('.adm-ban-a').textContent, 'ACME');
  assert.equal(v.$('.adm-ban-b'), null, 'no red part until there are words for it');
  assert.equal(v.$('.adm-n').textContent, '4/40');
  await type(v.$('#adm-ban-b'), 'SAILS');
  assert.equal(v.$('.adm-ban-b').textContent, 'SAILS');
  assert.equal(v.$('#adm-ban-a').getAttribute('maxlength'), '40');
});

test('there is nothing to save with no words, or the same words', async () => {
  const v = await mount(h(BannerForm, { lang: 'en', current: ['ACME', 'SAILS'] }));
  const save = () => v.$('.pill-primary');
  assert.equal(save().disabled, true);
  await type(v.$('#adm-ban-a'), ' ACME ');
  assert.equal(save().disabled, true, 'spaces round the words change nothing');
  await type(v.$('#adm-ban-a'), 'NEW');
  assert.equal(save().disabled, false);
  await type(v.$('#adm-ban-a'), '  ');
  await type(v.$('#adm-ban-b'), '');
  assert.equal(save().disabled, true);
});

test('saving keeps the trimmed words and tells the game', async () => {
  const router = spyRouter(), sb = fakeSb();
  globalThis.__supabase = sb;
  const v = await mount(h(BannerForm, { lang: 'en', current: null }));
  await type(v.$('#adm-ban-a'), '  ACME ');
  await click(v.$('.pill-primary'));
  assert.deepEqual(sb.log, [['upsert', 'regatta_settings', 'plane_banner', { lines: ['ACME'] }]]);
  assert.equal(globalThis.__sponsor, 1);
  assert.equal(v.$('[role=status]').textContent, 'Saved. The plane tows it from the next race.');
  assert.equal(router.refreshed, 1);
});

test('going back to the RYC banner clears the words', async () => {
  const sb = fakeSb();
  globalThis.__supabase = sb;
  const v = await mount(h(BannerForm, { lang: 'ru', current: ['ACME'] }));
  await click(v.$('.pill-quiet'));
  assert.deepEqual(sb.log, [['delete', 'regatta_settings', 'key', 'plane_banner']]);
  assert.equal(v.$('#adm-ban-a').value, '');
  assert.equal(v.$('[role=status]').textContent, 'Убрано. Со следующей гонки самолёт снова тянет баннер RYC.');
});

test('a banner that can’t be saved says why', async () => {
  globalThis.__supabase = fakeSb({ rowError: { message: 'Nope' } });
  const v = await mount(h(BannerForm, { lang: 'en', current: null }));
  await type(v.$('#adm-ban-a'), 'X');
  await click(v.$('.pill-primary'));
  assert.equal(v.$('[role=alert]').textContent, 'Nope');
  assert.equal(globalThis.__sponsor, 0);
});

test('the Russian banner form is in Russian', () => {
  assert.deepEqual(englishIn(plain(ssr(h(BannerForm, { lang: 'ru', current: ['Слово', 'Ещё'] })))), []);
});

// ---------- the sails: presets in a table, each made or changed in a dialog ----------
const radio = (v, label) => [...v.$$('dialog [role=radio]')].find((b) => b.textContent === label);
const btn = (v, label) => [...v.$$('button')].find((b) => b.textContent === label);
const chip = (v, label) => [...v.$$('.adm-venues [role=checkbox]')].find((b) => b.textContent.split(' · ')[0] === label);
const JIB = { url: 'https://cdn.test/jib/old.png', path: 'jib/old.png' }, KITE = { url: 'https://cdn.test/kite/k.png', path: 'kite/k.png' };
const EVERY = { main: null, jib: JIB, kite: null, colors: { kite: '#222222' } };
const SETS = {
  uk: { name: 'UK', venues: ['cowes', 'weymouth'], main: { url: 'https://cdn.test/main/uk.png', path: 'main/uk.png' }, colors: { jib: 'auto' } },
  turkey: { name: 'Turkey', venues: ['gocek'], kite: KITE, colors: { kite: '#e30a17' } },
};
const presets = (o = {}) => mount(h(SailPresets, { lang: 'en', every: EVERY, sets: SETS, ...o }));
const edit = (v, name) => click(v.$(`[aria-label="Edit ${name}"]`));

test('the presets table: every venue\'s, then each set, with what a set leaves to every venue\'s faded', () => {
  const html = ssr(h(SailPresets, { lang: 'en', every: EVERY, sets: SETS }));
  const rows = [...html.matchAll(/<tr( class="sp-every")?><th scope="row">(.*?)<\/th>(.*?)<\/tr>/g)].map((m) => [m[2], plain(m[3])]);
  assert.deepEqual(rows.map((r) => r[0]), ['Every venue', 'UK', 'Turkey']);
  assert.match(rows[0][1], /^The other 62 /, 'the venues no set has');
  assert.match(rows[1][1], /^Cowes, Weymouth/);
  assert.match(html, /<span class="sp-pic"><img src="https:\/\/cdn.test\/main\/uk.png"/, 'its own picture');
  assert.match(html, /<span class="sp-pic sp-inh" title="As every venue"><img src="https:\/\/cdn.test\/jib\/old.png"/, 'every venue\'s, faded');
  assert.match(rows[0][1], /From the ad .* #222222/, 'every venue\'s colours');
  assert.match(rows[2][1], /#E30A17/);
  assert.match(html, /<span class="sp-dye sp-inh">From the ad/, 'a set\'s jib colour as every venue\'s');
  assert.equal(html.includes('<dialog'), false, 'no dialog till one is opened');
  const many = ssr(h(SailPresets, { lang: 'en', every: EVERY, sets: { big: { name: 'Big', venues: ['gocek', 'cowes', 'kiel', 'sydney', 'antigua'] }, none: { name: 'None', venues: [] } } }));
  assert.match(plain(many), /Göcek, Cowes, Kiel \+2/);
  assert.match(plain(many), /None —/);
  assert.deepEqual(englishIn(plain(ssr(h(SailPresets, { lang: 'ru', every: EVERY, sets: SETS }))).replace(/#[0-9A-F]{6}/g, ''), ['UK', 'Turkey', 'PNG', 'JPEG', 'WebP', 'SVG']), []);
});

test('every venue\'s new jib ad is uploaded, saved and the old file taken away; the dialog closes', async () => {
  const router = spyRouter(), sb = fakeSb();
  globalThis.__supabase = sb;
  const v = await presets();
  await edit(v, 'Every venue');
  assert.equal(v.$('dialog').open, true);
  assert.equal(v.$('#sp-dlg-h').textContent, 'Every venue’s sails');
  assert.equal(v.$('#sp-name'), null, 'every venue\'s has no name or venues');
  assert.equal(radio(v, 'As every venue'), undefined);
  await choose(v.$('#sp-file-jib'), PNG);
  assert.equal(v.$$('.sp-pic-l')[1].querySelector('img').getAttribute('src'), 'blob:preview', 'previewed before it goes up');
  assert.match(v.$('dialog').textContent, /logo\.png/);
  await click(btn(v, 'Save'));
  const path = `jib/${clock.now}.png`;
  assert.deepEqual(sb.log, [['upload', 'regatta-ads', path, 'image/png'], ['upsert', 'regatta_settings', 'jib_ad', { url: `https://cdn.test/${path}`, path }], ['remove', 'jib/old.png']], 'the colours unchanged: not written');
  assert.equal(globalThis.__sponsor, 1);
  assert.equal(router.refreshed, 1);
  assert.equal(v.$('dialog'), null);
  assert.deepEqual(revoked, ['blob:preview']);
});

test('a file that isn’t a picture is refused, and so is one over 2 MB', async () => {
  globalThis.__supabase = fakeSb();
  const v = await presets();
  await edit(v, 'Every venue');
  await choose(v.$('#sp-file-main'), { name: 'a.pdf', type: 'application/pdf', size: 10 });
  assert.equal(v.$('[role=alert]').textContent, 'A PNG, JPEG, WebP or SVG picture, please.');
  await choose(v.$('#sp-file-main'), { ...PNG, size: 3 * 1024 * 1024 });
  assert.equal(v.$('[role=alert]').textContent, 'Up to 2 MB, please.');
  await choose(v.$('#sp-file-main'), undefined);
  assert.equal(v.$('[role=alert]'), null);
});

test('every venue\'s picture taken off and colours set: the rows written or dropped', async () => {
  const sb = fakeSb();
  globalThis.__supabase = sb;
  const v = await presets();
  await edit(v, 'Every venue');
  await click(btn(v, 'No picture'));
  assert.equal(btn(v, 'No picture'), undefined);
  await click(radio(v, 'One colour for all'));
  await type(v.$('[aria-labelledby="sp-dye-jib"][type=color]'), '#123456');
  await click(v.$$('dialog [role=radiogroup]')[1].querySelector('[role=radio]'));
  await click(btn(v, 'Save'));
  assert.deepEqual(sb.log, [['delete', 'regatta_settings', 'key', 'jib_ad'], ['upsert', 'regatta_settings', 'sail_colors', { jib: '#123456' }], ['remove', 'jib/old.png']]);
});

test('every venue\'s colours back to their defaults drop the row', async () => {
  const sb = fakeSb();
  globalThis.__supabase = sb;
  const v = await presets();
  await edit(v, 'Every venue');
  assert.equal(v.$('[aria-labelledby="sp-dye-kite"][type=color]').value, '#222222');
  await click(v.$$('dialog [role=radiogroup]')[1].querySelector('[role=radio]'));
  await click(btn(v, 'Save'));
  assert.deepEqual(sb.log, [['delete', 'regatta_settings', 'key', 'sail_colors']]);
});

test('a failed upload says why and saves nothing; a failed save takes the new upload away again', async () => {
  globalThis.__supabase = fakeSb({ uploadError: { message: 'Bucket is full' } });
  const v = await presets();
  await edit(v, 'Every venue');
  await choose(v.$('#sp-file-kite'), PNG);
  await click(btn(v, 'Save'));
  assert.equal(v.$('[role=alert]').textContent, 'Bucket is full');
  assert.deepEqual(globalThis.__supabase.log, [['upload', 'regatta-ads', `kite/${clock.now}.png`, 'image/png']]);
  assert.equal(globalThis.__sponsor, 0);
});

test('a save that fails takes the picture just uploaded away again, and leaves the dialog open', async () => {
  const sb = fakeSb({ rowError: { message: 'Not an admin' } });
  globalThis.__supabase = sb;
  const v = await presets();
  await edit(v, 'Turkey');
  await choose(v.$('#sp-file-main'), PNG);
  await click(btn(v, 'Save'));
  assert.equal(v.$('[role=alert]').textContent, 'Not an admin');
  assert.deepEqual(sb.log.at(-1), ['remove', `main/turkey-${clock.now}.png`]);
  assert.equal(v.$('dialog').open, true, 'left open to try again');
});

test('a set: its name, venues by country (one from another set moves here), a picture as every venue\'s, its colours', async () => {
  const sb = fakeSb();
  globalThis.__supabase = sb;
  const v = await presets();
  await edit(v, 'Turkey');
  assert.equal(v.$('#sp-name').value, 'Turkey');
  assert.equal(chip(v, 'Turkey').getAttribute('aria-checked'), 'mixed');
  assert.equal(chip(v, 'Cowes').textContent, 'Cowes · UK', 'named with the set it is in');
  assert.equal(radio(v, 'As every venue').getAttribute('aria-checked'), 'true', 'its jib colour as every venue\'s');
  assert.ok(v.$('.sp-pic-l.sp-inh img'), 'every venue\'s jib ad shown faded');
  await click(chip(v, 'Turkey'));
  assert.equal(chip(v, 'Istanbul').getAttribute('aria-checked'), 'true');
  await click(chip(v, 'Cowes'));
  assert.match(v.$('dialog').textContent, /Venues \(5\)/);
  await type(v.$('#sp-name'), '  Türkiye & Cowes ');
  await click([...v.$$('.sp-row')].find((r) => r.textContent.startsWith('Gennaker logo')).querySelector('.pill-quiet')); // its logo as every venue's
  await click(radio(v, 'Follow the ad'));
  await click(btn(v, 'Save'));
  assert.deepEqual(sb.log, [
    ['upsert', 'regatta_settings', 'sail_sets', { uk: { ...SETS.uk, venues: ['weymouth'] }, turkey: { name: 'Türkiye & Cowes', venues: ['gocek', 'cowes', 'istanbul', 'marmaris', 'fethiye'], colors: { jib: 'auto', kite: '#e30a17' } } }],
    ['remove', 'kite/k.png'],
  ]);
  assert.equal(globalThis.__sponsor, 1);
});

test('a set\'s gennaker goes back to each boat\'s own, and a picked country is unpicked whole', async () => {
  const sb = fakeSb();
  globalThis.__supabase = sb;
  const v = await presets();
  await edit(v, 'UK');
  assert.equal(chip(v, 'UK').getAttribute('aria-checked'), 'true');
  await click(chip(v, 'UK'));
  assert.equal(chip(v, 'Cowes').getAttribute('aria-checked'), 'false');
  await click(chip(v, 'Cowes'));
  await click(v.$$('dialog [role=radiogroup]')[1].querySelectorAll('[role=radio]')[1]);
  await click(btn(v, 'Save'));
  assert.deepEqual(sb.log, [['upsert', 'regatta_settings', 'sail_sets', { ...SETS, uk: { name: 'UK', venues: ['cowes'], main: SETS.uk.main, colors: { jib: 'auto', kite: 'own' } } }]]);
});

test('a new preset needs a name, then is made with its venues and picture', async () => {
  const sb = fakeSb();
  globalThis.__supabase = sb;
  const v = await presets({ sets: {} });
  await click(btn(v, 'New preset'));
  assert.equal(v.$('#sp-dlg-h').textContent, 'New preset');
  assert.equal(btn(v, 'Save').disabled, true, 'no name yet');
  assert.equal(btn(v, 'Delete the preset'), undefined);
  await type(v.$('#sp-name'), 'Italy');
  await click(chip(v, 'Italy'));
  await choose(v.$('#sp-file-jib'), PNG);
  await click(btn(v, 'Save'));
  const id = `s${clock.now.toString(36)}`, path = `jib/${id}-${clock.now}.png`;
  const italy = ['trieste', 'porto-cervo', 'garda', 'naples'].filter((x) => sb.log[1][3][id].venues.includes(x));
  assert.ok(italy.length >= 3, 'its country\'s venues');
  assert.deepEqual(sb.log, [['upload', 'regatta-ads', path, 'image/png'], ['upsert', 'regatta_settings', 'sail_sets', { [id]: { name: 'Italy', venues: sb.log[1][3][id].venues, jib: { url: `https://cdn.test/${path}`, path } } }]]);
});

test('deleting a set takes its pictures and leaves its venues to every venue\'s sails; the last one the row', async () => {
  const router = spyRouter(), sb = fakeSb();
  globalThis.__supabase = sb;
  const v = await presets();
  await edit(v, 'UK');
  await click(btn(v, 'Delete the preset'));
  assert.deepEqual(sb.log, [['upsert', 'regatta_settings', 'sail_sets', { turkey: SETS.turkey }], ['remove', 'main/uk.png']]);
  assert.equal(router.refreshed, 1);
  assert.equal(v.$('dialog'), null);
});

test('deleting the last set drops the row, and one that fails says why', async () => {
  const sb = fakeSb();
  globalThis.__supabase = sb;
  const v = await presets({ sets: { uk: { name: 'UK', venues: [] } } });
  await edit(v, 'UK');
  await click(btn(v, 'Delete the preset'));
  assert.deepEqual(sb.log, [['delete', 'regatta_settings', 'key', 'sail_sets']]);
});

test('a set that can\'t be deleted says why', async () => {
  globalThis.__supabase = fakeSb({ rowError: { message: 'Nope' } });
  const v = await presets();
  await edit(v, 'UK');
  await click(btn(v, 'Delete the preset'));
  assert.equal(v.$('[role=alert]').textContent, 'Nope');
  assert.equal(globalThis.__sponsor, 0);
});

test('Cancel and Escape close the dialog without saving', async () => {
  const sb = fakeSb();
  globalThis.__supabase = sb;
  const v = await presets();
  await edit(v, 'Turkey');
  await type(v.$('#sp-name'), 'Changed');
  await click(btn(v, 'Cancel'));
  assert.equal(v.$('dialog'), null);
  await edit(v, 'Turkey');
  assert.equal(v.$('#sp-name').value, 'Turkey', 'opened afresh');
  await fire(v.$('dialog'), 'cancel');
  assert.equal(v.$('dialog'), null);
  assert.deepEqual(sb.log, []);
});

test('the dialog is in Russian', async () => {
  globalThis.__supabase = fakeSb();
  const v = await mount(h(SailPresets, { lang: 'ru', every: EVERY, sets: SETS }));
  await click(v.$('[aria-label="Изменить Turkey"]'));
  assert.deepEqual(englishIn(v.$('dialog').textContent.replace(/#[0-9A-F]{6}/g, ''), ['UK', 'Turkey']), []);
});

// ---------- why races are left, who comes back, what they say ----------
const DATA = {
  since: '2026-10-19T00:00:00Z',
  exits: { how: { finish: 6, close: 3, restart: 1 }, stage: { 'first leg': 3, unknown: 1 }, last: { ocs: 2, aground: 1 }, left: 4, mins_left: 2.5, mins_fin: null },
  retention: { new: 40, d1: 10, d1of: 40, d7: 6, d7of: 30, d30: 0, d30of: 0, back: 12, active: 55 },
  ratings: { n: 10, avg: 3.94, stars: [1, 0, 2, 3, 4], yacht: { laser: { n: 2, avg: 4 }, jpk1050: { n: 8, avg: 3.5 } },
    comments: [
      { at: '2026-11-17T10:00:00Z', rating: 5, comment: 'Great <b>race</b>', yacht: 'jpk1050', venue: 'gocek', wind: 'light', place: 2, boats: 5, dsq: false, dev: 'phone tg', how: null },
      { at: '2026-11-16T10:00:00Z', rating: null, comment: 'Hard', yacht: 'laser', venue: null, wind: null, place: 3, boats: 5, dsq: true, dev: 'desktop', how: null },
    ] },
  funnel: { opened: 200, loaded: 150, failed: 10, gave_up: 40, raced: 100, finished: 50, load: 4.5, mins: 7.5, races: 1.5,
    dev: { desktop: { opened: 50, loaded: 50, gave_up: 0, failed: 0, raced: 25 }, 'phone tg': { opened: 150, loaded: 100, gave_up: 40, failed: 10, raced: 75 } },
    why: [{ why: 'WebGL missing', n: 7 }], errors: [{ m: 'TypeError: x', src: 'main.js', n: 9, visits: 4 }, { m: 'Script error', src: null, n: 2, visits: 2 }], lost: 3, howto: 30, drill: 8, ghost: 5 },
  usage: { cam: { drone: 3, top: 1 }, speed: { '1.5': 2 }, sound: { 1: 4 }, ghost: { 0: 3, 1: 1 }, nothing: { x: 1 } },
  difficulty: [{ b: 1, n: 20, fin: 10, top3: 5, dsq: 2, who: 18, down: 0.75, pens: 1.25 }, { b: 4, n: 5, fin: 5, top3: 1, dsq: 0, who: 2, down: null, pens: null }],
};
const ALL = ['InsightExits', 'InsightRetention', 'InsightRatings', 'InsightVisits', 'InsightLoading', 'InsightSettings', 'InsightDifficulty'];

test('why races are left: the share finished, and how each ended', () => {
  const html = ssr(h(insight.InsightExits, { lang: 'en', data: DATA }));
  assert.equal(tile(html, 'Finished'), '60%');
  assert.equal(tile(html, 'Left before the finish'), '4');
  assert.equal(tile(html, 'Minutes to leaving'), '2.5');
  assert.equal(tile(html, 'Minutes to the finish'), '–');
  assert.deepEqual(tableOf(html, 'How the race ended'), [['Finished', '6', '60%'], ['Closed the page', '3', '30%'], ['Restarted', '1', '10%']]);
  assert.deepEqual(tableOf(html, 'How far they got before leaving'), [['First leg', '3', '75%'], ['Not known', '1', '25%']]);
  assert.deepEqual(tableOf(html, 'What happened in the minute before'), [['Over the line early', '2', '50%'], ['Ran aground', '1', '25%']]);
});

test('an ending, a stage or an incident the page has no name for is shown by its key', () => {
  const data = { ...DATA, exits: { ...DATA.exits, how: { newway: 1 }, stage: { later: 1 }, last: { boom: 1 } } };
  const html = ssr(h(insight.InsightExits, { lang: 'en', data }));
  assert.equal(tableOf(html, 'How the race ended')[0][0], 'newway');
  assert.equal(tableOf(html, 'How far they got before leaving')[0][0], 'later');
  assert.equal(tableOf(html, 'What happened in the minute before')[0][0], 'boom');
});

test('with no races at all the shares are dashes and the empty tables are left out', () => {
  const data = { ...DATA, exits: { how: {}, stage: {}, last: {}, left: 0, mins_left: null, mins_fin: null } };
  const html = ssr(h(insight.InsightExits, { lang: 'en', data }));
  assert.equal(tile(html, 'Finished'), '–');
  assert.equal(tableOf(html, 'How the race ended'), null);
});

test('do they come back: the returns, over those who could have', () => {
  const html = ssr(h(insight.InsightRetention, { lang: 'en', data: DATA }));
  assert.equal(tile(html, 'Players active'), '55');
  assert.equal(tile(html, 'New in the period'), '40');
  assert.equal(tile(html, 'Came back another day'), '12');
  assert.equal(tile(html, 'Next day'), '25%');
  assert.equal(tile(html, 'Within a week'), '20%');
  assert.equal(tile(html, 'Within a month'), '–');
  assert.match(plain(html), /next day over 40 of them, within a week over 30/);
});

test('what they say: the stars, the average and the share who liked it', () => {
  const html = ssr(h(insight.InsightRatings, { lang: 'en', data: DATA }));
  assert.equal(tile(html, 'Races rated'), '10');
  assert.equal(tile(html, 'Average'), '3.9 / 5');
  assert.equal(tile(html, 'Four or five'), '70%');
  assert.match(html, /title="5: 4"/);
  assert.match(html, /<i style="width:100%"><\/i><\/span><span class="adm-star-v">4 · 40%/, 'the most-given star fills its bar');
  assert.match(html, /<i style="width:0%"><\/i><\/span><span class="adm-star-v">0 · 0%/);
  assert.deepEqual(tableOf(html, 'By yacht').map((r) => r[1]), ['8', '2'], 'the most rated first');
});

test('each comment says when, how many stars, on what and how the race went', () => {
  const words = plain(ssr(h(insight.InsightRatings, { lang: 'en', data: DATA })));
  assert.match(words, /17 Nov · ★★★★★ · JPK 1050, Göcek · 2\/5 · Phone · Telegram Great <b>race<\/b>/);
  assert.match(words, /16 Nov · no stars · Laser \(ILCA\) · DSQ · Computer · browser Hard/);
});

test('a comment’s words are shown as words, never as markup', () => {
  assert.match(ssr(h(insight.InsightRatings, { lang: 'en', data: DATA })), /<p>Great &lt;b&gt;race&lt;\/b&gt;<\/p>/);
});

test('with no ratings there are no bars and no comments', () => {
  const data = { ...DATA, ratings: { n: 0, avg: null, stars: [0, 0, 0, 0, 0], yacht: {}, comments: [] } };
  const html = ssr(h(insight.InsightRatings, { lang: 'en', data }));
  assert.equal(tile(html, 'Average'), '–');
  assert.equal(tile(html, 'Four or five'), '–');
  assert.doesNotMatch(html, /adm-stars|adm-comments/);
});

test('how far a visit gets, step by step and by device', () => {
  const html = ssr(h(insight.InsightVisits, { lang: 'en', data: DATA }));
  assert.match(plain(html), /Opened the game 200 · 100% It loaded 150 · 75% Began a race 100 · 50% Finished one 50 · 25%/);
  assert.match(html, /<i style="width:75%">/);
  assert.equal(tile(html, 'Gave up while loading'), '40 · 20%');
  assert.equal(tile(html, 'Minutes a visit'), '7.5');
  assert.deepEqual(tableOf(html, 'By device'), [['Phone · Telegram', '150', '67%', '27%', '7%', '50%'], ['Computer · browser', '50', '100%', '0%', '0%', '50%']]);
  assert.equal(tile(html, 'Opened How to play'), '20%');
  assert.doesNotMatch(html, /Raced a ghost|Ghost of your best/, 'what the server still counts of the ghost is not shown');
});

test('a period with no visits draws empty bars rather than failing', () => {
  const data = { ...DATA, funnel: { ...DATA.funnel, opened: 0, loaded: 0, raced: 0, finished: 0, gave_up: 0, dev: {} } };
  const html = ssr(h(insight.InsightVisits, { lang: 'en', data }));
  assert.match(html, /<i style="width:0%">/);
  assert.match(plain(html), /Opened the game 0 · –/);
});

test('the loads that failed and the errors seen', () => {
  const html = ssr(h(insight.InsightLoading, { lang: 'en', data: DATA }));
  assert.equal(tile(html, 'Failed to load'), '10 · 5%');
  assert.equal(tile(html, 'Seconds to load'), '4.5');
  assert.equal(tile(html, 'Lost the 3D \\(WebGL\\)'), '3');
  assert.deepEqual(tableOf(html, 'Why a load failed'), [['WebGL missing', '7']]);
  assert.deepEqual(tableOf(html, 'Errors on the page'), [['TypeError: x', 'main.js', '9', '4'], ['Script error', '–', '2', '2']]);
  assert.match(plain(html), /Of the 200 visits in the period/);
});

test('what they set: named values, the game’s speed as a multiple, and nothing it doesn’t know', () => {
  const html = ssr(h(insight.InsightSettings, { lang: 'en', data: DATA }));
  assert.deepEqual(tableOf(html, 'Camera'), [['Drone', '3', '75%'], ['From above', '1', '25%']]);
  assert.deepEqual(tableOf(html, 'Game speed'), [['×1.5', '2', '100%']]);
  assert.deepEqual(tableOf(html, 'Sound'), [['On', '4', '100%']]);
  assert.doesNotMatch(plain(html), /nothing/);
});

test('too easy, too hard: each stage of a player’s experience', () => {
  const html = ssr(h(insight.InsightDifficulty, { lang: 'en', data: DATA }));
  assert.deepEqual(tableOf(html, 'By how many races the player had sailed'), [
    ['Their 1st race', '20', '18', '50%', '50%', '10%', '75%', '1.3'],
    ['21st and on', '5', '2', '100%', '20%', '0%', '–', '–'],
  ]);
});

test('every block of numbers reads in Russian', () => {
  for (const name of ALL) {
    const words = plain(ssr(h(insight[name], { lang: 'ru', data: DATA })));
    assert.deepEqual(englishIn(words, ['JPK', 'Laser', 'ILCA', 'TypeError', 'main', 'Script error', 'WebGL missing', 'missing', 'error', 'Great', 'race', 'Hard']), [], name);
  }
  assert.match(plain(ssr(h(insight.InsightRatings, { lang: 'ru', data: DATA }))), /17 нояб\. · ★★★★★/);
  assert.match(plain(ssr(h(insight.InsightExits, { lang: 'ru', data: DATA }))), /Закрыл страницу 3 30%/);
});

// ---------- the players ----------
const COLS = [{ label: 'Races' }, { label: 'Best', asc: true }];
const ROWS = [
  { key: 'a', name: 'Anna', sub: 'Guest', isNew: true, cells: ['3', '1:00.0'], vals: [3, 60] },
  { key: 'b', name: 'Boris', sub: 'Telegram', isNew: false, cells: ['9', '–'], vals: [9, null] },
  { key: 'c', name: 'Cleo', sub: 'Guest', isNew: false, cells: ['5', '0:50.0'], vals: [5, 50] },
];
const table = (p = {}) => h(PlayersTable, { cols: COLS, rows: ROWS, first: { label: 'Player', asc: true }, label: 'The players', newLabel: 'New', start: 1, ...p });
const names = (v) => v.$$('tbody .adm-pl-name').map((n) => n.textContent);
const head = (v, i) => v.$$('thead button')[i];

test('the table starts sorted by the column asked for, highest first', async () => {
  const v = await mount(table());
  assert.deepEqual(names(v), ['Boris', 'Cleo', 'Anna']);
  assert.equal(v.$$('th[scope=col]')[1].getAttribute('aria-sort'), 'descending');
  assert.equal(v.$$('th[scope=col]')[0].getAttribute('aria-sort'), null);
  assert.equal(head(v, 1).querySelector('.adm-sort').textContent, '▼');
});

test('a second click on a column turns its order round', async () => {
  const v = await mount(table());
  await click(head(v, 1));
  assert.deepEqual(names(v), ['Anna', 'Cleo', 'Boris']);
  assert.equal(v.$$('th[scope=col]')[1].getAttribute('aria-sort'), 'ascending');
  assert.equal(head(v, 1).querySelector('.adm-sort').textContent, '▲');
});

test('a column sorted low to high starts that way, and names sort by the alphabet', async () => {
  const v = await mount(table());
  await click(head(v, 0));
  assert.deepEqual(names(v), ['Anna', 'Boris', 'Cleo']);
  await click(head(v, 0));
  assert.deepEqual(names(v), ['Cleo', 'Boris', 'Anna']);
});

test('a player with nothing in a column goes last whichever way it is sorted', async () => {
  const v = await mount(table());
  await click(head(v, 2));
  assert.deepEqual(names(v), ['Cleo', 'Anna', 'Boris']);
  await click(head(v, 2));
  assert.deepEqual(names(v), ['Anna', 'Cleo', 'Boris']);
});

// ---------- the players with a problem (/admin/logs) ----------
const logPerson = (who, name, o) => ({ who, kind: 'tg', name, handle: null, last: null, visits: 3, bad: 1, failed: 0, gave_up: 0, lost: 0, errors: 0, slow: 0, low: 0, dev: null, ...o });
const LOGS = { since: '2026-11-01T00:00:00Z', report: null, totals: { visits: 9, bad: 3, failed: 3, gave_up: 0, lost: 0, errors: 6, slow: 0, low: 0, people: 3 }, people: [
  logPerson('1', 'Ann', { failed: 2, last: '2026-11-10T10:00:00Z', dev: 'phone' }),
  logPerson('2', 'Ben', { errors: 5, last: '2026-11-17T10:00:00Z', dev: 'desktop' }),
  logPerson('3', 'Cy', { failed: 1, errors: 1, last: '2026-11-12T10:00:00Z' }),
] };
const logs = (lang = 'en') => h(AdminLogs, { lang, data: LOGS, days: 7 });

test('the players with a problem start with the latest problem first', async () => {
  const v = await mount(logs());
  assert.deepEqual(names(v), ['Ben', 'Cy', 'Ann']);
  assert.equal(v.$$('th[scope=col]')[8].getAttribute('aria-sort'), 'descending');
});

test('a problem’s column puts the most of it first, and those without it last either way', async () => {
  const v = await mount(logs());
  await click(head(v, 1));
  assert.deepEqual(names(v), ['Ann', 'Cy', 'Ben']);
  await click(head(v, 1));
  assert.deepEqual(names(v), ['Cy', 'Ann', 'Ben']);
});

test('the players with a problem sort by name and by device, and each still opens their log', async () => {
  const v = await mount(logs());
  await click(head(v, 0));
  assert.deepEqual(names(v), ['Ann', 'Ben', 'Cy']);
  await click(head(v, 7));
  assert.deepEqual(names(v), ['Ben', 'Ann', 'Cy'], 'Computer, Phone, and no device last');
  assert.deepEqual(v.$$('tbody a').map((a) => a.getAttribute('href')), ['/admin/logs?who=2&days=7', '/admin/logs?who=1&days=7', '/admin/logs?who=3&days=7']);
});

test('a new player is marked, and the cells follow their row', async () => {
  const v = await mount(table());
  const row = v.$$('tbody tr').find((r) => r.textContent.includes('Anna'));
  assert.equal(row.querySelector('.adm-pl-new').textContent, 'New');
  assert.deepEqual(row.querySelectorAll('td').map((c) => c.textContent), ['3', '1:00.0']);
  assert.equal(v.$$('.adm-pl-new').length, 1);
});

const PLAYERS = { since: '2026-10-19', players: [
  { who: 'tg1', kind: 'tg', name: 'Kolya 🚀', handle: 'kolya', first: '2026-10-01T08:05:00Z', last: '2026-11-18T09:30:00Z', new: false, n: 10, fin: 8, top3: 3, dsq: 1, days: 4, down: 0.25, best: 65.4, rated: 2, rating: 4.5, dev: 'phone tg' },
  { who: 'abcd1234', kind: 'guest', name: null, handle: null, first: '2026-11-17T00:00:00Z', last: '2026-11-17T23:59:00Z', new: true, n: 0, fin: 0, top3: 0, dsq: 0, days: 1, down: null, best: null, rated: 0, rating: null, dev: null },
  { who: 'ac1', kind: 'acct', name: '<i>Eve</i>', handle: 'eve@x.co', first: '2026-11-01T00:00:00Z', last: '2026-11-10T00:00:00Z', new: false, n: 2, fin: 1, top3: 0, dsq: 0, days: 1, down: 0, best: 70, rated: 0, rating: null, dev: 'desktop' },
] };

test('the players’ tiles count each kind', () => {
  const html = ssr(h(AdminPlayers, { lang: 'en', data: PLAYERS }));
  assert.equal(tile(html, 'Players who raced'), '3');
  assert.equal(tile(html, 'New in the period'), '1');
  assert.equal(tile(html, 'Telegram'), '1');
  assert.equal(tile(html, 'Site accounts'), '1');
  assert.equal(tile(html, 'Guests'), '1');
});

test('a player’s row reads their numbers, last seen first', async () => {
  const v = await mount(h(AdminPlayers, { lang: 'en', data: PLAYERS }));
  assert.deepEqual(names(v), ['Kolya', 'Guest abcd', '<i>Eve</i>']);
  const cells = (i) => v.$$('tbody tr')[i].querySelectorAll('td').map((c) => c.textContent);
  assert.deepEqual(cells(0), ['10', '80%', '3', '1', '4', '25%', '1:05.4', '4.5 · 2', 'Phone · Telegram', '18 Nov, 09:30', '1 Oct, 08:05']);
  assert.deepEqual(cells(1), ['0', '–', '0', '–', '1', '–', '–', '–', '–', '17 Nov, 23:59', '17 Nov, 00:00']);
  assert.equal(v.$$('.adm-pl-sub')[0].textContent, 'Telegram · @kolya');
  assert.equal(v.$$('.adm-pl-sub')[2].textContent, 'Site account · eve@x.co');
});

test('the switch hides the guests from the table and shows them again', async () => {
  const v = await mount(h(AdminPlayers, { lang: 'en', data: PLAYERS }));
  const sw = v.$('.adm-tab-sw [role="switch"]');
  assert.equal(v.$('.adm-tab-sw span').textContent, 'Hide guests');
  assert.equal(sw.getAttribute('aria-checked'), 'false');
  await click(sw);
  assert.equal(sw.getAttribute('aria-checked'), 'true');
  assert.deepEqual(names(v), ['Kolya', '<i>Eve</i>']);
  await click(sw);
  assert.deepEqual(names(v), ['Kolya', 'Guest abcd', '<i>Eve</i>']);
});

test('with no guests there is no switch', () => {
  assert.doesNotMatch(ssr(h(AdminPlayers, { lang: 'en', data: { ...PLAYERS, players: PLAYERS.players.filter((p) => p.kind !== 'guest') } })), /adm-tab-sw/);
});

test('a name is shown as written, never as markup', () => {
  assert.match(ssr(h(AdminPlayers, { lang: 'en', data: PLAYERS })), /&lt;i&gt;Eve&lt;\/i&gt;/);
});

test('with no players there is no table, only the note', () => {
  const html = ssr(h(AdminPlayers, { lang: 'en', data: { since: '', players: [] } }));
  assert.doesNotMatch(html, /adm-players/);
  assert.equal(tile(html, 'Players who raced'), '0');
});

test('the Russian list of players is in Russian', () => {
  const words = plain(ssr(h(AdminPlayers, { lang: 'ru', data: PLAYERS })));
  assert.match(words, /Игроков с гонками/);
  assert.match(words, /Телефон · Telegram/);
  assert.match(words, /Гость abcd/);
  assert.deepEqual(englishIn(words, ['Kolya', 'kolya', 'Eve', 'eve', 'abcd']), []);
});

// ---------- today's race and the week ahead ----------
const NOW = new Date('2026-11-18T21:30:00Z');
const live = (p = {}) => ({ d: '2026-11-18', races: 12, n: 12, top: [{ s: 65.4, name: 'Anna', fl: null }], ...p });

test('today’s race is the one the game sails, down to its course', () => {
  const d = dailyRace(NOW), v = venueOf(d.venue);
  const words = plain(ssr(h(AdminSchedule, { lang: 'en', today: null, now: NOW })));
  assert.match(words, /Today’s race · Wednesday, 18 Nov|Today’s race · Wednesday 18 Nov/);
  assert.ok(words.includes(`Venue ${v.name[0]}, ${v.place[0]}`));
  assert.ok(words.includes(`Yacht ${yachtOf(d.yacht).name[0]}`));
  assert.ok(words.includes(`Wind ${KN[d.preset]} kn`));
  assert.ok(words.includes(`Course ${SHAPE_NAME[d.course][0]}`));
  assert.ok(words.includes(`${d.fleet} boats · ${d.start} min sequence`));
});

test('the next race is counted down to midnight UTC', () => {
  assert.match(plain(ssr(h(AdminSchedule, { lang: 'en', today: null, now: NOW }))), /starts at midnight UTC, in 2 h 30 min\./);
  assert.match(plain(ssr(h(AdminSchedule, { lang: 'ru', today: null, now: NOW }))), /через 2 ч 30 мин\./);
});

test('the week ahead lists the next seven days, each with its own race', () => {
  const html = ssr(h(AdminSchedule, { lang: 'en', today: null, now: NOW }));
  assert.equal([...html.matchAll(/<li class="srow">/g)].length, 7);
  const next = dailyRace(new Date('2026-11-19T12:00:00Z'));
  assert.match(plain(html), new RegExp(`Thu,? 19 Nov ${venueOf(next.venue).name[0]}`));
  assert.match(plain(html), /The next 7 days/);
});

test('how today’s race has gone, with its best time and who set it', () => {
  assert.match(plain(ssr(h(AdminSchedule, { lang: 'en', today: live(), now: NOW }))), /Sailed today 12 races · best 1:05\.4, Anna/);
  assert.match(plain(ssr(h(AdminSchedule, { lang: 'ru', today: live(), now: NOW }))), /заездов: 12 · лучшее 1:05\.4, Anna/);
  assert.match(plain(ssr(h(AdminSchedule, { lang: 'en', today: live({ top: [{ s: 70, name: null }] }), now: NOW }))), /12 races · best 1:10\.0 The same/);
  assert.match(plain(ssr(h(AdminSchedule, { lang: 'en', today: live({ top: [] }), now: NOW }))), /Sailed today 12 races The same/);
});

test('one race sailed today reads in the singular', () => {
  assert.match(plain(ssr(h(AdminSchedule, { lang: 'en', today: live({ races: 1 }), now: NOW }))), /Sailed today 1 race\b/);
});

test('yesterday’s numbers are not passed off as today’s', () => {
  assert.match(plain(ssr(h(AdminSchedule, { lang: 'en', today: live({ d: '2026-11-17' }), now: NOW }))), /Sailed today No races yet/);
  assert.match(plain(ssr(h(AdminSchedule, { lang: 'en', today: live({ races: 0 }), now: NOW }))), /Sailed today No races yet/);
  assert.match(plain(ssr(h(AdminSchedule, { lang: 'ru', today: null, now: NOW }))), /Ещё нет заездов/);
});

test('the Russian schedule has Russian names for the race', () => {
  const d = dailyRace(NOW), words = plain(ssr(h(AdminSchedule, { lang: 'ru', today: null, now: NOW })));
  assert.ok(words.includes(venueOf(d.venue).name[1]));
  assert.match(words, /Следующие 7 дней/);
  assert.match(words, new RegExp(`${d.fleet} яхт · старт за ${d.start} мин`));
  assert.doesNotMatch(words, /\bkn\b|\blap\b|Venue|Wind/);
});

// ---------- the admin's frame ----------
const t = tx('en');
const ACCT = { id: '1', email: 'boss@ryc.test', name: 'Boss', provider: 'email' };
const shell = (p = {}) => h(AdminShell, { lang: 'en', t, account: ACCT, admin: true, ...p }, h('p', { id: 'inner' }, 'Inner'));

test('the admin’s pages are listed, each with what it is for', () => {
  const html = ssr(h(AdminHub, { lang: 'en' }));
  assert.deepEqual(hrefs(html), ADMIN_PAGES.map((p) => `/admin/${p.id}`));
  assert.match(plain(html), /Race Today’s race and the week ahead What every player sails today/);
  const ru = plain(ssr(h(AdminHub, { lang: 'ru' })));
  assert.match(ru, /Гонка Гонка дня и неделя вперёд/);
  assert.deepEqual(englishIn(ru), []);
});

test('a guest is asked to sign in, and sent back to the page they wanted', () => {
  const html = ssr(shell({ account: null, admin: false, page: 'players' }));
  assert.ok(hrefs(html).includes('/sign-in?next=/admin/players'));
  assert.match(plain(html), /Sign in as an admin/);
  assert.doesNotMatch(html, /id="inner"/);
  assert.match(html, /data-acct="guest"/);
});

test('someone not on the list is told so and sees none of it', () => {
  const html = ssr(shell({ admin: false }));
  assert.match(plain(html), /boss@ryc\.test is not on the admin list\./);
  assert.doesNotMatch(html, /id="inner"|adm-nav/);
  assert.match(plain(ssr(shell({ admin: false, account: { ...ACCT, email: '' } }))), /Boss is not on the admin list\./);
});

test('an admin gets the page, the pages’ tabs and the way back', () => {
  const html = ssr(shell({ page: 'ads' }));
  assert.match(html, /id="inner"/);
  assert.match(plain(html), /Admin · Ads The plane’s banner/);
  assert.match(html, /<a href="\/admin\/sails">Sails<\/a>/, 'the sails a page of their own');
  assert.match(html, /<a href="\/admin\/ads" class="on" aria-current="page">Ads<\/a>/);
  assert.ok(hrefs(html).includes('/admin'), 'back to the admin');
  assert.ok(hrefs(ssr(shell())).includes('/settings'), 'the admin’s own page goes back to settings');
});

test('the period is kept going from one page of numbers to the next, and dropped on the others', () => {
  const html = ssr(shell({ page: 'players', days: 7 }));
  assert.ok(hrefs(html).includes('/admin/game?days=7'));
  assert.ok(hrefs(html).includes('/admin/tech?days=7'));
  assert.ok(hrefs(html).includes('/admin/race'));
  assert.ok(hrefs(html).includes('/admin/ads'));
  assert.ok(!hrefs(ssr(shell({ page: 'players', days: 30 }))).includes('/admin/game?days=30'), 'thirty days is the default');
});

test('the period’s buttons show on the pages of numbers, the one chosen marked', () => {
  const html = ssr(shell({ page: 'tech', days: 90 }));
  for (const d of STAT_DAYS) assert.ok(hrefs(html).includes(`/admin/tech?days=${d}`));
  assert.match(html, /<a href="\/admin\/tech\?days=90" aria-current="page" class="on">90 days<\/a>/);
  assert.doesNotMatch(ssr(shell({ page: 'race', days: 7 })), /adm-range/);
  assert.match(plain(ssr(h(AdminShell, { lang: 'ru', t: tx('ru'), account: ACCT, admin: true, page: 'tech', days: 7 }, 'x'))), /7 дн\./);
});

test('the period is read from the address, thirty days unless it is one on offer', () => {
  assert.equal(pickDays('7'), 7);
  assert.equal(pickDays('90'), 90);
  for (const q of [undefined, '', '14', 'x']) assert.equal(pickDays(q), 30, String(q));
});

test('a block of numbers that didn’t come says why', () => {
  assert.match(plain(ssr(h(AdminMissing, { title: 'Players', Icon: IconFlag, error: 'timeout', t }))), /Players The numbers didn’t load: timeout/);
  assert.match(plain(ssr(h(AdminMissing, { title: 'Players', Icon: IconFlag, t }))), /Nothing in this period\./);
  assert.match(plain(ssr(h(AdminMissing, { title: 'Игроки', Icon: IconFlag, error: 'сбой', t: tx('ru') }))), /Цифры не загрузились: сбой/);
});

const params = (lang = 'en') => Promise.resolve({ lang });
test('a guest loads no numbers', async () => {
  let loaded = false;
  const r = await adminLoad(params(), async () => { loaded = true; });
  assert.deepEqual([r.account, r.admin, r.data, loaded], [null, false, null, false]);
});

test('the numbers are handed over to an admin alone', async () => {
  globalThis.__account = ACCT;
  globalThis.__sb = { rpc: async () => ({ data: false }) };
  const no = await adminLoad(params('ru'), async () => 'secret');
  assert.deepEqual([no.admin, no.data, no.lang], [false, null, 'ru']);
  globalThis.__sb = { rpc: async () => ({ data: true }) };
  const yes = await adminLoad(params(), async () => 'secret');
  assert.deepEqual([yes.admin, yes.data], [true, 'secret']);
});

test('a sum of the database’s comes back with its data or its error', async () => {
  const calls = [];
  const sb = { rpc: async (fn, a) => { calls.push([fn, a]); return { data: { n: 1 }, error: null }; } };
  assert.deepEqual(await adminRpc(sb, 'regatta_admin_stats', 7), { data: { n: 1 }, error: null });
  assert.deepEqual(calls, [['regatta_admin_stats', { days: 7 }]]);
  assert.deepEqual(await adminRpc({ rpc: async () => ({ error: { message: 'denied' } }) }, 'regatta_admin_players', 30), { data: null, error: 'denied' });
});

test('the admin’s titles are kept from search engines', async () => {
  const m = await adminTitle('players')({ params: params('ru') });
  assert.match(String(m.title?.absolute ?? m.title), /Админка · Игроки/);
  assert.equal(m.robots?.index ?? false, false);
  assert.match(String((await adminTitle()({ params: params() })).title?.absolute ?? ''), /Admin|^$/);
});

// ---------- how they race, how the game runs ----------
const g = (k, v, p = {}) => ({ k, v, n: 10, fin: 8, dsq: 1, top3: 4, who: 6, down: 0.5, np: 5, fps: 58.4, low: 31.2, stall: 0.75, load: 6.25, slow: 1, saver: 0.2, qh: 3, qm: 1, ql: 1, ...p });
const STATS = {
  since: '2026-11-16T00:00:00Z',
  groups: [g('all', null), g('yacht', 'laser'), g('yacht', 'unknownboat', { n: 2 }), g('wind', 'light'), g('wind', null), g('venue', null), g('venue', 'gocek'), g('shape', 'tri'), g('kind', 'daily'), g('kind', 'free'),
    g('dev', 'phone tg', { np: 3 }), g('dev', 'desktop', { np: 9 }), g('dev', 'tablet', { np: 0 }), g('gpu', 'Apple M2'), g('q', 'high'), g('os', 'macOS'), g('br', 'Chrome', { load: null, saver: null })],
  days: [{ d: '2026-11-16', n: 4, fin: 2, who: 3, fps: 60 }, { d: '2026-11-18', n: 8, fin: 8, who: 5, fps: null }],
};

test('there are numbers to show only when the period has races', () => {
  assert.equal(hasStats(STATS), true);
  assert.equal(hasStats({ ...STATS, groups: [g('yacht', 'laser')] }), false);
  assert.equal(hasStats(null), false);
});

test('how they race: the totals and a table for each way of cutting it', () => {
  const html = ssr(h(AdminRacing, { lang: 'en', stats: STATS }));
  assert.equal(tile(html, 'Races started'), '10');
  assert.equal(tile(html, 'Finished'), '80%');
  assert.equal(tile(html, 'Players signed in'), '6');
  assert.equal(tile(html, 'Disqualified'), '10%');
  assert.deepEqual(tableOf(html, 'By yacht')[0], ['Laser (ILCA)', '10', '80%', '50%', '10%', '50%', '58']);
  assert.equal(tableOf(html, 'By yacht')[1][0], 'unknownboat', 'a yacht it doesn’t know goes by its id');
  assert.deepEqual(tableOf(html, 'By wind').map((r) => r[0]), ['Light'], 'a race with no wind kept is left out');
  assert.deepEqual(tableOf(html, 'By venue').map((r) => r[0]), ['Not kept (older races)', 'Göcek']);
  assert.deepEqual(tableOf(html, 'By course and race').map((r) => r[0]), ['Triangle', 'Today’s race', 'Custom race']);
});

test('a bar a day, an empty slot for a day with no races, from the period’s start to today', () => {
  const html = ssr(h(AdminRacing, { lang: 'en', stats: STATS }));
  assert.match(plain(html), /Races started a day Peak · 18 Nov 8/);
  assert.equal([...html.matchAll(/class="adm-days-slot/g)].length, 3);
  assert.equal([...html.matchAll(/class="adm-days-bar"/g)].length, 2);
  const chart = plain(html.slice(html.indexOf('adm-days-bars'), html.indexOf('adm-days-t"')));
  assert.match(chart, /16 Nov Races 4 Finished 50% Players 3 FPS 60/);
  assert.match(chart, /17 Nov No races/);
  assert.match(chart, /18 Nov Races 8 Finished 100% Players 5 FPS –/);
  assert.match(plain(html.slice(html.indexOf('adm-days-t"'))), /16 Nov 17 Nov 18 Nov/);
});

test('how the game runs: the frame rates, stalls and load', () => {
  const html = ssr(h(AdminPerf, { lang: 'en', stats: STATS }));
  assert.equal(tile(html, 'Races measured'), '5');
  assert.equal(tile(html, 'Median FPS'), '58');
  assert.equal(tile(html, 'Under 30 FPS'), '20%');
  assert.equal(tile(html, 'Stalls a minute'), '0.8');
  assert.equal(tile(html, 'To the first race'), '6.3 s');
});

test('by device: the most measured first, and devices never measured left out', () => {
  const rows = tableOf(ssr(h(AdminPerf, { lang: 'en', stats: STATS })), 'By device');
  assert.deepEqual(rows.map((r) => r[0]), ['Computer · browser', 'Phone · Telegram']);
  assert.deepEqual(rows[0], ['Computer · browser', '9', '58', '31', '11%', '0.8', '20%', '33% / 11% / 11%', '6.3 s']);
});

test('a number not measured is a dash', () => {
  const rows = tableOf(ssr(h(AdminPerf, { lang: 'en', stats: STATS })), 'By system and browser');
  assert.deepEqual(rows.map((r) => r[0]), ['macOS', 'Chrome']);
  assert.equal(rows[1][6], '–', 'the saver');
  assert.equal(rows[1][8], '–', 'the load');
});

test('with no load measured the total says so', () => {
  const stats = { ...STATS, groups: [g('all', null, { load: null, fps: null })] };
  const html = ssr(h(AdminPerf, { lang: 'en', stats }));
  assert.equal(tile(html, 'To the first race'), '–');
  assert.equal(tile(html, 'Median FPS'), '–');
});

test('how they race and how it runs read in Russian', () => {
  const allow = ['Laser', 'ILCA', 'unknownboat', 'Apple', 'macOS', 'Chrome'];
  const race = plain(ssr(h(AdminRacing, { lang: 'ru', stats: STATS })));
  assert.match(race, /Гонок начато/);
  assert.match(race, /16 нояб\.|16 ноя/);
  assert.deepEqual(englishIn(race, allow), []);
  const perf = plain(ssr(h(AdminPerf, { lang: 'ru', stats: STATS })));
  assert.match(perf, /6,3 с|6\.3 с/);
  assert.deepEqual(englishIn(perf, allow), []);
});

test('a tile and an empty table', () => {
  assert.equal(plain(ssr(h(Tile, { k: 'Races', v: '3' }))), 'Races 3');
  assert.equal(ssr(h(Table, { title: 'T', first: 'F', head: ['A'], rows: [] })), '');
  assert.match(ssr(h(Table, { title: 'T', first: 'F', head: ['A'], rows: [{ key: 'k', name: 'N', cells: ['1'] }] })), /role="region" aria-label="T"/);
});
