// Regatta: the wind, the boats and the race, with no drawing (world.js draws, main.js joins them up).
// Units: metres, seconds, radians. Compass headings: 0 = north, clockwise. World x = east, world z = south.
// The wind "from" W is a compass direction; a boat's true wind angle TWA = wrap(W − heading):
// positive = wind over the starboard side (starboard tack), negative = port tack.

export const KN = 0.514444; // m/s per knot
export const D2R = Math.PI / 180;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const wrap = (a) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
const sgn = (v) => (v < 0 ? -1 : 1);
// piecewise-linear lookup in a table of [x, y]
const table = (t, x) => {
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (x <= t[i][0]) return lerp(t[i - 1][1], t[i][1], (x - t[i - 1][0]) / (t[i][0] - t[i - 1][0]));
  return t[t.length - 1][1];
};

// ---------- wind ----------
export const PRESETS = {
  light:  { tws: 6,  shift: 6,  period: 95, gusts: 7,  gustStr: 0.35, veer: 5, waves: 0.18 },
  medium: { tws: 12, shift: 8,  period: 80, gusts: 9,  gustStr: 0.33, veer: 7, waves: 0.45 },
  strong: { tws: 19, shift: 10, period: 70, gusts: 11, gustStr: 0.38, veer: 9, waves: 0.85 },
};

// A small seeded random, so a race can be replayed with the same wind.
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

export class Wind {
  constructor(preset, seed = 1) {
    this.p = PRESETS[preset] || PRESETS.medium;
    this.rand = rng(seed);
    this.t = 0;
    this.base = 0; // from the north
    this.phase = this.rand() * 6;
    this.gusts = [];
    for (let i = 0; i < this.p.gusts; i++) this.gusts.push(this.newGust(true));
  }
  newGust(anywhere) {
    const r = this.rand;
    return {
      x: (r() - 0.5) * 700,
      z: anywhere ? -650 + r() * 850 : -700 - r() * 200,
      r: 45 + r() * 55,
      s: this.p.gustStr * (0.55 + r() * 0.45), // extra speed, as a fraction
      veer: (r() - 0.5) * 2 * this.p.veer * D2R,
      life: 0,
    };
  }
  // the mean direction now (the slow shifts)
  dir() {
    const { shift, period } = this.p, t = this.t;
    return this.base + D2R * shift * (0.7 * Math.sin((2 * Math.PI * t) / period + this.phase) + 0.3 * Math.sin((2 * Math.PI * t) / (period * 0.43) + 1.3 * this.phase));
  }
  step(dt) {
    this.t += dt;
    // gusts ride downwind a bit slower than the wind itself, and fade in and out
    const d = this.dir(), sp = this.p.tws * KN * 0.75;
    const vx = -Math.sin(d) * sp, vz = Math.cos(d) * sp; // blowing towards W+π
    for (let i = 0; i < this.gusts.length; i++) {
      const g = this.gusts[i];
      g.x += vx * dt; g.z += vz * dt; g.life += dt;
      if (g.z > 300) this.gusts[i] = this.newGust(false);
    }
  }
  // wind at a point: { dir (from), tws (knots), gust 0..1 }
  at(x, z) {
    let extra = 0, veer = 0;
    for (const g of this.gusts) {
      const dx = x - g.x, dz = z - g.z, d2 = dx * dx + dz * dz;
      if (d2 > g.r * g.r) continue;
      const f = 1 - Math.sqrt(d2) / g.r, w = f * f * (3 - 2 * f) * Math.min(1, g.life / 6);
      extra += g.s * w; veer += g.veer * w;
    }
    return { dir: this.dir() + veer, tws: this.p.tws * (1 + extra), gust: clamp(extra / this.p.gustStr, 0, 1) };
  }
}

