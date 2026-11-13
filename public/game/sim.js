// Regatta: the wind, the waves, the boats, the rules and the race — no drawing here (world.js draws, main.js joins).
// Units: metres, seconds, radians. Compass headings: 0 = north, clockwise. World x = east, world z = south.
// The wind "from" W is a compass direction. A boat's true wind angle TWA = wrap(W − heading): positive = wind over
// the starboard side (starboard tack). AWA is the same for the apparent wind, the wind the sails feel.

import { placeCourse, roomAt } from './land.js';

export const KN = 0.514444; // m/s per knot
export const D2R = Math.PI / 180;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const wrap = (a) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
export const sgn = (v) => (v < 0 ? -1 : 1);
const table = (t, x) => {
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (x <= t[i][0]) return lerp(t[i - 1][1], t[i][1], (x - t[i - 1][0]) / (t[i][0] - t[i - 1][0]));
  return t[t.length - 1][1];
};
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// ---------- waves: a sum of sines, shared by the boats (speed, surfing) and the picture ----------
// eight wave trains spread about the wind: the long ones move the boats and the water surface, the short ones only
// shade it. Q is the Gerstner steepness (the picture sharpens the crests with it; heights here are plain sines).
export function makeWaves(amp, windFrom) {
  const b = windFrom + Math.PI; // they run downwind
  const parts = [[0, 46, 0.36], [0.35, 31, 0.24], [-0.45, 22, 0.17], [0.8, 14, 0.1], [-0.9, 10, 0.07], [0.2, 7, 0.045], [-0.3, 5, 0.03], [1.2, 3.5, 0.02]];
  const steep = clamp(0.25 + amp * 0.5, 0.25, 0.75);
  return parts.map(([off, len, f], i) => {
    const a = b + off, k = (2 * Math.PI) / len, A = amp * f;
    return { dx: Math.sin(a), dz: -Math.cos(a), k, A, w: Math.sqrt(9.81 * k), ph: i * 1.7, Q: A > 0 ? Math.min(1, steep / (k * A * parts.length)) : 0 };
  });
}
export function waveHeight(W, x, z, t) {
  let h = 0;
  for (const p of W) h += p.A * Math.sin(p.k * (p.dx * x + p.dz * z) - p.w * t + p.ph);
  return h;
}
// the slope of the sea along a direction (ux, uz): + uphill; `n` only the first n trains (the long swell)
export function waveSlope(W, x, z, t, ux, uz, n = W.length) {
  let s = 0;
  for (let i = 0; i < n; i++) { const p = W[i]; s += p.A * p.k * (p.dx * ux + p.dz * uz) * Math.cos(p.k * (p.dx * x + p.dz * z) - p.w * t + p.ph); }
  return s;
}

// ---------- the boat's speed: a Beneteau First 40.7, knots by true wind speed and angle ----------
// From the class polar (median of 193 official ORC measurements, windregatta.com): jib 52–90°, spinnaker 110–150°.
// Not in the table, estimated: the close-hauled angle and speed (88% of the 52° speed, as on the class's ORC
// targets), and 165° / 180° as a share of the 150° speed — lower in light air, where running deep is slow.
// Downwind figures are with the spinnaker; without it the boat is slower off the wind.
export const NO_GO = 28;
export const HULL = 12.2; // length overall, metres
const GROUND = HULL / 2 + 2; // how near the shore her middle can come: the bow just short of the rocks
const P_TWS = [4, 6, 8, 10, 12, 14, 16, 20, 24];
const P_BEAT = [46, 44, 42, 40.5, 39.5, 39, 38.5, 38.5, 39];
const P_TWA = [52, 60, 75, 90, 110, 120, 135, 150, 165, 180];
const POLAR_4070 = { // TWA → speeds for each TWS above
  52: [4.17, 5.69, 6.69, 7.24, 7.49, 7.61, 7.68, 7.77, 7.79],
  60: [4.5, 5.99, 6.92, 7.42, 7.68, 7.81, 7.89, 8.0, 8.03],
  75: [4.72, 6.19, 7.08, 7.56, 7.85, 8.05, 8.19, 8.38, 8.48],
  90: [4.6, 6.08, 7.06, 7.6, 7.92, 8.19, 8.41, 8.76, 8.99],
  110: [4.24, 5.87, 7.05, 7.69, 8.11, 8.47, 8.74, 9.17, 9.45],
  120: [4.07, 5.69, 6.89, 7.6, 8.06, 8.48, 8.87, 9.57, 10.14],
  135: [3.55, 5.09, 6.31, 7.2, 7.75, 8.18, 8.62, 9.59, 10.95],
  150: [2.93, 4.27, 5.44, 6.45, 7.23, 7.74, 8.14, 8.97, 9.99],
};
const P_BEATV = POLAR_4070[52].map((v) => +(v * 0.88).toFixed(2));
const P_V = P_TWS.map((tws, i) => {
  const k = clamp((tws - 6) / 12, 0, 1), v150 = POLAR_4070[150][i];
  return [...[52, 60, 75, 90, 110, 120, 135, 150].map((a) => POLAR_4070[a][i]), v150 * lerp(0.86, 0.96, k), v150 * lerp(0.76, 0.9, k)];
});
function rowSpeed(i, a) {
  if (a <= NO_GO) return 0;
  if (a < P_BEAT[i]) return P_BEATV[i] * ((a - NO_GO) / (P_BEAT[i] - NO_GO)) ** 1.6; // pinching: slow
  const pts = [[P_BEAT[i], P_BEATV[i]], ...P_TWA.map((x, j) => [x, P_V[i][j]])];
  return table(pts, a);
}
// target speed in knots
export function polarSpeed(tws, aDeg, kite = true) {
  const a = Math.abs(aDeg);
  let v;
  if (tws <= P_TWS[0]) v = rowSpeed(0, a) * (tws / P_TWS[0]) ** 0.85;
  else {
    let i = 0; while (i < P_TWS.length - 2 && tws > P_TWS[i + 1]) i++;
    const f = clamp((tws - P_TWS[i]) / (P_TWS[i + 1] - P_TWS[i]), 0, 1.2);
    v = lerp(rowSpeed(i, a), rowSpeed(i + 1, a), f);
  }
  if (!kite) v *= lerp(1, 0.8, clamp((a - 100) / 50, 0, 1));
  return v;
}
export const beatAngle = (tws) => table(P_TWS.map((x, i) => [x, P_BEAT[i]]), tws);
// the true wind angle that makes the best way downwind
export function runAngle(tws, kite = true) {
  let best = 150, bv = 0;
  for (let a = 120; a <= 180; a += 2) { const v = polarSpeed(tws, a, kite) * -Math.cos(a * D2R); if (v > bv) { bv = v; best = a; } }
  return best;
}

// sails: the best angle off the centreline for an apparent wind angle (degrees)
const SHEET_IN = 8, SHEET_OUT = 85;
const FOOT = 8, PINCH = 0.06; // slow upwind: up to 8° to foot, 4% a degree for pointing above it
export const idealSail = (awa) => clamp(awa * 0.45 - 2, SHEET_IN, SHEET_OUT);
export const sheetFor = (angle) => clamp((angle - SHEET_IN) / (SHEET_OUT - SHEET_IN), 0, 1);
const HEEL_SIDE = [[0, 0.3], [18, 0.3], [22, 1], [50, 1], [100, 0.5], [180, 0.12]];
// heel with the sails full; above about 24° a good crew eases (depowers) to keep her on her feet
export const fullHeel = (aws, awa, kite) => 24 * (aws / 16) ** 1.4 * table(HEEL_SIDE, awa) + (kite ? 8 * (aws / 16) ** 1.4 : 0);
export const depowerFor = (full) => (full > 24 ? 28 * (1 - 24 / full) : 0);

// ---------- wind ----------
// a smooth random wander in −1…1: a new value every `step` seconds from the generator, eased from one to the next
function wander(n, t, step) {
  const i = Math.max(0, Math.floor(t / step)), f = clamp(t / step - i, 0, 1), s = f * f * (3 - 2 * f);
  while (n.k.length <= i + 1) n.k.push(n.r() * 2 - 1);
  return lerp(n.k[i], n.k[i + 1], s);
}
export const PRESETS = {
  light:  { tws: 7,  osc: 12, period: 110, gusts: 7,  gustStr: 0.35, veer: 8,  waves: 0.18 },
  medium: { tws: 12, osc: 13, period: 90,  gusts: 9,  gustStr: 0.33, veer: 10, waves: 0.45 },
  strong: { tws: 19, osc: 14, period: 75,  gusts: 11, gustStr: 0.36, veer: 12, waves: 0.85 },
};

// a sea breeze: on a sunny day with a light gradient the land heats up and draws the wind in off the sea. It fills
// in during the race, building by a third and swinging steadily to the right (veering) by some 15° over twelve
// minutes, so the right side pays more and more. Not in a strong wind (the gradient wind rules). From its own
// generator, so the gusts and shifts of a seed stay as they were.
export function seaBreeze(seed, preset) {
  const r = rng(seed * 13 + 3); r(); r();
  return preset !== 'strong' && r() < 0.45;
}
const SEA_T = 720, SEA_VEER = 15 * D2R;

export class Wind {
  constructor(preset, seed = 1, span = 280, wide = 0) {
    this.p = PRESETS[preset] || PRESETS.medium;
    this.span = span; // how far upwind the course goes: the gusts cover it all
    this.wide = wide; // and how far out to the side (a triangle's wing mark)
    this.sea = seaBreeze(seed, preset);
    this.rand = rng(seed);
    this.t = 0;
    this.base = 0; // from the north
    this.phase = this.rand() * 6;
    this.drift = (this.rand() - 0.5) * 2 * 4 * D2R / 300; // a persistent shift, up to 4° in five minutes
    this.side = (this.rand() - 0.5) * 2; // which side of the course has more pressure (and a shift with it)
    if (this.sea) this.drift = 0; // the sea breeze is the persistent shift that day
    // irregular shifts on top of the swing — a wander to a new value every 40 s or so and a slower one every 150 s —
    // so the next shift can't be timed from the last; from their own generators, so the gusts stay where they were
    this.noise = [rng(seed * 31 + 5), rng(seed * 17 + 11)].map((r) => ({ r, k: [] }));
    this.gusts = [];
    const n = Math.round(this.p.gusts * Math.max(1, (span + 620) / 900) * Math.max(1, (span * 0.5 + 500) / 640));
    for (let i = 0; i < n; i++) this.gusts.push(this.newGust(true));
  }
  newGust(anywhere) {
    const r = this.rand;
    return {
      x: (r() - 0.5) * (Math.max(700, this.span + 500) + 2 * this.wide), z: anywhere ? -(this.span + 420) + r() * (this.span + 620) : -(this.span + 420) - r() * 200,
      r: 45 + r() * 60, s: this.p.gustStr * (0.55 + r() * 0.45),
      veer: (r() - 0.5) * 2 * this.p.veer * D2R, // a gust can lift or head you
      life: 0,
    };
  }
  // a gust lives a while (from its own size, so no extra draw on the generator), spreading as it comes down the
  // course, filling in and then dying away
  ageGust(g, dt) {
    g.r0 = g.r0 || g.r; g.max = g.max || 100 + ((g.r0 * 7.31) % 1) * 140;
    g.life += dt;
    g.r = g.r0 * (0.75 + 0.45 * Math.min(1, g.life / 90));
    g.k = Math.min(1, g.life / 6) * clamp((g.max - g.life) / 15, 0, 1);
  }
  // the middle the wind swings about: it moves only with the slow persistent drift
  mean() { return this.base + this.drift * this.t + (this.sea ? SEA_VEER * this.seaK() : 0); }
  seaK() { const f = clamp(this.t / SEA_T, 0, 1); return f * (2 - f); } // how far the sea breeze has come in, 0 … 1: quickest at first
  build() { return this.sea ? 0.85 + 0.33 * this.seaK() : 1; } // and how much it has built
  // the direction now: the middle plus the oscillations, a long swing (up to `osc` degrees either way) and a shorter one
  dir() {
    const { osc, period } = this.p, t = this.t;
    return this.mean() + D2R * osc * (0.45 * Math.sin((2 * Math.PI * t) / period + this.phase) + 0.12 * Math.sin((2 * Math.PI * t) / (period * 0.43) + 1.3 * this.phase)
      + 0.3 * wander(this.noise[0], t, 40) + 0.25 * wander(this.noise[1], t, 150));
  }
  step(dt) {
    this.t += dt;
    const d = this.dir(), sp = this.p.tws * this.build() * KN * 0.75;
    const vx = -Math.sin(d) * sp, vz = Math.cos(d) * sp; // gusts ride downwind
    for (let i = 0; i < this.gusts.length; i++) {
      const g = this.gusts[i];
      g.x += vx * dt; g.z += vz * dt; this.ageGust(g, dt);
      if (g.z > 300) this.gusts[i] = this.newGust(false);
      else if (g.life > g.max) this.gusts[i] = this.newGust(true); // died away: another fills in somewhere
    }
  }
  at(x, z) {
    let extra = 0, veer = 0;
    const d0 = this.dir(), ux = -Math.sin(d0), uz = Math.cos(d0); // downwind
    for (const g of this.gusts) {
      if (g.k === undefined) this.ageGust(g, 0);
      const dx = x - g.x, dz = z - g.z, along = dx * ux + dz * uz, lat = dx * uz - dz * ux;
      const e = Math.hypot(along / 1.35, lat); // a gust is longer down the wind than it is wide
      if (e > g.r || g.k <= 0) continue;
      const f = 1 - e / g.r, w = f * f * (3 - 2 * f) * g.k * (1 + 0.3 * clamp(along / g.r, -1, 1)); // strongest at its leading edge
      // and the wind fans out across it: on each side of a gust it bends away from the middle
      extra += g.s * w; veer += (g.veer - 6 * D2R * clamp(lat / g.r, -1, 1)) * w;
    }
    const sx = clamp(x / 160, -1, 1) * this.side; // more pressure, and a few degrees of shift, on one side
    return { dir: d0 + veer + sx * 3 * D2R, tws: this.p.tws * this.build() * (1 + extra + 0.07 * sx), gust: clamp(extra / this.p.gustStr, 0, 1) };
  }
}

