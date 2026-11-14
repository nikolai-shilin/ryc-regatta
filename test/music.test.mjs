// The soundtrack's director (public/game/music.js): what the music does at each moment of a race. Pure, so it runs in Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { direct, MUSIC_STYLES, piece: pieceFor } = await import('../public/game/music.js');

const racing = { clock: 120, done: false, place: 3, fleet: 5, dsq: false, ocs: false, pen: false, zone: false, near: 200, toMark: 300, markLeg: true, lastLeg: false, downwind: false, trend: 0 };
const at = (o) => direct({ ...racing, ...o });

test('four recorded tracks to pick from, Racing first', () => {
  assert.deepEqual(MUSIC_STYLES, ['racing', 'groove', 'riff', 'openwater']);
});

// what music.js says of each track's pieces: { name: [start, [bar lengths]] or [start, length] }
const tracks = () => {
  const src = readFileSync(new URL('../public/game/music.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('const TRACKS = '), src.indexOf('};\nconst ONE_SHOT')) + '}';
  return Function(`return (${body.replace('const TRACKS = ', '')})`)();
};

test('every track has its file and every piece the player asks for', () => {
  const T = tracks();
  assert.deepEqual(Object.keys(T), MUSIC_STYLES);
  for (const [id, t] of Object.entries(T)) {
    readFileSync(new URL(`../public/game/music-${id}.mp3`, import.meta.url));
    for (const n of ['calm', 'drive', 'dark', 'race', 'peak', 'build', 'finale']) assert.ok(t[n][1].length >= 4 && t[n][1].every((l) => l > 1 && l < 3), `${id} ${n}`);
    assert.ok(t.build[1].length > 4, `${id}: bars before the drop`);
    for (const n of ['crash', 'swell', 'hit']) assert.ok(t[n][1] > 0, `${id} ${n}`);
    // the pieces follow one another in the file, none overlapping the next
    const ps = Object.values(t).map(([at, l]) => [at, Array.isArray(l) ? l.reduce((a, b) => a + b, 0) : l]).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < ps.length; i++) assert.ok(ps[i][0] >= ps[i - 1][0] + ps[i - 1][1], `${id}: piece ${i}`);
  }
});

// Each track plays pieces of itself: the quiet part before the start, the groove, the drop when it goes well, its
// loudest part when it's close, the breakdown when it goes wrong
test('a track plays the piece of it that fits the moment', () => {
  const piece = (o) => { const d = at(o); return pieceFor(d.mood, d.int); };
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