// ---------- the boat ----------
// A 10 m cruiser-racer. Polar: the share of the top speed at each true wind angle (degrees).
const POLAR = [[0, 0], [28, 0], [34, 0.45], [40, 0.72], [52, 0.86], [95, 1], [140, 0.95], [180, 0.78]];
const HEEL_SIDE = [[0, 0.3], [28, 0.3], [32, 1], [60, 1], [110, 0.5], [180, 0.15]];
export const NO_GO = 30; // degrees: closer than this to the wind the sails only flap
export const UP_TWA = 43, DOWN_TWA = 150; // the angles the computer boats aim for
const vmax = (tws) => 7.6 * (1 - Math.exp(-tws / 6.5)); // knots, the hull speed caps it
const SHEET_IN = 9, SHEET_OUT = 85; // sail angle off the centreline with the sheet all the way in / out
// the best sail angle for a true wind angle (degrees)
export const idealSail = (a) => clamp(a * 0.5 - 8, SHEET_IN, SHEET_OUT);
export const sheetFor = (angle) => clamp((angle - SHEET_IN) / (SHEET_OUT - SHEET_IN), 0, 1);

export class Boat {
  constructor(o = {}) {
    this.name = o.name || 'You';
    this.x = o.x || 0; this.z = o.z || 0;
    this.h = o.h || 0; // heading
    this.v = o.v || 0; // speed through the water, m/s
    this.heel = 0; // degrees, always ≥ 0 (the side follows the tack)
    this.rudder = 0; // −1 … 1, + turns to starboard
    this.sheet = 0.2; // 0 all in … 1 all out
    this.autoTrim = !!o.autoTrim;
    this.kite = false;
    this.auto = null; // a tack or gybe the button started
    this.yaw = 0;
    // read-outs for the screen
    this.twa = 0; this.tws = 0; this.wdir = 0; this.gust = 0; this.sail = 0; this.trim = 'ok'; this.trimErr = 0;
    this.luff = 0; this.eff = 1; this.target = 0; this.depower = 0;
    this.events = []; // 'broach', 'kitedown', 'tacked'
    this.broachT = 0;
    this.hit = 0;
  }
  // start a tack (upwind) or a gybe (downwind): turn to the same angle on the other side
  tackOrGybe() {
    if (this.auto) return;
    const newH = this.wdir + this.twa;
    const d = wrap(newH - this.h);
    this.auto = { to: newH, dir: sgn(d), gybe: Math.abs(this.twa) > 95 * D2R };
  }
  step(dt, wind) {
    const w = wind.at(this.x, this.z);
    this.wdir = w.dir; this.tws = w.tws; this.gust = w.gust;
    const twa = wrap(w.dir - this.h), a = Math.abs(twa) / D2R, side = sgn(twa);
    this.twa = twa;

    // the kite flies only off the wind
    if (this.kite && a < 80) { this.kite = false; this.events.push('kitedown'); }

    // sails
    // in a breeze a good trimmer eases to keep her on her feet (about 24° of heel): that much extra ease is still "right"
    const full = 24 * (w.tws / 12) ** 1.4 * table(HEEL_SIDE, a) + (this.kite ? 12 : 0);
    const ease = full > 24 ? 28 * (1 - 24 / full) : 0;
    this.depower = ease;
    if (this.autoTrim) this.sheet = lerp(this.sheet, sheetFor(idealSail(a) + ease), 1 - Math.exp(-dt * 3));
    const sheetAngle = lerp(SHEET_IN, SHEET_OUT, this.sheet);
    const ideal = idealSail(a);
    const err = sheetAngle - ideal; // + let out too far (flapping), − pulled in too hard (stalled)
    this.trimErr = err;
    this.sail = Math.min(sheetAngle, Math.max(a - 2, 3)); // the sail can't go past the wind
    this.luff = a < NO_GO ? 1 : clamp((err - 6) / 20, 0, 1);
    this.trim = a < NO_GO ? 'irons' : err > ease + 7 ? 'in' : err < -7 ? 'out' : 'ok';
    let eff = err > 0 ? 1 - (err / 28) ** 2 : 1 - (err / 35) ** 2;
    eff = clamp(eff, err > 0 ? 0.08 : 0.25, 1);
    const power = err > 0 ? clamp(1 - err / 28, 0.05, 1) : 1 + -err / 80;

    // heel: more wind, more heel; ease the sheet or head up to stand her up
    let heelT = 24 * (w.tws / 12) ** 1.4 * table(HEEL_SIDE, a) * power;
    if (this.kite) heelT += 10 * (w.tws / 12) ** 1.4 * (a < 120 ? 1.4 : 0.8);
    this.heel = lerp(this.heel, heelT, 1 - Math.exp(-dt / 1.1));
    const heelPen = clamp(1 - (this.heel - 25) / 45, 0.3, 1);

    // speed
    let kiteF = 1;
    if (this.kite) kiteF = a >= 95 && a <= 172 ? 1.2 : 1.05;
    let target = vmax(w.tws) * table(POLAR, a) * eff * heelPen * kiteF * KN;
    if (this.broachT > 0) { target *= 0.35; this.broachT -= dt; }
    this.target = target; this.eff = eff;
    const tau = target > this.v ? 5 : a < NO_GO ? 2.6 : 3.5;
    this.v += (target - this.v) * (1 - Math.exp(-dt / tau));

    // steering: the button's tack or gybe drives the rudder until she's round
    if (this.auto) {
      const left = wrap(this.auto.to - this.h);
      this.auto.t = (this.auto.t || 0) + dt;
      if (Math.abs(left) < 3 * D2R || sgn(left) !== this.auto.dir || this.auto.t > 8) { this.auto = null; this.rudder = 0; this.events.push('tacked'); }
      else this.rudder = this.auto.dir * clamp(Math.abs(left) / (25 * D2R), 0.35, 1);
    }
    let rud = this.rudder;
    if (this.heel > 40) rud *= 0.5; // a boat on her ear doesn't answer the helm
    const grip = clamp(0.45 + this.v / 3, 0.45, 1.25);
    let yaw = rud * 0.42 * grip;
    // too much heel rounds her up into the wind
    if (this.heel > 35) yaw += side * Math.min((this.heel - 35) / 20, 1.2) * 0.22;
    // stopped head to wind, the bow blows off
    if (a < NO_GO && this.v < 0.8 && !this.auto) yaw -= side * 0.18;
    this.yaw = yaw;
    this.h = wrap(this.h + yaw * dt);
    this.v = Math.max(0, this.v - Math.abs(yaw) * this.v * 0.1 * dt);
    if (a < NO_GO && this.v < 0.3) this.v = Math.max(0, this.v); // in irons she stops

    // a big gust with the sheet in: broach
    if (this.heel > 52 && this.broachT <= 0) { this.broachT = 2.5; this.events.push('broach'); if (this.kite) { this.kite = false; } }

    // move, with a little leeway and a little drift when stopped
    const lee = -side * (0.04 * this.v + 0.05);
    this.x += (Math.sin(this.h) * this.v + Math.cos(this.h) * lee) * dt;
    this.z += (-Math.cos(this.h) * this.v + Math.sin(this.h) * lee) * dt;
  }
}

