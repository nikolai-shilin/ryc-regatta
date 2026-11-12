// Regatta: the wind, the waves, the boats, the rules and the race — no drawing here (world.js draws, main.js joins).
// Units: metres, seconds, radians. Compass headings: 0 = north, clockwise. World x = east, world z = south.
// The wind "from" W is a compass direction. A boat's true wind angle TWA = wrap(W − heading): positive = wind over
// the starboard side (starboard tack). AWA is the same for the apparent wind, the wind the sails feel.

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
// the slope of the sea along a direction (ux, uz): + uphill
export function waveSlope(W, x, z, t, ux, uz) {
  let s = 0;
  for (const p of W) s += p.A * p.k * (p.dx * ux + p.dz * uz) * Math.cos(p.k * (p.dx * x + p.dz * z) - p.w * t + p.ph);
  return s;
}

// ---------- the boat's speed: a Beneteau First 40.7, knots by true wind speed and angle ----------
// From the class polar (median of 193 official ORC measurements, windregatta.com): jib 52–90°, spinnaker 110–150°.
// Not in the table, estimated: the close-hauled angle and speed (88% of the 52° speed, as on the class's ORC
// targets), and 165° / 180° as a share of the 150° speed — lower in light air, where running deep is slow.
// Downwind figures are with the spinnaker; without it the boat is slower off the wind.
export const NO_GO = 28;
export const HULL = 12.2; // length overall, metres
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
export const idealSail = (awa) => clamp(awa * 0.45 - 2, SHEET_IN, SHEET_OUT);
export const sheetFor = (angle) => clamp((angle - SHEET_IN) / (SHEET_OUT - SHEET_IN), 0, 1);
const HEEL_SIDE = [[0, 0.3], [18, 0.3], [22, 1], [50, 1], [100, 0.5], [180, 0.12]];
// heel with the sails full; above about 24° a good crew eases (depowers) to keep her on her feet
export const fullHeel = (aws, awa, kite) => 24 * (aws / 16) ** 1.4 * table(HEEL_SIDE, awa) + (kite ? 8 * (aws / 16) ** 1.4 : 0);
export const depowerFor = (full) => (full > 24 ? 28 * (1 - 24 / full) : 0);

// ---------- wind ----------
export const PRESETS = {
  light:  { tws: 7,  osc: 12, period: 110, gusts: 7,  gustStr: 0.35, veer: 8,  waves: 0.18 },
  medium: { tws: 12, osc: 13, period: 90,  gusts: 9,  gustStr: 0.33, veer: 10, waves: 0.45 },
  strong: { tws: 19, osc: 14, period: 75,  gusts: 11, gustStr: 0.36, veer: 12, waves: 0.85 },
};

