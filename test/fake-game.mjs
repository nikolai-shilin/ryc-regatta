// The race's own page (public/play/index.html) for Node, so the game's entry, public/game/main.js, can be loaded and
// played as a browser would: fake-dom.mjs's page, with what it lacks for a page that isn't React's (markup parsed when
// set as innerHTML, cloneNode, before/after, settable hidden and dataset, pointer capture), canvases with fake-page.mjs's
// 2D context, a WebGL renderer that draws nothing, the body of play/index.html without its scripts, the preloader's
// window.rycLoader as a stand-in that hands over at once, and fetch answered from the files in public/.
//
//   import { bootGame } from './fake-game.mjs';
//   const game = await bootGame({ search: '?race=free&debug', lang: 'en' });
//   await game.frames(60);        // a second of frames at 60 Hz
//   game.rg.race                  // window.__rg: the race, the world … (the address has ?debug)
//
// Each test file is a process of its own, and the game a module that runs once: one bootGame() a file.
import { mock, ROOT } from './load.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FakeCanvas, FakeImage, FakeImageData, fakeRenderer, page, seedRandom } from './fake-page.mjs';

// three as it is, but for the one class that needs a GPU
const real = pathToFileURL(join(ROOT, 'public/vendor/three@0.160.0/build/three.module.min.js')).href;
mock('three', `export * from '${real}'; export class WebGLRenderer { constructor(o) { return globalThis.__renderer(o); } }`);

const D = await import('./fake-dom.mjs');
export const { dom, clock, reset, tick, settle } = D;

