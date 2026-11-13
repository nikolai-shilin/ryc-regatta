// Regatta: the 3D picture — sea, sky, boats, marks, wake and the two cameras (drone and helm).
import * as THREE from 'three';
import { D2R, wrap, clamp, lerp, waveHeight, waveSlope, beatAngle, runAngle, HULL, ZONE } from './sim.js';
const SC = HULL / 10.4; // the model is drawn 10.4 m long; a First 40.7 is 12.2 m
import { BoatView, LOOKS, playerLook } from './yacht.js';
import { CommitteeBoat } from './committee.js';
import { Wildlife } from './wildlife.js';
import { Post, Mirror, OVERLAY, MIRRORED } from './post.js';
import { Ocean, OCEAN_GLSL, oceanUniforms, blankOcean } from './ocean.js';
import { skyAt, pickSky, SKY_GLSL, skyUniforms } from './light.js';
export { flagTexture } from './committee.js';

// the sky's colours and the sun: one set of objects that every shader shares; setLight() changes them in place
const SKY_TOP = new THREE.Color('#4f8fcb'), SKY_HORIZON = new THREE.Color('#d6e7f0');
const SUN = new THREE.Vector3(-0.41, 0.57, 0.71).normalize(); // a clear day: from the south-west, behind a boat beating north
const FOG_NEAR = 150, FOG_FAR = 3200;

// the waves (sim.js) drive the water shader, the boats and the buoys alike
const NW = 8, NV = 5; // wave trains shaded / wave trains that move the surface (the short ones would alias on the mesh)
// the chop from the FFT (ocean.js) rides on top of the swell; it fades out far off, where the mesh is too coarse for it
const WATER_VS = /* glsl */ `
uniform float uTime; uniform vec4 uW[8]; uniform float uWs[8], uQ[8]; uniform vec3 uCam;
${OCEAN_GLSL}
varying vec3 vWorld; varying vec2 vXZ; varying float vH;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec2 xz = wp.xz; vec3 off = vec3(0.0);
  for (int i = 0; i < ${NV}; i++) {
    vec2 d = uW[i].xy; float k = uW[i].z, A = uW[i].w;
    float ph = k * dot(d, xz) - uWs[i] * uTime + float(i) * 1.7;
    off.xz += uQ[i] * A * d * cos(ph); off.y += A * sin(ph); // Gerstner: crests pinch, troughs flatten
  }
  vH = off.y;
  off += fftDisp(xz) * (1.0 - smoothstep(180.0, 420.0, length(xz - uCam.xz)));
  wp.xyz += off; vWorld = wp.xyz; vXZ = xz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const WATER_FS = /* glsl */ `
uniform float uTime, uFogNear, uFogFar, uChop, uAmp, uWhite, uGlint, uReflOn; uniform vec4 uW[8]; uniform float uWs[8], uQ[8];
uniform vec3 uCam, uDeep, uScatter; uniform vec4 uGust[12]; uniform vec2 uWind, uPivot;
uniform sampler2D uRefl; uniform mat4 uReflMat;
varying vec3 vWorld; varying vec2 vXZ; varying float vH;
${SKY_GLSL}
${OCEAN_GLSL}
vec4 hash42(vec2 p) { // Dave Hoskins' hash, steady for the course's sizes of coordinate
  vec4 p4 = fract(vec4(p.xyxy) * vec4(0.1031, 0.1030, 0.0973, 0.1099));
  p4 += dot(p4, p4.wzxy + 33.33);
  return fract((p4.xxyz + p4.yzzw) * p4.zywx);
}
vec3 skyAt(vec3 d) {
  d.y = abs(d.y);
  vec3 c = skyBase(d);
#ifndef LOW_Q
  c = withClouds(c, d, uSun, uTime, true).rgb; // the clouds in the reflection
#endif
  return c + uSunCol * pow(max(dot(d, uSun), 0.0), 10.0) * 0.25;
}
void main() {
  vec2 p = vXZ;
  // the wave trains' normal, all eight
  vec3 n = vec3(0.0, 1.0, 0.0);
  for (int i = 0; i < WAVES; i++) {
    vec2 d = uW[i].xy; float k = uW[i].z, A = uW[i].w;
    float ph = k * dot(d, p) - uWs[i] * uTime + float(i) * 1.7, c = cos(ph), s = sin(ph);
    n.xz -= d * k * A * c; n.y -= uQ[i] * k * A * s;
  }
  // the chop: its slopes and where it folds (J < 1 at a sharpening crest)
  vec3 ch = fftSlope(p);
  // gusts: rougher water
  float gust = 0.0;
  for (int i = 0; i < 12; i++) {
    vec2 gd = p - uGust[i].xy; // a gust is longer down the wind than it is wide (uWind: the way it blows)
    float f = clamp(1.0 - length(vec2(dot(gd, uWind) / 1.35, dot(gd, vec2(-uWind.y, uWind.x)))) / max(uGust[i].z, 1.0), 0.0, 1.0);
    gust += f * f * (3.0 - 2.0 * f) * uGust[i].w;
  }
  gust = clamp(gust, 0.0, 1.0);
  // wind ripples: two layers of a noise normal map drifting downwind, fading with distance
  float dist = length(uCam - vWorld);
  vec2 wq = vec2(-uWind.y, uWind.x);
  // wind lanes: long streaks of rougher, brighter water lying along the wind, so a shift shows as the lanes swinging
  // round. They are laid out about the middle of the course (uPivot), so near the boats they turn in place.
  // A slow noise bends each lane from side to side and another breaks it into lengths, with soft edges, so from
  // above they read as ruffled water and not as ruled stripes.
  vec2 pc = p - uPivot, lq = vec2(dot(pc, wq), dot(pc, uWind));
  float bend = texture2D(uRipple, lq / vec2(260.0, 420.0) + vec2(0.37, -uTime * 0.0009)).w - 0.5;
  float lane = smoothstep(0.4, 0.72, texture2D(uRipple, vec2((lq.x + bend * 70.0) / 70.0, lq.y / 800.0 - uTime * 0.0013)).w);
  lane *= 0.3 + 0.7 * smoothstep(0.3, 0.62, texture2D(uRipple, vec2(lq.x / 210.0 + 0.53, lq.y / 230.0 - uTime * 0.0021)).w);
  lane *= 1.0 - smoothstep(250.0, 700.0, dist);
  // two layers of ripples, both drifting downwind (1 and 0.8 m/s); the finer one is laid at an angle so the two never
  // line up, and each layer's slopes are turned back into the world from its own axes
  vec2 a2 = wq * 0.8 + uWind * 0.6, b2 = uWind * 0.8 - wq * 0.6; // the second layer's axes
  vec2 q1 = vec2(dot(p, wq), dot(p, uWind) - uTime * 1.0) / 19.0;
  vec2 q2 = (vec2(dot(p, a2), dot(p, b2)) - uTime * 0.8 * vec2(0.6, 0.8)) / 6.5;
  vec4 t1 = texture2D(uRipple, q1);
  vec2 rw = ((t1.x * 2.0 - 1.0) * wq + (t1.y * 2.0 - 1.0) * uWind) * (1.0 - 0.55 * uFftOn); // ripple slope in world x/z (the chop takes over its band)
#ifdef LOW_Q
  rw *= 1.3;
#else
  vec4 t2 = texture2D(uRipple, q2);
  rw += ((t2.x * 2.0 - 1.0) * a2 + (t2.y * 2.0 - 1.0) * b2) * 0.7;
#endif
  // big, slow patches of rougher and smoother water, so the chop never reads as one repeating tile; they drift downwind
  vec2 pr = vec2(dot(p, vec2(0.83, 0.56)), dot(p, vec2(-0.56, 0.83)));
  vec2 prw = vec2(dot(uWind, vec2(0.83, 0.56)), dot(uWind, vec2(-0.56, 0.83))); // the wind in the same axes
  float patchy = texture2D(uRipple, (pr - prw * uTime * 0.17) / 83.0).w;
  float rs = uChop * (1.0 + 1.6 * gust) * (0.55 + 0.9 * patchy) * (0.7 + 0.8 * lane) / (1.0 + dist / 140.0);
  // the chop's slopes: rougher in a gust and in the rough patches, gone far off where its tile would show
  float fk = (0.75 + 0.6 * gust) * (0.7 + 0.6 * patchy) * (1.0 - smoothstep(350.0, 1100.0, dist));
  n = normalize(vec3(n.x + rw.x * rs - ch.x * fk, n.y, n.z + rw.y * rs - ch.y * fk));
  vec3 V = normalize(uCam - vWorld);
  float cosT = max(dot(n, V), 0.0);
  float F = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
  vec3 R = reflect(-V, n);
  vec3 refl = skyAt(R);
  // the boats, marks and islands in the water: the mirror's picture, rippled by the surface; the sky where it shows none
  if (uReflOn > 0.5) {
    vec4 rc = uReflMat * vec4(vWorld.x, 0.0, vWorld.z, 1.0);
    vec2 ruv = rc.xy / rc.w + n.xz * 0.4 / (1.0 + dist * 0.07);
    vec4 rt = texture2D(uRefl, ruv);
    refl = mix(refl, rt.rgb, rt.a * uReflOn * (1.0 - smoothstep(0.96, 1.0, max(abs(ruv.x - 0.5), abs(ruv.y - 0.5)) * 2.0)));
  }
  // the water body: deep blue, lit turquoise where the crests let the sun through
  vec3 sunFlat = normalize(vec3(uSun.x, 0.0, uSun.z));
  float crest = smoothstep(-0.2, 1.0, vH / max(uAmp, 0.08));
  float sss = crest * (0.35 + 0.65 * max(0.0, dot(-V, sunFlat))) * (1.0 - cosT * 0.5) * (0.6 + 0.8 * patchy);
  vec3 body = uDeep * (0.75 + 0.25 * max(dot(n, uSun), 0.0)) + uScatter * sss * 0.45;
  vec3 col = mix(body, refl, F);
  // the sun: a sharp glint and a broader glitter
  // the sun's glitter. What glints are facets far smaller than the waves drawn here — capillary ripples — each a
  // tiny mirror that shows the sun only while it is tilted just so, for a few hundredths of a second. dS: the
  // slope a facet must have, against the surface's own, to send the sun to the eye. The facets' slopes spread with
  // the wind (Cox–Munk), more in a gust, and more again where the drawn surface itself changes faster than a pixel
  // (nv, specular antialiasing). Close by, the facets are points that flash and go; far off, where many share a
  // pixel, they become their average: the soft glitter path. Both have the same mean, so the change can't be seen.
  vec3 fw = fwidth(n); float nv = clamp(dot(fw, fw), 0.0, 1.0);
  vec3 Hh = normalize(uSun + V);
  float Fh = 0.02 + 0.98 * pow(1.0 - max(dot(V, Hh), 0.0), 5.0);
  vec2 dS = -Hh.xz / max(Hh.y, 0.05) + n.xz / max(n.y, 0.05);
  float U = max(0.0, (uChop - 0.1) * 60.0) * 0.514; // the wind, m/s
  float sm2 = (0.0012 + 0.0011 * U) * (1.0 + 0.8 * gust) + nv * 0.5; // the facets' slope spread (per axis)
  const float SS2 = 0.00035; // the sun's own size, as a spread of slope
  float glit = SS2 / (sm2 + SS2) * exp(-dot(dS, dS) / (2.0 * (sm2 + SS2)));
  // the facets live in cells that grow with the distance (each level twice the last, two levels blended), so a
  // glint stays about a pixel across from the bow out to the horizon; every level keeps the same mean
  float fpm = length(fwidth(p)); // a pixel's width on the water, metres
  float lod = clamp(log2(fpm / 0.02), 0.0, 9.0), l0 = floor(lod);
  float spark = 0.0, far = 1.0;
  for (int L = 0; L < 2; L++) {
    float lv = l0 + float(L), cs = 0.05 * exp2(lv), wl = L == 0 ? 1.0 - fract(lod) : fract(lod);
    vec2 q = (p - uWind * uTime * 0.5) / cs + lv * 17.0; // drifting with the surface water
    vec2 c = floor(q), f = fract(q);
    vec4 h = hash42(c);
    float ph = uTime * (5.0 + 7.0 * h.w) + h.z * 9.0; // each facet keeps its own time
    vec4 g = hash42(c + floor(ph) * vec2(13.7, 7.3)); // a new tilt for each flash
    vec2 r = sqrt(-2.0 * log(max(g.x, 1e-4))) * vec2(cos(6.2832 * g.y), sin(6.2832 * g.y)) * sqrt(sm2);
    float gl = exp(-dot(dS - r, dS - r) / (2.0 * SS2));
    float tw = sin(3.1416 * fract(ph)); tw *= tw; // it brightens and fades
    float fp = fpm / cs, R = 0.2;
    float spot = 1.0 - smoothstep(R - fp * 0.7, R + fp * 0.7, length(f - (0.25 + 0.5 * h.xy)));
    spark += wl * gl * tw * spot / (3.1416 * R * R * 0.5);
    if (L == 1) far = 1.0 - smoothstep(0.6, 1.2, fp); // past the last level: the average
  }
  glit = mix(glit, spark, far);
  col += uSunCol * uGlint * min(Fh * 70.0 * glit, 14.0); // capped: a glint blooms into a small star, not a lamp
  // whitecaps: a few waves break here and there — on a crest, where a slow patch of the noise says so — with a
  // ragged edge, and leave fading foam behind them. Nothing stretched or small-tiled, so no rows of dashes.
  // the noise is read across and along the wind (pa), so a breaker is a short ragged line along the crest, not a blob
  vec2 pa = vec2(dot(p, wq), dot(p, uWind));
#ifdef LOW_Q
  float edge = t1.w;
#else
  float edge = texture2D(uRipple, vec2(pa.x / 9.0, pa.y / 3.2) - vec2(0.0, uTime * 0.03)).w;
#endif
  float brk = texture2D(uRipple, vec2(pa.x / 46.0, pa.y / 20.0) - vec2(0.0, uTime * 0.012)).w; // where a wave is breaking now
  float fold = smoothstep(0.9, 0.35, ch.z); // the chop folding over its own crest
  float wv = 1.3 * crest + 3.0 * brk + 2.0 * edge + 0.4 * gust + 1.4 * fold;
  float cap = smoothstep(4.45, 4.95, wv) * uWhite * (0.4 + 0.45 * t1.w); // a soft edge; foam isn't flat white
  float halo = smoothstep(4.2, 4.6, wv) * uWhite; // the aerated, paler water just round a breaking crest
  col = mix(col, col * 0.7 + uScatter * 0.45, halo * 0.3);
  // old foam: thin streaks lying downwind of the breakers
  float streak = texture2D(uRipple, vec2(pa.x / 4.5, pa.y / 45.0 - uTime * 0.005)).w;
  float wisp = smoothstep(0.66, 0.86, 0.6 * brk + 0.4 * streak) * smoothstep(0.5, 0.7, patchy) * uWhite * 0.12 * (1.0 - smoothstep(60.0, 350.0, dist));
  col = mix(col, vec3(0.86, 0.91, 0.94), clamp(cap * 0.7 + wisp, 0.0, 1.0));
  col = mix(col, col * 1.2 + vec3(0.03, 0.045, 0.06), lane * 0.55); // the lanes catch a little more light
  col *= 1.0 - 0.22 * gust; // a gust reads as a darker patch
  // the haze: the sky's own colour at the horizon in that direction, so the sea melts into it (warmer towards the sun)
  vec3 hz = normalize(vec3(-V.x, 0.0, -V.z) + vec3(0.0, 0.001, 0.0));
  col = mix(col, skyBase(hz), smoothstep(uFogNear, uFogFar, dist));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// distance lines across the beat: from the windward mark down to the start line, every 50 m (100 m on a long course),
// each a line like the start line, with its distance to the mark written at both ends. They widen with the distance, as the laylines do.
export const ladderStep = (beat) => (beat > 600 ? 100 : 50);
function ladder(c) {
  const g = new THREE.Group(), beat = -c.windward.z, step = ladderStep(beat);
  for (let d = step; d < beat - 15; d += step) {
    const z = c.windward.z + d, half = Math.min(260, 30 + d * 0.95);
    const line = new THREE.Mesh(lineStrip(2 * half), lineMat());
    line.position.set(c.windward.x, 0.65, z); line.renderOrder = 1; g.add(line);
    // the distance, just past each end of the line
    const lc = document.createElement('canvas'); lc.width = 160; lc.height = 56;
    const x = lc.getContext('2d'), text = `${d} m`;
    x.font = '700 30px Carlito, Lato, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const w = x.measureText(text).width + 26;
    x.fillStyle = 'rgba(0,0,0,0.38)'; x.beginPath(); x.roundRect((160 - w) / 2, 8, w, 40, 20); x.fill();
    x.fillStyle = '#fff'; x.fillText(text, 80, 29);
    const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(lc), transparent: true, depthWrite: false, fog: true, toneMapped: false });
    for (const sd of [-1, 1]) { const s = new THREE.Sprite(mat); s.scale.set(13, 4.55, 1); s.position.set(c.windward.x + sd * (half + 7), 3.2, z); g.add(s); }
  }
  return g;
}