// ---------- the course ----------
export function makeCourse(laps = 1, beat = 260) {
  return {
    laps,
    pin: { x: -70, z: 0 }, committee: { x: 70, z: 0 }, // the start and finish line
    windward: { x: 0, z: -beat },
    gate: [{ x: -22, z: -45 }, { x: 22, z: -45 }],
    // the legs, in order: 'start' → 'mark' → 'gate' → 'mark' → … → 'finish'
    legs: ['start', ...Array.from({ length: laps }, (_, i) => (i < laps - 1 ? ['mark', 'gate'] : ['mark'])).flat(), 'finish'],
  };
}

// where a boat should aim for its leg
export function legTarget(course, leg) {
  const k = course.legs[leg];
  if (k === 'mark') return { x: course.windward.x + 7, z: course.windward.z - 5 };
  if (k === 'gate') return { x: 0, z: course.gate[0].z + 6 };
  if (k === 'finish') return { x: (course.pin.x + course.committee.x) / 2, z: 8 };
  return { x: (course.pin.x + course.committee.x) / 2, z: -10 };
}

// ---------- the race ----------
export const START_SECS = 60;

export class Race {
  constructor({ preset = 'medium', laps = 1, autoTrim = false, seed = Date.now() % 100000 } = {}) {
    this.wind = new Wind(preset, seed);
    this.course = makeCourse(laps, { light: 190, medium: 260, strong: 280 }[preset] || 260);
    this.clock = -START_SECS; // negative before the gun
    this.rand = rng(seed + 7);
    const W = this.wind.dir();
    this.player = new Boat({ name: 'You', x: 25, z: 95, h: wrap(W - 45 * D2R), v: 2, autoTrim });
    const full = 24 * (this.wind.p.tws / 12) ** 1.4; // start with the sheet eased enough for the breeze
    this.player.sheet = sheetFor(idealSail(45) + (full > 24 ? 28 * (1 - 24 / full) : 0));
    const names = ['Aurora', 'Kestrel', 'Nomad'];
    const colors = [0xc0392b, 0x1e8449, 0xd4ac0d];
    this.boats = [this.player];
    names.forEach((n, i) => {
      const b = new Boat({ name: n, x: -55 + i * 40, z: 110 + i * 12, h: wrap(W - 45 * D2R), v: 1.5, autoTrim: true });
      b.ai = { skill: 0.82 + this.rand() * 0.16, lineX: -45 + i * 40 + (this.rand() - 0.5) * 20, lastTack: -99, aim: UP_TWA + (this.rand() - 0.5) * 4, go: false };
      b.color = colors[i];
      this.boats.push(b);
    });
    for (const b of this.boats) Object.assign(b, { leg: 0, ocs: false, done: false, finish: null, track: [], lastZ: b.z, roundedAt: 0, msgs: [] });
    this.trackT = 0;
    this.messages = []; // for the screen: { text key, args }
    this.over = false;
  }
  say(key, arg) { this.messages.push({ key, arg }); }

