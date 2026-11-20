// Home and what runs on every page: the header's menu, your row on today's board, the strip for a returning player, the
// daily reminder, signing in from Telegram, and your bests and boat following you between devices. npm test.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from './load.mjs';
import { click, clock, doing, dom, done, englishIn, fire, h, intersect, json, mount, plain, reset, serve, settle, signIn, spyRouter, ssr, tell, tick } from './fake-dom.mjs';

mock('lib/push.ts', `const p = () => globalThis.__push;
export const pushable = () => p().able;
export const currentSub = async () => { if (p().subError) throw new Error('no'); return p().sub; };
export const subscribe = async (lang) => { p().calls.push(['subscribe', lang]); return p().result; };
export const unsubscribe = async () => { p().calls.push(['unsubscribe']); };
export const pushSync = async (lang) => { p().calls.push(['sync', lang]); };`);

const { SiteMenu, MyRow, HeroScene, Countdown, Dock, Ticker } = await import('../components/home-client.tsx');
const { markBack, BackStrip, PushButton, PushSync, CtaTrack, Fold, MatchLink } = await import('../components/home-back.tsx');
const { TelegramSignIn } = await import('../components/telegram-sign-in.tsx');
const { BestsSync, syncAccount } = await import('../components/bests-sync.tsx');
const { DEFAULT_BOAT, BOAT_KEY, saveBoat } = await import('../lib/boat.ts');
const { dailyVenue, dailyYacht } = await import('../lib/race.ts');
const { VENUES } = await import('../lib/venues.ts');
await import('../public/game/av-menu.js');

beforeEach(() => {
  reset();
  globalThis.__push = { able: true, sub: null, result: 'on', calls: [] };
  globalThis.Notification = { permission: 'default' };
});
afterEach(done);

const TODAY = '2026-11-18';
const day = (n) => new Date(Date.parse(`${TODAY}T12:00:00Z`) - n * 864e5).toISOString().slice(0, 10);
const logged = (d, v = {}) => localStorage.setItem('regatta-log', JSON.stringify({ d, v }));

// ---------- the header's menu ----------
const menu = (lang = 'en') => mount(h('div', null, h('p', { id: 'out' }, 'Page'), h(SiteMenu, { lang })));
const openMenu = (v) => doing(() => { v.$('details').open = true; });

