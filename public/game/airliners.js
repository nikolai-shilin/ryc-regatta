// Regatta: now and then, where an airport is close (airports.js), an airliner (airliner-model.js) comes low over the
// course, inbound with her flaps and wheels down or climbing out clean. The chase camera looks down at the water, so from
// there you know her by her shadow crossing the boats, her reflection and the roar (main.js), which reaches you late, at
// the speed of sound; from the helm you see her go over. All picture: nothing here touches the race.
import * as THREE from 'three';
import { VENUE, SKOPEA } from './land.js';
import { LIVERIES, TYPES, airframe } from './airliner-model.js';
import { HALF, STEP, airportOf, flightProfile, frameOf, gapFor, route, runwayInUse } from './airports.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const SPEED = { in: 86, out: 105 }; // m/s: about 165 kn with the flaps out, 205 kn climbing away
const SOUND = 343; // m/s
const PENUMBRA = 0.0093, PASS_HEIGHT = 500; // the sun's width: a shadow's edge is this soft for each metre she is up; and about how high she goes over
// after her pass, the next one's built a piece at a time when the page has a moment, not in a frame of the race
const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 200));

// her shadow on the water, seen from straight above: every triangle of her filled in, by hand (a canvas takes ten times
// as long over so many), then softened at the edge as much as the sun's width does from about her height
function shadowTexture(geo, size) {
  const W = 256, A = new Uint8ClampedArray(W * W), P = geo.attributes.position.array, m = W / size, at = (v) => W / 2 + v * m;
  for (let i = 0; i < P.length; i += 9) {
    const x0 = at(P[i]), y0 = at(P[i + 2]), x1 = at(P[i + 3]), y1 = at(P[i + 5]), x2 = at(P[i + 6]), y2 = at(P[i + 8]);
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(area) < 1e-6) continue;
    const ax = Math.max(0, Math.floor(Math.min(x0, x1, x2))), bx = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
    const ay = Math.max(0, Math.floor(Math.min(y0, y1, y2))), by = Math.min(W - 1, Math.ceil(Math.max(y0, y1, y2)));
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) {
      const u = x + 0.5, v = y + 0.5, a = ((x1 - u) * (y2 - v) - (x2 - u) * (y1 - v)) / area, b = ((x2 - u) * (y0 - v) - (x0 - u) * (y2 - v)) / area;
      if (a >= 0 && b >= 0 && a + b <= 1) A[y * W + x] = 255;
    }
  }
  // a box along each axis, twice, comes close to the round sun
  const r = Math.max(1, Math.round(PASS_HEIGHT * PENUMBRA * m / 3)), B = new Uint8ClampedArray(W * W);
  const blur = (from, to, step, line) => {
    for (let l = 0; l < W; l++) {
      let sum = 0; const o = l * line;
      for (let i = -r; i <= r; i++) sum += from[o + clamp(i, 0, W - 1) * step];
      for (let i = 0; i < W; i++) { to[o + i * step] = sum / (2 * r + 1); sum += from[o + Math.min(W - 1, i + r + 1) * step] - from[o + Math.max(0, i - r) * step]; }
    }
  };
  blur(A, B, 1, W); blur(B, A, W, 1); blur(A, B, 1, W); blur(B, A, W, 1);
  const c = document.createElement('canvas'); c.width = c.height = W;
  const x = c.getContext('2d'), d = x.createImageData(W, W);
  for (let i = 0; i < W * W; i++) d.data[i * 4 + 3] = A[i];
  x.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace;
  return t;
}