  step(dt) {
    const wasBefore = this.clock < 0;
    this.clock += dt;
    this.wind.step(dt);
    for (const b of this.boats) { if (b.ai && !b.done) this.drive(b, dt); }
    for (const b of this.boats) b.step(dt, this.wind);
    this.collide();
    // the gun: whoever is over the line is OCS
    if (wasBefore && this.clock >= 0) {
      for (const b of this.boats) if (b.z < 0 && Math.abs(b.x) < 90) { b.ocs = true; if (b === this.player) this.say('ocs'); }
      this.say('gun');
    }
    for (const b of this.boats) this.progress(b);
    this.trackT += dt;
    if (this.trackT > 1) {
      this.trackT = 0;
      for (const b of this.boats) if (!b.done) b.track.push([b.x, b.z]);
    }
  }

  // legs: crossing the line, rounding the marks, finishing
  progress(b) {
    const c = this.course, k = c.legs[b.leg];
    const between = (x) => x > c.pin.x && x < c.committee.x;
    if (b.ocs && b.z > 2) { b.ocs = false; if (b === this.player) this.say('cleared'); }
    if (this.clock >= 0 && !b.done) {
      if (k === 'start' && !b.ocs && b.lastZ >= 0 && b.z < 0 && between(b.x)) { b.leg++; if (b === this.player) this.say('started'); }
      else if (k === 'mark' && b.z < c.windward.z && Math.abs(b.x - c.windward.x) < 45) { b.leg++; if (b === this.player) this.say('rounded'); }
      else if (k === 'gate' && b.lastZ <= c.gate[0].z && b.z > c.gate[0].z && b.x > c.gate[0].x - 4 && b.x < c.gate[1].x + 4) { b.leg++; if (b === this.player) this.say('gate'); }
      else if (k === 'finish' && b.lastZ <= 0 && b.z > 0 && between(b.x)) {
        b.done = true; b.finish = this.clock; b.track.push([b.x, b.z]);
        const place = this.boats.filter((o) => o.done).length;
        b.place = place;
        if (b === this.player) { this.say('finished', place); this.over = true; }
      }
    }
    b.lastZ = b.z;
  }

  // the order now: finished boats by time, then by legs done and distance to the next target
  standings() {
    const score = (b) => (b.done ? 1e9 - b.finish : b.leg * 1e5 - this.distToNext(b));
    return [...this.boats].sort((p, q) => score(q) - score(p));
  }
  distToNext(b) {
    const t = legTarget(this.course, b.leg);
    return Math.hypot(t.x - b.x, t.z - b.z);
  }

