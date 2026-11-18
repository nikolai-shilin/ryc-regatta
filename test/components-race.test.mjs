// The pages round a race: the day's rating and your month, the drills and your rival, the custom race's set-up and the
// course map, the replay, the question after the race, and the music. npm test.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import './load.mjs';
import { click, clock, doing, dom, done, englishIn, fire, fromFrame, h, hrefs, json, mount, plain, reset, serve, settle, ssr, tell, tick, type } from './fake-dom.mjs';

const { RatingView } = await import('../components/rating-view.tsx');
const { MyMonth, monthOf, myPoints } = await import('../components/my-month.tsx');
const { DrillsList, ProgressRows, RivalRow, RivalLine } = await import('../components/progress.tsx');
const { FreeQuick, MatchCard } = await import('../components/hub-client.tsx');
const { default: FreeSetup } = await import('../components/free-setup.tsx');
const { CourseMap } = await import('../components/course-map.tsx');
const { Replay } = await import('../components/replay.tsx');
const { GameScene } = await import('../components/game-scene.tsx');
const { RateRace } = await import('../components/rate-race.tsx');
const { RaceMusic, CALM } = await import('../components/race-music.tsx');
const { Soundtrack } = await import('../components/soundtrack.tsx');
const { tx } = await import('../lib/lang.ts');
const { dailyRace, pbKey, plannedCourse, KN } = await import('../lib/race.ts');
const { venueOf, VENUES, lengthOffered, shapeOffered } = await import('../lib/venues.ts');
const { yachtOf } = await import('../lib/yachts.ts');
const { DRILLS, LEVELS, DRILLS_KEY, toOpen } = await import('../lib/drills.ts');
const { posesAt } = await import('../lib/finish.ts');
await import('../public/game/av-menu.js');

beforeEach(() => reset());
afterEach(done);

const TODAY = '2026-11-18';

// ---------- the rating ----------
const row = (k, name, s, pts, fl = null) => ({ k, name, ph: null, fl, s, p: null, pts, n: 1 });
const mrow = (k, name, pts, days, wins = 0, podiums = 0) => ({ k, name, ph: null, fl: null, pts, days, wins, podiums });
const RATING = {
  d: TODAY, w: null, races: 12, guests: 3,
  rows: [row('a', 'Anna', 65.4, 4, 'au'), row('b', null, 65.4, 3), row('c', '<b>Cy</b>', 70, 2), row('d', 'Dee', 80.5, 1)],
  month: { m: '2026-11', days: 9, rows: [mrow('a', 'Anna', 40, 9, 3, 5), mrow('b', 'Bo', 1, 1, 1, 1), mrow('c', null, 2, 2)] },
  days: ['2026-11-16', TODAY],
};
const rating = (p = {}) => { const lang = p.lang ?? 'en'; return ssr(h(RatingView, { day: TODAY, data: RATING, lang, t: tx(lang), ...p })); };

test('today’s rating says what today’s race is', () => {
  const r = dailyRace(new Date(TODAY + 'T12:00:00Z')), words = plain(rating());
  assert.match(words, /^Today’s leaderboard Wednesday,? 18 November/);
  assert.ok(words.includes(`${venueOf(r.venue).name[0]} · ${yachtOf(r.yacht).name[0]} · Light breeze ${KN[r.preset]} kn · 12 races, 4 ranked`));
});

test('another day is just the rating, with the way to the day after', () => {
  const html = rating({ day: '2026-11-10' });
  assert.match(plain(html), /^Leaderboard Tuesday,? 10 November/);
  assert.ok(hrefs(html).includes('/race/rating/2026-11-09'));
  assert.ok(hrefs(html).includes('/race/rating/2026-11-11'));
});

test('today has no day after it, and its address is the plain one', () => {
  const html = rating();
  assert.match(html, /<span class="rt-step off" aria-hidden="true">›<\/span>/);
  assert.ok(hrefs(html).includes('/race/rating/2026-11-17'));
  assert.ok(hrefs(html).includes('/race/rating'));
  assert.ok(!hrefs(html).includes(`/race/rating/${TODAY}`));
});