// ---------- the boat ----------
export class Boat {
  constructor(o = {}) {
    this.name = o.name || 'You';
    this.x = o.x || 0; this.z = o.z || 0;
    this.h = o.h || 0; this.v = o.v || 0; // heading, speed through the water (m/s)
    this.heel = 0; this.rudder = 0; this.sheet = 0.2; this.autoTrim = !!o.autoTrim; this.kite = false;
    this.auto = null; this.yaw = 0; this.pen = null;
    this.twa = 0; this.tws = 0; this.wdir = 0; this.gust = 0; this.shadow = 0;
    this.awa = 0; this.aws = 0; this.sail = 0; this.trim = 'ok'; this.trimErr = 0; this.luff = 0; this.eff = 1; this.depower = 0;
    this.target = 0; this.polar = 0; this.surf = 0; this.events = []; this.broachT = 0; this.hit = 0; this.slope = 0;
    this.yawRate = 0; this.kiteJob = null; this.sinceTack = 99;
    this.jibSheet = this.sheet; this.split = false; this.trimSail = 'main'; // split: the jib trimmed on its own sheet
    this.kiteFill = 0; this.jibSail = 0; this.reef = false; this.reefJob = null; this.reefFill = 0; this.backing = false;
    this.kiteType = 'gen'; // the sail on the bowsprit: 'gen' the gennaker (downwind), 'zero' the code zero (a flat reacher)
    this.smallJib = false; this.jibJob = null; this.jibSize = 1; // the J3, a smaller jib for a blow; jibSize for the picture
    // the side the boom is on decides her tack (+1 starboard: boom to port). Upwind and reaching it simply follows the
    // wind; running, she can sail on a little "by the lee" (the wind on the boom's side) before it comes across
    this.boom = 0; this.byLee = 0;
    this.kiteGybe = null; // the gennaker being gybed: the crew takes the sheet round the forestay and sets it again
    this.crew = o.crew ?? 0.6; // how likely the crew is to get a hard job wrong (0 never … 1 often)
    this.aAvg = 0; this.waveN = 0; this.waveRhythm = 0; this.stall = 0; // upwind in waves, and pointing too high while slow
  }
  // a headsail change, the J1 for the J3 or back: the crew drops one jib and hoists the other — half a minute with
  // little jib up, so slow meanwhile
  setJib(small) {
    if (this.jibJob || small === this.smallJib) return false;
    this.jibJob = { small, t: 30, total: 30 };
    this.events.push('jibStart');
    return true;
  }
  // a reef in the main for a blow: tying it in takes the crew about 25 s, shaking it out about 15 s, and she sails
  // slower meanwhile. Reefed she heels far less but carries less sail — worth it from about 20 knots.
  setReef(on) {
    if (this.reefJob || on === this.reef) return false;
    const t = on ? 25 : 15;
    this.reefJob = { on, t, total: t };
    this.events.push(on ? 'reefStart' : 'shakeStart');
    return true;
  }
  // the gennaker takes time: the crew hoists it (some 15 s, longer in a breeze) or gets it down (about 10 s), and she
  // sails slower meanwhile. During a drop it still flies (and pulls) until it's in.
  setKite(up, type = this.kiteType) {
    if (!up && this.kiteJob && this.kiteJob.up) { this.kiteJob = null; return true; } // stop a hoist: it isn't up yet
    if (this.kiteJob || up === this.kite) return false;
    if (up) this.kiteType = type;
    // a code zero is furled and unfurled on its own line, quicker than a gennaker goes up and comes down
    const t = this.kiteType === 'zero' ? (up ? 9 : 5) : up ? 12 + this.tws * 0.25 : 7 + this.tws * 0.15;
    this.kiteJob = { up, t, total: t, messy: false };
    this.events.push(up ? 'kiteHoist' : 'kiteDrop');
    return true;
  }
  get tacking() { return (this.auto && !this.auto.gybe) || Math.abs(this.twa) < NO_GO * D2R; }
  tackOrGybe() {
    if (this.auto || this.pen) return;
    // already by the lee: the crew pulls the boom across, no turn needed
    if (this.boom && sgn(this.twa) !== this.boom && Math.abs(this.twa) > 120 * D2R) { this.lastGybe = true; this.events.push('gybing'); this.flipBoom(false); return; }
    const newH = this.wdir + this.twa, d = wrap(newH - this.h), gybe = Math.abs(this.twa) > 95 * D2R;
    this.auto = { to: newH, dir: sgn(d), gybe }; this.lastGybe = gybe;
    this.events.push(gybe ? 'gybing' : 'tacking');
  }
  // the boom comes across: in a gybe the crew has it in hand; in a crash gybe (sailed too far by the lee) it slams
  // over, and in a breeze she rolls hard to the new leeward side and round up — a death roll with the kite up. With
  // the gennaker up the crew gybes it too, a few seconds of it barely pulling, and in a blow it can wrap round the
  // forestay and has to come down: likelier in a gust, when she's slow, with a less sure crew, and in a crash gybe.
  flipBoom(crash) {
    const race = this._race, tws = this.tws, r = race ? race.rand() : 0.5;
    this.boom = -this.boom; this.byLee = 0;
    if (crash) {
      const kiteUp = this.kite && this.kiteType !== 'zero';
      if (tws >= 14 && kiteUp) {
        this.events.push('deathRoll'); this.broachT = 4; this.heel = 48; this.v *= 0.6;
        if (tws > 18 || r < 0.5) { this.kite = true; this.kiteJob = { up: false, t: 12, total: 12, messy: true }; }
      } else if (tws >= 11) { this.events.push('crashGybe'); this.broachT = 1.8; this.heel = Math.max(this.heel, 30); this.v *= 0.8; }
      else { this.events.push('crashGybe'); this.v *= 0.9; }
    }
    if (this.kite && !(this.kiteJob && !this.kiteJob.up)) {
      const zero = this.kiteType === 'zero', t = zero ? 9 : 4 + tws * 0.15;
      this.kiteGybe = { t, total: t };
      if (!zero) {
        const polar = polarSpeed(tws, Math.abs(this.twa) / D2R) * KN;
        const risk = clamp((tws - 16) / 45, 0, 0.2) * this.crew * (crash ? 2.5 : 1) * (this.v < 0.6 * polar ? 1.4 : 1);
        if ((race ? race.rand() : 1) < risk) { this.kiteGybe = null; this.kiteJob = { up: false, t: 14 + tws * 0.3, total: 14 + tws * 0.3, messy: true }; this.events.push('kiteWrap'); }
      }
    }
  }
  step(dt, race) {
    this._race = race;
    const w = race.windAt(this);
    this.wdir = w.dir; this.tws = w.tws; this.gust = w.gust; this.shadow = w.shadow;
    const twa = wrap(w.dir - this.h), a = Math.abs(twa) / D2R, side = sgn(twa);
    this.twa = twa;
    // apparent wind: the true wind minus the boat's own motion
    const tws = w.tws * KN, fx = Math.sin(this.h), fz = -Math.cos(this.h);
    const ax = -Math.sin(w.dir) * tws - fx * this.v, az = Math.cos(w.dir) * tws - fz * this.v;
    this.aws = Math.hypot(ax, az) / KN;
    this.awa = wrap(Math.atan2(-ax, az) - this.h);
    const awa = Math.abs(this.awa) / D2R;

    // the boom: upwind and reaching it is on the leeward side; through head to wind (a tack) it follows at once. Past
    // dead downwind it stays where it was — she is sailing by the lee — until the crew gybes it (she's turning on
    // through, or the button), or it comes across on its own: a crash gybe, sooner in a breeze and a seaway
    if (!this.boom || a < 90) this.boom = sgn(twa);
    else if (sgn(twa) !== this.boom) {
      this.byLee = 180 - a;
      const turning = Math.abs(this.yawRate) > 0.1 && sgn(twa) * this.yawRate > 0; // turning on, further by the lee, at some 6° a second: she means to gybe
      const thr = 14 - 5 * clamp((w.tws - 12) / 10, 0, 1) - 3 * race.wind.p.waves;
      if ((turning && this.byLee > 2) || (this.ai && this.byLee > 4) || (this.auto && this.auto.gybe && this.byLee > 1)) this.flipBoom(false);
      else if (this.byLee > thr) this.flipBoom(true);
    } else this.byLee = 0;
    if (this.kiteGybe && (this.kiteGybe.t -= dt) <= 0) { this.kiteGybe = null; this.events.push('kiteGybed'); }

    this.sinceTack += dt;
    if (this.kiteJob) {
      const j = this.kiteJob;
      if (j.up && a < (this.kiteType === 'zero' ? 55 : 85)) this.kiteJob = null; // she came up before it was set: the hoist is abandoned
      else if ((j.t -= dt) <= 0) { this.kite = j.up; this.kiteJob = null; this.events.push(j.up ? 'kiteUp' : 'kiteIn'); }
    }
    // too close to the wind with the kite still up: it has to come down at once, and a drop in a hurry goes wrong
    if (this.kite && a < (this.kiteType === 'zero' ? 50 : 80) && !(this.kiteJob && !this.kiteJob.up)) { this.kiteJob = { up: false, t: 9, total: 9, messy: true }; this.events.push('kitedown'); }
    if (this.jibJob && (this.jibJob.t -= dt) <= 0) { this.smallJib = this.jibJob.small; this.jibJob = null; this.events.push('jibDone'); }
    const jj = this.jibJob, js0 = (sm) => (sm ? 0.72 : 1); // the J3 is about 70% of the J1
    this.jibSize = jj ? lerp(js0(!jj.small), js0(jj.small), clamp(1 - jj.t / jj.total, 0, 1)) * (0.35 + 0.65 * Math.abs(1 - 2 * (1 - jj.t / jj.total))) : js0(this.smallJib);
    const kj = this.kiteJob, kg = this.kiteGybe; // how far up the kite is, and how collapsed while it's gybed, for the picture
    this.kiteFill = kj ? (kj.up ? 1 - kj.t / kj.total : kj.t / kj.total) : this.kite ? 1 : 0;
    this.kiteCollapse = kg ? Math.sin(Math.PI * (1 - kg.t / kg.total)) : 0;
    if (this.reefJob && (this.reefJob.t -= dt) <= 0) { this.reef = this.reefJob.on; this.reefJob = null; this.events.push(this.reef ? 'reefDone' : 'shakeDone'); }
    const rj = this.reefJob;
    this.reefFill = rj ? (rj.on ? 1 - rj.t / rj.total : rj.t / rj.total) : this.reef ? 1 : 0;

    // sails
    const gen = this.kite && this.kiteType !== 'zero', zero = this.kite && this.kiteType === 'zero';
    // a reef: a third less heel; the J3 a little less; a code zero adds some
    const full = (fullHeel(this.aws, awa, gen) + (zero ? 5 * (this.aws / 16) ** 1.4 : 0)) * (1 - 0.32 * this.reefFill) * (this.smallJib ? 0.9 : 1), ease = depowerFor(full);
    this.depower = ease;
    const ideal = idealSail(awa);
    if (this.autoTrim) this.sheet = lerp(this.sheet, sheetFor(ideal + ease), 1 - Math.exp(-dt * 3));
    if (!this.split) this.jibSheet = this.sheet; // one sheet works both sails unless the jib has its own
    const sheetAngle = lerp(SHEET_IN, SHEET_OUT, this.sheet), jibAngle = lerp(SHEET_IN, SHEET_OUT, this.jibSheet);
    const err = sheetAngle - ideal, jerr = jibAngle - ideal; // + let out too far (flapping), − pulled in too hard (stalled)
    this.trimErr = err;
    this.sail = Math.min(sheetAngle, Math.max(awa - 2, 2)); this.jibSail = Math.min(jibAngle, Math.max(awa - 2, 2));
    const stateOf = (e) => (e > ease + 7 ? 'in' : e < -7 ? 'out' : 'ok');
    const ms = stateOf(err), js = stateOf(jerr);
    this.luff = a < NO_GO ? 1 : clamp((Math.max(err, jerr) - ease - 5) / 18, 0, 1);
    this.trimSail = ms === 'ok' && js !== 'ok' ? 'jib' : 'main';
    this.trim = a < NO_GO ? 'irons' : ms !== 'ok' ? ms : js;
    // the main and the jib share the drive; the main heels her more, so easing it in a gust with the jib kept in
    // costs less speed than it saves heel. With the gennaker up the crew trims it and it does most of the driving.
    const effOf = (e) => clamp(e > 0 ? 1 - (e / 28) ** 2 : 1 - (e / 35) ** 2, e > 0 ? 0.08 : 0.25, 1);
    const powOf = (e) => (e > 0 ? clamp(1 - e / 28, 0.05, 1) : 1 + -e / 80);
    const kiteK = gen ? 0.7 : zero ? 0.35 : 0;
    const eff = lerp(0.5 * effOf(err) + 0.5 * effOf(jerr), 1, kiteK);
    this.eff = eff;
    const power = lerp(0.65 * powOf(err) + 0.35 * powOf(jerr), 1, kiteK);

    // heel
    this.heel = lerp(this.heel, full * power, 1 - Math.exp(-dt / 1.1));
    const heelPen = clamp(1 - (this.heel - 25) / 45, 0.3, 1);

    // the sea: upwind it knocks her back, downwind in a breeze she surfs
    const W = race.waves;
    const slope = W ? waveSlope(W, this.x, this.z, race.t, fx, fz) : 0;
    this.slope = slope;
    // upwind the swell stops her when she meets a face square on. The way through: luff up a little as the bow climbs
    // the face and bear away down the back, so she meets each one at an angle and picks up speed going down. waveN is
    // the swell's slope under her (+ climbing), waveRhythm how well her steering follows it (+1 well, −1 against it)
    const amp = race.wind.p.waves, upW = clamp((75 - a) / 35, 0, 1) * amp;
    const swell = W ? waveSlope(W, this.x, this.z, race.t, fx, fz, 3) : 0;
    this.waveN = clamp(swell / (amp * 0.12 + 1e-3), -1.5, 1.5);
    this.aAvg += (a - this.aAvg) * (1 - Math.exp(-dt / 6));
    const dev = this.aAvg - a; // + she's higher than her average heading
    const fit = clamp(dev / 4, -1, 1) * clamp(this.waveN, -1, 1);
    this.waveRhythm += (fit - this.waveRhythm) * (1 - Math.exp(-dt / 4));
    const chop = 1 - upW * (0.05 + 0.06 * Math.max(0, this.waveN) - 0.05 * fit);

    // slow, the keel hasn't the grip to point: until she's back up to speed she sails as if pinching. Footing a few
    // degrees lower, sheets a touch eased, gets her going again far sooner (after a tack, a stop, a bad set)
    // stall: how many degrees lower than close-hauled she should sail now; each degree she points above that costs speed
    const bt = beatAngle(w.tws), vBeat = polarSpeed(w.tws, bt) * KN;
    this.stall = FOOT * clamp(1 - this.v / (vBeat * 0.95), 0, 1);
    const pinch = a < 80 && a > NO_GO ? clamp(bt + this.stall - a, 0, this.stall) : 0;

    // speed: the target from the polar, and momentum to get there
    this.polar = polarSpeed(w.tws, a, gen || a < 100);
    let target = polarSpeed(w.tws, a, gen) * eff * heelPen * chop * (1 - PINCH * pinch) * KN;
    if (this.byLee > 0) target *= 1 - 0.012 * this.byLee; // by the lee: the wind gets behind the main
    if (this.kiteGybe) target *= this.kiteType === 'zero' ? 0.85 : 0.88; // the kite barely pulls while it's gybed
    // a code zero on a reach in light air: up to 14% more, best about 85° off the wind and fading above 15 knots
    if (zero) target *= 1 + 0.14 * clamp((15 - w.tws) / 7, 0, 1) * clamp(1 - Math.abs(a - 85) / 45, 0, 1);
    // the J3: a loss in light air, about even in a blow; changing jibs, little drive meanwhile
    if (this.smallJib) target *= 1 - clamp(0.1 - (w.tws - 12) * 0.012, 0, 0.1);
    if (this.jibJob) target *= 0.8;
    if (this.broachT > 0) { target *= 0.35; this.broachT -= dt; }
    if (this.kiteJob) target *= this.kiteJob.messy ? 0.62 : this.kiteJob.up ? 0.93 : 0.88; // crew off the rail, the kite half-set or flogging
    // less sail with a reef: a big loss in light air, next to nothing in a blow; tying it in costs more while it's done
    target *= 1 - this.reefFill * clamp(0.16 - (w.tws - 12) * 0.018, 0.02, 0.16);
    if (this.reefJob) target *= 0.85;
    // backing the main: head near the wind with the sheet let right out, the crew pushes the boom out against the
    // wind and she stops, then gathers way astern — how a boat holds her place on the line before the start
    this.backing = !this.kite && !this.auto && !this.pen && a < 55 && this.sheet > 0.9 && this.v < 1.5;
    if (this.backing) target = -0.9 * KN * clamp((55 - a) / 25, 0, 1) * clamp(w.tws / 12, 0.5, 1.4);
    this.target = target;
    const tau = target > this.v ? 6 : a < NO_GO ? 3 : this.v > target * 1.2 ? 2 : 4.5; // above hull speed the drag bites
    this.v += (target - this.v) * (1 - Math.exp(-dt / tau));
    this.v -= 9.81 * slope * 0.3 * dt;
    this.surf = 0;
    if (a > 110 && w.tws > 13 && slope < 0 && this.v > 3 && this.v < target * 1.4) { const s = -slope * 9.81 * 0.35 * dt; this.v += s; this.surf = s / dt; }
    this.v = Math.max(this.backing ? -0.6 : 0, this.v);

    // steering: the button's tack or gybe drives the rudder; a penalty turn spins her round
    if (this.auto) {
      const left = wrap(this.auto.to - this.h);
      this.auto.t = (this.auto.t || 0) + dt;
      if ((Math.abs(left) < 3 * D2R && Math.abs(this.yawRate) < 0.1) || sgn(left) !== this.auto.dir || this.auto.t > 9) { this.auto = null; this.rudder = 0; this.sinceTack = 0; this.events.push('tacked'); }
      // hard over, then ease the helm early and meet her, as she keeps turning for a moment after the rudder centres
      else if (Math.abs(left) > 20 * D2R) this.rudder = this.auto.dir * clamp(Math.abs(left) / (25 * D2R), 0.35, 1);
      else this.rudder = clamp(wrap(left - this.yawRate * 0.55) / (20 * D2R), -1, 1);
    }
    let rud = this.rudder;
    if (this.heel > 40) rud *= 0.5;
    const grip = clamp(0.55 + this.v / 3, 0.55, 1.25);
    let yaw = rud * 0.42 * grip * (this.v < -0.05 ? -0.6 : 1); // going astern the rudder works the other way, and weakly
    if (this.heel > 35) yaw += side * Math.min((this.heel - 35) / 20, 1.2) * 0.22; // weather helm rounds her up
    if (a < NO_GO && this.v < 0.8 && !this.auto && !this.pen) yaw -= side * 0.18; // stopped head to wind, the bow blows off
    // she doesn't answer the helm at once: a heavy hull takes a moment to start turning, and a moment to stop
    this.yawRate += (yaw - this.yawRate) * (1 - Math.exp(-dt / 0.55));
    this.yaw = this.yawRate;
    const prevH = this.h;
    this.h = wrap(this.h + this.yaw * dt);
    // a penalty turn (rule 44.2): one tack and one gybe, turning the same way. The bow crossing the wind is the tack,
    // the stern crossing it the gybe; a crossing the other way round starts the turn again from there
    if (this.pen) {
      const t0 = wrap(this.wdir - prevH), t1 = wrap(this.wdir - this.h), d = sgn(wrap(this.h - prevH));
      if (d && t0 && t1 && sgn(t0) !== sgn(t1)) {
        const pen = this.pen, kind = Math.abs(t1) < Math.PI / 2 ? 'tack' : 'gybe';
        if (pen.dir && d !== pen.dir) { pen.tack = pen.gybe = false; }
        pen.dir = d; pen[kind] = true;
        if (pen.tack && pen.gybe) { this.pen = null; this.events.push('penaltyDone'); }
      }
    }
    this.v -= (Math.abs(this.yaw) * 0.1 + Math.abs(this.rudder) * 0.06) * this.v * dt;
    if (!this.backing) this.v = Math.max(0, this.v);

    if (this.heel > 52 && this.broachT <= 0) { this.broachT = 2.5; this.events.push('broach'); this.kite = false; this.kiteJob = null; }

    // leeway: sideways slip, worst when slow and close to the wind; drift when stopped; and the current
    const leeDeg = a < 100 ? (2.5 + 6 * clamp(1 - this.v / 2.5, 0, 1)) * clamp((100 - a) / 50, 0, 1) : 0;
    const lee = Math.abs(this.v) * Math.tan(leeDeg * D2R) + (this.v < 1 ? 0.12 * w.tws / 12 : 0);
    const rx = Math.cos(this.h), rz = Math.sin(this.h); // starboard
    const cur = race.currentAt(this.x, this.z);
    this.x += (fx * this.v - side * rx * lee + cur.x) * dt;
    this.z += (fz * this.v - side * rz * lee + cur.z) * dt;
  }
}

