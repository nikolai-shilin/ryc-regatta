// Your boat and how you sail: the boat page, the yachts' tour, the panel every scene page has, and Settings. npm test.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import './load.mjs';
import { blur, click, clock, dom, doing, done, englishIn, fire, fromFrame, h, hrefs, mount, plain, press, reset, resized, settle, signIn, spyRouter, ssr, tell, tick, type } from './fake-dom.mjs';

const { BoatEditor } = await import('../components/boat-editor.tsx');
const { FleetView } = await import('../components/fleet-view.tsx');
const { SailingOpts } = await import('../components/sailing-opts.tsx');
const { NameRow, SettingsForm } = await import('../components/settings-form.tsx');
const { PauseCard } = await import('../components/pause-card.tsx');
const { BOAT_KEY, DEFAULT_BOAT, PRESETS, SWATCHES, readBoat, saveBoat } = await import('../lib/boat.ts');
const { FLAGS } = await import('../lib/flags.ts');
const { YACHTS, yachtOf } = await import('../lib/yachts.ts');
const { DAILY_YACHTS, dailyYacht } = await import('../lib/race.ts');
await import('../public/game/av-menu.js');

beforeEach(() => reset());
afterEach(done);

// ---------- the boat page ----------
const editor = (p = {}) => mount(h(BoatEditor, { lang: 'en', ...p }));
const swatch = (v, group, i = 1) => v.$$(`[aria-labelledby="${group}"] .sw`)[i];
const sent = (v, type) => v.$('iframe').contentWindow.sent.filter((m) => m.type === type);
const saveBtn = (v) => v.$('.bt-save');
const AU = FLAGS.find((f) => f.code === 'au');

test('a first visit shows the club’s boat and saves nothing', async () => {
  const v = await editor();
  assert.equal(v.$('h1').textContent.trim(), 'Your yacht: RYC 1');
  assert.equal(localStorage.getItem(BOAT_KEY), null);
  assert.equal(saveBtn(v).disabled, true);
  assert.equal(saveBtn(v).textContent, 'Saved');
  assert.match(v.$('.bt-saved').textContent, /Kept on this device/);
});

test('the boat you saved is the one that comes up', async () => {
  saveBoat({ ...DEFAULT_BOAT, nat: 'AUS', num: '42', flag: 'au', laminate: false, name: 'Sea Dog' });
  const v = await editor();
  assert.match(v.$('h1').textContent, /AUS 42/);
  assert.equal(v.$('.bt-h-flag').getAttribute('alt'), AU.en);
  assert.equal(v.$('#b-name').value, 'Sea Dog');
  assert.match(plain(v.$('.bt-stats').innerHTML), /Colours Your own Sails Dacron/);
  assert.equal(saveBtn(v).disabled, true, 'nothing to save yet');
});

test('a change shows on her at once and asks to be saved', async () => {
  const v = await editor();
  const c = SWATCHES.hull[1];
  await click(swatch(v, 'l-hull'));
  assert.equal(sent(v, 'look').at(-1).boat.hull, c);
  assert.equal(swatch(v, 'l-hull').getAttribute('aria-checked'), 'true');
  assert.equal(saveBtn(v).textContent, 'Save');
  assert.ok(saveBtn(v).classList.contains('on'));
  assert.match(v.$('.bt-saved').textContent, /Changes not saved yet\./);
  assert.equal(localStorage.getItem(BOAT_KEY), null, 'kept only when you press Save');
});

test('Save keeps her where the game reads her, stamped with when', async () => {
  const v = await editor();
  await click(swatch(v, 'l-hull'));
  await click(saveBtn(v));
  const b = JSON.parse(localStorage.getItem(BOAT_KEY));
  assert.equal(b.hull, SWATCHES.hull[1]);
  assert.equal(b.at, clock.now);
  assert.equal(saveBtn(v).disabled, true);
  assert.match(v.$('.bt-saved').textContent, /Saved\. You race in her from the next start\./);
});

test('a browser that won’t keep her says so, and she stays unsaved', async () => {
  const v = await editor();
  await click(swatch(v, 'l-hull'));
  dom.storageBlocked = true;
  await click(saveBtn(v));
  assert.match(v.$('[role=alert]').textContent, /didn’t keep your yacht/);
  assert.equal(saveBtn(v).disabled, false);
});

test('changing her back to how she was leaves nothing to save', async () => {
  const v = await editor();
  const i = SWATCHES.hull.findIndex((c) => c.toLowerCase() === DEFAULT_BOAT.hull.toLowerCase());
  await click(swatch(v, 'l-hull', (i + 1) % SWATCHES.hull.length));
  assert.equal(saveBtn(v).disabled, false);
  await click(swatch(v, 'l-hull', i));
  assert.equal(saveBtn(v).disabled, true);
});

test('a ready scheme dresses her and is named', async () => {
  const v = await editor();
  const p = PRESETS.find((x) => x.id === 'red');
  const btn = v.$$('.preset').find((b) => b.getAttribute('aria-label') === p.en);
  await click(btn);
  assert.equal(btn.getAttribute('aria-pressed'), 'true');
  assert.equal(sent(v, 'look').at(-1).boat.hull, p.boat.hull);
  assert.match(plain(v.$('.bt-stats').innerHTML), new RegExp(`Colours ${p.en}`));
  await click(swatch(v, 'l-hull'));
  assert.match(plain(v.$('.bt-stats').innerHTML), /Colours Your own/, 'a change makes her your own');
});

