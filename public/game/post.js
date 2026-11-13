// Regatta: what the camera does to the picture after the scene is drawn, and the sea's mirror.
//
// Post: the scene is drawn in linear HDR into a multisampled target (so it is antialiased however the canvas was made),
// then the brightest light — the sun's glints on the water, the disc, a sunlit sail — spreads into a soft bloom
// (a dual-filter blur down and back up a chain of smaller targets), a faint vignette darkens the corners, and only
// then is the picture tone mapped (ACES) and written to the screen. The labels over the boats are drawn afterwards,
// straight to the screen, so they stay crisp and untouched.
//
// Mirror: the boats, marks, the land and birds drawn from below the sea, for the water shader to reflect.
import * as THREE from 'three';

export const OVERLAY = 1; // the layer of what is drawn after the post (the boats' name tags)
export const MIRRORED = 2; // the layer of what the sea reflects

const QUAD_VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
// a safety net: a NaN or an infinity from any shader would turn black in the tone mapping and spread through the
// bloom as a halo, so they are dropped (a NaN fails every comparison; the selects are exact) and the rest capped
const FINITE = /* glsl */ `
vec3 finite(vec3 c) {
  c.r = c.r >= 0.0 && c.r < 6e4 ? c.r : (c.r >= 6e4 ? 6e4 : 0.0);
  c.g = c.g >= 0.0 && c.g < 6e4 ? c.g : (c.g >= 6e4 ? 6e4 : 0.0);
  c.b = c.b >= 0.0 && c.b < 6e4 ? c.b : (c.b >= 6e4 ? 6e4 : 0.0);
  return min(c, vec3(64.0));
}`;

