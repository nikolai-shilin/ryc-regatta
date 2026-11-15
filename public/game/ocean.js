// Regatta: the short chop as a real sea spectrum (Tessendorf's FFT ocean), computed on the GPU every frame.
// The long swell stays the sum of sines in sim.js, which the boats feel; this adds the wind's own sea on top of it,
// waves that travel downwind at their own speeds (each wavelength at √(g·k + σ/ρ·k³)), so the surface never repeats
// the way a few sine trains or a scrolling noise map do. It is only the picture: the boats don't feel it.
//
// The sea is one spectrum (JONSWAP, for the race's wind blowing over a bay's fetch, its waves spread about the wind
// the way a real sea's are: narrowly at the peak, widely in the short ripples) drawn in up to three layers of N×N,
// each a patch of its own size tiled over the sea: 40 m for the chop that heaves the surface, then ~9 m and ~2 m for
// the wavelets and the capillary ripples that only tilt it. Each layer keeps its own band of the spectrum, so
// together they are the whole sea once, from 40 m waves down to ripples of a few centimetres.
//
// Each frame, per layer: the spectrum at time t (one pass), an inverse FFT along x then along z (log2 N passes each,
// Stockham, two complex fields per texel), then the displacement (dx, dy, dz) and from it the slopes and the Jacobian
// (where the chop folds over: the crests that break). The 40 m layer also keeps its whitecaps from frame to frame:
// foam is made where a crest breaks and stays on the water as the crest runs on, spreading and fading over seconds.
import * as THREE from 'three';

const QUAD_VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const G = 9.81, TENSION = 7.4e-5; // gravity; surface tension over density (m³/s²): it speeds the shortest ripples