test('the menu holds your things, the reading pages and the site’s pages', () => {
  const html = ssr(h(SiteMenu, { lang: 'en' }));
  const words = plain(html);
  assert.match(html, /hm-acct-s">Settings</, 'under your name, the link says Settings');
  assert.ok(!words.includes('Account and settings'));
  for (const w of ['Sign in', 'To be ranked and keep your times', 'Your yacht', 'Your player card', 'Audio & graphics', 'How to play', 'Racing guides', 'Racing rules', 'FAQ', 'Today’s race', '1-on-1 race', 'Sign out']) assert.ok(words.includes(w), w);
});

test('the menu in Russian', () => {
  const html = ssr(h(SiteMenu, { lang: 'ru' }));
  const words = plain(html);
  assert.match(html, /hm-acct-s">Настройки</);
  assert.match(words, /Гонка 1 на 1/);
  assert.deepEqual(englishIn(words), []);
});

test('a player with no card yet is led to what this device has', async () => {
  const v = await menu();
  await openMenu(v);
  assert.ok(v.$('a[href="/players?me=1"]'));
  assert.equal(dom.fetches.length, 0, 'a guest asks the server nothing');
});

test('opening the menu signed in finds your card', async () => {
  signIn();
  serve([['/auth/player', json({ k: 'my/key' })]]);
  const v = await menu();
  assert.equal(dom.fetches.length, 0, 'not until it is wanted');
  await openMenu(v);
  await settle();
  assert.ok(v.$('a[href="/players?p=my%2Fkey"]'));
});

test('pointing at the menu is enough to start finding your card', async () => {
  signIn();
  serve([['/auth/player', json({ k: 'k1' })]]);
  const v = await menu();
  await fire(v.$('summary'), 'pointerover');
  await settle();
  assert.equal(dom.fetches.length, 1);
});

test('a tap outside or Escape closes the menu, and a tap inside doesn’t', async () => {
  const v = await menu();
  await openMenu(v);
  await click(v.$('.hm-msep'));
  assert.equal(v.$('details').open, true);
  await fire(document.body, 'keydown', { key: 'a' });
  assert.equal(v.$('details').open, true);
  await click(v.$('#out'));
  assert.equal(v.$('details').open, false);
  await openMenu(v);
  await fire(document.body, 'keydown', { key: 'Escape' });
  assert.equal(v.$('details').open, false);
});

test('signing out comes back to this page and forgets your card', async () => {
  reset({ url: 'https://updown.test/race/free?from=today' });
  sessionStorage.setItem('regatta-card', '{"k":"x"}');
  const v = await menu();
  await click(v.$('.hm-mi-out'));
  assert.equal(v.$('input[name=next]').value, '/race/free?from=today');
  assert.equal(sessionStorage.getItem('regatta-card'), null);
  assert.equal(dom.submitted.length, 1);
});

// ---------- your row on today's board ----------
const best = (s) => localStorage.setItem('regatta-pb', JSON.stringify({ [`daily|${TODAY}`]: s }));
const row = (p = {}) => mount(h('ol', null, h(MyRow, { lang: 'en', day: TODAY, ...p })));
const board = (...s) => s.map((x) => ({ s: x }));

test('with no time today the row says not yet and offers the way on', async () => {
  const v = await row({ top: board(60) });
  assert.equal(v.$('.hm-n').textContent, '·');
  assert.equal(v.$('.hm-t').textContent, 'not yet');
  assert.equal(v.$('.hm-src').getAttribute('href'), '/sign-in?next=/');
  assert.equal(dom.fetches.length, 0);
});

test('a time on the board shows its place and its gap to the leader', async () => {
  best(70);
  const v = await row({ top: board(60, 70, 80) });
  assert.equal(v.$('.hm-n').textContent, '2');
  assert.equal(plain(v.$('.hm-t').innerHTML), '1:10.0 +10.0');
  assert.equal(dom.fetches.length, 0, 'nothing to check');
});

test('the leader has no gap to show', async () => {
  best(60);
  const v = await row({ top: board(60, 70) });
  assert.equal(v.$('.hm-n').textContent, '1');
  assert.equal(v.$('.hm-t small'), null);
});

test('a time too slow for a full board claims nothing', async () => {
  best(90);
  const v = await row({ top: board(60, 70), cap: 2 });
  assert.equal(v.$('.hm-n').textContent, '·');
  assert.equal(v.$('.hm-why'), null);
  assert.equal(dom.fetches.length, 0);
});

test('with the scores server silent the page’s empty board claims nothing', async () => {
  best(70);
  const v = await row({ top: [] });
  assert.equal(v.$('.hm-why'), null);
  assert.equal(dom.fetches.length, 0);
  assert.equal(v.$('.hm-t').textContent, '1:10.0');
});

test('a time missing from the board is checked with the server, past every cache', async () => {
  best(65);
  serve([[`day=${TODAY}`, json({ d: TODAY, s: [60, 65, 70], top: [] })]]);
  const v = await row({ top: board(60, 70) });
  assert.ok(dom.fetches[0].url.endsWith(`&fresh=${clock.now}`));
  assert.equal(dom.fetches[0].init.cache, 'no-store');
  assert.equal(v.$('.hm-n').textContent, '2', 'it was only the cached board that lacked it');
  assert.equal(v.$('.hm-why'), null);
});

test('a time the server hasn’t got is said not to be on the ranking', async () => {
  best(65);
  serve([[`day=${TODAY}`, json({ d: TODAY, s: [60, 70], top: [] })]]);
  const v = await row({ top: board(60, 70) });
  assert.equal(v.$('.hm-why').textContent, 'not on the ranking');
  assert.equal(v.$('.hm-n').textContent, '·');
});

test('if the server can’t say, the row doesn’t accuse it', async () => {
  best(65);
  serve([[`day=${TODAY}`, new Error('offline')]]);
  const v = await row({ top: board(60, 70) });
  assert.equal(v.$('.hm-why'), null);
});

test('faster than the leader shows a minus', async () => {
  best(55);
  serve([[`day=${TODAY}`, json({ d: TODAY, s: [60], top: [] })]]);
  const v = await row({ top: board(60) });
  assert.equal(v.$('.hm-t small').textContent, '−5.0');
});

test('the row flies your flag', async () => {
  saveBoat({ ...DEFAULT_BOAT, flag: 'au' });
  const v = await row({ top: [], lang: 'ru' });
  assert.equal(v.$('.fl').getAttribute('src'), '/flags/au.svg');
  assert.equal(v.$('.lb-you').getAttribute('data-you'), '(ты)');
  assert.equal(v.$('.hm-src').textContent, 'Войди, чтобы попасть сюда');
});

// ---------- the hero, the clock, the dock, the ticker ----------
test('the hero’s race starts once the page is idle, with today’s venue and yacht', async () => {
  const v = await mount(h(HeroScene, { title: 'The race' }));
  assert.equal(v.$('iframe').getAttribute('src'), null);
  assert.equal(v.$('iframe').getAttribute('aria-hidden'), 'true');
  await tick(5);
  assert.equal(v.$('iframe').getAttribute('src'), `/hero-view?venue=${dailyVenue()}&boat=${dailyYacht()}`);
});

test('the hero waits for the page to load', async () => {
  document.readyState = 'loading';
  const v = await mount(h(HeroScene, { title: 'T' }));
  await tick(100);
  assert.equal(v.$('iframe').getAttribute('src'), null);
  await tell(new Event('load'));
  await tick(5);
  assert.ok(v.$('iframe').getAttribute('src'));
});

test('with reduced motion or a slow line the still picture is the hero', async () => {
  dom.media['(prefers-reduced-motion: reduce)'] = true;
  let v = await mount(h(HeroScene, { title: 'T' }));
  await tick(100);
  assert.equal(v.$('iframe').getAttribute('src'), null);
  await v.unmount();
  dom.media = {};
  navigator.connection = { saveData: true };
  v = await mount(h(HeroScene, { title: 'T' }));
  await tick(100);
  assert.equal(v.$('iframe').getAttribute('src'), null);
});

test('the clock is blank on the server and counts to midnight UTC in the browser', async () => {
  assert.match(ssr(h(Countdown, { className: 'x' })), /<b class="x" role="timer" aria-live="off">--:--:--<\/b>/);
  const v = await mount(h(Countdown));
  assert.equal(v.$('b').textContent, '12:00:00');
  await tick(1000);
  assert.equal(v.$('b').textContent, '11:59:59');
  await tick(3600000);
  assert.equal(v.$('b').textContent, '10:59:59');
});

test('the dock comes up once the hero’s buttons have scrolled away above', async () => {
  const v = await mount(h('div', null, h('div', { id: 'hero' }), h(Dock, { watch: '#hero' }, h('a', { href: '/race' }, 'Race'))));
  const dock = () => v.$('.ho-dock');
  assert.equal(dock().classList.contains('on'), false);
  assert.ok(dock().hasAttribute('inert'), 'out of reach while it is down');
  await intersect(v.$('#hero'), false);
  assert.ok(dock().classList.contains('on'));
  assert.equal(dock().hasAttribute('inert'), false);
  await intersect(v.$('#hero'), true);
  assert.equal(dock().classList.contains('on'), false);
  await intersect(v.$('#hero'), false, { boundingClientRect: { top: 900 } });
  assert.equal(dock().classList.contains('on'), false, 'not while they are still below');
});

test('with nothing to watch the dock is simply up', async () => {
  const v = await mount(h(Dock, { watch: '#nothing' }, 'x'));
  assert.ok(v.$('.ho-dock').classList.contains('on'));
});

test('the ticker shows one line at a time and goes round', async () => {
  const v = await mount(h(Ticker, { lines: ['One', 'Two'], every: 1000 }));
  assert.equal(v.$('.ho-tick-t').textContent, 'One');
  await tick(1000);
  assert.equal(v.$('.ho-tick-t').textContent, 'Two');
  await tick(1000);
  assert.equal(v.$('.ho-tick-t').textContent, 'One');
});

test('a single line stays, reduced motion holds still, and no lines draw nothing', async () => {
  let v = await mount(h(Ticker, { lines: ['Only'] }));
  await tick(9000);
  assert.equal(v.$('.ho-tick-t').textContent, 'Only');
  await v.unmount();
  dom.media['(prefers-reduced-motion: reduce)'] = true;
  v = await mount(h(Ticker, { lines: ['One', 'Two'] }));
  await tick(9000);
  assert.equal(v.$('.ho-tick-t').textContent, 'One');
  assert.equal(ssr(h(Ticker, { lines: [] })), '');
});

test('fewer lines than the one showing is not a blank', async () => {
  const v = await mount(h(Ticker, { lines: ['A', 'B', 'C'], every: 1000 }));
  await tick(2000);
  await v.rerender(h(Ticker, { lines: ['A', 'B'], every: 1000 }));
  assert.equal(v.$('.ho-tick-t').textContent, 'A');
});

// ---------- the strip for a returning player ----------
const strip = (p = {}) => mount(h(BackStrip, { lang: 'en', day: TODAY, top: board(60, 70, 80), ...p }));
const cells = (v) => v.$$('.ho-back-i').map((x) => plain(x.innerHTML));

test('a first-time visitor gets an empty strip and no mark on the page', async () => {
  const v = await strip();
  assert.equal(v.$('.ho-back').getAttribute('aria-hidden'), 'true');
  assert.equal(v.$('.ho-back-i'), null);
  assert.equal(document.documentElement.hasAttribute('data-back'), false);
});

test('a player who has raced marks the page, and an empty log doesn’t', () => {
  markBack(null);
  markBack({ d: {}, v: {} });
  assert.equal(document.documentElement.hasAttribute('data-back'), false);
  markBack({ d: { [TODAY]: 60 }, v: {} });
  assert.equal(document.documentElement.hasAttribute('data-back'), true);
});

test('today’s time done: the streak goes on and your place is told', async () => {
  logged({ [TODAY]: 70, [day(1)]: 70 });
  const v = await strip();
  assert.deepEqual(cells(v).slice(0, 2), ['Streak 2-day streak Today’s is in. Back tomorrow for the next', 'Your time today 1:10.0 2nd today · 10.0 s off the lead']);
  assert.equal(document.documentElement.hasAttribute('data-back'), true);
});

test('the fastest today holds the time to beat', async () => {
  logged({ [TODAY]: 60 });
  const v = await strip();
  assert.match(cells(v)[1], /The time to beat is yours/);
});

test('a time below a full board gives only the gap', async () => {
  logged({ [TODAY]: 90 });
  const v = await strip({ cap: 3 });
  assert.equal(cells(v)[1], 'Your time today 1:30.0 30.0 s off the lead');
});

test('not sailed yet: how to keep the streak going, and the time left', async () => {
  logged({ [day(1)]: 70, [day(2)]: 70 });
  const v = await strip();
  assert.match(cells(v)[0], /2-day streak Sail today’s race to make it 3/);
  assert.equal(cells(v)[1], 'Your time today Not sailed yet Closes in 12:00:00');
});

test('a streak at risk says it will end', async () => {
  logged({ [day(2)]: 70, [day(3)]: 70 });
  const v = await strip();
  assert.ok(v.$('.ho-back-i').classList.contains('risk'));
  assert.match(cells(v)[0], /Sail today’s race or it ends/);
});

test('a race kept with no day finished is still a returning player’s', async () => {
  localStorage.setItem('regatta-result-a', JSON.stringify({ daily: TODAY, boats: [{ me: true, done: true, dsq: true, secs: 70 }] }));
  const v = await strip();
  assert.match(cells(v)[0], /No streak yet Finish today’s race to start one/);
});

test('after the first race, and only it: the way in goes on, the first race done and today\'s race next', async () => {
  localStorage.setItem('regatta-result-f1', JSON.stringify({ id: 'f1', at: Date.now(), daily: null, first: true,
    boats: [{ me: false, done: true, secs: 150 }, { me: true, done: true, secs: 159.7 }, { me: false, done: true, secs: 170 }] }));
  const v = await strip();
  assert.ok(v.$('.ho-after'));
  assert.deepEqual(v.$$('.ho-after-steps li').map((x) => x.className), ['done', 'now', '']);
  assert.match(cells(v)[0], /Your first race.*2nd of 3.*2:39\.7.*Sail it again/);
  assert.ok(v.$('a[href="/play?race=first"]'));
  assert.match(cells(v)[1], /Today.s race.*Not sailed yet.*Closes in/);
  // once today's race is in the log, the strip is the streak's again
  await v.unmount();
  logged({ [TODAY]: 70 });
  const w = await strip();
  assert.ok(!w.$('.ho-after'), 'the streak\'s strip again');
});

test('the strip in Russian', async () => {
  logged({ [TODAY]: 70.5, [day(1)]: 70 });
  const v = await strip({ lang: 'ru' });
  assert.match(cells(v)[0], /2 дня подряд Сегодняшняя есть/);
  assert.match(cells(v)[1], /3-е место · 10,5 с до лидера/);
  assert.deepEqual(englishIn(v.text()), []);
});

// ---------- the daily reminder ----------
const push = (p = {}) => mount(h(PushButton, { lang: 'en', where: 'home', ...p }));

test('where the browser can’t take a reminder there is nothing', async () => {
  globalThis.__push.able = false;
  const v = await push();
  assert.equal(v.container.childNodes.length, 0);
  assert.equal(ssr(h(PushButton, { lang: 'en', where: 'x' })), '', 'and nothing before it knows');
});

test('an iPhone in Safari is told how to get one', async () => {
  globalThis.__push.able = false;
  navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)';
  const v = await push({ lang: 'ru' });
  assert.match(v.text(), /«На экран Домой»/);
});

test('an iPhone already on the Home Screen isn’t told again', async () => {
  globalThis.__push.able = false;
  navigator.userAgent = 'Mozilla/5.0 (iPhone)';
  navigator.standalone = true;
  const v = await push();
  assert.equal(v.container.childNodes.length, 0);
});

test('reminders blocked in the browser are said to be', async () => {
  globalThis.Notification.permission = 'denied';
  const v = await push();
  assert.match(v.text(), /Reminders are blocked for this site/);
});

test('the reminder can be asked for, at its own time of day', async () => {
  const v = await push();
  assert.match(v.text(), /Remind me before it closes At 05:00 PM, only on days you haven’t sailed\./);
  await click(v.$('.ho-push-go'));
  assert.deepEqual(globalThis.__push.calls, [['subscribe', 'en']]);
  assert.deepEqual(dom.tracked, [['Reminder', { where: 'home', result: 'on' }]]);
  assert.match(v.text(), /Reminder on Daily at 05:00 PM/);
});

test('in Russian the time is on the 24-hour clock', async () => {
  const v = await push({ lang: 'ru' });
  assert.match(v.text(), /В 17:00, только в дни без гонки\./);
});

test('a reminder already on can be turned off', async () => {
  globalThis.__push.sub = {};
  globalThis.Notification.permission = 'granted';
  const v = await push();
  await click(v.$('.ho-push-x'));
  assert.deepEqual(globalThis.__push.calls, [['unsubscribe']]);
  assert.deepEqual(dom.tracked, [['Reminder', { where: 'home', result: 'off' }]]);
  assert.ok(v.$('.ho-push-go'));
});

test('a refusal and a failure are each told', async () => {
  globalThis.__push.result = 'failed';
  const v = await push();
  await click(v.$('.ho-push-go'));
  assert.match(v.text(), /That didn’t work\. Try again in a moment\./);
  globalThis.__push.result = 'denied';
  await click(v.$('.ho-push-go'));
  assert.match(v.text(), /Reminders are blocked/);
});

test('if the subscription can’t be read the reminder is offered', async () => {
  globalThis.__push.subError = true;
  const v = await push();
  assert.ok(v.$('.ho-push-go'));
});

test('the reminder’s row is kept up on every page once allowed', async () => {
  globalThis.Notification.permission = 'granted';
  await mount(h(PushSync, { lang: 'ru' }));
  assert.deepEqual(globalThis.__push.calls, [['sync', 'ru']]);
  await tell(new Event('regatta-log'));
  assert.equal(globalThis.__push.calls.length, 2);
});

test('with no permission nothing is sent', async () => {
  await mount(h(PushSync, { lang: 'en' }));
  assert.deepEqual(globalThis.__push.calls, []);
});

// ---------- home's buttons, the fold, the match ----------
test('home’s buttons are counted, with whether the reader has raced', async () => {
  const v = await mount(h('div', null, h(CtaTrack), h('a', { href: '/race', 'data-cta': 'hero' }, h('span', { id: 'in' }, 'Go')), h('a', { href: '/x', id: 'plain' }, 'No')));
  await click(v.$('#in'));
  assert.deepEqual(dom.tracked, [['Home CTA', { where: 'hero', to: '/race', back: 0 }]]);
  await click(v.$('#plain'));
  assert.equal(dom.tracked.length, 1);
  document.documentElement.setAttribute('data-back', '');
  await click(v.$('#in'));
  assert.equal(dom.tracked.at(-1)[1].back, 1);
});

test('the explainers fold behind one button', async () => {
  const v = await mount(h(Fold, { lang: 'en' }, h('p', { id: 'in' }, 'Inside')));
  const btn = v.$('.ho-fold-btn');
  assert.equal(btn.getAttribute('aria-expanded'), 'false');
  assert.match(btn.textContent, /About the game: what’s inside/);
  await click(btn);
  assert.ok(v.$('.ho-fold').classList.contains('open'));
  assert.equal(v.$('.ho-fold-btn').textContent, 'Less about the game');
  assert.deepEqual(dom.tracked, [['Home CTA', { where: 'fold', to: 'open', back: 1 }]]);
  await click(v.$('.ho-fold-btn'));
  assert.deepEqual(dom.tracked.at(-1), ['Home CTA', { where: 'fold', to: 'close', back: 1 }]);
});

test('a link to something folded away opens the fold and goes there', async () => {
  reset({ url: 'https://updown.test/#faq' });
  const v = await mount(h(Fold, { lang: 'ru' }, h('p', { id: 'faq' }, 'Вопросы и ответы')));
  assert.ok(v.$('.ho-fold').classList.contains('open'));
  await tick(60);
  assert.equal(v.$('#faq').scrolled.length, 1);
});

test('an anchor elsewhere, or already in view, leaves the fold shut', async () => {
  reset({ url: 'https://updown.test/#other' });
  const v = await mount(h('div', null, h('p', { id: 'other' }), h(Fold, { lang: 'en' }, h('p', { id: 'faq' }))));
  assert.equal(v.$('.ho-fold').classList.contains('open'), false);
  v.$('#faq').visible = true;
  location.url = new URL('https://updown.test/#faq');
  await tell(new Event('hashchange'));
  assert.equal(v.$('.ho-fold').classList.contains('open'), false);
  v.$('#faq').visible = false;
  await tell(new Event('hashchange'));
  assert.ok(v.$('.ho-fold').classList.contains('open'));
  await tick(60);
});

test('the way to a 1-on-1 race shows only at an address that asks for it', async () => {
  let v = await mount(h(MatchLink, { lang: 'en' }));
  assert.equal(v.$('a'), null);
  await v.unmount();
  reset({ url: 'https://updown.test/?match' });
  v = await mount(h(MatchLink, { lang: 'ru' }));
  assert.equal(v.$('a').getAttribute('href'), '/match/new');
  assert.equal(v.$('a').textContent, 'Гонка с другом 1 на 1');
});

// ---------- signing in from Telegram ----------
const launch = (data = 'user=1&hash=abc') => sessionStorage.setItem('__telegram__initParams', JSON.stringify({ tgWebAppData: data }));
const tg = () => mount(h(TelegramSignIn));

test('outside Telegram nothing is asked', async () => {
  await tg();
  assert.equal(dom.fetches.length, 0);
});

test('damaged launch data is ignored', async () => {
  sessionStorage.setItem('__telegram__initParams', '{oops');
  await tg();
  assert.equal(dom.fetches.length, 0);
});

test('from Telegram the launch data signs the player in and the page is drawn again', async () => {
  const router = spyRouter();
  launch();
  serve([['/auth/telegram', json({ changed: true })]]);
  await tg();
  const f = dom.fetches[0];
  assert.equal(f.init.method, 'POST');
  assert.deepEqual(JSON.parse(f.init.body), { initData: 'user=1&hash=abc' });
  assert.equal(router.refreshed, 1);
  assert.equal(sessionStorage.getItem('regatta-tg-signin'), 'abc');
});

test('already signed in, the page isn’t drawn again', async () => {
  const router = spyRouter();
  launch();
  serve([['/auth/telegram', json({ changed: false })]]);
  await tg();
  assert.equal(router.refreshed, 0);
});

test('the same launch data is sent once', async () => {
  launch();
  sessionStorage.setItem('regatta-tg-signin', 'abc');
  await tg();
  assert.equal(dom.fetches.length, 0);
});

test('launch data with no hash goes by its end', async () => {
  launch('x'.repeat(70));
  serve([['/auth/telegram', json({})]]);
  await tg();
  assert.equal(sessionStorage.getItem('regatta-tg-signin'), 'x'.repeat(64));
});

test('a refusal isn’t asked again', async () => {
  const router = spyRouter();
  launch();
  serve([['/auth/telegram', json({}, 401)]]);
  await tg();
  assert.equal(sessionStorage.getItem('regatta-tg-signin'), 'abc');
  assert.equal(router.refreshed, 0);
});

test('a server failure or no network is tried again on the next page', async () => {
  launch();
  serve([['/auth/telegram', json({}, 502)]]);
  let v = await tg();
  assert.equal(sessionStorage.getItem('regatta-tg-signin'), null);
  await v.unmount();
  serve([['/auth/telegram', new Error('offline')]]);
  v = await tg();
  assert.equal(sessionStorage.getItem('regatta-tg-signin'), null);
});

// ---------- your bests and boat follow you ----------
const account = (meta = {}, user = { user_metadata: meta }) => {
  signIn();
  const updates = [];
  globalThis.__supabase = { updates, auth: { getUser: async () => ({ data: { user } }), updateUser: async (u) => { updates.push(u); return {}; } } };
  return updates;
};
const pb = () => JSON.parse(localStorage.getItem('regatta-pb') || 'null');

test('a guest’s log is gathered, and no account is asked for', async () => {
  localStorage.setItem('regatta-pb', JSON.stringify({ [`daily|${TODAY}`]: 70 }));
  globalThis.__supabase = { auth: { getUser: () => assert.fail('a guest has no account to ask') } };
  await syncAccount();
  assert.equal(JSON.parse(localStorage.getItem('regatta-log')).d[TODAY], 70);
});

test('a cookie with no user behind it changes nothing', async () => {
  const updates = account({}, null);
  localStorage.setItem('regatta-pb', JSON.stringify({ a: 70 }));
  await syncAccount();
  assert.deepEqual(updates, []);
});

test('the faster time of each course wins on both sides', async () => {
  const updates = account({ pb: { a: 60, b: 90, c: 50 } });
  localStorage.setItem('regatta-pb', JSON.stringify({ a: 70, b: 80, d: 40 }));
  await syncAccount();
  const want = { a: 60, b: 80, c: 50, d: 40 };
  assert.deepEqual(pb(), want);
  assert.deepEqual(updates[0].data.pb, want);
});

test('bests the account has already leave nothing to send', async () => {
  const updates = account({ pb: { a: 60 } });
  localStorage.setItem('regatta-pb', JSON.stringify({ a: 60 }));
  await syncAccount();
  assert.deepEqual(updates, []);
});

test('daily bests older than a week and nonsense are dropped', async () => {
  const updates = account({ pb: { [`daily|${day(8)}`]: 60, [`daily|${day(6)}`]: 61, bad: -1, worse: 'x', ['k'.repeat(60)]: 5 } });
  await syncAccount();
  assert.deepEqual(pb(), { [`daily|${day(6)}`]: 61 });
  assert.deepEqual(Object.keys(updates[0]?.data ?? {}).includes('pb'), false, 'what is left is what the account has');
});

test('damaged bests on this device are read as none', async () => {
  account({ pb: { a: 60 } });
  localStorage.setItem('regatta-pb', '{oops');
  await syncAccount();
  assert.deepEqual(pb(), { a: 60 });
});

test('a boat changed here last goes to the account', async () => {
  saveBoat({ ...DEFAULT_BOAT, nat: 'AUS' }, 2000);
  const updates = account({ boat: { ...DEFAULT_BOAT, nat: 'NZL', at: 1000 } });
  await syncAccount();
  assert.equal(updates[0].data.boat.nat, 'AUS');
});

test('a boat changed elsewhere last comes here, and the page is told', async () => {
  saveBoat({ ...DEFAULT_BOAT, nat: 'AUS' }, 1000);
  account({ boat: { ...DEFAULT_BOAT, nat: 'NZL', at: 2000 } });
  let told = 0;
  const on = () => { told++; };
  addEventListener('regatta-boat', on);
  await syncAccount();
  removeEventListener('regatta-boat', on);
  assert.equal(JSON.parse(localStorage.getItem(BOAT_KEY)).nat, 'NZL');
  assert.equal(told, 1);
});

test('the log is merged both ways, and the page told what arrived', async () => {
  const v0 = VENUES[0].id, v1 = VENUES[1].id;
  logged({ [day(1)]: 70 }, { [v0]: 5 });
  const updates = account({ log: { d: { [day(1)]: 60, [day(2)]: 80 }, v: { [v1]: 9 } } });
  let told = 0;
  const on = () => { told++; };
  addEventListener('regatta-log', on);
  await syncAccount();
  removeEventListener('regatta-log', on);
  const want = { d: { [day(1)]: 60, [day(2)]: 80 }, v: { [v0]: 5, [v1]: 9 } };
  assert.deepEqual(JSON.parse(localStorage.getItem('regatta-log')), want);
  assert.deepEqual(updates[0].data.log, want);
  assert.equal(told, 1);
});

test('the sync runs as the page comes up, and a failure stays out of the reader’s way', async () => {
  const updates = account({});
  localStorage.setItem('regatta-pb', JSON.stringify({ a: 70 }));
  await mount(h(BestsSync));
  await settle();
  assert.deepEqual(updates[0].data.pb, { a: 70 });
  globalThis.__supabase.auth.getUser = async () => { throw new Error('offline'); };
  await mount(h(BestsSync));
  await settle();
  assert.deepEqual(dom.reported, []);
});