// a soft round glow, for her lights
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,255,255,0.75)'); g.addColorStop(0.45, 'rgba(255,255,255,0.14)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Airliner {
  // skyU: the light's uniforms, for where the sun is and how strong
  constructor(skyU) {
    this.skyU = skyU;
    this.group = new THREE.Group(); this.group.visible = false;
    this.craft = new THREE.Group(); this.craft.rotation.order = 'YXZ';
    // gloss paint; bright metal; and what is painted on her or set flush in her skin, a little in front of it so that it
    // holds from a long way off (the windows catch the sky)
    const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, ...o });
    const paint = std({ roughness: 0.34, metalness: 0.04 }), metal = std({ roughness: 0.3, metalness: 0.75 });
    const decal = std({ roughness: 0.12, metalness: 0.45, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 });
    const part = (m) => { const o = new THREE.Mesh(new THREE.BufferGeometry(), m); this.craft.add(o); return o; };
    this.parts = { paint: part(paint), metal: part(metal), decal: part(decal), up: part(paint), down: part(paint) };
    this.fans = [part(paint), part(paint)];
    const glow = glowTexture(), light = (hex) => { const o = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: hex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false })); this.craft.add(o); return o; };
    this.lamps = [light('#fff6e2'), light('#fff6e2')]; this.beacon = light('#ff3a2a'); this.strobes = [light('#ffffff'), light('#ffffff')];
    this.navs = [light('#39ff6a'), light('#ff2a2a')]; // green to starboard, red to port
    this.group.add(this.craft);
    // drawn over the boats too, which are in her shadow as much as the water is
    this.shade = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, depthWrite: false, depthTest: false, fog: false, toneMapped: false }));
    this.shade.visible = false; this.shade.renderOrder = 3;
    this.p = new THREE.Vector3(); this.v = new THREE.Vector3();
    this.sound = { p: new THREE.Vector3(), v: new THREE.Vector3(), level: 0, out: false }; // what you hear of her: where she was when she made it
    this._f = new THREE.Vector3(); this._d = new THREE.Vector3();
    this.on = false; this.ap = null;
  }

  // ground(x, z): the land's height in the race's coordinates
  reset(race, ground) {
    this.race = race; this.ground = ground || (() => 0); this.on = false; this.group.visible = false; this.shade.visible = false;
    const ap = airportOf(VENUE.id);
    this.ap = ap;
    if (!ap) return;
    const frame = frameOf(SKOPEA.meta);
    this.rw = runwayInUse(ap.runways, frame);
    this.at = { x: race.at?.x || 0, z: race.at?.z || 0 };
    this.away = Math.hypot((this.rw.T.x + this.rw.E.x) / 2 - this.at.x, (this.rw.T.z + this.rw.E.z) / 2 - this.at.z);
    this.timer = gapFor(this.away) * rnd(0.3, 1); // the first comes sooner than the rest
    this.clock = 0; this.tx = this.tz = null; this.tvx = this.tvz = 0;
    this.drop(this.next); this.next = null;
    this.build(); this.dress(); // (while the race loads)
  }

  // what comes over next: the long-haul types only where they fly to, Boeing or Airbus as it falls. In two steps, each
  // short enough to go between two frames
  build() {
    if (this.next || !this.ap) return;
    const types = Object.values(TYPES).filter((T) => !T.wide || (this.ap.wide && Math.random() < 0.5));
    const T = pick(types);
    this.next = { T, ...airframe(T, pick(LIVERIES)), size: Math.max(T.L, 2 * T.semi) * 1.25 };
  }
  dress() { const n = this.next; if (n && !n.map) n.map = shadowTexture(n.paint, n.size); }
  drop(n) { if (!n) return; for (const k of ['paint', 'metal', 'decal', 'up', 'down', 'fan']) n[k].dispose(); n.map?.dispose(); }

  altAt(s) {
    const a = this.alts, x = clamp((s + HALF) / STEP, 0, a.length - 1.001), i = Math.floor(x), u = x - i;
    return a[i] + (a[i + 1] - a[i]) * u;
  }

  // where her shadow falls from a height H, relative to her
  castAt(H) { const S = this.skyU.uSun.value, y = Math.max(S.y, 0.12); return { x: -S.x / y * H, z: -S.z / y * H }; }

  // a pass: of a few tracks near the one the airport gives, the first the land lets her fly low enough, her shadow laid
  // across your boat. False: none to be had just now
  spawn() {
    const kind = Math.random() < 0.5 ? 'in' : 'out', r = route(kind, this.rw, this.at), P = this.race.player;
    let best = null;
    for (let i = 0; i < 9 && !best; i++) {
      const a = i ? rnd(-0.45, 0.45) : 0, co = Math.cos(a), si = Math.sin(a), f = { x: r.dir.x * co - r.dir.z * si, z: r.dir.x * si + r.dir.z * co };
      const O = this.castAt(r.height), alts = flightProfile(kind, r.height, P.x - O.x, P.z - O.z, f, this.ground);
      if (alts) best = { f, alts };
    }
    if (!best || !this.next?.map) return false;
    this.kind = kind; this.f = best.f; this.alts = best.alts; this.h = Math.atan2(best.f.x, -best.f.z);
    this.speed = SPEED[kind]; this.s = -HALF; this.off = null; this.k = Math.random() * 10;
    this.gearDown = kind === 'in' && r.flown < 22000;
    const n = this.next, T = n.T; this.next = null;
    this.drop(this.flying); this.flying = n;
    for (const k in this.parts) this.parts[k].geometry = n[k];
    this.parts.up.visible = !this.gearDown; this.parts.down.visible = this.gearDown; // clean, or flaps, slats and wheels out
    this.fans.forEach((o, i) => { o.geometry = n.fan; o.position.set(...n.fans[i]); });
    this.type = T;
    this.shade.scale.set(n.size, 1, n.size); this.shade.material.map = n.map; this.shade.material.needsUpdate = true;
    const L = n.lights;
    this.lamps.forEach((o, i) => o.position.set(...L.lamps[i])); this.beacon.position.set(...L.beacon);
    this.strobes.forEach((o, i) => o.position.set(...L.tips[i])); this.navs.forEach((o, i) => o.position.set(...L.tips[i]));
    this.on = true; this.group.visible = true;
    return true;
  }

  // the line her shadow should run along by the time she's over: through your boat, where it'll be by then. She eases
  // onto it while she's still far off, too little to see
  home(dt) {
    const P = this.race.player, H = this.altAt(0), O = this.castAt(H), f = this.f;
    if (this.tx !== null && dt > 0) { const k = Math.min(1, dt * 1.5); this.tvx += ((P.x - this.tx) / dt - this.tvx) * k; this.tvz += ((P.z - this.tz) / dt - this.tvz) * k; }
    this.tx = P.x; this.tz = P.z;
    const eta = Math.max(0, -this.s / this.speed), qx = P.x + this.tvx * eta - O.x, qz = P.z + this.tvz * eta - O.z;
    const want = qx * -f.z + qz * f.x; // across her track
    if (this.off === null) { this.off = want; this.along = qx * f.x + qz * f.z; return; }
    if (eta > 1.5) this.off += clamp(want - this.off, -22 * dt, 22 * dt);
  }
  // where she is at s along her track
  point(s, out) {
    const f = this.f, a = this.along + s, n = this.off;
    return out.set(f.x * a - f.z * n, this.altAt(s), f.z * a + f.x * n);
  }

  // ready: not during the opening fly-in
  update(dt, cam, ready = true) {
    if (!this.ap) return;
    this.clock += dt;
    if (!this.on) {
      this.timer -= dt;
      if (this.timer > 0 || dt <= 0 || !ready) return;
      this.timer = gapFor(this.away);
      if (!this.spawn()) return;
    }
    this.s += this.speed * dt;
    this.home(dt);
    this.hear(cam.position);
    // on past the end of her track unseen, until the last of her sound has reached you
    if (this.s > HALF + 3000) {
      this.on = false; this.group.visible = false; this.shade.visible = false; this.sound.level = 0;
      idle(() => { this.build(); idle(() => this.dress()); });
      return;
    }
    const seen = Math.abs(this.s) < HALF;
    this.group.visible = seen;
    if (!seen) { this.shade.visible = false; return; }
    const t = this.clock + this.k, c = this.craft, f = this.f, climb = (this.altAt(this.s + 40) - this.altAt(this.s - 40)) / 80;
    this.point(this.s, this.p); this.v.set(f.x * this.speed, climb * this.speed, f.z * this.speed);
    c.position.copy(this.p);
    c.rotation.set((this.kind === 'in' ? 0.05 : 0.14) + Math.atan(climb) * 0.5, -this.h, 0.018 * Math.sin(t * 0.31));
    // lost in the haze at the far ends of her track
    c.scale.setScalar(Math.max(1e-3, smooth(0, 1400, HALF - Math.abs(this.s))));
    c.updateMatrixWorld(true);

    // her lights: the landing lights blaze when she's pointing at you, the beacon and the strobes flash
    const to = this._d.copy(cam.position).sub(this.p), d = to.length(); to.divideScalar(d);
    const facing = Math.max(0, this._f.set(f.x, 0, f.z).dot(to)) ** 5, size = d * 0.012;
    for (const o of this.lamps) { o.material.opacity = 0.08 + 0.92 * facing; o.scale.setScalar(clamp(size * (0.4 + 1.2 * facing), 2, 110)); }
    for (const o of this.navs) { o.material.opacity = 0.75; o.scale.setScalar(clamp(size * 0.3, 1, 26)); }
    for (const o of this.fans) o.rotation.z += dt * 13; // the fans, turning
    this.beacon.material.opacity = (t % 1.25) < 0.14 ? 1 : 0; this.beacon.scale.setScalar(clamp(size * 0.5, 2, 45));
    const flash = t % 1.4, on = flash < 0.06 || (flash > 0.16 && flash < 0.22);
    for (const s of this.strobes) { s.material.opacity = on ? 1 : 0; s.scale.setScalar(clamp(size * 0.7, 2.5, 60)); }

    // her shadow, on the water near you; the sun has to be up and out to cast one
    const S = this.skyU.uSun.value, K = this.skyU.uSunCol.value, O = this.castAt(this.p.y), sx = this.p.x + O.x, sz = this.p.z + O.z;
    const near = 1 - smooth(900, 1700, Math.hypot(sx - cam.position.x, sz - cam.position.z));
    const k = near * smooth(0.16, 0.42, S.y) * clamp((K.r + K.g + K.b) / 2.2, 0, 1);
    this.shade.visible = k > 0.01 && this.ground(sx, sz) < 0.5;
    if (this.shade.visible) { this.shade.position.set(sx, 0.5, sz); this.shade.rotation.y = -this.h; this.shade.material.opacity = 0.46 * k; }
  }

  // what reaches you now left her a while ago: where she was then, by the time the sound has come from there
  hear(eye) {
    let s = this.s;
    for (let i = 0; i < 3; i++) { this.point(s, this._d); s = this.s - this.speed * this._d.distanceTo(eye) / SOUND; }
    const o = this.sound;
    this.point(s, o.p); o.v.set(this.f.x * this.speed, 0, this.f.z * this.speed); o.out = this.kind === 'out';
    o.level = smooth(0, 2500, HALF + 500 - Math.abs(s));
  }
}
