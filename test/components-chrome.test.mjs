// What every page is made of: the header and footer, the small marks and placeholders, the back arrow, who is signed in,
// the 3D scene behind the pages and when it may start, and the little helpers React pages lean on. npm test.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from './load.mjs';
import { allowWarning, blur, click, clock, doing, dom, done, englishIn, fire, focus, fromFrame, h, hrefs, intersect, mount, plain, press, reset, settle, signIn, spyRouter, ssr, tell, tick, until, json, serve } from './fake-dom.mjs';

const { Logo, Langs, Num, clock: clockOf, IconBack, IconGoogle } = await import('../components/ui.tsx');
const { SiteHead, SiteFoot, Trail } = await import('../components/site-chrome.tsx');
const { NotFoundView } = await import('../components/not-found-view.tsx');
const { SceneBrand } = await import('../components/scene-brand.tsx');
const { Sk, LoadBar, ScenePoster, ResultSkeleton } = await import('../components/skeleton.tsx');
const { FlagImg, NoFlag, Who } = await import('../components/flag.tsx');
const { FaqList } = await import('../components/faq-list.tsx');
const { GuideFigure } = await import('../components/guide-figure.tsx');
const { AppMark } = await import('../components/app-marks.tsx');
const { Toc } = await import('../components/toc.tsx');
const { BackLink, NavTrail, useBack } = await import('../components/back-link.tsx');
const { DoneButton } = await import('../components/done-button.tsx');
const { AuthShell } = await import('../components/auth-shell.tsx');
const { Me, useWho } = await import('../components/me.tsx');
const { AvButton, AvRow, AvMenuItem } = await import('../components/av-row.tsx');
const { CountUp } = await import('../components/count-up.tsx');
const { DailyLock } = await import('../components/daily-lock.tsx');
const { IytSample } = await import('../components/iyt-sample.tsx');
const { RaceHere } = await import('../components/race-here.tsx');
const { GameScene, toScene, SCENE_EVENT } = await import('../components/game-scene.tsx');
const { READING, READING_VIEWPORT, NO_ZOOM } = await import('../lib/no-zoom.ts');
const { sceneOff, useSceneStart } = await import('../lib/scene-start.ts');
const { useCardKey, forgetCard } = await import('../lib/card-key.ts');
const { tx } = await import('../lib/lang.ts');
const { SHARE_TARGETS } = await import('../lib/share.ts');
const { FLAGS } = await import('../lib/flags.ts');
await import('../public/game/av-menu.js');

beforeEach(() => reset());
afterEach(done);

const en = tx('en'), ru = tx('ru');

// ---------- ui.tsx ----------
test('the language links keep the page, its query and its anchor, and mark the language being read', () => {
  const html = ssr(h(Langs, { lang: 'ru', back: '/race/free?from=today#course' }));
  assert.deepEqual(hrefs(html), ['/race/free?from=today&lang=en#course', '/race/free?from=today&lang=ru#course', '/race/free?from=today&lang=es#course', '/race/free?from=today&lang=de#course', '/race/free?from=today&lang=tr#course', '/race/free?from=today&lang=fr#course', '/race/free?from=today&lang=it#course', '/race/free?from=today&lang=pt#course']);
  assert.match(html, /<a class="lang lang-on"[^>]*lang="ru"[^>]*aria-current="true"/);
  assert.match(html, /aria-label="Язык"/);
  assert.match(ssr(h(Langs, { lang: 'en', back: '/' })), /aria-label="Language"/);
});

test('switching language replaces a ?lang= already in the address rather than adding a second', () => {
  assert.deepEqual(hrefs(ssr(h(Langs, { lang: 'en', back: '/faq?lang=ru' }))), ['/faq?lang=en', '/faq?lang=ru', '/faq?lang=es', '/faq?lang=de', '/faq?lang=tr', '/faq?lang=fr', '/faq?lang=it', '/faq?lang=pt']);
});

test('a number and its unit are set apart, and a bare number has no unit', () => {
  assert.match(ssr(h(Num, { v: '12 kn' })), /<span class="unit">kn<\/span>/);
  assert.doesNotMatch(ssr(h(Num, { v: '12' })), /class="unit"/);
  assert.match(ssr(h(Num, { v: '3 min sequence' })), /<span class="unit">min sequence<\/span>/);
});

test('a race clock reads minutes, two-digit seconds and a tenth', () => {
  assert.equal(clockOf(0), '0:00.0');
  assert.equal(clockOf(65.4), '1:05.4');
  assert.equal(clockOf(600), '10:00.0');
});

test('a clock never shows sixty seconds', () => {
  assert.equal(clockOf(119.97), '2:00.0');
});

