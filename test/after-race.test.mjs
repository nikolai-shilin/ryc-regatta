// After a race and on the race screen (release 8d of the 1-on-1 plan: release 7's last leftovers): For you on your own
// race's result page, two at most (components/result-view.tsx, components/for-you.tsx max); and the 1-on-1 race screen's
// waiting room and end card linking to 1-on-1 races explained (public/game/match-ui.js), in a tab of its own, in every
// language the game speaks. Run: node --test test/after-race.test.mjs
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './load.mjs';
import { done, h, json, mount, reset, serve, signIn } from './fake-dom.mjs';

const { ForYou } = await import('../components/for-you.tsx');
const { MATCH_STRINGS } = await import('../public/game/match-ui.js');
const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
beforeEach(() => reset({ url: 'https://updown.test/race/result/abc', at: Date.parse('2026-11-21T18:30:00Z') }));
afterEach(done);

test('For you after your own race: on the result card, two at most; not on a result shared with you', async () => {
  const view = src('components/result-view.tsx');
  assert.match(view, /\{!shared && <ForYou lang=\{lang\} max=\{2\} \/>\}/);
  document.documentElement.setAttribute('data-back', ''); signIn();
  serve([['/connect/rating/me', json({ rating: 1580, races: 9, wins: 5, losses: 4, best: 1600, lowest: 1500, place: 3, of: 10, changes: [], recent: [] })],
    ['/connect/seek', (u, init) => json(JSON.parse(init.body).do === 'ready_now' ? { list: [{ handle: '3f9a0c1d2e4b', name: 'Cara M.', rating: 1540, races: 12, waited: 20, away: false }] } : { hour: { day: '2026-11-21', in: 9, near: 2, me: false, reach: true } })],
    ['/connect/achievements', json({ got: [], progress: {} })], ['/connect/suggest', json({ weights: {}, out: [], stale: [] })]]);
  const three = await mount(h(ForYou, { lang: 'en' }));
  assert.equal(three.$$('.fy-c').length, 3);
  await three.unmount();
  const two = await mount(h(ForYou, { lang: 'en', max: 2 }));
  assert.equal(two.$$('.fy-c').length, 2);
  await two.unmount();
});

test('the race screen links to 1-on-1 races explained, before the gun and after the finish, in a tab of its own', () => {
  const ui = src('public/game/match-ui.js');
  assert.match(ui, /<a class="m-help" href="\/help\/duel" target="_blank" rel="noopener"><\/a>/);
  assert.match(ui, /<a class="m-help" href="\/help\/duel#h-rating" target="_blank" rel="noopener"><\/a>/);
  assert.match(ui, /for \(const a of wrap\.querySelectorAll\('\.m-help'\)\) a\.textContent = `\$\{L\.help \|\| MATCH_STRINGS\.en\.help\} ›`;/);
  assert.equal(MATCH_STRINGS.en.help, 'How 1-on-1 races work');
  assert.equal(MATCH_STRINGS.ru.help, 'Как устроены гонки 1 на 1');
  for (const l of ['es', 'de', 'tr', 'fr', 'it', 'pt']) assert.match(src(`public/game/strings-${l}.js`), /chatK: '[^']*', help: '[^']{8,}',/, l);
});