test('Back to the RYC colours keeps her name', async () => {
  saveBoat({ ...DEFAULT_BOAT, hull: '#b0202b', name: 'Sea Dog' });
  const v = await editor();
  await click(v.$('.bt-mini[title="Back to the RYC colours"]'));
  const b = sent(v, 'look').at(-1).boat;
  assert.equal(b.hull, DEFAULT_BOAT.hull);
  assert.equal(b.name, 'Sea Dog');
});

test('the sail’s letters are capitals and its number digits', async () => {
  const v = await editor();
  await type(v.$('[aria-label="Letters on the sail"]'), 'a1b');
  assert.equal(v.$('[aria-label="Letters on the sail"]').value, 'AB');
  await type(v.$('[aria-label="Letters on the sail"]'), 'рус');
  assert.equal(v.$('[aria-label="Letters on the sail"]').value, 'РУС');
  await type(v.$('#b-num'), '4x2');
  assert.equal(v.$('#b-num').value, '42');
  assert.match(v.$('h1').textContent, /РУС 42/);
});

test('a sail left with no number goes back to 1', async () => {
  const v = await editor();
  await doing(() => v.$('#b-num').focus());
  await type(v.$('#b-num'), '');
  assert.match(v.$('h1').textContent, /RYC 1/, 'the heading never reads blank');
  await blur(v.$('#b-num'));
  assert.equal(v.$('#b-num').value, '1');
});

test('her name is cleaned as it is typed and trimmed when left', async () => {
  const v = await editor();
  const name = v.$('#b-name');
  await doing(() => name.focus());
  await type(name, ' Sea<>  Dog ');
  assert.equal(v.$('#b-name').value, ' Sea Dog ');
  await blur(v.$('#b-name'));
  assert.equal(v.$('#b-name').value, 'Sea Dog');
  await type(v.$('#b-name'), 'x'.repeat(30));
  assert.equal(v.$('#b-name').value.length, 16);
});

test('the gennaker goes to two and three colours and back, each new one different', async () => {
  saveBoat({ ...DEFAULT_BOAT, kite: '#f4f3ef', kite2: undefined });
  const v = await editor();
  const bands = (n) => v.$$('[aria-labelledby="l-kite"].bt-pills button')[n - 1];
  await click(bands(2));
  let b = sent(v, 'look').at(-1).boat;
  assert.equal(b.kite2, '#1c1f24', 'dark against a white first colour');
  assert.equal(sent(v, 'pose').at(-1).down, true, 'she bears away to show it');
  await click(bands(3));
  b = sent(v, 'look').at(-1).boat;
  assert.ok(b.kite3 && ![b.kite, b.kite2].includes(b.kite3));
  assert.equal(v.$('#l-kite3').textContent, 'Third');
  await click(bands(1));
  b = sent(v, 'look').at(-1).boat;
  assert.deepEqual([b.kite2, b.kite3], [undefined, undefined]);
  assert.equal(v.$('#l-kite2'), null);
});

test('upwind and gennaker turn the boat in the scene', async () => {
  const v = await editor();
  const [up, down] = v.$$('.bt-seg [role=radio]');
  await click(down);
  assert.equal(sent(v, 'pose').at(-1).down, true);
  assert.equal(down.getAttribute('aria-checked'), 'true');
  await click(up);
  assert.equal(sent(v, 'pose').at(-1).down, false);
});

test('deck and sailcloth are chosen by name', async () => {
  const v = await editor();
  await click(v.$$('[aria-labelledby="l-deck"] button').find((b) => b.textContent === 'Teak'));
  assert.equal(sent(v, 'look').at(-1).boat.deck, 'teak');
  await click(v.$$('[aria-labelledby="l-sails"] button').find((b) => b.textContent === 'Dacron'));
  assert.equal(sent(v, 'look').at(-1).boat.laminate, false);
  assert.match(plain(v.$('.bt-stats').innerHTML), /Sails Dacron/);
});

test('colours are named for a screen reader', async () => {
  const v = await editor();
  assert.equal(v.$$('[aria-labelledby="l-hull"] .sw')[0].getAttribute('aria-label'), PRESETS[0].en);
  const ink = v.$$('[aria-labelledby="l-ink"] .sw');
  assert.equal(ink[0].getAttribute('aria-label'), 'White');
  assert.equal(ink[1].getAttribute('aria-label'), 'Black');
});

// ---------- the flag ----------
const fp = (v) => v.$('.fp-btn');
const options = (v) => v.$$('.fp-o');

test('the flag list opens on a search, No flag first and the countries A to Z', async () => {
  const v = await editor();
  assert.equal(fp(v).textContent.trim(), 'No flag');
  await click(fp(v));
  assert.equal(fp(v).getAttribute('aria-expanded'), 'true');
  assert.equal(options(v).length, FLAGS.length + 1);
  assert.equal(options(v)[0].textContent, 'No flag');
  const names = options(v).slice(1).map((o) => o.querySelector('.fp-name').textContent);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  assert.equal(document.activeElement, v.$('.fp-q'));
});

