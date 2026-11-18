import { VENUES } from './venues.ts'; // with their extensions, so npm test's Node finds them too

// A passport as a link (/players?s=5&v=12&vs=…&n=Anna): the streak and the venues raced (how many and which, as a bit
// each in the venues' order, in base 36), for the share card (app/og/passport) and its page. Only what the sharer chose
// to send: the numbers, and their name if they're signed in.
export type PassportShare = { s: number; v: number; raced: boolean[]; n: string };
const bitsOf = (s: string | undefined) => {
  let bits = 0n;
  try { if (s && /^[0-9a-z]{1,8}$/.test(s)) for (const ch of s) bits = bits * 36n + BigInt(parseInt(ch, 36)); } catch {}
  return bits;
};
const clampN = (x: unknown, max: number) => { const n = Math.floor(Number(x)); return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0; };

// the parts of an address that are a passport, as they came
const KEYS = ['s', 'v', 'vs', 'n'];
export const passportInLink = (q: Record<string, string | string[] | undefined>) =>
  Object.entries(q).flatMap(([k, v]) => (typeof v === 'string' && KEYS.includes(k) ? [[k, v] as [string, string]] : []));

export function passportQuery(p: { streak: number; raced: Set<string>; name?: string }) {
  let bits = 0n;
  VENUES.forEach((v, i) => { if (p.raced.has(v.id)) bits |= 1n << BigInt(i); });
  const q = new URLSearchParams({ s: String(p.streak), v: String(p.raced.size), vs: bits.toString(36) });
  const n = (p.name || '').trim().slice(0, 30);
  if (n) q.set('n', n);
  return q.toString();
}

export function readPassport(q: Record<string, string | string[] | undefined>): PassportShare {
  const one = (k: string) => { const x = q[k]; return Array.isArray(x) ? x[0] : x; };
  const bits = bitsOf(one('vs'));
  const raced = VENUES.map((_, i) => ((bits >> BigInt(i)) & 1n) === 1n);
  const n = (one('n') || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 30);
  return { s: clampN(one('s'), 9999), v: Math.min(clampN(one('v'), VENUES.length), raced.filter(Boolean).length || clampN(one('v'), VENUES.length)), raced, n };
}
