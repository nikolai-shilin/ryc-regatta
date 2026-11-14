// Regatta: airliners at cruise, 10–12 km up, crossing the sky and drawing contrails — two strands off the engines that
// merge, spread and drift on the wind up there; some gone in half a minute, some lingering for minutes. They're drawn
// with the sky: right after the dome and before the land, so a hill stands in front of them, and through the same
// clouds as the dome (light.js), so a jet goes behind a cloud. Each is placed where it really is, then drawn on a
// sphere round the camera at its true angular size (a little larger, so it shows as more than a speck). All picture.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SKY_GLSL } from './light.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const R = 4000; // the sphere they're drawn on (inside the camera's far plane; the dome is drawn first whatever its size)
const SEE = 120000; // metres: a jet further off than this is lost in the haze
const SPEED = 235; // m/s, about Mach 0.78 up there
const BIG = 3; // drawn larger than life, to read as a jet and not a dot
const MAX = 5; // in the sky at once
const SEGS = 96; // along a contrail

// the blending of a see-through thing in the opaque pass, so it can be drawn between the dome and the land
const behindLand = { transparent: false, depthWrite: false, depthTest: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor };

// ---------- the airliner: 38 m long and 36 m across, nose at −z ----------
function paint(g, hex) {
  if (g.index) g = g.toNonIndexed();
  if (!g.attributes.normal) g.computeVertexNormals();
  if (g.attributes.uv) g.deleteAttribute('uv');
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
// a flat swept surface: root chord at x 0 from z0 back, tip at x span with its own chord, swept back by sweep metres
function surface(span, root, tip, sweep, t) {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(span, sweep); s.lineTo(span, sweep + tip); s.lineTo(0, root); s.lineTo(0, 0);
  return new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, t / 2, 0); // drawing y → z (back)
}
function jetGeometry() {
  const parts = [];
  parts.push(paint(new THREE.CylinderGeometry(2, 2, 30, 12, 1, true).rotateX(Math.PI / 2), '#f2f3f4'));
  parts.push(paint(new THREE.SphereGeometry(2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2).scale(1, 1, 2.2).translate(0, 0, -15), '#f2f3f4')); // the nose
  parts.push(paint(new THREE.ConeGeometry(2, 8, 12, 1, true).rotateX(Math.PI / 2).translate(0, 0.6, 19), '#e9eaeb')); // the tail cone
  for (const sx of [-1, 1]) {
    const w = surface(16, 6, 1.6, 8, 0.4); if (sx < 0) w.rotateZ(Math.PI); // the other side: turned over, not mirrored, so it faces out
    parts.push(paint(w.translate(sx * 1.6, -0.9, -3), '#cfd3d6'));
    const h = surface(6, 3.4, 1.2, 3.4, 0.25); if (sx < 0) h.rotateZ(Math.PI);
    parts.push(paint(h.translate(sx * 0.8, 1.2, 14.5), '#cfd3d6'));
    parts.push(paint(new THREE.CylinderGeometry(1.0, 0.85, 4.2, 10).rotateX(Math.PI / 2).translate(sx * 5.8, -1.9, -2.6), '#b9bdc1')); // the engines
  }
  const fin = surface(7, 5.5, 2.2, 5.5, 0.3).rotateZ(Math.PI / 2); // up instead of out
  parts.push(paint(fin.translate(0, 1.6, 13), '#2b5d8f'));
  return mergeGeometries(parts.map((g) => { if (g.index) g = g.toNonIndexed(); g.computeVertexNormals(); return g; }));
}

const JET_VS = /* glsl */ `
attribute vec3 color; varying vec3 vCol, vN, vWorld;
void main() {
  vCol = color; vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const JET_FS = /* glsl */ `
