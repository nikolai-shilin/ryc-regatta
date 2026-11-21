import { plainName } from './name';
import { callCode } from './duel-call';
import { VENUES } from './venues';
import { YACHTS } from './yachts';

// What the 1-on-1 page (/duel, components/duel-finder.tsx) reads beside Find a race, checked: the open calls a signed-in
// sailor could take now (the database's regatta_calls_open, with Ready now: POST /connect/seek { do: 'ready_now' }), and
// the 1-on-1 rating around them (regatta_rating_near: GET /connect/rating/near). iyt-test
// supabase/migrations/20261122100000_regatta_duel_page.sql.
export type Call = { code: string; name: string | null; rating: number; races: number; lo: number; hi: number; venue: string | null; yacht: string | null; ago: number; mine: boolean; inBand: boolean };
export type NearRow = { place: number; name: string | null; rating: number; races: number; wins: number; losses: number; me: boolean };
export type Near = { place: number | null; of: number; rows: NearRow[] };

const int = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const known = <T extends { id: string }>(list: readonly T[], v: unknown) => (typeof v === 'string' && list.some((x) => x.id === v) ? v : null);

export function parseCalls(j: unknown): Call[] {
  if (!Array.isArray(j)) return [];
  return j.filter((c) => c && callCode(c.code) && [c.rating, c.races, c.lo, c.hi, c.ago].every(int)).slice(0, 20)
    .map((c) => ({ code: callCode(c.code)!, name: plainName(c.name) ?? null, rating: c.rating, races: c.races, lo: c.lo, hi: c.hi,
      venue: known(VENUES, c.venue), yacht: known(YACHTS, c.yacht), ago: c.ago, mine: c.mine === true, inBand: c.in_band === true }));
}

export function parseNear(j: unknown): Near | null {
  const o = j as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || !Array.isArray(o.rows) || !int(o.of)) return null;
  const rows = (o.rows as Record<string, unknown>[]).filter((r) => r && [r.place, r.rating, r.races, r.wins, r.losses].every(int)).slice(0, 7)
    .map((r) => ({ place: r.place as number, name: plainName(r.name as string) ?? null, rating: r.rating as number, races: r.races as number,
      wins: r.wins as number, losses: r.losses as number, me: r.me === true }));
  return { place: int(o.place) && (o.place as number) > 0 ? (o.place as number) : null, of: o.of as number, rows };
}
