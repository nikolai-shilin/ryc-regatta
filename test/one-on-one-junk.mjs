// Bad data, from a seed: the same seed gives the same junk, so a failure can be reproduced. No side effects: any test can use it.
export function dice(seed) {
  let s = seed >>> 0;
  const g = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  g.int = (n) => Math.floor(g() * n);
  g.pick = (a) => a[g.int(a.length)];
  return g;
}

// objects a careless String() or Number() throws on, and shapes that look like something they aren't
const hostile = () => [{ toString: 1 }, { valueOf: 1, toString: 'x' }, JSON.parse('{"__proto__":{"polluted":1},"constructor":{"prototype":{"polluted":1}}}'), { length: 1e9 }, { then: 1 }];
const deep = (n) => { let v = []; for (let i = 0; i < n; i++) v = i % 2 ? [v] : { v }; return v; };
const SCALARS = [null, true, false, 0, -1, 0.5, 1e308, -1e308, 2 ** 53, '', 'x', '__proto__', 'constructor', 'toString', '💥', '<b>'];
// anything that survives JSON, as a message over the wire does
export function junk(g, depth = 0) {
  switch (g.int(depth > 2 ? 3 : 9)) {
    case 0: case 1: return g.pick(SCALARS);
    case 2: return g.pick(hostile());
    case 3: return [];
    case 4: return {};
    case 5: return Array.from({ length: 1 + g.int(4) }, () => junk(g, depth + 1));
    case 6: return Object.fromEntries(Array.from({ length: 1 + g.int(4) }, () => [g.pick(['id', 'seed', 'c', 'b', 'list', 'start', 'host', 'guest', 'winner', 'boats', 'x']), junk(g, depth + 1)]));
    case 7: return deep(40);
    default: return g.int(6) ? g.pick(SCALARS) : g.int(2) ? 'x'.repeat(100000) : Array(5000).fill(0);
  }
}
// and what a direct call may be handed besides
const WILD = [undefined, NaN, Infinity, -Infinity, () => 1, Symbol('s'), 10n, new Date(0), new Map(), /x/];
export const wild = (g) => (g.int(3) ? junk(g) : g.pick(WILD));

// a value of the wrong type for the one it replaces (never one that could pass for a right one)
function wrongFor(v, g) {
  if (v === null) return g.pick([true, [], { x: 1 }, { toString: 1 }]);
  if (Array.isArray(v)) return g.pick([true, 7, 'x', {}, { toString: 1 }]);
  switch (typeof v) {
    case 'number': return g.pick([true, 'x', '', [], {}, [1], { toString: 1 }]);
    case 'string': return g.pick([true, 7, [], {}, { toString: 1 }]);
    case 'boolean': return g.pick([7, 'x', [], {}]);
    default: return g.pick([true, 7, 'x', []]);
  }
}
// a real message with one field made wrong: missing, or of the wrong type. skip: paths that are free-form (a path is 'a.b.0')
export function mutate(message, g, skip = null) {
  const root = JSON.parse(JSON.stringify(message)), byDepth = [];
  const walk = (v, path) => {
    if (!v || typeof v !== 'object' || path.length > 5) return;
    for (const k of Object.keys(v)) { const p = [...path, k]; if (skip?.test(p.join('.'))) continue; (byDepth[path.length] ||= []).push(p); walk(v[k], p); }
  };
  walk(root, []);
  if (!byDepth.length) return junk(g);
  const p = g.pick(g.pick(byDepth)), parent = p.slice(0, -1).reduce((o, k) => o[k], root), k = p.at(-1);
  if (!Array.isArray(parent) && !g.int(4)) delete parent[k]; else parent[k] = wrongFor(parent[k], g);
  return root;
}
