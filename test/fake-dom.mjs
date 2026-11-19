// A small browser for the component tests, so React's effects, clicks, typing and timers really run with no DOM library
// installed. It has what the site's components and react-dom/client ask of a page: elements, events that capture and
// bubble, CSS selectors, forms, focus, storage, cookies, the address, a clock that only moves when a test moves it, and
// no network. Import it after load.mjs:
//
//   import { mock } from './load.mjs';
//   import { mount, click, done, reset } from './fake-dom.mjs';
//   const { DoneButton } = await import('../components/done-button.tsx');
//   beforeEach(reset); afterEach(done);
//
// done() unmounts everything and fails the test if a component left a listener, an observer or a timer behind, or if
// React complained (a duplicate key, a <div> inside a <p>): a page would carry those too.
import { mock } from './load.mjs';
import assert from 'node:assert/strict';

process.env.TZ = 'UTC';

// What every page pulls in and no test should reach: the analytics (kept in dom.tracked), the Supabase client (the test's
// own, globalThis.__supabase) and the race's Audio & graphics menu (fetched only when opened; test/av-menu.test.mjs has
// the real one).
mock('lib/track.ts', 'export const track = (name, data) => { globalThis.__tracked?.push([name, data]); };');
mock('lib/supabase/client.ts', 'export const supabaseBrowser = () => globalThis.__supabase;');
mock('public/game/av-menu.js', `export const openAvMenu = (o) => { globalThis.__avOpened?.push(o); };
export const avSummary = (o, lang) => (lang === 'ru' ? 'Авто · звук вкл' : 'Auto · sound on');
export const avGfx = (o, lang) => (lang === 'ru' ? 'Авто' : 'Auto');`);

const HTML = 'http://www.w3.org/1999/xhtml';
const RealDate = Date;
const START = RealDate.parse('2026-11-18T12:00:00Z');

// ---------- the clock ----------
export const clock = { now: START, set(iso) { this.now = typeof iso === 'number' ? iso : RealDate.parse(iso); } };
const timers = new Map();
let timerId = 0;
const addTimer = (fn, ms, every, args = []) => { const id = ++timerId; timers.set(id, { id, fn, args, at: clock.now + Math.max(0, +ms || 0), every: every ? Math.max(1, +ms || 1) : 0 }); return id; };
const nextTimer = () => [...timers.values()].sort((a, b) => a.at - b.at || a.id - b.id)[0];
const runTimer = (x) => { if (x.every) x.at += x.every; else timers.delete(x.id); x.fn(...x.args); };

class FakeDate extends RealDate {
  constructor(...a) { if (a.length) super(...a); else super(clock.now); }
  static now() { return clock.now; }
}

// ---------- events ----------
class Evt {
  constructor(type, init = {}) {
    Object.assign(this, { bubbles: false, cancelable: false, composed: false }, init);
    this.type = type; this.defaultPrevented = false; this.target = null; this.currentTarget = null; this.eventPhase = 0;
    this.timeStamp = clock.now - START; this.isTrusted = true; this.stopped = false; this.stoppedNow = false; this.path = [];
  }
  preventDefault() { if (this.cancelable) this.defaultPrevented = true; }
  stopPropagation() { this.stopped = true; }
  stopImmediatePropagation() { this.stopped = true; this.stoppedNow = true; }
  composedPath() { return this.path; }
}
class MouseEvt extends Evt { constructor(t, i = {}) { super(t, { button: 0, buttons: 0, clientX: 0, clientY: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, relatedTarget: null, ...i }); } }
class PointerEvt extends MouseEvt {}
class KeyEvt extends Evt { constructor(t, i = {}) { super(t, { key: '', code: '', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...i }); } }
class FocusEvt extends Evt { constructor(t, i = {}) { super(t, { relatedTarget: null, ...i }); } }
class CustomEvt extends Evt { constructor(t, i = {}) { super(t, { detail: null, ...i }); } }
class MessageEvt extends Evt { constructor(t, i = {}) { super(t, { data: null, origin: '', source: null, ...i }); } }
class PageEvt extends Evt { constructor(t, i = {}) { super(t, { persisted: false, ...i }); } }