// ---------- the course ----------
// The course: 'wl' windward–leeward (up to the windward mark, down through the gate, round again, down to the finish);
// 'tri' a triangle — up to the windward mark, a tight reach out to the wing mark (some 100° off the wind, code-zero
// weather in light air), a gybe there and a broad reach back down through the gate, and round again; the last lap
// reaches from the wing mark straight down to the finish. All the marks are left to port.
export function makeCourse(laps, beat, bias, fleet = 4, type = 'wl') {
  const half = Math.max(70, fleet * 10), dx = Math.cos(bias), dz = Math.sin(bias); // the line: some 1.6 boat lengths a boat
  const gate = fleet > 5 ? [{ x: -27, z: -50 }, { x: 27, z: -50 }] : [{ x: -22, z: -45 }, { x: 22, z: -45 }];
  let wing = null, wingOut = null, legs = ['start', ...Array.from({ length: laps }, (_, i) => (i < laps - 1 ? ['mark', 'gate'] : ['mark'])).flat(), 'finish'];
  if (type === 'tri') {
    // from the gate the wing lies 45° off the wind to the left, from the windward mark 100° off it: B up the beat
    // from the gate puts it 0.85 B out and 0.85 B up
    const B = beat + gate[0].z;
    wing = { x: -0.85 * B, z: gate[0].z - 0.85 * B };
    // its outside: straight on from the reach in, turned away from the reach out
    const i1 = norm(wing.x, wing.z + beat), o1 = norm(-wing.x, gate[0].z - wing.z);
    wingOut = norm(i1.x - o1.x, i1.z - o1.z);
    legs = ['start', ...Array.from({ length: laps }, (_, i) => (i < laps - 1 ? ['mark', 'wing', 'gate'] : ['mark', 'wing'])).flat(), 'finish'];
  }
  return {
    laps, type, wing, wingOut,
    // the line, skewed by `bias`: bias > 0 puts the pin end further upwind (pin favoured)
    pin: { x: -half * dx, z: -half * dz }, committee: { x: half * dx, z: half * dz },
    dir: { x: dx, z: dz }, normal: { x: dz, z: -dx }, // along the line (pin → boat), and towards the course
    len: 2 * half,
    windward: { x: 0, z: -beat },
    gate, legs,
  };
}
const norm = (x, z) => { const l = Math.hypot(x, z) || 1; return { x: x / l, z: z / l }; };
// the fleet you race against (names and the colour on the map), and how long the course is
export const FLEET = [['Aurora', 0xc0392b], ['Kestrel', 0x1e8449], ['Nomad', 0xd4ac0d], ['Halcyon', 0x2e86de], ['Mistral', 0x8e44ad],
  ['Selkie', 0x16a085], ['Tern', 0xe67e22], ['Vela', 0xe84393], ['Zephyr', 0x7f8c8d]];