test('the logo is named for a screen reader, the icons are hidden from one', () => {
  assert.match(ssr(h(Logo)), /role="img" aria-label="RYC"/);
  assert.match(ssr(h(IconBack)), /aria-hidden="true"/);
  assert.match(ssr(h(IconBack, { s: 33 })), /width="33"/);
  assert.match(ssr(h(IconGoogle)), /#4285F4/);
});

// ---------- site-chrome.tsx ----------
test('the header links to the site’s pages and marks the one being read', () => {
  const html = ssr(h(SiteHead, { lang: 'en', t: en, page: 'rating' }));
  for (const to of ['/race', '/race/free', '/race/drills', '/race/rating', '/players', '/venues', '/yachts', '/sign-in', '/play?race=today']) assert.ok(hrefs(html).includes(to), to);
  assert.equal([...html.matchAll(/aria-current="page"/g)].length, 1);
  assert.match(html, /<a href="\/race\/rating"[^>]*aria-current="page"/);
  assert.match(plain(html), /Today’s race Custom race 1-on-1 race Leaderboard Drills Players Venues Yachts/);
});

test('Drills and Players are in the menu at every width, not among the header’s tabs', () => {
  const html = ssr(h(SiteHead, { lang: 'en', t: en, page: 'drills' }));
  const tabs = /<nav class="hm-nav"[^>]*>(.*?)<\/nav>/s.exec(html)[1];
  assert.deepEqual(hrefs(tabs), ['/play?race=first&intro', '/race', '/race/free', '/duel', '/race/rating']);
  const shown = html.split('class="hm-menu-nav"')[1].split('</nav>').slice(1).join('</nav>');
  for (const to of ['/race/drills', '/players', '/venues', '/yachts']) assert.ok(hrefs(shown).includes(to), to);
  assert.doesNotMatch(html, /aria-current/, 'no tab to mark on the drills’ page');
});

test('the Russian header has no English left but the game’s name', () => {
  const words = plain(ssr(h(SiteHead, { lang: 'ru', t: ru, page: 'home' })));
  assert.match(words, /Гонка дня Своя гонка Гонка 1 на 1 Рейтинг Тренировки Игроки Акватории Яхты/);
  assert.match(words, /Играть/);
  assert.deepEqual(englishIn(words), []);
});

test('search engines get the page’s place under Home, in the reader’s language', () => {
  const data = (html) => JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/.exec(html)[1]);
  const b = data(ssr(h(SiteHead, { lang: 'ru', t: ru, page: 'faq' })));
  assert.equal(b['@type'], 'BreadcrumbList');
  assert.deepEqual(b.itemListElement.map((x) => [x.position, x.name]), [[1, 'Главная'], [2, 'Вопросы и ответы']]);
  assert.match(b.itemListElement[1].item, /\/faq\?lang=ru$/);
  const own = data(ssr(h(SiteHead, { lang: 'en', t: en, page: 'learn', crumbs: [['Racing guides', '/learn'], ['Tacking', '/learn/tacking']] })));
  assert.deepEqual(own.itemListElement.map((x) => x.name), ['Home', 'Racing guides', 'Tacking']);
});

test('a page with no place under Home has no breadcrumb data, and a name can’t break out of the data', () => {
  assert.doesNotMatch(ssr(h(SiteHead, { lang: 'en', t: en, page: 'home' })), /ld\+json/);
  const html = ssr(h(SiteHead, { lang: 'en', t: en, page: 'learn', crumbs: [['</script><b>x', '/x']] }));
  assert.doesNotMatch(html, /<\/script><b>x/);
});

test('the trail over a guide links each step but the last, which is the page itself', () => {
  const html = ssr(h(Trail, { t: en, crumbs: [['Learn', '/learn'], ['Tacking', '/learn/tacking']] }));
  assert.deepEqual(hrefs(html), ['/learn']);
  assert.match(html, /<span aria-current="page">Tacking<\/span>/);
  assert.match(ssr(h(Trail, { t: ru, crumbs: [['А', '/a']] })), /aria-label="Навигационная цепочка"/);
});

test('the footer has every page that stands on its own, RYC’s sites, the language switch and the disclaimer', () => {
  const html = ssr(h(SiteFoot, { lang: 'en', t: en, back: '/faq' }));
  for (const to of ['/', '/race', '/race/free', '/duel', '/race/drills', '/race/rating', '/players', '/venues', '/yachts', '/help', '/learn', '/rulebook', '/learn/glossary', '/dictionary', '/iyt', '/faq', '/boat', '/players?me=1', '/settings', '/sign-in', '/social', '/sponsorship', 'https://www.rycrentals.com/', 'https://www.rycsailing.com/', '/faq?lang=ru']) assert.ok(hrefs(html).includes(to), to);
  assert.match(plain(html), /not affiliated with, sponsored by, or endorsed by America’s Cup/);
});

test('the footer’s link to the settings says Settings, signed in or not', () => {
  const link = (word) => new RegExp(`<li><a[^>]*href="/settings"[^>]*>${word}</a></li>`);
  const html = ssr(h(SiteFoot, { lang: 'en', t: en, back: '/' }));
  assert.match(html, link('Settings'));
  assert.equal(hrefs(html).filter((to) => to === '/settings').length, 1);
  assert.doesNotMatch(html, /me-name/);
  assert.match(ssr(h(SiteFoot, { lang: 'ru', t: ru, back: '/' })), link('Настройки'));
});

test('the Russian footer is in Russian', () => {
  const words = plain(ssr(h(SiteFoot, { lang: 'ru', t: ru, back: '/' })));
  assert.match(words, /Офис регаты RYC/);
  assert.match(words, /независимый проект/);
  assert.deepEqual(englishIn(words), []);
});

test('the 404 says so and offers today’s race and home, in either language', () => {
  const a = ssr(h(NotFoundView, { lang: 'en' }));
  assert.match(plain(a), /404 This page isn’t here/);
  assert.match(plain(a), /Today’s race is still on/);
  assert.ok(hrefs(a).includes('/race') && hrefs(a).includes('/'));
  const b = plain(ssr(h(NotFoundView, { lang: 'ru' })));
  assert.match(b, /Такой страницы нет/);
  assert.deepEqual(englishIn(b), []);
});

test('the brand in a scene’s top bar goes home', () => {
  const html = ssr(h(SceneBrand));
  assert.deepEqual(hrefs(html), ['/']);
  assert.equal(plain(html), 'Up and down');
});

// ---------- skeleton.tsx ----------
test('a loading placeholder is hidden from screen readers and takes the size asked for', () => {
  const html = ssr(h(Sk, { w: 40, h: '2em', className: 'x', style: { opacity: 0.5 } }));
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /class="sk x"/);
  assert.match(html, /width:40px;height:2em;opacity:0\.5/);
});