class Target {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, fn, opt) {
    if (!fn) return;
    const capture = typeof opt === 'boolean' ? opt : !!opt?.capture, list = this.listeners.get(type) || [];
    if (!list.some((l) => l.fn === fn && l.capture === capture)) list.push({ fn, capture, once: !!opt?.once });
    this.listeners.set(type, list);
  }
  removeEventListener(type, fn, opt) {
    const capture = typeof opt === 'boolean' ? opt : !!opt?.capture, list = this.listeners.get(type) || [];
    const left = list.filter((l) => !(l.fn === fn && l.capture === capture));
    if (left.length) this.listeners.set(type, left); else this.listeners.delete(type);
  }
  dispatchEvent(e) {
    e.target = this;
    const path = [];
    for (let n = this; n; n = n === document ? win : n.parentNode) path.push(n);
    e.path = path;
    const run = (at, capture) => {
      e.currentTarget = at;
      for (const l of [...(at.listeners.get(e.type) || [])]) {
        if (l.capture !== capture) continue;
        if (l.once) at.removeEventListener(e.type, l.fn, l.capture);
        l.fn.call(at, e);
        if (e.stoppedNow) return;
      }
    };
    const before = globalThis.event;
    globalThis.event = e;
    try {
      for (let i = path.length - 1; i > 0 && !e.stopped; i--) run(path[i], true);
      if (!e.stopped) run(this, true);
      if (!e.stoppedNow) run(this, false);
      if (e.bubbles) for (let i = 1; i < path.length && !e.stopped; i++) run(path[i], false);
    } finally { globalThis.event = before; e.currentTarget = null; }
    return !e.defaultPrevented;
  }
}
const win = new Target();

// ---------- CSS selectors: tags, #ids, .classes, [attributes], :not(), descendants and children ----------
const PART = /^(?:(\*|[a-zA-Z][\w-]*)|#([\w-]+)|\.([\w-]+)|\[([\w:-]+)(?:([~^$*|]?=)(?:"([^"]*)"|'([^']*)'|([^\]]+)))?\]|:not\(([^)]*)\))/;
function parseCompound(s) {
  const tests = [];
  while (s) {
    const m = PART.exec(s);
    if (!m) throw new Error(`fake-dom: selector not understood: ${s}`);
    s = s.slice(m[0].length);
    if (m[1]) { const tag = m[1].toLowerCase(); if (tag !== '*') tests.push((e) => e.localName.toLowerCase() === tag); }
    else if (m[2]) tests.push((e) => e.getAttribute('id') === m[2]);
    else if (m[3]) tests.push((e) => e.classList.contains(m[3]));
    else if (m[4]) {
      const name = m[4], op = m[5], val = m[6] ?? m[7] ?? m[8];
      tests.push((e) => {
        const v = e.getAttribute(name);
        if (v == null) return false;
        return !op ? true : op === '=' ? v === val : op === '^=' ? v.startsWith(val) : op === '$=' ? v.endsWith(val) : op === '*=' ? v.includes(val)
          : op === '~=' ? v.split(/\s+/).includes(val) : v === val || v.startsWith(`${val}-`);
      });
    } else if (m[9] != null) { const inner = parseList(m[9]); tests.push((e) => !inner.some((c) => matchComplex(e, c))); }
  }
  return (e) => tests.every((t) => t(e));
}
function parseComplex(s) {
  const steps = [];
  for (const piece of s.trim().replace(/\s*>\s*/g, ' > ').match(/(?:\[[^\]]*\]|:not\([^)]*\)|\S)+/g)) { // (a space in [a="b c"] doesn't divide)
    if (piece === '>') steps[steps.length - 1].child = true;
    else steps.push({ test: parseCompound(piece), child: false });
  }
  return steps;
}
const parseList = (s) => s.split(/,(?![^[(]*[\])])/).map(parseComplex);
function matchComplex(e, steps, i = steps.length - 1) {
  if (!steps[i].test(e)) return false;
  if (i === 0) return true;
  for (let p = e.parentNode; p && p.nodeType === 1; p = p.parentNode) {
    if (matchComplex(p, steps, i - 1)) return true;
    if (steps[i - 1].child) return false;
  }
  return false;
}
function* walk(n) { for (const c of n.childNodes) if (c.nodeType === 1) { yield c; yield* walk(c); } }