export class Wind {
  constructor(preset, seed = 1, span = 280) {
    this.p = PRESETS[preset] || PRESETS.medium;
    this.span = span; // how far upwind the course goes: the gusts cover it all
    this.rand = rng(seed);
    this.t = 0;
    this.base = 0; // from the north
    this.phase = this.rand() * 6;
    this.drift = (this.rand() - 0.5) * 2 * 4 * D2R / 300; // a persistent shift, up to 4° in five minutes
    this.side = (this.rand() - 0.5) * 2; // which side of the course has more pressure (and a shift with it)
    this.gusts = [];
    const n = Math.round(this.p.gusts * Math.max(1, (span + 620) / 900) * Math.max(1, (span * 0.5 + 500) / 640));
    for (let i = 0; i < n; i++) this.gusts.push(this.newGust(true));
  }
  newGust(anywhere) {
    const r = this.rand;
    return {
      x: (r() - 0.5) * Math.max(700, this.span + 500), z: anywhere ? -(this.span + 420) + r() * (this.span + 620) : -(this.span + 420) - r() * 200,
      r: 45 + r() * 60, s: this.p.gustStr * (0.55 + r() * 0.45),
      veer: (r() - 0.5) * 2 * this.p.veer * D2R, // a gust can lift or head you
      life: 0,
    };
  }
  // the middle the wind swings about: it moves only with the slow persistent drift
  mean() { return this.base + this.drift * this.t; }
  // the direction now: the middle plus the oscillations, a long swing (up to `osc` degrees either way) and a shorter one
  dir() {
    const { osc, period } = this.p, t = this.t;
    return this.mean() + D2R * osc * (0.75 * Math.sin((2 * Math.PI * t) / period + this.phase) + 0.25 * Math.sin((2 * Math.PI * t) / (period * 0.43) + 1.3 * this.phase));
  }
  step(dt) {
    this.t += dt;
    const d = this.dir(), sp = this.p.tws * KN * 0.75;
    const vx = -Math.sin(d) * sp, vz = Math.cos(d) * sp; // gusts ride downwind
    for (let i = 0; i < this.gusts.length; i++) {
      const g = this.gusts[i];
      g.x += vx * dt; g.z += vz * dt; g.life += dt;
      if (g.z > 300) this.gusts[i] = this.newGust(false);
    }
  }
  at(x, z) {
    let extra = 0, veer = 0;
    for (const g of this.gusts) {
      const dx = x - g.x, dz = z - g.z, d2 = dx * dx + dz * dz;
      if (d2 > g.r * g.r) continue;
      const f = 1 - Math.sqrt(d2) / g.r, w = f * f * (3 - 2 * f) * Math.min(1, g.life / 6);
      extra += g.s * w; veer += g.veer * w;
    }
    const sx = clamp(x / 160, -1, 1) * this.side; // more pressure, and a few degrees of shift, on one side
    return { dir: this.dir() + veer + sx * 3 * D2R, tws: this.p.tws * (1 + extra + 0.07 * sx), gust: clamp(extra / this.p.gustStr, 0, 1) };
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
  }
  get tacking() { return (this.auto && !this.auto.gybe) || Math.abs(this.twa) < NO_GO * D2R; }
  tackOrGybe() {
    if (this.auto || this.pen) return;
    const newH = this.wdir + this.twa, d = wrap(newH - this.h), gybe = Math.abs(this.twa) > 95 * D2R;
    this.auto = { to: newH, dir: sgn(d), gybe };
    this.events.push(gybe ? 'gybing' : 'tacking');
  }
  step(dt, race) {
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

    if (this.kite && a < 80) { this.kite = false; this.events.push('kitedown'); }

    // sails
    const full = fullHeel(this.aws, awa, this.kite), ease = depowerFor(full);
    this.depower = ease;
    const ideal = idealSail(awa);
    if (this.autoTrim) this.sheet = lerp(this.sheet, sheetFor(ideal + ease), 1 - Math.exp(-dt * 3));
    const sheetAngle = lerp(SHEET_IN, SHEET_OUT, this.sheet);
    const err = sheetAngle - ideal; // + let out too far (flapping), − pulled in too hard (stalled)
    this.trimErr = err;
    this.sail = Math.min(sheetAngle, Math.max(awa - 2, 2));
    this.luff = a < NO_GO ? 1 : clamp((err - ease - 5) / 18, 0, 1);
    this.trim = a < NO_GO ? 'irons' : err > ease + 7 ? 'in' : err < -7 ? 'out' : 'ok';
    // with the gennaker up the crew trims it and it does most of the driving, so a badly trimmed main costs far less
    const kiteK = this.kite ? 0.7 : 0;
    const eff = lerp(clamp(err > 0 ? 1 - (err / 28) ** 2 : 1 - (err / 35) ** 2, err > 0 ? 0.08 : 0.25, 1), 1, kiteK);
    this.eff = eff;
    const power = lerp(err > 0 ? clamp(1 - err / 28, 0.05, 1) : 1 + -err / 80, 1, kiteK);

    // heel
    this.heel = lerp(this.heel, full * power, 1 - Math.exp(-dt / 1.1));
    const heelPen = clamp(1 - (this.heel - 25) / 45, 0.3, 1);

    // the sea: upwind it knocks her back, downwind in a breeze she surfs
    const W = race.waves;
    const slope = W ? waveSlope(W, this.x, this.z, race.t, fx, fz) : 0;
    this.slope = slope;
    const chop = 1 - race.wind.p.waves * 0.07 * clamp((70 - a) / 30, 0, 1);

    // speed: the target from the polar, and momentum to get there
    this.polar = polarSpeed(w.tws, a, this.kite || a < 100);
    let target = polarSpeed(w.tws, a, this.kite) * eff * heelPen * chop * KN;
    if (this.broachT > 0) { target *= 0.35; this.broachT -= dt; }
    this.target = target;
    const tau = target > this.v ? 6 : a < NO_GO ? 3 : this.v > target * 1.2 ? 2 : 4.5; // above hull speed the drag bites
    this.v += (target - this.v) * (1 - Math.exp(-dt / tau));
    this.v -= 9.81 * slope * 0.3 * dt;
    this.surf = 0;
    if (a > 110 && w.tws > 13 && slope < 0 && this.v > 3 && this.v < target * 1.4) { const s = -slope * 9.81 * 0.35 * dt; this.v += s; this.surf = s / dt; }
    this.v = Math.max(0, this.v);

    // steering: the button's tack or gybe drives the rudder; a penalty turn spins her round
    if (this.auto) {
      const left = wrap(this.auto.to - this.h);
      this.auto.t = (this.auto.t || 0) + dt;
      if (Math.abs(left) < 3 * D2R || sgn(left) !== this.auto.dir || this.auto.t > 9) { this.auto = null; this.rudder = 0; this.events.push('tacked'); }
      else this.rudder = this.auto.dir * clamp(Math.abs(left) / (25 * D2R), 0.35, 1);
    }
    let rud = this.rudder;
    if (this.heel > 40) rud *= 0.5;
    const grip = clamp(0.55 + this.v / 3, 0.55, 1.25);
    let yaw = rud * 0.42 * grip;
    if (this.heel > 35) yaw += side * Math.min((this.heel - 35) / 20, 1.2) * 0.22; // weather helm rounds her up
    if (a < NO_GO && this.v < 0.8 && !this.auto && !this.pen) yaw -= side * 0.18; // stopped head to wind, the bow blows off
    this.yaw = yaw;
    const prevH = this.h;
    this.h = wrap(this.h + yaw * dt);
    if (this.pen) {
      this.pen.sum += wrap(this.h - prevH);
      if (Math.abs(this.pen.sum) >= this.pen.turns * 2 * Math.PI - 0.15) { this.pen = null; this.events.push('penaltyDone'); }
    }
    this.v = Math.max(0, this.v - Math.abs(yaw) * this.v * 0.1 * dt - Math.abs(this.rudder) * this.v * 0.06 * dt);

    if (this.heel > 52 && this.broachT <= 0) { this.broachT = 2.5; this.events.push('broach'); this.kite = false; }

    // leeway: sideways slip, worst when slow and close to the wind; drift when stopped; and the current
    const leeDeg = a < 100 ? (2.5 + 6 * clamp(1 - this.v / 2.5, 0, 1)) * clamp((100 - a) / 50, 0, 1) : 0;
    const lee = this.v * Math.tan(leeDeg * D2R) + (this.v < 1 ? 0.12 * w.tws / 12 : 0);
    const rx = Math.cos(this.h), rz = Math.sin(this.h); // starboard
    const cur = race.current;
    this.x += (fx * this.v - side * rx * lee + cur.x) * dt;
    this.z += (fz * this.v - side * rz * lee + cur.z) * dt;
  }
}

