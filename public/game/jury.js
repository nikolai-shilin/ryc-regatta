// Regatta: the jury boat — a sister ship of the committee boat, out on the water but off the course. She potters
// round the race area at a few knots, now and then stops to watch for a while, and keeps clear of the land and of the
// yachts. All picture: nothing here touches the race.
import { clamp, lerp, wrap, beatAngle } from './sim.js';
import { CommitteeBoat } from './committee.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const fwdX = (h) => Math.sin(h), fwdZ = (h) => -Math.cos(h); // a heading's way forward (as the boats steer)
const MARGIN = 110; // metres of water she leaves between herself and the race area
const ROOM = 45; // metres of water she wants round her, from the shore

export class JuryBoat {
  constructor() {
    this.cb = new CommitteeBoat(1, 0, { underway: true, banner: 'JURY' });
    this.root = this.cb.root;
    this.x = 0; this.z = 0; this.h = 0; this.v = 0;
  }

  // the race area as an ellipse round the marks, the line, the water below it and the beat out to near the laylines;
  // she keeps outside it
  reset(race) {
    this.race = race;
    const c = race.course, beat = -c.windward.z, tb = Math.tan(beatAngle(race.wind.p.tws) * Math.PI / 180);
    // every mark, the gate, the line, and a finish line of its own with its committee boat (a trapezoid's, out to the left)
    const pts = [...Object.values(c.marks), ...c.gate, c.pin, c.committee, ...(c.finish ? [c.finish.a, c.finish.b, c.finishBoat] : [])].map((m) => [m.x, m.z]);
    pts.push([0, 200], [0, -beat - 90], [-beat * tb * 0.3, -beat / 2], [beat * tb * 0.3, -beat / 2]);
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    // an ellipse through the corners of that box holds it all: √2 times its half sides
    this.E = { x: (x0 + x1) / 2, z: (z0 + z1) / 2, ax: ((x1 - x0) / 2) * 1.414 + MARGIN, az: ((z1 - z0) / 2) * 1.414 + MARGIN };
    this.dirn = Math.random() < 0.5 ? 1 : -1;
    // she starts off to leeward of the line, on one side or the other, wherever there's water
    this.on = false;
    for (const th0 of [Math.PI / 3, 2 * Math.PI / 3, 0, Math.PI, -Math.PI / 3, -2 * Math.PI / 3, Math.PI / 2, -Math.PI / 2]) {
      const p = this.at(th0, 1.2);
      if (this.wet(p.x, p.z)) { this.th = th0; this.x = p.x; this.z = p.z; this.on = true; break; }
    }
    this.root.visible = this.on;
    if (!this.on) return;
    this.v = 0; this.state = 'idle'; this.timer = rnd(5, 25); this.wp = null;
    this.h = Math.atan2(this.dirn * -this.E.ax * Math.sin(this.th), -(this.dirn * this.E.az * Math.cos(this.th))); // along the way she'll go
    this.yawRate = 0;
  }

  at(th, k) { const E = this.E; return { x: E.x + E.ax * k * Math.cos(th), z: E.z + E.az * k * Math.sin(th), th, k }; }
  // how far out of the race area a point is: below 1, inside it
  out(x, z) { const E = this.E; return Math.hypot((x - E.x) / E.ax, (z - E.z) / E.az); }
  wet(x, z, r = ROOM) { return this.race.roomAt(x, z) > r; }
  // the next place to make for: a little further round the race area, clear of it all the way and clear of the land;
  // round she goes the other way when there's no water ahead
  pick() {
    for (let turn = 0; turn < 2; turn++, this.dirn = -this.dirn) for (let tries = 0; tries < 14; tries++) {
      const p = this.at(this.th + this.dirn * rnd(0.3, 0.65), rnd(1.1, 1.4));
      let ok = this.wet(p.x, p.z, ROOM + 15);
      for (let s = 1; ok && s < 8; s++) { const x = lerp(this.x, p.x, s / 8), z = lerp(this.z, p.z, s / 8); ok = this.out(x, z) >= 1 && this.wet(x, z); }
      if (ok) return p;
    }
    return null;
  }

  update(dt, t) {
    if (!this.on) return;
    dt = Math.min(dt, 0.25);
    const race = this.race;
    let want = 0, steer = null;
    if (this.state === 'idle') { // stopped to watch: drifting, swinging a little
      this.timer -= dt;
      if (this.timer <= 0) { this.wp = this.pick(); if (this.wp) this.state = 'run'; else this.timer = rnd(10, 20); }
    } else {
      const dx = this.wp.x - this.x, dz = this.wp.z - this.z, d = Math.hypot(dx, dz);
      want = this.cruise ??= rnd(3.5, 5.5); // 7 to 11 knots
      want *= clamp(d / 60, 0.3, 1); // easing off as she comes up to it
      steer = Math.atan2(dx, -dz);
      if (d < 15) {
        this.th = this.wp.th; this.cruise = null;
        if (Math.random() < 0.35) { this.state = 'idle'; this.timer = rnd(20, 70); }
        else { this.wp = this.pick(); if (!this.wp) { this.state = 'idle'; this.timer = rnd(10, 20); } }
      }
    }
    // a yacht close ahead: she slows right down and turns away from her
    for (const b of race.boats) {
      const dx = b.x - this.x, dz = b.z - this.z, d = Math.hypot(dx, dz);
      if (d > 70) continue;
      const ahead = (dx * fwdX(this.h) + dz * fwdZ(this.h)) / (d || 1);
      if (ahead > 0.2) { want = Math.min(want, lerp(0.4, 2, (d - 25) / 45)); if (steer !== null) steer = this.h - Math.sign(wrap(Math.atan2(dx, -dz) - this.h)) * 0.6; }
    }
    // and she never runs at the shore: if what's ahead of her shoals, she turns for deeper water
    const ax = this.x + fwdX(this.h) * 40, az = this.z + fwdZ(this.h) * 40;
    if (this.v > 0.5 && !this.wet(ax, az, 15)) {
      const e = 10, gx = race.roomAt(this.x + e, this.z) - race.roomAt(this.x - e, this.z), gz = race.roomAt(this.x, this.z + e) - race.roomAt(this.x, this.z - e);
      steer = Math.atan2(gx, -gz); want = Math.min(want, 1.5);
    }
    this.v += clamp(want - this.v, -0.9 * dt, 0.5 * dt);
    if (steer !== null && this.v > 0.2) {
      const rate = clamp(this.v / 4, 0.25, 1) * 0.22; // rad/s at full helm
      this.yawRate = clamp(wrap(steer - this.h), -1, 1) * rate;
    } else this.yawRate = lerp(this.yawRate, Math.sin(t * 0.05 + 1.7) * 0.01, clamp(dt, 0, 1)); // lying stopped
    this.h = wrap(this.h + this.yawRate * dt);
    this.x += fwdX(this.h) * this.v * dt; this.z += fwdZ(this.h) * this.v * dt;
  }
}