// ---------- nodes ----------
class Node extends Target {
  static ELEMENT_NODE = 1; static TEXT_NODE = 3; static COMMENT_NODE = 8; static DOCUMENT_NODE = 9;
  constructor(doc, type, name) { super(); this.ownerDocument = doc; this.nodeType = type; this.nodeName = name; this.parentNode = null; this.childNodes = []; }
  // a failed assertion prints a node as a tag: as an object it holds the whole page and React's insides, minutes to print
  [Symbol.for('nodejs.util.inspect.custom')]() { return `<${String(this.nodeName).toLowerCase()}${this.attrs?.size ? ` ${[...this.attrs].map(([k, v]) => `${k}="${v}"`).join(' ')}` : ''}>`; }
  get firstChild() { return this.childNodes[0] ?? null; }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] ?? null; }
  get parentElement() { return this.parentNode?.nodeType === 1 ? this.parentNode : null; }
  get nextSibling() { const s = this.parentNode?.childNodes; return s ? s[s.indexOf(this) + 1] ?? null : null; }
  get previousSibling() { const s = this.parentNode?.childNodes; return s ? s[s.indexOf(this) - 1] ?? null : null; }
  get isConnected() { return this.getRootNode() === document; }
  getRootNode() { let n = this; while (n.parentNode) n = n.parentNode; return n; }
  contains(o) { for (let n = o; n; n = n.parentNode) if (n === this) return true; return false; }
  appendChild(c) { return this.insertBefore(c, null); }
  insertBefore(c, ref) {
    c.parentNode?.removeChild(c);
    const i = ref ? this.childNodes.indexOf(ref) : this.childNodes.length;
    this.childNodes.splice(i < 0 ? this.childNodes.length : i, 0, c);
    c.parentNode = this;
    return c;
  }
  removeChild(c) {
    const i = this.childNodes.indexOf(c);
    if (i < 0) throw new Error('fake-dom: not a child of this node');
    const doc = this.ownerDocument || this;
    if (doc.activeElement && c.contains(doc.activeElement)) doc.activeElement = doc.body;
    this.childNodes.splice(i, 1);
    c.parentNode = null;
    return c;
  }
  replaceChild(c, old) { this.insertBefore(c, old); return this.removeChild(old); }
  append(...cs) { for (const c of cs) this.appendChild(typeof c === 'string' ? this.ownerDocument.createTextNode(c) : c); }
  remove() { this.parentNode?.removeChild(this); }
  get textContent() { return this.childNodes.filter((c) => c.nodeType !== 8).map((c) => c.textContent).join(''); }
  set textContent(v) { for (const c of [...this.childNodes]) this.removeChild(c); if (v != null && v !== '') this.appendChild(this.ownerDocument.createTextNode(String(v))); }
  get nodeValue() { return null; }
  set nodeValue(_) {}
}
class CharData extends Node {
  constructor(doc, type, name, data) { super(doc, type, name); this.data = String(data); }
  get nodeValue() { return this.data; }
  set nodeValue(v) { this.data = String(v); }
  get textContent() { return this.data; }
  set textContent(v) { this.data = String(v); }
}
class Style {
  constructor() { Object.defineProperty(this, 'custom', { value: new Map() }); }
  setProperty(k, v) { this.custom.set(k, String(v)); }
  getPropertyValue(k) { return this.custom.get(k) ?? ''; }
  removeProperty(k) { this.custom.delete(k); }
}
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
class Element extends Node {
  constructor(doc, tag, ns = HTML) {
    super(doc, 1, ns === HTML ? tag.toUpperCase() : tag);
    this.tagName = this.nodeName; this.localName = tag; this.namespaceURI = ns; this.attrs = new Map(); this.style = new Style(); this.raw = null;
    this.scrolled = [];
  }
  key(k) { return this.namespaceURI === HTML ? k.toLowerCase() : k; }
  setAttribute(k, v) { this.attrs.set(this.key(k), String(v)); }
  setAttributeNS(_, k, v) { this.setAttribute(k, v); }
  getAttribute(k) { return this.attrs.get(this.key(k)) ?? null; }
  hasAttribute(k) { return this.attrs.has(this.key(k)); }
  removeAttribute(k) { this.attrs.delete(this.key(k)); }
  removeAttributeNS(_, k) { this.removeAttribute(k); }
  getAttributeNames() { return [...this.attrs.keys()]; }
  get attributes() { return [...this.attrs].map(([name, value]) => ({ name, value })); }
  get id() { return this.getAttribute('id') ?? ''; }
  set id(v) { this.setAttribute('id', v); }
  get className() { return this.getAttribute('class') ?? ''; }
  set className(v) { this.setAttribute('class', v); }
  get title() { return this.getAttribute('title') ?? ''; }
  get hidden() { return this.hasAttribute('hidden'); }
  get dataset() { const el = this; return new Proxy({}, { get: (_, k) => el.getAttribute(`data-${String(k).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`) ?? undefined }); }
  get classList() {
    const el = this, all = () => el.className.split(/\s+/).filter(Boolean);
    return {
      contains: (c) => all().includes(c),
      add: (...cs) => { el.className = [...new Set([...all(), ...cs])].join(' '); },
      remove: (...cs) => { el.className = all().filter((c) => !cs.includes(c)).join(' '); },
    };
  }
  get children() { return this.childNodes.filter((c) => c.nodeType === 1); }
  get textContent() { return this.raw ?? super.textContent; }
  set textContent(v) { this.raw = null; super.textContent = v; }
  // react-dom makes a <script> this way, so that it doesn't run; anything else is kept as it was written
  get innerHTML() { return this.raw ?? this.childNodes.map(serialize).join(''); }
  set innerHTML(v) {
    for (const c of [...this.childNodes]) this.removeChild(c);
    if (/^<script><\/script>$/.test(v)) { this.raw = null; this.appendChild(this.ownerDocument.createElement('script')); } else this.raw = String(v);
  }
  get outerHTML() { return serialize(this); }
  matches(sel) { return parseList(sel).some((c) => matchComplex(this, c)); }
  closest(sel) { const l = parseList(sel); for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (l.some((c) => matchComplex(n, c))) return n; return null; }
  querySelectorAll(sel) { const l = parseList(sel); return [...walk(this)].filter((e) => l.some((c) => matchComplex(e, c))); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
  getElementsByTagName(t) { return this.querySelectorAll(t); }
  getBoundingClientRect() { return this.rect ?? { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 }; }
  scrollTo(o) { this.scrolled.push(o); }
  scrollIntoView(o) { this.scrolled.push(o ?? true); }
  checkVisibility() { return this.visible ?? false; }
  focus() {
    const doc = this.ownerDocument;
    if (this.disabled || !this.isConnected || doc.activeElement === this) return;
    const was = doc.activeElement;
    if (was && was !== doc.body) { doc.activeElement = doc.body; was.dispatchEvent(new FocusEvt('blur', { relatedTarget: this })); was.dispatchEvent(new FocusEvt('focusout', { bubbles: true, relatedTarget: this })); }
    doc.activeElement = this;
    this.dispatchEvent(new FocusEvt('focus', { relatedTarget: was })); this.dispatchEvent(new FocusEvt('focusin', { bubbles: true, relatedTarget: was }));
  }
  blur() {
    const doc = this.ownerDocument;
    if (doc.activeElement !== this) return;
    doc.activeElement = doc.body;
    this.dispatchEvent(new FocusEvt('blur')); this.dispatchEvent(new FocusEvt('focusout', { bubbles: true }));
  }
  click(init) {
    if (this.disabled) return;
    const e = new MouseEvt('click', { bubbles: true, cancelable: true, detail: 1, ...init });
    this.dispatchEvent(e);
    if (e.defaultPrevented) return;
    const a = this.closest('a[href]'), sub = this.closest('button');
    if (a) dom.followed.push(a.getAttribute('href'));
    else if (sub && sub.type === 'submit') sub.form?.requestSubmit();
    else { const s = this.closest('summary'), d = s?.parentNode; if (d?.localName === 'details') d.open = !d.open; }
  }
}
const serialize = (n) => {
  if (n.nodeType === 3) return n.data.replace(/[&<>]/g, (c) => ESC[c]);
  if (n.nodeType !== 1) return '';
  const a = [...n.attrs].map(([k, v]) => ` ${k}="${v.replace(/[&<>"]/g, (c) => ESC[c])}"`).join('');
  return `<${n.localName}${a}>${n.innerHTML}</${n.localName}>`;
};
class HTMLElement extends Element {}
class SVGElement extends Element {}
class HTMLIFrameElement extends HTMLElement {
  frame = { sent: [], postMessage(msg, origin) { this.sent.push(msg); this.origin = origin; } };
  get contentWindow() { return this.frame; }
  get contentDocument() { return null; }
}
class HTMLButtonElement extends HTMLElement {
  get disabled() { return this.hasAttribute('disabled'); }
  get type() { return this.getAttribute('type') ?? 'submit'; }
  get form() { return this.closest('form'); }
}
class HTMLInputElement extends HTMLElement {
  dirty = null; on = false; files = null; selectionStart = 0; selectionEnd = 0;
  get value() { return this.dirty ?? this.getAttribute('value') ?? ''; }
  set value(v) { this.dirty = v == null ? '' : String(v); }
  get defaultValue() { return this.getAttribute('value') ?? ''; }
  set defaultValue(v) { this.setAttribute('value', v); }
  get checked() { return this.on; }
  set checked(v) { this.on = !!v; }
  get defaultChecked() { return this.hasAttribute('checked'); }
  set defaultChecked(v) { if (v) this.setAttribute('checked', ''); else this.removeAttribute('checked'); }
  get type() { return this.getAttribute('type') ?? 'text'; }
  set type(v) { this.setAttribute('type', v); }
  get name() { return this.getAttribute('name') ?? ''; }
  set name(v) { this.setAttribute('name', v); }
  get disabled() { return this.hasAttribute('disabled'); }
  get form() { return this.closest('form'); }
  select() {}
}
// a drop-down: its options (React marks the chosen one), and its value the chosen option's, or one set by a test
class HTMLSelectElement extends HTMLElement {
  dirty = null;
  get options() { return this.querySelectorAll('option'); }
  get value() { return this.dirty ?? (this.options.find((o) => o.selected) ?? this.options[0])?.value ?? ''; }
  set value(v) { this.dirty = v == null ? '' : String(v); }
  get type() { return this.hasAttribute('multiple') ? 'select-multiple' : 'select-one'; }
  get disabled() { return this.hasAttribute('disabled'); }
  get form() { return this.closest('form'); }
}
class HTMLOptionElement extends HTMLElement {
  selected = false;
  get value() { return this.getAttribute('value') ?? this.textContent; }
  set value(v) { this.setAttribute('value', v); }
  get defaultSelected() { return this.hasAttribute('selected'); }
  set defaultSelected(v) { if (v) this.setAttribute('selected', ''); else this.removeAttribute('selected'); }
}
class HTMLTextAreaElement extends HTMLElement {
  dirty = null; selectionStart = 0; selectionEnd = 0; dflt = '';
  get value() { return this.dirty ?? this.dflt; }
  set value(v) { this.dirty = v == null ? '' : String(v); }
  get defaultValue() { return this.dflt; }
  set defaultValue(v) { this.dflt = String(v); }
  get type() { return 'textarea'; }
  get disabled() { return this.hasAttribute('disabled'); }
  get form() { return this.closest('form'); }
  select() {}
}
class HTMLFormElement extends HTMLElement {
  get elements() { const el = this; return { namedItem: (n) => el.querySelector(`[name="${n}"]`) }; }
  requestSubmit() { if (this.dispatchEvent(new Evt('submit', { bubbles: true, cancelable: true }))) dom.submitted.push(this); }
}
class HTMLDialogElement extends HTMLElement {
  get open() { return this.hasAttribute('open'); }
  showModal() { this.setAttribute('open', ''); }
  close() { this.removeAttribute('open'); this.dispatchEvent(new Evt('close')); }
}
class HTMLDetailsElement extends HTMLElement {
  get open() { return this.hasAttribute('open'); }
  set open(v) { const was = this.open; if (v) this.setAttribute('open', ''); else this.removeAttribute('open'); if (was !== !!v) this.dispatchEvent(new Evt('toggle')); }
}
const KINDS = { iframe: HTMLIFrameElement, button: HTMLButtonElement, input: HTMLInputElement, select: HTMLSelectElement, option: HTMLOptionElement, textarea: HTMLTextAreaElement, form: HTMLFormElement, dialog: HTMLDialogElement, details: HTMLDetailsElement };

class Document extends Node {
  oninput = null; hidden = false; visibilityState = 'visible'; readyState = 'complete'; jar = new Map(); referrer = '';
  constructor() {
    super(null, 9, '#document');
    this.documentElement = this.createElement('html'); this.head = this.createElement('head'); this.body = this.createElement('body');
    Node.prototype.appendChild.call(this, this.documentElement);
    this.documentElement.append(this.head, this.body);
    this.activeElement = this.body;
  }
  get defaultView() { return globalThis; }
  createElement(tag) { const t = String(tag).toLowerCase(); return new (KINDS[t] || HTMLElement)(this, t); }
  createElementNS(ns, tag) { return ns === HTML ? this.createElement(tag) : new SVGElement(this, tag, ns); }
  createTextNode(s) { return new CharData(this, 3, '#text', s); }
  createComment(s) { return new CharData(this, 8, '#comment', s); }
  getElementById(id) { return this.documentElement.querySelector(`#${id}`); }
  querySelector(s) { return this.documentElement.matches(s) ? this.documentElement : this.documentElement.querySelector(s); }
  querySelectorAll(s) { return this.documentElement.querySelectorAll(s); }
  get cookie() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '); }
  set cookie(s) { const [pair] = String(s).split(';'), i = pair.indexOf('='); this.jar.set(pair.slice(0, i).trim(), pair.slice(i + 1)); }
  execCommand() { return dom.execCommand; }
  hasFocus() { return true; }
}

// ---------- the window ----------
const document = new Document();
const makeStorage = () => {
  const m = new Map();
  const api = {
    getItem: (k) => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => { if (dom.storageBlocked) throw new Error('QuotaExceededError'); m.set(String(k), String(v)); },
    removeItem: (k) => { m.delete(String(k)); }, clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null,
  };
  return new Proxy(api, {
    get: (t, k) => (k === 'length' ? m.size : k in t ? t[k] : m.get(k)),
    ownKeys: () => [...m.keys()],
    getOwnPropertyDescriptor: (_, k) => (m.has(k) ? { enumerable: true, configurable: true, value: m.get(k) } : undefined),
  });
};
class Location {
  url = new URL('https://updown.test/');
  assigned = [];
  get href() { return this.url.href; } set href(v) { this.assigned.push(String(v)); }
  get origin() { return this.url.origin; } get pathname() { return this.url.pathname; } get search() { return this.url.search; }
  get hash() { return this.url.hash; } get hostname() { return this.url.hostname; } get host() { return this.url.host; } get protocol() { return this.url.protocol; }
  assign(v) { this.assigned.push(String(v)); } replace(v) { this.assigned.push(String(v)); } reload() { this.assigned.push('reload'); }
}
const observed = { resize: new Set(), intersection: new Set() };
class ResizeObserverFake { constructor(cb) { this.cb = cb; this.els = new Set(); } observe(el) { this.els.add(el); observed.resize.add(this); } unobserve(el) { this.els.delete(el); } disconnect() { this.els.clear(); observed.resize.delete(this); } }
class IntersectionObserverFake { constructor(cb, opts) { this.cb = cb; this.opts = opts; this.els = new Set(); } observe(el) { this.els.add(el); observed.intersection.add(this); } unobserve(el) { this.els.delete(el); } disconnect() { this.els.clear(); observed.intersection.delete(this); } takeRecords() { return []; } }

// what a test sets up and reads back
export const dom = {};
const define = (k, value) => Object.defineProperty(globalThis, k, { value, writable: true, configurable: true, enumerable: false });
const globals = {
  window: globalThis, self: globalThis, document, Node, Element, HTMLElement, SVGElement, HTMLIFrameElement, HTMLInputElement, HTMLSelectElement, HTMLOptionElement, HTMLTextAreaElement, HTMLButtonElement, HTMLFormElement, HTMLDialogElement, HTMLDetailsElement,
  Event: Evt, MouseEvent: MouseEvt, PointerEvent: PointerEvt, KeyboardEvent: KeyEvt, FocusEvent: FocusEvt, CustomEvent: CustomEvt, MessageEvent: MessageEvt, PageTransitionEvent: PageEvt,
  addEventListener: (...a) => win.addEventListener(...a), removeEventListener: (...a) => win.removeEventListener(...a), dispatchEvent: (e) => win.dispatchEvent(e),
  Date: FakeDate, ResizeObserver: ResizeObserverFake, IntersectionObserver: IntersectionObserverFake,
  setTimeout: (fn, ms, ...a) => addTimer(fn, ms, false, a), clearTimeout: (id) => { timers.delete(id); }, setInterval: (fn, ms, ...a) => addTimer(fn, ms, true, a), clearInterval: (id) => { timers.delete(id); },
  requestAnimationFrame: (fn) => addTimer(() => fn(clock.now - START), 16), cancelAnimationFrame: (id) => { timers.delete(id); },
  requestIdleCallback: (fn) => addTimer(() => fn({ didTimeout: false, timeRemaining: () => 50 }), 1), cancelIdleCallback: (id) => { timers.delete(id); },
  matchMedia: (q) => ({ media: q, matches: !!dom.media[q], addEventListener() {}, removeEventListener() {} }),
  getComputedStyle: (el) => el.style, getSelection: () => null, scrollTo() {},
  confirm: (msg) => { dom.confirms.push(msg); return dom.confirmAnswer; }, alert() {},
  innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, isSecureContext: true,
  reportError: (e) => { dom.reported.push(e); },
  IS_REACT_ACT_ENVIRONMENT: true,
};
for (const [k, v] of Object.entries(globals)) define(k, v);
Object.defineProperty(performance, 'now', { value: () => clock.now - START, configurable: true, writable: true });

// React's complaints, kept for done() to fail on
console.error = (...a) => { dom.warnings.push(a.map(String).join(' ').replace(/%s/g, '').slice(0, 600)); };

// ---------- React, now that there is a page for it to find ----------
const React = (await import('react')).default;
const { createRoot } = (await import('react-dom/client')).default;
const { renderToStaticMarkup } = (await import('react-dom/server')).default;
const { act } = React;
const roots = new Set();

const DEFAULTS_NAV = () => ({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130.0', language: 'en', languages: ['en'], hardwareConcurrency: 8, clipboard: { writeText: async (t) => { dom.clipboard.push(t); } } });

// a fresh page: every test begins with one. url: where it is
export function reset({ url = 'https://updown.test/', at = START } = {}) {
  Object.assign(dom, { media: {}, followed: [], submitted: [], confirms: [], confirmAnswer: true, clipboard: [], fetches: [], warnings: [], reported: [], storageBlocked: false, execCommand: true });
  dom.tracked = globalThis.__tracked = []; dom.avOpened = globalThis.__avOpened = []; globalThis.__supabase = undefined;
  clock.set(at); timers.clear();
  define('localStorage', makeStorage()); define('sessionStorage', makeStorage());
  define('navigator', DEFAULTS_NAV());
  const loc = new Location(); loc.url = new URL(url, 'https://updown.test/'); define('location', loc);
  define('history', { state: null, length: 1, went: [], replaced: [], replaceState(_, __, u) { this.replaced.push(u); loc.url = new URL(u, loc.url); }, pushState(_, __, u) { loc.url = new URL(u, loc.url); }, back() { this.went.push(-1); }, go(n) { this.went.push(n); }, forward() {} });
  define('fetch', async (u, init) => { dom.fetches.push({ url: String(u), init }); throw new Error(`no network in the tests: ${u}`); });
  document.jar.clear(); document.hidden = false; document.readyState = 'complete'; document.activeElement = document.body;
  document.documentElement.attrs.clear(); document.documentElement.style.custom.clear();
  win.listeners.clear();
  for (const k of [...document.listeners.keys()]) if (k !== 'selectionchange') document.listeners.delete(k);
  observed.resize.clear(); observed.intersection.clear();
  globalThis.__nav = { path: '/', search: '', params: {} };
  delete globalThis.AudioContext; delete globalThis.Audio;
}
reset();

// everything unmounted, and the page left as clean as it was found
export async function done() {
  for (const r of [...roots]) await r.unmount();
  const left = [...win.listeners.keys()].map((k) => `window ${k}`).concat([...document.listeners.keys()].filter((k) => k !== 'selectionchange').map((k) => `document ${k}`));
  const obs = observed.resize.size + observed.intersection.size;
  document.body.childNodes.slice().forEach((c) => c.remove());
  // (an update landing between two of the test's own steps says nothing about the page)
  const warnings = dom.warnings.filter((w) => !/not wrapped in act/.test(w) && !dom.allowed?.some((a) => a.test(w)));
  dom.allowed = null;
  assert.deepEqual(left, [], 'listeners left on the page after unmounting');
  assert.equal(obs, 0, 'observers left running after unmounting');
  assert.deepEqual(warnings, [], 'React complained while rendering');
}
// a complaint a test expects, because it is reported as a bug of its own
export const allowWarning = (...res) => { dom.allowed = [...(dom.allowed || []), ...res]; };

// lets promises, and whatever React does after them, finish; the clock doesn't move
export async function settle(rounds = 16) {
  await act(async () => { for (let i = 0; i < rounds; i++) await new Promise((r) => setImmediate(r)); });
}
// keeps settling until a thing is true: for what comes by a dynamic import, however long that takes to read
export async function until(check, what = 'the page to get there') {
  for (let i = 0; i < 400; i++) { if (check()) return; await settle(4); }
  assert.fail(`waited for ${what}`);
}
// moves the clock on, each timer that falls due firing in turn with React caught up after it
export async function tick(ms) {
  const end = clock.now + ms;
  for (let n = 0; n < 200000; n++) {
    const x = nextTimer();
    if (!x || x.at > end) break;
    clock.now = x.at;
    await act(async () => { runTimer(x); });
  }
  clock.now = end;
  await settle(4);
}
export const pendingTimers = () => timers.size;

// the component on the page, and how to look at it (the whole page: a sheet may be drawn outside the component)
export async function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(element); });
  await settle();
  const view = {
    container, $: (s) => document.body.querySelector(s), $$: (s) => document.body.querySelectorAll(s),
    text: () => plain(document.body.innerHTML),
    rerender: async (el) => { await act(async () => { root.render(el); }); await settle(); },
    unmount: async () => { if (!roots.delete(view)) return; await act(async () => { root.unmount(); }); container.remove(); await settle(4); },
  };
  roots.add(view);
  return view;
}

