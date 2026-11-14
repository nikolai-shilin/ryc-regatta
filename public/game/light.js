// Regatta: the light a race is sailed in — the time of day at the race's venue, clear or overcast — and the sky that goes
// with it. The hour puts the sun where it really stands (east in the morning, high in the south at midday, west in
// the evening); its height above the horizon then sets everything else — the sun's colour and strength, the sky and
// its haze, the clouds, the sea's own colours and the exposure — so they always agree with each other.
import * as THREE from 'three';
import { VENUE } from './venues.js';

const D = Math.PI / 180;
const LAT = VENUE.lat * D; // Göcek, 36.75° N, or the venue's
const DECL = Math.sign(VENUE.lat) * 20 * D; // the sun's declination in the sailing season (late May to mid July; south of the equator, December to February)
const CLOCK = VENUE.tz - VENUE.lon / 15; // the clock is this many hours ahead of the sun there (UTC+3 at 28.9° E: 1.07)
// the venue's land is turned so its prevailing wind comes from the game's north (venues.js); the sun turns with it
const TURN = VENUE.wind * D;
// and its sea's own colours, where it has them
const WATER = VENUE.look.water;
const MIN_E = 3; // degrees: the earliest and latest a race goes, the sun just clear of the horizon

// The looks at a few heights of the sun (degrees); the hours between are blended from them.
const KEYS = [
  { e: 3, sun: '#ff8c48', sunI: 1.7, hemiSky: '#aeb3d2', hemiGround: '#3a3040', hemiI: 0.52, top: '#365383', horizon: '#f0ae80',
    mie: 0.66, cloud: 0.04, cloudLit: '#ffa86e', cloudDark: '#6e6782', deep: '#0a1d2d', scatter: '#2a6c72', exposure: 1.24, glint: 1.5,
    shade: 0.55, fogNear: 120, fogFar: 2500, thr: 1.7, str: 0.42 },
  { e: 6, sun: '#ffa660', sunI: 2.2, hemiSky: '#bcc4dc', hemiGround: '#3c3742', hemiI: 0.58, top: '#4469a0', horizon: '#f2c39c',
    mie: 0.52, cloud: 0.03, cloudLit: '#ffc590', cloudDark: '#7f7b8f', deep: '#0a2334', scatter: '#2a8080', exposure: 1.16, glint: 1.35,
    shade: 0.7, fogNear: 130, fogFar: 2700, thr: 1.9, str: 0.38 },
  { e: 10, sun: '#ffb874', sunI: 2.6, hemiSky: '#c6d0e4', hemiGround: '#3c3a44', hemiI: 0.62, top: '#4f74a8', horizon: '#efd3b4',
    mie: 0.42, cloud: 0.02, cloudLit: '#ffd9ad', cloudDark: '#8a8899', deep: '#0a2638', scatter: '#2a8a86', exposure: 1.12, glint: 1.25,
    shade: 0.8, fogNear: 140, fogFar: 2900, thr: 2.0, str: 0.36 },
  { e: 20, sun: '#ffe2c0', sunI: 2.7, hemiSky: '#d6e3f2', hemiGround: '#34505c', hemiI: 0.85, top: '#5a8dc4', horizon: '#e4e5e3',
    mie: 0.22, cloud: -0.03, cloudLit: '#fff3e4', cloudDark: '#a2adbd', deep: '#08304a', scatter: '#1d9aa0', exposure: 1.08, glint: 1,
    shade: 0.9, fogNear: 120, fogFar: 2600, thr: 2.2, str: 0.3 },
  { e: 35, sun: '#fff1dc', sunI: 3.2, hemiSky: '#dbeaff', hemiGround: '#2c4a5c', hemiI: 0.9, top: '#4f8fcb', horizon: '#d6e7f0',
    mie: 0.12, cloud: 0, cloudLit: '#fffbf3', cloudDark: '#99a8bd', deep: '#062a40', scatter: '#1aa3a0', exposure: 1.05, glint: 1,
    shade: 1, fogNear: 150, fogFar: 3200, thr: 2.4, str: 0.28 },
  { e: 72, sun: '#fff7ee', sunI: 3.4, hemiSky: '#d4e6ff', hemiGround: '#264658', hemiI: 0.95, top: '#3c7fc6', horizon: '#cfe3ef',
    mie: 0.08, cloud: -0.02, cloudLit: '#ffffff', cloudDark: '#9eb0c6', deep: '#04283f', scatter: '#14aaa6', exposure: 1.0, glint: 0.9,
    shade: 1, fogNear: 160, fogFar: 3300, thr: 2.5, str: 0.26 },
];
const OVERCAST = { sun: '#e9eef2', sunI: 0.95, hemiSky: '#e6ebf0', hemiGround: '#4a5961', hemiI: 1.75, top: '#8f9eab', horizon: '#c6cdd3',
  mie: 0.05, cloud: 0.24, cloudLit: '#d9dee3', cloudDark: '#8d96a0', deep: '#0f2c38', scatter: '#2c7c80', exposure: 1.0, glint: 0.12,
  shade: 0.22, fogNear: 100, fogFar: 2300, thr: 2.6, str: 0.18 };