// the bright part, with a soft knee, and a first step down (13 taps would be steadier; 4 bilinear taps + the
// luminance-weighted average keep single glints from flickering)
const PREFILTER_FS = /* glsl */ `
uniform sampler2D uIn; uniform vec2 uTexel; uniform float uThr, uKnee; varying vec2 vUv;
${FINITE}
vec3 bright(vec3 c) {
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThr + uKnee, 0.0, 2.0 * uKnee); soft = soft * soft / (4.0 * uKnee + 1e-4);
  return c * max(soft, br - uThr) / max(br, 1e-4);
}
void main() {
  vec3 s = vec3(0.0); float w = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 o = vec2(i == 1 || i == 3 ? 1.0 : -1.0, i >= 2 ? 1.0 : -1.0) * uTexel;
    vec3 c = finite(texture2D(uIn, vUv + o).rgb);
    float k = 1.0 / (1.0 + max(c.r, max(c.g, c.b))); // Karis: a single blazing pixel doesn't dominate
    s += bright(c) * k; w += k;
  }
  gl_FragColor = vec4(s / w, 1.0);
}`;
const DOWN_FS = /* glsl */ `
uniform sampler2D uIn; uniform vec2 uTexel; varying vec2 vUv;
void main() {
  vec3 s = texture2D(uIn, vUv).rgb * 4.0;
  s += texture2D(uIn, vUv + vec2(-1.0, -1.0) * uTexel).rgb; s += texture2D(uIn, vUv + vec2(1.0, -1.0) * uTexel).rgb;
  s += texture2D(uIn, vUv + vec2(-1.0, 1.0) * uTexel).rgb; s += texture2D(uIn, vUv + vec2(1.0, 1.0) * uTexel).rgb;
  gl_FragColor = vec4(s / 8.0, 1.0);
}`;
const UP_FS = /* glsl */ `
uniform sampler2D uIn; uniform vec2 uTexel; uniform float uW; varying vec2 vUv;
void main() {
  vec2 t = uTexel; vec3 s = vec3(0.0);
  s += texture2D(uIn, vUv + vec2(-2.0, 0.0) * t).rgb; s += texture2D(uIn, vUv + vec2(2.0, 0.0) * t).rgb;
  s += texture2D(uIn, vUv + vec2(0.0, -2.0) * t).rgb; s += texture2D(uIn, vUv + vec2(0.0, 2.0) * t).rgb;
  s += texture2D(uIn, vUv + vec2(-1.0, -1.0) * t).rgb * 2.0; s += texture2D(uIn, vUv + vec2(1.0, -1.0) * t).rgb * 2.0;
  s += texture2D(uIn, vUv + vec2(-1.0, 1.0) * t).rgb * 2.0; s += texture2D(uIn, vUv + vec2(1.0, 1.0) * t).rgb * 2.0;
  gl_FragColor = vec4(s / 12.0 * uW, 1.0);
}`;
const COMPOSITE_FS = /* glsl */ `
uniform sampler2D uScene, uBloom; uniform float uBloomK, uVig, uAspect; varying vec2 vUv;
${FINITE}
void main() {
  vec3 c = finite(texture2D(uScene, vUv).rgb) + finite(texture2D(uBloom, vUv).rgb) * uBloomK;
  vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
  c *= 1.0 - uVig * smoothstep(0.45, 1.0, length(q) / (0.5 * length(vec2(uAspect, 1.0)))); // corners a touch darker, as a lens has them
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Post {
  static supported(renderer) { return renderer.capabilities.isWebGL2; }

  constructor(renderer) {
    this.r = renderer;
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true, stencilBuffer: true });
    this.mips = [];
    const mat = (fs, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, ...extra });
    this.mPre = mat(PREFILTER_FS, { uIn: { value: null }, uTexel: { value: new THREE.Vector2() }, uThr: { value: 2.2 }, uKnee: { value: 0.9 } });
    this.mDown = mat(DOWN_FS, { uIn: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mUp = mat(UP_FS, { uIn: { value: null }, uTexel: { value: new THREE.Vector2() }, uW: { value: 1 } }, { blending: THREE.AdditiveBlending, transparent: true });
    this.mComp = mat(COMPOSITE_FS, { uScene: { value: this.rt.texture }, uBloom: { value: null }, uBloomK: { value: 0.32 }, uVig: { value: 0.22 }, uAspect: { value: 1 } });
    this.levels = 5; this.samples = 4;
    this.w = this.h = 0;
  }

  // how much of it: the number of blur steps (fewer: a tighter, cheaper bloom) and the multisampling
  setLevel({ bloomLevels = 5, samples = 4 }) {
    if (bloomLevels !== this.levels) { this.levels = bloomLevels; this.w = 0; }
    if (samples !== this.samples) { this.samples = samples; this.rt.samples = samples; this.rt.dispose(); }
  }

  setLook({ threshold, strength, vignette }) {
    if (threshold != null) this.mPre.uniforms.uThr.value = threshold;
    if (strength != null) this.mComp.uniforms.uBloomK.value = strength;
    if (vignette != null) this.mComp.uniforms.uVig.value = vignette;
  }

  size() {
    const v = this.r.getDrawingBufferSize(this._v || (this._v = new THREE.Vector2()));
    const w = Math.max(1, v.x), h = Math.max(1, v.y);
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.rt.setSize(w, h);
    for (const m of this.mips) m.dispose();
    this.mips = [];
    let mw = w, mh = h;
    for (let i = 0; i < this.levels; i++) {
      mw = Math.max(1, Math.round(mw / 2)); mh = Math.max(1, Math.round(mh / 2));
      this.mips.push(new THREE.WebGLRenderTarget(mw, mh, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }));
    }
    this.mComp.uniforms.uAspect.value = w / h;
  }

  pass(m, target, clear = true) {
    this.quad.material = m;
    this.r.setRenderTarget(target);
    const ac = this.r.autoClear; this.r.autoClear = clear;
    this.r.render(this.scene, this.cam);
    this.r.autoClear = ac;
  }

  // the scene into the HDR target, then bloom, then the screen; overlay() draws the labels on top
  render(scene, camera, overlay) {
    this.size();
    const r = this.r;
    r.setRenderTarget(this.rt);
    r.render(scene, camera);
    // bloom: down the chain…
    const M = this.mips;
    this.mPre.uniforms.uIn.value = this.rt.texture; this.mPre.uniforms.uTexel.value.set(0.5 / this.w, 0.5 / this.h);
    this.pass(this.mPre, M[0]);
    for (let i = 1; i < M.length; i++) {
      this.mDown.uniforms.uIn.value = M[i - 1].texture; this.mDown.uniforms.uTexel.value.set(1 / M[i - 1].width, 1 / M[i - 1].height);
      this.pass(this.mDown, M[i]);
    }
    // …and back up, each step added onto the larger one
    for (let i = M.length - 1; i > 0; i--) {
      this.mUp.uniforms.uIn.value = M[i].texture; this.mUp.uniforms.uTexel.value.set(0.5 / M[i].width, 0.5 / M[i].height);
      this.mUp.uniforms.uW.value = 1;
      this.pass(this.mUp, M[i - 1], false);
    }
    this.mComp.uniforms.uBloom.value = M[0].texture;
    this.pass(this.mComp, null);
    if (overlay) overlay();
  }

  dispose() { this.rt.dispose(); for (const m of this.mips) m.dispose(); }
}

// The sea's mirror: the camera reflected in the plane of the sea, its frustum clipped at the surface (an oblique
// near plane), drawing only what is on the MIRRORED layer into a half-size HDR target. The water shader projects
// each of its points with `matrix` and ripples the look-up with its normal.
export class Mirror {
  constructor(renderer) {
    this.r = renderer;
    this.cam = new THREE.PerspectiveCamera();
    this.cam.layers.set(MIRRORED);
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.matrix = new THREE.Matrix4();
    this.scale = 0.5;
    this._p = new THREE.Vector3(); this._t = new THREE.Vector3(); this._l = new THREE.Vector3(); this._rot = new THREE.Matrix4();
    this._plane = new THREE.Plane(); this._clip = new THREE.Vector4(); this._q = new THREE.Vector4(); this._v = new THREE.Vector2();
  }

  setScale(s) { this.scale = s; }

  render(scene, camera) {
    const r = this.r, N = new THREE.Vector3(0, 1, 0);
    const v = r.getDrawingBufferSize(this._v), w = Math.max(1, Math.round(v.x * this.scale)), h = Math.max(1, Math.round(v.y * this.scale));
    if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h);
    const camPos = this._p.setFromMatrixPosition(camera.matrixWorld);
    if (camPos.y <= 0.05) return false; // under the surface (it never happens): no mirror
    const vc = this.cam;
    vc.position.set(camPos.x, -camPos.y, camPos.z);
    this._rot.extractRotation(camera.matrixWorld);
    const look = this._l.set(0, 0, -1).applyMatrix4(this._rot).add(camPos);
    vc.up.set(0, 1, 0).applyMatrix4(this._rot).reflect(N);
    vc.lookAt(look.x, -look.y, look.z);
    vc.far = camera.far; vc.near = camera.near;
    vc.updateMatrixWorld();
    vc.projectionMatrix.copy(camera.projectionMatrix);
    // the oblique near plane at the sea (a hand's breadth under it, so a hull's waterline doesn't flicker)
    this._plane.setFromNormalAndCoplanarPoint(N, this._t.set(0, -0.15, 0)).applyMatrix4(vc.matrixWorldInverse);
    const c = this._clip.set(this._plane.normal.x, this._plane.normal.y, this._plane.normal.z, this._plane.constant), e = vc.projectionMatrix.elements;
    const q = this._q.set((Math.sign(c.x) + e[8]) / e[0], (Math.sign(c.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
    c.multiplyScalar(2 / c.dot(q));
    e[2] = c.x; e[6] = c.y; e[10] = c.z + 1; e[14] = c.w;
    vc.projectionMatrixInverse.copy(vc.projectionMatrix).invert();
    this.matrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse);
    const prevT = r.getRenderTarget(), prevC = r.getClearAlpha(), cc = r.getClearColor(this._cc || (this._cc = new THREE.Color()));
    const sm = r.shadowMap.autoUpdate; r.shadowMap.autoUpdate = false; // the sun's shadow map is the main pass's
    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 0); // alpha 0 where nothing is reflected: the water keeps its sky there
    r.clear();
    r.render(scene, vc);
    r.setClearColor(cc, prevC);
    r.shadowMap.autoUpdate = sm;
    r.setRenderTarget(prevT);
    return true;
  }

  dispose() { this.rt.dispose(); }
}
