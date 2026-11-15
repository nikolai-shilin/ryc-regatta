import 'server-only';

// the scores API; SCORES_API points the site at another one (a local copy, a stub for testing)
const SCORES = process.env.SCORES_API || 'https://iyt.rycrentals.com/api/game';

// The day's rating, from the scores API (api/game.mjs in the iyt-test repo, GET ?day=YYYY-MM-DD): everyone who
// finished that day's race, ranked by their best time, with their points, and the month's standings to that day.
// Points: on a day with N ranked sailors, the one in place i gets N − i + 1: a point for finishing, one more for each
// sailor beaten. A race sailed signed out (a guest's) is counted but doesn't rank.
export type DayRow = { k: string; name: string | null; ph: string | null; fl: string | null; s: number; p: number | null; pts: number; n: number };
export type MonthRow = { k: string; name: string | null; ph: string | null; fl: string | null; pts: number; days: number; wins: number; podiums: number };
export type Rating = { d: string; w: string | null; races: number; guests: number; rows: DayRow[]; month: { m: string; days: number; rows: MonthRow[] }; days: string[] };

import { todayUtc } from './day';
export { DAY_RE, todayUtc, validDay } from './day';

// null when it can't be had (the API is down, or doesn't know ?day= yet): the page says so rather than showing nobody
export async function getRating(day: string): Promise<Rating | null> {
  try {
    const r = await fetch(`${SCORES}?day=${day}`, { next: { revalidate: day === todayUtc() ? 300 : 3600 }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || j.d !== day || !Array.isArray(j.rows) || !j.month || !Array.isArray(j.month.rows)) return null;
    return { ...j, days: Array.isArray(j.days) ? j.days : [] };
  } catch {
    return null;
  }
}