// the laylines to the windward mark: two lines like the start line, from the edge of its zone down each side of the beat,
// far enough to reach below the start line. Each is a long strip, laid on the waves and turned to the wind every frame.
class Laylines {
  constructor(c, tws) {
    this.m = c.windward; this.up = beatAngle(tws) * D2R;
    const L = (-c.windward.z + 80) / Math.cos(this.up), N = Math.ceil(L / 4), HW = LINE_W / 2; // 4 m pieces
    this.v = []; // per vertex: distance from the mark, offset across
// every line drawn on the water — the start line, the distance lines, the laylines, the zones round the marks — looks
// the same: white dashes half a metre wide, one every 5 m, faint enough that the sea reads through them
const LINE_W = 0.5, DASH = 5, DASH_ON = 0.6, LINE_A = 0.2;
let dashMat = null;
function lineMat() { // one material for all the straight lines; their UVs count in dashes
  if (dashMat) return dashMat;
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 4;
  const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, Math.round(64 * DASH_ON), 4);
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = THREE.RepeatWrapping;
  return (dashMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: LINE_A, depthWrite: false, side: THREE.DoubleSide, fog: true }));
}
function lineStrip(len) { // a straight line len metres long, lying flat along x
  const g = new THREE.PlaneGeometry(len, LINE_W).rotateX(-Math.PI / 2), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) * len) / DASH);
  return g;
}

    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const d = ZONE + (i / N) * L;
      for (const o of [-HW, HW]) { this.v.push(d, o); pos.push(0, 0, 0); uv.push(d / DASH, o < 0 ? 0 : 1); }
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const mat = lineMat();
    this.group = new THREE.Group();
    this.lines = [-1, 1].map((sd) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos.slice(), 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.userData.sd = sd;
      this.group.add(mesh); return mesh;
    });
  }
  // W: where the wind blows from now. A boat close-hauled heading hd lays the mark from anywhere on the line that runs
  // from the mark back the way she came: (−sin hd, cos hd)
  update(Wv, W, t) {
    for (const mesh of this.lines) {
      const hd = W + mesh.userData.sd * this.up, ux = -Math.sin(hd), uz = Math.cos(hd), P = mesh.geometry.attributes.position;
      for (let i = 0; i < this.v.length / 2; i++) {
        const d = this.v[i * 2], o = this.v[i * 2 + 1], x = this.m.x + ux * d - uz * o, z = this.m.z + uz * d + ux * o;
        P.setXYZ(i, x, waveHeight(Wv, x, z, t) + 0.15, z);
      }
      P.needsUpdate = true;
    }
  }
}

// the zone round the gate and wing marks — three hull lengths (none at the windward mark: no mark-room there) — as a ring of dashes riding the waves,
// dashed like the other lines: one mesh for all of them; the rings of the mark you sail for now are as bright as the lines, the others fainter
const RING_ON = LINE_A, RING_OFF = LINE_A * 0.4;
class ZoneRings {
  constructor(marks) {
    const N = Math.round((2 * Math.PI * ZONE) / DASH), pos = [], col = [], idx = [], hw = LINE_W / 2;
    this.marks = marks; this.v = [];
    marks.forEach((m, k) => {
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * 2 * Math.PI, a1 = ((i + DASH_ON) / N) * 2 * Math.PI, o = pos.length / 3;
        for (const [a, r] of [[a0, ZONE - hw], [a0, ZONE + hw], [a1, ZONE - hw], [a1, ZONE + hw]]) { this.v.push(k, Math.sin(a) * r, -Math.cos(a) * r); pos.push(0, 0, 0); col.push(1, 1, 1, RING_OFF); }
        idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 2;
    this.next = -1;
  }
  update(W, t, next) { // next: the indexes of the marks you sail for now
    const g = this.mesh.geometry, P = g.attributes.position, C = g.attributes.color, key = next.join();
    for (let i = 0; i < this.v.length / 3; i++) {
      const m = this.marks[this.v[i * 3]], x = m.x + this.v[i * 3 + 1], z = m.z + this.v[i * 3 + 2];
      P.setXYZ(i, x, waveHeight(W, x, z, t) + 0.12, z);
      if (key !== this.next) C.setW(i, next.includes(this.v[i * 3]) ? RING_ON : RING_OFF);
    }
    P.needsUpdate = true; if (key !== this.next) { C.needsUpdate = true; this.next = key; }
  }
}

// a tileable noise height field → normal map (rgb) with the height kept in alpha, for the wind ripples
function rippleTexture(N = 256) {
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const h = new Float32Array(N * N);
  for (const [f, a] of [[4, 1], [8, 0.55], [16, 0.32], [32, 0.18], [64, 0.1]]) {
    const g = Array.from({ length: f * f }, rnd);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = (x / N) * f, fy = (y / N) * f, x0 = Math.floor(fx), y0 = Math.floor(fy);
      const sx = fx - x0, sy = fy - y0, ux = sx * sx * (3 - 2 * sx), uy = sy * sy * (3 - 2 * sy);
      const at = (i, j) => g[((j % f) * f) + (i % f)];
      const v = lerp(lerp(at(x0, y0), at(x0 + 1, y0), ux), lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), ux), uy);
      h[y * N + x] += v * a;
    }
  }
  let lo = 1e9, hi = -1e9; for (const v of h) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const data = new Uint8Array(N * N * 4), H = (x, y) => h[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * 6, dy = (H(x, y + 1) - H(x, y - 1)) * 6, l = Math.hypot(dx, dy, 1);
    const o = (y * N + x) * 4;
    data[o] = (-dx / l * 0.5 + 0.5) * 255; data[o + 1] = (-dy / l * 0.5 + 0.5) * 255; data[o + 2] = (1 / l * 0.5 + 0.5) * 255;
    data[o + 3] = ((H(x, y) - lo) / (hi - lo)) * 255;
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}

