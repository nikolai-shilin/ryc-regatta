// Regatta: the short chop as a real sea spectrum (Tessendorf's FFT ocean), computed on the GPU every frame.
// The long swell stays the sum of sines in sim.js, which the boats feel; this adds the wind's own chop on top of it,
// 0.6–40 m waves that travel downwind at their own speeds (each wavelength at √(g·k)), so the surface never repeats
// the way a few sine trains or a scrolling noise map do. It is only the picture: the boats don't feel it.
//
// One patch of L metres, N×N, tiled over the sea. Each frame: the spectrum at time t (one pass), an inverse FFT along
// x then along z (log2 N passes each, Stockham, two complex fields per texel), then the displacement (dx, dy, dz) and
// from it the slopes and the Jacobian (where the chop folds over: the crests that break into foam).
import * as THREE from 'three';

const QUAD_VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

// h(k, t) from h0: each wave moves downwind at ω = √(g k). Packs the height and the sideways displacement into one
// complex number (both are real fields, so IFFT(Hy + i·Hx) = y + i·x) and the along-wind displacement into the other.
const SPECTRUM_FS = /* glsl */ `
uniform sampler2D uH0; uniform float uT, uN, uL;
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
void main() {
  vec2 ij = floor(gl_FragCoord.xy);
  vec2 m = vec2(ij.x < uN * 0.5 ? ij.x : ij.x - uN, ij.y < uN * 0.5 ? ij.y : ij.y - uN);
  vec2 k = 6.2831853 * m / uL; float kl = length(k);
  vec4 h0 = texture2D(uH0, (ij + 0.5) / uN); // xy: h0(k), zw: conj(h0(-k))
  float ph = mod(sqrt(9.81 * kl) * uT, 6.2831853);
  vec2 e = vec2(cos(ph), -sin(ph));
  vec2 h = cmul(h0.xy, e) + cmul(h0.zw, vec2(e.x, -e.y));
  vec2 kn = kl > 1e-6 ? k / kl : vec2(0.0);
  vec2 a = h + kn.x * h;              // Hy + i·Hx, with Hx = -i (kx/k) h
  vec2 b = vec2(h.y, -h.x) * kn.y;    // Hz = -i (kz/k) h
  gl_FragColor = vec4(a, b);
}`;

// one Stockham radix-2 stage of the inverse FFT, on two complex fields at once
const FFT_FS = /* glsl */ `
uniform sampler2D uIn; uniform float uN, uS;
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
void main() {
#ifdef HORIZONTAL
  float i = floor(gl_FragCoord.x), o = gl_FragCoord.y;
#else
  float i = floor(gl_FragCoord.y), o = gl_FragCoord.x;
#endif
  float ev = floor(i / uS) * (uS * 0.5) + mod(i, uS * 0.5);
#ifdef HORIZONTAL
  vec4 even = texture2D(uIn, vec2(ev + 0.5, o) / uN), odd = texture2D(uIn, vec2(ev + uN * 0.5 + 0.5, o) / uN);
#else
  vec4 even = texture2D(uIn, vec2(o, ev + 0.5) / uN), odd = texture2D(uIn, vec2(o, ev + uN * 0.5 + 0.5) / uN);
#endif
  float ang = 6.2831853 * (i / uS);
  vec2 tw = vec2(cos(ang), sin(ang));
  gl_FragColor = vec4(even.xy + cmul(tw, odd.xy), even.zw + cmul(tw, odd.zw));
}`;

// the displacement in metres: x across the wind, y up, z along it (the chop pinches the crests: λ < 0)
const DISP_FS = /* glsl */ `
uniform sampler2D uIn; uniform float uChop; varying vec2 vUv;
void main() { vec4 f = texture2D(uIn, vUv); gl_FragColor = vec4(f.y * uChop, f.x, f.z * uChop, 1.0); }`;