// ---------- the course ----------
export function makeCourse(laps, beat, bias, fleet = 4) {
  const half = Math.max(70, fleet * 10), dx = Math.cos(bias), dz = Math.sin(bias); // the line: some 1.6 boat lengths a boat
  return {
    laps,
    // the line, skewed by `bias`: bias > 0 puts the pin end further upwind (pin favoured)
    pin: { x: -half * dx, z: -half * dz }, committee: { x: half * dx, z: half * dz },
    dir: { x: dx, z: dz }, normal: { x: dz, z: -dx }, // along the line (pin → boat), and towards the course
    len: 2 * half,
    windward: { x: 0, z: -beat },
    gate: fleet > 5 ? [{ x: -27, z: -50 }, { x: 27, z: -50 }] : [{ x: -22, z: -45 }, { x: 22, z: -45 }],
    legs: ['start', ...Array.from({ length: laps }, (_, i) => (i < laps - 1 ? ['mark', 'gate'] : ['mark'])).flat(), 'finish'],
  };
}
// the fleet you race against (names and the colour on the map), and how long the course is
export const FLEET = [['Aurora', 0xc0392b], ['Kestrel', 0x1e8449], ['Nomad', 0xd4ac0d], ['Halcyon', 0x2e86de], ['Mistral', 0x8e44ad],
  ['Selkie', 0x16a085], ['Tern', 0xe67e22], ['Vela', 0xe84393], ['Zephyr', 0x7f8c8d]];
