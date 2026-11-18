// The venues: the list of every place you can race, and a venue's own page with its drone tour. npm test.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import './load.mjs';
import { click, dom, done, englishIn, fromFrame, h, hrefs, mount, plain, press, reset, resized, ssr, tell, tick } from './fake-dom.mjs';

const { VenueView } = await import('../components/venue-view.tsx');
const { VenuesList } = await import('../components/venues-list.tsx');
const { DEFAULT_BOAT, saveBoat } = await import('../lib/boat.ts');
await import('../public/game/av-menu.js');

beforeEach(() => reset());
afterEach(done);

const CARD = {
  id: 'gocek', n: 3, of: 55, name: ['Göcek', 'Гёчек'], place: ['Turkey', 'Турция'], about: ['Pine-clad hills.', 'Сосновые холмы.'], wind: ['SSW', 'ЮЮЗ'], nation: 'TUR',
  title: ['Racing at Göcek', 'Гонки в Гёчеке'], intro: ['A sheltered gulf.', 'Закрытый залив.'],
  sections: [{ h: ['The water', 'Вода'], p: [['Flat.', 'Гладкая.'], ['Warm.', 'Тёплая.']] }, { h: ['Regattas', 'Регаты'], p: [['Many.', 'Много.']] }, { h: ['How to race', 'Как гоняться'], p: [['Go left.', 'Иди влево.']] }, { h: ['More', 'Ещё'], p: [['Extra.', 'Дополнительно.']] }],
  next: '21 Nov', today: false, by: 'RYC race office', published: ['1 Nov 2026', '2026-11-01'],
  others: [{ id: 'cowes', name: ['Cowes', 'Каус'], place: ['England', 'Англия'] }],
};
const venue = (p = {}, v = {}) => mount(h(VenueView, { lang: 'en', v: { ...CARD, ...v }, back: h('a', { href: '/venues', id: 'bk' }, 'Back'), ...p }));
const page = (v = {}, lang = 'en') => ssr(h(VenueView, { lang, v: { ...CARD, ...v }, back: null }));
const shot = (v) => v.$('.vn-shots [aria-checked="true"] b').textContent;
const focused = (v) => v.$('iframe').contentWindow.sent.filter((m) => m.type === 'focus').at(-1);
const auto = (v) => v.$('.fl-ctl [aria-pressed]');

// ---------- a venue's page ----------
test('a venue says what it is, where it is and its place among the venues', () => {
  const words = plain(page());
  assert.match(words, /Regatta venue 03 \/ 55 Göcek Pine-clad hills\./);
  for (const s of ['Wind in the game SSW', 'Sail letters TUR', 'Where Turkey', 'Race of the day here 21 Nov']) assert.ok(words.includes(s), s);
});

test('its guide has every section, a byline and the date it was published', () => {
  const html = page(), words = plain(html);
  assert.match(words, /Racing at Göcek A sheltered gulf\. By RYC race office · Published 1 Nov 2026/);
  assert.match(html, /<time dateTime="2026-11-01">|<time datetime="2026-11-01">/);
  assert.match(words, /The water Flat\. Warm\. Regattas Many\. How to race Go left\. More Extra\./);
  assert.match(html, /aria-labelledby="vn-s4"/);
});

test('it leads to the other venues, all of them and the guide on wind shifts', () => {
  const links = hrefs(page());
  for (const to of ['/venues/cowes', '/venues', '/learn/shifts']) assert.ok(links.includes(to), to);
});

test('a venue with no race of the day coming leaves that line out', () => {
  assert.doesNotMatch(plain(page({ next: null })), /Race of the day here/);
});

test('on another day the button sets up a custom race here', async () => {
  const v = await venue();
  assert.equal(v.$('.bt-go').textContent, 'Race at Göcek');
  assert.match(v.text(), /A custom race here: the yacht, the wind/);
  await click(v.$('.bt-go'));
  assert.equal(JSON.parse(localStorage.getItem('regatta')).venue, 'gocek');
  assert.deepEqual(location.assigned, ['/race/free']);
});

test('on its day the button goes to today’s race', () => {
  const html = page({ today: true }), words = plain(html);
  assert.ok(hrefs(html).includes('/play?race=today'));
  assert.match(words, /Sail today’s race here/);
  assert.match(words, /Today’s race is sailed here/);
  assert.match(words, /Race of the day here Today/);
});

test('the scene is this venue’s, started once the page is idle', async () => {
  const v = await venue();
  assert.equal(v.$('iframe').getAttribute('src'), null);
  assert.equal(v.$('iframe').title, 'Göcek from the drone');
  await tick(5);
  assert.equal(v.$('iframe').getAttribute('src'), '/venue-view?venue=gocek');
});

test('a reader saving data gets the words alone', async () => {
  navigator.connection = { saveData: true };
  const v = await venue();
  await tick(1000);
  assert.equal(v.$('iframe').getAttribute('src'), null);
  assert.equal(v.$('.bt-poster span'), null);
  assert.doesNotMatch(v.$('.bc-load').className, /\bon\b/);
});