const act1 = async (fn) => { await act(async () => { fn(); }); await settle(); };
export const click = (el, init) => { assert.ok(el, 'nothing there to click'); return act1(() => el.click(init)); };
// types into a field as a person would: the field's own value changes, then the input event fires
export const type = (el, value) => {
  assert.ok(el, 'nothing there to type into');
  return act1(() => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, value);
    el.dispatchEvent(new Evt('input', { bubbles: true }));
  });
};
const EVENTS = { key: KeyEvt, pointer: PointerEvt, mouse: MouseEvt, click: MouseEvt, focus: FocusEvt, blur: FocusEvt };
export const fire = (el, kind, init = {}) => {
  assert.ok(el, `nothing there to fire ${kind} on`);
  const K = Object.entries(EVENTS).find(([k]) => kind.startsWith(k))?.[1] ?? Evt;
  const e = new K(kind, { bubbles: true, cancelable: true, ...init });
  return act1(() => el.dispatchEvent(e)).then(() => e);
};
// a key pressed on what has the focus (or on `el`)
export const press = (key, el = document.activeElement, init = {}) => fire(el, 'keydown', { key, ...init });
export const focus = (el) => act1(() => el.focus());
export const blur = (el) => act1(() => el.blur());
// a file chosen in a file field
export const choose = (el, file) => act1(() => { el.files = file ? [file] : []; el.dispatchEvent(new Evt('change', { bubbles: true })); });
// runs anything else that changes the page, with React caught up after it
export const doing = (fn) => act1(fn);
// something happening on the window: a page's event, a settings change
export const tell = (e) => act1(() => win.dispatchEvent(e));
// the 3D scene in an iframe saying something to the page
export const fromFrame = (iframe, data) => tell(new MessageEvt('message', { data, origin: location.origin, source: iframe.contentWindow }));
// an observed element scrolling into or out of view
export const intersect = (el, isIntersecting = true, extra = {}) => act1(() => {
  for (const io of [...observed.intersection]) if (io.els.has(el)) io.cb([{ target: el, isIntersecting, boundingClientRect: { top: isIntersecting ? 10 : -10 }, ...extra }], io);
});
export const resized = () => act1(() => { for (const r of [...observed.resize]) r.cb([]); });
export const observers = () => ({ resize: observed.resize.size, intersection: observed.intersection.size });
export const listening = (type) => win.listeners.get(type)?.length ?? 0;

