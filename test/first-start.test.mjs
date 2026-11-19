// A newcomer's first start (the first three races on a device, main.js): her boat lined up so that, held as she goes,
// she reaches the line about as the gun goes (sim.js lineUp), on the next days' races. npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const realFetch = globalThis.fetch;
globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u)))); // land.js's bay files, from the disk
const sim = await import('../public/game/sim.js');

// ---------- the boat lined up ----------
// the race of each of the days from `from`, its boat sailed as she starts, never steered, to the line
async function sailStraight(days, line) {
  const was = globalThis.fetch;
  globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u)))); // land.js's bay files, from the disk
  const out = [];
  try {
    for (let d = 0; d < days; d++) {
      const s = sim.dailyRace(new Date(Date.UTC(2026, 10, 19) + d * 864e5));
      const r = new sim.Race({ ...s, autoTrim: true, current: !!s.current });
      const P = r.player, moved = line ? r.lineUp(P) : false;
      let recalled = false; const g = r.generalRecall.bind(r); r.generalRecall = () => { recalled = true; return g(); };
      let at = null;
      for (let i = 0; i < 60 * 120 && at == null && !recalled && r.clock < 0; i++) { P.rudder = 0; r.step(1 / 60); if (r.lineInfo(P).d > 0) at = r.clock; }
      if (!recalled) out.push({ moved, early: at != null && at < 0 ? -at : 0 });
    }
  } finally { globalThis.fetch = was; }
  return out;
}

test('a boat lined up reaches the line about as the gun goes, where left alone she was over it long before', async () => {
  const before = await sailStraight(12, false), after = await sailStraight(12, true);
  assert.ok(before.filter((x) => x.early > 10).length >= before.length * 0.8, 'as she starts, she is over early, most days by far');
  assert.ok(after.every((x) => x.moved), 'every day had room to line her up');
  assert.ok(after.filter((x) => x.early > 0).length <= after.length * 0.25, 'lined up, she is seldom over before the gun');
  assert.ok(after.every((x) => x.early < 8), 'and then by a few seconds at most');
});

test('lined up, she is still on her course, further down it, and the line knows where she is', async () => {
  globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u))));
  try {
    const s = sim.dailyRace(new Date(Date.UTC(2026, 10, 19)));
    const r = new sim.Race({ ...s, autoTrim: true }), P = r.player, h0 = P.h, d0 = r.lineInfo(P).d;
    assert.equal(r.lineUp(P), true);
    assert.equal(P.h, h0, 'the same heading');
    assert.ok(r.lineInfo(P).d < d0, 'further back from the line');
    const c = r.course, mx = (c.pin.x + c.committee.x) / 2, mz = (c.pin.z + c.committee.z) / 2, far = Math.hypot(mx - P.x, mz - P.z);
    assert.ok(Math.abs((mx - P.x) / far - Math.sin(P.h)) < 1e-9 && Math.abs((mz - P.z) / far + Math.cos(P.h)) < 1e-9, 'heading for the middle of it');
    assert.equal(P.lastD, r.lineInfo(P).d, 'the line crossing is judged from here');
  } finally { globalThis.fetch = realFetch; }
});

test('no boat is lined up where the way to the line is too long', () => {
  const r = { clock: -300, course: { pin: { x: -50, z: 0 }, committee: { x: 50, z: 0 } }, wind: { p: { tws: 12 } }, roomAt: () => 1e3 };
  const b = { x: 25, z: 60, h: -0.7 };
  assert.equal(sim.Race.prototype.lineUp.call(r, b), false, `a five-minute start: over ${sim.LINE_UP_MAX} m`);
  assert.deepEqual(b, { x: 25, z: 60, h: -0.7 }, 'and she stays where she was');
  r.clock = -64; r.roomAt = (x, z) => (z > 100 ? -5 : 1e3);
  assert.equal(sim.Race.prototype.lineUp.call(r, b), false, 'nor across the land');
});

