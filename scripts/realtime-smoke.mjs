// Live check of public/game/net.js against the project's Realtime: two clients on match:SMOKE1, 20 broadcasts
// from one, how many the other got and the median delay. Reads the URL and publishable key from .env.local.
import { readFileSync } from 'node:fs';
import { realtime } from '../public/game/net.js';

const env = {};
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
  if (m) env[m[1]] = m[2];
}
const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) { console.error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are needed in .env.local'); process.exit(1); }

const A = realtime({ url, key }), B = realtime({ url, key });
const a = A.channel('match:SMOKE1'), b = B.channel('match:SMOKE1');
const delays = [];
b.on('ping', (p) => delays.push(Date.now() - p.t));
await Promise.all([a.join(), b.join()]);
const N = 20;
for (let i = 0; i < N; i++) { a.send('ping', { i, t: Date.now() }); await new Promise((r) => setTimeout(r, 50)); }
await new Promise((r) => setTimeout(r, 1500));
delays.sort((x, y) => x - y);
console.log(`received ${delays.length}/${N}, median ${delays.length ? delays[delays.length >> 1] : '-'} ms`);
A.close(); B.close();
process.exit(delays.length === N ? 0 : 1);