test('picking a flag puts her country’s letters on the sail', async () => {
  const v = await editor();
  await click(fp(v));
  await click(v.$('#fp-o-au'));
  assert.equal(v.$('.fp-pop'), null);
  assert.match(fp(v).textContent, new RegExp(`${AU.en}${AU.ioc}`));
  assert.equal(v.$('[aria-label="Letters on the sail"]').value, AU.ioc);
  assert.equal(document.activeElement, fp(v), 'the focus comes back to the button');
});

test('No flag takes it down and leaves the letters', async () => {
  saveBoat({ ...DEFAULT_BOAT, flag: 'au', nat: 'AUS' });
  const v = await editor();
  await click(fp(v));
  await click(v.$('#fp-o-none'));
  assert.equal(sent(v, 'look').at(-1).boat.flag, undefined);
  assert.equal(v.$('[aria-label="Letters on the sail"]').value, 'AUS');
});

test('the search finds a country by its name, letters or code', async () => {
  const v = await editor();
  await click(fp(v));
  await type(v.$('.fp-q'), 'austral');
  assert.deepEqual(options(v).map((o) => o.id), ['fp-o-au']);
  await type(v.$('.fp-q'), AU.ioc.toLowerCase());
  assert.ok(options(v).some((o) => o.id === 'fp-o-au'));
  await type(v.$('.fp-q'), AU.ru.slice(0, 5));
  assert.ok(options(v).some((o) => o.id === 'fp-o-au'));
  await type(v.$('.fp-q'), 'atlantis');
  assert.equal(options(v).length, 0);
  assert.equal(v.$('.fp-empty').textContent, 'No such country here');
});

test('Enter on an empty search picks nothing', async () => {
  const v = await editor();
  await click(fp(v));
  await type(v.$('.fp-q'), 'atlantis');
  await press('Enter', v.$('.fp-q'));
  assert.ok(v.$('.fp-pop'), 'still open');
});

test('the arrows move through the list and Enter picks', async () => {
  const v = await editor();
  await press('ArrowDown', fp(v));
  assert.ok(v.$('.fp-pop'), 'the arrow opens it');
  const q = v.$('.fp-q');
  assert.equal(q.getAttribute('aria-activedescendant'), 'fp-o-none');
  await press('ArrowUp', q);
  assert.equal(q.getAttribute('aria-activedescendant'), 'fp-o-none', 'it stops at the top');
  await press('ArrowDown', q);
  const second = options(v)[1];
  assert.equal(q.getAttribute('aria-activedescendant'), second.id);
  assert.ok(second.classList.contains('hi'));
  await press('Enter', q);
  assert.equal(sent(v, 'look').at(-1).boat.flag, second.id.replace('fp-o-', ''));
});

test('Escape and a tap elsewhere close the list', async () => {
  const v = await editor();
  await click(fp(v));
  await press('Escape', v.$('.fp-q'));
  assert.equal(v.$('.fp-pop'), null);
  assert.equal(document.activeElement, fp(v));
  await click(fp(v));
  await fire(v.$('.fp-q'), 'pointerdown');
  assert.ok(v.$('.fp-pop'), 'a tap inside keeps it');
  await fire(v.$('h1'), 'pointerdown');
  assert.equal(v.$('.fp-pop'), null);
});

test('the pointer lights the country it is over', async () => {
  const v = await editor();
  await click(fp(v));
  await fire(options(v)[3], 'pointermove');
  assert.ok(options(v)[3].classList.contains('hi'));
});

// ---------- leaving, and the account's boat ----------
test('leaving with changes asks first, and staying stays', async () => {
  const v = await editor();
  await click(swatch(v, 'l-hull'));
  dom.confirmAnswer = false;
  await click(v.$('a[href="/yachts"]'));
  assert.deepEqual(dom.confirms, ['Leave without saving your yacht? Your changes will be lost.']);
  assert.deepEqual(dom.followed, []);
  dom.confirmAnswer = true;
  await click(v.$('a[href="/yachts"]'));
  assert.deepEqual(dom.followed, ['/yachts']);
});

test('with nothing changed leaving asks nothing', async () => {
  const v = await editor();
  await click(v.$('a[href="/yachts"]'));
  assert.deepEqual(dom.confirms, []);
});

test('closing the tab with changes is warned about', async () => {
  const v = await editor();
  const quiet = new Event('beforeunload', { cancelable: true });
  await tell(quiet);
  assert.equal(quiet.defaultPrevented, false);
  await click(swatch(v, 'l-hull'));
  const e = new Event('beforeunload', { cancelable: true });
  await tell(e);
  assert.equal(e.defaultPrevented, true);
});

test('going to race in her saves her on the way, without asking', async () => {
  const v = await editor();
  await click(swatch(v, 'l-hull'));
  await click(v.$('.bt-go'));
  assert.deepEqual(dom.confirms, []);
  assert.deepEqual(dom.followed, ['/play?race=today']);
  assert.equal(readBoat().hull, SWATCHES.hull[1]);
});

test('a boat that can’t be saved doesn’t go racing', async () => {
  const v = await editor();
  await click(swatch(v, 'l-hull'));
  dom.storageBlocked = true;
  await click(v.$('.bt-go'));
  assert.deepEqual(dom.followed, []);
  assert.ok(v.$('[role=alert]'));
});

test('the account’s boat, just arrived, is shown', async () => {
  const v = await editor();
  saveBoat({ ...DEFAULT_BOAT, nat: 'NZL' });
  await tell(new Event('regatta-boat'));
  assert.match(v.$('h1').textContent, /NZL 1/);
  assert.equal(saveBtn(v).disabled, true);
});