// ---------- what fake-dom's elements lack for a page of its own ----------
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', times: '×', deg: '°' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, k) => (k[0] === '#' ? String.fromCodePoint(k[1] === 'x' || k[1] === 'X' ? parseInt(k.slice(2), 16) : +k.slice(1)) : ENT[k] ?? m));
const SVG = 'http://www.w3.org/2000/svg';
// markup into nodes under `into`: tags, attributes (quoted or not, or bare), text, comments; <script> and <style> kept whole
export function parseInto(into, html) {
  const doc = into.ownerDocument || document;
  let at = into;
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+|<)/g;
  for (let m; (m = re.exec(html));) {
    const [all, close, tag, attrs, self, text] = m;
    if (all.startsWith('<!--')) continue;
    if (text !== undefined) { at.appendChild(doc.createTextNode(decode(text))); continue; }
    const name = tag.toLowerCase();
    if (close) { for (let n = at; n && n !== into.parentNode; n = n.parentNode) if (n.localName === name || n.localName === tag) { at = n.parentNode; break; } continue; }
    const svg = name === 'svg' || at.namespaceURI === SVG;
    const el = svg ? doc.createElementNS(SVG, tag) : doc.createElement(name);
    for (const [, k, v1, v2, v3] of attrs.matchAll(/([^\s=>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) el.setAttribute(k, decode(v1 ?? v2 ?? v3 ?? ''));
    if (name === 'canvas') { if (el.hasAttribute('width')) el.width = +el.getAttribute('width'); if (el.hasAttribute('height')) el.height = +el.getAttribute('height'); }
    at.appendChild(el);
    if (name === 'script' || name === 'style' || name === 'textarea') { // raw text up to its end tag
      const end = html.indexOf(`</${name}`, re.lastIndex), body = html.slice(re.lastIndex, end < 0 ? html.length : end);
      if (body) el.appendChild(doc.createTextNode(body));
      re.lastIndex = end < 0 ? html.length : html.indexOf('>', end) + 1;
      continue;
    }
    if (!self && !VOID.has(name)) at = el;
  }
}
const E = Object.getPrototypeOf(HTMLElement.prototype); // fake-dom's Element
const desc = (o, k) => Object.getOwnPropertyDescriptor(o, k);
const html0 = desc(E, 'innerHTML');
Object.defineProperties(E, {
  innerHTML: { get: html0.get, set(v) { for (const c of [...this.childNodes]) this.removeChild(c); this.raw = null; parseInto(this, String(v ?? '')); }, configurable: true },
  hidden: { get() { return this.hasAttribute('hidden'); }, set(v) { if (v) this.setAttribute('hidden', ''); else this.removeAttribute('hidden'); }, configurable: true },
  classList: { configurable: true, get() {
    const el = this, all = () => el.className.split(/\s+/).filter(Boolean), put = (l) => { el.className = l.join(' '); };
    return {
      contains: (c) => all().includes(c),
      add: (...cs) => put([...new Set([...all(), ...cs])]),
      remove: (...cs) => put(all().filter((c) => !cs.includes(c))),
      toggle: (c, force) => { const on = force ?? !all().includes(c); if (on) put([...new Set([...all(), c])]); else put(all().filter((x) => x !== c)); return on; },
      replace: (a, b) => { const l = all(); if (!l.includes(a)) return false; put(l.map((x) => (x === a ? b : x))); return true; },
      get length() { return all().length; }, item: (i) => all()[i] ?? null, [Symbol.iterator]: () => all()[Symbol.iterator](),
    };
  } },
  title: { get() { return this.getAttribute('title') ?? ''; }, set(v) { this.setAttribute('title', v); }, configurable: true },
  dataset: { configurable: true, get() {
    const el = this, attr = (k) => `data-${String(k).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
    return new Proxy({}, {
      get: (_, k) => (typeof k === 'string' ? el.getAttribute(attr(k)) ?? undefined : undefined),
      set: (_, k, v) => { el.setAttribute(attr(k), v); return true; },
      has: (_, k) => el.hasAttribute(attr(k)),
      deleteProperty: (_, k) => { el.removeAttribute(attr(k)); return true; },
    });
  } },
});
const N = Object.getPrototypeOf(E); // fake-dom's Node
Object.assign(N, {
  cloneNode(deep = false) {
    const doc = this.ownerDocument;
    if (this.nodeType === 3) return doc.createTextNode(this.data);
    if (this.nodeType === 8) return doc.createComment(this.data);
    const c = this.namespaceURI === SVG ? doc.createElementNS(SVG, this.localName) : doc.createElement(this.localName);
    for (const [k, v] of this.attrs) c.setAttribute(k, v);
    if (deep) for (const k of this.childNodes) c.appendChild(k.cloneNode(true));
    return c;
  },
});
const nodes = (el, xs) => xs.map((x) => (typeof x === 'string' ? el.ownerDocument.createTextNode(x) : x));
Object.defineProperties(E, Object.getOwnPropertyDescriptors({
  before(...xs) { for (const x of nodes(this, xs)) this.parentNode.insertBefore(x, this); },
  after(...xs) { const p = this.parentNode, next = this.nextSibling; for (const x of nodes(this, xs)) p.insertBefore(x, next); },
  prepend(...xs) { const first = this.firstChild; for (const x of nodes(this, xs)) this.insertBefore(x, first); },
  replaceWith(...xs) { this.before(...xs); this.remove(); },
  replaceChildren(...xs) { for (const c of [...this.childNodes]) this.removeChild(c); this.append(...xs); },
  insertAdjacentHTML(where, html) {
    const box = this.ownerDocument.createElement('div'); parseInto(box, html);
    const kids = [...box.childNodes];
    if (where === 'beforeend') this.append(...kids); else if (where === 'afterbegin') this.prepend(...kids);
    else if (where === 'beforebegin') this.before(...kids); else this.after(...kids);
  },
  toggleAttribute(k, force) { const on = force ?? !this.hasAttribute(k); if (on) this.setAttribute(k, ''); else this.removeAttribute(k); return on; },
  // laid out unless it, or a box it is in, is hidden
  getClientRects() { for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (n.hidden || n.style?.display === 'none') return []; return [this.getBoundingClientRect()]; },
  setPointerCapture(id) { (this.captured ||= new Set()).add(id); },
  releasePointerCapture(id) { this.captured?.delete(id); },
  hasPointerCapture(id) { return !!this.captured?.has(id); },
  get firstElementChild() { return this.children[0] ?? null; },
  get lastElementChild() { return this.children.at(-1) ?? null; },
  get offsetWidth() { return this.rect?.width ?? 0; },
  get offsetHeight() { return this.rect?.height ?? 0; },
  get clientWidth() { return this.rect?.width ?? 0; },
  get clientHeight() { return this.rect?.height ?? 0; },
}));
// a <canvas>: an element of the page, with a fake-page canvas inside (its size, its 2D context)
const make = document.createElement.bind(document);
document.createElement = (tag) => {
  const el = make(tag);
  if (String(tag).toLowerCase() !== 'canvas') return el;
  const fc = new FakeCanvas(300, 150);
  el.fake = fc; fc.el = el;
  Object.defineProperties(el, {
    width: { get: () => fc.width, set: (v) => { fc.width = v; } }, height: { get: () => fc.height, set: (v) => { fc.height = v; } },
    clientWidth: { get: () => fc.width }, clientHeight: { get: () => fc.height },
  });
  el.getContext = (k) => fc.getContext(k);
  el.toDataURL = () => fc.toDataURL(); el.toBlob = (cb) => fc.toBlob(cb);
  el.getBoundingClientRect = () => el.rect ?? fc.getBoundingClientRect();
  return el;
};

// ---------- sound: an AudioContext that builds every node and plays nothing, its clock the page's ----------
class Param {
  constructor(value = 0) { this.value = value; this.events = []; }
  setValueAtTime(v, t) { this.value = v; this.events.push(['set', v, t]); return this; }
  linearRampToValueAtTime(v, t) { this.value = v; this.events.push(['ramp', v, t]); return this; }
  exponentialRampToValueAtTime(v, t) { this.value = v; this.events.push(['exp', v, t]); return this; }
  setTargetAtTime(v, t, tc) { this.value = v; this.events.push(['target', v, t, tc]); return this; }
  setValueCurveAtTime(c, t, d) { this.events.push(['curve', c, t, d]); return this; }
  cancelScheduledValues() { return this; } cancelAndHoldAtTime() { return this; }
}
class AudioNodeFake {
  constructor(ctx, kind) { this.context = ctx; this.kind = kind; this.out = []; ctx.nodes.push(this); for (const k of ['gain', 'frequency', 'Q', 'detune', 'pan', 'delayTime', 'playbackRate', 'threshold', 'ratio', 'knee', 'attack', 'release', 'offset']) this[k] = new Param(k === 'gain' || k === 'playbackRate' ? 1 : 0); }
  connect(to) { this.out.push(to); return to; }
  disconnect() { this.out = []; }
  start(...a) { this.started = a; } stop(t) { this.stopped = t; queueMicrotask(() => this.onended?.()); }
  setPeriodicWave(w) { this.wave = w; }
  addEventListener(t, f) { if (t === 'ended') this.onended = f; } removeEventListener() {}
  getFloatTimeDomainData(a) { a.fill(sound.level); } getByteFrequencyData(a) { a.fill(0); } getFloatFrequencyData(a) { a.fill(-100); }
}
export const sound = { contexts: [], audios: [], level: 0, decoded: 0, failDecode: false, refuse: false };
export class AudioContextFake {
  constructor(o = {}) { this.sampleRate = o.sampleRate ?? 48000; this.nodes = []; this.state = 'suspended'; this.destination = new AudioNodeFake(this, 'destination'); this.listener = {}; sound.contexts.push(this); }
  get currentTime() { return (clock.now - Date.parse('2026-11-18T12:00:00Z')) / 1000; }
  createBuffer(ch, length, sampleRate) { const data = Array.from({ length: ch }, () => new Float32Array(length)); return { numberOfChannels: ch, length, sampleRate, duration: length / sampleRate, getChannelData: (c) => data[c], copyToChannel() {} }; }
  createPeriodicWave(re, im) { return { re, im }; }
  decodeAudioData(b, ok, bad) {
    if (sound.failDecode) { const e = new Error('decode'); bad?.(e); return Promise.reject(e); }
    sound.decoded++; const buf = this.createBuffer(2, 4800, 48000); Object.defineProperty(buf, 'duration', { value: 2.5 }); ok?.(buf); return Promise.resolve(buf);
  }
  resume() { if (!sound.refuse) this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
  addEventListener() {} removeEventListener() {}
}
for (const k of ['Gain', 'BufferSource', 'BiquadFilter', 'StereoPanner', 'Convolver', 'Oscillator', 'WaveShaper', 'DynamicsCompressor', 'Analyser', 'Delay', 'MediaElementSource', 'Panner', 'ChannelMerger', 'ChannelSplitter', 'ConstantSource'])
  AudioContextFake.prototype[`create${k}`] = function () { const n = new AudioNodeFake(this, k); if (k === 'Analyser') n.fftSize = 2048; return n; };
export class AudioFake {
  constructor(src) { this.paused = true; this.attrs = {}; this.listeners = {}; this.currentTime = 0; this.duration = 180; this.volume = 1; if (src) this.src = src; sound.audios.push(this); }
  get src() { return this.attrs.src ?? ''; } set src(v) { this.attrs.src = String(v); }
  setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return this.attrs[k] ?? null; } removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); } removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] || []).filter((g) => g !== f); }
  play() { if (sound.refuse) return Promise.reject(new Error('NotAllowedError')); this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; } load() {}
}

// ---------- the page ----------
const PLAY = readFileSync(join(ROOT, 'public/play/index.html'), 'utf8');
const BODY = PLAY.slice(PLAY.indexOf('<body>') + 6, PLAY.indexOf('</body>')).replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
const PUBLIC = join(ROOT, 'public');
// what the game fetches: its own files from the disk (an address of the site, or the file: one import.meta.url makes),
// and anything a test answers in `routes` ({ part of the url: json or (url, init) => Response }); the rest, 404
export const fetched = [];
function serveFiles(routes) {
  return async (input, init) => {
    const url = String(input?.url ?? input);
    fetched.push({ url, init });
    for (const [part, answer] of Object.entries(routes)) if (url.includes(part)) return typeof answer === 'function' ? answer(url, init) : Response.json(answer);
    let path = null;
    if (url.startsWith('file:')) path = fileURLToPath(url.split('?')[0]);
    else if (url.startsWith('/')) path = join(PUBLIC, decodeURIComponent(url.split('?')[0]));
    else { const u = new URL(url); if (u.host === location.host) path = join(PUBLIC, decodeURIComponent(u.pathname)); }
    if (path && path.startsWith(PUBLIC) && existsSync(path) && !path.endsWith('/')) return new Response(readFileSync(path), { status: 200 });
    return new Response('not found', { status: 404 });
  };
}

// The game, loaded: search (the address's ?…), cookies, storage ({ key: value } in localStorage), routes (fetch's
// answers), renderer (fakeRenderer's options), media (matchMedia's answers), audio (an AudioContext to be had),
// loader (false: no preloader on the page), noGl (how many times WebGL can't be had), telegram (window.Telegram.WebApp,
// made by telegramApp), seed (Math.random's), before (run on the page just before main.js loads). main.js throwing as it loads is game.error.
export async function bootGame({ search = '?debug', path = '/play/', cookies = {}, storage = {}, routes = {}, renderer = {}, media = {}, audio = true, loader: withLoader = true, noGl = 0, telegram = null, seed = 7, before } = {}) {
  seedRandom(seed); // the same race, tips and voices every run
  reset({ url: `https://updown.test${path}${search}` });
  Object.assign(dom.media, media);
  for (const [k, v] of Object.entries(cookies)) document.cookie = `${k}=${v}`;
  for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  globalThis.fetch = serveFiles(routes);
  globalThis.ProgressEvent ||= class ProgressEvent extends Event { constructor(t, o = {}) { super(t); this.lengthComputable = !!o.lengthComputable; this.loaded = o.loaded ?? 0; this.total = o.total ?? 0; } };
  globalThis.MutationObserver ||= class MutationObserver { constructor(cb) { this.cb = cb; } observe() {} disconnect() {} takeRecords() { return []; } };
  if (audio) { globalThis.AudioContext = AudioContextFake; globalThis.Audio = AudioFake; }
  globalThis.ImageData = FakeImageData;
  globalThis.Image = FakeImage; globalThis.HTMLCanvasElement = HTMLElement;
  globalThis.screen = { width: 1280, height: 800 };
  globalThis.navigator.sendBeacon = (url, body) => { fetched.push({ url, init: { method: 'POST', body, beacon: true } }); return true; };
  globalThis.navigator.vibrate = () => true;
  globalThis.getComputedStyle = (el) => el.style;
  document.fonts = { ready: Promise.resolve(), load: () => Promise.resolve([]), check: () => true, add() {} };
  page.badImage = () => false;
  const r = fakeRenderer({ width: 1280, height: 800, ...renderer });
  let fails = noGl;
  globalThis.__renderer = (o) => { if (fails-- > 0) throw new Error('Error creating WebGL context.'); if (o?.canvas) r.domElement = o.canvas; return r; };
  if (telegram) window.Telegram = { WebApp: telegram }; else delete window.Telegram;
  parseInto(document.body, BODY);
  const loader = { races: [], failed: [], handed: 0 };
  window.rycVisit = { id: '00000000-0000-4000-8000-000000000001' };
  if (withLoader) window.rycLoader = {
    race: (venue, cells, next) => loader.races.push({ venue, cells, next }),
    done: (start) => { loader.handed++; start(); },
    fail: (why, say) => loader.failed.push({ why, say }),
  };
  else delete window.rycLoader;
  await before?.();
  let error = null;
  try { await import('../public/game/main.js'); } catch (e) { error = e; }
  await settle();
  const game = {
    loader, renderer: r, dom, error, get rg() { return window.__rg; },
    $: (s) => document.querySelector(s), $$: (s) => document.querySelectorAll(s),
    // n frames, each `ms` long, as the page's clock gives them
    async frames(n = 1, ms = 1000 / 60) { for (let i = 0; i < n; i++) await tick(ms); },
    // until check() is true, a frame at a time (up to `max` of them)
    async until(check, what = 'the game to get there', max = 6000, ms = 1000 / 60) {
      for (let i = 0; i < max; i++) { if (check()) return i; await tick(ms); }
      throw new Error(`gave up waiting for ${what}`);
    },
    key(code, init = {}) { window.dispatchEvent(new KeyboardEvent('keydown', { code, key: init.key ?? code, bubbles: true, ...init })); },
    keyUp(code) { window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true })); },
    pointer(el, type, init = {}) { const e = new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: 0, clientY: 0, ...init }); el.dispatchEvent(e); return e; },
    click(el) { el.click(); },
  };
  return game;
}

