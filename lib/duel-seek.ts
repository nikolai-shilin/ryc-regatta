import { plainName } from './name';
import { VENUES } from './venues';
import { YACHTS } from './yachts';

// Matchmaking, as the database's regatta_seek tells the signed-in sailor (iyt-test supabase/migrations/20261121200000_regatta_seek.sql):
// looking (how long, the band, how many are looking), found (a pair: the other sailor, the race's settings, the seconds left
// to say Ready), go (both said Ready: off to the race) or none. POST /connect/seek (app/connect/seek/route.ts) asks it;
// components/duel-finder.tsx shows it. A pair's settings are the game's (public/game/match.js cleanSettings): the host's
// screen is given them as a race set up on /match/new would be.
export type Settings = { venue: string; yacht: string; preset: string; length: string; course: string; laps: number; start: number; current: 0 | 1; daytime: string };
export type Pair = {
  id: string; code: string; role: 'host' | 'guest'; settings: Settings;
  them: { name: string | null; rating: number; races: number }; me: { rating: number; races: number; ok: boolean | null };
  themOk: boolean | null; left: number; minutes: number | null;
};
export type Seek = { status: 'looking'; waited: number; band: number; online: number; near: number } | { status: 'found' | 'go'; pair: Pair } | { status: 'none'; reason: string | null };

const int = (v: unknown) => typeof v === 'number' && Number.isInteger(v);
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
const VENUE_IDS = new Set<string>(VENUES.map((v) => v.id)), YACHT_IDS = new Set<string>(YACHTS.map((y) => y.id));
const CODE_RE = /^[A-HJ-KM-NP-Z2-9]{6}$/;

function settingsOf(s: unknown): Settings | null {
  const o = s as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || !VENUE_IDS.has(o.venue as string) || !YACHT_IDS.has(o.yacht as string)) return null;
  if (!['light', 'medium', 'strong'].includes(o.preset as string) || !['short', 'medium', 'long'].includes(o.length as string) || !['wl', 'tri', 'trap', 'wlu'].includes(o.course as string)) return null;
  if (![1, 2].includes(o.laps as number) || ![1, 3, 5].includes(o.start as number) || ![0, 1].includes(o.current as number) || typeof o.daytime !== 'string') return null;
  return { venue: o.venue as string, yacht: o.yacht as string, preset: o.preset as string, length: o.length as string, course: o.course as string, laps: o.laps as number, start: o.start as number, current: o.current as 0 | 1, daytime: o.daytime };
}

function pairOf(p: unknown): Pair | null {
  const o = p as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || typeof o.id !== 'string' || typeof o.code !== 'string' || !CODE_RE.test(o.code) || (o.role !== 'host' && o.role !== 'guest')) return null;
  const settings = settingsOf(o.settings), them = o.them as Record<string, unknown> | null, me = o.me as Record<string, unknown> | null;
  if (!settings || !them || !me || !int(them.rating) || !int(them.races) || !int(me.rating) || !int(me.races)) return null;
  const left = num(o.left);
  return { id: o.id, code: o.code, role: o.role, settings, them: { name: plainName(them.name as string) ?? null, rating: them.rating as number, races: them.races as number },
    me: { rating: me.rating as number, races: me.races as number, ok: typeof me.ok === 'boolean' ? me.ok : null },
    themOk: typeof o.them_ok === 'boolean' ? o.them_ok : null, left: Number.isFinite(left) ? Math.max(0, Math.min(12, left)) : 0, minutes: int(o.minutes) ? (o.minutes as number) : null };
}

export function parseSeek(j: unknown): Seek {
  const o = j as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') return { status: 'none', reason: null };
  if (o.status === 'looking') { const w = num(o.waited); return { status: 'looking', waited: Number.isFinite(w) ? w : 0, band: int(o.band) ? (o.band as number) : 100, online: int(num(o.online)) ? num(o.online) : 0, near: int(num(o.near)) ? num(o.near) : 0 }; }
  if (o.status === 'found' || o.status === 'go') { const pair = pairOf(o.pair); return pair ? { status: o.status, pair } : { status: 'none', reason: null }; }
  return { status: 'none', reason: typeof o.reason === 'string' ? o.reason : null };
}

// what the game is given to open a matched race: the host's screen hosts it with these settings (as /match/new does), the
// guest's opens its link; ?auto has the host's screen press Start itself once she is in
export function raceHref(p: Pair) {
  return `/play?match=${p.code}&venue=${encodeURIComponent(p.settings.venue)}&boat=${encodeURIComponent(p.settings.yacht)}${p.role === 'host' ? '&auto' : ''}`;
}

// a sailor's wishes for the race, as the page sends them: a venue and a yacht the game knows, or none
export function wishesOf(w: unknown): { venue?: string; yacht?: string } {
  const o = w as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') return {};
  return { ...(VENUE_IDS.has(o.venue as string) && { venue: o.venue as string }), ...(YACHT_IDS.has(o.yacht as string) && { yacht: o.yacht as string }) };
}