test('the loading bar announces its words only while it runs', () => {
  assert.equal(plain(ssr(h(LoadBar, { label: 'Loading' }))), 'Loading');
  assert.match(ssr(h(LoadBar, { label: 'Loading' })), /class="bc-load on"[^>]*role="status"/);
  assert.equal(plain(ssr(h(LoadBar, { label: 'Loading', on: false }))), '');
  assert.doesNotMatch(ssr(h(LoadBar, { label: 'Loading', on: false })), /bc-load on/);
});

test('the scene’s stand-in shows its word only when it has one', () => {
  assert.equal(plain(ssr(h(ScenePoster, { label: 'The water', on: true }))), 'The water');
  assert.match(ssr(h(ScenePoster, { on: true })), /bt-poster on/);
  assert.doesNotMatch(ssr(h(ScenePoster, { on: false })), /bt-poster on|<span>/);
});

test('the result page’s placeholder says it is busy, with four numbers and five rows', () => {
  const html = ssr(h(ResultSkeleton, { label: 'Loading the race' }));
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /aria-label="Loading the race"/);
  assert.equal(plain(html), 'Loading the race');
  assert.equal([...html.matchAll(/width:100%;height:44px/g)].length, 5);
});

// ---------- flag.tsx ----------
test('a flag is named in the reader’s language', () => {
  const f = FLAGS.find((x) => x.code === 'au');
  const a = ssr(h(FlagImg, { code: 'au', lang: 'en' })), b = ssr(h(FlagImg, { code: 'au', lang: 'ru' }));
  assert.match(a, new RegExp(`src="/flags/au.svg" alt="${f.en}" title="${f.en}"`));
  assert.match(b, new RegExp(`alt="${f.ru}"`));
});

test('no flag, or a code the site doesn’t draw, leaves a blank of the same size so the names line up', () => {
  for (const code of [null, undefined, '', 'zz']) {
    const html = ssr(h(FlagImg, { code, lang: 'en' }));
    assert.match(html, /class="fl fl-none"/);
    assert.doesNotMatch(html, /<img/);
  }
  assert.match(ssr(h(NoFlag, { className: 'big' })), /class="big fl-none"/);
});

test('a sailor’s name beside the flag is escaped, whatever they called themselves', () => {
  const html = ssr(h(Who, { fl: 'au', name: '<img src=x onerror=alert(1)>', lang: 'en' }));
  assert.match(html, /<span class="lb-nm">&lt;img src=x onerror=alert\(1\)&gt;<\/span>/);
});

// ---------- faq-list.tsx ----------
const FAQ = [{ id: 'q1', q: 'Is it free?', a: 'Yes <always>.' }, { id: 'q2', q: 'Phones?', a: 'Any.' }];
test('the short list folds each answer, with the first open when asked', () => {
  const html = ssr(h(FaqList, { items: FAQ, openFirst: true }));
  assert.equal([...html.matchAll(/<details/g)].length, 2);
  assert.match(html, /<details class="hm-faq-item" id="q1" open=""/);
  assert.doesNotMatch(html, /id="q2" open/);
  assert.doesNotMatch(ssr(h(FaqList, { items: FAQ })), /open=""/);
});

test('the questions page shows every answer under a heading, each with its id to link to', () => {
  const html = ssr(h(FaqList, { items: FAQ, open: true }));
  assert.doesNotMatch(html, /<details/);
  assert.match(html, /id="q2"><h3 class="hm-faq-q">Phones\?<\/h3>/);
  assert.match(html, /Yes &lt;always&gt;\./);
});