test('in the middle of changing her, your changes stay over the account’s', async () => {
  const v = await editor();
  await click(swatch(v, 'l-hull'));
  saveBoat({ ...DEFAULT_BOAT, nat: 'NZL' });
  await tell(new Event('regatta-boat'));
  assert.match(v.$('h1').textContent, /RYC 1/);
  assert.equal(saveBtn(v).disabled, false);
});

test('saving signed in sends her to the account', async () => {
  signIn();
  const updates = [];
  globalThis.__supabase = { auth: { getUser: async () => ({ data: { user: { user_metadata: {} } } }), updateUser: async (u) => { updates.push(u); return {}; } } };
  const v = await editor();
  await click(swatch(v, 'l-hull'));
  await click(saveBtn(v));
  await settle();
  assert.equal(updates[0].data.boat.hull, SWATCHES.hull[1]);
});

// ---------- the scene ----------
test('the scene starts once the page is up and gets the boat when it is ready', async () => {
  saveBoat({ ...DEFAULT_BOAT, nat: 'NZL' });
  const v = await editor();
  await tick(5);
  const f = v.$('iframe');
  assert.equal(f.getAttribute('src'), '/boat-view?wind=light');
  f.contentWindow.sent.length = 0;
  await fromFrame(f, { type: 'ready' });
  assert.deepEqual(f.contentWindow.sent.map((m) => m.type).slice(0, 2), ['look', 'pose']);
  assert.equal(sent(v, 'look')[0].boat.nat, 'NZL');
  const thumbs = sent(v, 'thumbs')[0];
  assert.equal(thumbs.items.length, PRESETS.length);
  assert.deepEqual([thumbs.items[0].boat.nat, thumbs.items[0].boat.num], ['', '']);
});

test('the presets’ pictures are drawn once and kept for the session', async () => {
  let v = await editor();
  await fromFrame(v.$('iframe'), { type: 'ready' });
  await fromFrame(v.$('iframe'), { type: 'thumbs', shots: { red: 'data:image/png;base64,AA' } });
  const red = v.$$('.preset').find((b) => b.getAttribute('aria-label') === 'Red');
  assert.equal(red.querySelector('img').getAttribute('src'), 'data:image/png;base64,AA');
  await fromFrame(v.$('iframe'), { type: 'ready' });
  assert.equal(sent(v, 'thumbs').length, 1, 'asked once');
  await v.unmount();
  v = await editor();
  await fromFrame(v.$('iframe'), { type: 'ready' });
  assert.equal(sent(v, 'thumbs').length, 0, 'the next visit has them');
  assert.ok(v.$('.preset img'));
});

test('the first frame takes the loading bar and the poster away', async () => {
  const v = await editor();
  assert.match(v.$('.bc-load').className, /\bon\b/);
  await fromFrame(v.$('iframe'), { type: 'live' });
  assert.doesNotMatch(v.$('.bc-load').className, /\bon\b/);
  assert.doesNotMatch(v.$('.bt-poster').className, /\bon\b/);
});

test('the scene is told what the card covers, so she stands in the rest', async () => {
  const v = await editor();
  v.$('.bt-card').rect = { left: 880, top: 0, width: 400, height: 800, bottom: 800 };
  v.$('.bt-info').rect = { left: 0, top: 0, width: 800, height: 400, bottom: 400 };
  await resized();
  const m = sent(v, 'inset').at(-1);
  assert.equal(m.r, (1280 - 880) / 1280);
  assert.equal(m.l, 0);
});

test('on an upright screen the card covers the foot instead', async () => {
  const v = await editor();
  v.$('.bt-card').rect = { left: 0, top: 500, width: 1200, height: 300, bottom: 800 };
  v.$('.bt-info').rect = { left: 0, top: 0, width: 1200, height: 200, bottom: 200 };
  await resized();
  const m = sent(v, 'inset').at(-1);
  assert.deepEqual([m.r, m.b, m.t], [0, 300 / 800, 200 / 800]);
});

test('a message from another page is ignored', async () => {
  const v = await editor();
  await tell(new MessageEvent('message', { data: { type: 'live' }, origin: 'https://evil.test', source: v.$('iframe').contentWindow }));
  assert.match(v.$('.bc-load').className, /\bon\b/);
});

test('the boat page in Russian', async () => {
  const v = await editor({ lang: 'ru' });
  for (const w of ['Твоя яхта', 'В гонку дня', 'Готовые схемы', 'Корпус', 'Днище', 'Палуба', 'Генакер', 'Флаг на гроте', 'Номер на парусе', 'Имя на корпусе', 'Без флага', 'Сохранено']) assert.ok(v.text().includes(w), w);
  assert.deepEqual(englishIn(v.text()), []);
});

// ---------- the yachts ----------
const fleet = (p = {}) => mount(h(FleetView, { lang: 'en', start: 'laser', back: h('a', { href: '/race', id: 'bk' }), ...p }));
const I = (id) => YACHTS.findIndex((y) => y.id === id);
const lastSent = (v) => v.$('iframe').contentWindow.sent.filter((m) => ['focus', 'overview'].includes(m.type)).at(-1);
const nextOf = (id, k = 1) => YACHTS[(I(id) + k + YACHTS.length) % YACHTS.length];