// ---------- the network ----------
export const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body), arrayBuffer: async () => new ArrayBuffer(8) });
// answers by address: each route is [text or regular expression in the address, the answer or a function making it]
export function serve(routes) {
  define('fetch', async (u, init) => {
    const url = String(u);
    dom.fetches.push({ url, init });
    for (const [m, a] of routes) if (m instanceof RegExp ? m.test(url) : url.includes(m)) { const r = typeof a === 'function' ? await a(url, init) : a; if (r instanceof Error) throw r; return r; }
    throw new Error(`no network in the tests: ${url}`);
  });
}

// ---------- who is signed in: the session cookie lib/me.ts reads ----------
export function signIn({ email = 'anna@example.com', name = 'Anna Petrova', provider = 'email', telegram = false } = {}) {
  const session = { user: { email, user_metadata: { display_name: name }, app_metadata: { provider, ...(telegram && { telegram_id: 7 }) } } };
  document.cookie = `sb-abc-auth-token=${encodeURIComponent(JSON.stringify(session))}`;
}

// ---------- reading markup ----------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#x27': "'", '#39': "'", nbsp: ' ' };
export const decode = (s) => s.replace(/&(#x27|#39|amp|lt|gt|quot|nbsp);/g, (_, k) => ENT[k]);
// the server's markup for a component: the page as it is before any effect runs
export const ssr = (element) => renderToStaticMarkup(element);
// the words a reader sees in markup, or in a page's text, with spaces tidied
export const plain = (s) => decode(String(s).replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/[\s ]+/g, ' ').trim();
// every href in markup, in order
export const hrefs = (html) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => decode(m[1]));
export const h = React.createElement;
// English words left in text meant to be Russian, the names that stay as they are (`allow`) taken out first
export const englishIn = (text, allow = []) => {
  let s = String(text);
  for (const a of ['Up and down', 'RYC Rentals', 'RYC Sailing', 'RYC', 'English', 'Español', 'Deutsch', 'Türkçe', 'America’s Cup', 'Telegram', 'Google', 'DSQ', 'FPS', 'WebGL', 'UTC', ...allow]) s = s.split(a).join(' ');
  return s.match(/[A-Za-z]{3,}/g) ?? [];
};
// a router that remembers where it was sent, as next/navigation's stand-in hands it to the page
export function spyRouter() {
  const router = { pushed: [], replaced: [], refreshed: 0, push(to) { this.pushed.push(to); }, replace(to) { this.replaced.push(to); }, refresh() { this.refreshed++; }, back() {}, forward() {}, prefetch() {} };
  globalThis.__nav.router = router;
  return router;
}