test('once ready the scene is told which shot to show', async () => {
  const v = await venue();
  await fromFrame(v.$('iframe'), { type: 'ready' });
  assert.deepEqual(focused(v), { type: 'focus', id: 'waters' });
});

test('the scene is told what the card covers', async () => {
  const v = await venue();
  v.$('.bt-card').rect = { left: 880, top: 0, width: 400, height: 800, bottom: 800 };
  v.$('.bt-info').rect = { left: 0, top: 0, width: 800, height: 400, bottom: 400 };
  await resized();
  assert.equal(v.$('iframe').contentWindow.sent.filter((m) => m.type === 'inset').at(-1).r, 400 / 1280);
});

test('the tour waits for the first frame, lingers on the first shot, then moves on', async () => {
  const v = await venue();
  await tick(30000);
  assert.equal(shot(v), 'The water', 'nothing to tour until the scene is up');
  await fromFrame(v.$('iframe'), { type: 'live' });
  assert.match(v.$('iframe').className, /\bon\b/);
  await tick(13900);
  assert.equal(shot(v), 'The water');
  await tick(200);
  assert.equal(shot(v), 'The course');
  assert.deepEqual(focused(v), { type: 'focus', id: 'course' });
});

test('the next shot waits until the drone has arrived, then ten seconds', async () => {
  const v = await venue();
  await fromFrame(v.$('iframe'), { type: 'live' });
  await tick(14100);
  await tick(20000);
  assert.equal(shot(v), 'The course', 'still flying there');
  await fromFrame(v.$('iframe'), { type: 'arrived', id: 'course' });
  await tick(9900);
  assert.equal(shot(v), 'The course');
  await tick(200);
  assert.equal(shot(v), 'The start');
});

test('the tour goes round to the first shot again', async () => {
  const v = await venue();
  await click(v.$$('.vn-shots button')[3]);
  await click(v.$('[aria-label="Next shot"]'));
  assert.equal(shot(v), 'The water');
  await click(v.$('[aria-label="Previous shot"]'));
  assert.equal(shot(v), 'The top mark');
});

test('picking a shot flies there and stops the tour', async () => {
  const v = await venue();
  await fromFrame(v.$('iframe'), { type: 'live' });
  await click(v.$$('.vn-shots button')[2]);
  assert.deepEqual(focused(v), { type: 'focus', id: 'start' });
  assert.equal(auto(v).getAttribute('aria-pressed'), 'false');
  await fromFrame(v.$('iframe'), { type: 'arrived', id: 'start' });
  await tick(30000);
  assert.equal(shot(v), 'The start');
});

test('taking hold of the view stops the tour, and play starts it again', async () => {
  const v = await venue();
  await fromFrame(v.$('iframe'), { type: 'live' });
  await fromFrame(v.$('iframe'), { type: 'touched' });
  assert.equal(auto(v).getAttribute('aria-label'), 'Tour the course');
  await tick(30000);
  assert.equal(shot(v), 'The water');
  await click(auto(v));
  assert.equal(auto(v).getAttribute('aria-label'), 'Stop the drone’s tour');
  await tick(14100);
  assert.equal(shot(v), 'The course');
});

test('the keyboard’s arrows change the shot, but not while typing', async () => {
  const v = await mount(h('div', null, h('input', { id: 'in' }), h(VenueView, { lang: 'en', v: CARD, back: null })));
  await press('ArrowRight', document.body);
  assert.equal(shot(v), 'The course');
  await press('ArrowLeft', document.body);
  assert.equal(shot(v), 'The water');
  await press('ArrowRight', v.$('#in'));
  assert.equal(shot(v), 'The water');
});

test('a message from another page is ignored', async () => {
  const v = await venue();
  await tell(new MessageEvent('message', { data: { type: 'live' }, origin: 'https://evil.test', source: v.$('iframe').contentWindow }));
  assert.doesNotMatch(v.$('iframe').className, /\bon\b/);
});

test('a venue’s page in Russian', () => {
  const words = plain(page({}, 'ru'));
  assert.match(words, /Регатная акватория 03 \/ 55 Гёчек Сосновые холмы\./);
  assert.match(words, /Опубликовано 1 Nov 2026/);
  assert.match(words, /Гоняться здесь/);
  assert.deepEqual(englishIn(words, ['race office', 'TUR', 'Nov']), []);
});