// ---------- the wake ----------
// Ribbons laid along each boat's real track (sampled as she sails, so the wake curves when she turns):
// the wash — churned, aerated water with broken foam straight behind the stern, widening and fading — and the two
// arms of the Kelvin wake, thin broken foam lines spreading at about 19.5° either side from the bow.
const WAKE_N = 64, WAKE_DT = 0.3, WAKE_AGE = WAKE_N * WAKE_DT; // samples, seconds apart, seconds of wake
const WAKE_VS = /* glsl */ `
attribute float aAge, aSide, aKind, aStr; varying float vAge, vSide, vKind, vStr; varying vec2 vXZ;
${OCEAN_GLSL}
void main() { vAge = aAge; vSide = aSide; vKind = aKind; vStr = aStr; vec4 wp = modelMatrix * vec4(position, 1.0); vXZ = wp.xz; wp.y += fftDisp(wp.xz).y; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const WAKE_FS = /* glsl */ `
uniform sampler2D uRipple; uniform float uTime, uMax; uniform vec2 uWind;
varying float vAge, vSide, vKind, vStr; varying vec2 vXZ;
void main() {
  float k = clamp(vAge / uMax, 0.0, 1.0), edge = clamp(1.0 - abs(vSide), 0.0, 1.0); // clamped: pow() of a hair below 0 is NaN
  // the foam's texture drifts slowly downwind with the surface water
  float n1 = texture2D(uRipple, (vXZ - uWind * uTime * 0.25) / 3.2).w, n2 = texture2D(uRipple, (vXZ - uWind * uTime * 0.35) / 1.1).w;
  float a; vec3 col;
  if (vKind < 0.5) {
    // the wash: aerated turquoise water under foam that breaks up and thins as it ages and spreads
    float foam = smoothstep(0.42, 0.78, n1 * 0.55 + n2 * 0.45 + (1.0 - k) * 0.42 - (1.0 - edge) * 0.55);
    float aer = edge * edge * (1.0 - k) * (1.0 - k) * 0.1 * (1.0 - smoothstep(0.0, 1.0, k * 2.0));
    col = mix(vec3(0.22, 0.45, 0.52), vec3(0.93, 0.96, 0.98), foam);
    a = max(foam * (1.0 - k) * 0.95, aer) * smoothstep(0.0, 0.25, edge);
  } else {
    // a Kelvin arm: a thin crest line, broken by the noise
    float line = pow(edge, 2.2) * smoothstep(0.3, 0.7, n2 * 0.7 + n1 * 0.4);
    col = vec3(0.9, 0.94, 0.97);
    a = line * (1.0 - k) * (1.0 - k) * 0.55;
  }
  a *= vStr * min(1.0, vAge * 3.0 + 0.4);
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`;
class Wake {
  constructor(scene, uniforms) {
    this.trail = []; this.acc = 0;
    const n = 3 * WAKE_N * 2, g = new THREE.BufferGeometry(); // 3 ribbons, two edges each
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    for (const a of ['aAge', 'aSide', 'aKind', 'aStr']) g.setAttribute(a, new THREE.BufferAttribute(new Float32Array(n), 1));
    const idx = [];
    for (let r = 0; r < 3; r++) for (let i = 0; i < WAKE_N - 1; i++) { const a = (r * WAKE_N + i) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms, vertexShader: WAKE_VS, fragmentShader: WAKE_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 2;
    scene.add(this.mesh);
  }
  dispose(scene) { scene.remove(this.mesh); this.mesh.geometry.dispose(); }
  update(b, dt, t, W) {
    // a new sample every WAKE_DT seconds; the newest point always rides with the boat
    this.acc += dt;
    const here = { x: b.x, z: b.z, h: b.h, v: b.v, born: t };
    if (!this.trail.length || this.acc >= WAKE_DT) { this.acc = 0; this.trail.unshift(here); if (this.trail.length > WAKE_N) this.trail.pop(); }
    else this.trail[0] = here;
    const g = this.mesh.geometry, P = g.attributes.position, AG = g.attributes.aAge, SD = g.attributes.aSide, KD = g.attributes.aKind, ST = g.attributes.aStr;
    for (let r = 0; r < 3; r++) for (let i = 0; i < WAKE_N; i++) {
      const s = this.trail[Math.min(i, this.trail.length - 1)], age = Math.max(0, t - s.born);
      const fx = Math.sin(s.h), fz = -Math.cos(s.h), rx = Math.cos(s.h), rz = Math.sin(s.h);
      const str = clamp((s.v - 0.6) / 3.5, 0, 1) * (i < this.trail.length ? 1 : 0);
      let cx, cz, half;
      if (r === 0) { cx = s.x - fx * 5.0 * SC; cz = s.z - fz * 5.0 * SC; half = 0.7 + age * 0.12; } // wash, from the transom
      else {
        const side = r === 1 ? 1 : -1, out = 1.0 + 0.354 * s.v * age; // tan 19.5° ≈ 0.354: the arms spread as the waves travel
        cx = s.x + fx * 4.2 * SC + rx * side * out; cz = s.z + fz * 4.2 * SC + rz * side * out; half = 0.28 + age * 0.04;
      }
      for (let e = 0; e < 2; e++) {
        const o = (r * WAKE_N + i) * 2 + e, sd = e ? 1 : -1, x = cx + rx * sd * half, z = cz + rz * sd * half;
        P.setXYZ(o, x, waveHeight(W, x, z, t) + 0.07, z);
        AG.setX(o, age); SD.setX(o, sd); KD.setX(o, r ? 1 : 0); ST.setX(o, str);
      }
    }
    P.needsUpdate = AG.needsUpdate = SD.needsUpdate = KD.needsUpdate = ST.needsUpdate = true;
  }
}

// where the hull meets the sea: a patch of water riding the waves round each hull, with the water darkened against
// the topsides, a band of foam along the waterline that breaks up in the noise, and the bow wave — the band widens
// at the bow and with speed. Local coordinates aL: metres along (+ towards the bow) and across.
const CONTACT_VS = /* glsl */ `
attribute vec2 aL; varying vec2 vL, vXZ;
${OCEAN_GLSL}
void main() { vL = aL; vXZ = position.xz; gl_Position = projectionMatrix * viewMatrix * vec4(position + vec3(0.0, fftDisp(position.xz).y, 0.0), 1.0); }`;
const CONTACT_FS = /* glsl */ `
uniform sampler2D uRipple; uniform float uTime, uSpd; uniform vec2 uWind; varying vec2 vL, vXZ;
const float HL = 5.6, HB = 1.75; // half the waterline's length and beam
void main() {
  float s = vL.x / HL, ay = abs(vL.y), d;
  if (s > 1.0) d = length(vec2(vL.x - HL, vL.y)); // ahead of the stem
  else if (s < -1.0) d = max(ay - HB * 0.88, -vL.x - HL); // behind the transom
  else d = ay - (s > 0.0 ? HB * sqrt(max(0.0, 1.0 - s * s)) : HB * (1.0 - 0.12 * s * s)); // metres outside the hull
  if (d < -0.15) discard;
  float bow = smoothstep(-0.1, 0.9, s);
  float n = texture2D(uRipple, (vXZ - uWind * uTime * 0.25) / 1.6).w * 0.6 + texture2D(uRipple, (vXZ - uWind * uTime * 0.4) / 0.6).w * 0.4; // drifting downwind
  float w = 0.35 + uSpd * (0.5 + 2.6 * bow); // the foam band: wider at the bow and with speed
  float band = exp(-max(d, 0.0) / w);
  float crest = exp(-pow((d - w * 0.9) / (0.25 + 0.3 * w), 2.0)) * bow * uSpd; // the bow wave's crest, pushed out from the stem
  float foam = smoothstep(0.42, 0.72, band * (0.6 + 0.4 * uSpd) + crest * 0.7 + n * 0.55 - 0.25) * (0.4 + 0.6 * uSpd);
  float shade = (1.0 - smoothstep(-0.2, 2.0, d)) * 0.38;
  float a = max(foam * 0.9, shade);
  if (a < 0.01) discard;
  gl_FragColor = vec4(mix(vec3(0.02, 0.08, 0.11), vec3(0.93, 0.96, 0.98), foam / max(foam + shade, 0.001)), a);
}`;
class HullContact {
  constructor(scene, uniforms) {
    const NA = 28, NC = 10, A0 = -7.8, A1 = 8.4, C = 4.0, aL = [], idx = [];
    for (let i = 0; i <= NA; i++) for (let j = 0; j <= NC; j++) aL.push(lerp(A0, A1, i / NA), lerp(-C, C, j / NC));
    for (let i = 0; i < NA; i++) for (let j = 0; j < NC; j++) { const a = i * (NC + 1) + j, b = a + NC + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(aL.length * 1.5), 3));
    g.setAttribute('aL', new THREE.Float32BufferAttribute(aL, 2));
    g.setIndex(idx);
    this.u = { uRipple: uniforms.uRipple, uTime: uniforms.uTime, uWind: uniforms.uWind, uSpd: { value: 0 },
      uFftD: uniforms.uFftD, uFftS: uniforms.uFftS, uFftOn: uniforms.uFftOn, uFftL: uniforms.uFftL, uFftW: uniforms.uFftW };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: CONTACT_VS, fragmentShader: CONTACT_FS, transparent: true, depthWrite: false }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 2;
    scene.add(this.mesh);
  }
  dispose(scene) { scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
  update(b, t, W) {
    const g = this.mesh.geometry, P = g.attributes.position, L = g.attributes.aL;
    const fx = Math.sin(b.h), fz = -Math.cos(b.h), rx = Math.cos(b.h), rz = Math.sin(b.h);
    for (let i = 0; i < P.count; i++) {
      const a = L.getX(i), c = L.getY(i), x = b.x + fx * a + rx * c, z = b.z + fz * a + rz * c;
      P.setXYZ(i, x, waveHeight(W, x, z, t) + 0.05, z);
    }
    P.needsUpdate = true;
    this.u.uSpd.value = clamp(b.v / 4.5, 0, 1);
  }
}

// the sails' shadow on the sea: each sail's own cloth, cast along the sun onto the waves (the water takes no shadow
// map). It is laid on the same wave trains that move the water mesh, a little above them; the stencil darkens each
// pixel once, so where main and jib (and both faces of a sail) overlap the shade doesn't double.
const SEASHADE_VS = /* glsl */ `
uniform float uTime; uniform vec4 uW[8]; uniform float uWs[8]; uniform vec3 uSun;
varying float vUp; varying vec3 vPos;
${OCEAN_GLSL}
float seaY(vec2 xz) {
  float h = 0.0;
  for (int i = 0; i < ${NV}; i++) h += uW[i].w * sin(uW[i].z * dot(uW[i].xy, xz) - uWs[i] * uTime + float(i) * 1.7);
  return h;
}
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec2 xz = wp.xz - uSun.xz * wp.y / uSun.y; // onto the level sea
  float h = seaY(xz);
  xz = wp.xz - uSun.xz * (wp.y - h) / uSun.y; // and again onto the wave there
  vUp = wp.y - h; vPos = vec3(xz.x, seaY(xz) + fftDisp(xz).y + 0.15, xz.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 1.0);
}`;
// the shade: what a shadow dims is the light from under the surface, not the sky the sea reflects — so it is faint
// seen low across the water and plainest from above; and it fades towards the head of the sail, where the
// penumbra spreads it thin
const SEASHADE_FS = /* glsl */ `
uniform float uShade; varying float vUp; varying vec3 vPos;
void main() {
  float down = abs(normalize(cameraPosition - vPos).y);
  float a = 0.38 * uShade * mix(0.2, 1.0, smoothstep(0.05, 0.55, down)) * (1.0 - 0.75 * smoothstep(6.0, 19.0, vUp));
  gl_FragColor = vec4(0.0, 0.03, 0.06, a);
}`;
class SeaShadows {
  constructor(scene, view, mat) {
    this.list = [view.main, view.jib, view.kite].map((grp) => {
      const m = new THREE.Mesh(grp.userData.g, mat); // the sail's own geometry, so it follows the trim and the flogging
      m.matrixAutoUpdate = false; m.frustumCulled = false; m.renderOrder = 1; // placed by hand: see update
      scene.add(m);
      return { m, grp };
    });
  }
  update(on) {
    for (const { m, grp } of this.list) {
      m.visible = on && grp.visible;
      if (m.visible) { grp.updateWorldMatrix(true, false); m.matrix.copy(grp.matrixWorld); } // the scene is the parent, so this is its place in the world
    }
  }
  dispose(scene) { for (const { m } of this.list) scene.remove(m); }
}

// foam and spray as soft points, each with its own size and fade
const FOAM_VS = /* glsl */ `
attribute float aAlpha, aSize; uniform float uScale; varying float vA;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vA = aAlpha; gl_PointSize = aSize * uScale / max(-mv.z, 0.5); gl_Position = projectionMatrix * mv; }`;
const FOAM_FS = /* glsl */ `
uniform sampler2D uMap; varying float vA;
void main() { vec4 t = texture2D(uMap, gl_PointCoord); if (t.a * vA < 0.01) discard; gl_FragColor = vec4(vec3(0.95, 0.97, 1.0), t.a * vA); }`;
function foamSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) { // a cluster of bubbles, thicker in the middle
    const r = rnd() * 22, a = rnd() * 7, cx = 32 + Math.cos(a) * r, cy = 32 + Math.sin(a) * r, s = 3 + rnd() * 7;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, s);
    g.addColorStop(0, `rgba(255,255,255,${0.5 - r / 60})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(cx - s, cy - s, s * 2, s * 2);
  }
  return new THREE.CanvasTexture(c);
}

