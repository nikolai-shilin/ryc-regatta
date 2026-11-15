// A race one browser runs and others follow, over the wire (a match's Host and Guest; the club race's referee and
// members): a boat's controls as her sailor's game sends them, and a snapshot of the race as the runner sends it.
// No sim.js import: plain numbers and the Boat's own methods.

const q = (v, k) => (Number.isFinite(v) ? Math.round(v * k) / k : 0);
const wrap = (a) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v, d) => (Number.isFinite(v) ? v : d);

// ---------- controls: what her hands do ----------
// { r rudder, s sheet, j jib sheet, at auto-trim, sp split, k kite wanted, kt kite type, rf reef wanted, sj small jib
// wanted, tk tack count, hl hail count }. The game bumps b.tackN and b.hailN as the buttons are pressed. Wanted is what
// she has or is doing (a hoist under way is a kite wanted). While she tacks the rudder is the tack's, not hers: 0.
export function controlsOf(b) {
  return {
    r: b.auto ? 0 : q(b.rudder, 100), s: q(b.sheet, 1000), j: q(b.jibSheet, 1000), at: !!b.autoTrim, sp: !!b.split,
    k: b.kiteJob ? !!b.kiteJob.up : !!b.kite, kt: b.kiteType === 'zero' ? 'zero' : 'gen',
    rf: b.reefJob ? !!b.reefJob.on : !!b.reef, sj: b.jibJob ? !!b.jibJob.small : !!b.smallJib,
    tk: b.tackN || 0, hl: b.hailN || 0,
  };
}

// The runner's copy of boat b does what the controls say: the helm (unless she is tacking) and the sheets (the main
// unless auto-trim works it); a tack or a hail for each press not yet seen; a kite, reef or jib that differs from what
// she has or is doing, changed. And she sailed with auto-trim, for the result.
export function applyControls(race, b, c) {
  if (!c || typeof c !== 'object') return;
  if (!b.auto) b.rudder = clamp(num(c.r, 0), -1, 1);
  b.autoTrim = !!c.at; b.split = !!c.sp;
  if (!c.at) b.sheet = clamp(num(c.s, b.sheet), 0, 1);
  b.jibSheet = clamp(num(c.j, b.jibSheet), 0, 1);
  if (num(c.tk, 0) > (b.tackSeen || 0)) { b.tackSeen = c.tk; b.tackOrGybe(); }
  const kite = b.kiteJob ? b.kiteJob.up : b.kite, reef = b.reefJob ? b.reefJob.on : b.reef, jib = b.jibJob ? b.jibJob.small : b.smallJib;
  if (!!c.k !== !!kite) b.setKite(!!c.k, c.kt === 'zero' ? 'zero' : 'gen');
  if (!!c.rf !== !!reef) b.setReef(!!c.rf);
  if (!!c.sj !== !!jib) b.setJib(!!c.sj);
  if (num(c.hl, 0) > (b.hailSeen || 0)) { b.hailSeen = c.hl; race.hail(b); }
  b.usedAuto ||= !!c.at && !b.ai;
}

// ---------- the snapshot: what the other screens draw ----------
// snap { c: clock, f: flags (bits cls, P, X, sub), w: the winner's id or null, b: one row per boat, in race.boats
// order (both screens build the same race) }. A row is an array: first NUM's numbers in that order (her pose, sails
// and wind: what world.js and the HUD read of a boat), then
//   [n]     bits: kite, code zero, reef, small jib, split, auto-trim, foiling, backing
//   [n+1]   trim: TRIMS index
//   [n+2]   auto (tacking): 0 no, 1 a tack, 2 a gybe
//   [n+3]   kite job: 0 none, 1 hoisting, 2 dropping; [n+4] reef job: 0, 1 tying in, 2 shaking out; [n+5] jib job:
//           0, 1 to the small one, 2 back
//   [n+6]   boom (−1, 0, 1)
// then her race (STATE, the runner's word even for the follower's own boat):
//   [n+7]   leg; [n+8] penalties owed (read as 0–9: no more is ever owed); [n+9] finish clock or null; [n+10]
//           place or null; [n+11] side: 'blue', 'yellow' or null
//   [n+12]  bits: ocs, done, dsq, entered, pen (a penalty turn under way)
//   [n+13]  tacks seen, [n+14] hails seen (a reloaded follower's counts go on from these)
// and the jobs' clocks (0 with no job): [n+15] kite job t, [n+16] its total, [n+17] a messy drop (0/1); [n+18],
// [n+19] the reef job's t and total; [n+20], [n+21] the jib job's
const NUM = [['x', 100], ['z', 100], ['h', 1e4], ['v', 100], ['heel', 10], ['yawRate', 1e3], ['rudder', 100], ['sheet', 1e3],
  ['jibSheet', 1e3], ['sail', 10], ['jibSail', 10], ['kiteFill', 100], ['kiteCollapse', 100], ['twa', 1e3], ['awa', 1e3],
  ['aws', 10], ['tws', 10], ['wdir', 1e3], ['gust', 100], ['shadow', 100], ['luff', 100], ['reefFill', 100],
  ['jibSize', 100], ['ride', 100], ['slope', 1e3], ['byLee', 10]];
const ANGLES = new Set(['h', 'twa', 'awa', 'wdir']);
const N = NUM.length;
const TRIMS = ['ok', 'in', 'out', 'irons'];
const FLAGS = ['cls', 'P', 'X', 'sub'];
const bits = (list) => list.reduce((a, v, i) => a | (v ? 1 << i : 0), 0);
const bit = (x, i) => !!(x & (1 << i));
const job = (j, key) => (j ? (j[key] ? 1 : 2) : 0);

