// npm run test:coverage: runs every test and says how much of the project they run, line by line. Node's own report
// can't: a test that loads a module afresh (./stats.js?case=2) counts as another file, a .tsx is measured as compiled, and
// a file no test loads isn't listed at all. Here every copy of a module is added up, and a file never loaded counts as
// not covered. A .tsx is measured on the code test/load.mjs compiles it to.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ts = createRequire(import.meta.url)('typescript');
const walk = (d) => readdirSync(join(ROOT, d)).flatMap((f) => { const p = `${d}/${f}`; return statSync(join(ROOT, p)).isDirectory() ? walk(p) : [p]; });
const site = [...walk('app'), ...walk('components'), ...walk('lib')];
const GROUPS = {
  'Pages and components (.tsx)': site.filter((f) => f.endsWith('.tsx')),
  'Server and site code (.ts)': [...site.filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts')), 'proxy.ts'],
  'The game (public/game)': readdirSync(join(ROOT, 'public/game')).filter((f) => f.endsWith('.js')).map((f) => `public/game/${f}`),
  'Tools (scripts)': readdirSync(join(ROOT, 'scripts')).filter((f) => f.endsWith('.mjs')).map((f) => `scripts/${f}`),
};

// the text V8 measured: the file itself, or a .tsx as test/load.mjs compiles it
const measured = (rel) => {
  const src = readFileSync(join(ROOT, rel), 'utf8');
  if (!rel.endsWith('.tsx')) return src;
  return ts.transpileModule(src, { fileName: join(ROOT, rel), compilerOptions: {
    module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, inlineSourceMap: true, inlineSources: true } }).outputText;
};

const dir = mkdtempSync(join(tmpdir(), 'regatta-coverage-'));
const tests = readdirSync(join(ROOT, 'test')).filter((f) => f.endsWith('.test.mjs')).map((f) => `test/${f}`);
const run = spawnSync(process.execPath, ['--test', '--test-reporter=dot', ...tests], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, NODE_V8_COVERAGE: dir } });

const scripts = new Map(); // a file -> every copy of it that was loaded
const base = `file://${ROOT}`;
for (const f of readdirSync(dir)) {
  for (const s of JSON.parse(readFileSync(join(dir, f), 'utf8')).result) {
    if (!s.url.startsWith(base)) continue;
    const rel = decodeURIComponent(s.url.slice(base.length).split('?')[0]);
    if (!scripts.has(rel)) scripts.set(rel, []);
    scripts.get(rel).push(s);
  }
}
rmSync(dir, { recursive: true, force: true });

// the lines with code in them, and those no copy of the file ever ran
function lines(rel) {
  const src = measured(rel), hit = new Uint8Array(src.length);
  for (const s of scripts.get(rel) || []) {
    const ran = new Uint32Array(src.length).fill(1);
    for (const fn of s.functions) for (const r of fn.ranges) ran.fill(r.count, r.startOffset, Math.min(r.endOffset, src.length));
    for (let i = 0; i < src.length; i++) if (ran[i]) hit[i] = 1;
  }
  let at = 0, total = 0, missed = 0;
  for (const l of src.split('\n')) {
    if (l.trim() && !l.startsWith('//# sourceMappingURL')) {
      total++;
      let any = false;
      for (let i = 0; i < l.length && !any; i++) any = !!l[i].trim() && !!hit[at + i];
      if (!any) missed++;
    }
    at += l.length + 1;
  }
  return { total, missed };
}

const pc = (c, t) => `${(t ? (100 * c) / t : 100).toFixed(1)}%`;
let all = 0, allMissed = 0;
console.log('\n\nLines run by the tests');
for (const [name, files] of Object.entries(GROUPS)) {
  let total = 0, missed = 0;
  const low = [];
  for (const f of files) {
    const c = lines(f);
    total += c.total; missed += c.missed;
    if (c.total && c.missed / c.total > 0.1) low.push(`${f} ${pc(c.total - c.missed, c.total)}`);
  }
  all += total; allMissed += missed;
  console.log(`  ${name.padEnd(30)} ${pc(total - missed, total).padStart(6)}   ${total - missed} of ${total}, ${files.length} files`);
  for (const l of low) console.log(`      under 90%: ${l}`);
}
console.log(`  ${'Everything'.padEnd(30)} ${pc(all - allMissed, all).padStart(6)}   ${all - allMissed} of ${all}`);
process.exit(run.status ?? 1);
