// Today's race on a page left open past midnight (UTC): the next race is the new day's, in the new day's yacht at its
// venue, so the page is loaded again for them. The race built for the restart already carries the new day's date and
// wind, and on 20 Nov 2026 a page opened on the AC75's day raced the Dragon's day in the AC75 and was ranked first:
// the page's own yacht and venue are what is asked. One page, in order.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootGame, clock } from './fake-game.mjs';

const game = await bootGame({ search: '?race=today&debug&nofirst', loader: false, storage: { regatta: { played: 7, mode: 'daily' } } });
const { dailyRace } = await import('../public/game/sim.js'); // (after the page: sim.js reads its land)
const { $ } = game, rg = () => game.rg;
const restart = () => { game.key('KeyP'); $('#pRestart').click(); $('#cGo').click(); };

test('on the same day a restart is today’s race again, on this page', () => {
  assert.equal(game.error, null);
  assert.equal(rg().race.settings.daily, '2026-11-18');
  const before = rg().race;
  restart();
  assert.notEqual(rg().race, before);
  assert.deepEqual(location.assigned, []);
});

test('past midnight the page is loaded again for the new day’s yacht and venue, and no race is sailed in the old', () => {
  const d18 = dailyRace(new Date('2026-11-18T12:00Z')), d19 = dailyRace(new Date('2026-11-19T06:00Z'));
  assert.notEqual(d18.yacht, d19.yacht, 'the days have yachts of their own');
  clock.set('2026-11-19T06:00:00Z');
  restart();
  assert.deepEqual(location.assigned, ['/play?race=today']);
});
