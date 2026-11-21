import { plainName } from './name';
import { VENUES } from './venues';
import { YACHTS } from './yachts';

// Open calls (release 5a of the 1-on-1 plan; iyt-test supabase/migrations/20261121230000_regatta_call.sql): a sailor
// looking for a race posts a link for any chat; the first signed-in sailor whose rating is in its band takes it and both
// get Match found. /connect/seek posts and takes (app/connect/seek/route.ts), /call/[code] shows one
// (app/[lang]/call/[code]/page.tsx), components/duel-finder.tsx posts it from Looking and takes it from ?take=.
export type CallState = 'open' | 'taken' | 'away' | 'closed';
export type Call = {
  code: string; name: string | null; rating: number; races: number; lo: number; hi: number; venue: string | null; yacht: string | null;
  state: CallState; takenBy: string | null; left: number; mine: boolean; fits: boolean | null;
};
export type Posted = { status: 'open'; code: string; lo: number; hi: number; left: number } | { status: 'none'; reason: string | null };
export const BANDS = [100, 200, 350] as const;

const CODE_RE = /^[A-HJ-KM-NP-Z2-9]{6}$/;
const int = (v: unknown) => typeof v === 'number' && Number.isInteger(v);
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
const VENUE_IDS = new Set<string>(VENUES.map((v) => v.id)), YACHT_IDS = new Set<string>(YACHTS.map((y) => y.id));
export const callCode = (c: unknown): string | null => { const s = typeof c === 'string' ? c.trim().toUpperCase() : ''; return CODE_RE.test(s) ? s : null; };
export const callHref = (code: string) => `/call/${code}`;

// regatta_call_view's answer; anything malformed is null
export function parseCall(j: unknown): Call | null {
  const o = j as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') return null;
  const code = callCode(o.code);
  if (!code || ![o.rating, o.races, o.lo, o.hi].every(int) || !['open', 'taken', 'away', 'closed'].includes(o.state as string)) return null;
  const left = num(o.left);
  return {
    code, name: plainName(o.name as string) ?? null, rating: o.rating as number, races: o.races as number, lo: o.lo as number, hi: o.hi as number,
    venue: VENUE_IDS.has(o.venue as string) ? (o.venue as string) : null, yacht: YACHT_IDS.has(o.yacht as string) ? (o.yacht as string) : null,
    state: o.state as CallState, takenBy: o.state === 'taken' ? plainName(o.taken_name as string) ?? null : null,
    left: Number.isFinite(left) ? Math.max(0, Math.round(left)) : 0, mine: o.mine === true, fits: typeof o.fits === 'boolean' ? o.fits : null,
  };
}

// regatta_call_post's answer
export function parsePosted(j: unknown): Posted {
  const o = j as Record<string, unknown> | null;
  if (o && o.status === 'open') {
    const code = callCode(o.code), left = num(o.left);
    if (code && int(o.lo) && int(o.hi)) return { status: 'open', code, lo: o.lo as number, hi: o.hi as number, left: Number.isFinite(left) ? Math.max(0, Math.round(left)) : 0 };
  }
  return { status: 'none', reason: o && typeof o.reason === 'string' ? o.reason : null };
}