export const COURSE_LEN = { short: 1, medium: 2, long: 3.4 };
export const ZONE = 3 * HULL; // the zone round a mark: three hull lengths
const SEP = HULL * 0.78; // the computer skippers keep the centres this far apart, and then some
// for contact a hull is a capsule: a spine along her centreline with a rounded edge half her beam out, so two boats
// can sail a couple of metres apart side by side, and a bow can touch a mark
const HALF_B = 1.85, SPINE = HULL / 2 - HALF_B;
function hullGap(p, q) { // the closest approach of two spines: distance, and the direction from p's to q's
  const d1x = Math.sin(p.h) * SPINE * 2, d1z = -Math.cos(p.h) * SPINE * 2, d2x = Math.sin(q.h) * SPINE * 2, d2z = -Math.cos(q.h) * SPINE * 2;
  const p1x = p.x - d1x / 2, p1z = p.z - d1z / 2, p2x = q.x - d2x / 2, p2z = q.z - d2z / 2;
  const rx = p1x - p2x, rz = p1z - p2z, a = d1x * d1x + d1z * d1z, e = d2x * d2x + d2z * d2z;
  const b = d1x * d2x + d1z * d2z, c = d1x * rx + d1z * rz, f = d2x * rx + d2z * rz, den = a * e - b * b;
  let s = den > 1e-6 ? clamp((b * f - c * e) / den, 0, 1) : 0, t = (b * s + f) / e;
  if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
  const dx = p2x + d2x * t - (p1x + d1x * s), dz = p2z + d2z * t - (p1z + d1z * s);
  return { d: Math.hypot(dx, dz), dx, dz };
}
function spinePoint(b, m) { // the point on her spine nearest to m
  const fx = Math.sin(b.h), fz = -Math.cos(b.h), s = clamp((m.x - b.x) * fx + (m.z - b.z) * fz, -SPINE, SPINE);
  return { x: b.x + fx * s, z: b.z + fz * s };
}
const KITE_MAX = 26; // the computer boats fly the kite below this true wind speed (knots)
// her tack, as the rules have it: from the side her boom is on (sailing by the lee she is still on her old tack)
const tackOf = (b) => b.boom || sgn(b.twa);
const lineD = (c, b) => (b.x - c.pin.x) * c.normal.x + (b.z - c.pin.z) * c.normal.z; // + above the line
const lineT = (c, b) => ((b.x - c.pin.x) * c.dir.x + (b.z - c.pin.z) * c.dir.z) / c.len;

// the daily race: the same course and wind for everyone on a given day (UTC), made from the date
export function dailyRace(date = new Date()) {
  const day = date.toISOString().slice(0, 10), n = Math.floor(Date.parse(day) / 864e5), r = rng(n * 2654435761);
  r(); r();
  return { day, seed: (n * 7919) % 100000, preset: ['light', 'medium', 'strong'][Math.floor(r() * 3)], fleet: 5, length: 'short', laps: 1, start: 1, current: r() < 0.3 ? 1 : 0, course: 'wl' };
}

// the start sequence: the class flag goes up at the warning signal, P at the preparatory, P down at one minute
const SEQUENCES = {
  1: [{ t: -60, cls: true, P: false, sound: 'long', key: 'sig1' }, { t: 0, cls: false, P: false, sound: 'horn', key: 'gun' }],
  3: [{ t: -180, cls: true, P: false, sound: 'horn', key: 'sigWarn' }, { t: -120, cls: true, P: true, sound: 'horn', key: 'sigPrep' }, { t: -60, cls: true, P: false, sound: 'long', key: 'sig1' }, { t: 0, cls: false, P: false, sound: 'horn', key: 'gun' }],
  5: [{ t: -300, cls: true, P: false, sound: 'horn', key: 'sigWarn' }, { t: -240, cls: true, P: true, sound: 'horn', key: 'sigPrep' }, { t: -60, cls: true, P: false, sound: 'long', key: 'sig1' }, { t: 0, cls: false, P: false, sound: 'horn', key: 'gun' }],
};

// ---------- the race ----------
export class Race {
  constructor({ preset = 'medium', laps = 1, autoTrim = false, seed = Date.now() % 100000, start = 1, current = false, fleet = 4, length = 'short', course = 'wl' } = {}) {
    this.rand = rng(seed + 7);
    const beatLen = ({ light: 200, medium: 260, strong: 280 }[preset] || 260) * (COURSE_LEN[length] || 1);
    this.wind = new Wind(preset, seed, beatLen, course === 'tri' ? 0.85 * beatLen : 0);
    const bias = (this.rand() - 0.5) * 2 * 8 * D2R;
    fleet = clamp(Math.round(fleet), 2, FLEET.length + 1);
    this.course = makeCourse(laps, beatLen, bias, fleet, course === 'tri' ? 'tri' : 'wl');
    // laid in Göcek bay, in clear water off Skopea Marina (land.js): the start is at this point of the bay
    this.at = placeCourse(this.course, beatAngle(this.wind.p.tws));
    this.seq = SEQUENCES[start] || SEQUENCES[1];
    this.clock = this.seq[0].t - (start === 1 ? 4 : 8); // negative before the gun
    this.sigI = 0;
    this.flags = { cls: start === 1, P: false, X: false, sub: false };
    if (start === 1) this.flags.P = true;
    // the preparatory flag the committee flies: P most days; sometimes U (over the line in the last minute: disqualified,
    // unless the start is recalled) or the black flag (disqualified even then); and after a general recall the next
    // start goes up the ladder, P → U → black
    this.prepFlag = ['P', 'P', 'P', 'U', 'B'][Math.abs(Math.floor(seed)) % 5];
    this.recalls = 0;
    this.t = 0; // time for the waves
    this.waves = makeWaves(this.wind.p.waves, this.wind.dir());
    const ca = this.rand() < 0.5 ? 1 : -1;
    this.current = current ? { x: ca * 0.6 * KN * Math.cos(0.3), z: 0.6 * KN * Math.sin(0.3) * (this.rand() < 0.5 ? 1 : -1) } : { x: 0, z: 0 };
    this.curSide = -ca; // the side of the course where the stream runs strongest
    this.tidePh = ((seed % 997) / 997) * 2 * Math.PI; // where in its cycle the tide is at the start
    for (const p of this.waves) { // the chop follows the wind (see step): each train's own direction and starting height
      p.dir = Math.atan2(p.dx, -p.dz); p.A0 = p.A; p.norm = 0.35 + 0.65 * Math.max(0, Math.cos(wrap(p.dir - this.wind.dir() - Math.PI)));
    }
    this.chop = 1;
    const W = this.wind.dir(), beat = beatAngle(this.wind.p.tws);
    const half = this.course.len / 2;
    const near = start === 1 ? 0.55 : 1; // a one-minute start: the fleet begins closer to the line, so all can make it
    this.player = new Boat({ name: 'You', x: 25, z: (fleet > 4 ? 78 : 95) * near, h: wrap(W - beat * D2R), v: 2, autoTrim });
    const full = fullHeel(this.wind.p.tws * 1.4, 28, false);
    this.player.sheet = sheetFor(idealSail(28) + depowerFor(full));
    const fl = FLEET.slice(0, fleet - 1), n = fl.length;
    this.boats = [this.player];
    fl.forEach(([name, color], i) => {
      const f = n > 1 ? i / (n - 1) : 0.5; // spread them along below the line
      const b = new Boat({ name, x: lerp(-half - 10, half - 10, f) + (i % 2 ? 8 : -8), z: (105 + (i % 3) * 18) * near, h: wrap(W + (i % 2 ? 90 : -90) * D2R), v: 2, autoTrim: true });
      b.ai = { skill: 0.8 + this.rand() * 0.18, lineT: clamp(0.15 + f * 0.7 + (this.rand() - 0.5) * 0.08, 0.15, 0.85) /* clear of the ends, where the pin and the committee boat catch them */, lastTack: -999, go: false, mean: W, dirtyT: 0, hailT: -99, wp: 0, loiter: i % 2 ? 1 : -1 };
      b.ai.port = i % 4 === 3; // one boat in four comes in late on port, looking for a gap
      b.ai.dare = (((b.ai.lineT * 97.3) % 1) - 0.65) * 3.4; // seconds: how close to the gun she dares cut it (− bolder)
      if (this.wind.p.tws >= 19 && i % 2) b.smallJib = true; // in a blow, some start with the J3 up
      b.color = color; b.crew = 1.5 - b.ai.skill; // the better skippers have the surer crews
      this.boats.push(b);
    });
    for (const b of this.boats) Object.assign(b, { leg: 0, ocs: false, done: false, finish: null, track: [], lastD: lineD(this.course, b), lastZ: b.z, rnd: null, dsq: false, touchT: 0, ufd: false, bfd: false });
    this.trackT = 0;
    this.messages = [];
    if (this.prepFlag !== 'P') this.say('prep' + this.prepFlag); // tell the player what the flag means
    if (this.wind.sea) this.say('seaBreeze'); // the forecast: a sea breeze coming in
    this.over = false;
    this.zoneStates = new Map();
    this.pairs = new Map(); // boats near each other: how their right of way came about (rules 15 and 17)
    // the player's race, for the debrief on the results: the start, speed against target, dirty air, the tacks against
    // the wind's swings, the fouls and hails, and the time spent on penalties
    this.log = { gunD: null, gunV: null, ocs: false, startT: null, legs: [], v: 0, polar: 0, sailing: 0, dirty: 0, tacks: [], gybes: 0, fouls: [], hails: {}, penT: 0, leg: 0, auto: false };
  }
  say(key, arg) { this.messages.push({ key, arg }); }
  // how far a point of the race is from the shore, metres: + at sea, − on land
  roomAt(x, z) { return roomAt(x + this.at.x, z + this.at.z); }
  record(dt, before) {
    const P = this.player, L = this.log;
    if (before < 0 && this.clock >= 0) { L.gunD = -lineD(this.course, P); L.gunV = P.v / KN; L.ocs = P.ocs; }
    if (P.leg !== L.leg) { L.leg = P.leg; L.legs.push(this.clock); (L.legPlaces || (L.legPlaces = [])).push(this.standings().indexOf(P) + 1); if (P.leg === 1) L.startT = this.clock; }
    const tackNow = !!P.auto;
    if (tackNow && !L.auto && this.clock >= 0 && !P.done) {
      if (P.auto.gybe) L.gybes++;
      else L.tacks.push(Math.round(sgn(P.twa) * wrap(P.wdir - this.wind.mean()) / D2R)); // − the wind had headed her, + lifted
    }
    L.auto = tackNow;
    if (this.clock < 0 || P.done) return;
    if (P.pen) L.penT += dt;
    if (P.shadow > 0.08) L.dirty += dt;
    if (!P.auto && !P.pen && P.polar > 0.5) { L.v += (P.v / KN) * dt; L.polar += P.polar * dt; L.sailing += dt; }
  }
  get rulesOn() { return this.clock >= (this.seq.length > 2 ? this.seq[1].t : this.seq[0].t); } // from the preparatory signal