test('a yacht is shown with her place in the fleet, her numbers and what she is', () => {
  const y = yachtOf('laser'), html = ssr(h(FleetView, { lang: 'en', start: 'laser', back: null }));
  const words = plain(html);
  assert.ok(words.includes(`${String(I('laser') + 1).padStart(2, '0')} / ${String(YACHTS.length).padStart(2, '0')}`));
  assert.ok(words.includes(`Upwind ${y.speed.up} kn Downwind ${y.speed.down} kn`));
  assert.ok(words.includes(y.about[0][0]));
  assert.ok(hrefs(html).includes('/yachts/laser'));
});

test('with none picked the page is about the whole fleet', () => {
  const words = plain(ssr(h(FleetView, { lang: 'en', start: null, back: null })));
  assert.match(words, /All yachts/);
  assert.match(words, /Every yacht/);
  assert.match(words, /Pick one to fly to her\./);
});

test('speeds take the Russian comma', () => {
  const y = YACHTS.find((x) => !Number.isInteger(x.speed.up));
  const words = plain(ssr(h(FleetView, { lang: 'ru', start: y.id, back: null })));
  assert.ok(words.includes(`${String(y.speed.up).replace('.', ',')} уз`));
  assert.ok(!words.includes(`${y.speed.up} уз`));
});

test('next and previous fly to the neighbouring yacht and go round the ends', async () => {
  const v = await fleet({ start: YACHTS.at(-1).id, tour: false });
  await click(v.$('[aria-label="Next yacht"]'));
  assert.deepEqual(lastSent(v), { type: 'focus', id: YACHTS[0].id });
  assert.equal(v.$('h1').textContent, YACHTS[0].name[0]);
  await click(v.$('[aria-label="Previous yacht"]'));
  assert.deepEqual(lastSent(v), { type: 'focus', id: YACHTS.at(-1).id });
});

test('the address follows the yacht picked, keeping the rest of it', async () => {
  reset({ url: 'https://updown.test/yachts?from=free' });
  const v = await fleet({ tour: false });
  await click(v.$$('.fl-boat')[0]);
  assert.equal(history.replaced.at(-1), `/yachts?from=free&y=${YACHTS[0].id}`);
  assert.equal(v.$$('.fl-boat')[0].getAttribute('aria-checked'), 'true');
  await click(v.$('.fl-all'));
  assert.equal(history.replaced.at(-1), '/yachts?from=free');
  assert.deepEqual(lastSent(v), { type: 'overview' });
  assert.equal(v.$('h1').textContent, 'Every yacht');
  assert.equal(v.$('.fl-all').getAttribute('aria-pressed'), 'true');
});

test('the keyboard’s arrows move through the yachts, but not while typing', async () => {
  const v = await mount(h('div', null, h('input', { id: 'in' }), h(FleetView, { lang: 'en', start: 'laser', back: null })));
  await press('ArrowRight', document.body);
  assert.deepEqual(lastSent(v), { type: 'focus', id: nextOf('laser').id });
  assert.equal(v.$('.fl-ctl [aria-pressed]').getAttribute('aria-pressed'), 'false', 'the tour stops');
  await press('ArrowLeft', document.body);
  assert.deepEqual(lastSent(v), { type: 'focus', id: 'laser' });
  const n = v.$('iframe').contentWindow.sent.length;
  await press('ArrowRight', v.$('#in'));
  assert.equal(v.$('iframe').contentWindow.sent.length, n);
});

test('the tour moves on a while after the drone arrives', async () => {
  const v = await fleet();
  await fromFrame(v.$('iframe'), { type: 'arrived', id: 'laser' });
  await tick(8900);
  assert.equal(v.$('h1').textContent, yachtOf('laser').name[0]);
  await tick(200);
  assert.equal(v.$('h1').textContent, nextOf('laser').name[0]);
});

test('the tour waits for the drone', async () => {
  const v = await fleet();
  await tick(30000);
  assert.equal(v.$('h1').textContent, yachtOf('laser').name[0]);
});

test('taking hold of the view stops the tour, and play starts it again', async () => {
  const v = await fleet();
  const play = () => v.$('.fl-ctl [aria-pressed]');
  assert.equal(play().getAttribute('aria-label'), 'Stop the tour');
  await fromFrame(v.$('iframe'), { type: 'arrived', id: 'laser' });
  await fromFrame(v.$('iframe'), { type: 'touched' });
  assert.equal(play().getAttribute('aria-label'), 'Tour the fleet');
  await tick(20000);
  assert.equal(v.$('h1').textContent, yachtOf('laser').name[0]);
  await click(play());
  assert.equal(play().getAttribute('aria-pressed'), 'true');
  await tick(9100);
  assert.equal(v.$('h1').textContent, nextOf('laser').name[0]);
});

test('play from the whole fleet flies back to the last yacht', async () => {
  const v = await fleet({ tour: false });
  await click(v.$('.fl-all'));
  await click(v.$('.fl-ctl [aria-pressed]:not(.fl-all)'));
  assert.deepEqual(lastSent(v), { type: 'focus', id: 'laser' });
});

test('once the scene is up the drone flies to the first yacht', async () => {
  const v = await fleet({ start: null });
  await fromFrame(v.$('iframe'), { type: 'ready' });
  await fromFrame(v.$('iframe'), { type: 'live' });
  assert.match(v.$('iframe').className, /\bon\b/);
  await tick(1400);
  assert.deepEqual(lastSent(v), { type: 'focus', id: YACHTS[0].id });
});

