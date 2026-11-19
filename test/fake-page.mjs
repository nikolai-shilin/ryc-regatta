// What a browser gives the game's 3D modules, for Node: a canvas with a 2D context as strict as a real one about what it
// is handed, images that load, fetch answered from the files in public/ (never the network), a clock of frames that only
// moves when a test says so, and a renderer that draws nothing but remembers everything it was asked to do. three.js
// itself needs no stand-in: geometry, materials, scene graphs and matrices all work without a GL context.
//
//   import { mock } from './load.mjs';
//   import { installPage, fakeRenderer } from './fake-page.mjs';
//   installPage();
//   const { Post } = await import('../public/game/post.js');
//
// Nothing here imports three, so this file can be imported statically before the loader's hooks have run.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PUBLIC = new URL('../public/', import.meta.url);

// ---------- pixels ----------
export class FakeImageData {
  constructor(a, b, c) {
    if (typeof a === 'number') { this.width = a; this.height = b; this.data = new Uint8ClampedArray(a * b * 4); }
    else { this.data = a; this.width = b; this.height = c ?? a.length / 4 / b; }
    if (!(this.width > 0) || !(this.height > 0)) throw new RangeError(`ImageData: bad size ${this.width} x ${this.height}`);
  }
}

class Gradient {
  constructor(kind, args) {
    if (!args.every(Number.isFinite)) throw new TypeError(`${kind}: a coordinate is not finite: ${args}`);
    this.kind = kind; this.args = args; this.stops = [];
  }
  addColorStop(offset, color) {
    if (!(offset >= 0 && offset <= 1)) throw new RangeError(`addColorStop: offset ${offset} is outside 0…1`);
    if (typeof color !== 'string' || !color) throw new SyntaxError(`addColorStop: bad colour ${color}`);
    this.stops.push([offset, color]);
  }
}

const STATE = () => ({
  fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', miterLimit: 10, lineDashOffset: 0,
  font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic', direction: 'ltr', letterSpacing: '0px',
  globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none', shadowBlur: 0, shadowColor: 'rgba(0,0,0,0)', shadowOffsetX: 0, shadowOffsetY: 0,
  imageSmoothingEnabled: true, imageSmoothingQuality: 'low',
});
const DRAWS = ['fillRect', 'strokeRect', 'clearRect', 'fill', 'stroke', 'clip', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect',
  'scale', 'rotate', 'translate', 'transform', 'setTransform', 'resetTransform'];