  // boats and marks don't pass through each other: a bump slows both
  collide() {
    const bs = this.boats, c = this.course;
    for (let i = 0; i < bs.length; i++) {
      for (let j = i + 1; j < bs.length; j++) {
        const p = bs[i], q = bs[j], dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
        if (d < 8 && d > 0.01) {
          const push = (8 - d) / 2, nx = dx / d, nz = dz / d;
          p.x -= nx * push; p.z -= nz * push; q.x += nx * push; q.z += nz * push;
          if (p.hit <= 0 || q.hit <= 0) { p.v *= 0.75; q.v *= 0.75; if (p === this.player || q === this.player) this.say('bump'); }
          p.hit = q.hit = 1.5;
        }
      }
    }
    const marks = [[c.windward, 4], [c.gate[0], 4], [c.gate[1], 4], [c.pin, 4], [c.committee, 9]];
    for (const b of bs) {
      b.hit -= 1 / 60;
      for (const [m, r] of marks) {
        const dx = b.x - m.x, dz = b.z - m.z, d = Math.hypot(dx, dz);
        if (d < r && d > 0.01) { b.x = m.x + (dx / d) * r; b.z = m.z + (dz / d) * r; b.v *= 0.9; }
      }
    }
  }

  // ---------- the computer skippers ----------
  drive(b, dt) {
    const ai = b.ai, c = this.course, W = b.wdir;
    let tx, tz;
    if (this.clock < 0) {
      // before the gun: wait below the line on starboard tack, then go for it with time to spare
      const lineX = ai.lineX, approach = W - UP_TWA * D2R; // starboard tack heading
      const dist = 75, wx = lineX - Math.sin(approach) * dist, wz = 0 - -Math.cos(approach) * dist;
      const eta = dist / (vmax(b.tws) * 0.75 * KN) + 3 * ai.skill;
      if (!ai.go && -this.clock <= eta + 4 * (1 - ai.skill)) ai.go = true;
      if (!ai.go) {
        const dHome = Math.hypot(wx - b.x, wz - b.z);
        if (dHome < 18) { // luff and wait, nose near the wind
          this.steerTo(b, W - 35 * D2R); b.autoTrim = false; b.sheet = 1; return;
        }
        tx = wx; tz = wz;
      } else { tx = lineX; tz = -30; }
      b.autoTrim = true;
    } else {
      const t = legTarget(c, b.ocs ? 0 : b.leg);
      tx = t.x; tz = b.ocs ? 15 : t.z;
      b.autoTrim = true;
    }
    const brg = Math.atan2(tx - b.x, -(tz - b.z));
    const rel = wrap(brg - W); // + target to the right of the wind
    const up = (ai.aim) * D2R, down = DOWN_TWA * D2R;
    const tack = sgn(b.twa); // + starboard
    let want;
    if (Math.abs(rel) < up) {
      // upwind: hold the tack until the target is on the layline of the other one
      const lay = tack > 0 ? rel >= up - 2 * D2R : rel <= -(up - 2 * D2R);
      const longTime = this.clock - ai.lastTack > 10;
      if ((lay && longTime) || (Math.abs(rel) < 4 * D2R && longTime && this.rand() < 0.002)) { ai.lastTack = this.clock; want = W + tack * up; }
      else want = W - tack * up;
      if (b.auto) return;
      if (sgn(wrap(W - want)) !== tack && !b.auto) { b.tackOrGybe(); return; }
    } else if (Math.abs(rel) > down) {
      // dead downwind: broad reach on this gybe; once the target is off the wind enough, the steering
      // below heads straight for it and gybes on the way
      want = W - tack * down;
    } else want = brg;
    // too early for the line: let the sails out and wait
    if (this.clock < -1 && ai.go && b.z < 8) { this.steerTo(b, W - 40 * D2R); b.autoTrim = false; b.sheet = 1; return; }
    if (b.auto) return;
    this.steerTo(b, want);
    // the kite goes up on the run in the race
    const a = Math.abs(b.twa) / D2R;
    b.kite = this.clock > 0 && a > 110 && this.wind.p.tws < 18 ? true : a > 100 ? b.kite : false;
    // trim isn't perfect
    if (b.autoTrim) b.sheet = clamp(b.sheet + (this.rand() - 0.5) * (1 - ai.skill) * 0.05, 0, 1);
  }
  steerTo(b, want) {
    const d = wrap(want - b.h);
    b.rudder = clamp(d * 2.4, -1, 1);
  }
}