function rowOf(b) {
  return [
    ...NUM.map(([k, p]) => q(b[k], p)),
    bits([b.kite, b.kiteType === 'zero', b.reef, b.smallJib, b.split, b.autoTrim, b.fly, b.backing]),
    Math.max(0, TRIMS.indexOf(b.trim)),
    b.auto ? (b.auto.gybe ? 2 : 1) : 0,
    job(b.kiteJob, 'up'), job(b.reefJob, 'on'), job(b.jibJob, 'small'),
    b.boom || 0,
    b.leg || 0, b.owed || 0, b.finish ?? null, b.place ?? null, b.side ?? null,
    bits([b.ocs, b.done, b.dsq, b.entered, b.pen]),
    b.tackSeen || 0, b.hailSeen || 0,
    q(b.kiteJob?.t, 100), q(b.kiteJob?.total, 100), b.kiteJob?.messy ? 1 : 0,
    q(b.reefJob?.t, 100), q(b.reefJob?.total, 100), q(b.jibJob?.t, 100), q(b.jibJob?.total, 100),
  ];
}

export function encodeSnap(race) {
  return { c: q(race.clock, 1000), f: bits(FLAGS.map((k) => race.flags[k])), w: race.winner?.id ?? null, b: race.boats.map(rowOf) };
}

// a row as a plain object of the Boat's own fields (for the follower's easing and interpolation)
export function readBoat(row) {
  const o = {};
  NUM.forEach(([k], i) => { o[k] = num(row[i], 0); });
  const f = row[N], s = row[N + 12];
  Object.assign(o, {
    kite: bit(f, 0), kiteType: bit(f, 1) ? 'zero' : 'gen', reef: bit(f, 2), smallJib: bit(f, 3), split: bit(f, 4), autoTrim: bit(f, 5), fly: bit(f, 6), backing: bit(f, 7),
    trim: TRIMS[row[N + 1]] ?? 'ok', autoK: row[N + 2], kiteK: row[N + 3], reefK: row[N + 4], jibK: row[N + 5], boom: row[N + 6],
    leg: row[N + 7], owed: clamp(Math.floor(num(row[N + 8], 0)), 0, 9), finish: row[N + 9], place: row[N + 10], side: row[N + 11],
    ocs: bit(s, 0), done: bit(s, 1), dsq: bit(s, 2), entered: bit(s, 3), penOn: bit(s, 4), tackSeen: row[N + 13], hailSeen: row[N + 14],
    kiteT: [num(row[N + 15], 1), num(row[N + 16], 1)], kiteMessy: !!row[N + 17], reefT: [num(row[N + 18], 1), num(row[N + 19], 1)], jibT: [num(row[N + 20], 1), num(row[N + 21], 1)],
  });
  return o;
}

// between two read rows, f of the way from a to b: the numbers eased (the angles the short way round), the rest a's
export function lerpBoat(a, b, f) {
  const o = { ...a };
  for (const [k] of NUM) o[k] = ANGLES.has(k) ? wrap(a[k] + wrap(b[k] - a[k]) * f) : a[k] + (b[k] - a[k]) * f;
  return o;
}

// the sails she has and is changing, and her sheets, from a read row (a follower's own boat takes these once, from
// the first snapshot after her page opens; the other boats with every one)
export function setSails(b, o) {
  Object.assign(b, { kite: o.kite, kiteType: o.kiteType, reef: o.reef, smallJib: o.smallJib, split: o.split, autoTrim: o.autoTrim, sheet: o.sheet, jibSheet: o.jibSheet });
  const t = ([t, total]) => ({ t: Math.max(t, 0), total: Math.max(total, 1e-3) });
  b.kiteJob = o.kiteK ? { ...t(o.kiteT), messy: o.kiteMessy, up: o.kiteK === 1 } : null;
  b.reefJob = o.reefK ? { ...t(o.reefT), on: o.reefK === 1 } : null;
  b.jibJob = o.jibK ? { ...t(o.jibT), small: o.jibK === 1 } : null;
}

// put a read row on boat b: her race always; her pose, sails and jobs too unless `pose` is false (a follower's own
// boat, which her own screen steps)
export function setBoat(b, o, pose = true) {
  Object.assign(b, { leg: o.leg, owed: o.owed, finish: o.finish, place: o.place, ocs: o.ocs, done: o.done, dsq: o.dsq, entered: o.entered, tackSeen: o.tackSeen, hailSeen: o.hailSeen });
  if (o.side) b.side = o.side;
  b.pen = o.penOn ? b.pen || { mr: true } : null;
  if (!pose) return;
  for (const [k] of NUM) b[k] = o[k];
  setSails(b, o);
  Object.assign(b, { fly: o.fly, backing: o.backing, trim: o.trim, boom: o.boom });
  b.auto = o.autoK ? { ...(b.auto || { to: b.h, dir: 1 }), gybe: o.autoK === 2 } : null;
}

// the snapshot on the follower's race: the flags, the winner, and every boat (skip: her own, whose pose is her own
// screen's). The clock is the follower's to keep (see the match's Guest). False if it isn't this race's.
export function applySnap(race, s, skip = null) {
  if (!s || !Array.isArray(s.b) || s.b.length !== race.boats.length) return false;
  FLAGS.forEach((k, i) => { race.flags[k] = bit(s.f, i); });
  if (s.w) race.winner = race.humans.find((h) => h.id === s.w) ?? race.winner;
  race.boats.forEach((b, i) => { if (Array.isArray(s.b[i])) setBoat(b, readBoat(s.b[i]), b !== skip); });
  return true;
}