  // the wind a boat feels: the wind field, less the shadow of the boats to windward of it
  windAt(b) {
    const w = this.wind.at(b.x, b.z);
    const ux = -Math.sin(w.dir), uz = Math.cos(w.dir); // downwind
    let deficit = 0, bend = 0;
    for (const o of this.boats) {
      if (o === b) continue;
      const dx = b.x - o.x, dz = b.z - o.z, along = dx * ux + dz * uz;
      if (along < 3 || along > 80) continue;
      const lat = dx * uz - dz * ux, width = 6 + along * 0.22;
      if (Math.abs(lat) > width) continue;
      const f = (1 - along / 80) * (1 - Math.abs(lat) / width);
      deficit += 0.32 * f; bend += f * 5 * D2R * sgn(o.twa); // the wind is bent off the other boat's sails
    }
    // backwind: a boat close ahead and to leeward bends her wind back onto you — less of it, and from further ahead
    // (the "safe leeward" position); upwind only
    const fx = Math.sin(b.h), fz = -Math.cos(b.h), twaB = wrap(w.dir - b.h);
    if (Math.abs(twaB) < 70 * D2R) for (const o of this.boats) {
      if (o === b || Math.abs(wrap(w.dir - o.h)) > 70 * D2R) continue;
      const dx = o.x - b.x, dz = o.z - b.z, down = dx * ux + dz * uz, ahead = dx * fx + dz * fz;
      if (down < 2 || down > 22 || ahead < -2 || ahead > 20 || dx * dx + dz * dz > 625) continue;
      const f = (1 - down / 22) * (1 - Math.max(0, ahead) / 20);
      deficit += 0.18 * f; bend -= f * 6 * D2R * sgn(twaB); // headed, in lighter air
    }
    deficit = Math.min(deficit, 0.45);
    let dir = w.dir + bend, tws = w.tws * (1 - deficit);
    // she sails in the water, so what she feels is the wind over the water: the stream under her makes a wind of its
    // own, against its set (sailing up-tide, the wind seems a little stronger and further ahead)
    const cur = this.currentAt(b.x, b.z);
    if (cur.x || cur.z) {
      const vx = -Math.sin(dir) * tws * KN - cur.x, vz = Math.cos(dir) * tws * KN - cur.z;
      dir = Math.atan2(-vx, vz); tws = Math.hypot(vx, vz) / KN;
    }
    return { dir, tws, gust: w.gust, shadow: deficit };
  }

  // the stream isn't the same everywhere: up to 60% stronger on one side of the course and weaker on the other, with
  // a slow eddy along it — so which side you take matters. race.current is its average, for the arrow on the map.
  currentAt(x, z) {
    const c = this.current;
    if (!c.x && !c.z) return c;
    const f = clamp(1 + 0.6 * this.curSide * clamp(x / 220, -1, 1) + 0.2 * Math.sin(z / 170 + 0.8), 0.3, 1.8);
    // and the tide works through its cycle as you race: the stream builds and eases (±40% over some 25 minutes) and
    // swings round by up to 25°
    const k = f * (1 + 0.4 * Math.sin((this.t * 2 * Math.PI) / 1500 + this.tidePh)), a = 25 * D2R * Math.sin((this.t * 2 * Math.PI) / 2100 + 1.3 * this.tidePh);
    const ca = Math.cos(a), sa = Math.sin(a);
    return { x: (c.x * ca - c.z * sa) * k, z: (c.x * sa + c.z * ca) * k };
  }

  idle(dt) { this.t += dt; }

  step(dt) {
    const before = this.clock; this.lastDt = dt;
    this.clock += dt; this.t += dt;
    this.wind.step(dt);
    // the short waves follow the wind: the trains running with it now build and the others die down, and they grow
    // in a breeze and ease in a lull (over half a minute or so); the long swell (the first three) stays as it was
    const wd = this.wind.dir() + Math.PI, pw = this.wind.at(this.player.x, this.player.z).tws / this.wind.p.tws;
    this.chop += (pw - this.chop) * (1 - Math.exp(-dt / 30));
    const ck = clamp(this.chop, 0.6, 1.6) ** 1.5;
    this.waves.forEach((p, i) => { if (i >= 3) p.A = (p.A0 * (0.35 + 0.65 * Math.max(0, Math.cos(wrap(p.dir - wd))))) / p.norm * ck; });
    while (this.sigI < this.seq.length && this.clock >= this.seq[this.sigI].t) {
      const s = this.seq[this.sigI++];
      this.flags.cls = s.cls; this.flags.P = s.P; this.flags.sub = false;
      this.say('signal', s);
    }
    for (const b of this.boats) if (b.ai && !b.done) this.drive(b, dt);
    for (const b of this.boats) b.step(dt, this);
    this.trackRow();
    this.collide(dt);
    // under U or the black flag: anywhere in the triangle of the line's ends and the first mark in the last minute
    if (this.prepFlag !== 'P' && this.clock >= -60 && this.clock < 0) for (const b of this.boats) {
      if (b.ufd || b.bfd || !this.inTriangle(b)) continue;
      b[this.prepFlag === 'U' ? 'ufd' : 'bfd'] = true;
      if (b === this.player) { this.say(this.prepFlag === 'U' ? 'ufd' : 'bfd'); this.log.startDsq = this.prepFlag; }
    }
    if (before < 0 && this.clock >= 0) {
      const c = this.course, over = this.boats.filter((b) => { const t = lineT(c, b); return lineD(c, b) > 0 && t > -0.2 && t < 1.2; });
      if (over.length >= Math.max(2, Math.ceil(this.boats.length * 0.35))) { this.generalRecall(); return; }
      // under P, the boats over are recalled one by one (X flag) and must go back; under U or black they're already out
      if (this.prepFlag === 'P') for (const b of over) { b.ocs = true; this.flags.X = true; if (b === this.player) this.say('ocs'); }
    }
    if (this.flags.X && (this.clock > 240 || !this.boats.some((b) => b.ocs))) this.flags.X = false;
    for (const b of this.boats) this.progress(b);
    this.zones();
    this.hails();
    this.record(dt, before);
    this.trackT += dt;
    if (this.trackT > 1) { this.trackT = 0; for (const b of this.boats) if (!b.done) b.track.push([b.x, b.z]); }
  }

  // legs: crossing the line, rounding the windward mark to port, the gate, the finish
  progress(b) {
    const c = this.course, k = c.legs[b.leg], d = lineD(c, b), t = lineT(c, b), on = t >= 0 && t <= 1;
    if (b.ocs && d < -2) { b.ocs = false; if (b === this.player) this.say('cleared'); }
    if (this.clock >= 0 && !b.done) {
      if (k === 'start' && !b.ocs && b.lastD <= 0 && d > 0) {
        if (on) { b.leg++; b.rnd = null; if (b === this.player) this.say('started'); }
        else if (b === this.player) this.say('missedLine'); // outside the ends: doesn't count
      }
      else if (k === 'mark') {
        // rounded to port = crossing the line straight upwind of the mark from its east side to its west side
        const m = c.windward, ux = Math.sin(b.wdir), uz = -Math.cos(b.wdir); // towards the wind
        const ahead = (b.x - m.x) * ux + (b.z - m.z) * uz, side = (b.x - m.x) * -uz + (b.z - m.z) * ux; // side > 0: east of it
        if (b.rnd !== null && ahead > 0 && ahead < 70) {
          if (b.rnd > 0 && side <= 0) { b.leg++; b.rnd = null; if (b.ai) b.ai.wp = 0; if (b === this.player) this.say(c.type === 'tri' ? 'roundedTri' : 'rounded'); b.lastD = d; b.lastZ = b.z; return; }
          if (b.rnd < 0 && side > 0 && b === this.player) this.say('wrongSide'); // went over it the wrong way
        }
        b.rnd = side;
      } else if (k === 'wing') {
        // the same at the wing mark, across the line straight out from it, from the reach in round to the reach out
        const m = c.wing, o = c.wingOut, ahead = (b.x - m.x) * o.x + (b.z - m.z) * o.z, side = (b.x - m.x) * -o.z + (b.z - m.z) * o.x;
        if (b.rnd !== null && ahead > 0 && ahead < 70) {
          if (b.rnd > 0 && side <= 0) { b.leg++; b.rnd = null; if (b.ai) b.ai.wp = 0; if (b === this.player) this.say('roundedWing'); b.lastD = d; b.lastZ = b.z; return; }
          if (b.rnd < 0 && side > 0 && b === this.player) this.say('wrongSide');
        }
        b.rnd = side;
      } else if (k === 'gate' && b.lastZ <= c.gate[0].z && b.z > c.gate[0].z) {
        if (b.x > c.gate[0].x - 3 && b.x < c.gate[1].x + 3) { b.leg++; if (b.ai) b.ai.wp = 0; if (b === this.player) this.say('gate'); }
        else if (b === this.player) this.say('missedGate'); // outside the buoys: doesn't count
      }
      else if (k === 'finish' && b.lastD > 0 && d <= 0 && on) {
        b.done = true; b.finish = this.clock; b.track.push([b.x, b.z]);
        if (b.pen) { b.dsq = true; b.pen = null; } // didn't take the penalty
        if (b.ufd || b.bfd) b.dsq = true; // over in the last minute under U or the black flag
        b.place = b.dsq ? null : this.boats.filter((o) => o.done && !o.dsq).length;
        if (b === this.player) { this.say(b.ufd || b.bfd ? 'finishedStartDsq' : b.dsq ? 'finishedDsq' : 'finished', b.place); this.over = true; }
      }
    }
    b.lastD = d; b.lastZ = b.z;
  }

  standings() {
    const score = (b) => (b.done ? (b.dsq ? 5e8 : 1e9) - b.finish : b.leg * 1e5 - this.distToNext(b));
    return [...this.boats].sort((p, q) => score(q) - score(p));
  }
  nextMark(b) {
    const c = this.course, k = c.legs[b.leg];
    if (k === 'mark') return c.windward;
    if (k === 'wing') return c.wing;
    if (k === 'gate') return { x: 0, z: c.gate[0].z };
    return { x: (c.pin.x + c.committee.x) / 2, z: (c.pin.z + c.committee.z) / 2 };
  }
  distToNext(b) { const m = this.nextMark(b); return Math.hypot(m.x - b.x, m.z - b.z); }
  lineInfo(b) { const c = this.course; return { d: lineD(c, b), t: lineT(c, b) }; }

  // the triangle of the starting line's ends and the first mark (rule 30.3 and 30.4)
  inTriangle(b) {
    const c = this.course, A = c.pin, B2 = c.committee, C = c.windward;
    const s = (p1, p2, p3) => (p1.x - p3.x) * (p2.z - p3.z) - (p2.x - p3.x) * (p1.z - p3.z);
    const d1 = s(b, A, B2), d2 = s(b, B2, C), d3 = s(b, C, A);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  }
  // a general recall: too many over to pick out. The first substitute goes up, everyone goes back below the line and
  // the sequence starts again — with the next flag up the ladder. A black-flagged boat stays out.
  generalRecall() {
    this.recalls++;
    this.prepFlag = this.prepFlag === 'P' ? 'U' : 'B';
    this.clock = this.seq[0].t - 12; this.sigI = 0;
    Object.assign(this.flags, { cls: false, P: this.seq.length <= 2, X: false, sub: true }); // a one-minute start shows its flag before it, as at first
    const c = this.course;
    for (const b of this.boats) { Object.assign(b, { leg: 0, ocs: false, ufd: false, rnd: null, lastD: lineD(c, b), lastZ: b.z }); if (b.ai) b.ai.go = false; }
    this.log.ocs = false; this.log.gunD = null;
    this.say('genRecall', this.prepFlag);
  }