const COLOURS = ['sun', 'hemiSky', 'hemiGround', 'top', 'horizon', 'cloudLit', 'cloudDark', 'deep', 'scatter'];

const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function mix(A, B, k) { // two looks blended: numbers straight, colours as THREE.Colors (in linear light)
  const o = {};
  for (const n in A) {
    if (COLOURS.includes(n)) o[n] = new THREE.Color(A[n]).lerp(new THREE.Color(B[n]), k);
    else if (typeof A[n] === 'number') o[n] = lerp(A[n], B[n], k);
  }
  return o;
}

// where the sun is at an hour of the sun's own time: [x east, y up, z south], and its height in degrees
function sunAt(solar) {
  const H = (solar - 12) * 15 * D;
  const E = -Math.cos(DECL) * Math.sin(H);
  const N = Math.cos(LAT) * Math.sin(DECL) - Math.sin(LAT) * Math.cos(DECL) * Math.cos(H);
  const U = Math.sin(LAT) * Math.sin(DECL) + Math.cos(LAT) * Math.cos(DECL) * Math.cos(H);
  const x = E, z = -N, c = Math.cos(TURN), s = Math.sin(TURN);
  return { dir: new THREE.Vector3(x * c + z * s, U, z * c - x * s).normalize(), e: Math.asin(U) / D };
}
// the first and last hour (sun's time) of racing: the sun MIN_E degrees up
const H0 = Math.acos((Math.sin(MIN_E * D) - Math.sin(LAT) * Math.sin(DECL)) / (Math.cos(LAT) * Math.cos(DECL))) / D / 15;
export const HOURS = [12 - H0 + CLOCK, 12 + H0 + CLOCK]; // on the clock: about 6:20 to 19:50

// The light at an hour of the clock (local time, 6.5 = 6:30), clear or overcast: the sun's direction (sunDir) and
// everything the world needs to draw it
export function skyAt(hour, overcast = false) {
  const solar = Math.min(Math.max(hour - CLOCK, 12 - H0), 12 + H0);
  const { dir, e } = sunAt(solar);
  let i = 0; while (i < KEYS.length - 2 && e > KEYS[i + 1].e) i++;
  const L = mix(KEYS[i], KEYS[i + 1], smooth(0, 1, (e - KEYS[i].e) / (KEYS[i + 1].e - KEYS[i].e)));
  // the evening against the morning: more haze in the air after a day of sun, so a warmer, softer light
  const eve = solar > 12 ? 1 - smooth(10, 30, e) : 0;
  L.mie *= 1 + 0.3 * eve; L.horizon.lerp(new THREE.Color('#f6c39a'), 0.12 * eve); L.sun.lerp(new THREE.Color('#ff9a50'), 0.1 * eve);
  if (overcast) { // the cloud deck: the sun gone, the light flat and grey, and dimmer the lower the sun is behind it
    const O = mix(OVERCAST, OVERCAST, 0), k = 0.55 + 0.45 * smooth(MIN_E, 30, e), warm = 1 - smooth(MIN_E, 20, e);
    Object.assign(L, mix(L, O, 0.88));
    for (const c of ['top', 'horizon', 'cloudLit', 'cloudDark', 'hemiSky']) L[c].multiplyScalar(k);
    L.horizon.lerp(new THREE.Color('#c9a68e').multiplyScalar(k), 0.25 * warm);
    L.hemiI *= k; L.sunI *= k; L.exposure += 0.15 * (1 - k);
  }
  if (WATER && WATER.deep) { L.deep.lerp(new THREE.Color(WATER.deep), WATER.k); L.scatter.lerp(new THREE.Color(WATER.scatter), WATER.k); }
  L.foam = foamLight(L, e);
  L.disc = overcast ? 0 : 1;
  L.bloom = { threshold: L.thr, strength: L.str };
  L.sunDir = dir; L.elevation = e; L.hour = hour; L.overcast = overcast;
  return L;
}

// the colour foam takes in this light: foam is white and rough, so it shows the light that falls on it — the sun
// (on its bubbles even when it is low) and the sky over it and round the horizon. Against the light at noon, which
// stays white: gold and rose with the sun low, grey under a cloud deck. The hue all of it, the dimming only partly,
// as the eye forgives a dim scene.
function foamIn(L, e) {
  const k = L.sunI * (0.25 + 0.75 * Math.sin(Math.max(e, 0) * D));
  return new THREE.Color(L.sun).multiplyScalar(k).add(new THREE.Color(L.hemiSky).multiplyScalar(L.hemiI)).add(new THREE.Color(L.horizon).multiplyScalar(0.5 * L.hemiI));
}
let NOON = null;
function foamLight(L, e) {
  if (!NOON) { const K = KEYS[KEYS.length - 1]; NOON = foamIn(mix(K, K, 0), K.e); }
  const c = foamIn(L, e); c.r /= NOON.r; c.g /= NOON.g; c.b /= NOON.b;
  const m = Math.max(c.r, c.g, c.b, 1e-4), b = 0.5 + 0.5 * Math.min(1, m) ** 0.7;
  // the tone mapping (ACES) bleaches bright colours towards white, so the hue is pushed a little past the light's own
  const g = (c.r + c.g + c.b) / (3 * m);
  c.multiplyScalar(1 / m); c.r = g + (c.r - g) * 1.35; c.g = g + (c.g - g) * 1.35; c.b = g + (c.b - g) * 1.35;
  return c.multiplyScalar(b / Math.max(c.r, c.g, c.b));
}