export class FakeContext2D {
  constructor(canvas) {
    this.canvas = canvas; this.stack = []; this.counts = {}; this.texts = []; this.images = []; this.rects = []; this.dash = [];
    Object.assign(this, STATE());
  }
  reset() { Object.assign(this, STATE()); this.stack = []; this.dash = []; }
  save() { const s = {}; for (const k of Object.keys(STATE())) s[k] = this[k]; this.stack.push(s); this.counts.save = (this.counts.save || 0) + 1; }
  restore() { const s = this.stack.pop(); if (s) Object.assign(this, s); }
  setLineDash(d) { this.dash = d.slice(); }
  getLineDash() { return this.dash.slice(); }
  fillText(text, x, y) { this.counts.fillText = (this.counts.fillText || 0) + 1; this.texts.push({ text: String(text), x, y, font: this.font, fill: this.fillStyle, align: this.textAlign }); }
  strokeText(text, x, y) { this.counts.strokeText = (this.counts.strokeText || 0) + 1; this.texts.push({ text: String(text), x, y, font: this.font, stroke: this.strokeStyle }); }
  measureText(text) {
    const px = parseFloat(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? 10), width = String(text).length * px * 0.6;
    return { width, actualBoundingBoxLeft: 0, actualBoundingBoxRight: width, actualBoundingBoxAscent: px * 0.8, actualBoundingBoxDescent: px * 0.2, fontBoundingBoxAscent: px * 0.9, fontBoundingBoxDescent: px * 0.25 };
  }
  createLinearGradient(...a) { return new Gradient('linear', a); }
  createRadialGradient(...a) { if (a[2] < 0 || a[5] < 0) throw new RangeError('createRadialGradient: a negative radius'); return new Gradient('radial', a); }
  createConicGradient(...a) { return new Gradient('conic', a); }
  createPattern(image, repeat) { return { image, repeat, setTransform() {} }; }
  createImageData(w, h) { return w?.data ? new FakeImageData(w.width, w.height) : new FakeImageData(Math.abs(w), Math.abs(h)); }
  // what was put there, else what the page's `paint` gives (by default a solid mid grey: something drawn, everywhere)
  getImageData(x, y, w, h) {
    if (!(w > 0) || !(h > 0)) throw new RangeError(`getImageData: bad size ${w} x ${h}`);
    const out = new FakeImageData(w, h), have = this.canvas.pixels, paint = this.canvas.paint ?? page.paint;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const o = (j * w + i) * 4, sx = x + i, sy = y + j;
      if (have && sx >= 0 && sy >= 0 && sx < have.width && sy < have.height) { const q = (sy * have.width + sx) * 4; for (let k = 0; k < 4; k++) out.data[o + k] = have.data[q + k]; }
      else { const c = paint(sx, sy, this.canvas); for (let k = 0; k < 4; k++) out.data[o + k] = c[k]; }
    }
    return out;
  }
  putImageData(img, x = 0, y = 0) {
    this.counts.putImageData = (this.counts.putImageData || 0) + 1;
    if (!x && !y) this.canvas.pixels = img;
  }
  drawImage(image, ...a) {
    if (image == null) throw new TypeError('drawImage: no image');
    this.counts.drawImage = (this.counts.drawImage || 0) + 1; this.images.push({ image, args: a });
  }
}
for (const m of DRAWS) FakeContext2D.prototype[m] = function (...a) {
  this.counts[m] = (this.counts[m] || 0) + 1;
  if (m === 'fillRect' && this.rects.length < 4000) this.rects.push({ x: a[0], y: a[1], w: a[2], h: a[3], fill: this.fillStyle });
};

export class FakeCanvas {
  constructor(w = 300, h = 150) { this._w = w; this._h = h; this.style = {}; this.listeners = {}; page.canvases?.push(this); }
  // as a real canvas: its size is a whole number, and setting it wipes the picture and the context's state
  get width() { return this._w; } set width(v) { this._w = Math.max(0, Math.trunc(v) || 0); this.ctx?.reset(); this.pixels = null; }
  get height() { return this._h; } set height(v) { this._h = Math.max(0, Math.trunc(v) || 0); this.ctx?.reset(); this.pixels = null; }
  get clientWidth() { return this._w; } get clientHeight() { return this._h; }
  getContext(kind) { if (kind !== '2d') return null; return (this.ctx ||= new FakeContext2D(this)); }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); } removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] || []).filter((g) => g !== f); }
  getBoundingClientRect() { return { left: 0, top: 0, width: this._w, height: this._h, right: this._w, bottom: this._h }; }
  toDataURL() { return 'data:image/png;base64,'; }
  toBlob(cb) { cb(new Blob([])); }
  setAttribute() {} getAttribute() { return null; } remove() {}
}

// ---------- images: they load (or fail, by address) a moment after their src is set ----------
export class FakeImage {
  constructor(w, h) { this.width = this.naturalWidth = w ?? 64; this.height = this.naturalHeight = h ?? 64; this.listeners = {}; this.style = {}; this.complete = false; }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] || []).filter((g) => g !== f); }
  decode() { return Promise.resolve(); }
  setAttribute() {} getAttribute() { return null; }
  get src() { return this._src; }
  set src(v) {
    this._src = v;
    page.images?.push(v);
    if (String(v).startsWith('data:image/webp')) this.width = this.height = this.naturalWidth = this.naturalHeight = 1; // (what GLTFLoader asks of a browser that can show WebP)
    queueMicrotask(() => {
      const bad = page.badImage(v), type = bad ? 'error' : 'load', ev = { type, target: this };
      this.complete = !bad;
      this[`on${type}`]?.(ev);
      for (const f of this.listeners[type] || []) f.call(this, ev);
    });
  }
}