// Telegram's Mini App object as the game uses it, keeping what was asked of it (calls) and the back button's handler
export function telegramApp({ lang = 'ru', dark = true, version = '8.0' } = {}) {
  const calls = [], tg = {
    calls, initData: 'query_id=1&user=%7B%7D', initDataUnsafe: { user: { id: 1, language_code: lang } }, colorScheme: dark ? 'dark' : 'light', platform: 'ios',
    ready: () => calls.push('ready'), expand: () => calls.push('expand'), disableVerticalSwipes: () => calls.push('noSwipes'),
    isVersionAtLeast: (v) => parseFloat(version) >= parseFloat(v), requestFullscreen: () => calls.push('fullscreen'), setHeaderColor: (c) => calls.push(['header', c]),
    onEvent: (k, f) => { (tg.handlers ||= {})[k] = f; },
    BackButton: { show: () => calls.push('back:show'), hide: () => calls.push('back:hide'), onClick: (f) => { tg.back = f; } },
    HapticFeedback: { impactOccurred: (k) => calls.push(['haptic', k]), notificationOccurred: (k) => calls.push(['notify', k]) },
  };
  return tg;
}

// the page's body as play/index.html has it, put back (for main.js loaded again, as a module of another address)
export function freshPage(url) {
  for (const c of [...document.body.childNodes]) document.body.removeChild(c);
  parseInto(document.body, BODY);
  if (url) location.url = new URL(url, location.url);
}