// ---------- guide-figure.tsx, app-marks.tsx ----------
test('the guide’s drawing is described for a screen reader in each language', () => {
  const a = ssr(h(GuideFigure, { fig: 'wide', t: en })), b = ssr(h(GuideFigure, { fig: 'wide', t: ru }));
  assert.match(a, /role="img" aria-label="Two ways round a leeward mark/);
  assert.match(plain(a), /WIND Wide in, tight out/);
  assert.match(plain(b), /ВЕТЕР Широко зайти — узко выйти/);
  assert.deepEqual(englishIn(plain(b)), []);
  assert.equal(ssr(h(GuideFigure, { fig: 'other', t: en })), '');
});

test('every app the share sheet offers has a mark, drawn at the size asked for', () => {
  const marks = SHARE_TARGETS.map((a) => ssr(h(AppMark, { app: a.id, s: 30 })));
  for (const m of marks) { assert.match(m, /width="30" height="30"/); assert.match(m, /<(path|rect|circle) /); assert.match(m, /aria-hidden="true"/); }
  assert.equal(new Set(marks).size, SHARE_TARGETS.length, 'each its own');
  assert.match(ssr(h(AppMark, { app: 'x' })), /width="22"/);
});

// ---------- toc.tsx ----------
const ITEMS = [['a', 'First'], ['b', 'Second'], ['c', 'Third']];
test('the contents list links each section, the first marked until the page scrolls', () => {
  const html = ssr(h(Toc, { items: ITEMS, label: 'Contents', numbered: true }));
  assert.deepEqual(hrefs(html), ['#a', '#b', '#c']);
  assert.match(html, /aria-label="Contents"/);
  assert.match(html, /<a href="#a" aria-current="location"><b>1<\/b>First<\/a>/);
  assert.doesNotMatch(ssr(h(Toc, { items: ITEMS, label: 'Contents' })), /<b>/);
});

test('the contents follow the section being read, the first of those on screen', async () => {
  const sections = ['a', 'b', 'c'].map((id) => h('section', { id, key: id }));
  const v = await mount(h('div', null, sections, h(Toc, { items: ITEMS, label: 'Contents' })));
  const current = () => v.$('a[aria-current]').textContent;
  assert.equal(current(), 'First');
  await intersect(v.$('#c'));
  assert.equal(current(), 'Third');
  await intersect(v.$('#b'));
  assert.equal(current(), 'Second');
  await intersect(v.$('#b'), false);
  assert.equal(current(), 'Third');
});

// ---------- back-link.tsx, done-button.tsx ----------
const trail = (t) => sessionStorage.setItem('ud-trail', JSON.stringify(t));

test('with nothing behind you the back arrow goes where its link says', async () => {
  const router = spyRouter();
  trail([]);
  const v = await mount(h(BackLink, { href: '/race', label: 'Back' }));
  const a = v.$('a');
  assert.equal(a.getAttribute('aria-label'), 'Back');
  await click(a);
  assert.deepEqual(router.pushed, ['/race']);
  assert.deepEqual(dom.followed, [], 'the app’s router took it, not a page load');
});

test('with a page behind you the back arrow is the browser’s own back', async () => {
  const router = spyRouter();
  reset({ url: 'https://updown.test/boat' }); globalThis.__nav.router = router;
  history.length = 5;
  trail([{ p: '/race', n: 0 }, { p: '/boat', n: 1 }]);
  const v = await mount(h(BackLink, { href: '/', label: 'Back' }));
  await click(v.$('a'));
  assert.deepEqual(history.went, [-1]);
  assert.deepEqual(router.pushed, []);
});

test('a click for a new tab is left to the browser', async () => {
  const router = spyRouter();
  const v = await mount(h(BackLink, { href: '/race', label: 'Back', className: 'round' }));
  assert.equal(v.$('a').className, 'round');
  for (const k of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) await click(v.$('a'), { [k]: true });
  await click(v.$('a'), { button: 1 });
  assert.deepEqual(router.pushed, []);
  assert.equal(dom.followed.length, 5);
});

test('the trail records each page arrived at, and the browser’s back as a step back', async () => {
  reset({ url: 'https://updown.test/race' });
  trail([]);
  globalThis.__nav.path = '/race';
  const v = await mount(h(NavTrail));
  const steps = () => JSON.parse(sessionStorage.getItem('ud-trail')).map((s) => s.p);
  assert.ok(steps().at(-1) === '/race');
  location.url = new URL('https://updown.test/boat'); globalThis.__nav.path = '/boat';
  await v.rerender(h(NavTrail, { key: 1 }));
  assert.deepEqual(steps().slice(-2), ['/race', '/boat']);
  await tell(new PageTransitionEvent('pageshow', { persisted: true }));
  assert.equal(steps().at(-1), '/boat');
  await tell(new Event('popstate'));
  location.url = new URL('https://updown.test/race'); globalThis.__nav.path = '/race';
  await v.rerender(h(NavTrail, { key: 2 }));
  assert.equal(steps().at(-1), '/race');
});

test('useBack hands back a function that follows the trail', async () => {
  const router = spyRouter();
  trail([]);
  let go;
  const Probe = () => { go = useBack('/settings'); return null; };
  await mount(h(Probe));
  await doing(() => go());
  assert.deepEqual(router.pushed, ['/settings']);
});

test('Done leaves for the race hub when there is nowhere to go back to', async () => {
  const router = spyRouter();
  trail([]);
  const v = await mount(h(DoneButton, { label: 'Done' }));
  assert.equal(v.$('button').textContent, 'Done');
  await click(v.$('button'));
  assert.deepEqual(router.pushed, ['/race']);
});

test('Done can be told where to go instead', async () => {
  const router = spyRouter();
  trail([]);
  const v = await mount(h(DoneButton, { label: 'Готово', fallback: '/boat' }));
  await click(v.$('button'));
  assert.deepEqual(router.pushed, ['/boat']);
});

// ---------- auth-shell.tsx ----------
test('signing in sits over today’s venue, with a way back only where there is one', () => {
  const a = ssr(h(AuthShell, { lang: 'en', back: '/race', aside: h('p', null, 'Why') }, h('form', null, 'Card')));
  assert.match(a, /title="Today’s venue in 3D"/);
  assert.match(a, /aria-label="Back"/);
  assert.match(plain(a), /Up and down Why Card/);
  assert.match(a, /<section class="bt-card au-card"><form>Card<\/form>/);
  const b = ssr(h(AuthShell, { lang: 'ru' }, 'Карта'));
  assert.match(b, /title="Место гонки дня в 3D"/);
  assert.doesNotMatch(b, /aria-label="Назад"/);
  assert.match(b, /lang="ru"/);
});

// ---------- me.tsx ----------
test('the page is marked with who is signed in, and unmarked for a guest', async () => {
  signIn({ name: 'Anna Petrova' });
  await mount(h(Me));
  const d = document.documentElement;
  assert.ok(d.hasAttribute('data-me'));
  assert.equal(d.style.getPropertyValue('--me-ini'), '"AP"');
  assert.equal(d.style.getPropertyValue('--me-name'), '"Anna Petrova"');
});

test('a guest’s page carries no name', async () => {
  await mount(h(Me));
  assert.equal(document.documentElement.hasAttribute('data-me'), false);
});

const WhoProbe = ({ lang }) => { const w = useWho(lang); return h('output', null, JSON.stringify(w)); };
test('who is signed in is null for a guest', async () => {
  const v = await mount(h(WhoProbe, { lang: 'en' }));
  assert.equal(v.$('output').textContent, 'null');
});

test('who is signed in says how they signed in, in the reader’s language', async () => {
  signIn({ email: 'a@b.co', name: 'Anna P.', provider: 'email' });
  let v = await mount(h(WhoProbe, { lang: 'ru' }));
  assert.deepEqual(JSON.parse(v.$('output').textContent), { name: 'Anna P.', email: 'a@b.co', initials: 'AP', via: 'код по почте' });
  await v.unmount();
  signIn({ provider: 'google', name: 'Bo' });
  v = await mount(h(WhoProbe, { lang: 'en' }));
  assert.equal(JSON.parse(v.$('output').textContent).via, 'Google');
});

test('a Telegram player’s made-up address is never shown', async () => {
  signIn({ email: '777@telegram.local', name: 'Kolya', telegram: true });
  const v = await mount(h(WhoProbe, { lang: 'en' }));
  const w = JSON.parse(v.$('output').textContent);
  assert.equal(w.email, '');
  assert.equal(w.via, 'Telegram');
});

// ---------- av-row.tsx ----------
test('the Graphics button says what the scene is drawn at once the settings are read', async () => {
  const v = await mount(h(AvButton, { lang: 'en' }));
  await until(() => v.$('button b'), 'the summary');
  assert.equal(v.$('button b').textContent, 'Auto');
  assert.equal(v.$('button').getAttribute('aria-label'), 'Audio & graphics: Auto · sound on');
  assert.equal(v.$('button').getAttribute('aria-haspopup'), 'dialog');
});

test('before the settings are read the button still has its plain name', () => {
  const html = ssr(h(AvButton, { lang: 'ru' }));
  assert.match(html, /aria-label="Звук и графика"/);
  assert.equal(plain(html), 'Графика');
});

test('every way into Audio & graphics opens the menu in the reader’s language', async () => {
  for (const [C, props] of [[AvButton, { lang: 'ru' }], [AvRow, { lang: 'en' }], [AvRow, { lang: 'en', wide: true }]]) {
    const v = await mount(h(C, props));
    await click(v.$('button'));
    await until(() => dom.avOpened.length);
    assert.equal(dom.avOpened.pop().lang, props.lang);
    await v.unmount();
  }
});

test('the wide row across Settings names the menu and says Open', async () => {
  const v = await mount(h(AvRow, { lang: 'ru', wide: true }));
  await until(() => v.$('.st-boat-k').textContent);
  assert.match(v.text(), /Звук и графика Авто · звук вкл Открыть/);
});

test('the summary follows a change of settings', async () => {
  const v = await mount(h(AvRow, { lang: 'en' }));
  await until(() => v.$('.bt-row-m'));
  assert.equal(v.$('.bt-row-m').textContent, 'Auto · sound on');
  await tell(new Event('regatta-opts'));
  assert.equal(v.$('.bt-row-m').textContent, 'Auto · sound on');
});

test('the menu’s line shuts the header’s menu as it opens Audio & graphics', async () => {
  const v = await mount(h('details', { open: true }, h(AvMenuItem, { lang: 'en' })));
  assert.equal(v.$('button').textContent, 'Audio & graphics');
  await click(v.$('button'));
  await until(() => dom.avOpened.length);
  assert.equal(v.$('details').hasAttribute('open'), false);
});

// ---------- count-up.tsx ----------
test('the server’s page already reads the final number, for screen readers too', () => {
  const html = ssr(h(CountUp, { v: '1:05.4' }));
  assert.equal([...html.matchAll(/1:05\.4/g)].length, 2);
  assert.match(html, /<span aria-hidden="true">1:05\.4<\/span>/);
});

const counting = (v) => v.$('span[aria-hidden]').textContent;
test('a time counts up from nothing when it comes into view, and ends on its value', async () => {
  const v = await mount(h(CountUp, { v: '1:05.4', ms: 900 }));
  assert.equal(counting(v), '0:00.0');
  await intersect(v.$('span[aria-hidden]'));
  await tick(300);
  const mid = counting(v);
  assert.match(mid, /^\d:\d\d\.\d$/);
  assert.notEqual(mid, '0:00.0'); assert.notEqual(mid, '1:05.4');
  await tick(700);
  assert.equal(counting(v), '1:05.4');
});

test('it keeps a number’s form while counting: its decimals and the Russian comma', async () => {
  const v = await mount(h(CountUp, { v: '+12,5 с' }));
  assert.equal(counting(v), '+0,0 с');
  await intersect(v.$('span[aria-hidden]'));
  await tick(1000);
  assert.equal(counting(v), '+12,5 с');
});

test('a clock without tenths counts in whole seconds', async () => {
  const v = await mount(h(CountUp, { v: '12:30' }));
  assert.equal(counting(v), '0:00');
  await intersect(v.$('span[aria-hidden]'));
  await tick(1000);
  assert.equal(counting(v), '12:30');
});

test('it waits until it is seen', async () => {
  const v = await mount(h(CountUp, { v: '42' }));
  await intersect(v.$('span[aria-hidden]'), false);
  await tick(2000);
  assert.equal(counting(v), '0');
});

test('with reduced motion the number just stands', async () => {
  dom.media['(prefers-reduced-motion: reduce)'] = true;
  const v = await mount(h(CountUp, { v: '42' }));
  assert.equal(counting(v), '42');
});

test('words with no number in them are left alone', async () => {
  const v = await mount(h(CountUp, { v: 'DSQ' }));
  assert.equal(counting(v), 'DSQ');
});

// ---------- daily-lock.tsx ----------
const lockPage = (chips = ['Light 7 kn', 'Short']) => h('div', null, h('button', { 'data-lock': '', id: 'chip' }, 'Wind'), h('span', { 'data-lock': '', role: 'button', tabIndex: 0, id: 'row' }, 'Course'), h('button', { id: 'other' }, 'Else'), h(DailyLock, { lang: 'en', chips }));

test('today’s conditions open the sheet that says why they can’t change', async () => {
  const v = await mount(lockPage());
  assert.equal(v.$('dialog').open, false);
  await click(v.$('#other'));
  assert.equal(v.$('dialog').open, false, 'only what is marked');
  const e = await fire(v.$('#chip'), 'click');
  assert.equal(v.$('dialog').open, true);
  assert.equal(e.defaultPrevented, true);
  assert.match(v.text(), /Today’s race is fixed/);
  assert.deepEqual(v.$$('.dl-chips li').map((l) => l.textContent), ['Light 7 kn', 'Short']);
});

test('the keyboard opens it from a row that acts as a button', async () => {
  const v = await mount(lockPage());
  await press('a', v.$('#row'));
  assert.equal(v.$('dialog').open, false);
  await press('Enter', v.$('#row'));
  assert.equal(v.$('dialog').open, true);
  await doing(() => v.$('dialog').close());
  await press(' ', v.$('#row'));
  assert.equal(v.$('dialog').open, true);
});

test('Keep today’s race and a tap on the backdrop close it, and a tap inside doesn’t', async () => {
  const v = await mount(lockPage());
  await click(v.$('#chip'));
  await click(v.$('.dl-h'));
  assert.equal(v.$('dialog').open, true);
  await click(v.$('dialog'));
  assert.equal(v.$('dialog').open, false);
  await click(v.$('#chip'));
  await click(v.$('.dl-keep'));
  assert.equal(v.$('dialog').open, false);
});

test('the way out is the same race as a free one, in the reader’s language', () => {
  const html = ssr(h(DailyLock, { lang: 'ru', chips: ['Слабый'] }));
  assert.ok(hrefs(html).includes('/race/free?from=today'));
  assert.match(plain(html), /Гонка дня неизменна/);
  assert.deepEqual(englishIn(plain(html)), []);
});

// ---------- iyt-sample.tsx ----------
const Q = { figure: '/q.svg', question: 'Who keeps clear?', options: [['A', 'You'], ['B', 'Blue'], ['C', 'Neither']], answer: 'B', why: 'Blue is tacking.', reference: 'Rule 13', more: 'https://iyt.test/more' };

test('the question shows its drawing and options, and no verdict until one is picked', () => {
  const html = ssr(h(IytSample, { lang: 'en', q: Q }));
  assert.match(html, /src="\/q.svg"/);
  assert.match(plain(html), /Try a question Racing Rules of Sailing Who keeps clear\? A You B Blue C Neither/);
  assert.doesNotMatch(plain(html), /Right\.|Not quite/);
});

test('the right answer is said to be right, with the reason and the way to more', async () => {
  const v = await mount(h(IytSample, { lang: 'en', q: Q }));
  await click(v.$$('.iyt-q-opt')[1]);
  assert.match(v.text(), /Right\. Blue is tacking\. Rule 13 More questions like this/);
  assert.equal(v.$('.iyt-q-res a').getAttribute('href'), 'https://iyt.test/more');
  assert.equal(v.$$('.iyt-q-opt')[1].className, 'iyt-q-opt ok');
});

test('a wrong answer marks yours and the right one, and the rest fade', async () => {
  const v = await mount(h(IytSample, { lang: 'en', q: Q }));
  await click(v.$$('.iyt-q-opt')[0]);
  assert.match(v.text(), /Not quite: the answer is B\./);
  assert.deepEqual(v.$$('.iyt-q-opt').map((b) => b.className.replace('iyt-q-opt', '').trim()), ['no', 'ok', 'off']);
  assert.equal(v.$$('.iyt-q-opt')[0].getAttribute('aria-pressed'), 'true');
  assert.equal(v.$$('.iyt-q-opt')[2].getAttribute('aria-disabled'), 'true');
});

test('there is one go: a second pick changes nothing', async () => {
  const v = await mount(h(IytSample, { lang: 'ru', q: Q }));
  await click(v.$$('.iyt-q-opt')[0]);
  await click(v.$$('.iyt-q-opt')[1]);
  assert.match(v.text(), /Не совсем: правильный ответ — B\./);
  assert.equal(v.$$('.iyt-q-opt')[0].getAttribute('aria-pressed'), 'true');
  assert.match(v.text(), /Ещё вопросы на эту тему/);
});

// ---------- race-here.tsx ----------
test('Race here keeps the venue as the custom race’s and opens the set-up', async () => {
  const v = await mount(h(RaceHere, { venue: 'cowes', label: 'Race here' }));
  assert.equal(v.$('button').className, 'gd-try-go vn-go');
  await click(v.$('button'));
  assert.equal(JSON.parse(localStorage.getItem('regatta')).venue, 'cowes');
  assert.deepEqual(location.assigned, ['/race/free']);
});

test('Race her keeps the yacht and leaves the venue as the player last left it', async () => {
  localStorage.setItem('regatta', JSON.stringify({ venue: 'gocek' }));
  const v = await mount(h(RaceHere, { yacht: 'laser', label: 'Race her', className: 'go' }));
  await click(v.$('button.go'));
  const o = JSON.parse(localStorage.getItem('regatta'));
  assert.equal(o.yacht, 'laser');
  assert.equal(o.venue, 'gocek');
});

// ---------- game-scene.tsx ----------
const scene = (p = {}) => h('div', null, h('div', { className: 'bt-info' }), h('section', { className: 'bt-card' }), h(GameScene, { venue: 'gocek', wind: 'light', title: 'The scene', ...p }));

test('the scene starts only once the page has gone idle', async () => {
  const v = await mount(scene());
  assert.equal(v.$('iframe').getAttribute('src'), null);
  assert.equal(v.$('iframe').title, 'The scene');
  await tick(5);
  assert.equal(v.$('iframe').getAttribute('src'), '/boat-view?venue=gocek&wind=light');
});

test('the address says which yacht and what the scene is for', async () => {
  let v = await mount(scene({ boat: 'laser', finish: { boats: [] } }));
  await tick(5);
  assert.equal(v.$('iframe').getAttribute('src'), '/boat-view?venue=gocek&wind=light&finish=1&boat=laser');
  await v.unmount();
  v = await mount(scene({ boat: 'jpk1050', setup: { race: {}, view: 'boats', labels: {} } }));
  await tick(5);
  assert.equal(v.$('iframe').getAttribute('src'), '/boat-view?venue=gocek&wind=light&setup=1');
});

test('a reader saving data keeps the sea’s colours and no scene is fetched', async () => {
  navigator.connection = { saveData: true };
  const v = await mount(scene({ loading: 'Loading the venue' }));
  await tick(5000);
  assert.equal(v.$('iframe').getAttribute('src'), null);
  assert.equal(v.$('.bt-poster span'), null);
  assert.equal(v.$('.bc-load').className.trim(), 'bc-load');
});

test('the finish is shown even to a reader saving data, as it is what the page is for', async () => {
  navigator.connection = { saveData: true };
  const v = await mount(scene({ finish: { boats: [] } }));
  await tick(5);
  assert.match(v.$('iframe').getAttribute('src'), /finish=1/);
});

test('once up the scene is told the wind and what the card covers', async () => {
  const v = await mount(scene());
  await tick(5);
  const f = v.$('iframe');
  await fromFrame(f, { type: 'ready' });
  const sent = f.contentWindow.sent;
  assert.deepEqual(sent.find((m) => m.type === 'wind'), { type: 'wind', preset: 'light' });
  assert.ok(sent.some((m) => m.type === 'inset'));
});

test('the finish and the set-up are sent to the scene as it comes up', async () => {
  const v = await mount(scene({ finish: { boats: [1] } }));
  await tick(5);
  await fromFrame(v.$('iframe'), { type: 'ready' });
  assert.deepEqual(v.$('iframe').contentWindow.sent.find((m) => m.type === 'finish'), { type: 'finish', boats: [1] });
});

test('a changed set-up is sent on, and the wind isn’t sent over it', async () => {
  const setup = (fleet) => ({ race: { fleet }, view: 'boats', labels: {} });
  const v = await mount(scene({ setup: setup(3) }));
  const f = v.$('iframe');
  f.contentWindow.sent.length = 0;
  await v.rerender(scene({ setup: setup(7), wind: 'strong' }));
  assert.deepEqual(f.contentWindow.sent.map((m) => m.type), ['setup']);
  assert.equal(f.contentWindow.sent[0].race.fleet, 7);
});

test('a new wind is told to the scene as it changes', async () => {
  const v = await mount(scene());
  await v.rerender(scene({ wind: 'strong' }));
  assert.deepEqual(v.$('iframe').contentWindow.sent.at(-1), { type: 'wind', preset: 'strong' });
});

test('a message from elsewhere is ignored', async () => {
  const v = await mount(scene());
  const f = v.$('iframe');
  await tell(new MessageEvent('message', { data: { type: 'live' }, origin: 'https://evil.test', source: f.contentWindow }));
  await tell(new MessageEvent('message', { data: { type: 'live' }, origin: location.origin, source: {} }));
  assert.doesNotMatch(f.className, /\bon\b/);
});

test('the first frame fades the scene in and the poster and bar away', async () => {
  const v = await mount(scene({ loading: 'Loading' }));
  assert.match(v.$('.bt-poster').className, /\bon\b/);
  assert.match(v.$('.bc-load').className, /\bon\b/);
  await fromFrame(v.$('iframe'), { type: 'live' });
  assert.match(v.$('iframe').className, /\bon\b/);
  assert.doesNotMatch(v.$('.bt-poster').className, /\bon\b/);
  assert.doesNotMatch(v.$('.bc-load').className, /\bon\b/);
});

test('another venue loads beside the one showing and takes over once it is up', async () => {
  const v = await mount(scene());
  await tick(5);
  await fromFrame(v.$('iframe'), { type: 'live' });
  await v.rerender(scene({ venue: 'cowes' }));
  assert.equal(v.$$('iframe').length, 2);
  assert.match(v.$$('iframe')[1].getAttribute('src'), /venue=cowes/);
  await fromFrame(v.$$('iframe')[1], { type: 'live' });
  await tick(900);
  assert.equal(v.$$('iframe').length, 1);
  assert.match(v.$('iframe').getAttribute('src'), /venue=cowes/);
});

test('a venue picked while another is still loading takes its place', async () => {
  const v = await mount(scene());
  await tick(5);
  await v.rerender(scene({ venue: 'cowes' }));
  assert.equal(v.$$('iframe').length, 1);
  assert.match(v.$('iframe').getAttribute('src'), /venue=cowes/);
});

test('a message for the scene from elsewhere on the page is passed on as it is', async () => {
  const v = await mount(scene());
  await doing(() => toScene({ type: 'replay', off: true }));
  assert.deepEqual(v.$('iframe').contentWindow.sent.at(-1), { type: 'replay', off: true });
  assert.equal(SCENE_EVENT, 'regatta-scene');
});

// ---------- lib/no-zoom.ts ----------
const runNoZoom = (path) => {
  const on = {};
  const doc = { addEventListener: (k, f) => { on[k] = f; } };
  new Function('location', 'document', NO_ZOOM)({ pathname: path }, doc);
  const blocked = (k, e = {}) => { let b = false; on[k]?.({ ...e, preventDefault: () => { b = true; } }); return b; };
  return { on, blocked };
};

test('text to read may be zoomed, the game’s screens may not', () => {
  for (const p of ['/learn', '/learn/tacking', '/faq', '/help', '/iyt', '/social']) assert.ok(READING.test(p), p);
  for (const p of ['/', '/race', '/boat', '/yachts', '/learned', '/faqs']) assert.equal(READING.test(p), false, p);
  assert.equal(READING_VIEWPORT.userScalable, true);
  assert.equal(READING_VIEWPORT.maximumScale, 5);
});

test('on a game screen a pinch, Ctrl+wheel and Ctrl with plus or minus are cancelled', () => {
  const { blocked } = runNoZoom('/race');
  assert.ok(blocked('gesturestart'));
  assert.ok(blocked('touchmove', { touches: [1, 2] }));
  assert.equal(blocked('touchmove', { touches: [1] }), false, 'one finger scrolls');
  assert.ok(blocked('wheel', { ctrlKey: true }));
  assert.equal(blocked('wheel', { ctrlKey: false }), false);
  assert.ok(blocked('keydown', { metaKey: true, code: 'Equal' }));
  assert.ok(blocked('keydown', { ctrlKey: true, code: 'NumpadSubtract' }));
  assert.equal(blocked('keydown', { ctrlKey: true, code: 'KeyS' }), false);
  assert.equal(blocked('keydown', { code: 'Equal' }), false);
});

test('on a reading page nothing is cancelled', () => {
  assert.deepEqual(runNoZoom('/learn/tacking').on, {});
});

// ---------- lib/scene-start.ts ----------
test('the scene is left out for saved data, a slow line, a small phone or two cores', () => {
  assert.equal(sceneOff(), false);
  for (const c of [{ saveData: true }, { effectiveType: '2g' }, { effectiveType: 'slow-2g' }, { effectiveType: '3g' }]) { navigator.connection = c; assert.equal(sceneOff(), true, JSON.stringify(c)); }
  navigator.connection = { effectiveType: '4g' };
  assert.equal(sceneOff(), false);
  navigator.deviceMemory = 4;
  assert.equal(sceneOff(), false, 'a 4 GB laptop keeps it');
  dom.media['(pointer: coarse)'] = true;
  assert.equal(sceneOff(), true, 'a 4 GB phone doesn’t');
  navigator.deviceMemory = 8;
  assert.equal(sceneOff(), false);
  navigator.hardwareConcurrency = 2;
  assert.equal(sceneOff(), true);
});

const StartProbe = ({ optional }) => h('output', null, JSON.stringify(useSceneStart(optional)));
test('the scene waits for the page to load, then for it to go idle', async () => {
  document.readyState = 'loading';
  const v = await mount(h(StartProbe));
  await tick(50);
  assert.deepEqual(JSON.parse(v.$('output').textContent), { go: false, off: false });
  await tell(new Event('load'));
  await tick(5);
  assert.deepEqual(JSON.parse(v.$('output').textContent), { go: true, off: false });
});

test('where there is no idle time to wait for it starts a moment later', async () => {
  const ric = requestIdleCallback; window.requestIdleCallback = undefined;
  try {
    const v = await mount(h(StartProbe));
    await tick(150);
    assert.equal(JSON.parse(v.$('output').textContent).go, false);
    await tick(60);
    assert.equal(JSON.parse(v.$('output').textContent).go, true);
    await v.unmount();
  } finally { window.requestIdleCallback = ric; }
});

test('a scene the page can’t do without starts even on a slow line', async () => {
  navigator.connection = { saveData: true };
  const off = await mount(h(StartProbe));
  await tick(5);
  assert.deepEqual(JSON.parse(off.$('output').textContent), { go: false, off: true });
  await off.unmount();
  const on = await mount(h(StartProbe, { optional: false }));
  await tick(5);
  assert.deepEqual(JSON.parse(on.$('output').textContent), { go: true, off: false });
});

test('leaving the page before the scene starts cancels it', async () => {
  document.readyState = 'loading';
  const v = await mount(h(StartProbe));
  await v.unmount();
  document.readyState = 'complete';
  await tell(new Event('load'));
  await tick(10);
});

// ---------- lib/card-key.ts ----------
let ask;
const KeyProbe = () => { const [k, a] = useCardKey(); ask = a; return h('output', null, String(k)); };

test('a guest is never asked for a card', async () => {
  serve([['/auth/player', json({ k: 'nope' })]]);
  const v = await mount(h(KeyProbe));
  await doing(() => ask());
  assert.equal(dom.fetches.length, 0);
  assert.equal(v.$('output').textContent, 'null');
});

test('signed in, the card’s key is asked for once and kept for the tab', async () => {
  signIn();
  serve([['/auth/player', json({ k: 'card-1' })]]);
  let v = await mount(h(KeyProbe));
  await doing(() => { ask(); ask(); });
  await settle();
  assert.equal(dom.fetches.length, 1);
  assert.equal(dom.fetches[0].init.cache, 'no-store');
  assert.equal(v.$('output').textContent, 'card-1');
  await v.unmount();
  v = await mount(h(KeyProbe));
  assert.equal(v.$('output').textContent, 'card-1', 'the next page has it at once');
  await doing(() => ask());
  assert.equal(dom.fetches.length, 1);
});

test('a key kept for somebody else isn’t yours', async () => {
  signIn({ email: 'b@b.co' });
  sessionStorage.setItem('regatta-card', JSON.stringify({ who: 'email|a@a.co|Anna', k: 'theirs' }));
  serve([['/auth/player', json({ k: 'mine' })]]);
  const v = await mount(h(KeyProbe));
  assert.equal(v.$('output').textContent, 'null');
  await doing(() => ask());
  await settle();
  assert.equal(v.$('output').textContent, 'mine');
});

test('an account that hasn’t raced has no card, and that isn’t remembered', async () => {
  signIn();
  serve([['/auth/player', json({}, 404)]]);
  const v = await mount(h(KeyProbe));
  await doing(() => ask());
  await settle();
  assert.equal(v.$('output').textContent, 'null');
  assert.equal(sessionStorage.getItem('regatta-card'), null);
});

test('a network failure leaves no key and doesn’t break the page', async () => {
  signIn();
  serve([['/auth/player', new Error('offline')]]);
  const v = await mount(h(KeyProbe));
  await doing(() => ask());
  await settle();
  assert.equal(v.$('output').textContent, 'null');
});

test('signing out forgets the card', () => {
  sessionStorage.setItem('regatta-card', '{}');
  forgetCard();
  assert.equal(sessionStorage.getItem('regatta-card'), null);
});

test('a damaged kept key is ignored', async () => {
  signIn();
  sessionStorage.setItem('regatta-card', '{not json');
  const v = await mount(h(KeyProbe));
  assert.equal(v.$('output').textContent, 'null');
});