// h(k, t) from h0: each wave moves downwind at its own ω. Packs the height and the sideways displacement into one
// complex number (both are real fields, so IFFT(Hy + i·Hx) = y + i·x) and the along-wind displacement into the other.
const SPECTRUM_FS = /* glsl */ `
uniform sampler2D uH0; uniform float uT, uN, uL;
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
void main() {
  vec2 ij = floor(gl_FragCoord.xy);
  vec2 m = vec2(ij.x < uN * 0.5 ? ij.x : ij.x - uN, ij.y < uN * 0.5 ? ij.y : ij.y - uN);
  vec2 k = 6.2831853 * m / uL; float kl = length(k);
  vec4 h0 = texture2D(uH0, (ij + 0.5) / uN); // xy: h0(k), zw: conj(h0(-k))
  float w = sqrt(${G} * kl + ${TENSION} * kl * kl * kl);
  float ph = mod(w * uT, 6.2831853);
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

// slopes (dh/dx, dh/dz of the displaced surface), the Jacobian of the horizontal squeeze (< 1 where crests sharpen)
// and the foam. The foam is last frame's (uPrev), spread a little to its neighbours, drifted downwind with the
// surface water and faded (uDecay); a crest folding over now (J under uJ0) makes it anew. Layers without foam keep 0.
const DERIV_FS = /* glsl */ `
uniform sampler2D uIn, uPrev; uniform float uN, uL, uDecay, uJ0, uGen, uFoam; uniform vec2 uDrift; varying vec2 vUv;
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
  float foam = 0.0;
  if (uFoam > 0.5) {
    vec2 q = vUv - uDrift;
    float c = texture2D(uPrev, q).a;
    float n4 = texture2D(uPrev, q + vec2(e, 0.0)).a + texture2D(uPrev, q - vec2(e, 0.0)).a + texture2D(uPrev, q + vec2(0.0, e)).a + texture2D(uPrev, q - vec2(0.0, e)).a;
    float old = mix(c, n4 * 0.25, 0.08) * uDecay;
    float born = smoothstep(uJ0, uJ0 - 0.07, J) * uGen;
    foam = max(old, born);
  }
  gl_FragColor = vec4(sx, sz, J, foam);
}`;

// What the water, wake, hull-contact and sea-shadow shaders include: the chop's displacement and slopes at a point
// of the sea, turned from each layer's axes (across, along the wind it was raised by; the shorter layers turned a
// little off it, and shifted, so no two layers' tiles ever line up) back into the world.
//  fftDisp: the 40 m layer's displacement (the shorter ones only tilt the surface; they'd alias on the mesh)
//  fftSlope: the 40 m layer's slopes (xy), its Jacobian (z) and its foam (w)
//  fftFine: the slopes of the shorter layers, each weighted (k.x the ~9 m one, k.y the ~2 m one)
export const OCEAN_GLSL = /* glsl */ `
uniform sampler2D uFftD, uFftS, uFftS1, uFftS2; uniform float uFftOn, uFftN; uniform vec3 uFftL; uniform vec2 uFftW;
vec2 fftAxis(float a) { return vec2(uFftW.x * cos(a) - uFftW.y * sin(a), uFftW.x * sin(a) + uFftW.y * cos(a)); }
vec2 fftQ(vec2 xz, vec2 w, float L) { return vec2(dot(xz, vec2(-w.y, w.x)), dot(xz, w)) / L; }
vec2 fftBack(vec2 s, vec2 w) { return s.x * vec2(-w.y, w.x) + s.y * w; }
vec3 fftDisp(vec2 xz) {
  vec3 d = texture2D(uFftD, fftQ(xz, uFftW, uFftL.x)).xyz * uFftOn;
  return vec3(fftBack(vec2(d.x, d.z), uFftW).x, d.y, fftBack(vec2(d.x, d.z), uFftW).y);
}
vec4 fftSlope(vec2 xz) {
  vec4 s = texture2D(uFftS, fftQ(xz, uFftW, uFftL.x));
  return vec4(fftBack(s.xy, uFftW) * uFftOn, mix(1.0, s.z, uFftOn), s.w * uFftOn);
}
vec2 fftFine(vec2 xz, vec2 k) {
  vec2 g = vec2(0.0);
  if (uFftN > 1.5 && k.x > 0.0) { vec2 w = fftAxis(0.41); g += fftBack(texture2D(uFftS1, fftQ(xz, w, uFftL.y) + vec2(0.37, 0.71)).xy, w) * k.x; }
  if (uFftN > 2.5 && k.y > 0.0) { vec2 w = fftAxis(-0.53); g += fftBack(texture2D(uFftS2, fftQ(xz, w, uFftL.z) + vec2(0.13, 0.29)).xy, w) * k.y; }
  return g;
}`;

let black = null;
export const blankOcean = () => {
  if (!black) { black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); black.needsUpdate = true; }
  return black;
};
export const oceanUniforms = () => ({
  uFftD: { value: blankOcean() }, uFftS: { value: blankOcean() }, uFftS1: { value: blankOcean() }, uFftS2: { value: blankOcean() },
  uFftOn: { value: 0 }, uFftN: { value: 0 }, uFftL: { value: new THREE.Vector3(40, 9, 2) }, uFftW: { value: new THREE.Vector2(0, 1) },
});

// the sea's spectrum: JONSWAP for a wind of U m/s over a fetch of F metres, as energy per (rad/m)² at the wavenumber
// (kx, kz), the wind blowing along +z. The waves spread about the wind as cos^2s(θ/2) (Hasselmann et al.): narrowly
// near the peak, more widely the shorter they are.
const spreadNorm = new Map();
function spreadN(s) {
  const key = Math.round(s * 20);
  if (!spreadNorm.has(key)) {
    let sum = 0; const M = 256;
    for (let i = 0; i < M; i++) { const th = -Math.PI + ((i + 0.5) * 2 * Math.PI) / M; sum += Math.abs(Math.cos(th / 2)) ** (2 * s) * (2 * Math.PI / M); }
    spreadNorm.set(key, 1 / sum);
  }
  return spreadNorm.get(key);
}
export function seaSpectrum(kx, kz, U, F) {
  const k = Math.hypot(kx, kz); if (k < 1e-6) return 0;
  const w = Math.sqrt(G * k), wp = 22 * Math.cbrt((G * G) / (U * F)), alpha = 0.076 * ((U * U) / (F * G)) ** 0.22;
  const sig = w <= wp ? 0.07 : 0.09, r = Math.exp(-((w - wp) ** 2) / (2 * sig * sig * wp * wp));
  const Sw = (alpha * G * G) / w ** 5 * Math.exp(-1.25 * (wp / w) ** 4) * 3.3 ** r;
  const s = Math.max(0.5, w < wp ? 6.97 * (w / wp) ** 4.06 : 9.77 * (w / wp) ** -2.33);
  const D = spreadN(s) * Math.abs(Math.cos(Math.atan2(kx, kz) / 2)) ** (2 * s);
  return ((Sw * (G / (2 * w))) / k) * D * Math.exp(-k * k * 1.6e-5); // dω/dk, per k (polar to cartesian); ripples under ~1 cm damped
}

export class Ocean {
  static supported(renderer) {
    return renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float');
  }

  // N: each layer's size in texels; Ls: the layers' patch sizes in metres, longest first
  constructor(renderer, N = 128, Ls = [40]) {
    this.r = renderer; this.N = N; this.Ls = Ls; this.L = Ls[0];
    const rt = (type, filter, extra = {}) => new THREE.WebGLRenderTarget(N, N, {
      type, format: THREE.RGBAFormat, minFilter: filter, magFilter: filter === THREE.NearestFilter ? THREE.NearestFilter : THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, depthBuffer: false, stencilBuffer: false, generateMipmaps: false, ...extra,
    });
    this.ping = rt(THREE.FloatType, THREE.NearestFilter); this.pong = rt(THREE.FloatType, THREE.NearestFilter);
    const slopeRT = () => { const s = rt(THREE.HalfFloatType, THREE.LinearMipmapLinearFilter, { generateMipmaps: true }); s.texture.anisotropy = 8; return s; }; // the mips keep far water from glittering
    this.layers = Ls.map((L, i) => {
      const h0 = new THREE.DataTexture(new Float32Array(N * N * 4), N, N, THREE.RGBAFormat, THREE.FloatType);
      h0.minFilter = h0.magFilter = THREE.NearestFilter;
      // the 40 m layer keeps its foam from frame to frame: two slope targets, written in turn
      return { L, h0, disp: rt(THREE.HalfFloatType, THREE.LinearFilter), slopes: i === 0 ? [slopeRT(), slopeRT()] : [slopeRT()], cur: 0 };
    });
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene(); this.scene.add(this.quad);
    const mat = (fs, uniforms, defines = {}) => new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: fs, uniforms, defines, depthTest: false, depthWrite: false });
    this.mSpec = mat(SPECTRUM_FS, { uH0: { value: null }, uT: { value: 0 }, uN: { value: N }, uL: { value: 40 } });
    this.mH = mat(FFT_FS, { uIn: { value: null }, uN: { value: N }, uS: { value: 2 } }, { HORIZONTAL: 1 });
    this.mV = mat(FFT_FS, { uIn: { value: null }, uN: { value: N }, uS: { value: 2 } });
    this.mDisp = mat(DISP_FS, { uIn: { value: null }, uChop: { value: -1 } });
    this.mDeriv = mat(DERIV_FS, {
      uIn: { value: null }, uPrev: { value: null }, uN: { value: N }, uL: { value: 40 }, uDecay: { value: 1 }, uJ0: { value: 0 },
      uGen: { value: 0 }, uFoam: { value: 0 }, uDrift: { value: new THREE.Vector2() },
    });
    this.foamGen = 0; this.foamJ0 = 0; this.foamTau = 4; this.drift = 0.2; this.lastT = null;
  }

  // the textures the sea is drawn from: the 40 m layer's displacement, and each layer's slopes (this frame's)
  get disp() { return this.layers[0].disp; }
  slope(i) { const l = this.layers[i]; return l ? l.slopes[l.cur].texture : null; }

  // a new sea for this wind (tws in knots), over a bay's fetch. The waves run downwind (those running up it are all
  // but none), the shortest steepest; their crests sharper in a breeze, and breaking into whitecaps from about force 4.
  setWind(tws, fetch = 8000) {
    const N = this.N, U = Math.max(2.5, tws * 0.514);
    let seed = 1234567 + Math.round(tws * 7);
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const gauss = () => { const u = Math.max(rnd(), 1e-7), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    // each layer keeps its band: from 4 of the next shorter layer's own wavelengths up, to the next longer's start
    const cut = this.Ls.map((L, i) => (i === 0 ? 0 : (2 * Math.PI) / L * 4)); cut.push(Infinity);
    this.layers.forEach((layer, c) => {
      const L = layer.L, dk = (2 * Math.PI) / L, data = layer.h0.image.data;
      const re = new Float32Array(N * N), im = new Float32Array(N * N);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const mi = i < N / 2 ? i : i - N, mj = j < N / 2 ? j : j - N, o = j * N + i;
        if (Math.abs(mi) === N / 2 || Math.abs(mj) === N / 2) { re[o] = im[o] = 0; continue; } // no partner across the Nyquist row
        const kx = mi * dk, kz = mj * dk, k = Math.hypot(kx, kz);
        // (Var = Σ |h(k)|², and h(k) carries both h0(k) and h0(-k): so E|h0|² is half the band's energy)
        const a = k < cut[c] || k >= cut[c + 1] ? 0 : Math.sqrt((seaSpectrum(kx, kz, U, fetch) * dk * dk) / 4);
        re[o] = gauss() * a; im[o] = gauss() * a;
      }
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const o = j * N + i, ni = (N - i) % N, nj = (N - j) % N, on = nj * N + ni;
        data[o * 4] = re[o]; data[o * 4 + 1] = im[o];
        data[o * 4 + 2] = re[on]; data[o * 4 + 3] = -im[on]; // conj(h0(-k))
      }
      layer.h0.needsUpdate = true;
    });
    this.chop = -(0.75 + 0.55 * Math.min(1, Math.max(0, (tws - 7) / 12))); // sharper crests in a breeze
    // whitecaps: none in a light breeze; from about 10 knots a few crests break, more as it blows harder. Which
    // crests break is set by the share of the sea that is breaking at any moment: 0.08 % at 10 knots to 0.45 % at
    // 20 (each breaking crest runs on and leaves its foam behind, so the share the foam covers is several times
    // that, as Monahan's whitecap coverage is), found in this sea's own folds the first frame it is drawn
    // (calibrate): the J under which that share of it lies
    const white = Math.min(1, Math.max(0, (tws - 9.5) / 10));
    this.white = white;
    this.foamGen = white > 0 ? 0.6 + 0.4 * white : 0;
    this.foamJ0 = 0; this.calibrate = white > 0;
    this.foamTau = 1.6 + 1.4 * white; // the foam lingers longer in a stronger wind
    this.drift = 0.03 * U; // the surface water's drift downwind, m/s
    this.clearFoam();
  }

  clearFoam() {
    const r = this.r, prev = r.getRenderTarget(), cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
    r.setClearColor(0x000000, 0);
    for (const t of this.layers[0].slopes) { r.setRenderTarget(t); r.clear(true, false, false); }
    r.setClearColor(cc, ca); r.setRenderTarget(prev);
  }

  pass(m, target) { this.quad.material = m; this.r.setRenderTarget(target); this.r.render(this.scene, this.cam); }

  update(t) {
    const r = this.r, prevT = r.getRenderTarget(), prevX = r.xr.enabled;
    r.xr.enabled = false;
    const dt = this.lastT == null ? 0 : Math.min(0.1, Math.max(0, t - this.lastT)); this.lastT = t;
    this.mSpec.uniforms.uT.value = t;
    this.mDisp.uniforms.uChop.value = this.chop ?? -1;
    this.layers.forEach((layer, c) => {
      this.mSpec.uniforms.uH0.value = layer.h0; this.mSpec.uniforms.uL.value = layer.L;
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
      this.pass(this.mDisp, layer.disp);
      const D = this.mDeriv.uniforms, foam = c === 0;
      D.uIn.value = layer.disp.texture; D.uL.value = layer.L; D.uFoam.value = foam ? 1 : 0;
      if (foam) {
        D.uPrev.value = layer.slopes[layer.cur].texture; layer.cur = 1 - layer.cur;
        D.uDecay.value = Math.exp(-dt / this.foamTau); D.uGen.value = dt > 0 ? this.foamGen : 0; D.uJ0.value = this.foamJ0;
        D.uDrift.value.set(0, (this.drift * dt) / layer.L); // along the patch's +z: downwind
      } else D.uPrev.value = layer.disp.texture; // (unread)
      this.pass(this.mDeriv, layer.slopes[layer.cur]);
      if (foam && this.calibrate) this.calibrateFoam(layer.slopes[layer.cur]);
    });
    r.setRenderTarget(prevT); r.xr.enabled = prevX;
  }

  // the threshold of folding (J) under which the share of the sea that should be breaking lies: read once from the
  // GPU, the first frame of a sea (one 128² read; the sea's statistics don't change after)
  calibrateFoam(rt) {
    this.calibrate = false;
    const N = this.N, buf = new Uint16Array(N * N * 4);
    try { this.r.readRenderTargetPixels(rt, 0, 0, N, N, buf); } catch (e) { return; }
    const J = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) J[i] = THREE.DataUtils.fromHalfFloat(buf[i * 4 + 2]);
    J.sort();
    const share = 0.0008 + 0.0037 * this.white;
    this.foamJ0 = J[Math.min(N * N - 1, Math.floor(N * N * share))] + 0.035; // (born fully a little under it)
  }

  dispose() {
    for (const t of [this.ping, this.pong]) t.dispose();
    for (const l of this.layers) { l.h0.dispose(); l.disp.dispose(); for (const s of l.slopes) s.dispose(); }
    for (const m of [this.mSpec, this.mH, this.mV, this.mDisp, this.mDeriv]) m.dispose();
  }
}