// A disc of water, dense in the middle and sparse at the edge; it follows the camera.
function waterGeometry(R = 3000, rings = 200, segs = 256) {
  const pos = [0, 0, 0], idx = [];
  for (let i = 1; i <= rings; i++) {
    const r = R * (i / rings) ** 2.6;
    for (let j = 0; j < segs; j++) { const a = (j / segs) * Math.PI * 2; pos.push(Math.cos(a) * r, 0, Math.sin(a) * r); }
  }
  for (let j = 0; j < segs; j++) idx.push(0, 1 + ((j + 1) % segs), 1 + j);
  for (let i = 1; i < rings; i++) {
    const a0 = 1 + (i - 1) * segs, a1 = 1 + i * segs;
    for (let j = 0; j < segs; j++) {
      const j1 = (j + 1) % segs;
      idx.push(a0 + j, a0 + j1, a1 + j, a0 + j1, a1 + j1, a1 + j);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

const SKY_FS = /* glsl */ `
uniform float uTime, uDisc; varying vec3 vDir;
${SKY_GLSL}
void main() {
  vec3 d = normalize(vDir);
  vec3 col = skyBase(d);
  vec4 cl = withClouds(col, d, uSun, uTime, false);
  col = cl.rgb;
  float s = max(dot(d, uSun), 0.0);
  col += uSunCol * (pow(s, 800.0) * 6.0 * uDisc * (1.0 - cl.a) + pow(s, 12.0) * 0.25); // the disc hides behind a cloud
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// an inflatable racing mark: a glossy PVC cylinder in eight panels, each blown out a little between its seams, its
// top rounded over to a slight dome with a lifting handle on it, sitting a fifth of its height in the water, with a
// wet, greener band at the waterline (it lives out there). R: its radius; it is 2.1 R tall above the water.
const BUOY_PANELS = 8;
function buoy(color = '#ff7a1a', R = 1.05) {
  const g = new THREE.Group();
  const H = 2.1 * R, base = -0.45 * R, fil = 0.32 * R, pts = [];
  pts.push(new THREE.Vector2(0.001, base), new THREE.Vector2(R * 0.82, base), new THREE.Vector2(R * 0.97, base + 0.08 * R));
  for (let i = 0; i <= 10; i++) pts.push(new THREE.Vector2(R, base + 0.16 * R + (H - fil - base - 0.16 * R) * (i / 10)));
  for (let i = 1; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; pts.push(new THREE.Vector2(R - fil + Math.cos(a) * fil, H - fil + Math.sin(a) * fil)); }
  for (let i = 1; i <= 4; i++) { const f = i / 4; pts.push(new THREE.Vector2((R - fil) * (1 - f) + 0.001, H + 0.07 * R * Math.sin(f * Math.PI / 2))); }
  const geo = new THREE.LatheGeometry(pts, BUOY_PANELS * 8);
  const P = geo.attributes.position, col = [], c0 = new THREE.Color(color), wet = new THREE.Color(color).multiplyScalar(0.55).lerp(new THREE.Color('#4d5a2e'), 0.35), c = new THREE.Color();
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), r = Math.hypot(x, z);
    if (r > 0.05) { // the panels: full in the middle, drawn in at the seams
      const s = ((Math.atan2(z, x) / (2 * Math.PI)) * BUOY_PANELS + 100) % 1, k = 0.95 + 0.05 * Math.sqrt(Math.sin(Math.PI * s));
      P.setX(i, x * k); P.setZ(i, z * k);
    }
    c.copy(c0).lerp(wet, 1 - THREE.MathUtils.smoothstep(y, -0.05, 0.12)); // the waterline
    c.multiplyScalar(1 - 0.12 * (1 - THREE.MathUtils.smoothstep(y, 0.1, 0.45))); // still wet just above it
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.28 }));
  body.castShadow = body.receiveShadow = true; g.add(body);
  const rubber = new THREE.MeshStandardMaterial({ color: '#23262b', roughness: 0.7 });
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.17 * R, 0.035 * R, 8, 20, Math.PI), rubber);
  handle.position.y = H + 0.06 * R; g.add(handle);
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * R, 0.08 * R, 0.05 * R, 12), rubber);
  valve.position.set(0.32 * R, H + 0.03 * R, 0.1 * R); g.add(valve);
  g.userData.R = R;
  return g;
}

// where a mark meets the sea: a ring of water round it that rides the waves, darker against the PVC, with a band of
// foam where the chop slaps against it — wider on the side the wind and the waves come from
const MARK_FS = /* glsl */ `
uniform sampler2D uRipple; uniform float uTime, uR; uniform vec2 uWind; varying vec2 vL, vXZ;
void main() {
  float d = length(vL) - uR;
  if (d < -0.04) discard;
  float n = texture2D(uRipple, (vXZ - uWind * uTime * 0.3) / 1.3).w * 0.6 + texture2D(uRipple, (vXZ - uWind * uTime * 0.5) / 0.45).w * 0.4;
  float up = 0.5 - 0.5 * dot(normalize(vL + 1e-4), uWind); // 1 on the side the waves come from
  float w = 0.12 + 0.28 * up;
  float slap = 0.6 + 0.4 * sin(uTime * 2.1 + atan(vL.y, vL.x) * 2.0 + n * 5.0); // the chop reaching it in turn round its side
  float foam = smoothstep(0.5, 0.95, exp(-max(d, 0.0) / w) * slap + n * 0.65 - 0.3) * 0.7;
  float shade = (1.0 - smoothstep(-0.04, 0.7, d)) * 0.32;
  float a = max(foam, shade) * (1.0 - smoothstep(1.2, 2.0, d));
  if (a < 0.01) discard;
  gl_FragColor = vec4(mix(vec3(0.02, 0.07, 0.1), vec3(0.93, 0.96, 0.98), foam / max(foam + shade, 0.001)), a);
}`;
class MarkContact {
  constructor(R, uniforms) {
    const NA = 40, NR = 7, R1 = R + 2.2, aL = [], idx = [];
    for (let j = 0; j <= NR; j++) for (let i = 0; i < NA; i++) { const a = (i / NA) * 2 * Math.PI, r = R * 0.94 + (R1 - R * 0.94) * (j / NR) ** 1.6; aL.push(Math.cos(a) * r, Math.sin(a) * r); }
    for (let j = 0; j < NR; j++) for (let i = 0; i < NA; i++) { const a = j * NA + i, b = j * NA + ((i + 1) % NA); idx.push(a, b, a + NA, b, b + NA, a + NA); } // facing up
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(aL.length * 1.5), 3));
    g.setAttribute('aL', new THREE.Float32BufferAttribute(aL, 2));
    g.setIndex(idx);
    this.u = { uRipple: uniforms.uRipple, uTime: uniforms.uTime, uWind: uniforms.uWind, uR: { value: R },
      uFftD: uniforms.uFftD, uFftS: uniforms.uFftS, uFftOn: uniforms.uFftOn, uFftL: uniforms.uFftL, uFftW: uniforms.uFftW };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: CONTACT_VS, fragmentShader: MARK_FS, transparent: true, depthWrite: false }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 2;
  }
  update(p, t, W) {
    const P = this.mesh.geometry.attributes.position, L = this.mesh.geometry.attributes.aL;
    for (let i = 0; i < P.count; i++) { const x = p.x + L.getX(i), z = p.z + L.getY(i); P.setXYZ(i, x, waveHeight(W, x, z, t) + 0.04, z); }
    P.needsUpdate = true;
  }
}

// the stream past a mark: the water piles up on its up-tide side and runs off it in a V of ripples and a streak of
// foam, as a moored buoy shows a sailor which way the tide runs and how hard. Apex at the top of the texture.
let veeTex = null;
function currentVee() {
  if (!veeTex) {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256;
    const x = cv.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.strokeStyle = g; x.lineCap = 'round'; x.filter = 'blur(1.5px)';
    x.lineWidth = 4; x.beginPath(); x.moveTo(32, 8); x.lineTo(6, 250); x.moveTo(32, 8); x.lineTo(58, 250); x.stroke();
    x.lineWidth = 9; x.globalAlpha = 0.55; x.beginPath(); x.moveTo(32, 10); x.lineTo(32, 170); x.stroke();
    x.globalAlpha = 0.8; x.lineWidth = 3; x.beginPath(); x.arc(32, 22, 16, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); // the pressure wave up-tide
    veeTex = new THREE.CanvasTexture(cv);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: veeTex, transparent: true, depthWrite: false, opacity: 0, fog: true }));
  m.renderOrder = 2; m.visible = false;
  return m;
}

// an island: a ridge of hills whose height rises and falls round it in a few smooth waves, green low down and bare
// rock higher up; the haze (the fog) pales the far ones towards the sky
// put an object (and all of it: layers are tested per mesh) in what the sea reflects
function mirrored(obj) { obj.traverse((o) => o.layers.enable(MIRRORED)); return obj; }

function island(rand, R, H, color) {
  const NA = 48, NR = 7, pos = [], col = [], idx = [];
  const ph = [rand() * 6, rand() * 6, rand() * 6, rand() * 6], sx = 1 + rand() * 0.8; // longer one way than the other
  const ridge = (a) => 0.7 + 0.22 * Math.sin(a * 2 + ph[0]) + 0.12 * Math.sin(a * 5 + ph[1]) + 0.06 * Math.sin(a * 9 + ph[2]);
  const green = new THREE.Color(color), rock = new THREE.Color('#9c9784'), c = new THREE.Color();
  pos.push(0, H * 0.72, 0); col.push(rock.r, rock.g, rock.b);
  for (let j = 1; j <= NR; j++) {
    const q = j / NR; // the summit … the shore
    for (let i = 0; i < NA; i++) {
      const a = (i / NA) * Math.PI * 2, r = R * q * (0.85 + 0.3 * Math.sin(a * 3 + ph[3]));
      const y = j === NR ? -6 : H * ridge(a) * (1 - q ** 1.5) + (rand() - 0.5) * H * 0.04;
      pos.push(Math.cos(a) * r * sx, y, Math.sin(a) * r);
      c.copy(green).lerp(rock, clamp((y / H - 0.35) * 1.6, 0, 1)); col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < NA; i++) idx.push(0, 1 + ((i + 1) % NA), 1 + i);
  for (let j = 1; j < NR; j++) {
    const a0 = 1 + (j - 1) * NA, a1 = 1 + j * NA;
    for (let i = 0; i < NA; i++) { const i1 = (i + 1) % NA; idx.push(a0 + i, a0 + i1, a1 + i, a0 + i1, a1 + i1, a1 + i); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}

// ---------- guides around your boat ----------
// Built with the wind from the north and turned to the wind each frame: a ring, faint enough to read the sea through: red where she can't sail (too close to the wind), green marks
// at the best angle upwind on each tack, blue marks at the best angle downwind on each gybe; a white pointer for
// your heading. Compass c in this frame sits at ring angle π/2 − c.
const R_IN = 10.5, R_OUT = 12.4;
const glass = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, fog: false });
const sector = (r0, r1, c0, c1, mat) => new THREE.Mesh(new THREE.RingGeometry(r0, r1, Math.max(6, Math.ceil(Math.abs(c1 - c0) / (2 * D2R))), 1, Math.PI / 2 - c1, c1 - c0).rotateX(-Math.PI / 2), mat);
function guides(tws) {
  const g = new THREE.Group(), turn = new THREE.Group(); g.add(turn); // turn: rotated to the wind
  const beat = beatAngle(tws) * D2R, run = runAngle(tws) * D2R;
  turn.add(sector(R_IN, R_OUT, -beat, beat, glass('#ff4d3d', 0.14))); // no-go: too close to the wind
  for (const sd of [-1, 1]) {
    // thin and half-see-through, only a touch beyond the ring: read at a glance without shouting over the sea
    turn.add(sector(R_IN - 0.15, R_OUT + 0.25, sd * beat - 1.2 * D2R, sd * beat + 1.2 * D2R, glass('#2ee6a0', 0.22))); // best upwind
    turn.add(sector(R_IN - 0.15, R_OUT + 0.25, sd * run - 1.2 * D2R, sd * run + 1.2 * D2R, glass('#3aa8ff', 0.22))); // best downwind
  }
  turn.add(sector(R_IN, R_OUT, Math.PI - (Math.PI - run), Math.PI + (Math.PI - run), glass('#3aa8ff', 0.06))); // the slow dead run between the gybes
  const tick = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.4, 3).rotateX(-Math.PI / 2), glass('#ffffff', 0.5)); // your heading
  g.add(tick);
  // every piece is draped on the sea each frame (see drapeGuides), so the dial lies on the water as one layer: it
  // rides the waves instead of floating flat above the troughs and being cut by the crests
  const drape = [];
  for (const o of [turn, tick]) o.traverse((m) => {
    if (!m.isMesh) return;
    m.renderOrder = Math.max(m.renderOrder, 2); m.frustumCulled = false;
    m.userData.base = m.geometry.attributes.position.array.slice(); drape.push(m);
  });
  g.userData = { turn, tick, drape };
  return g;
}

// lay the guides on the waves: each vertex at the sea's height under it, a hand's breadth up (the guides group sits
// at y = 0 and only turns about the vertical, so a vertex's local height is its height in the world)
const GUIDE_LIFT = 0.18;
function drapeGuides(G, W, t) {
  G.updateMatrixWorld(true);
  for (const m of G.userData.drape) {
    const P = m.geometry.attributes.position, B = m.userData.base, e = m.matrixWorld.elements;
    for (let i = 0, j = 0; i < P.count; i++, j += 3) {
      const x = B[j], y = B[j + 1], z = B[j + 2];
      P.array[j + 1] = y + waveHeight(W, e[0] * x + e[4] * y + e[8] * z + e[12], e[2] * x + e[6] * y + e[10] * z + e[14], t) + GUIDE_LIFT;
    }
    P.needsUpdate = true;
  }
}

// ---------- graphics levels ----------
// High for computers, Medium to start on phones; Auto (main.js) steps down when the frame rate drops.
// post: the HDR pass with bloom (its blur steps) and multisampling; mirror: the reflection's size (0: the sea
// reflects only the sky); fft: the chop as a real sea spectrum
const PHONE = /android|iphone|ipad/i.test(navigator.userAgent);
export const QUALITY = {
  high:   { ratio: 1.75, shadow: PHONE ? 1024 : 2048, rings: 200, segs: 256, foam: 1600, post: { bloomLevels: 5, samples: 4 }, mirror: PHONE ? 0.35 : 0.5, fft: 128 },
  medium: { ratio: 1.3,  shadow: 1024, rings: 140, segs: 192, foam: 900, post: { bloomLevels: 4, samples: 2 }, mirror: 0, fft: 64 },
  low:    { ratio: 1.0,  shadow: 0,    rings: 100, segs: 128, foam: 450, low: true, post: null, mirror: 0, fft: 0 }, // no shadows, simpler water, straight to the screen
};
export const defaultQuality = () => (PHONE ? 'medium' : 'high');

// ---------- the world ----------
export class World {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, stencil: true, powerPreference: 'high-performance' }); // the stencil: for the sails' shadow on the sea
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const phone = /android|iphone|ipad/i.test(navigator.userAgent);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(SKY_HORIZON, FOG_NEAR, FOG_FAR);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.3, 6000);
    this.camera.rotation.order = 'YXZ';
    this.hemi = new THREE.HemisphereLight('#dbeaff', '#2c4a5c', 0.9);
    this.scene.add(this.hemi);
    // the sun casts shadows in a box that follows your boat: sails on the deck and on each other
    const sun = this.sun = new THREE.DirectionalLight('#fff1dc', 3.2);
    sun.castShadow = true; sun.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 140 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);

    const ripple = rippleTexture(); // the noise for the ripples, the clouds and the foam
    // the sky's uniforms, shared by the dome, the environment map and the water (setLight changes them)
    this.skyU = { ...skyUniforms(), uRipple: { value: ripple } };
    this.skyU.uTop.value = SKY_TOP; this.skyU.uHorizon.value = SKY_HORIZON; this.skyU.uSun.value = SUN;
    this.discU = { value: 1 };
    const skyMat = () => new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { ...this.skyU, uTime: { value: 0 }, uDisc: this.discU },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: SKY_FS,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), skyMat());
    this.scene.add(this.sky);
    // the sky with its clouds (and a sea below the horizon) as an environment map, so gelcoat, steel and glass reflect
    // it; made again whenever the light changes
    this.env = new THREE.Scene();
    this.env.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat()));
    this.envSea = new THREE.Mesh(new THREE.CircleGeometry(10, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#1b5676' }));
    this.envSea.position.y = -0.4; this.env.add(this.envSea);

    // the chop (an FFT ocean, where the GPU can do it), the mirror and the camera's post-processing: switched on by
    // the graphics level (setQuality)
    this.oceanU = oceanUniforms();
    this.reflU = { uRefl: { value: null }, uReflMat: { value: new THREE.Matrix4() }, uReflOn: { value: 0 } };
    this.ocean = null; this.mirror = null; this.post = null;

    this.waterU = {
      uTime: { value: 0 }, uW: { value: Array.from({ length: NW }, () => new THREE.Vector4()) }, uWs: { value: new Array(NW).fill(0) }, uQ: { value: new Array(NW).fill(0) },
      uCam: { value: new THREE.Vector3() },
      uDeep: { value: new THREE.Color('#062a40') }, uScatter: { value: new THREE.Color('#1aa3a0') },
      uFogNear: { value: FOG_NEAR }, uFogFar: { value: FOG_FAR }, uChop: { value: 0.15 }, uAmp: { value: 0.4 }, uWhite: { value: 0 }, uGlint: { value: 1 },
      uGust: { value: Array.from({ length: 12 }, () => new THREE.Vector4()) }, uWind: { value: new THREE.Vector2(0, 1) }, uPivot: { value: new THREE.Vector2() },
      ...this.skyU, ...this.oceanU, ...this.reflU,
    };
    this.water = new THREE.Mesh(waterGeometry(), new THREE.ShaderMaterial({ uniforms: this.waterU, vertexShader: WATER_VS, fragmentShader: WATER_FS, defines: { WAVES: NW }, extensions: { derivatives: true } }));
    this.water.frustumCulled = false;
    this.scene.add(this.water);
    this.shadeMat = new THREE.ShaderMaterial({
      uniforms: { uTime: this.waterU.uTime, uW: this.waterU.uW, uWs: this.waterU.uWs, uSun: this.waterU.uSun, uShade: { value: 1 }, ...this.oceanU },
      vertexShader: SEASHADE_VS, fragmentShader: SEASHADE_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
    });
    this.seaShadows = [];

    // islands on the horizon, to steer by
    let s = 7; const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rand() * 0.4, r = 1900 + rand() * 900;
      const isl = island(rand, 220 + rand() * 420, 70 + rand() * 170, i % 3 ? '#5f7a58' : '#7d8a6a');
      isl.position.x = Math.sin(a) * r; isl.position.z = -Math.cos(a) * r;
      this.scene.add(mirrored(isl));
    }
    // and a farther range behind them, pale in the haze
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3 + rand() * 0.5, r = 2900 + rand() * 250;
      const isl = island(rand, 500 + rand() * 500, 220 + rand() * 260, '#6a7d6a');
      isl.position.x = Math.sin(a) * r; isl.position.z = -Math.cos(a) * r;
      this.scene.add(isl);
    }

    // glare: a soft bloom round the sun when you look towards it (behind a sail or an island it hides)
    const gc = document.createElement('canvas'); gc.width = gc.height = 128;
    const gx = gc.getContext('2d'), gr = gx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,248,232,1)'); gr.addColorStop(0.12, 'rgba(255,240,214,0.5)'); gr.addColorStop(0.45, 'rgba(255,236,206,0.12)'); gr.addColorStop(1, 'rgba(255,236,206,0)');
    gx.fillStyle = gr; gx.fillRect(0, 0, 128, 128);
    this.glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
    this.glare.scale.setScalar(1500); this.glare.renderOrder = 5;
    this.scene.add(this.glare);

    // wake: foam points
    this.foamN = 1600; this.foam = [];
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.foamN * 3), 3));
    fg.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(this.foamN), 1));
    fg.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(this.foamN), 1));
    this.foamU = { uMap: { value: foamSprite() }, uScale: { value: 400 } };
    this.foamPts = new THREE.Points(fg, new THREE.ShaderMaterial({ uniforms: this.foamU, vertexShader: FOAM_VS, fragmentShader: FOAM_FS, transparent: true, depthWrite: false }));
    this.foamPts.frustumCulled = false;
    this.scene.add(this.foamPts);
    this.foamI = 0; this.foamMax = this.foamN;
    for (let i = 0; i < this.foamN; i++) this.foam.push({ x: 0, z: 0, age: 99, life: 1, vx: 0, vz: 0, s0: 1, s1: 2 });

    // gulls, dolphins and whales; their splashes go into the foam above
    this.wild = new Wildlife(this.scene, (x, z, n, up, size) => this.splash(x, z, n, up, size));

    this.wakeU = { uRipple: this.waterU.uRipple, uTime: this.waterU.uTime, uWind: this.waterU.uWind, uMax: { value: WAKE_AGE }, ...this.oceanU };
    this.wakes = []; this.contacts = [];
    this.showGuides = true; this.guides = null;
    this.mode = 'drone';
    this.orbit = 0; this.dist = 26; this.look = 0; this.lookHold = 0; this.helmFov = 68;
    this.camH = 0;
    this.intro = { t: 0, T: 8 }; // the opening fly-around (frame); flyIn() plays it again
    this.boatViews = [];
    this.marks = null;
    for (const w of [...this.wild.gulls, ...this.wild.dolphins, ...this.wild.whales]) mirrored(w.g);
    this.glareK = 1;
    this.setLight(skyAt(14.5));
  }

  // the light the race is sailed in (light.js: skyAt, for an hour of the day): the sun, the sky and its haze, the
  // clouds, the sea's colours, the exposure and the bloom; the environment map that the boats reflect is made again
  setLight(L) {
    this.light = L;
    SUN.copy(L.sunDir);
    SKY_TOP.copy(L.top); SKY_HORIZON.copy(L.horizon);
    const U = this.skyU;
    U.uSunCol.value.copy(L.sun); U.uCloudLit.value.copy(L.cloudLit); U.uCloudDark.value.copy(L.cloudDark);
    U.uMie.value = L.mie; U.uCloud.value = L.cloud; this.discU.value = L.disc;
    this.sun.color.copy(L.sun); this.sun.intensity = L.sunI;
    this.hemi.color.copy(L.hemiSky); this.hemi.groundColor.copy(L.hemiGround); this.hemi.intensity = L.hemiI;
    this.scene.fog.color.copy(SKY_HORIZON); this.scene.fog.near = L.fogNear; this.scene.fog.far = L.fogFar;
    const W = this.waterU;
    W.uFogNear.value = L.fogNear; W.uFogFar.value = L.fogFar;
    W.uDeep.value.copy(L.deep); W.uScatter.value.copy(L.scatter); W.uGlint.value = L.glint;
    this.shadeMat.uniforms.uShade.value = L.shade;
    this.renderer.toneMappingExposure = L.exposure;
    this.glare.material.color.copy(L.sun); this.glareK = L.disc;
    this.bloomLook = L.bloom; if (this.post) this.post.setLook(L.bloom);
    this.envSea.material.color.copy(L.deep).lerp(SKY_HORIZON, 0.2);
    const pm = new THREE.PMREMGenerator(this.renderer), old = this.scene.environment;
    this.scene.environment = pm.fromScene(this.env, 0.02).texture;
    pm.dispose(); if (old) old.dispose();
  }

  setRace(race) {
    for (const v of this.boatViews) this.scene.remove(v.root);
    if (this.marks) this.scene.remove(this.marks);
    this.race = race;
    const W0 = race.wind.dir();
    this.W = race.waves;
    this.W.forEach((p, i) => { this.waterU.uW.value[i].set(p.dx, p.dz, p.k, p.A); this.waterU.uWs.value[i] = p.w; this.waterU.uQ.value[i] = p.Q; });
    this.waterU.uChop.value = 0.1 + race.wind.p.tws / 60;
    this.waterU.uAmp.value = race.wind.p.waves;
    this.waterU.uPivot.value.set(race.course.windward.x, race.course.windward.z / 2); // the wind lanes turn about the middle of the course
    this.waterU.uWhite.value = clamp((race.wind.p.tws - 10) / 9, 0, 1); // whitecaps from about force 4
    this.setLight(pickSky(race));
    // the chop is raised by the race's mean wind and keeps its heading (the sea lags the shifts)
    if (this.ocean) this.ocean.setWind(race.wind.p.tws);
    this.oceanU.uFftW.value.set(Math.sin(W0 + Math.PI), -Math.cos(W0 + Math.PI));
    this.boatViews = race.boats.map((b, i) => {
      const v = b.ai
        ? new BoatView({ look: LOOKS[b.name] || LOOKS.Aurora, label: { text: b.name, color: b.color } })
        : new BoatView({ look: playerLook(), player: true }); // your boat in the colours you chose on /boat
      v.root.scale.setScalar(SC);
      mirrored(v.root);
      v.root.traverse((o) => { if (o.isSprite && o.material.depthTest === false && o.material.toneMapped === false) o.layers.set(OVERLAY); }); // the name tag: drawn after the post
      this.scene.add(v.root);
      return v;
    });
    for (const s of this.seaShadows) s.dispose(this.scene);
    this.seaShadows = this.boatViews.map((v) => new SeaShadows(this.scene, v, this.shadeMat));
    const c = race.course, g = new THREE.Group();
    this.buoys = [];
    const add = (obj, p, vee) => {
      obj.position.set(p.x, 0, p.z); g.add(mirrored(obj)); if (vee) g.add(vee);
      const ring = obj.userData.R ? new MarkContact(obj.userData.R, this.wakeU) : null; if (ring) g.add(ring.mesh);
      this.buoys.push({ obj, p, vee, ring });
    };
    add(buoy(), c.windward, currentVee()); add(buoy(), c.gate[0], currentVee()); add(buoy(), c.gate[1], currentVee()); add(buoy('#ffb000', 0.85), c.pin, currentVee());
    if (c.wing) add(buoy(), c.wing, currentVee());
    // the committee boat lies to her anchor head to wind, 5 m beyond the line's end: which side of her the pin is,
    // and where along her the line meets her, place her orange flag and her officers
    const cbx = Math.cos(W0), cbz = Math.sin(W0), ex = -c.dir.x * 5, ez = -c.dir.z * 5;
    this.cb = new CommitteeBoat(ex * cbx + ez * cbz >= 0 ? 1 : -1, -ex * cbz + ez * cbx);
    this.committee = this.cb.root; this.cbW0 = W0;
    add(this.committee, { x: c.committee.x + c.dir.x * 5, z: c.committee.z + c.dir.z * 5 });
    this.committee.rotation.y = -W0;
    // the line, as a row of floating dashes
    const len = Math.hypot(c.committee.x - c.pin.x, c.committee.z - c.pin.z);
    this.line = new THREE.Mesh(lineStrip(len), lineMat());
    this.line.rotation.y = -Math.atan2(c.dir.z, c.dir.x); this.line.position.set((c.pin.x + c.committee.x) / 2, 0.7, (c.pin.z + c.committee.z) / 2);
    g.add(this.line);
    // the arrows over the next mark
    const cone = () => { const m = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.6, 4), new THREE.MeshBasicMaterial({ color: '#ffd400', fog: false })); m.rotation.x = Math.PI; return m; };
    this.pointers = [cone(), cone()]; for (const p of this.pointers) g.add(p);
    this.zones = new ZoneRings([c.gate[0], c.gate[1], ...(c.wing ? [c.wing] : [])]); g.add(this.zones.mesh);
    this.ladder = ladder(c); g.add(this.ladder);
    this.lay = new Laylines(c, race.wind.p.tws); g.add(this.lay.group);
    this.marks = g; this.scene.add(g);
    this.camH = race.player.h;
    if (this.guides) this.scene.remove(this.guides);
    this.guides = guides(race.wind.p.tws); this.scene.add(this.guides);
    for (const f of this.foam) f.age = 99;
    for (const w of this.wakes) w.dispose(this.scene);
    this.wakes = race.boats.map(() => new Wake(this.scene, this.wakeU));
    for (const h of this.contacts || []) h.dispose(this.scene);
    this.contacts = race.boats.map(() => new HullContact(this.scene, this.wakeU));
    this.wild.reset(race);
  }

  // switch the graphics level: resolution, sun shadows, water mesh and shading, foam
  setQuality(q) {
    if (!QUALITY[q] || this.quality === q) return;
    const Q = QUALITY[q], hadShadow = this.quality ? QUALITY[this.quality].shadow > 0 : true;
    this.quality = q;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.ratio));
    if (this.w) this.renderer.setSize(this.w, this.h, false);
    const sh = Q.shadow > 0;
    this.renderer.shadowMap.enabled = sh; this.sun.castShadow = sh;
    if (sh && this.sun.shadow.mapSize.x !== Q.shadow) { this.sun.shadow.mapSize.set(Q.shadow, Q.shadow); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
    this.water.geometry.dispose(); this.water.geometry = waterGeometry(3000, Q.rings, Q.segs);
    this.water.material.defines = Q.low ? { WAVES: 5, LOW_Q: 1 } : { WAVES: NW };
    this.water.material.needsUpdate = true;
    this.foamMax = Q.foam; this.foamI %= Q.foam; this.foamPts.geometry.setDrawRange(0, Q.foam);
    this.wild.setLevel(q); // fewer gulls and dolphins lower down
    // the camera's post-processing
    const r = this.renderer;
    if (Q.post && Post.supported(r)) { if (!this.post) this.post = new Post(r); this.post.setLevel(Q.post); if (this.bloomLook) this.post.setLook(this.bloomLook); }
    else if (this.post) { this.post.dispose(); this.post = null; }
    this.camera.layers.set(0); if (!this.post) this.camera.layers.enable(OVERLAY); // without the post the labels go in with the rest
    // the mirror
    if (Q.mirror > 0 && Post.supported(r)) { if (!this.mirror) this.mirror = new Mirror(r); this.mirror.setScale(Q.mirror); }
    else if (this.mirror) { this.mirror.dispose(); this.mirror = null; }
    this.reflU.uReflOn.value = 0;
    // the chop
    if (Q.fft && Ocean.supported(r)) {
      if (!this.ocean || this.ocean.N !== Q.fft) {
        if (this.ocean) this.ocean.dispose();
        this.ocean = new Ocean(r, Q.fft, 40);
        if (this.race) this.ocean.setWind(this.race.wind.p.tws);
      }
      this.oceanU.uFftD.value = this.ocean.disp.texture; this.oceanU.uFftS.value = this.ocean.slope.texture;
      this.oceanU.uFftL.value = this.ocean.L; this.oceanU.uFftOn.value = 1;
    } else {
      if (this.ocean) { this.ocean.dispose(); this.ocean = null; }
      this.oceanU.uFftOn.value = 0; this.oceanU.uFftD.value = this.oceanU.uFftS.value = blankOcean();
    }
    if (hadShadow !== sh) this.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); }); // shadows on/off: recompile
  }

  resize(w, h) {
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  spawnFoam(b, dt) {
    if (b.v < 0.5) return;
    if (b.v < 1.2) return;
    b._foam = (b._foam || 0) + dt * b.v * 3; // the wake itself is drawn by Wake; these are splashes at the bow
    while (b._foam > 1) {
      b._foam -= 1;
      const f = this.foam[this.foamI]; this.foamI = (this.foamI + 1) % this.foamMax;
      const fx = Math.sin(b.h), fz = -Math.cos(b.h), side = Math.random() < 0.5 ? -1 : 1, r = Math.random();
      const kind = 'bow';
      const along = kind === 'bow' ? (-3.2 - Math.random() * 1.5) * SC : kind === 'wash' ? 5.3 + Math.random() : 4.2;
      const across = kind === 'bow' ? side * 1.2 * SC : kind === 'wash' ? (Math.random() - 0.5) * 1.6 : side * 1.45;
      f.x = b.x - fx * along + -fz * across; f.z = b.z - fz * along + fx * across;
      const spread = kind === 'bow' ? 1.1 : kind === 'wash' ? 0.1 : 0.55;
      f.vx = -fz * side * spread * (0.6 + b.v * 0.12) + fx * 0.15; f.vz = fx * side * spread * (0.6 + b.v * 0.12) + fz * 0.15;
      f.age = 0; f.life = (kind === 'wash' ? 6 : 3.5) + Math.random() * 3 + b.v * 0.8; f.spray = false;
      f.life = 1.5 + Math.random() * 1.5; f.s0 = 0.6; f.s1 = 1.6; f.a = Math.min(0.55, 0.1 + b.v * 0.07);
    }
  }

  // spray over the bow when she slams into a wave upwind in a breeze
  spawnSpray(b, dt, race) {
    if (b.v < 2.5 || b.tws < 12 || Math.abs(b.twa) > 75 * D2R || b.slope < 0.035) return;
    if (Math.random() > dt * 18 * (b.slope - 0.03) * 20) return;
    const fx = Math.sin(b.h), fz = -Math.cos(b.h), n = 6 + Math.floor(Math.random() * 8);
    for (let k = 0; k < n; k++) {
      const f = this.foam[this.foamI]; this.foamI = (this.foamI + 1) % this.foamMax;
      const side = Math.random() < 0.5 ? -1 : 1, wind = race.wind.dir();
      f.x = b.x + fx * 4.4 * SC + -fz * side * 0.8; f.z = b.z + fz * 4.4 * SC + fx * side * 0.8; f.y = 0.8;
      f.vx = fx * b.v * 0.6 - fz * side * (0.5 + Math.random()) - Math.sin(wind) * 2.5;
      f.vz = fz * b.v * 0.6 + fx * side * (0.5 + Math.random()) + Math.cos(wind) * 2.5;
      f.vy = 2 + Math.random() * 2.5; f.age = 0; f.life = 0.9 + Math.random() * 0.5; f.spray = true; f.s0 = 0.25; f.s1 = 0.6; f.a = 0.8;
    }
  }

  // a splash where an animal breaks the water: foam spreading on the surface and, with up > 0, spray thrown up
  splash(x, z, n, up = 0, size = 1) {
    n = Math.round(n * (this.quality === 'low' ? 0.4 : this.quality === 'medium' ? 0.7 : 1));
    const t = this.race ? this.race.t : 0;
    for (let k = 0; k < n; k++) {
      const f = this.foam[this.foamI]; this.foamI = (this.foamI + 1) % this.foamMax;
      const a = Math.random() * 2 * Math.PI, r = Math.random() * size * 0.7, sp = (0.3 + Math.random()) * size * 0.8;
      f.x = x + Math.cos(a) * r; f.z = z + Math.sin(a) * r; f.vx = Math.cos(a) * sp; f.vz = Math.sin(a) * sp; f.age = 0;
      f.spray = up > 0 && k % 2 === 0;
      if (f.spray) { f.y = waveHeight(this.W, f.x, f.z, t) + 0.2; f.vy = up * (0.5 + Math.random() * 0.6); f.life = 0.7 + Math.random() * 0.6; f.s0 = 0.3 * size; f.s1 = 0.8 * size; f.a = 0.8; }
      else { f.life = 1.5 + Math.random() * 2.5; f.s0 = 0.6 * size; f.s1 = 1.8 * size; f.a = 0.55; }
    }
  }

  frame(dt, t) {
    const race = this.race, P = race.player, wind = race.wind;
    // boats
    const cp = this.camera.position, farD = this.mode === 'top' ? 1e9 : 85;
    race.boats.forEach((b, i) => {
      const v = this.boatViews[i];
      v.setDetail(b === P || Math.hypot(b.x - cp.x, b.z - cp.z) < farD * (this.quality === 'low' ? 0.6 : 1) && this.mode !== 'top');
      v.update(b, t, this.W, this.mode === 'drone');
      if (v.crew) v.crew[0].g.visible = !(b === P && this.mode === 'helm'); // at the helm, you are the helmsman
      this.settle(v, dt);
      this.seaShadows[i]?.update(this.quality !== 'low'); // Low: no shadows anywhere
    });
    // buoys bob and tilt with the sea under them; in a current a mark leans downstream on its mooring and trails a
    // little foam
    for (const { obj, p, vee, ring } of this.buoys) {
      obj.position.y = waveHeight(this.W, p.x, p.z, t) * (obj === this.committee ? 0.7 : 0.9);
      if (ring) ring.update(p, t, this.W);
      if (obj === this.committee) { // she pitches and rolls a little on the swell, being long and heavy
        const W0 = this.cbW0, fx = Math.sin(W0), fz = -Math.cos(W0);
        obj.rotation.x = waveSlope(this.W, p.x, p.z, t, fx, fz) * 0.35;
        obj.rotation.z = waveSlope(this.W, p.x, p.z, t, -fz, fx) * 0.35;
        continue;
      }
      const cur = race.currentAt(p.x, p.z), cs = Math.hypot(cur.x, cur.z); // the stream where this mark lies
      const sx = waveSlope(this.W, p.x, p.z, t, 1, 0), sz = waveSlope(this.W, p.x, p.z, t, 0, 1);
      obj.rotation.z = sx * 0.8 - cur.x * 0.9; obj.rotation.x = -sz * 0.8 + cur.z * 0.9; // leaning on its mooring, downstream
      if (vee) {
        vee.visible = cs > 0.03;
        if (vee.visible) {
          const ux = -cur.x / cs, uz = -cur.z / cs, L = 5 + cs * 22, wd = 2.4 + cs * 5; // up-tide; it grows with the stream
          vee.scale.set(wd, 1, L); vee.rotation.y = Math.atan2(-ux, -uz);
          vee.position.set(p.x - ux * (L / 2 - 1.3), waveHeight(this.W, p.x, p.z, t) * 0.9 + 0.1, p.z - uz * (L / 2 - 1.3));
          vee.material.opacity = clamp(cs / 0.3, 0.25, 1) * (0.75 + 0.12 * Math.sin(t * 2.3 + p.x));
        }
      }
      if (cs > 0.05 && Math.random() < dt * 7) {
        const f = this.foam[this.foamI]; this.foamI = (this.foamI + 1) % this.foamMax;
        const ux = cur.x / cs, uz = cur.z / cs, side = (Math.random() - 0.5) * 1.6;
        f.x = p.x + ux * 1.1 - uz * side; f.z = p.z + uz * 1.1 + ux * side;
        f.vx = cur.x * 0.9 - uz * side * 0.12; f.vz = cur.z * 0.9 + ux * side * 0.12;
        f.age = 0; f.life = 2.5 + Math.random() * 2; f.spray = false; f.s0 = 0.5; f.s1 = 1.4; f.a = 0.32;
      }
    }
    const lg = race.course.legs[P.leg];
    this.zones.update(this.W, t, P.done ? [] : lg === 'gate' ? [0, 1] : lg === 'wing' ? [2] : []);
    this.cb.update(t, dt, race.flags, race.prepFlag, this.cbW0 - race.wind.dir(), race.wind.p.tws * 0.514); // flags fly downwind
    const k = race.course.legs[P.leg]; // the start line stays drawn for the whole race
    this.ladder.visible = this.showGuides && !P.done; // the distance lines go with the other guides
    this.lay.group.visible = this.showGuides && (k === 'start' || k === 'mark') && !P.done; // laylines before the start and on the beat
    if (this.lay.group.visible) this.lay.update(this.W, race.wind.dir(), t);
    // pointers over the next mark(s)
    const c = race.course;
    const targets = k === 'mark' ? [c.windward] : k === 'wing' ? [c.wing] : k === 'gate' ? c.gate : [c.pin, { x: c.committee.x, z: c.committee.z }];
    this.pointers.forEach((p, i) => {
      const m = targets[i];
      p.visible = !!m && !P.done;
      if (!m) return;
      const d = Math.hypot(m.x - P.x, m.z - P.z), sc = clamp(d / 70, 1, 5);
      p.scale.setScalar(sc);
      p.position.set(m.x, 5 + sc * 2 + Math.sin(t * 3) * 0.6 * sc, m.z);
      p.rotation.y = t;
    });
    // foam
    race.boats.forEach((b, i) => {
      this.spawnFoam(b, dt); this.spawnSpray(b, dt, race);
      if (this.wakes[i]) this.wakes[i].update(b, dt, t, this.W);
      if (this.contacts[i]) this.contacts[i].update(b, t, this.W);
    });
    const ga = this.foamPts.geometry.attributes, fp = ga.position, fa = ga.aAlpha, fs = ga.aSize;
    for (let i = 0; i < this.foamMax; i++) {
      const f = this.foam[i];
      f.age += dt; f.x += f.vx * dt; f.z += f.vz * dt; if (!f.spray) { f.vx *= 0.985; f.vz *= 0.985; }
      const live = f.age < f.life, k = live ? f.age / f.life : 1;
      if (f.spray) { f.vy -= 9.81 * dt; f.y += f.vy * dt; }
      fp.setXYZ(i, f.x, live ? (f.spray ? f.y : waveHeight(this.W, f.x, f.z, t) + 0.12) : -50, f.z);
      fa.setX(i, live ? (f.a || 0.5) * (1 - k) ** 1.6 * Math.min(1, f.age * 6) : 0);
      fs.setX(i, lerp(f.s0, f.s1, Math.sqrt(k)));
    }
    fp.needsUpdate = fa.needsUpdate = fs.needsUpdate = true;
    this.foamU.uScale.value = this.renderer.domElement.height / (2 * Math.tan((this.camera.fov * D2R) / 2));

    // guides: around your boat, turned to the wind she feels; off in the helm view
    if (this.guides) {
      const G = this.guides, U = G.userData;
      G.visible = this.showGuides && this.mode !== 'helm' && !P.done;
      G.position.set(P.x, 0, P.z);
      U.turn.rotation.y = -P.wdir;
      U.tick.position.set(Math.sin(P.h) * (R_OUT + 0.9), 0, -Math.cos(P.h) * (R_OUT + 0.9)); U.tick.rotation.y = -P.h;
      if (G.visible) drapeGuides(G, this.W, t);
    }
    // cameras: they move on the wall clock, not the race's (behind the menu or paused the race gives dt = 0, and a
    // camera on dt would sit where it was made, at the origin on the water's surface); the first frame puts it in place
    const now = performance.now(), cdt = this._camLast == null ? 0 : Math.min(0.1, (now - this._camLast) / 1000);
    const first = this._camLast == null; this._camLast = now;
    const cl = (k) => (first ? 1 : 1 - Math.exp(-cdt * k));
    this.camH += wrap(P.h - this.camH) * cl(1.6);
    const cam = this.camera;
    cam.up.set(0, 1, 0);
    if (this.intro && this.mode !== 'drone') this.intro = null; // the fly-in is the drone's
    if (this.mode === 'top') {
      // straight down, your heading up the screen, so steering left turns her left on screen too
      const hgt = 20 + this.dist * 1.6 * (cam.aspect < 1 ? 1.5 : 1);
      cam.position.lerp(new THREE.Vector3(P.x, hgt, P.z), cl(8));
      cam.up.set(Math.sin(this.camH), 0, -Math.cos(this.camH));
      cam.lookAt(P.x, 0, P.z);
      cam.fov = 50;
    } else if (this.mode === 'drone') {
      let ph = this.camH + this.orbit, el = 24 * D2R, d = this.dist * (cam.aspect < 1 ? 1.75 : 1); // a tall screen needs the drone further back
      // the fly-in: from high and far off, the drone sweeps three-quarters of the way round her as it comes down
      let intro = 0;
      if (this.intro) {
        this.intro.t += cdt;
        const u = Math.min(1, this.intro.t / this.intro.T);
        intro = 1 - u * u * (3 - 2 * u); // 1 → 0, eased at both ends
        if (u >= 1) this.intro = null;
      }
      ph -= intro * 1.5 * Math.PI; el += intro * 38 * D2R; d *= 1 + intro * 3.5;
      const tx = P.x + Math.sin(P.h) * 5, tz = P.z - Math.cos(P.h) * 5;
      const want = new THREE.Vector3(tx - Math.sin(ph) * d * Math.cos(el), 3 + d * Math.sin(el), tz + Math.cos(ph) * d * Math.cos(el));
      // a drone in the wind never hangs quite still: a slow sway and a little bob
      const sw = 0.02 * d;
      want.x += Math.sin(t * 0.37) * sw; want.z += Math.cos(t * 0.29) * sw; want.y += Math.sin(t * 0.53) * sw * 0.7 + Math.sin(t * 1.7) * 0.06;
      if (intro > 0) cam.position.copy(want); else cam.position.lerp(want, cl(6));
      cam.lookAt(tx + Math.sin(t * 0.41) * 0.25, 3.5 + Math.sin(t * 0.61) * 0.15, tz);
      cam.fov = 55;
    } else if (this.mode === 'helm') {
      if (this.lookHold <= 0) this.look *= Math.exp(-dt * 1.5); else this.lookHold -= dt;
      const v = this.boatViews[0], side = P.twa >= 0 ? 1 : -1;
      v.tilt.updateMatrixWorld(true);
      const eye = new THREE.Vector3(side * 1.0, 2.75, 4.45).applyMatrix4(v.tilt.matrixWorld);
      cam.position.copy(eye);
      cam.rotation.set(-0.1, -P.h + this.look - side * 0.22, side * P.heel * D2R * 0.4);
      cam.fov = this.helmFov;
    }
    cam.updateProjectionMatrix();
    this.wild.update(dt, t, this.W, cam, this.foamU.uScale.value);
    this.sky.position.copy(cam.position); this.sky.material.uniforms.uTime.value = t; // the clouds drift
    // the glare: brightest looking straight at the sun, gone when you look away
    const look = cam.getWorldDirection(this._dir || (this._dir = new THREE.Vector3()));
    this.glare.position.copy(cam.position).addScaledVector(SUN, 3000);
    this.glare.material.opacity = 0.55 * this.glareK * Math.max(0, look.dot(SUN)) ** 6;
    this.glare.visible = this.glare.material.opacity > 0.01;
    this.sun.target.position.set(P.x, 2, P.z); this.sun.position.set(P.x + SUN.x * 70, 2 + SUN.y * 70, P.z + SUN.z * 70);
    // the water disc follows what the camera looks at
    this.water.position.set(Math.round(P.x / 4) * 4, 0, Math.round(P.z / 4) * 4);
    const u = this.waterU;
    u.uTime.value = t; u.uCam.value.copy(cam.position);
    const bw = wind.dir() + Math.PI; u.uWind.value.set(Math.sin(bw), -Math.cos(bw));
    for (let i = 0; i < this.W.length; i++) u.uW.value[i].w = this.W[i].A; // the chop builds and dies with the wind (sim.js)
    // the sea shows twelve gusts: the nearest to you (a long course has more)
    const gs = wind.gusts.length <= 12 ? wind.gusts : [...wind.gusts].sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z)).slice(0, 12);
    for (let i = 0; i < 12; i++) { const g = gs[i]; if (g) u.uGust.value[i].set(g.x, g.z, g.r, (g.s / wind.p.gustStr) * (g.k ?? Math.min(1, g.life / 6))); else u.uGust.value[i].set(0, 0, 1, 0); } // k: a gust filling in or dying away
    this.render(cam);
  }

  // the chop, the mirror, then the picture: through the post-processing when the level has it, the labels on top
  render(cam) {
    const r = this.renderer, sc = this.scene;
    if (this.ocean) this.ocean.update(this.waterU.uTime.value);
    sc.updateMatrixWorld(); cam.updateMatrixWorld();
    const au = sc.matrixWorldAutoUpdate; sc.matrixWorldAutoUpdate = false; // once is enough for all the passes
    const on = !!this.mirror && this.mode !== 'top' && this.mirror.render(sc, cam); // from straight above the sea reflects next to nothing
    this.reflU.uReflOn.value = on ? 1 : 0;
    if (on) { this.reflU.uRefl.value = this.mirror.rt.texture; this.reflU.uReflMat.value.copy(this.mirror.matrix); }
    if (this.post) {
      this.post.render(sc, cam, () => {
        const ac = r.autoClear, sm = r.shadowMap.autoUpdate;
        r.autoClear = false; r.shadowMap.autoUpdate = false; cam.layers.set(OVERLAY);
        r.render(sc, cam);
        cam.layers.set(0); r.autoClear = ac; r.shadowMap.autoUpdate = sm;
      });
    } else {
      r.setRenderTarget(null);
      r.render(sc, cam);
    }
    sc.matrixWorldAutoUpdate = au;
  }

  // a 12-metre boat has weight: she doesn't follow every wave at once but lags the sea a little and overshoots it,
  // heaving, pitching and rolling on springs (the model puts her where the sea would; she gets there here)
  settle(v, dt) {
    const R = v.root, T = v.tilt;
    let s = v.sea;
    if (!s || dt > 0.1) s = v.sea = { y: R.position.y, vy: 0, px: T.rotation.x, vp: 0, rz: T.rotation.z, vr: 0 }; // first frame, or after a pause
    const h = Math.min(dt, 1 / 30), spring = (x, vx, to, k, c) => { vx += (k * (to - x) - c * vx) * h; return [x + vx * h, vx]; };
    [s.y, s.vy] = spring(s.y, s.vy, R.position.y, 7, 2.9); // about a 2.4 s heave, damped to ~0.55 of critical
    [s.px, s.vp] = spring(s.px, s.vp, T.rotation.x, 9, 3.3);
    [s.rz, s.vr] = spring(s.rz, s.vr, T.rotation.z, 6, 2.7);
    R.position.y = s.y; T.rotation.x = s.px; T.rotation.z = s.rz;
  }

  // camera gestures
  drag(dx) { if (this.mode === 'top') return; if (this.mode === 'drone') this.orbit -= dx * 0.006; else { this.look = clamp(this.look - dx * 0.005, -2.6, 2.6); this.lookHold = 1.2; } }
  // zoom: f < 1 in, f > 1 out — the drone comes closer, the top view lower, the helm view through a longer lens
  zoom(f) {
    if (this.mode === 'helm') this.helmFov = clamp(this.helmFov * f, 30, 80);
    else this.dist = clamp(this.dist * f, 8, 110);
  }
  flyIn(T = 8) { this.intro = { t: 0, T }; }
  resetView() { this.orbit = 0; this.look = 0; this.dist = 34; this.helmFov = 68; } // far enough back that the whole rig fits under the readouts
}