uniform float uTime, uFade; varying vec3 vCol, vN, vWorld;
${SKY_GLSL}
void main() {
  vec3 d = normalize(vWorld - cameraPosition), n = normalize(vN);
  vec3 amb = mix(uHorizon, uTop, 0.5 + 0.5 * n.y) * 0.75;
  vec3 col = vCol * (amb + uSunCol * max(dot(n, uSun), 0.0) * 0.9);
  col += uSunCol * pow(max(dot(reflect(d, n), uSun), 0.0), 60.0) * 2.5; // the glint off her skin
  col = mix(col, skyBase(d), 0.35 * (1.0 - smoothstep(0.0, 0.35, d.y))); // the haze, low down
  float a = uFade * smoothstep(0.015, 0.07, d.y) * (1.0 - 0.97 * cloudDen(d, uTime));
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ---------- the contrail: a ribbon back along her track, built in the shader from where she is now ----------
// aU 0 at the engines … 1 at the oldest end (spaced by u², so the young two-stranded part gets the most); aSide −1 … 1
const TRAIL_VS = /* glsl */ `
attribute float aU, aSide;
uniform vec3 uJet, uDir; uniform vec2 uDrift; uniform float uLife, uAge, uW0, uSpread, uR;
varying float vAge, vSide, vFar; varying vec3 vRel;
void main() {
  float age = min(uLife * aU * aU, uAge);
  vec3 p = uJet - uDir * (${SPEED.toFixed(1)} * age + 45.0) + vec3(uDrift.x, 0.0, uDrift.y) * age;
  vec3 rel = p - cameraPosition; float dist = length(rel);
  vFar = 1.0 - smoothstep(${(0.6 * SEE).toFixed(1)}, ${SEE.toFixed(1)}, length(rel.xz)); // into the haze
  vec3 across = normalize(cross(uDir, rel / dist));
  rel += across * aSide * (uW0 + uSpread * age) * 0.5;
  vAge = age; vSide = aSide; vRel = rel;
  gl_Position = projectionMatrix * viewMatrix * vec4(cameraPosition + rel * (uR / dist), 1.0);
}`;
const TRAIL_FS = /* glsl */ `
uniform float uTime, uLife, uOpacity; varying float vAge, vSide, vFar; varying vec3 vRel;
${SKY_GLSL}
void main() {
  vec3 d = normalize(vRel);
  float a = vAge, sep = 0.5 * (1.0 - smoothstep(0.5, 14.0, a)), sw = mix(0.2, 0.62, smoothstep(0.0, 14.0, a));
  float prof = exp(-pow((abs(vSide) - sep) / sw, 2.0)); // two strands, merging
  float alpha = prof * smoothstep(0.0, 0.7, a) * (1.0 - smoothstep(uLife * 0.35, uLife, a)) * mix(0.85, 0.4, smoothstep(0.0, uLife, a)) * uOpacity;
  alpha *= vFar * smoothstep(0.012, 0.07, d.y) * (1.0 - 0.95 * cloudDen(d, uTime));
  vec3 col = mix(uCloudLit, skyBase(d), 0.2 + 0.5 * (1.0 - smoothstep(0.0, 0.3, d.y)));
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
function trailGeometry() {
  const n = (SEGS + 1) * 2, u = new Float32Array(n), side = new Float32Array(n), idx = [];
  for (let i = 0; i <= SEGS; i++) { u[i * 2] = u[i * 2 + 1] = i / SEGS; side[i * 2] = -1; side[i * 2 + 1] = 1; }
  for (let i = 0; i < SEGS; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); // unused: the shader places them
  g.setAttribute('aU', new THREE.BufferAttribute(u, 1)); g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  g.setIndex(idx);
  return g;
}

export class Jets {
  // sky: the uniforms the dome's shader is drawn with (light.js), and its clock, so jets and clouds agree
  constructor(skyU, uTime) {
    this.group = new THREE.Group();
    this.shared = { ...skyU, uTime };
    this.jetGeo = jetGeometry(); this.trailGeo = trailGeometry();
    this.list = []; this.clock = 0; this.timer = Infinity; // none until a race is set
    this._v = new THREE.Vector3();
  }

  reset(race) {
    for (const j of this.list) this.drop(j);
    this.list = []; this.clock = 0;
    const o = race ? race.player : { x: 0, z: 0 };
    this.timer = rnd(30, 90);
    // the sky isn't empty when you get there: two or three already crossing it, their trails behind them
    for (let i = 0, n = 2 + (Math.random() < 0.5 ? 1 : 0); i < n; i++) this.spawn(o, rnd(0.15, 0.8));
  }

  // a jet on a straight track across the sky, passing within 0–45 km of the course; along: how far across she is
  spawn(o, along = 0) {
    const h = rnd(0, 2 * Math.PI), D = rnd(0, 45000) * (Math.random() < 0.5 ? -1 : 1), half = Math.sqrt(SEE * SEE - D * D);
    const fx = Math.sin(h), fz = -Math.cos(h), cx = o.x + Math.cos(h) * D, cz = o.z + Math.sin(h) * D;
    const kind = Math.random(), life = kind < 0.35 ? rnd(150, 260) : kind < 0.9 ? rnd(18, 45) : 4; // lingering / short / barely any
    const wind = rnd(0, 2 * Math.PI), ws = rnd(5, 25); // the wind up there drifts the trail
    const u = {
      ...this.shared,
      uJet: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3(fx, 0, fz) }, uDrift: { value: new THREE.Vector2(Math.sin(wind) * ws, -Math.cos(wind) * ws) },
      uLife: { value: life }, uAge: { value: 0 }, uW0: { value: rnd(45, 65) }, uSpread: { value: life > 100 ? rnd(2, 3.5) : rnd(0.8, 1.4) }, uR: { value: R },
      uOpacity: { value: rnd(0.75, 1) },
    };
    const trail = new THREE.Mesh(this.trailGeo, new THREE.ShaderMaterial({ uniforms: u, vertexShader: TRAIL_VS, fragmentShader: TRAIL_FS, fog: false, side: THREE.DoubleSide, ...behindLand }));
    trail.frustumCulled = false; trail.renderOrder = -1.9;
    const fade = { value: 0 };
    const jet = new THREE.Mesh(this.jetGeo, new THREE.ShaderMaterial({ uniforms: { ...this.shared, uFade: fade }, vertexShader: JET_VS, fragmentShader: JET_FS, fog: false, ...behindLand }));
    jet.frustumCulled = false; jet.renderOrder = -1.85; jet.rotation.y = -h;
    this.group.add(trail, jet);
    const len = 2 * half, s = along * len;
    const j = { x0: cx - fx * half, z0: cz - fz * half, f: { x: fx, z: fz }, y: rnd(9500, 12000), s, len, life, u, trail, jet, fade, age: s / SPEED };
    this.list.push(j);
    return j;
  }
  drop(j) { this.group.remove(j.trail, j.jet); j.trail.material.dispose(); j.jet.material.dispose(); }

  update(dt, cam, race) {
    if (!this.list) return;
    this.clock += dt;
    this.timer -= dt;
    if (this.timer <= 0 && dt > 0) { this.timer = rnd(90, 240); if (this.list.length < MAX) this.spawn(race ? race.player : cam.position); }
    const c = cam.position;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const j = this.list[i];
      j.s += SPEED * dt; j.age += dt;
      if (j.s > j.len + j.life * SPEED) { this.drop(j); this.list.splice(i, 1); continue; } // gone, and her trail with her
      const x = j.x0 + j.f.x * j.s, z = j.z0 + j.f.z * j.s;
      j.u.uJet.value.set(x, j.y, z); j.u.uAge.value = j.age;
      // she's drawn on the sphere, in her direction from the camera, at her angular size
      const v = this._v.set(x - c.x, j.y - c.y, z - c.z), d = v.length();
      j.jet.position.copy(c).addScaledVector(v, R / d);
      j.jet.scale.setScalar((BIG * R) / d);
      j.jet.visible = j.s < j.len;
      const hd = Math.hypot(x - c.x, z - c.z); j.fade.value = 1 - Math.min(1, Math.max(0, (hd - 0.6 * SEE) / (0.4 * SEE)));
    }
  }
}
