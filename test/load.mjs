// Lets a test import what only Next.js or the game's page can load: the site's TypeScript and React as Next resolves them
// (@/lib/x, ./x with no extension, .tsx, .json, .css), three.js by the name the page's import map gives it, and stand-ins
// for what exists only on the server or in the build (server-only, next/headers, next/font …). Import it first:
//
//   import { mock } from './load.mjs';
//   mock('lib/supabase/server.ts', 'export const supabaseServer = async () => globalThis.__supabase;');
//   const { GET } = await import('../app/auth/token/route.ts');
//
// mock(name, source) replaces a module, named as it is imported (a package) or by its path from the project's root.
// Each test file runs in a process of its own, so what one mocks no other sees.
import { registerHooks, createRequire } from 'node:module';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, relative, sep } from 'node:path';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
const THREE = join(ROOT, 'public/vendor/three@0.160.0');
const VIRTUAL = pathToFileURL(join(ROOT, 'test/.virtual')).href + '/';
const require = createRequire(import.meta.url);

const sources = new Map(); // a virtual module's url -> its source
const mocks = new Map(); // a package's name, or a path from the root -> its virtual url
let made = 0;

export function mock(name, source) {
  const url = `${VIRTUAL}${++made}.mjs`;
  sources.set(url, source);
  mocks.set(name, url);
}

// ---------- what Next.js and the build provide ----------
mock('server-only', '');
mock('next/link', `import { createElement } from 'react';
export default function Link({ href, prefetch, replace, scroll, shallow, ...p }) {
  return createElement('a', { href: typeof href === 'string' ? href : href?.pathname ?? '', ...p });
}`);
mock('next/image', `import { createElement } from 'react';
export default function Image({ fill, priority, quality, placeholder, blurDataURL, loader, unoptimized, ...p }) {
  return createElement('img', p);
}`);
// the page being rendered: globalThis.__nav = { path, search: 'a=1', params }
mock('next/navigation', `const nav = () => globalThis.__nav || {};
class Stop extends Error { constructor(kind, to) { super(kind + (to ? ' ' + to : '')); this.kind = kind; this.to = to; } }
export const useRouter = () => (nav().router ||= { push() {}, replace() {}, back() {}, forward() {}, refresh() {}, prefetch() {} });
export const usePathname = () => nav().path ?? '/';
export const useSearchParams = () => new URLSearchParams(nav().search ?? '');
export const useParams = () => nav().params ?? {};
export const redirect = (to) => { throw new Stop('redirect', to); };
export const permanentRedirect = (to) => { throw new Stop('permanentRedirect', to); };
export const notFound = () => { throw new Stop('notFound'); };`);
// the request being answered: globalThis.__request = { cookies: { name: value }, headers: { name: value } }
mock('next/headers', `const req = () => (globalThis.__request ||= {});
export const cookies = async () => ({
  get: (name) => (name in (req().cookies ||= {}) ? { name, value: req().cookies[name] } : undefined),
  getAll: () => Object.entries(req().cookies ||= {}).map(([name, value]) => ({ name, value })),
  has: (name) => name in (req().cookies ||= {}),
  set: (name, value) => { (req().cookies ||= {})[name] = value; },
  delete: (name) => { delete (req().cookies ||= {})[name]; },
});
export const headers = async () => new Headers(req().headers || {});`);
mock('next/cache', `export const revalidatePath = (...a) => { (globalThis.__revalidated ||= []).push(a); };
export const revalidateTag = revalidatePath, updateTag = revalidatePath, refresh = () => {};
export const unstable_cache = (fn) => fn;
export const unstable_noStore = () => {}, connection = async () => {};`);
mock('next/font/google', `const face = (name) => (o = {}) => ({ className: name, variable: o.variable || name, style: { fontFamily: name } });
export const Merriweather = face('Merriweather'), Carlito = face('Carlito'), Sofia_Sans = face('Sofia_Sans'), Sofia_Sans_Condensed = face('Sofia_Sans_Condensed');`);
mock('next/og', `export class ImageResponse extends Response {
  constructor(element, options = {}) { super('image', { headers: { 'content-type': 'image/png' } }); this.element = element; this.options = options; }
}`);
mock('@vercel/analytics', 'export const track = () => {}; export const inject = () => {};');
mock('@vercel/analytics/next', 'export const Analytics = () => null;');

// ---------- how a module is found ----------
const isFile = (p) => { try { return statSync(p).isFile(); } catch { return false; } };
const probe = (p) => [p, `${p}.ts`, `${p}.tsx`, `${p}.js`, `${p}.mjs`, join(p, 'index.ts'), join(p, 'index.tsx')].find(isFile);
const fromRoot = (url) => {
  if (!url.startsWith('file:')) return null;
  const rel = relative(ROOT, fileURLToPath(url.split('?')[0]));
  return rel.startsWith('..') ? null : rel.split(sep).join('/');
};

function find(spec, ctx, next) {
  if (spec === 'three') return { url: pathToFileURL(join(THREE, 'build/three.module.min.js')).href, shortCircuit: true };
  if (spec.startsWith('three/addons/')) return { url: pathToFileURL(join(THREE, 'examples/jsm', spec.slice(13))).href, shortCircuit: true };
  if (spec.startsWith('@/')) {
    const file = probe(join(ROOT, spec.slice(2)));
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  // the site's own modules name each other with no extension, as Next allows
  const parent = ctx.parentURL && fromRoot(ctx.parentURL);
  if (parent && /\.tsx?$/.test(parent) && /^\.\.?\//.test(spec)) {
    const file = probe(fileURLToPath(new URL(spec, ctx.parentURL)));
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  try {
    return next(spec, ctx);
  } catch (e) {
    // a package's file named with no extension, as a bundler allows (next/server)
    if (e.code === 'ERR_MODULE_NOT_FOUND' && !/^[./]/.test(spec)) return next(`${spec}.js`, ctx);
    throw e;
  }
}

registerHooks({
  resolve(spec, ctx, next) {
    if (mocks.has(spec)) return { url: mocks.get(spec), shortCircuit: true };
    const found = find(spec, ctx, next), rel = fromRoot(found.url);
    return rel && mocks.has(rel) ? { url: mocks.get(rel), shortCircuit: true } : found;
  },
  load(url, ctx, next) {
    if (sources.has(url)) return { format: 'module', source: sources.get(url), shortCircuit: true };
    const path = url.split('?')[0];
    if (path.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
    if (path.endsWith('.json') && fromRoot(url)) return { format: 'module', source: `export default ${readFileSync(new URL(path), 'utf8')};`, shortCircuit: true };
    if (path.endsWith('.tsx')) {
      const ts = require('typescript'), file = fileURLToPath(path);
      const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), { fileName: file, compilerOptions: {
        module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, inlineSourceMap: true, inlineSources: true } });
      return { format: 'module', source: outputText, shortCircuit: true };
    }
    return next(url, ctx);
  },
});

export const exists = (p) => existsSync(join(ROOT, p));
