// The soundtrack's director (public/game/music.js): what the music does at each moment of a race. Pure, so it runs in Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { direct, MUSIC_STYLES, racingPiece } = await import('../public/game/music.js');

const racing = { clock: 120, done: false, place: 3, fleet: 5, dsq: false, ocs: false, pen: false, zone: false, near: 200, toMark: 300, markLeg: true, lastLeg: false, downwind: false, trend: 0 };
const at = (o) => direct({ ...racing, ...o });

test('four styles to pick from: three synthesized, and the recorded Racing', () => {
  assert.deepEqual(MUSIC_STYLES, ['ambient', 'film', 'folk', 'racing']);
});

// Racing plays pieces of one track: the quiet verse before the start, the groove, the drop when it goes well, its
// loudest part when it's close, the breakdown when it goes wrong
test('Racing plays the piece of its track that fits the moment', () => {
  const piece = (o) => { const d = at(o); return racingPiece(d.mood, d.int); };
  assert.equal(piece({ clock: -200 }), 'calm');
  assert.equal(piece({ clock: -50 }), 'drive');
  assert.equal(piece({ clock: -5 }), 'peak');
  assert.equal(piece({}), 'drive');
  assert.equal(piece({ downwind: true }), 'race');
  assert.equal(piece({ zone: true }), 'peak');
  assert.equal(piece({ ocs: true }), 'dark');
  assert.equal(piece({ done: true, place: 5 }), 'dark');
  assert.equal(piece({ done: true, place: 1 }), 'calm'); // after the ending, which the win's sting plays
});

test('the pre-start builds: calm, then tense in the last minute, then all in for the last ten seconds', () => {
  const far = at({ clock: -200 }), min = at({ clock: -50 }), ten = at({ clock: -5 });
  assert.equal(far.mood, 'calm');
  assert.equal(min.mood, 'tense');
  assert.equal(ten.mood, 'tense');
  assert.ok(far.int < min.int && min.int < ten.int);
  assert.ok(far.ten < min.ten && min.ten < ten.ten);
  assert.equal(ten.ten, 1);
});

test('upwind alone is calm; downwind is brighter and busier', () => {
  const up = at({}), down = at({ downwind: true });
  assert.equal(up.mood, 'calm');
  assert.equal(down.mood, 'up');
  assert.ok(down.int > up.int);
});

test('a boat close by, the mark near and the last leg each raise the stakes', () => {
  const base = at({ toMark: 500 });
  assert.ok(at({ toMark: 500, near: 20 }).int > base.int);
  assert.ok(at({ toMark: 500, near: 20 }).ten > base.ten);
  assert.ok(at({ toMark: 60 }).int > base.int);
  assert.ok(at({ toMark: 500, lastLeg: true }).ten > base.ten);
});

test('a fight for mark-room is the tensest moment of a leg', () => {
  const z = at({ zone: true });
  assert.equal(z.mood, 'tense');
  assert.ok(z.int >= 0.85 && z.ten >= 0.9);
});

test('a place gained is bright, a place lost is dark', () => {
  assert.equal(at({ trend: 1 }).mood, 'up');
  assert.equal(at({ trend: -1 }).mood, 'dark');
});

test('a penalty, or being over at the start, turns it dark', () => {
  assert.equal(at({ pen: true }).mood, 'dark');
  assert.equal(at({ ocs: true }).mood, 'dark');
});

test('leading the last leg with clear water is a run home', () => {
  assert.equal(at({ lastLeg: true, place: 1, near: 150, toMark: 400 }).mood, 'up');
});

test('the finish: first wins, the top third is glad, the rest and a disqualification are sad', () => {
  assert.equal(at({ done: true, place: 1 }).mood, 'win');
  assert.equal(at({ done: true, place: 2 }).mood, 'up');
  assert.equal(at({ done: true, place: 5 }).mood, 'lose');
  assert.equal(at({ done: true, place: null, dsq: true }).mood, 'lose');
});

test('every answer is in range', () => {
  for (const o of [{}, { clock: -300 }, { clock: -1 }, { zone: true, near: 5, lastLeg: true, toMark: 10 }, { done: true, place: 1 }]) {
    const d = at(o);
    assert.ok(d.int >= 0 && d.int <= 1 && d.ten >= 0 && d.ten <= 1, JSON.stringify(d));
    assert.ok(['calm', 'tense', 'up', 'dark', 'win', 'lose'].includes(d.mood));
  }
});