test('the days along the top run from the newest back to the first of the month', () => {
  const html = rating();
  const days = [...html.matchAll(/class="rt-day[^"]*"[^>]*><b>(\d+)<\/b>/g)].map((m) => +m[1]);
  assert.deepEqual(days, Array.from({ length: 18 }, (_, i) => 18 - i));
  assert.match(html, /href="\/race\/rating" class="rt-day on has" aria-current="page"/);
  assert.match(html, /href="\/race\/rating\/2026-11-16" class="rt-day  has"/);
  assert.match(html, /href="\/race\/rating\/2026-11-15" class="rt-day  "/);
});

test('a past month’s strip runs to its last day', () => {
  const days = [...rating({ day: '2026-10-05' }).matchAll(/class="rt-day[^"]*"[^>]*><b>(\d+)<\/b>/g)].map((m) => +m[1]);
  assert.equal(days[0], 31);
  assert.equal(days.length, 31);
});

test('sailors stand by their best time, equal times sharing a place', () => {
  const html = rating();
  const places = [...html.slice(0, html.indexOf('rt-month')).matchAll(/class="rt-n">(\d+)</g)].map((m) => +m[1]);
  assert.deepEqual(places, [1, 1, 3, 4]);
  const words = plain(html);
  assert.match(words, /1 Anna 1:05\.4 \+4/);
  assert.match(words, /1 No name 1:05\.4 \+0\.0 \+3/);
  assert.match(words, /4 Dee 1:20\.5 \+15\.1 \+1/);
});

test('a name is shown as written, never as markup', () => {
  assert.match(rating(), /&lt;b&gt;Cy&lt;\/b&gt;/);
  assert.doesNotMatch(rating(), /<b>Cy<\/b>/);
});

test('races sailed signed out are counted and the way to rank is offered', () => {
  const html = rating();
  assert.match(plain(html), /3 races were sailed signed out and don’t rank\./);
  assert.ok(hrefs(html).includes('/sign-in?next=%2Frace%2Frating'));
  assert.match(plain(rating({ data: { ...RATING, guests: 1 } })), /1 race was sailed signed out and doesn’t rank\./);
  assert.doesNotMatch(plain(rating({ data: { ...RATING, guests: 0 } })), /signed out/);
});

test('the Russian count of races sailed signed out agrees with its number', () => {
  assert.match(plain(rating({ lang: 'ru', data: { ...RATING, guests: 1 } })), /1 заезд пройден без входа и не попал в рейтинг\./);
  assert.match(plain(rating({ lang: 'ru', data: { ...RATING, guests: 3 } })), /3 заезда пройдено без входа и не попали в рейтинг\./);
  assert.match(plain(rating({ lang: 'ru', data: { ...RATING, guests: 5 } })), /5 заездов пройдено без входа и не попали в рейтинг\./);
});

test('twenty-one races take the singular verb in Russian as they do the noun', () => {
  assert.match(plain(rating({ lang: 'ru', data: { ...RATING, guests: 21 } })), /21 заезд пройден без входа и не попал в рейтинг\./);
});

test('the month’s standings add up the days', () => {
  const words = plain(rating());
  assert.match(words, /November standings 9 race days/);
  // (each number twice: the copy read aloud and the copy that counts up)
  assert.match(words, /1 Anna 9 days · 3 wins · 5 podiums 40 40 pts/);
  assert.match(words, /2 Bo 1 day · 1 win 1 1 pt/);
  assert.match(words, /3 No name 2 days 2 2 pts/);
  assert.match(plain(rating({ data: { ...RATING, month: { ...RATING.month, days: 1 } } })), /1 race day\b/);
});

test('only the first twenty of the month are listed', () => {
  const rows = Array.from({ length: 25 }, (_, i) => mrow(`k${i}`, `P${i}`, 100 - i, 1));
  const html = rating({ data: { ...RATING, month: { ...RATING.month, rows } } });
  assert.match(plain(html), /P19/);
  assert.doesNotMatch(plain(html), /P20/);
});

test('how the points work is told with today’s numbers', () => {
  assert.match(plain(rating()), /Today: 4 ranked, so the winner takes 4 pts\./);
  assert.match(plain(rating({ day: '2026-11-10' })), /That day: 4 ranked/);
  assert.match(plain(rating({ data: { ...RATING, rows: [row('a', 'A', 60, 1)] } })), /1 ranked, so the winner takes 1 pt\./);
  assert.match(plain(rating({ lang: 'ru' })), /в рейтинге 4, победитель получает 4 очка\./);
});

test('an empty day says so, differently for today and a day gone', () => {
  const data = { ...RATING, rows: [], guests: 0, month: { ...RATING.month, rows: [] } };
  assert.match(plain(rating({ data })), /No ranked times yet today\. The first to finish takes the top\./);
  assert.match(plain(rating({ data })), /Sail today’s race/);
  assert.match(plain(rating({ data })), /No points yet this month\./);
  assert.match(plain(rating({ data })), /no one ranked yet\./);
  assert.match(plain(rating({ data, day: '2026-11-10' })), /No one ranked on this day\./);
  assert.doesNotMatch(plain(rating({ data, day: '2026-11-10' })), /Sail today’s race/);
});

test('today’s rating dares you to beat the times', () => {
  assert.ok(hrefs(rating()).includes('/play?race=today'));
  assert.match(plain(rating()), /Beat these times/);
  assert.doesNotMatch(plain(rating({ day: '2026-11-10' })), /Beat these times/);
});

test('when the scores server doesn’t answer the page says so and offers the race', () => {
  const html = rating({ data: null });
  assert.match(plain(html), /The leaderboard can’t be loaded right now/);
  assert.ok(hrefs(html).includes('/play?race=today'));
  assert.doesNotMatch(plain(html), /ranked/);
});

test('the Russian rating has no English left', () => {
  const data = { ...RATING, rows: [row('a', 'Анна', 65.4, 4)], month: { ...RATING.month, rows: [mrow('a', 'Анна', 40, 9, 3, 5)] } };
  const words = plain(rating({ lang: 'ru', data }));
  assert.match(words, /Рейтинг дня среда,? 18 ноября/);
  assert.match(words, /40 40 очков/);
  assert.match(words, /9 дней · 3 победы · подиумов: 5/);
  const r = dailyRace(new Date(TODAY + 'T12:00:00Z'));
  assert.deepEqual(englishIn(words, [yachtOf(r.yacht).name[1], venueOf(r.venue).name[1]]), []);
});

// ---------- your month ----------
const brief = (d, s, top = []) => [`day=${d}&brief`, json({ d, s, top, races: s.length })];
const logged = (d, v = {}) => localStorage.setItem('regatta-log', JSON.stringify({ d, v }));

test('the month runs from its first day to today, or to its end', () => {
  assert.deepEqual(monthOf(TODAY), { first: '2026-11-01', end: TODAY });
  assert.deepEqual(monthOf('2026-02-10'), { first: '2026-02-01', end: '2026-02-28' });
});

test('the month’s points count the days on the ranking: of N, place p takes N − p + 1', () => {
  assert.equal(myPoints([{ d: 'a', s: 1, place: 1, of: 10, listed: true }, { d: 'b', s: 1, place: 10, of: 10, listed: true }, { d: 'c', s: 1, place: 1, of: 50, listed: false }]), 11);
  assert.equal(myPoints([]), 0);
});

test('your month in four numbers and the day you did best', async () => {
  logged({ '2026-11-16': 70, [TODAY]: 65 });
  serve([brief('2026-11-16', [60, 70, 80]), brief(TODAY, [65, 90])]);
  const v = await mount(h(MyMonth, { day: TODAY, lang: 'en' }));
  assert.match(v.text(), /Your month November/);
  assert.deepEqual(v.$$('.rt-ms').map((x) => plain(x.innerHTML)), ['Days 2', 'Best 1st of 2', 'Wins 1', 'Podiums 2']);
  assert.ok(v.$$('.rt-ms b')[1].classList.contains('is-gold'), 'a win is gold');
});

test('each day of the month has a column, today’s marked, a win and a day raced told apart', async () => {
  logged({ '2026-11-16': 70, [TODAY]: 65 });
  serve([brief('2026-11-16', [60, 70, 80]), brief(TODAY, [65, 90])]);
  const v = await mount(h(MyMonth, { day: TODAY, lang: 'en' }));
  const cols = v.$$('.rt-mc-d');
  assert.equal(cols.length, 18);
  assert.equal(cols[15].getAttribute('aria-label'), 'Mon 16 Nov: 2nd of 3, 1:10.0');
  assert.equal(cols[15].style.getPropertyValue('--y'), '0.500');
  assert.ok(cols[17].classList.contains('win') && cols[17].classList.contains('on'));
  assert.equal(cols[0].getAttribute('aria-label'), null);
  assert.equal(cols[0].getAttribute('tabindex'), '-1');
});

test('the strip under the chart reads today, and the day pointed at', async () => {
  logged({ '2026-11-16': 70, [TODAY]: 65 });
  serve([brief('2026-11-16', [60, 70, 80]), brief(TODAY, [65, 90])]);
  const v = await mount(h(MyMonth, { day: TODAY, lang: 'en' }));
  assert.equal(plain(v.$('.rt-msplit').innerHTML), 'Wed 18 Nov 1st of 2 1:05.0');
  await fire(v.$$('.rt-mc-d')[15], 'pointerover');
  assert.equal(plain(v.$('.rt-msplit').innerHTML), 'Mon 16 Nov 2nd of 3 1:10.0');
  await fire(v.$('.rt-mc'), 'pointerout');
  assert.equal(plain(v.$('.rt-msplit').innerHTML), 'Wed 18 Nov 1st of 2 1:05.0');
});

test('a day with no one else ranked is neither a win nor your best', async () => {
  logged({ [TODAY]: 65 });
  serve([brief(TODAY, [])]);
  const v = await mount(h(MyMonth, { day: TODAY, lang: 'en' }));
  assert.deepEqual(v.$$('.rt-ms b').map((b) => b.textContent), ['1', '—', '0', '0']);
  assert.match(v.$('.rt-msplit').textContent, /No one else ranked/);
  assert.ok(v.$$('.rt-mc-d')[17].classList.contains('alone'));
});

test('a day whose ranking can’t be fetched still counts as a day raced', async () => {
  logged({ [TODAY]: 65 });
  serve([[`day=${TODAY}`, new Error('offline')]]);
  const v = await mount(h(MyMonth, { day: TODAY, lang: 'en' }));
  assert.equal(v.$$('.rt-ms b')[0].textContent, '1');
});

test('days of another month are left out, and an empty month says how to fill it', async () => {
  logged({ '2026-10-30': 70 });
  const v = await mount(h(MyMonth, { day: TODAY, lang: 'en' }));
  assert.match(v.text(), /No races of yours this month on this device yet\./);
  assert.equal(dom.fetches.length, 0);
});

test('your month in Russian', async () => {
  logged({ '2026-11-16': 70 });
  serve([brief('2026-11-16', [60, 70, 80])]);
  const v = await mount(h(MyMonth, { day: TODAY, lang: 'ru' }));
  assert.match(v.text(), /Твой месяц ноябрь/);
  assert.match(v.$('.rt-msplit').textContent, /2-е из 3/);
  assert.deepEqual(v.$$('.rt-ms').map((x) => plain(x.innerHTML)), ['Дней 1', 'Лучшее 2 из 3', 'Победы 0', 'Подиумы 1']);
  assert.deepEqual(englishIn(v.text()), []);
});

test('nothing is drawn before the log is read', () => {
  assert.equal(ssr(h(MyMonth, { day: TODAY, lang: 'en' })), '');
});

// ---------- the drills ----------
const first = DRILLS.filter((d) => d.level === LEVELS[0].id), second = DRILLS.filter((d) => d.level === LEVELS[1].id);
const stars = (o) => localStorage.setItem(DRILLS_KEY, JSON.stringify(o));

test('before the stars are read every drill is open, with no stars claimed', () => {
  const html = ssr(h(DrillsList, { lang: 'en' }));
  assert.equal([...html.matchAll(/class="pg-card"/g)].length, DRILLS.length);
  assert.doesNotMatch(html, /pg-level-n|pg-stars/);
  assert.ok(hrefs(html).includes(`/play?race=free&drill=${DRILLS[0].id}`));
});

test('a new player starts at the first level, with the next shut and what opens it said', async () => {
  const v = await mount(h(DrillsList, { lang: 'en' }));
  const [a, b] = v.$$('.pg-level');
  assert.match(a.textContent, /Your level/);
  assert.match(plain(a.querySelector('.pg-level-n').innerHTML), new RegExp(`^0 of ${first.length * 3} stars$`));
  assert.ok(b.classList.contains('off'));
  assert.match(b.textContent, new RegExp(`Opens with ${toOpen(LEVELS[1].id)} stars at ${LEVELS[0].name[0]} level\\.`));
  assert.equal(b.querySelector('a'), null, 'a shut drill has no way in');
  assert.match(b.textContent, /Not open yet/);
});

test('a drill you have done says your stars and offers it again', async () => {
  stars({ [first[0].id]: 2 });
  const v = await mount(h(DrillsList, { lang: 'en' }));
  const card = v.$$('.pg-card')[0];
  assert.equal(card.querySelector('.pg-stars').getAttribute('aria-label'), 'Your best: 2 of 3 stars');
  assert.equal(card.querySelectorAll('.pg-stars i.on').length, 2);
  assert.equal(card.querySelector('a').textContent, 'Again');
  assert.equal(v.$$('.pg-card')[1].querySelector('a').textContent, 'Start');
});

test('enough stars open the next level', async () => {
  stars(Object.fromEntries(first.map((d) => [d.id, 3])));
  const v = await mount(h(DrillsList, { lang: 'en' }));
  const [a, b] = v.$$('.pg-level');
  assert.equal(b.classList.contains('off'), false);
  assert.match(b.textContent, /Your level/);
  assert.doesNotMatch(a.textContent, /Your level/);
  assert.ok(b.querySelector('a'));
});

test('the drills are numbered straight through the levels', async () => {
  const v = await mount(h(DrillsList, { lang: 'en' }));
  assert.deepEqual(v.$$('.pg-n').map((n) => +n.textContent), DRILLS.map((_, i) => i + 1));
  assert.equal(v.$$('.pg-drills')[1].getAttribute('start'), String(first.length + 1));
});

test('damaged stars are read as none', async () => {
  localStorage.setItem(DRILLS_KEY, '{oops');
  const v = await mount(h(DrillsList, { lang: 'en' }));
  assert.equal(v.$$('.pg-level-n')[0].querySelector('b').textContent, '0');
});

test('the drills in Russian', async () => {
  const v = await mount(h(DrillsList, { lang: 'ru' }));
  assert.match(v.text(), /Твой уровень/);
  assert.match(v.text(), new RegExp(`Откроется с ${toOpen(LEVELS[1].id)} звёздами уровня «${LEVELS[0].name[1]}»`));
  assert.match(v.text(), new RegExp(`0 из ${first.length * 3} звёзд`));
  assert.deepEqual(englishIn(v.text()), []);
});

test('the hub’s row says your level and what the next one takes', async () => {
  stars({ [first[0].id]: 3 });
  const v = await mount(h(ProgressRows, { lang: 'en' }));
  assert.equal(v.$('a').getAttribute('href'), '/race/drills');
  assert.equal(plain(v.$('small').innerHTML), `${LEVELS[0].name[0]} · 3 of ${first.length * 3} stars · ${toOpen(LEVELS[1].id) - 3} more to open ${LEVELS[1].name[0]}`);
});

test('the hub’s row at the top level has nothing further to open', async () => {
  stars(Object.fromEntries(DRILLS.map((d) => [d.id, 3])));
  const v = await mount(h(ProgressRows, { lang: 'ru' }));
  const top = DRILLS.filter((d) => d.level === LEVELS.at(-1).id).length * 3;
  assert.equal(plain(v.$('small').innerHTML), `${LEVELS.at(-1).name[1]} · ${top} из ${top}`);
});

test('the hub’s row before the stars are read is just its name', () => {
  assert.equal(plain(ssr(h(ProgressRows, { lang: 'en' }))), 'Drills');
});

// ---------- your rival ----------
const rivalPage = (rows, field = [60, 70, 80]) => {
  logged({ [TODAY]: 70 });
  serve([brief(TODAY, field), [`day=${TODAY}`, json({ month: { rows } })]]);
};
const m = (name, pts, fl = null) => ({ k: name, name, fl, pts });

test('your rival is the next above you, and by how much', async () => {
  rivalPage([m('Far', 50), m('Near', 5, 'au'), m('Below', 1)]); // 2nd of 3: 2 points
  const v = await mount(h(RivalRow, { lang: 'en' }));
  assert.equal(v.$('a').getAttribute('href'), '/race/rating');
  assert.match(v.text(), /Your rival Near · 3 pts ahead/);
  assert.equal(v.$('.lb-who img').getAttribute('src'), '/flags/au.svg');
});

test('one point ahead is said in the singular, in each language', async () => {
  rivalPage([m('Near', 3)]);
  let v = await mount(h(RivalRow, { lang: 'en' }));
  assert.match(v.text(), /1 pt ahead/);
  await v.unmount();
  v = await mount(h(RivalRow, { lang: 'ru' }));
  assert.match(v.text(), /Твой соперник Near · впереди на 1 очко/);
});

test('with no one above you lead the month, by so much over the next', async () => {
  rivalPage([m('Below', 1)]);
  const v = await mount(h(RivalRow, { lang: 'en' }));
  assert.match(v.text(), /You lead the month 1 clear of Below/);
});

test('alone on the standings you lead with your points', async () => {
  rivalPage([]);
  const v = await mount(h(RivalRow, { lang: 'ru' }));
  assert.match(v.text(), /Ты лидер месяца 2 очка/);
});

test('you are never your own rival', async () => {
  rivalPage([m('Anna P.', 99), m('Below', 1)]);
  document.documentElement.style.setProperty('--me-name', '"Anna Petrova"');
  const v = await mount(h(RivalRow, { lang: 'en' }));
  assert.match(v.text(), /You lead the month/);
  assert.doesNotMatch(v.text(), /Anna/);
});

test('a guest’s times earn no points, so no rival is shown or asked for', async () => {
  logged({ [TODAY]: 75 });
  serve([brief(TODAY, [60, 70])]);
  const v = await mount(h(RivalRow, { lang: 'en' }));
  assert.equal(v.$('a'), null);
  assert.equal(dom.fetches.filter((f) => !f.url.includes('brief')).length, 0);
});

test('with the standings out of reach the row keeps quiet', async () => {
  logged({ [TODAY]: 70 });
  serve([brief(TODAY, [60, 70, 80]), [`day=${TODAY}`, json({}, 500)]]);
  const v = await mount(h(RivalLine, { lang: 'en' }));
  assert.match(v.text(), /You lead The month/);
});

test('the rating page’s strip says who, by how much and where you stand', async () => {
  rivalPage([m('Far', 50), m('Near', 5)]);
  const v = await mount(h(RivalLine, { lang: 'en' }));
  assert.match(v.text(), /Your rival Near \+3 pts You 3rd · 2 pts/);
  assert.equal(v.$('.pg-rv').classList.contains('lead'), false);
});

test('the strip for the leader, in Russian', async () => {
  rivalPage([m('Below', 1)]);
  const v = await mount(h(RivalLine, { lang: 'ru' }));
  assert.ok(v.$('.pg-rv').classList.contains('lead'));
  assert.match(v.text(), /Ты лидер Месяц \+1 очко Ты 1-й · 2 очка/);
});

// ---------- the hub's custom race ----------
test('one tap starts a custom race in that wind', async () => {
  const v = await mount(h(FreeQuick, { lang: 'en' }));
  assert.deepEqual(v.$$('.bt-pill-go').map((b) => plain(b.innerHTML)), ['Light 7 kn', 'Medium 12 kn', 'Strong 19 kn']);
  await click(v.$$('.bt-pill-go')[2]);
  const o = JSON.parse(localStorage.getItem('regatta'));
  assert.deepEqual([o.preset, o.mode, o.lastFree], ['strong', 'free', clock.now]);
  assert.deepEqual(location.assigned, ['/play?race=free']);
});

test('the last custom race is recalled once there has been one', async () => {
  let v = await mount(h(FreeQuick, { lang: 'en' }));
  assert.equal(v.$('.bt-k-r'), null);
  await v.unmount();
  localStorage.setItem('regatta', JSON.stringify({ lastFree: 1, venue: 'gocek', preset: 'light', fleet: 7, laps: 2 }));
  v = await mount(h(FreeQuick, { lang: 'en' }));
  assert.equal(v.$('.bt-k-r').textContent, `Last: ${venueOf('gocek').name[0]}, light, 7 boats, 2 laps`);
});

test('the last custom race in Russian counts its boats properly', async () => {
  localStorage.setItem('regatta', JSON.stringify({ lastFree: 1, venue: 'gocek', preset: 'strong', fleet: 3, laps: 1 }));
  const v = await mount(h(FreeQuick, { lang: 'ru' }));
  assert.equal(v.$('.bt-k-r').textContent, `Прошлая: ${venueOf('gocek').name[1]}, сильный, 3 лодки`);
  assert.match(v.text(), /Слабый 7 уз/);
});

test('the 1-on-1 race shows only at an address that asks for it', async () => {
  let v = await mount(h(MatchCard, { lang: 'en' }));
  assert.equal(v.$('a'), null);
  await v.unmount();
  reset({ url: 'https://updown.test/race?match' });
  v = await mount(h(MatchCard, { lang: 'ru' }));
  assert.equal(v.$('a').getAttribute('href'), '/match/new');
  assert.match(v.text(), /Гонка 1 на 1 Вы и друг, один на один: отправьте ссылку\./);
  assert.equal(v.$('a').textContent, 'Настроить гонку 1 на 1');
});

// ---------- the custom race's set-up ----------
const setup = (p = {}) => mount(h(FreeSetup, { lang: 'en', from: null, ...p }));
const pill = (v, id, label) => v.$$(`[aria-labelledby="${id}"] button`).find((b) => b.textContent.startsWith(label));
const on = (v, id) => v.$$(`[aria-labelledby="${id}"] button`).filter((b) => b.getAttribute('aria-checked') === 'true').map((b) => b.textContent);
const other = VENUES.find((x) => x.id !== 'gocek' && !x.skip?.length);

test('the set-up opens on what you chose last', async () => {
  localStorage.setItem('regatta', JSON.stringify({ venue: other.id, yacht: 'laser', preset: 'strong', fleet: 7, length: 'medium', laps: 2, start: 3, current: 1, course: 'wl', daytime: 'sunset' }));
  const v = await setup();
  assert.equal(v.$('#fs-title').childNodes[0].textContent, other.name[0]);
  assert.deepEqual(on(v, 'fs-yacht'), [yachtOf('laser').name[0]]);
  assert.deepEqual(on(v, 'fs-preset'), ['Strong 19 kn']);
  assert.deepEqual(on(v, 'fs-fleet'), ['7 boats']);
  assert.deepEqual(on(v, 'fs-laps'), ['2 laps']);
  assert.deepEqual(on(v, 'fs-start'), ['3 min']);
  assert.deepEqual(on(v, 'fs-current'), ['On']);
  assert.deepEqual(on(v, 'fs-daytime'), ['Sunset']);
  assert.match(v.text(), /The sun on the horizon/);
});

test('a yacht asked for in the address is the one set up', async () => {
  reset({ url: 'https://updown.test/race/free?yacht=optimist' });
  const v = await setup();
  assert.deepEqual(on(v, 'fs-yacht'), [yachtOf('optimist').name[0]]);
});

test('a yacht the game doesn’t have is ignored', async () => {
  reset({ url: 'https://updown.test/race/free?yacht=titanic' });
  const v = await setup();
  assert.deepEqual(on(v, 'fs-yacht'), [yachtOf('jpk1050').name[0]]);
});

test('Start saves the choices where the game reads them and opens the race', async () => {
  const v = await setup();
  await click(pill(v, 'fs-preset', 'Light'));
  await click(pill(v, 'fs-fleet', '3 boats'));
  await click(v.$('.bt-go'));
  const o = JSON.parse(localStorage.getItem('regatta'));
  assert.deepEqual([o.preset, o.fleet, o.mode, o.lastFree], ['light', 3, 'free', clock.now]);
  assert.deepEqual(location.assigned, ['/play?race=free']);
});

test('the numbers over the scene follow the choices', async () => {
  const v = await setup();
  const beat = () => v.$$('.bt-stats b')[0].querySelector('span span').textContent;
  const a = beat();
  await click(pill(v, 'fs-length', 'Medium'));
  assert.ok(+beat() > +a, 'a longer course has a longer beat');
  assert.equal(v.$$('.bt-stats b')[0].querySelector('.unit').textContent, 'm');
  assert.match(v.$('.fs-course-in .bt-k-r').textContent, /^Medium · 1 lap · \d+ m$/);
});

test('a personal best on this course is shown, and none is a dash', async () => {
  let v = await setup();
  assert.equal(v.$$('.bt-stats b')[2].textContent, '—');
  assert.match(v.text(), /The game keeps your best time on every course\./);
  await v.unmount();
  localStorage.setItem('regatta-pb', JSON.stringify({ [pbKey({ preset: 'medium', laps: 1, length: 'short', fleet: 5, course: 'wl', yacht: 'jpk1050' })]: 123.4 }));
  v = await setup();
  assert.equal(v.$$('.bt-stats b')[2].textContent, '2:03.4');
  assert.match(v.text(), /Your best in this wind, fleet and course, at any venue: 2:03\.4\./);
});

test('picking the wind shows it over the course, and the caption can be closed', async () => {
  const v = await setup();
  assert.equal(v.$('.bt-cap'), null);
  await click(pill(v, 'fs-preset', 'Strong'));
  assert.match(v.$('.bt-cap').textContent, /Wind · 19 kn/);
  assert.match(v.$('.bt-cap').textContent, /up to 26 kn; the wind swings up to 14° either way/);
  await click(v.$('.bt-cap-x'));
  assert.equal(v.$('.bt-cap'), null);
});

test('the current’s caption says whether the water runs', async () => {
  const v = await setup();
  await click(pill(v, 'fs-current', 'On'));
  assert.match(v.$('.bt-cap').textContent, /Current · the venue’s own/);
  await click(pill(v, 'fs-current', 'Off'));
  assert.match(v.$('.bt-cap').textContent, venueOf('gocek').runs ? /the venue’s own/ : /No current/);
});

test('Show course flies to the course and back to the boats', async () => {
  const v = await setup();
  const btn = v.$('.bt-show');
  assert.equal(btn.textContent, 'Show course');
  await click(btn);
  assert.equal(v.$('.bt-show').getAttribute('aria-pressed'), 'true');
  assert.equal(v.$('.bt-show').textContent, 'Boats');
  assert.match(v.$('.bt-cap').textContent, /Up and down · 1 lap · \d+ m/);
  await click(v.$('.bt-show'));
  assert.equal(v.$('.bt-cap'), null);
});

test('four places are offered, today’s first, and All opens every one', async () => {
  const v = await setup();
  const d = dailyRace();
  const names = () => v.$$('#fs-places button').map((b) => b.textContent);
  assert.equal(names().length, 4);
  assert.equal(names()[0], venueOf(d.venue).name[0]);
  await click(v.$('.fs-all'));
  assert.equal(names().length, VENUES.length);
  assert.equal(v.$('.fs-all').getAttribute('aria-expanded'), 'true');
  const sorted = [...names()].sort((a, b) => a.localeCompare(b, 'en'));
  assert.deepEqual(names(), sorted);
  await click(v.$$('#fs-places button').find((b) => b.textContent === other.name[0]));
  assert.equal(names().length, 4, 'picking one folds the list');
  assert.ok(names().includes(other.name[0]), 'and it stays among the four');
  assert.equal(v.$('#fs-title').childNodes[0].textContent, other.name[0]);
});

test('a venue you have raced is said to be, without a mark on it', async () => {
  localStorage.setItem('regatta-log', JSON.stringify({ d: {}, v: { gocek: 5 } }));
  const v = await setup();
  const b = v.$$('#fs-places button').find((x) => x.textContent.startsWith(venueOf('gocek').name[0]));
  assert.equal(b.getAttribute('title'), 'You’ve raced here');
  assert.match(b.textContent, / · raced$/);
});

test('a length a venue has no room for isn’t offered, and a choice of it comes down', async () => {
  const tight = VENUES.find((x) => x.skip?.includes('long'));
  assert.ok(tight, 'a venue without room for the long course');
  localStorage.setItem('regatta', JSON.stringify({ venue: tight.id, length: 'long' }));
  const v = await setup();
  assert.equal(pill(v, 'fs-length', 'Long'), undefined);
  assert.deepEqual(on(v, 'fs-length'), [lengthOffered(tight.id, 'medium') ? 'Medium' : 'Short']);
});

test('a shape a venue has no room for isn’t offered, and goes back to up and down', async () => {
  const tight = VENUES.find((x) => x.skip?.some((s) => s.includes(':')));
  assert.ok(tight, 'a venue without room for a shape');
  const [shape, length] = tight.skip.find((s) => s.includes(':')).split(':');
  localStorage.setItem('regatta', JSON.stringify({ venue: tight.id, length, course: shape }));
  const v = await setup();
  assert.equal(shapeOffered(tight.id, shape, length), false);
  assert.deepEqual(on(v, 'fs-course'), ['Up and down']);
});

test('opened from today’s race it starts on today’s settings and counts what you change', async () => {
  const d = dailyRace();
  const v = await setup({ from: 'today' });
  assert.equal(v.$('#fs-title').childNodes[0].textContent, venueOf(d.venue).name[0]);
  assert.equal(v.$('.bt-what'), null, 'nothing changed yet');
  await click(pill(v, 'fs-preset', d.preset === 'strong' ? 'Light' : 'Strong'));
  assert.match(v.$('.bt-what').textContent, /A custom race with 1 change from today’s\. It doesn’t go on today’s ranking\./);
  assert.ok(v.$('#fs-preset .bt-chg'), 'the choice changed is marked');
  await click(pill(v, 'fs-fleet', '7 boats'));
  assert.match(v.$('.bt-what').textContent, /with 2 changes from today’s/);
});

test('opened from a race being sailed it restarts that race', async () => {
  const v = await setup({ from: 'race' });
  assert.match(v.text(), /Change the race/);
  assert.equal(v.$('.bt-go').textContent, 'Restart with these');
  await click(pill(v, 'fs-laps', '2 laps'));
  assert.match(v.$('.bt-what').textContent, /The race starts over, with 1 change\./);
});

test('the course’s caption tells the way round each shape', async () => {
  const v = await setup();
  await click(v.$('.bt-show'));
  assert.match(v.$('.bt-cap').textContent, /down to the gate, then down to the finish\./);
  await click(pill(v, 'fs-laps', '2 laps'));
  assert.match(v.$('.bt-cap').textContent, /lap 1 in gold, lap 2 in blue\./);
  await click(pill(v, 'fs-course', 'Triangle'));
  assert.match(v.$('.bt-cap').textContent, /a reach out to the wing mark/);
  assert.match(v.text(), /a gybe there and a broad reach back/);
  await click(pill(v, 'fs-course', 'Trapezoid'));
  assert.match(v.$('.bt-cap').textContent, /Last, a reach across to the finish line\./);
  await click(pill(v, 'fs-laps', '1 lap'));
  assert.match(v.$('.bt-cap').textContent, /then a reach across to the finish line\./);
});

test('the scene is told the race and what to show', async () => {
  const v = await setup();
  const f = v.$('iframe');
  await fromFrame(f, { type: 'ready' });
  const sent = f.contentWindow.sent.filter((x) => x.type === 'setup').at(-1);
  assert.deepEqual([sent.view, sent.race.fleet, sent.race.length], ['boats', 5, 'short']);
  assert.equal(sent.labels.line, 'Start · Finish');
  await click(pill(v, 'fs-course', 'Trapezoid'));
  const next = f.contentWindow.sent.filter((x) => x.type === 'setup').at(-1);
  assert.deepEqual([next.view, next.labels.windward, next.labels.line], ['course', 'Mark 1', 'Start']);
});

test('a 1-on-1 race is set up as a custom race is, but for the number of boats', async () => {
  const v = await setup({ match: true });
  assert.match(v.text(), /1-on-1 race/);
  assert.equal(v.$('.bt-go').textContent, 'Create the race');
  assert.equal(v.$('#fs-fleet'), null, 'always two boats');
  for (const id of ['fs-laps', 'fs-start', 'fs-current', 'fs-daytime', 'fs-course']) assert.ok(v.$(`#${id}`), id);
  assert.match(v.text(), /You and a friend, one on one\./);
});

test('a 1-on-1 race opens with today\'s settings, whatever was sailed last', async () => {
  localStorage.setItem('regatta', JSON.stringify({ venue: 'palma', preset: 'strong', laps: 2 }));
  const v = await setup({ match: true }), d = dailyRace();
  await click(v.$('.bt-go'));
  const kept = JSON.parse(localStorage.getItem('regatta-match-settings'));
  assert.deepEqual([kept.venue, kept.yacht, kept.preset, kept.length, kept.laps, kept.start, kept.current, kept.course], [d.venue, d.yacht, d.preset, d.length, d.laps, d.start, d.current, d.course]);
});

test('creating a 1-on-1 race keeps its code as the host\'s, every setting chosen, and opens the game at it', async () => {
  const v = await setup({ match: true }), d = dailyRace();
  await click(pill(v, 'fs-preset', 'Light'));
  await click(pill(v, 'fs-laps', d.laps === 2 ? '1 lap' : '2 laps'));
  await click(v.$('.bt-go'));
  const { code } = JSON.parse(localStorage.getItem('regatta-match-host'));
  assert.match(code, /^[A-HJ-KM-NP-Z2-9]{6}$/);
  const kept = JSON.parse(localStorage.getItem('regatta-match-settings'));
  assert.equal(kept.preset, 'light');
  assert.equal(kept.laps, d.laps === 2 ? 1 : 2);
  assert.deepEqual(Object.keys(kept).sort(), ['course', 'current', 'daytime', 'laps', 'length', 'preset', 'start', 'venue', 'yacht']);
  assert.deepEqual(location.assigned, [`/play?match=${code}&venue=${d.venue}&boat=${d.yacht}`]);
});

test('a match still opens where storage is blocked', async () => {
  const v = await setup({ match: true });
  dom.storageBlocked = true;
  await click(v.$('.bt-go'));
  assert.match(location.assigned[0], /^\/play\?match=/);
});

test('the 1-on-1 race’s set-up describes one race, not a best of three', async () => {
  const v = await setup({ match: true });
  assert.doesNotMatch(v.text(), /Best of 3/);
});

test('the set-up in Russian', async () => {
  const v = await setup({ lang: 'ru' });
  for (const w of ['Своя гонка', 'Настрой гонку', 'Начать гонку', 'Дистанция', 'Слабый 7 уз', '5 лодок', '1 круг', 'Твоя дистанция', 'Лавировка', 'Рекорд']) assert.ok(v.text().includes(w), w);
  for (const w of ['Start race', 'Show course', 'Your course', 'Light 7 kn', '5 boats', 'Time of day']) assert.ok(!v.text().includes(w), w);
  assert.match(v.$('.bt-p').textContent, /преобладающий ветер/);
});

// ---------- the course map ----------
const map = (shape = 'wl', p = {}) => ssr(h(CourseMap, { lang: 'en', geo: plannedCourse('medium', 'short', 5, shape), preset: 'medium', W: 320, H: 320, ...p }));
const svgText = (html) => [...html.matchAll(/<text[^>]*>(.*?)<\/text>/g)].map((m) => plain(m[1]));

test('the map is described to a screen reader with its real lengths', () => {
  const g = plannedCourse('medium', 'short', 5, 'wl');
  const beat = Math.round(Math.hypot(g.windward[0] - (g.pin[0] + g.committee[0]) / 2, g.windward[1] - (g.pin[1] + g.committee[1]) / 2));
  assert.match(map(), new RegExp(`role="img" aria-label="The course from above, to scale: a ${beat} m beat, a \\d+ m start line, a \\d+ m gate"`));
  assert.match(map('wl', { lang: 'ru' }), new RegExp(`aria-label="Дистанция сверху, в масштабе: лавировка ${beat} м, стартовая линия \\d+ м, ворота \\d+ м"`));
});

test('up and down names its windward mark, its gate, and the line it starts and finishes on', () => {
  const t = svgText(map());
  assert.ok(t.includes('WINDWARD MARK'));
  assert.ok(t.some((x) => /^GATE \d+ M$/.test(x)));
  assert.ok(t.some((x) => /^START · FINISH \d+ M$/.test(x)));
  assert.ok(t.includes(`WIND ${KN.medium} KN`));
  assert.ok(!t.includes('FINISH'), 'no finish line of its own');
});

test('each shape names its own marks', () => {
  assert.ok(svgText(map('tri')).includes('WING MARK'));
  const trap = svgText(map('trap'));
  for (const w of ['MARK 1', 'MARK 2', 'FINISH']) assert.ok(trap.includes(w), w);
  assert.ok(trap.some((x) => /^START \d+ M$/.test(x)));
  const wlu = svgText(map('wlu'));
  for (const w of ['WINDWARD MARK', 'OFFSET MARK', 'FINISH']) assert.ok(wlu.includes(w), w);
});

test('the map’s words are Russian in Russian', () => {
  for (const shape of ['wl', 'tri', 'trap', 'wlu']) assert.deepEqual(englishIn(svgText(map(shape, { lang: 'ru' })).join(' ')), [], shape);
  const t = svgText(map('trap', { lang: 'ru' }));
  for (const w of ['ЗНАК 1', 'ЗНАК 2', 'ФИНИШ', `ВЕТЕР ${KN.medium} УЗ`]) assert.ok(t.includes(w), w);
});

test('the guide’s route and the fleet on the line are drawn only when asked for', () => {
  const plainMap = map(), guide = map('wl', { route: true, fleet: 5 });
  assert.ok(guide.length > plainMap.length);
  assert.equal([...guide.matchAll(/transform="translate\(/g)].length, 5);
  assert.equal([...plainMap.matchAll(/transform="translate\(/g)].length, 0);
  assert.equal([...guide.matchAll(/fill="#3db8ff" stroke="#04121e"/g)].length, 1, 'one of them is you');
  for (const shape of ['tri', 'trap', 'wlu']) assert.match(map(shape, { route: true }), /stroke-dasharray="4 5"/, shape);
});

test('a lone boat stands in the middle of the line', () => {
  assert.equal([...map('wl', { fleet: 1 }).matchAll(/transform="translate\(/g)].length, 1);
});

test('the debrief draws every boat’s track, yours in your colour, and rings the fouls', () => {
  const tracks = [{ pts: [[0, 0], [10, -50]], me: true }, { pts: [[5, 0], [15, -50]], me: false }, { pts: [[9, 0], [19, -50]], me: false }];
  const html = map('wl', { tracks, fouls: [[3, -20], [4, -30]] });
  assert.equal([...html.matchAll(/stroke="#3db8ff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/g)].length, 1);
  assert.equal([...html.matchAll(/stroke-width="1\.2"/g)].length, 2);
  assert.equal([...html.matchAll(/r="7" fill="none" stroke="#ff3b30"/g)].length, 2);
});

test('a race saved before the shapes, with only a wing mark, still draws as a triangle', () => {
  const g = plannedCourse('medium', 'short', 5, 'wl');
  const old = { windward: g.windward, gate: g.gate, pin: g.pin, committee: g.committee, wing: [g.windward[0] + 150, g.windward[1] + 150] };
  assert.ok(svgText(ssr(h(CourseMap, { lang: 'en', geo: old, preset: 'light', W: 320, H: 320 }))).includes('WING MARK'));
});

test('two maps on a page keep their patterns apart', async () => {
  const v = await mount(h('div', null, h(CourseMap, { lang: 'en', geo: plannedCourse('medium', 'short', 5), preset: 'medium', W: 200, H: 200 }), h(CourseMap, { lang: 'en', geo: plannedCourse('medium', 'short', 5), preset: 'medium', W: 200, H: 200 })));
  const ids = v.$$('pattern').map((p) => p.id);
  assert.equal(new Set(ids).size, 2);
});

// ---------- the replay ----------
const RES = {
  id: 'r', daily: null, preset: 'light', length: 'short', laps: 1, start: 1, current: false,
  course: { windward: [0, -300], gate: [[-20, 0], [20, 0]], pin: [-50, 10], committee: [50, 10], legs: ['mark', 'gate', 'finish'] },
  boats: [{ name: null, me: true, done: true, dsq: false, secs: 100, track: [[0, 0], [0, -100], [0, -300]] }, { name: 'Bo', me: false, done: true, dsq: false, secs: 110, track: [[1, 0], [1, -100]] }],
};
const replay = (p = {}) => mount(h('div', null, h(GameScene, { venue: 'gocek', wind: 'light', title: 'S', finish: {} }), h(Replay, { res: RES, lang: 'en', ...p })));
const toFrame = (v) => v.$('iframe').contentWindow.sent.filter((m) => m.type === 'replay');
const clockText = (v) => v.$('.rs-rp-t b').textContent;

test('the replay starts from a button, a little before the gun', async () => {
  const v = await replay();
  assert.equal(v.$('.rs-replay'), null);
  assert.equal(v.$('.rs-replay-go').textContent, 'Replay');
  await click(v.$('.rs-replay-go'));
  assert.ok(v.$('.rs-replay'));
  assert.equal(clockText(v), '−0:15.0');
  assert.match(v.$('.rs-rp-t small').textContent, /Before the gun/);
  assert.deepEqual(toFrame(v)[0], { type: 'replay', boats: posesAt(RES, -15) });
  assert.deepEqual(dom.tracked, [['Replay', undefined]]);
});

test('it plays at the speed chosen, telling the scene each frame', async () => {
  const v = await replay();
  await click(v.$('.rs-replay-go'));
  const before = toFrame(v).length;
  await tick(1000);
  assert.ok(toFrame(v).length > before + 30);
  assert.equal(clockText(v), '−0:07.1', 'eight times as fast to begin with');
  await click(v.$('.rs-rp-s'));
  assert.equal(v.$('.rs-rp-s').textContent, '16×');
  await tick(1000);
  assert.match(clockText(v), /^0:08\.\d$/);
});

test('the speed goes round eight, sixteen and four times', async () => {
  const v = await replay();
  await click(v.$('.rs-replay-go'));
  const seen = [v.$('.rs-rp-s').textContent];
  for (let i = 0; i < 3; i++) { await click(v.$('.rs-rp-s')); seen.push(v.$('.rs-rp-s').textContent); }
  assert.deepEqual(seen, ['8×', '16×', '4×', '8×']);
});

test('pause holds the clock and play goes on from there', async () => {
  const v = await replay();
  await click(v.$('.rs-replay-go'));
  await click(v.$('.rs-rp-b'));
  assert.equal(v.$('.rs-rp-b').getAttribute('aria-label'), 'Play');
  const held = clockText(v);
  await tick(500);
  assert.equal(clockText(v), held);
  await click(v.$('.rs-rp-b'));
  assert.equal(v.$('.rs-rp-b').getAttribute('aria-label'), 'Pause');
  await tick(500);
  assert.notEqual(clockText(v), held);
});

test('dragging the slider moves through the race and pauses it', async () => {
  const v = await replay({ myLegs: [0, 40, 80] });
  await click(v.$('.rs-replay-go'));
  await type(v.$('.rs-rp-r'), '50');
  assert.equal(clockText(v), '0:50.0');
  assert.equal(v.$('.rs-rp-r').getAttribute('aria-valuetext'), '0:50.0');
  assert.match(v.$('.rs-rp-t small').textContent, /Leg 2 of 2/);
  assert.equal(v.$('.rs-rp-b').getAttribute('aria-label'), 'Play');
  assert.deepEqual(toFrame(v).at(-1), { type: 'replay', boats: posesAt(RES, 50) });
});

test('the clock says which leg you were on', async () => {
  const v = await replay({ myLegs: [2, 40, 80] });
  await click(v.$('.rs-replay-go'));
  await type(v.$('.rs-rp-r'), '1');
  assert.equal(v.$('.rs-rp-t small').textContent, 'The start');
  await type(v.$('.rs-rp-r'), '10');
  assert.equal(v.$('.rs-rp-t small').textContent, 'Leg 1 of 2');
  await type(v.$('.rs-rp-r'), '-5');
  assert.equal(v.$('.rs-rp-t small').textContent, 'Before the gun');
});

test('it holds at the end, and play from there starts it over', async () => {
  const v = await replay();
  await click(v.$('.rs-replay-go'));
  await type(v.$('.rs-rp-r'), '99.5');
  await click(v.$('.rs-rp-b'));
  await tick(600);
  assert.equal(clockText(v), '1:40.0');
  assert.equal(v.$('.rs-rp-b').getAttribute('aria-label'), 'Play');
  await click(v.$('.rs-rp-b'));
  assert.equal(v.$('.rs-rp-b').getAttribute('aria-label'), 'Pause');
  assert.match(clockText(v), /^−0:1[45]\.\d$/);
});

test('closing it puts the finish back', async () => {
  const v = await replay();
  await click(v.$('.rs-replay-go'));
  await click(v.$('.rs-rp-x'));
  assert.equal(v.$('.rs-replay'), null);
  assert.ok(v.$('.rs-replay-go'));
  assert.deepEqual(toFrame(v).at(-1), { type: 'replay', off: true });
});

test('the replay in Russian', async () => {
  const v = await replay({ lang: 'ru' });
  assert.equal(v.$('.rs-replay-go').textContent, 'Повтор');
  await click(v.$('.rs-replay-go'));
  assert.equal(v.$('.rs-rp-t small').textContent, 'До старта');
  assert.equal(v.$('.rs-rp-x').getAttribute('aria-label'), 'Закрыть повтор');
});

// ---------- how was the race ----------
const posted = () => dom.fetches.filter((f) => f.init?.method === 'POST').map((f) => JSON.parse(f.init.body));
const stars5 = (v) => v.$$('.rr-stars button');

test('the question asks for one to five stars, each with its word', async () => {
  const v = await mount(h(RateRace, { id: 'r1', lang: 'en' }));
  assert.match(v.text(), /How was the race\?/);
  assert.deepEqual(stars5(v).map((b) => b.getAttribute('aria-label')), ['1 · Bad', '2 · Not great', '3 · OK', '4 · Good', '5 · Loved it']);
});

test('a rating is posted at once and kept, and the stars are then fixed', async () => {
  serve([['api/game', json({})]]);
  const v = await mount(h(RateRace, { id: 'r1', lang: 'en' }));
  await click(stars5(v)[3]);
  assert.deepEqual(posted(), [{ ev: 'rate', id: 'r1', rating: 4 }]);
  assert.equal(localStorage.getItem('regatta-rated-r1'), '4');
  assert.ok(stars5(v).every((b) => b.disabled));
  assert.equal(stars5(v).filter((b) => b.className === 'on').length, 4);
  assert.equal(stars5(v)[3].getAttribute('aria-checked'), 'true');
});

test('a low rating asks what got in the way, a high one what would make it better', async () => {
  serve([['api/game', json({})]]);
  let v = await mount(h(RateRace, { id: 'r1', lang: 'en' }));
  await click(stars5(v)[2]);
  assert.match(v.$('.rr-l').textContent, /What got in the way\?/);
  await v.unmount();
  localStorage.clear();
  v = await mount(h(RateRace, { id: 'r2', lang: 'en' }));
  await click(stars5(v)[4]);
  assert.match(v.$('.rr-l').textContent, /What would make it better\?/);
});

test('a comment is sent trimmed, and thanks are said', async () => {
  serve([['api/game', json({})]]);
  const v = await mount(h(RateRace, { id: 'r1', lang: 'en' }));
  await click(stars5(v)[0]);
  assert.equal(v.$('.rr-send').textContent, 'Done');
  await type(v.$('textarea'), '  too hard  ');
  assert.equal(v.$('.rr-send').textContent, 'Send');
  await click(v.$('.rr-send'));
  assert.deepEqual(posted().at(-1), { ev: 'rate', id: 'r1', comment: 'too hard' });
  assert.match(v.text(), /Thank you — it helps us make the game better\./);
  assert.equal(v.$('.rr-stars'), null);
});

test('no comment, nothing more is sent', async () => {
  serve([['api/game', json({})]]);
  const v = await mount(h(RateRace, { id: 'r1', lang: 'ru' }));
  await click(stars5(v)[4]);
  await click(v.$('.rr-send'));
  assert.equal(posted().length, 1);
  assert.match(v.text(), /Спасибо — это помогает делать игру лучше\./);
});

test('a race already rated isn’t asked about again', async () => {
  localStorage.setItem('regatta-rated-r1', '5');
  const v = await mount(h(RateRace, { id: 'r1', lang: 'en' }));
  assert.equal(v.$('.rr'), null);
});

test('a copy of the game run locally posts nothing', async () => {
  reset({ url: 'http://localhost:5193/race/result/r1' });
  const v = await mount(h(RateRace, { id: 'r1', lang: 'en' }));
  await click(stars5(v)[4]);
  assert.equal(dom.fetches.length, 0);
});

test('the question in Russian', async () => {
  const v = await mount(h(RateRace, { id: 'r1', lang: 'ru' }));
  assert.match(v.text(), /Как тебе гонка\?/);
  assert.deepEqual(englishIn(v.$('.rr').outerHTML.replace(/<[^>]+>/g, '')), []);
});

// ---------- the music ----------
class Param { value = 0; ramps = []; cancelScheduledValues() {} setValueAtTime(v) { this.value = v; } linearRampToValueAtTime(v, t) { this.value = v; this.ramps.push([v, t]); } exponentialRampToValueAtTime(v, t) { this.value = v; this.ramps.push([v, t]); } }
class AudioNodeFake { gain = new Param(); frequency = new Param(); Q = new Param(); connect(n) { return n; } }
const sound = { contexts: [], audios: [], tapNeeded: false, passes: [] };
class AudioContextFake {
  state = 'suspended'; currentTime = 10; destination = {}; closed = false;
  constructor() { sound.contexts.push(this); this.master = null; }
  createGain() { const n = new AudioNodeFake(); this.master ??= n; return n; }
  createBiquadFilter() { this.filter = new AudioNodeFake(); return this.filter; }
  createMediaElementSource(el) { this.element = el; return new AudioNodeFake(); }
  createBufferSource() { const s = { connect: (n) => n, start: (...a) => sound.passes.push(a), stop() { s.stopped = true; } }; return s; }
  decodeAudioData(_, ok) { ok({ sampleRate: 44100, getChannelData: () => new Float32Array([0, 0.5]) }); }
  async resume() { if (!sound.tapNeeded) this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
  async close() { this.state = 'closed'; this.closed = true; }
}
class AudioFake {
  paused = true; loop = false; attrs = {};
  constructor(src) { if (src) this.src = src; sound.audios.push(this); }
  get src() { return this.attrs.src; } set src(v) { this.attrs.src = v; }
  getAttribute(k) { return this.attrs[k] ?? null; } removeAttribute(k) { delete this.attrs[k]; }
  async play() { if (sound.tapNeeded) throw new Error('NotAllowed'); this.paused = false; }
  pause() { this.paused = true; } load() {}
}
const withSound = (o = {}) => {
  Object.assign(sound, { contexts: [], audios: [], passes: [], tapNeeded: false });
  globalThis.AudioContext = AudioContextFake; globalThis.Audio = AudioFake;
  localStorage.setItem('regatta', JSON.stringify({ musicV: 2, ...o }));
  serve([['/play', { ok: true, status: 200, text: async () => '<script type="importmap">{"imports":{"/game/music-racing.mp3":"/game/music-racing.abc.mp3"}}</script>' }], ['/game/', json({})]]);
};
const here = (path) => { globalThis.__nav.path = path; };
const settings = (o) => doing(() => { localStorage.setItem('regatta', JSON.stringify({ musicV: 2, ...o })); dispatchEvent(new Event('regatta-opts')); });

test('every track’s calm piece has somewhere to start and a length', () => {
  for (const [id, [at, len]] of Object.entries(CALM)) { assert.ok(at >= 0 && len > 10, id); }
});

test('the music plays only on the hub and the custom race’s set-up', async () => {
  withSound({ music: 'racing' });
  for (const p of ['/', '/race/rating', '/boat', '/race/drills']) { here(p); const v = await mount(h(RaceMusic)); await v.unmount(); }
  assert.equal(sound.contexts.length, 0);
  for (const p of ['/race', '/race/free', '/ru/race', '/en/race/free/']) { here(p); const v = await mount(h(RaceMusic)); await v.unmount(); }
  assert.equal(sound.contexts.length, 4);
});

test('with Sound or Music off nothing starts', async () => {
  here('/race');
  withSound({ sound: 0, music: 'racing' });
  let v = await mount(h(RaceMusic));
  await v.unmount();
  withSound({ music: 'off' });
  v = await mount(h(RaceMusic));
  assert.equal(sound.contexts.length, 0);
});

test('where the browser has no audio the page does without', async () => {
  here('/race');
  delete globalThis.AudioContext;
  await mount(h(RaceMusic));
  assert.equal(dom.fetches.length, 0);
});

test('the track picked plays from the address the game’s page gives it, looped ahead of time', async () => {
  here('/race');
  withSound({ music: 'racing' });
  await mount(h(RaceMusic));
  assert.ok(dom.fetches.some((f) => f.url === '/game/music-racing.abc.mp3'));
  assert.equal(sound.passes.length, 1);
  const c = sound.contexts[0];
  assert.equal(c.master.gain.value, 0.625, 'half volume, a little up for the muffle');
  assert.equal(c.filter.frequency.value, 900, 'muffled behind the card');
  c.currentTime = 10 + CALM.racing[1];
  await tick(500);
  assert.equal(sound.passes.length, 2, 'the next pass is laid on before the last ends');
});

test('Music volume sets its level', async () => {
  here('/race/free');
  withSound({ music: 'groove', musicVol: 'quiet' });
  await mount(h(RaceMusic));
  assert.equal(sound.contexts[0].master.gain.value, 0.25);
  await settings({ music: 'groove', musicVol: 'loud' });
  assert.equal(sound.contexts[0].master.gain.value, 1);
});

test('a browser that won’t play before a tap starts on the first one', async () => {
  here('/race');
  withSound({ music: 'riff' });
  sound.tapNeeded = true;
  await mount(h(RaceMusic));
  assert.equal(sound.passes.length, 0);
  sound.tapNeeded = false;
  await fire(document.body, 'pointerdown');
  await settle();
  assert.equal(sound.passes.length, 1);
});

test('over Start the muffle lifts, and comes down again off it', async () => {
  here('/race');
  withSound({ music: 'racing' });
  const v = await mount(h('a', { className: 'bt-go', href: '/play' }, h('span', { id: 'in' }, 'Start')));
  await v.unmount();
  const page = await mount(h('div', null, h('a', { className: 'bt-go', href: '/play' }, h('span', { id: 'in' }, 'Start')), h('p', { id: 'off' }, 'x'), h(RaceMusic)));
  const c = sound.contexts[0];
  await fire(page.$('#in'), 'pointerover');
  assert.equal(c.filter.frequency.value, 20000);
  assert.equal(c.master.gain.value, 0.5, 'and the lift it had for the muffle goes');
  await fire(page.$('#in'), 'pointerout', { relatedTarget: page.$('.bt-go') });
  assert.equal(c.filter.frequency.value, 20000, 'still on Start');
  await fire(page.$('#in'), 'pointerout', { relatedTarget: page.$('#off') });
  assert.equal(c.filter.frequency.value, 900);
});

test('turning the music off fades it and goes quiet', async () => {
  here('/race');
  withSound({ music: 'racing' });
  await mount(h(RaceMusic));
  await settings({ music: 'off' });
  const c = sound.contexts[0];
  assert.equal(c.master.gain.value, 0);
  await tick(500);
  assert.equal(c.state, 'suspended');
});

test('another track takes over after the fade', async () => {
  here('/race');
  withSound({ music: 'racing' });
  await mount(h(RaceMusic));
  await settings({ music: 'groove' });
  await tick(460);
  await settle();
  assert.ok(dom.fetches.some((f) => f.url.includes('music-groove')));
  assert.equal(sound.passes.length, 2);
});

test('the music stops while the page is hidden and comes back with it', async () => {
  here('/race');
  withSound({ music: 'racing' });
  await mount(h(RaceMusic));
  const c = sound.contexts[0];
  document.hidden = true;
  await fire(document, 'visibilitychange');
  await tick(500);
  assert.equal(c.state, 'suspended');
  document.hidden = false;
  await fire(document, 'visibilitychange');
  await settle();
  assert.equal(c.state, 'running');
});

test('the playlist streams the song coming up', async () => {
  here('/race');
  withSound({ music: 'playlist' });
  localStorage.setItem('regatta-song', '1');
  await mount(h(RaceMusic));
  await settle();
  assert.equal(sound.audios.length, 1);
  assert.equal(sound.audios[0].getAttribute('src'), '/game/music-song-2.m4a');
  assert.equal(sound.audios[0].paused, false);
  assert.equal(sound.audios[0].loop, true);
});

test('going to another page fades the music out and shuts it down', async () => {
  here('/race');
  withSound({ music: 'racing' });
  const v = await mount(h(RaceMusic));
  const c = sound.contexts[0];
  await v.unmount();
  assert.equal(c.master.gain.value, 0);
  assert.equal(c.closed, false, 'it fades first');
  await tick(700);
  await settle();
  assert.equal(c.closed, true);
});

test('home’s song starts with the page and follows Settings', async () => {
  withSound({ music: 'racing' });
  await mount(h(Soundtrack));
  const el = sound.audios[0], c = sound.contexts[0];
  assert.equal(el.getAttribute('src'), '/game/music-finish.m4a');
  assert.deepEqual([el.loop, el.preload, el.paused], [true, 'none', false]);
  assert.equal(c.master.gain.value, 0.5);
  await settings({ music: 'racing', musicVol: 'quiet' });
  assert.equal(c.master.gain.value, 0.2);
  await settings({ music: 'off' });
  assert.equal(c.master.gain.value, 0);
  await tick(460);
  assert.equal(el.paused, true);
});

test('home’s song stays silent with Sound off, and starts when it is turned on', async () => {
  withSound({ sound: 0 });
  await mount(h(Soundtrack));
  assert.equal(sound.contexts.length, 0);
  assert.equal(sound.audios[0].paused, true);
  await settings({ sound: 1 });
  assert.equal(sound.audios[0].paused, false);
});

test('home’s song waits for a tap where the browser asks for one', async () => {
  withSound();
  sound.tapNeeded = true;
  await mount(h(Soundtrack));
  assert.equal(sound.audios[0].paused, true);
  sound.tapNeeded = false;
  await fire(document.body, 'keydown');
  assert.equal(sound.audios[0].paused, false);
});

test('home’s song pauses while the page is hidden', async () => {
  withSound();
  await mount(h(Soundtrack));
  document.hidden = true;
  await fire(document, 'visibilitychange');
  await tick(460);
  assert.equal(sound.audios[0].paused, true);
  document.hidden = false;
  await fire(document, 'visibilitychange');
  assert.equal(sound.audios[0].paused, false);
});

test('leaving the page stops home’s song and lets its file go', async () => {
  withSound();
  const v = await mount(h(Soundtrack));
  const el = sound.audios[0], c = sound.contexts[0];
  await v.unmount();
  assert.equal(el.paused, true);
  assert.equal(el.getAttribute('src'), null);
  assert.equal(c.closed, true);
});