// slopes (dh/dx, dh/dz of the displaced surface) and the Jacobian of the horizontal squeeze (< 1 where crests sharpen)
const DERIV_FS = /* glsl */ `
uniform sampler2D uIn; uniform float uN, uL; varying vec2 vUv;
void main() {
  float e = 1.0 / uN, d = uL / uN;
  vec3 xp = texture2D(uIn, vUv + vec2(e, 0.0)).xyz, xm = texture2D(uIn, vUv - vec2(e, 0.0)).xyz;
  vec3 zp = texture2D(uIn, vUv + vec2(0.0, e)).xyz, zm = texture2D(uIn, vUv - vec2(0.0, e)).xyz;
  vec3 tx = vec3(2.0 * d + xp.x - xm.x, xp.y - xm.y, xp.z - xm.z);
  vec3 tz = vec3(zp.x - zm.x, zp.y - zm.y, 2.0 * d + zp.z - zm.z);
  float jxx = tx.x / (2.0 * d), jzz = tz.z / (2.0 * d), jxz = tz.x / (2.0 * d), jzx = tx.z / (2.0 * d);
  float J = jxx * jzz - jxz * jzx;
  // slopes of the surface as a height field over the (displaced) plane
  float sx = tx.y / max(tx.x, 0.05 * d), sz = tz.y / max(tz.z, 0.05 * d);
  gl_FragColor = vec4(sx, sz, J, 1.0);
}`;

// What the water, wake, hull-contact and sea-shadow shaders include: the chop's displacement and slopes at a point
// of the sea, turned from the patch's axes (across, along the wind it was raised by) back into the world.
export const OCEAN_GLSL = /* glsl */ `
uniform sampler2D uFftD, uFftS; uniform float uFftOn, uFftL; uniform vec2 uFftW;
vec2 fftQ(vec2 xz) { return vec2(dot(xz, vec2(-uFftW.y, uFftW.x)), dot(xz, uFftW)) / uFftL; }
vec3 fftDisp(vec2 xz) {
  vec3 d = texture2D(uFftD, fftQ(xz)).xyz * uFftOn;
  vec2 a = vec2(-uFftW.y, uFftW.x);
  return vec3(d.x * a.x + d.z * uFftW.x, d.y, d.x * a.y + d.z * uFftW.y);
}
// xy: the height's gradient in the world (x, z), z: the Jacobian
vec3 fftSlope(vec2 xz) {
  vec3 s = texture2D(uFftS, fftQ(xz)).xyz;
  vec2 a = vec2(-uFftW.y, uFftW.x);
  return vec3((s.x * a + s.y * uFftW) * uFftOn, mix(1.0, s.z, uFftOn));
}`;

let black = null;
export const blankOcean = () => {
  if (!black) { black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); black.needsUpdate = true; }
  return black;
};
export const oceanUniforms = () => ({
  uFftD: { value: blankOcean() }, uFftS: { value: blankOcean() }, uFftOn: { value: 0 }, uFftL: { value: 40 }, uFftW: { value: new THREE.Vector2(0, 1) },
});

export class Ocean {
  static supported(renderer) {
    return renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float');
  }