test('asking for the whole fleet keeps the drone home', async () => {
  const v = await fleet({ start: null });
  await click(v.$('.fl-all'));
  await fromFrame(v.$('iframe'), { type: 'live' });
  await tick(2000);
  assert.deepEqual(lastSent(v), { type: 'overview' });
});

test('Race her keeps the yacht and opens the set-up with her', async () => {
  const v = await fleet();
  assert.equal(v.$('.bt-go').textContent, `Race the ${yachtOf('laser').name[0]}`);
  await click(v.$('.bt-go'));
  assert.equal(JSON.parse(localStorage.getItem('regatta')).yacht, 'laser');
  assert.deepEqual(location.assigned, ['/race/free?yacht=laser']);
});

test('today’s yacht says so and leads to today’s race', async () => {
  const t = dailyYacht();
  const v = await fleet({ start: t });
  assert.match(v.$('.bt-hint').textContent, /Today’s race is sailed in her/);
  assert.ok(v.$('a[href="/play?race=today"]'));
});

test('another yacht says which is today’s, and whether her days come round', async () => {
  const t = dailyYacht();
  const inTurn = YACHTS.find((y) => y.id !== t && y.id in DAILY_YACHTS), never = YACHTS.find((y) => y.id !== t && !(y.id in DAILY_YACHTS));
  const v = await fleet({ start: inTurn.id });
  assert.ok(v.$('.bt-hint').textContent.includes(`today’s race does on her days: a new yacht every day, today the ${yachtOf(t).name[0]}.`));
  await v.unmount();
  if (!never) return; // every yacht has her days at present
  const w = await fleet({ start: never.id });
  assert.ok(w.$('.bt-hint').textContent.includes(`Today’s race is sailed in a new yacht every day: today the ${yachtOf(t).name[0]}.`));
});

test('upwind and downwind turn the fleet in the scene', async () => {
  const v = await fleet();
  await click(v.$$('.bt-seg [role=radio]')[1]);
  assert.deepEqual(v.$('iframe').contentWindow.sent.filter((m) => m.type === 'pose').at(-1), { type: 'pose', down: true });
});

test('on a yacht’s own page the strip is links and the address is hers', async () => {
  reset({ url: 'https://updown.test/yachts/laser' });
  const v = await fleet({ own: true, tour: false, foot: h('p', { id: 'by' }, 'By RYC') });
  assert.equal(v.$$('a.fl-boat')[0].getAttribute('href'), `/yachts/${YACHTS[0].id}`);
  assert.ok(v.$('#by'));
  assert.equal(v.$('.hm-src'), null, 'she is on her own page already');
  await click(v.$$('a.fl-boat')[0]);
  assert.deepEqual(dom.followed, [], 'flown to, not followed');
  assert.equal(history.replaced.at(-1), `/yachts/${YACHTS[0].id}`);
  await click(v.$('.bt-all'));
  assert.equal(history.replaced.at(-1), '/yachts');
});

test('a click for a new tab on the strip is left to the browser', async () => {
  const v = await fleet({ own: true, tour: false, lang: 'ru' });
  assert.equal(v.$$('a.fl-boat')[0].getAttribute('href'), `/yachts/${YACHTS[0].id}?lang=ru`);
  await click(v.$$('a.fl-boat')[0], { metaKey: true });
  assert.equal(dom.followed.length, 1);
  await click(v.$('.bt-all'), { ctrlKey: true });
  assert.equal(dom.followed.length, 2);
});

test('the yachts in Russian', async () => {
  const y = yachtOf('laser');
  const v = await fleet({ lang: 'ru' });
  assert.equal(v.$('h1').textContent, y.name[1]);
  assert.equal(v.$('.bt-go').textContent, `В гонку на ${y.name[1]}`);
  for (const w of ['Яхты', 'Бейдевинд', 'Попутный', 'О яхте', 'В игре', 'Характеристики', 'Скорости при ветре 12 уз']) assert.ok(v.text().includes(w), w);
  for (const w of ['Upwind', 'Downwind', 'About her', 'Specifications']) assert.ok(!v.text().includes(w), w);
});

// ---------- how you sail ----------
const group = (v, id) => v.$$(`[aria-labelledby="l-${id}"] button`);
const checked = (b) => b.getAttribute('aria-checked') === 'true';

test('the rows show the game’s defaults before anything is chosen', () => {
  const html = ssr(h(SailingOpts, { lang: 'en' }));
  assert.match(plain(html), /Sails I trim Auto Main \+ jib Camera Drone Top Helm Guides on the water/);
  assert.doesNotMatch(plain(html), /Ghost/);
});

test('what you chose before is what shows', async () => {
  localStorage.setItem('regatta', JSON.stringify({ autoTrim: 2, camera: 'helm', guides: 0 }));
  const v = await mount(h(SailingOpts, { lang: 'en' }));
  assert.equal(group(v, 'autoTrim').find(checked).textContent, 'Main + jib');
  assert.equal(group(v, 'camera').find(checked).textContent, 'Helm');
  assert.equal(v.$('[aria-labelledby="l-guides"]').getAttribute('aria-checked'), 'false');
});