// ---------- every venue ----------
const row = (id, name, place, nation, p = {}) => ({ id, name, place, nation, wind: ['SW', 'ЮЗ'], about: [`About ${name[0]}`, `О ${name[1]}`], ...p });
const LIST = [
  row('zadar', ['Zadar', 'Задар'], ['Croatia', 'Хорватия'], 'CRO'),
  row('sydney', ['Sydney', 'Сидней'], ['Australia', 'Австралия'], 'AUS'),
  row('hobart', ['Hobart', 'Хобарт'], ['Tasmania, Australia', 'Тасмания, Австралия'], 'AUS'),
  row('nowhere', ['Atoll', 'Атолл'], ['Pacific, Zanzibar', 'Океан, Занзибар'], 'XXX'),
];
const list = (p = {}) => h(VenuesList, { lang: 'en', list: LIST, today: 'sydney', back: h('a', { href: '/', id: 'bk' }, 'Back'), ...p });
const names = (html) => [...html.matchAll(/class="vs-nm"><b>(.*?)<\/b>/g)].map((m) => m[1]);

test('the venues run by country, then by name', () => {
  assert.deepEqual(names(ssr(list())), ['Hobart', 'Sydney', 'Zadar', 'Atoll']);
});

test('a venue with no flag drawn goes by the last part of its place', () => {
  const html = ssr(list());
  const atoll = html.slice(html.indexOf('/venues/nowhere'));
  assert.match(atoll, /fl-none/);
});

test('in Russian they run by the Russian alphabet', () => {
  assert.deepEqual(names(ssr(list({ lang: 'ru' }))), ['Сидней', 'Хобарт', 'Атолл', 'Задар'], 'Австралия, Занзибар, Хорватия');
});

test('each row is the venue’s own page, numbered, with its wind', () => {
  const html = ssr(list());
  for (const r of LIST) assert.ok(hrefs(html).includes(`/venues/${r.id}`), r.id);
  assert.deepEqual([...html.matchAll(/class="vs-i">(\d+)</g)].map((m) => m[1]), ['01', '02', '03', '04']);
  assert.match(plain(html), /Hobart Tasmania, Australia SW/);
  assert.match(html, /title="About Hobart"/);
});

test('today’s venue is marked in place of its wind', () => {
  const html = ssr(list());
  assert.match(html, /href="\/venues\/sydney"[^>]*aria-current="true"/);
  assert.match(plain(html), /Sydney Australia Today/);
  assert.equal([...html.matchAll(/aria-current="true"/g)].length, 1);
});

test('the head counts the venues and says where the drone is', () => {
  const words = plain(ssr(list()));
  assert.match(words, /Regatta venues · 4 The venues/);
  assert.match(words, /Over Sydney, today’s race/);
  assert.match(words, /The venues · 4/);
});

test('if today’s isn’t on the list the scene is over the first', async () => {
  const v = await mount(list({ today: 'elsewhere' }));
  await tick(5);
  assert.equal(v.$('iframe').getAttribute('src'), '/venues-view?venue=zadar');
  assert.equal(v.$('[aria-current]'), null);
});

test('the scene is today’s venue, with your own boat on it', async () => {
  saveBoat({ ...DEFAULT_BOAT, nat: 'NZL' });
  const v = await mount(list());
  await tick(5);
  const f = v.$('iframe');
  assert.equal(f.getAttribute('src'), '/venues-view?venue=sydney');
  assert.equal(f.title, 'Sydney from the drone');
  await fromFrame(f, { type: 'ready' });
  assert.equal(f.contentWindow.sent.find((m) => m.type === 'look').boat.nat, 'NZL');
});

test('the first frame fades the scene in', async () => {
  const v = await mount(list());
  assert.match(v.$('.bc-load').className, /\bon\b/);
  await fromFrame(v.$('iframe'), { type: 'live' });
  assert.match(v.$('iframe').className, /\bon\b/);
  assert.doesNotMatch(v.$('.bc-load').className, /\bon\b/);
});

test('the scene is told what the card covers', async () => {
  const v = await mount(list());
  v.$('.bt-card').rect = { left: 0, top: 500, width: 1200, height: 300, bottom: 800 };
  v.$('.bt-info').rect = { left: 0, top: 0, width: 1200, height: 200, bottom: 200 };
  await resized();
  const m = v.$('iframe').contentWindow.sent.filter((x) => x.type === 'inset').at(-1);
  assert.deepEqual([m.r, m.b], [0, 300 / 800]);
});

test('a message from another page is ignored by the list too', async () => {
  const v = await mount(list());
  await tell(new MessageEvent('message', { data: { type: 'live' }, origin: 'https://evil.test', source: v.$('iframe').contentWindow }));
  assert.doesNotMatch(v.$('iframe').className, /\bon\b/);
  assert.deepEqual(dom.reported, []);
});

test('the list leads on to a custom race and the guides', () => {
  const links = hrefs(ssr(list()));
  assert.ok(links.includes('/race/free') && links.includes('/learn'));
});

test('the list in Russian', () => {
  const words = plain(ssr(list({ lang: 'ru' })));
  assert.match(words, /Регатные акватории · 4 Акватории/);
  assert.match(words, /Над акваторией Сидней — гонка дня/);
  assert.match(words, /Сидней Австралия Сегодня/);
  assert.deepEqual(englishIn(words, ['Back']), []);
});