export const COURSE_LEN = { short: 1, medium: 2, long: 3.4 };
export const ZONE = 3 * HULL; // the zone round a mark: three hull lengths
const SEP = HULL * 0.78; // two boats' centres can't come closer than this
const KITE_MAX = 26; // the computer boats fly the kite below this true wind speed (knots)
const lineD = (c, b) => (b.x - c.pin.x) * c.normal.x + (b.z - c.pin.z) * c.normal.z; // + above the line
const lineT = (c, b) => ((b.x - c.pin.x) * c.dir.x + (b.z - c.pin.z) * c.dir.z) / c.len;

// the daily race: the same course and wind for everyone on a given day (UTC), made from the date
export function dailyRace(date = new Date()) {
  const day = date.toISOString().slice(0, 10), n = Math.floor(Date.parse(day) / 864e5), r = rng(n * 2654435761);
  r(); r();
  return { day, seed: (n * 7919) % 100000, preset: ['light', 'medium', 'strong'][Math.floor(r() * 3)], fleet: 5, length: 'short', laps: 1, start: 1, current: r() < 0.3 ? 1 : 0 };
}

// the start sequence: the class flag goes up at the warning signal, P at the preparatory, P down at one minute
const SEQUENCES = {
  1: [{ t: -60, cls: true, P: false, sound: 'long', key: 'sig1' }, { t: 0, cls: false, P: false, sound: 'horn', key: 'gun' }],
  3: [{ t: -180, cls: true, P: false, sound: 'horn', key: 'sigWarn' }, { t: -120, cls: true, P: true, sound: 'horn', key: 'sigPrep' }, { t: -60, cls: true, P: false, sound: 'long', key: 'sig1' }, { t: 0, cls: false, P: false, sound: 'horn', key: 'gun' }],
  5: [{ t: -300, cls: true, P: false, sound: 'horn', key: 'sigWarn' }, { t: -240, cls: true, P: true, sound: 'horn', key: 'sigPrep' }, { t: -60, cls: true, P: false, sound: 'long', key: 'sig1' }, { t: 0, cls: false, P: false, sound: 'horn', key: 'gun' }],
};