test('a choice is saved at once where the game reads it', async () => {
  const v = await mount(h(SailingOpts, { lang: 'en' }));
  await click(group(v, 'camera')[1]);
  assert.equal(JSON.parse(localStorage.getItem('regatta')).camera, 'top');
  assert.ok(checked(group(v, 'camera')[1]));
  assert.ok(!checked(group(v, 'camera')[0]));
});

test('choosing how the sails trim marks it as your own choice', async () => {
  const v = await mount(h(SailingOpts, { lang: 'en' }));
  await click(group(v, 'autoTrim')[0]);
  const o = JSON.parse(localStorage.getItem('regatta'));
  assert.deepEqual([o.autoTrim, o.trimV], [0, 1]);
});

test('the guides switch turns on and off', async () => {
  const v = await mount(h(SailingOpts, { lang: 'en' }));
  const guides = v.$('[aria-labelledby="l-guides"]');
  await click(guides);
  assert.equal(guides.getAttribute('aria-checked'), 'false');
  assert.equal(JSON.parse(localStorage.getItem('regatta')).guides, 0);
  await click(guides);
  assert.equal(JSON.parse(localStorage.getItem('regatta')).guides, 1);
});

test('how you sail, in Russian', () => {
  const words = plain(ssr(h(SailingOpts, { lang: 'ru' })));
  assert.match(words, /Паруса Сам Авто Грот \+ стаксель Камера Дрон Сверху Штурвал/);
  assert.deepEqual(englishIn(words), []);
});

// ---------- the panel ----------
const panel = (p = {}, kids = h('p', { id: 'kid' }, 'Inside')) => mount(h(PauseCard, { lang: 'en', back: '/race/free?from=today', title: 'Set up', ...p }, kids));

test('the panel has its title, what it holds and the way to your boat and the yachts', async () => {
  const v = await panel({ note: 'Page 1', action: h('button', { id: 'go' }, 'Go'), tools: h('i', { id: 'tool' }), busy: true });
  assert.equal(v.$('.bt-card-t').textContent, 'Set up');
  assert.equal(v.$('.bt-card-n').textContent, 'Page 1');
  assert.ok(v.$('#go') && v.$('#kid') && v.$('#tool'));
  assert.deepEqual(v.$$('.bt-dock-b a').map((a) => a.getAttribute('href')), ['/boat', '/yachts']);
  assert.equal(v.$('.bt-card').getAttribute('aria-busy'), 'true');
  assert.equal(v.$('.bt-card').getAttribute('aria-labelledby'), v.$('.bt-card-t').id);
});

test('its foot can lead elsewhere, by name or to an address of its own', async () => {
  const v = await panel({ foot: ['venues', ['yachts', '/yachts?y=laser']] });
  assert.deepEqual(v.$$('.bt-dock-b a').map((a) => [a.getAttribute('href'), a.textContent]), [['/venues', 'The venues'], ['/yachts?y=laser', 'The yachts']]);
});

const openSettings = async (v) => { await click(v.$$('.bt-dock-b button').at(-1)); };

test('Settings opens in the panel, in place of what it holds', async () => {
  const v = await panel({ action: h('button', { id: 'go' }, 'Go') });
  await openSettings(v);
  assert.ok(v.$('.bt-set'));
  assert.ok(v.$('#kid').parentNode.hidden, 'kept, but out of sight');
  assert.equal(v.$('#go'), null);
  assert.equal(v.$('.bt-dock-b'), null);
  assert.equal(document.activeElement, v.$('.bt-row-back'));
});

test('Back and Escape return from Settings', async () => {
  const v = await panel();
  await openSettings(v);
  await click(v.$('.bt-row-back'));
  assert.equal(v.$('.bt-set'), null);
  assert.equal(v.$('#kid').parentNode.hidden, false);
  await openSettings(v);
  await press('Escape');
  assert.equal(v.$('.bt-set'), null);
});

test('the language switch comes back to this page', async () => {
  const v = await panel();
  await openSettings(v);
  const [en, ru] = v.$$('.bt-seg a');
  assert.equal(en.getAttribute('href'), '/lang?to=en&back=%2Frace%2Ffree%3Ffrom%3Dtoday');
  assert.equal(ru.getAttribute('href'), '/lang?to=ru&back=%2Frace%2Ffree%3Ffrom%3Dtoday');
  assert.equal(en.getAttribute('aria-current'), 'true');
  assert.equal(ru.getAttribute('aria-current'), null);
});

test('a guest is told times stay here and offered to sign in', async () => {
  const v = await panel();
  await openSettings(v);
  assert.match(v.$('.bt-acct').textContent, /Guest.*Times stay on this device/);
  assert.equal(v.$('.bt-acct a').getAttribute('href'), '/sign-in?next=%2Frace%2Ffree%3Ffrom%3Dtoday');
});

test('signed in, the panel says who, how, and offers the name and signing out', async () => {
  signIn({ name: 'Anna Petrova', email: 'anna@example.com', provider: 'google' });
  const v = await panel();
  await openSettings(v);
  assert.equal(v.$('.bt-av').textContent, 'AP');
  assert.equal(plain(v.$('.bt-acct-t').innerHTML), 'Anna Petrova anna@example.com · Google');
  assert.equal(v.$('.bt-acct a').getAttribute('href'), '/sign-in/name?next=%2Frace%2Ffree%3Ffrom%3Dtoday');
  assert.equal(v.$('.bt-acct form').getAttribute('action'), '/auth/sign-out');
});

