// Regatta: the light a race is sailed in — a clear day, a hazy morning, the golden hour, an overcast sky — and the
// sky that goes with it. Each look sets the sun (where it stands relative to the wind, its colour and strength), the
// sky and the haze, the clouds, the sea's own colours and the exposure, so they always agree with each other.
import * as THREE from 'three';

// azimuth: degrees from straight upwind, clockwise seen from above (0: the sun ahead of a boat on the beat,
// 180: behind her); elevation: degrees above the horizon
export const LIGHTS = {
  day: {
    azimuth: 210, elevation: 35, sun: '#fff1dc', sunI: 3.2, hemiSky: '#dbeaff', hemiGround: '#2c4a5c', hemiI: 0.9,
    top: '#4f8fcb', horizon: '#d6e7f0', mie: 0.12, cloud: 0, cloudLit: '#fffbf3', cloudDark: '#99a8bd',
    deep: '#062a40', scatter: '#1aa3a0', exposure: 1.05, glint: 1, shade: 1, disc: 1, fogNear: 150, fogFar: 3200,
    bloom: { threshold: 2.4, strength: 0.28 },
  },
  morning: {
    azimuth: 115, elevation: 19, sun: '#ffe2c0', sunI: 2.7, hemiSky: '#d6e3f2', hemiGround: '#34505c', hemiI: 0.85,
    top: '#5a8dc4', horizon: '#e4e5e3', mie: 0.22, cloud: -0.05, cloudLit: '#fff3e4', cloudDark: '#a2adbd',
    deep: '#08304a', scatter: '#1d9aa0', exposure: 1.08, glint: 1, shade: 0.9, disc: 1, fogNear: 120, fogFar: 2600,
    bloom: { threshold: 2.2, strength: 0.3 },
  },
  golden: {
    azimuth: 28, elevation: 8.5, sun: '#ffb874', sunI: 2.6, hemiSky: '#c6d0e4', hemiGround: '#3c3a44', hemiI: 0.62,
    top: '#4f74a8', horizon: '#efd3b4', mie: 0.42, cloud: 0.02, cloudLit: '#ffd9ad', cloudDark: '#8a8899',
    deep: '#0a2638', scatter: '#2a8a86', exposure: 1.12, glint: 1.25, shade: 0.8, disc: 1, fogNear: 140, fogFar: 2900,
    bloom: { threshold: 2.0, strength: 0.36 },
  },
  overcast: {
    azimuth: 190, elevation: 48, sun: '#e9eef2', sunI: 0.95, hemiSky: '#e6ebf0', hemiGround: '#4a5961', hemiI: 1.75,
    top: '#8f9eab', horizon: '#c6cdd3', mie: 0.05, cloud: 0.24, cloudLit: '#d9dee3', cloudDark: '#8d96a0',
    deep: '#0f2c38', scatter: '#2c7c80', exposure: 1.0, glint: 0.12, shade: 0.22, disc: 0, fogNear: 100, fogFar: 2300,
    bloom: { threshold: 2.6, strength: 0.18 },
  },
};

// the light for a race: ?light=… in the address wins (for testing); otherwise one chosen from the race's own numbers,
// so today's race looks the same for everyone, and a clear day most often
export function pickLight(race) {
  try {
    const q = new URLSearchParams(location.search).get('light');
    if (q && LIGHTS[q]) return q;
  } catch (e) {}
  const u = ((race.tidePh ?? Math.random() * 6.283) / 6.283 * 7.31) % 1;
  return u < 0.5 ? 'day' : u < 0.68 ? 'morning' : u < 0.86 ? 'golden' : 'overcast';
}

// where the sun stands, given the wind's direction (radians, sim.js: the way it comes from)
export function sunVector(L, windDir, out = new THREE.Vector3()) {
  const a = windDir + L.azimuth * Math.PI / 180, e = L.elevation * Math.PI / 180;
  return out.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).normalize();
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
    uMie: { value: 0.1 }, uCloud: { value: 0 },
  };
}