  // ---------- right of way (RRS Part 2, simplified) ----------
  // who must keep clear of whom, and the rule that says so
  rightOfWay(p, q, noZone = false) {
    if (p.pen && !q.pen) return { giver: p, rule: '44' };
    if (q.pen && !p.pen) return { giver: q, rule: '44' };
    const zs = noZone ? null : this.zoneOf(p, q); // mark-room (rule 18), settled when the first of them reached the zone
    if (zs) return { giver: zs.entitled === p ? q : p, rule: '18' };
    if (p.tacking !== q.tacking) return { giver: p.tacking ? p : q, rule: '13' };
    const sp = tackOf(p), sq = tackOf(q);
    if (sp !== sq) return { giver: sp < 0 ? p : q, rule: '10' };
    // same tack: not overlapped → the boat clear astern keeps clear; overlapped → the windward boat
    if (!this.overlapped(p, q)) return { giver: this.clearAhead(p, q) === p ? q : p, rule: '12' };
    const ux = Math.sin(p.wdir), uz = -Math.cos(p.wdir); // towards the wind
    return { giver: p.x * ux + p.z * uz > q.x * ux + q.z * uz ? p : q, rule: '11' };
  }
  // Each step, for the boats near each other: who holds right of way, and how she came by it. Rule 15: a boat that
  // gets it through her own action (finishing a tack or gybe onto it, or sailing up from clear astern into a leeward
  // overlap) must at first give the other room to keep clear. Rule 17: a leeward overlap made from clear astern
  // within two hull lengths binds her not to sail above her proper course while it lasts.
  trackRow() {
    const bs = this.boats;
    for (const b of bs) { // in the gate's zone: since when, and has she gybed there (rule 18.4)
      const inZ = this.course.legs[b.leg] === 'gate' && Math.min(...this.course.gate.map((g) => Math.hypot(b.x - g.x, b.z - g.z))) < ZONE;
      if (inZ && !b.inZone) Object.assign(b, { inZone: true, zoneT: this.clock, zoneGybed: false });
      else if (!inZ && b.inZone) Object.assign(b, { inZone: false, zoneGybed: false });
      if (b.inZone && b.sinceTack < 0.05 && this.clock - b.zoneT > 0.1 && b.lastGybe) b.zoneGybed = true;
    }
    for (const b of bs) { // her recent headings, for rule 16
      const h = b.hist || (b.hist = []);
      if (!h.length || this.clock - h[h.length - 1][0] > 0.2) h.push([this.clock, b.h]);
      while (h.length && h[0][0] < this.clock - 3) h.shift();
    }
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const p = bs[i], q = bs[j], key = i * 16 + j;
      if (!this.rulesOn || p.done || q.done || Math.hypot(p.x - q.x, p.z - q.z) > 4 * HULL) { this.pairs.delete(key); continue; }
      const r = this.rightOfWay(p, q), st = this.pairs.get(key);
      if (!st) { this.pairs.set(key, { giver: r.giver, rule: r.rule, r15: null, r17: null }); continue; }
      if (r.giver !== st.giver) {
        const row = st.giver, fromAstern = st.rule === '12' && r.rule === '11';
        st.r15 = row.sinceTack < 3 || fromAstern ? { row, until: this.clock + 4 } : null;
        if (fromAstern && Math.hypot(p.x - q.x, p.z - q.z) < 2 * HULL) st.r17 = row;
      }
      if (r.rule !== '11') st.r17 = null; // the overlap is over, or something else decides it now
      st.giver = r.giver; st.rule = r.rule;
    }
  }
  // who is in the wrong if they touch: Part 2's right of way, then the limits on the boat that holds it
  judge(p, q) {
    const r = this.rightOfWay(p, q);
    if (r.rule === '44') return r;
    const c = this.course, k = c.legs[p.leg];
    if (r.rule === '18') {
      // 18.4: an inside boat with right of way that must gybe at the mark sails no farther from it than her proper
      // course needs, until she gybes
      const ent = r.giver === p ? q : p, o = r.giver;
      if (k === 'gate' && !ent.zoneGybed && this.rightOfWay(ent, o, true).giver === o && Math.min(...c.gate.map((m) => Math.hypot(ent.x - m.x, ent.z - m.z))) > 2 * HULL) return { giver: ent, rule: '18.4' };
      return r;
    }
    // 19: passing the committee boat (an obstruction, when it isn't a mark of the leg), overlapped: the outside boat
    // gives the inside one room
    if (k !== 'start' && k !== 'finish' && p.leg === q.leg && this.overlapped(p, q)) {
      const cb = this.hardMarks()[4][0], dp = Math.hypot(p.x - cb.x, p.z - cb.z), dq = Math.hypot(q.x - cb.x, q.z - cb.z);
      if (Math.min(dp, dq) < 2 * HULL) return { giver: dp < dq ? q : p, rule: '19' };
    }
    const row = r.giver === p ? q : p, i = this.boats.indexOf(p), j = this.boats.indexOf(q);
    const st = this.pairs.get(Math.min(i, j) * 16 + Math.max(i, j));
    // 20: a boat hailed for room to tack that hasn't tacked or given room
    const h = this.r20;
    if (h && this.clock - h.t < 10 && ((h.hailer === p && h.hailed === q) || (h.hailer === q && h.hailed === p)) && h.hailed.sinceTack > this.clock - h.t) return { giver: h.hailed, rule: '20' };
    if (st && st.r15 && st.r15.row === row && this.clock < st.r15.until) return { giver: row, rule: '15' };
    if (this.turnedAt(row, r.giver)) return { giver: row, rule: '16' };
    if (st && st.r17 === row && this.aboveProper(row)) return { giver: row, rule: '17' };
    return r;
  }
  // rule 16: she turned 20° or more towards the other boat in the last couple of seconds (not a tack: a tacking boat
  // has no right of way to begin with)
  turnedAt(b, o) {
    const h0 = b.hist && b.hist.find((e) => e[0] >= this.clock - 2.5);
    if (!h0) return false;
    const turn = wrap(b.h - h0[1]);
    if (Math.abs(turn) < 20 * D2R) return false;
    const brg = wrap(Math.atan2(o.x - b.x, -(o.z - b.z)) - h0[1]); // where the other boat lay off her old heading
    // and it was the turn that did it: on her old heading the two would have passed clear
    return sgn(turn) === sgn(brg) && Math.abs(brg) < 120 * D2R && this.cpa(b, o, h0[1]).d > 2 * HALF_B + 2;
  }
  // above her proper course: upwind, higher than close-hauled; downwind, higher than both the best angle down and the
  // course to the mark (with a little slack). Before the start there is no proper course.
  aboveProper(b) {
    if (this.clock < 0) return false;
    const k = this.course.legs[b.leg], a = Math.abs(b.twa) / D2R, beat = beatAngle(b.tws);
    if (k === 'mark') return a < beat - 6;
    const m = this.nextMark(b), toMark = Math.abs(wrap(b.wdir - Math.atan2(m.x - b.x, -(m.z - b.z)))) / D2R;
    return a < Math.min(runAngle(b.tws, b.kite), Math.max(toMark, beat)) - 12;
  }
  // overlapped: neither is clear astern of the other (within a hull length, measured along p's course)
  overlapped(p, q) { const fx = Math.sin(p.h), fz = -Math.cos(p.h); return Math.abs((q.x - p.x) * fx + (q.z - p.z) * fz) < HULL; }
  clearAhead(p, q) { const fx = Math.sin(p.h), fz = -Math.cos(p.h); return (q.x - p.x) * fx + (q.z - p.z) * fz > 0 ? q : p; }
  // Rule 18: when the first of two boats reaches the zone (three lengths from the mark), it is settled who gets
  // mark-room — the inside boat if they are overlapped then, the boat clear ahead if not — and that holds until both
  // have left. Not at the windward mark: there nobody gets mark-room, and port keeps clear of starboard (rule 10).
  zones() {
    const bs = this.boats, c = this.course;
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const p = bs[i], q = bs[j], key = i * 16 + j, st = this.zoneStates.get(key), k = c.legs[p.leg];
      if (p.leg !== q.leg || (k !== 'gate' && k !== 'wing') || p.done || q.done) { if (st) this.zoneStates.delete(key); continue; }
      const m = this.nextMark(p), dp = Math.hypot(p.x - m.x, p.z - m.z), dq = Math.hypot(q.x - m.x, q.z - m.z);
      if (st) { if (dp > ZONE + 10 && dq > ZONE + 10) this.zoneStates.delete(key); continue; }
      if ((dp < ZONE || dq < ZONE) && Math.hypot(p.x - q.x, p.z - q.z) < 3 * HULL) {
        const ov = this.overlapped(p, q);
        this.zoneStates.set(key, { p, q, overlapped: ov, entitled: ov ? (dp < dq ? p : q) : this.clearAhead(p, q) });
      }
    }
  }
  owesRoom(b) {
    for (const st of this.zoneStates.values()) {
      if (st.p !== b && st.q !== b) continue;
      const o = st.p === b ? st.q : st.p;
      if (st.entitled !== b && !o.done && Math.hypot(o.x - b.x, o.z - b.z) < 4 * HULL) return true;
    }
    return false;
  }
  zoneOf(p, q) { for (const st of this.zoneStates.values()) if ((st.p === p && st.q === q) || (st.p === q && st.q === p)) return st; return null; }
  cpa(p, q, ph = p.h) {
    const rx = q.x - p.x, rz = q.z - p.z;
    const vx = Math.sin(q.h) * q.v - Math.sin(ph) * p.v, vz = -Math.cos(q.h) * q.v + Math.cos(ph) * p.v;
    const v2 = vx * vx + vz * vz;
    const t = v2 < 1e-4 ? 0 : clamp(-(rx * vx + rz * vz) / v2, 0, 30);
    return { t, d: Math.hypot(rx + vx * t, rz + vz * t), now: Math.hypot(rx, rz) };
  }
  // the computer boats hail when the player must keep clear and is about to hit them
  hails() {
    if (!this.rulesOn) return;
    const P = this.player;
    for (const o of this.boats) {
      if (o === P || o.done || P.done) continue;
      const c = this.cpa(P, o);
      if (c.now > 45 || c.d > 11 || c.t > 7) continue;
      const r = this.judge(P, o);
      if (r.giver === P && this.clock - o.ai.hailT > 7) { o.ai.hailT = this.clock; this.say('hail', { who: o.name, rule: r.rule }); this.log.hails[r.rule] = (this.log.hails[r.rule] || 0) + 1; }
    }
  }
  // contact: the boat that should have kept clear takes a one-turn penalty, one tack and one gybe (rule 44.2)
  foul(p, q) {
    const r = this.judge(p, q), g = r.giver, other = g === p ? q : p;
    if (g.pen || g.done) return;
    // 21: a boat pushed into this contact by another's foul a moment before is exonerated
    if (g.wrongedT !== undefined && this.clock - g.wrongedT < 1.5) { if (g === this.player) this.say('exonerated'); return; }
    g.pen = { tack: false, gybe: false, dir: 0 }; other.wrongedT = this.clock;
    if (g === this.player) {
      this.say('fouled', { who: other.name, rule: r.rule }); this.log.fouls.push({ rule: r.rule, who: other.name, t: this.clock, x: g.x, z: g.z });
      // barging: squeezing in between a leeward boat and the committee boat at the start — there's no room to be had
      // there (rule 18 doesn't apply at a starting mark), so the windward boat is simply in the wrong
      const c = this.course;
      if (r.rule === '11' && this.clock > -60 && this.clock < 30 && Math.hypot(g.x - c.committee.x, g.z - c.committee.z) < 35) this.say('barging');
    }
    else if (other === this.player) this.say('theyFouled', { who: g.name, rule: r.rule });
  }

  collide(dt) {
    const bs = this.boats, c = this.course;
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const p = bs[i], q = bs[j];
      if (Math.hypot(q.x - p.x, q.z - p.z) > HULL + 1) continue;
      const g = hullGap(p, q);
      if (g.d < 2 * HALF_B) {
        const d = Math.max(g.d, 0.01), nx = g.d > 0.01 ? g.dx / d : Math.sign(q.x - p.x || 1), nz = g.d > 0.01 ? g.dz / d : 0, push = (2 * HALF_B - g.d) / 2;
        p.x -= nx * push; p.z -= nz * push; q.x += nx * push; q.z += nz * push;
        if (p.hit <= 0 && q.hit <= 0) {
          p.v *= 0.75; q.v *= 0.75;
          if (p === this.player || q === this.player) this.say('bump');
          if (this.rulesOn && !p.done && !q.done) this.foul(p, q);
        }
        p.hit = q.hit = 2;
      }
    }
    // the shore: a boat that sails onto it is stopped there and set back off into the water
    for (const b of bs) {
      b.groundT = (b.groundT || 0) - dt;
      const r = this.roomAt(b.x, b.z);
      if (r >= GROUND) continue;
      const e = 10, gx = this.roomAt(b.x + e, b.z) - this.roomAt(b.x - e, b.z), gz = this.roomAt(b.x, b.z + e) - this.roomAt(b.x, b.z - e), g = Math.hypot(gx, gz) || 1;
      b.x += (gx / g) * (GROUND - r); b.z += (gz / g) * (GROUND - r);
      if (b.groundT <= 0) { b.v *= 0.3; if (b === this.player) this.say('aground'); }
      b.v = Math.min(b.v, 0.8); b.groundT = 3;
    }
    const marks = this.hardMarks();
    for (const b of bs) {
      b.hit -= dt; b.touchT -= dt;
      for (const [m, rm] of marks) {
        const sp = spinePoint(b, m), dx = sp.x - m.x, dz = sp.z - m.z, d = Math.hypot(dx, dz), r = rm + HALF_B;
        if (d < r && d > 0.01) {
          b.x += (dx / d) * (r - d); b.z += (dz / d) * (r - d); b.v *= 0.9;
          // touching a mark: a one-turn penalty (rules 31 and 44.2)
          if (b.touchT <= 0 && !b.pen && !b.done && this.rulesOn) { b.pen = { tack: false, gybe: false, dir: 0 }; if (b === this.player) { this.say('touched'); this.log.fouls.push({ rule: '31', t: this.clock, x: b.x, z: b.z }); } }
          b.touchT = 3;
        }
      }
    }
  }

  // ---------- the computer skippers ----------
  aiTarget(b) {
    const c = this.course, k = c.legs[b.leg], ai = b.ai;
    if (k === 'mark' || k === 'wing') {
      // o: the mark's outside (upwind for the windward mark), p: square to it, the side she comes in on
      const m = k === 'mark' ? c.windward : c.wing, o = k === 'mark' ? { x: 0, z: -1 } : c.wingOut, p = { x: -o.z, z: o.x };
      const at = (fp, fo) => ({ x: m.x + p.x * fp + o.x * fo, z: m.z + p.z * fp + o.z * fo });
      // tangled up at the mark (circling it without getting round): sail clear out on the side she comes in on, and
      // come in again from there, as a skipper would
      ai.nearT = Math.hypot(b.x - m.x, b.z - m.z) < 45 ? (ai.nearT || 0) + (this.lastDt || 0) : 0;
      if (ai.nearT > 50) { ai.nearT = 0; ai.detour = this.clock + 30; ai.wp = 0; }
      if (ai.detour > this.clock) return at(35, -30);
      // round it to port: come in on its near side with room to spare, cross outside it, leave on the far side
      // a boat that owes another mark-room (rule 18) goes round outside it, wider and a little later
      const wide = this.owesRoom(b) ? 1 : 0;
      const w0 = at(10 + wide * 12, 9 + wide * 8), w1 = at(-14 - wide * 6, 10 + wide * 6);
      const ah = (b.x - m.x) * o.x + (b.z - m.z) * o.z, sd = (b.x - m.x) * p.x + (b.z - m.z) * p.z;
      if (ai.wp === 0 && ah > 4 && sd > -3) ai.wp = 1; // clearly outside it: now bear away across
      if (ai.wp === 1 && Math.hypot(b.x - w1.x, b.z - w1.z) < 6) ai.wp = 0; // there and still not round: go again
      return ai.wp === 0 ? w0 : w1;
    }
    if (k === 'gate') { // through the gate from above; below it without having gone through: back up and try again
      if (b.z > c.gate[0].z + 1) return { x: 0, z: c.gate[0].z - 15 };
      return { x: b.x < 0 ? -8 : 8, z: c.gate[0].z + 8 };
    }
    // the finish: each boat to its own part of the line, so they don't all converge on its middle
    const pt = { x: lerp(c.pin.x, c.committee.x, ai.lineT), z: lerp(c.pin.z, c.committee.z, ai.lineT) };
    if (k === 'finish') { const f = lerp(0.25, 0.75, ai.lineT); return { x: lerp(c.pin.x, c.committee.x, f) - c.normal.x * 15, z: lerp(c.pin.z, c.committee.z, f) - c.normal.z * 15 }; }
    // not started yet: back below the line if over it (or outside its ends), then across it between the ends
    const lt = lineT(c, b);
    if (lineD(c, b) > 0 || lt < 0.05 || lt > 0.95) return { x: pt.x - c.normal.x * 20, z: pt.z - c.normal.z * 20 }; // outside the ends: first in below the line
    return { x: pt.x + c.normal.x * 30, z: pt.z + c.normal.z * 30 };
  }
  drive(b, dt) {
    const ai = b.ai, c = this.course, W = b.wdir;
    ai.mean += wrap(W - ai.mean) * (1 - Math.exp(-dt / 45));
    b.autoTrim = true;
    if (b.pen) {
      // a penalty: first get clear of marks and boats, then spin
      b.setKite(false);
      const o = this.nearest(b);
      ai.escT = (ai.escT || 0) + dt;
      if (o.d < 24 && ai.escT < 12) { this.steerTo(b, this.sailable(Math.atan2(b.x - o.x, -(b.z - o.z)), W, b.tws)); return; }
      b.rudder = 1; return;
    }
    ai.escT = 0;
    if (b.auto) return;
    // hailed for room to tack (rule 20): she answers by tacking, after a moment's reaction
    const h20 = this.r20;
    if (h20 && h20.hailed === b && !h20.answered && this.clock >= (ai.respondT ?? 0)) { h20.answered = true; ai.lastTack = this.clock; b.tackOrGybe(); return; }
    let tx, tz;
    // her spot on the line: pushed towards the favoured end (the end further upwind, on the wind as she reads it),
    // the more so the better she is and the more it's favoured — so the fleet bunches there
    let lt = ai.lineT;
    if (this.clock < 0) {
      const ux = Math.sin(ai.mean), uz = -Math.cos(ai.mean), bias = ((c.committee.x - c.pin.x) * ux + (c.committee.z - c.pin.z) * uz) / c.len;
      lt = clamp(ai.lineT + sgn(bias) * Math.min(1, Math.abs(bias) / 0.08) * 0.35 * ai.skill, 0.1, 0.9);
      if (ai.port) lt = Math.max(lt, 0.55); // the port-tack boat goes for a gap right of the middle
    }
    const pt = { x: lerp(c.pin.x, c.committee.x, lt), z: lerp(c.pin.z, c.committee.z, lt) };
    if (this.clock < 0) {
      // before the gun: reach to and fro below the line, then time the run at it — on her real speed in this wind,
      // the stream across the line, and the time a boat needs to get going (longer in light air)
      // (close-hauled she closes the line at about cos(beat) of her speed; from a stop she takes some 6 s to get going)
      const vt = polarSpeed(b.tws, beatAngle(b.tws)) * KN, cur = this.currentAt(b.x, b.z), curN = cur.x * c.normal.x + cur.z * c.normal.z;
      const sp = Math.max(0.5, vt * Math.cos(beatAngle(b.tws) * D2R) + curN), lag = 6 * clamp(1 - b.v / vt, 0, 1);
      const eta = Math.hypot(pt.x - b.x, pt.z - b.z) / sp + lag;
      if (!ai.go && -this.clock <= eta + 12 && -this.clock < 80) ai.go = true; // in good time: better to wait near the line than be late
      if (!ai.go) {
        // waiting: to and fro below the line; the port-tack boat waits off the pin end
        // (each round her own part of the line, so the fleet waits spread out; it bunches only on the run in)
        const own = { x: lerp(c.pin.x, c.committee.x, ai.lineT), z: lerp(c.pin.z, c.committee.z, ai.lineT) };
        const home = ai.port ? { x: c.pin.x - 20, z: own.z + 40 } : { x: clamp(own.x + ai.loiter * 35, c.pin.x + 15, c.committee.x - 15), z: own.z + 55 };
        if (Math.hypot(home.x - b.x, home.z - b.z) < 15 && this.tackClear(b)) ai.loiter *= -1; // turn back only with room to
        tx = home.x; tz = home.z;
      } else {
        tx = pt.x + c.normal.x * 30; tz = pt.z + c.normal.z * 30;
        // too early for the distance left: stop and hold her place (luffed, main out — she backs and stays put);
        // under U or the black flag, a few seconds more careful
        // (the sheet well out, the sails flapping: she slows nearly to a stop without going astern). She goes when the
        // time left is what she needs from here, plus a second or two the less sure skippers leave — and under U or the
        // black flag, a few more.
        const dl = -lineD(c, b), need = Math.max(0, dl) / sp + lag, margin = this.prepFlag === 'P' ? 3 * (1 - ai.skill) + ai.dare : 2 + 3 * (1 - ai.skill) + Math.max(0, ai.dare);
        if (this.clock < -1 && dl < 16 + margin * 2 && (-this.clock > need + margin || dl < 1.5 + margin)) {
          // with a boat close to windward she can't luff into it (rule 16): she only lets the sheet go and slows
          const ux = Math.sin(W), uz = -Math.cos(W);
          const crowded = this.boats.some((o) => o !== b && !o.done && Math.hypot(o.x - b.x, o.z - b.z) < 2 * HULL && (o.x - b.x) * ux + (o.z - b.z) * uz > 0);
          if (!crowded) this.steerTo(b, W - 48 * D2R * sgn(b.twa)); else this.steerTo(b, W - Math.max(48 * D2R, Math.abs(b.twa)) * sgn(b.twa)); // never so high that a shift puts her head to wind
          b.autoTrim = false; b.sheet = 0.86; return;
        }
        // hunting: just to leeward of a boat on the same tack, close, she luffs a little to push it up and make room
        // (a few seconds at a time, and only while the other is still there to windward)
        if (this.clock < -4 && Math.abs(b.twa) < 70 * D2R) {
          const o = this.boats.find((o) => o !== b && !o.done && sgn(o.twa) === sgn(b.twa) && Math.hypot(o.x - b.x, o.z - b.z) < 1.6 * HULL && this.rightOfWay(b, o).giver === o);
          if (o && (ai.huntT > this.clock || this.rand() < dt * ai.skill * 0.8)) {
            if (!(ai.huntT > this.clock)) ai.huntT = this.clock + 3 + 3 * this.rand();
            this.steerTo(b, W - sgn(b.twa) * (beatAngle(b.tws) - 8) * D2R); return;
          }
        }
      }
    } else if (b.ocs) { tx = pt.x - c.normal.x * 25; tz = pt.z - c.normal.z * 25; }
    else { const t = this.aiTarget(b); tx = t.x; tz = t.z; }
    // aim off for the stream: steer for a point up-tide of the mark, by as far as the stream will carry her on the way
    // there (the better the skipper, the truer), so the laylines allow for it
    if (this.clock >= 0 && !b.ocs) {
      const cur = this.currentAt(b.x, b.z), eta = Math.min(300, Math.hypot(tx - b.x, tz - b.z) / Math.max(1.5, b.v));
      tx -= cur.x * eta * ai.skill; tz -= cur.z * eta * ai.skill;
    }

    const brg = Math.atan2(tx - b.x, -(tz - b.z)), rel = wrap(brg - W), tack = sgn(b.twa);
    const up = (beatAngle(b.tws) + 1.5 - ai.skill) * D2R, down = runAngle(b.tws, b.kite || b.tws < KITE_MAX) * D2R;
    let want;
    if (Math.abs(rel) < up) {
      // on the beat: tack on the layline, on a header, or to get out of another boat's wind
      const since = this.clock - ai.lastTack;
      const lay = tack > 0 ? rel >= up - 1 * D2R : rel <= -(up - 1 * D2R);
      const shift = wrap(W - ai.mean) / D2R, header = tack > 0 ? shift < -4 : shift > 4;
      ai.dirtyT = b.shadow > 0.12 ? ai.dirtyT + dt : 0;
      const room = Math.abs(rel) < up - 10 * D2R;
      if (since > 12 && (lay || (room && header && this.rand() < ai.skill * 0.02) || (room && ai.dirtyT > 5 && this.rand() < 0.02)) && this.tackClear(b)) {
        ai.lastTack = this.clock; ai.dirtyT = 0; b.tackOrGybe(); return;
      }
      if (this.roomToTack(b, ai)) return;
      // the other tack pays more — more pressure that way, a lift there, a better stream — so she goes; looked at every
      // few seconds, the better skippers seeing it more often
      if (since > 15 && room && this.clock - (ai.evalT ?? -99) > 4) {
        ai.evalT = this.clock;
        const m = this.nextMark(b), pay = (s) => {
          const h = W - s * up, px = b.x + Math.sin(h) * 70, pz = b.z - Math.cos(h) * 70, w = this.wind.at(px, pz);
          const brg = Math.atan2(m.x - px, -(m.z - pz)), cur = this.currentAt(px, pz);
          return polarSpeed(w.tws, beatAngle(w.tws)) * KN * Math.cos(wrap(w.dir - s * up - brg)) + cur.x * Math.sin(brg) - cur.z * Math.cos(brg);
        };
        if (pay(-tack) > pay(tack) * 1.1 + 0.05 && this.rand() < ai.skill * 0.35 && this.tackClear(b)) { ai.lastTack = this.clock; b.tackOrGybe(); return; }
      }
      // cover: well ahead of you on the beat when you tack, she often tacks too, to stay between you and the mark
      const you = this.player;
      if (!you.done && you.leg === b.leg && you.sinceTack < 1.5 && this.clock - (ai.coverT ?? -99) > 10 && since > 8) {
        ai.coverT = this.clock;
        const lead = this.distToNext(you) - this.distToNext(b);
        if (lead > 15 && Math.hypot(you.x - b.x, you.z - b.z) < 150 && sgn(you.twa) !== tack && this.rand() < ai.skill * 0.6 && this.tackClear(b)) { ai.lastTack = this.clock; b.tackOrGybe(); return; }
      }
      // sailing it: a few degrees lower while she's slow, to build speed; in a seaway up the face, down the back
      want = W - tack * (up + (b.stall * ai.skill - 3 * ai.skill * clamp(b.waveN, -1, 1) * clamp(this.wind.p.waves / 0.45, 0, 1)) * D2R);
    } else if (Math.abs(rel) > down) {
      // dead downwind: the best angle on this gybe, the steering below gybes once it can. With the mark off to the
      // other side, as just past the wing mark of a triangle, the other gybe is the one that heads for it: gybe now
      const pastWing = c.legs[b.leg - 1] === 'wing', toward = pastWing && Math.abs(rel) < down + 15 * D2R && b.boom !== -sgn(rel) ? -sgn(rel) : tack;
      want = W - toward * down;
    }
    else want = brg;
    // don't hit a mark: turn to a heading that can be sailed and clears it, or tack if there is none
    const marks = this.obstacles();
    const markClear = (h) => { // the room a heading leaves to the marks ahead (99: none in the way)
      let c = 99;
      for (const [m, r] of marks) { const dx = m.x - b.x, dz = m.z - b.z, al = dx * Math.sin(h) - dz * Math.cos(h); if (al >= -2 && al <= 32) c = Math.min(c, Math.abs(dx * -Math.cos(h) - dz * Math.sin(h)) - r); }
      return c;
    };
    if (markClear(want) <= 5) {
      const opts = [25, -25, 50, -50, 80, -80].map((d) => want + d * D2R).filter((h) => this.canSail(h, W, b.tws));
      const best = opts.sort((p, q) => markClear(q) - markClear(p))[0];
      if (best === undefined || markClear(best) < 3) { if (this.clock - ai.lastTack > 6 && Math.abs(rel) < up + 0.3 && this.tackClear(b)) { ai.lastTack = this.clock; b.tackOrGybe(); return; } if (best !== undefined) want = best; }
      else want = best;
    }
    // keep clear: of the boats it must keep clear of, the most urgent one; and a boat with right of way still alters
    // course when the other isn't keeping clear and contact is close (rule 14). It takes the sailable heading that
    // leaves the most room to every boat near and to the marks (stopping instead only makes her a target).
    if (this.rulesOn) {
      let threat = null;
      for (const o of this.boats) {
        if (o === b || o.done) continue;
        const cp = this.cpa(b, o);
        // how far ahead she looks for trouble: a hail makes her look at once
        const look = this.clock - (ai.alertT ?? -99) < 6 ? 12 : 7 + 3 * ai.skill;
        if (cp.now > 70 || cp.d > 18 || cp.t > look) continue;
        // waiting before the start she simply keeps out of everyone's way, right of way or not
        const waiting = this.clock < 0 && !ai.go, giver = waiting || this.judge(b, o).giver === b;
        if (!giver && !(cp.t < 5 && cp.d < SEP + 4)) continue;
        if (!threat || cp.t < threat.t) threat = { o, t: cp.t, giver };
      }
      if (threat) {
        const near = this.boats.filter((o) => o !== b && !o.done && Math.hypot(o.x - b.x, o.z - b.z) < 70);
        const room = (h) => Math.min(markClear(h) + SEP, ...near.map((o) => this.cpa(b, o, h).d));
        const offs = this.clock < 0 && !ai.go ? [-30, 30, -60, 60, -90, 90, 0] : threat.giver ? [-25, -40, -60, 15, 30, 0] : [-15, 15, -30, 30, 0]; // − bears away, + luffs
        let best = want, bd = -1;
        for (const d of offs) {
          const h = want + tack * d * D2R;
          if (d > 0 && !this.canSail(h, W, b.tws) && Math.abs(rel) >= up) continue; // off the wind, don't luff into the no-go zone
          const r = room(h) - Math.abs(d) * 0.04;
          if (r > bd) { bd = r; best = h; }
        }
        want = best;
      }
    }
    this.steerTo(b, want);
    const a = Math.abs(b.twa) / D2R;
    // the kite goes up on a run in anything short of a near-gale gust, and comes down in one — and in good time
    // before the gate (a drop takes ten seconds or so)
    const kUp = b.kiteJob ? b.kiteJob.up : b.kite, k = c.legs[b.leg];
    const nearGate = k === 'gate' && this.distToNext(b) < 45 + 100 * (1 - ai.skill); // (a finish under the kite is fine)
    let wantKite = nearGate || k === 'mark' || k === 'start' ? false : this.clock > 0 && a > 120 && b.tws < KITE_MAX ? true : a > 100 && b.tws < KITE_MAX + 2 ? kUp : false, type = 'gen';
    // the tight reach out to the wing mark in light air: the code zero, furled again before the gybe there
    // (with the gennaker already up and the mark close, not worth the change)
    if (k === 'wing' && b.tws < 15 && a > 60 && a < 118 && !(b.kite && b.kiteType === 'gen' && this.distToNext(b) < 120)) { type = 'zero'; wantKite = this.clock > 0 && this.distToNext(b) > 30 + 50 * (1 - ai.skill); }
    if (kUp && b.kiteType !== type) wantKite = false; // the other sail is up: down with it first
    if (wantKite !== kUp) b.setKite(wantKite, type);
    // a reef when it blows over 21 knots for a while, shaken out when it eases below 16
    ai.blowT = b.tws > 21.5 ? (ai.blowT || 0) + dt : 0; ai.easeT = b.tws < 16 ? (ai.easeT || 0) + dt : 0;
    if (!b.reef && ai.blowT > 20) b.setReef(true); else if (b.reef && ai.easeT > 30) b.setReef(false);
    if (b.autoTrim) b.sheet = clamp(b.sheet + (this.rand() - 0.5) * (1 - ai.skill) * 0.05, 0, 1);
  }
  // rule 20, room to tack: close-hauled with you close to windward (so she can't tack) and an obstruction ahead — a
  // boat she must keep clear of, or the committee boat — she hails you; you must tack (or give her room), and when
  // you have, or after a few seconds, she tacks. Returns true when she has just tacked.
  roomToTack(b, ai) {
    const h = this.r20;
    if (h && h.hailer === b) {
      const o = h.hailed;
      if (!h.tacked && (o.sinceTack < this.clock - h.t || this.clock - h.t > 4)) { h.tacked = true; ai.lastTack = this.clock; b.tackOrGybe(); return true; }
      return false;
    }
    if (!this.rulesOn || (h && this.clock - h.t < 12) || this.clock - (ai.r20T ?? -99) < 20) return false;
    const o = this.tackBlocker(b);
    if (!o) return false;
    ai.r20T = this.clock;
    this.r20 = { hailer: b, hailed: o, t: this.clock, tacked: false };
    if (o.ai) o.ai.respondT = this.clock + 1 + 2.5 * (1 - o.ai.skill);
    if (o === this.player) { this.say('hail', { who: b.name, rule: '20' }); this.log.hails['20'] = (this.log.hails['20'] || 0) + 1; }
    return false;
  }
  // the boat that stops b tacking: on the same tack, close to windward and not clear astern — when b, close-hauled,
  // has an obstruction ahead (a boat she must keep clear of, or the committee boat). Null if there's none.
  tackBlocker(b) {
    if (b.done || b.tacking || Math.abs(b.twa) > 60 * D2R) return null;
    const fx = Math.sin(b.h), fz = -Math.cos(b.h), ux = Math.sin(b.wdir), uz = -Math.cos(b.wdir); // ahead; towards the wind
    const blocker = this.boats.find((o) => {
      if (o === b || o.done || sgn(o.twa) !== sgn(b.twa) || o.tacking) return false;
      const dx = o.x - b.x, dz = o.z - b.z;
      return Math.hypot(dx, dz) < 2.2 * HULL && dx * ux + dz * uz > 2 && dx * fx + dz * fz > -HULL;
    });
    if (!blocker) return null;
    const cb = this.hardMarks()[4][0], cx = cb.x - b.x, cz = cb.z - b.z, along = cx * fx + cz * fz;
    let blocked = along > 0 && along < 30 && Math.abs(cx * -fz + cz * fx) < 9;
    for (const o of this.boats) {
      if (blocked) break;
      if (o === b || o === blocker || o.done || sgn(o.twa) === sgn(b.twa)) continue;
      const c = this.cpa(b, o);
      blocked = this.rightOfWay(b, o).giver === b && c.t < 8 && c.d < 2 * HALF_B + 3;
    }
    return blocked ? blocker : null;
  }
  // what you could hail now: room to tack, or a boat that must keep clear of you and is on her way into you
  youCanHail() {
    const P = this.player;
    if (!this.rulesOn || P.done) return null;
    const blk = this.tackBlocker(P);
    if (blk && !(this.r20 && this.clock - this.r20.t < 12)) return { rule: '20', o: blk };
    let best = null;
    for (const o of this.boats) {
      if (o === P || o.done) continue;
      const c = this.cpa(P, o);
      if (c.now > 50 || c.t > 8 || c.d > SEP + 6) continue;
      const r = this.judge(P, o);
      if (r.giver === o && (!best || c.t < best.t)) best = { rule: r.rule, o, t: c.t };
    }
    return best;
  }
  // you hail: the boat you hail looks to her duty at once; hailed for room to tack, she tacks (after a moment)
  hail() {
    const h = this.youCanHail();
    this.say('youHail', { rule: h ? h.rule : null });
    if (!h || !h.o.ai) return;
    const ai = h.o.ai;
    ai.alertT = this.clock;
    if (h.rule === '20') { this.r20 = { hailer: this.player, hailed: h.o, t: this.clock, tacked: true }; ai.respondT = this.clock + 1 + 2.5 * (1 - ai.skill); }
  }
  steerTo(b, want) { b.rudder = clamp(wrap(want - b.h) * 2.4 - b.yawRate * 1.1, -1, 1); } // meeting her swing, as she doesn't stop turning at once
  // a tack now wouldn't put her across another boat's bow (rule 13: while tacking she keeps clear of everyone)
  tackClear(b) {
    const h = wrap(b.wdir + b.twa);
    for (const o of this.boats) {
      if (o === b || o.done) continue;
      const d = Math.hypot(o.x - b.x, o.z - b.z);
      if (d > 60) continue;
      if (d < SEP + 8) return false;
      const c = this.cpa(b, o, h);
      if (c.d < SEP + 6 && c.t < 12) return false;
    }
    return true;
  }
  canSail(h, W, tws) { return Math.abs(wrap(h - W)) >= (beatAngle(tws) + 1) * D2R; }
  // the nearest heading to `want` that isn't inside the no-go zone
  sailable(want, W, tws) {
    const rel = wrap(want - W), up = (beatAngle(tws) + 2) * D2R;
    return Math.abs(rel) < up ? W + (rel < 0 ? -1 : 1) * up : want;
  }
  // the marks as they are, for contact: a buoy about a metre across the waterline, the committee boat's hull
  hardMarks() {
    const c = this.course, cb = { x: c.committee.x + c.dir.x * 5, z: c.committee.z + c.dir.z * 5 };
    return [[c.windward, 1], [c.gate[0], 1], [c.gate[1], 1], [c.pin, 1], [cb, 4], ...(c.wing ? [[c.wing, 1]] : [])];
  }
  // and with a margin, for the computer skippers to steer round
  obstacles() {
    const c = this.course, cb = { x: c.committee.x + c.dir.x * 5, z: c.committee.z + c.dir.z * 5 };
    return [[c.windward, 4], [c.gate[0], 4], [c.gate[1], 4], [c.pin, 4], [cb, 8], ...(c.wing ? [[c.wing, 4]] : [])];
  }
  nearest(b) {
    let best = { d: 1e9, x: 0, z: 0 };
    for (const [m, r] of this.obstacles()) { const d = Math.hypot(b.x - m.x, b.z - m.z) - r; if (d < best.d) best = { d, x: m.x, z: m.z }; }
    for (const o of this.boats) { if (o === b) continue; const d = Math.hypot(b.x - o.x, b.z - o.z) - 5; if (d < best.d) best = { d, x: o.x, z: o.z }; }
    return best;
  }
}