// ---------- the page ----------
export const page = { canvases: [], images: [], fetched: [], frames: [], idle: [], badImage: () => false, paint: () => [128, 128, 128, 255] };

function define(name, value) { Object.defineProperty(globalThis, name, { value, configurable: true, writable: true, enumerable: true }); }
const memoryStore = (start = {}) => {
  const m = new Map(Object.entries(start));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k), clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } };
};

// Options: search ('?venue=garda'), pathname, userAgent, storage ({ key: value }), sponsor (what /sponsor answers),
// routes ({ url part: json or (url) => Response }), noModels (a .glb never comes, as a failed download),
// devicePixelRatio, badImage (src) => whether that image fails, paint (x, y, canvas) => [r, g, b, a] for getImageData.
export function installPage(o = {}) {
  const { search = '', pathname = '/', userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
    hostname = 'example.test', storage = {}, sponsor = null, routes = {}, noModels = false, devicePixelRatio = 1 } = o;
  page.badImage = o.badImage ?? (() => false); page.paint = o.paint ?? (() => [128, 128, 128, 255]);
  page.canvases.length = page.images.length = page.fetched.length = page.frames.length = page.idle.length = 0;
  const listeners = {};
  const target = {
    addEventListener(t, f) { (listeners[t] ||= []).push(f); }, removeEventListener(t, f) { listeners[t] = (listeners[t] || []).filter((g) => g !== f); },
    dispatchEvent(e) { for (const f of listeners[e.type] || []) f(e); return true; },
  };
  const element = (tag) => {
    const t = String(tag).toLowerCase();
    if (t === 'canvas') return new FakeCanvas();
    if (t === 'img') return new FakeImage();
    return { tagName: t.toUpperCase(), style: {}, dataset: {}, children: [], classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, appendChild(c) { this.children.push(c); return c; }, append() {}, remove() {}, setAttribute() {}, getAttribute: () => null, addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
  };
  define('self', globalThis);
  define('window', globalThis);
  define('document', { ...target, createElement: element, createElementNS: (ns, tag) => element(tag), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: element('body'), documentElement: element('html'), head: element('head'), hidden: false, visibilityState: 'visible', fonts: { ready: Promise.resolve(), load: () => Promise.resolve([]), check: () => true, add() {} } });
  define('navigator', { userAgent, platform: 'MacIntel', language: 'en', languages: ['en'], hardwareConcurrency: 8, deviceMemory: 8, maxTouchPoints: 0, onLine: true, connection: {} });
  define('location', { search, pathname, hostname, host: hostname, origin: `https://${hostname}`, protocol: 'https:', href: `https://${hostname}${pathname}${search}`, hash: '' });
  define('localStorage', memoryStore(storage));
  define('sessionStorage', memoryStore());
  define('devicePixelRatio', devicePixelRatio);
  define('innerWidth', 1280); define('innerHeight', 720);
  define('addEventListener', target.addEventListener); define('removeEventListener', target.removeEventListener); define('dispatchEvent', target.dispatchEvent);
  define('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  define('ProgressEvent', class ProgressEvent extends Event { constructor(t, o = {}) { super(t); this.lengthComputable = !!o.lengthComputable; this.loaded = o.loaded ?? 0; this.total = o.total ?? 0; } });
  define('Image', FakeImage); define('HTMLImageElement', FakeImage); define('HTMLCanvasElement', FakeCanvas); define('ImageData', FakeImageData);
  define('requestAnimationFrame', (f) => page.frames.push(f)); define('cancelAnimationFrame', (i) => { page.frames[i - 1] = null; });
  define('requestIdleCallback', (f) => page.idle.push(f)); define('cancelIdleCallback', (i) => { page.idle[i - 1] = null; });
  define('fetch', async (input) => {
    const url = String(input?.url ?? input);
    page.fetched.push(url);
    for (const [part, answer] of Object.entries(routes)) if (url.includes(part)) return typeof answer === 'function' ? answer(url) : Response.json(answer);
    if (url.split('?')[0].endsWith('/sponsor')) return Response.json(sponsor); // (a race names its venue: /sponsor?venue=…)
    if (noModels && /\.glb(\?|$)/.test(url)) throw new TypeError('fetch failed');
    if (url.startsWith('file:')) {
      const path = fileURLToPath(url.split('?')[0]);
      if (!path.startsWith(fileURLToPath(PUBLIC)) || !existsSync(path)) return new Response('not found', { status: 404 });
      return new Response(readFileSync(path), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  });
  return page;
}

// run what the page asked to do on the next frame / when idle
export function runFrames(t = 16) { const f = page.frames.splice(0); for (const g of f) g?.(t); return f.length; }
export function runIdle() { let n = 0; while (page.idle.length) { const f = page.idle.splice(0); for (const g of f) { g?.({ timeRemaining: () => 50, didTimeout: false }); n++; } } return n; }

// ---------- a renderer that remembers ----------
// log: one entry for every render() ({ target, scene, camera, material, autoClear }); clears: every clear(); targets:
// every setRenderTarget(). pixels(rt, x, y, w, h, buf) fills what readRenderTargetPixels reads back.
export function fakeRenderer({ width = 800, height = 600, ratio = 1, webgl2 = true, floatTargets = true, pixels = null, maxAnisotropy = 16 } = {}) {
  let target = null, alpha = 1, w = width, h = height, pr = ratio;
  const clear = { r: 0.25, g: 0.5, b: 0.75 };
  const r = {
    log: [], clears: [], targets: [], compiled: [], disposed: 0, reads: 0,
    domElement: new FakeCanvas(width, height),
    autoClear: true, autoClearColor: true, autoClearDepth: true, autoClearStencil: true, sortObjects: true, localClippingEnabled: false,
    toneMapping: 0, toneMappingExposure: 1, outputColorSpace: 'srgb', useLegacyLights: false,
    capabilities: { isWebGL2: webgl2, maxAnisotropy, getMaxAnisotropy: () => maxAnisotropy, maxTextureSize: 8192, maxSamples: 4, precision: 'highp', logarithmicDepthBuffer: false },
    extensions: { has: (n) => n !== 'EXT_color_buffer_float' || floatTargets, get: () => ({}) },
    shadowMap: { enabled: false, autoUpdate: true, needsUpdate: false, type: 1 },
    xr: { enabled: true, isPresenting: false },
    info: { autoReset: true, reset() {}, render: { calls: 0, triangles: 0, frame: 0 }, memory: { geometries: 0, textures: 0 }, programs: [] },
    debug: { checkShaderErrors: true, onShaderError: null },
    properties: { get: () => ({}), remove() {} },
    state: { reset() {}, buffers: { depth: { setTest() {}, setMask() {} }, color: { setMask() {} } } },
    getContext: () => ({ getExtension: () => null, getParameter: () => 0, canvas: r.domElement, isContextLost: () => false }),
    getDrawingBufferSize(out) { return out.set(Math.floor(w * pr), Math.floor(h * pr)); },
    getSize(out) { return out.set(w, h); },
    setSize(a, b) { w = a; h = b; },
    setDrawingBufferSize(a, b, p) { w = a; h = b; pr = p; },
    setViewport() {}, setScissor() {}, setScissorTest() {},
    getPixelRatio: () => pr, setPixelRatio(p) { pr = p; },
    getRenderTarget: () => target, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    setRenderTarget(t) { target = t; r.targets.push(t); },
    getClearAlpha: () => alpha, setClearAlpha(a) { alpha = a; },
    getClearColor(out) { out.r = clear.r; out.g = clear.g; out.b = clear.b; return out; },
    setClearColor(c, a = 1) {
      if (typeof c === 'number') { clear.r = ((c >> 16) & 255) / 255; clear.g = ((c >> 8) & 255) / 255; clear.b = (c & 255) / 255; }
      else { clear.r = c.r; clear.g = c.g; clear.b = c.b; }
      alpha = a;
    },
    clear(color = true, depth = true, stencil = true) { r.clears.push({ target, color, depth, stencil, alpha, clearColor: { ...clear } }); },
    clearDepth() {}, clearColor() {},
    render(scene, camera) { r.log.push({ target, scene, camera, material: scene?.children?.[0]?.material, autoClear: r.autoClear, shadowAuto: r.shadowMap.autoUpdate }); },
    compile(scene, camera) { r.compiled.push({ scene, camera }); return new Set(); },
    compileAsync: async (scene, camera) => { r.compiled.push({ scene, camera }); return scene; },
    initTexture() {}, initRenderTarget() {}, copyFramebufferToTexture() {}, copyTextureToTexture() {},
    readRenderTargetPixels(rt, x, y, a, b, buf) { r.reads++; if (pixels) pixels(rt, x, y, a, b, buf); },
    dispose() { r.disposed++; }, forceContextLoss() {},
    setAnimationLoop(f) { r.loop = f; },
  };
  return r;
}

// ---------- what a test wants to know about a picture ----------
// counts a thing's dispose events
export function watchDispose(thing) { const w = { count: 0 }; thing.addEventListener('dispose', () => w.count++); return w; }

// every object under root that passes test (by default every mesh, line and point cloud)
export function under(root, test = (o) => o.isMesh || o.isLine || o.isPoints) { const out = []; root.traverse((o) => { if (test(o)) out.push(o); }); return out; }

// no NaN nor infinity in any attribute of a geometry, an index that stays inside it, and whole triangles (lines: a line's
// points come in any number)
export function assertSoundGeometry(g, name = 'geometry', { lines = false } = {}) {
  const P = g.attributes.position;
  assert.ok(P && P.count > 0, `${name}: has vertices`);
  for (const [k, a] of Object.entries(g.attributes)) {
    const A = a.array ?? a.data?.array;
    for (let i = 0; i < A.length; i++) if (!Number.isFinite(A[i])) assert.fail(`${name}: ${k}[${i}] is ${A[i]}`);
    assert.equal(a.count, P.count, `${name}: ${k} covers every vertex`);
  }
  if (g.index) {
    const I = g.index.array;
    if (!lines) assert.equal(I.length % 3, 0, `${name}: the index makes whole triangles`);
    for (let i = 0; i < I.length; i++) if (I[i] >= P.count) assert.fail(`${name}: index[${i}] = ${I[i]} is past the ${P.count} vertices`);
  } else if (!lines) assert.equal(P.count % 3, 0, `${name}: whole triangles`);
}

// the box round a geometry's positions, as plain numbers
export function boundsOf(g) {
  const P = g.attributes.position, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.count; i++) { const v = [P.getX(i), P.getY(i), P.getZ(i)]; for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); } }
  return { min: { x: lo[0], y: lo[1], z: lo[2] }, max: { x: hi[0], y: hi[1], z: hi[2] }, size: { x: hi[0] - lo[0], y: hi[1] - lo[1], z: hi[2] - lo[2] } };
}

// every vertex's skin: weights that sum to 1 and name bones that exist
export function assertSoundSkin(g, boneCount, name = 'skin') {
  const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  assert.ok(si && sw, `${name}: is skinned`);
  assert.equal(si.count, g.attributes.position.count, `${name}: skinIndex covers every vertex`);
  assert.equal(sw.count, g.attributes.position.count, `${name}: skinWeight covers every vertex`);
  for (let i = 0; i < si.count; i++) {
    let sum = 0;
    for (let k = 0; k < 4; k++) {
      const b = si.getComponent(i, k), w = sw.getComponent(i, k);
      if (!(w >= -1e-6 && w <= 1 + 1e-6)) assert.fail(`${name}: vertex ${i} has weight ${w}`);
      if (w > 0 && !(b >= 0 && b < boneCount)) assert.fail(`${name}: vertex ${i} follows bone ${b} of ${boneCount}`);
      sum += w;
    }
    if (Math.abs(sum - 1) > 1e-4) assert.fail(`${name}: the weights of vertex ${i} sum to ${sum}`);
  }
}

// every position, rotation and scale under root is a finite number
export function assertFiniteTree(root, name = 'tree') {
  root.traverse((o) => {
    for (const v of [o.position.x, o.position.y, o.position.z, o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w, o.scale.x, o.scale.y, o.scale.z]) {
      if (!Number.isFinite(v)) assert.fail(`${name}: ${o.type} "${o.name}" has a transform of ${v}`);
    }
  });
}

// a material's onBeforeCompile run on three's own shader (THREE.ShaderLib.physical, say): it must change the shader, keep
// its braces balanced, and give a value to every uniform it declares. Gives back the patched shader.
export function assertShaderPatch(m, lib, name = 'material') {
  assert.equal(typeof m.onBeforeCompile, 'function', `${name}: has a patch`);
  const sh = { uniforms: {}, defines: {}, vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader };
  m.onBeforeCompile(sh, {});
  assert.ok(sh.vertexShader !== lib.vertexShader || sh.fragmentShader !== lib.fragmentShader, `${name}: the patch changes the shader`);
  for (const [was, now] of [[lib.vertexShader, sh.vertexShader], [lib.fragmentShader, sh.fragmentShader]]) {
    assert.equal(now.split('{').length, now.split('}').length, `${name}: its braces balance`);
    const known = new Set([...was.matchAll(/uniform\s+(?:\w+\s+)?\w+\s+([^;]+);/g)].flatMap((d) => d[1].split(',').map((n) => n.trim().replace(/\[.*$/, ''))));
    for (const d of now.matchAll(/uniform\s+(?:(?:lowp|mediump|highp)\s+)?\w+\s+([^;]+);/g)) for (const n of d[1].split(',').map((x) => x.trim().replace(/\[.*$/, ''))) {
      if (!known.has(n)) assert.ok(n in sh.uniforms, `${name}: the uniform ${n} is declared but given no value`);
    }
  }
  return sh;
}

// ---------- a race to draw ----------
// A real race, sailed headless by the computer boats (sim.js), kept frame by frame: what a boat's view is given to draw.
// frames: { b (a copy of boat `boat` as she was), t }; W: the race's waves. Sails through the start, a beat, a tack, the
// bear-away with her kite up, a gybe and the leeward mark.
export async function recordRace({ preset = 'medium', seed = 11, fleet = 4, frames = 6000, dt = 1 / 15, boat = 1, every = 1, ...o } = {}) {
  const { Race } = await import('../public/game/sim.js');
  const race = new Race({ preset, seed, fleet, start: 1, autoTrim: true, laps: 1, length: 'short', ...o }), out = [];
  for (let i = 0; i < frames; i++) { race.step(dt); if (i % every === 0) out.push({ b: { ...race.boats[boat] }, t: race.t }); }
  return { race, W: race.waves, frames: out, dt: dt * every };
}

// ---------- chance ----------
// Math.random as a fixed sequence (a small generator from a seed); gives back the function that puts the real one back
export function seedRandom(seed = 1) {
  const real = Math.random; let s = seed >>> 0 || 1;
  Math.random = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  return () => { Math.random = real; };
}
// Math.random giving these values first (then repeating the last, or going on from `then`)
export function scriptRandom(values, then) {
  const real = Math.random; let i = 0;
  Math.random = () => (i < values.length ? values[i++] : then ? then() : values[values.length - 1]);
  return () => { Math.random = real; };
}