// ---------- the race ----------
export class Race {
  constructor({ preset = 'medium', laps = 1, autoTrim = false, seed = Date.now() % 100000, start = 1, current = false, fleet = 4, length = 'short' } = {}) {
    this.rand = rng(seed + 7);
    const beatLen = ({ light: 200, medium: 260, strong: 280 }[preset] || 260) * (COURSE_LEN[length] || 1);
    this.wind = new Wind(preset, seed, beatLen);
    const bias = (this.rand() - 0.5) * 2 * 8 * D2R;
    fleet = clamp(Math.round(fleet), 2, FLEET.length + 1);
    this.course = makeCourse(laps, beatLen, bias, fleet);
    this.seq = SEQUENCES[start] || SEQUENCES[1];
    this.clock = this.seq[0].t - (start === 1 ? 4 : 8); // negative before the gun
    this.sigI = 0;
    this.flags = { cls: start === 1, P: false, X: false };
    if (start === 1) this.flags.P = true;
    this.t = 0; // time for the waves
    this.waves = makeWaves(this.wind.p.waves, this.wind.dir());
    const ca = this.rand() < 0.5 ? 1 : -1;
    this.current = current ? { x: ca * 0.6 * KN * Math.cos(0.3), z: 0.6 * KN * Math.sin(0.3) * (this.rand() < 0.5 ? 1 : -1) } : { x: 0, z: 0 };
    const W = this.wind.dir(), beat = beatAngle(this.wind.p.tws);
    const half = this.course.len / 2;
    this.player = new Boat({ name: 'You', x: 25, z: fleet > 4 ? 78 : 95, h: wrap(W - beat * D2R), v: 2, autoTrim });
    const full = fullHeel(this.wind.p.tws * 1.4, 28, false);
    this.player.sheet = sheetFor(idealSail(28) + depowerFor(full));
    const fl = FLEET.slice(0, fleet - 1), n = fl.length;
    this.boats = [this.player];
    fl.forEach(([name, color], i) => {
      const f = n > 1 ? i / (n - 1) : 0.5; // spread them along below the line
      const b = new Boat({ name, x: lerp(-half - 10, half - 10, f) + (i % 2 ? 8 : -8), z: 105 + (i % 3) * 18, h: wrap(W + (i % 2 ? 90 : -90) * D2R), v: 2, autoTrim: true });
      b.ai = { skill: 0.8 + this.rand() * 0.18, lineT: clamp(0.15 + f * 0.7 + (this.rand() - 0.5) * 0.08, 0.15, 0.85) /* clear of the ends, where the pin and the committee boat catch them */, lastTack: -999, go: false, mean: W, dirtyT: 0, hailT: -99, wp: 0, loiter: i % 2 ? 1 : -1 };
      b.color = color;
      this.boats.push(b);
    });
    for (const b of this.boats) Object.assign(b, { leg: 0, ocs: false, done: false, finish: null, track: [], lastD: lineD(this.course, b), lastZ: b.z, rnd: null, dsq: false, touchT: 0 });
    this.trackT = 0;
    this.messages = [];
    this.over = false;
    this.zoneStates = new Map();
    // the player's race, for the debrief on the results: the start, speed against target, dirty air, the tacks against
    // the wind's swings, the fouls and hails, and the time spent on penalties
    this.log = { gunD: null, gunV: null, ocs: false, startT: null, legs: [], v: 0, polar: 0, sailing: 0, dirty: 0, tacks: [], gybes: 0, fouls: [], hails: {}, penT: 0, leg: 0, auto: false };
  }
  say(key, arg) { this.messages.push({ key, arg }); }
  record(dt, before) {
    const P = this.player, L = this.log;
    if (before < 0 && this.clock >= 0) { L.gunD = -lineD(this.course, P); L.gunV = P.v / KN; L.ocs = P.ocs; }
    if (P.leg !== L.leg) { L.leg = P.leg; L.legs.push(this.clock); if (P.leg === 1) L.startT = this.clock; }
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
    deficit = Math.min(deficit, 0.45);
    return { dir: w.dir + bend, tws: w.tws * (1 - deficit), gust: w.gust, shadow: deficit };
  }

  idle(dt) { this.t += dt; }