  constructor(renderer, N = 128, L = 40) {
    this.r = renderer; this.N = N; this.L = L;
    const rt = (type, filter, extra = {}) => new THREE.WebGLRenderTarget(N, N, {
      type, format: THREE.RGBAFormat, minFilter: filter, magFilter: filter === THREE.NearestFilter ? THREE.NearestFilter : THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, depthBuffer: false, stencilBuffer: false, generateMipmaps: false, ...extra,
    });
    this.ping = rt(THREE.FloatType, THREE.NearestFilter); this.pong = rt(THREE.FloatType, THREE.NearestFilter);
    this.disp = rt(THREE.HalfFloatType, THREE.LinearFilter);
    this.slope = rt(THREE.HalfFloatType, THREE.LinearMipmapLinearFilter, { generateMipmaps: true }); // the mips are what keeps far water from glittering
    this.slope.texture.anisotropy = 8;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene(); this.scene.add(this.quad);
    const mat = (fs, uniforms, defines = {}) => new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: fs, uniforms, defines, depthTest: false, depthWrite: false });
    this.h0 = new THREE.DataTexture(new Float32Array(N * N * 4), N, N, THREE.RGBAFormat, THREE.FloatType);
    this.h0.minFilter = this.h0.magFilter = THREE.NearestFilter;
    this.mSpec = mat(SPECTRUM_FS, { uH0: { value: this.h0 }, uT: { value: 0 }, uN: { value: N }, uL: { value: L } });
    this.mH = mat(FFT_FS, { uIn: { value: null }, uN: { value: N }, uS: { value: 2 } }, { HORIZONTAL: 1 });
    this.mV = mat(FFT_FS, { uIn: { value: null }, uN: { value: N }, uS: { value: 2 } });
    this.mDisp = mat(DISP_FS, { uIn: { value: null }, uChop: { value: -1 } });
    this.mDeriv = mat(DERIV_FS, { uIn: { value: this.disp.texture }, uN: { value: N }, uL: { value: L } });
  }

  // a new sea for this wind: a Phillips spectrum with the waves running downwind (the few running up it much smaller),
  // scaled so the chop's height suits the breeze. tws in knots.
  setWind(tws) {
    const N = this.N, L = this.L, data = this.h0.image.data;
    const V = Math.max(2, tws * 0.514) * 0.75, Lw = (V * V) / 9.81, l = 0.08; // the shortest waves die out below ~l
    let seed = 1234567 + Math.round(tws * 7);
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const gauss = () => { const u = Math.max(rnd(), 1e-7), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const P = (kx, kz) => {
      const k2 = kx * kx + kz * kz;
      if (k2 < 1e-8) return 0;
      const k = Math.sqrt(k2), c = kz / k; // the wind blows along +z of the patch
      let p = Math.exp(-1 / (k2 * Lw * Lw)) / (k2 * k2) * c * c * Math.exp(-k2 * l * l);
      if (c < 0) p *= 0.07;
      return p;
    };
    const re = new Float32Array(N * N), im = new Float32Array(N * N);
    let sum = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const mi = i < N / 2 ? i : i - N, mj = j < N / 2 ? j : j - N, o = j * N + i;
      if (Math.abs(mi) === N / 2 || Math.abs(mj) === N / 2) { re[o] = im[o] = 0; continue; } // no partner across the Nyquist row
      const a = Math.sqrt(P((2 * Math.PI * mi) / L, (2 * Math.PI * mj) / L) / 2);
      re[o] = gauss() * a; im[o] = gauss() * a;
      sum += re[o] * re[o] + im[o] * im[o];
    }
    // height: rms of a few centimetres in a light breeze to ~0.2 m in a strong one (on top of the swell)
    const rms = 0.035 + 0.0095 * Math.max(0, tws - 5);
    const sc = sum > 0 ? rms / Math.sqrt(2 * sum) : 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const o = j * N + i, ni = (N - i) % N, nj = (N - j) % N, on = nj * N + ni;
      data[o * 4] = re[o] * sc; data[o * 4 + 1] = im[o] * sc;
      data[o * 4 + 2] = re[on] * sc; data[o * 4 + 3] = -im[on] * sc; // conj(h0(-k))
    }
    this.h0.needsUpdate = true;
    this.mDisp.uniforms.uChop.value = -(0.7 + 0.5 * Math.min(1, Math.max(0, (tws - 7) / 12))); // sharper crests in a breeze
  }

  pass(m, target) { this.quad.material = m; this.r.setRenderTarget(target); this.r.render(this.scene, this.cam); }

  update(t) {
    const r = this.r, prevT = r.getRenderTarget(), prevX = r.xr.enabled;
    r.xr.enabled = false;
    this.mSpec.uniforms.uT.value = t;
    this.pass(this.mSpec, this.ping);
    let src = this.ping, dst = this.pong;
    for (const m of [this.mH, this.mV]) {
      for (let s = 2; s <= this.N; s *= 2) {
        m.uniforms.uIn.value = src.texture; m.uniforms.uS.value = s;
        this.pass(m, dst);
        [src, dst] = [dst, src];
      }
    }
    this.mDisp.uniforms.uIn.value = src.texture;
    this.pass(this.mDisp, this.disp);
    this.pass(this.mDeriv, this.slope);
    r.setRenderTarget(prevT); r.xr.enabled = prevX;
  }

  dispose() {
    for (const t of [this.ping, this.pong, this.disp, this.slope]) t.dispose();
    this.h0.dispose();
  }
}