test('a Telegram player with no name set shows no address', async () => {
  signIn({ name: '', email: '7@tg.local', telegram: true });
  const v = await panel();
  await openSettings(v);
  assert.equal(plain(v.$('.bt-acct-t small').innerHTML), 'Telegram');
});

test('the panel in Russian', async () => {
  const v = await panel({ lang: 'ru', title: 'Настрой' });
  assert.deepEqual(v.$$('.bt-dock-b a').map((a) => a.textContent), ['Твоя яхта', 'Яхты']);
  await openSettings(v);
  for (const w of ['Настройки', 'Назад', 'Яхта', 'Язык', 'Аккаунт', 'Гость', 'Войти']) assert.ok(v.text().includes(w), w);
});

// ---------- Settings ----------
const fakeUser = (error = null) => { const calls = []; globalThis.__supabase = { calls, auth: { updateUser: async (u) => { calls.push(u); return { error }; } } }; return calls; };
const nameRow = (p = {}) => mount(h(NameRow, { lang: 'en', name: 'Anna P.', ...p }));

test('the name has no Save until it is changed', async () => {
  const v = await nameRow();
  assert.equal(v.$('#set-name').value, 'Anna P.');
  assert.equal(v.$('button'), null);
  assert.match(v.text(), /Only this name is public\./);
  await type(v.$('#set-name'), 'Anna K.');
  assert.equal(v.$('button').textContent, 'Save');
});

test('a name of one letter is refused', async () => {
  const calls = fakeUser();
  const v = await nameRow();
  await type(v.$('#set-name'), 'A');
  await click(v.$('button'));
  assert.equal(v.$('[role=alert]').textContent, 'Two letters at least.');
  assert.equal(calls.length, 0);
});

test('a new name is saved without its emoji, and the page drawn again', async () => {
  const calls = fakeUser(), router = spyRouter();
  const v = await nameRow();
  await type(v.$('#set-name'), 'Anna 🚀 K.');
  await click(v.$('button'));
  assert.deepEqual(calls, [{ data: { display_name: 'Anna K.' } }]);
  assert.equal(v.$('[role=status]').textContent, 'Saved. The ranking shows this name now.');
  assert.equal(v.$('#set-name').value, 'Anna K.');
  assert.equal(router.refreshed, 1);
});

test('a name that can’t be saved says so', async () => {
  fakeUser({ message: 'no' });
  const router = spyRouter();
  const v = await nameRow({ lang: 'ru' });
  await type(v.$('#set-name'), 'Анна');
  await click(v.$('button'));
  assert.equal(v.$('[role=alert]').textContent, 'Не удалось сохранить. Попробуй ещё раз.');
  assert.equal(router.refreshed, 0);
});

test('typing again clears the last message', async () => {
  const v = await nameRow();
  await type(v.$('#set-name'), 'A');
  await click(v.$('button'));
  await type(v.$('#set-name'), 'An');
  assert.equal(v.$('[role=alert]'), null);
});

test('the name follows the account when the page is drawn again', async () => {
  const v = await nameRow();
  await v.rerender(h(NameRow, { lang: 'en', name: 'Bo B.' }));
  assert.equal(v.$('#set-name').value, 'Bo B.');
});

const settings = (p = {}) => mount(h(SettingsForm, { lang: 'en', langSeg: h('nav', { id: 'seg' }), account: h('div', { id: 'acct' }), ...p }));

test('Settings holds the account, your boat, how you sail and Audio & graphics', async () => {
  const v = await settings();
  assert.ok(v.$('#acct') && v.$('#seg'));
  for (const w of ['Account', 'Your yacht', 'Language', 'Sailing', 'Audio & graphics']) assert.ok(v.text().includes(w), w);
  assert.equal(v.text().includes('Yacht name'), false, 'her name is set on the boat page');
});

test('your boat’s line shows her flag and sail number and leads to her', async () => {
  saveBoat({ ...DEFAULT_BOAT, nat: 'AUS', num: '7', flag: 'au' });
  const v = await settings();
  const a = v.$('.st-boat');
  assert.equal(a.getAttribute('href'), '/boat?from=settings');
  assert.equal(a.querySelector('b').textContent, 'AUS 7');
  assert.equal(a.querySelector('img').getAttribute('alt'), AU.en);
});

test('a boat with no flag has a blank, and one from the account shows when it comes', async () => {
  const v = await settings({ lang: 'ru' });
  assert.equal(v.$('.st-boat b').textContent, 'RYC 1');
  assert.ok(v.$('.st-boat .fl-none'));
  saveBoat({ ...DEFAULT_BOAT, nat: 'AUS', flag: 'au' });
  await tell(new Event('regatta-boat'));
  assert.equal(v.$('.st-boat b').textContent, 'AUS 1');
  assert.equal(v.$('.st-boat img').getAttribute('alt'), AU.ru);
});

test('Settings in Russian', async () => {
  const v = await settings({ lang: 'ru' });
  for (const w of ['Аккаунт', 'Твоя яхта', 'Цвета, флаг и номер', 'Изменить', 'Язык', 'Яхта', 'Звук и графика']) assert.ok(v.text().includes(w), w);
  assert.deepEqual(englishIn(v.text()), []);
});