  step(dt) {
    const before = this.clock;
    this.clock += dt; this.t += dt;
    this.wind.step(dt);
    while (this.sigI < this.seq.length && this.clock >= this.seq[this.sigI].t) {
      const s = this.seq[this.sigI++];
      this.flags.cls = s.cls; this.flags.P = s.P;
      this.say('signal', s);
    }
    for (const b of this.boats) if (b.ai && !b.done) this.drive(b, dt);
    for (const b of this.boats) b.step(dt, this);
    this.collide(dt);
    if (before < 0 && this.clock >= 0) {
      const c = this.course;
      for (const b of this.boats) { const t = lineT(c, b); if (lineD(c, b) > 0 && t > -0.2 && t < 1.2) { b.ocs = true; this.flags.X = true; if (b === this.player) this.say('ocs'); } }
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
          if (b.rnd > 0 && side <= 0) { b.leg++; b.rnd = null; if (b.ai) b.ai.wp = 0; if (b === this.player) this.say('rounded'); b.lastD = d; b.lastZ = b.z; return; }
          if (b.rnd < 0 && side > 0 && b === this.player) this.say('wrongSide'); // went over it the wrong way
        }
        b.rnd = side;
      } else if (k === 'gate' && b.lastZ <= c.gate[0].z && b.z > c.gate[0].z) {
        if (b.x > c.gate[0].x - 3 && b.x < c.gate[1].x + 3) { b.leg++; if (b.ai) b.ai.wp = 0; if (b === this.player) this.say('gate'); }
        else if (b === this.player) this.say('missedGate'); // outside the buoys: doesn't count
      }
      else if (k === 'finish' && b.lastD > 0 && d <= 0 && on) {
        b.done = true; b.finish = this.clock; b.track.push([b.x, b.z]);
        if (b.pen) { b.dsq = true; b.pen = null; } // didn't take the penalty
        b.place = b.dsq ? null : this.boats.filter((o) => o.done && !o.dsq).length;
        if (b === this.player) { this.say(b.dsq ? 'finishedDsq' : 'finished', b.place); this.over = true; }
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
    if (k === 'gate') return { x: 0, z: c.gate[0].z };
    return { x: (c.pin.x + c.committee.x) / 2, z: (c.pin.z + c.committee.z) / 2 };
  }
  distToNext(b) { const m = this.nextMark(b); return Math.hypot(m.x - b.x, m.z - b.z); }
  lineInfo(b) { const c = this.course; return { d: lineD(c, b), t: lineT(c, b) }; }

  // ---------- right of way (RRS Part 2, simplified) ----------
  // who must keep clear of whom, and the rule that says so
  rightOfWay(p, q) {
    if (p.pen && !q.pen) return { giver: p, rule: '44' };
    if (q.pen && !p.pen) return { giver: q, rule: '44' };
    const zs = this.zoneOf(p, q); // mark-room (rule 18), settled when the first of them reached the zone
    if (zs) return { giver: zs.entitled === p ? q : p, rule: '18' };
    if (p.tacking !== q.tacking) return { giver: p.tacking ? p : q, rule: '13' };
    const sp = sgn(p.twa), sq = sgn(q.twa);
    if (sp !== sq) return { giver: sp < 0 ? p : q, rule: '10' };
    // same tack: not overlapped → the boat clear astern keeps clear; overlapped → the windward boat
    if (!this.overlapped(p, q)) return { giver: this.clearAhead(p, q) === p ? q : p, rule: '12' };
    const ux = Math.sin(p.wdir), uz = -Math.cos(p.wdir); // towards the wind
    return { giver: p.x * ux + p.z * uz > q.x * ux + q.z * uz ? p : q, rule: '11' };
  }
  // overlapped: neither is clear astern of the other (within a hull length, measured along p's course)
  overlapped(p, q) { const fx = Math.sin(p.h), fz = -Math.cos(p.h); return Math.abs((q.x - p.x) * fx + (q.z - p.z) * fz) < HULL; }
  clearAhead(p, q) { const fx = Math.sin(p.h), fz = -Math.cos(p.h); return (q.x - p.x) * fx + (q.z - p.z) * fz > 0 ? q : p; }
  // Rule 18: when the first of two boats reaches the zone (three lengths from the mark), it is settled who gets
  // mark-room — the inside boat if they are overlapped then, the boat clear ahead if not — and that holds until both
  // have left. Between boats on opposite tacks on a beat to the windward mark rule 18 doesn't apply (18.1(a)).
  zones() {
    const bs = this.boats, c = this.course;
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const p = bs[i], q = bs[j], key = i * 16 + j, st = this.zoneStates.get(key), k = c.legs[p.leg];
      if (p.leg !== q.leg || (k !== 'mark' && k !== 'gate') || p.done || q.done) { if (st) this.zoneStates.delete(key); continue; }
      const m = this.nextMark(p), dp = Math.hypot(p.x - m.x, p.z - m.z), dq = Math.hypot(q.x - m.x, q.z - m.z);
      if (st) { if (dp > ZONE + 10 && dq > ZONE + 10) this.zoneStates.delete(key); continue; }
      if ((dp < ZONE || dq < ZONE) && Math.hypot(p.x - q.x, p.z - q.z) < 3 * HULL) {
        if (k === 'mark' && sgn(p.twa) !== sgn(q.twa)) continue;
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
      const r = this.rightOfWay(P, o);
      if (r.giver === P && this.clock - o.ai.hailT > 7) { o.ai.hailT = this.clock; this.say('hail', { who: o.name, rule: r.rule }); this.log.hails[r.rule] = (this.log.hails[r.rule] || 0) + 1; }
    }
  }
  // contact: the boat that should have kept clear takes a two-turns penalty (rule 44.2)
  foul(p, q) {
    const r = this.rightOfWay(p, q), g = r.giver, other = g === p ? q : p;
    if (g.pen || g.done) return;
    g.pen = { turns: 2, sum: 0 };
    if (g === this.player) { this.say('fouled', { who: other.name, rule: r.rule }); this.log.fouls.push({ rule: r.rule, who: other.name }); }
    else if (other === this.player) this.say('theyFouled', { who: g.name, rule: r.rule });
  }

