import { plainName } from './name';

// Who is asking, on a 1-on-1 race's invite page (/match/<code>): what the database's regatta_invite(code) tells anyone
// with the link (iyt-test supabase/migrations/20261121180000_regatta_friend.sql), as the host's screen reported it when
// its waiting room opened. minutes: about how long the race takes (the start and the median finished race like it), or
// null while too few have been sailed to say. sailed: races already sailed on this link (a rematch link is still open).
export type Invite = { name: string | null; rating: number; races: number; venue: string | null; yacht: string | null; wind: string | null; length: string | null;
  course: string | null; laps: number | null; start_min: number | null; minutes: number | null; sailed: number };

const int = (v: unknown) => typeof v === 'number' && Number.isInteger(v);
const word = (v: unknown) => (typeof v === 'string' && /^[a-z0-9_-]{1,32}$/.test(v) ? v : null);

export function parseInvite(j: unknown): Invite | null {
  const o = j as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || !int(o.rating) || !int(o.races) || !int(o.sailed)) return null;
  return { name: plainName(typeof o.name === 'string' ? o.name : null) ?? null, rating: o.rating as number, races: o.races as number,
    venue: word(o.venue), yacht: word(o.yacht), wind: word(o.wind), length: word(o.length), course: word(o.course),
    laps: int(o.laps) ? (o.laps as number) : null, start_min: int(o.start_min) ? (o.start_min as number) : null,
    minutes: int(o.minutes) && (o.minutes as number) > 0 && (o.minutes as number) < 120 ? (o.minutes as number) : null, sailed: o.sailed as number };
}