// "18:40"
export const clockText = (hour) => { const m = Math.round(hour * 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };

// the light for a race: ?hour=18.5 and ?sky=overcast|clear in the address win (for testing; the old ?light=day,
// morning, golden, overcast still work); otherwise a new hour every start, any hour of the racing day alike but at
// least two hours from the last one (remembered across visits), and overcast about one race in seven
let last = null;
try { last = parseFloat(localStorage.getItem('regatta.hour')); } catch (e) {}
export function pickSky() {
  let hour;
  do hour = HOURS[0] + Math.random() * (HOURS[1] - HOURS[0]);
  while (Number.isFinite(last) && Math.abs(hour - last) < 2);
  let overcast = Math.random() < 0.14;
  last = hour;
  try { localStorage.setItem('regatta.hour', hour.toFixed(2)); } catch (e) {}
  try {
    const q = new URLSearchParams(location.search);
    const old = { day: [14.5, 0], morning: [9.5, 0], golden: [19, 0], overcast: [14, 1] }[q.get('light')];
    if (old) [hour, overcast] = [old[0], !!old[1]];
    const h = parseFloat(q.get('hour')); if (h >= 0 && h < 24) hour = Math.min(Math.max(h, HOURS[0]), HOURS[1]);
    if (q.get('sky') === 'overcast') overcast = true; else if (q.get('sky') === 'clear') overcast = false;
  } catch (e) {}
  return skyAt(hour, overcast);
}

// The sky, shared by the sky dome, the sea's reflection of it and the haze on the water: a gradient from the
// horizon up to the zenith, the bright Mie haze round the sun (strongest low down, through more air), and the
// fair-weather cumulus on a layer overhead, made from the ripple noise (uRipple), lit from the sun's side.
export const SKY_GLSL = /* glsl */ `
uniform vec3 uTop, uHorizon, uSun, uSunCol, uCloudLit, uCloudDark; uniform float uMie, uCloud; uniform sampler2D uRipple;
vec3 skyBase(vec3 d) {
  float y = max(d.y, 0.0), mu = dot(d, uSun);
  vec3 c = mix(uHorizon, uTop, pow(y, 0.5));
  float g = 0.8, hg = (1.0 - g * g) / pow(max(1.0 + g * g - 2.0 * g * mu, 1e-4), 1.5) * 0.0796;
  c += uSunCol * hg * uMie * (0.35 + 0.65 * exp(-y * 5.0));
  return c;
}
float cloudDen(vec3 d, float t) {
  vec2 p = d.xz / (max(d.y, 0.0) + 0.1) * 0.3 + vec2(t * 0.0016, t * 0.0007);
  float n = texture2D(uRipple, p).w * 0.62 + texture2D(uRipple, p * 2.3 + 0.31).w * 0.28 + texture2D(uRipple, p * 6.1 + 0.67).w * 0.1;
  return smoothstep(0.52 - uCloud, 0.74 - uCloud * 0.5, n) * smoothstep(0.02, 0.16, d.y);
}
vec4 withClouds(vec3 col, vec3 d, vec3 sun, float t, bool cheap) {
  if (d.y <= 0.0) return vec4(col, 0.0);
  float c = cloudDen(d, t);
  if (c <= 0.0) return vec4(col, 0.0);
  float lit = 0.8;
  if (!cheap) lit = clamp(0.62 + (c - cloudDen(normalize(d + sun * 0.035), t)) * 1.6, 0.35, 1.0);
  vec3 cc = mix(uCloudDark, uCloudLit, lit);
  cc += uSunCol * pow(max(dot(d, sun), 0.0), 8.0) * (1.0 - c) * 0.6; // a bright rim near the sun
  return vec4(mix(col, cc, c * 0.92), c);
}`;

// the uniforms of SKY_GLSL, as one set of objects that the sky dome, the environment map and the water all share
export function skyUniforms() {
  return {
    uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) },
    uSunCol: { value: new THREE.Color() }, uCloudLit: { value: new THREE.Color() }, uCloudDark: { value: new THREE.Color() },
    uMie: { value: 0.1 }, uCloud: { value: 0 }, uFoamCol: { value: new THREE.Color(1, 1, 1) },
  };
}