  collide(dt) {
    const bs = this.boats, c = this.course;
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const p = bs[i], q = bs[j], dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d < SEP && d > 0.01) {
        const push = (SEP - d) / 2, nx = dx / d, nz = dz / d;
        p.x -= nx * push; p.z -= nz * push; q.x += nx * push; q.z += nz * push;
        if (p.hit <= 0 && q.hit <= 0) {
          p.v *= 0.75; q.v *= 0.75;
          if (p === this.player || q === this.player) this.say('bump');
          if (this.rulesOn && !p.done && !q.done) this.foul(p, q);
        }
        p.hit = q.hit = 2;
      }
    }
    const marks = this.obstacles();
    for (const b of bs) {
      b.hit -= dt; b.touchT -= dt;
      for (const [m, r] of marks) {
        const dx = b.x - m.x, dz = b.z - m.z, d = Math.hypot(dx, dz);
        if (d < r && d > 0.01) {
          b.x = m.x + (dx / d) * r; b.z = m.z + (dz / d) * r; b.v *= 0.9;
          // touching a mark: a one-turn penalty (rules 31 and 44.2)
          if (b.touchT <= 0 && !b.pen && !b.done && this.rulesOn) { b.pen = { turns: 1, sum: 0 }; if (b === this.player) { this.say('touched'); this.log.fouls.push({ rule: '31' }); } }
          b.touchT = 3;
        }
      }
    }
  }

  // ---------- the computer skippers ----------
  aiTarget(b) {
    const c = this.course, k = c.legs[b.leg], ai = b.ai;
    if (k === 'mark') {
      const m = c.windward;
      // round it to port: come in on its east side with room to spare, cross above it, leave on the west side
      // a boat that owes another mark-room (rule 18) goes round outside it, wider and a little later
      const wide = this.owesRoom(b) ? 1 : 0;
      const w0 = { x: m.x + 10 + wide * 12, z: m.z - 9 - wide * 8 }, w1 = { x: m.x - 14 - wide * 6, z: m.z - 10 - wide * 6 };
      if (ai.wp === 0 && b.z < m.z - 4 && b.x > m.x - 3) ai.wp = 1; // clearly above it: now bear away across the top
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
      b.kite = false;
      const o = this.nearest(b);
      ai.escT = (ai.escT || 0) + dt;
      if (o.d < 24 && ai.escT < 12) { this.steerTo(b, this.sailable(Math.atan2(b.x - o.x, -(b.z - o.z)), W, b.tws)); return; }
      b.rudder = 1; return;
    }
    ai.escT = 0;
    if (b.auto) return;
    let tx, tz;
    const pt = { x: lerp(c.pin.x, c.committee.x, ai.lineT), z: lerp(c.pin.z, c.committee.z, ai.lineT) };
    if (this.clock < 0) {
      // before the gun: reach to and fro below the line, then time the run at it
      const beatV = polarSpeed(b.tws, beatAngle(b.tws)) * KN;
      const eta = Math.hypot(pt.x - b.x, pt.z - b.z) / (beatV * 0.8) + 5;
      if (!ai.go && -this.clock <= eta + 6 * (1 - ai.skill) && -this.clock < 80) ai.go = true;
      if (!ai.go) {
        const home = { x: clamp(pt.x + ai.loiter * 35, c.pin.x + 15, c.committee.x - 15), z: pt.z + 55 };
        if (Math.hypot(home.x - b.x, home.z - b.z) < 15) ai.loiter *= -1;
        tx = home.x; tz = home.z;
      } else {
        tx = pt.x + c.normal.x * 30; tz = pt.z + c.normal.z * 30;
        if (lineD(c, b) > -9 && this.clock < -1) { this.steerTo(b, W - 40 * D2R * sgn(b.twa)); b.autoTrim = false; b.sheet = 1; return; } // early: luff and wait
      }
    } else if (b.ocs) { tx = pt.x - c.normal.x * 25; tz = pt.z - c.normal.z * 25; }
    else { const t = this.aiTarget(b); tx = t.x; tz = t.z; }

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
      want = W - tack * up;
    } else if (Math.abs(rel) > down) want = W - tack * down; // dead downwind: the best angle; the steering below gybes once it can
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
        if (cp.now > 70 || cp.d > 18 || cp.t > 10) continue;
        const giver = this.rightOfWay(b, o).giver === b;
        if (!giver && !(cp.t < 5 && cp.d < SEP + 4)) continue;
        if (!threat || cp.t < threat.t) threat = { o, t: cp.t, giver };
      }
      if (threat) {
        const near = this.boats.filter((o) => o !== b && !o.done && Math.hypot(o.x - b.x, o.z - b.z) < 70);
        const room = (h) => Math.min(markClear(h) + SEP, ...near.map((o) => this.cpa(b, o, h).d));
        const offs = threat.giver ? [-25, -40, -60, 15, 30, 0] : [-15, 15, -30, 30, 0]; // − bears away, + luffs
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
    // the kite goes up on a run in anything short of a near-gale gust, and comes down in one
    b.kite = this.clock > 0 && a > 110 && b.tws < KITE_MAX ? true : a > 100 && b.tws < KITE_MAX + 2 ? b.kite : false;
    if (b.autoTrim) b.sheet = clamp(b.sheet + (this.rand() - 0.5) * (1 - ai.skill) * 0.05, 0, 1);
  }
  steerTo(b, want) { b.rudder = clamp(wrap(want - b.h) * 2.4, -1, 1); }
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
  obstacles() {
    const c = this.course, cb = { x: c.committee.x + c.dir.x * 5, z: c.committee.z + c.dir.z * 5 };
    return [[c.windward, 4], [c.gate[0], 4], [c.gate[1], 4], [c.pin, 4], [cb, 8]];
  }
  nearest(b) {
    let best = { d: 1e9, x: 0, z: 0 };
    for (const [m, r] of this.obstacles()) { const d = Math.hypot(b.x - m.x, b.z - m.z) - r; if (d < best.d) best = { d, x: m.x, z: m.z }; }
    for (const o of this.boats) { if (o === b) continue; const d = Math.hypot(b.x - o.x, b.z - o.z) - 5; if (d < best.d) best = { d, x: o.x, z: o.z }; }
    return best;
  }
}
