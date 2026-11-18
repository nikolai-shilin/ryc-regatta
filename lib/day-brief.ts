// A day's rating in brief, from the scores API (api/game.mjs in the iyt-test repo, GET ?day=YYYY-MM-DD&brief): that
// day alone, its first rows named and every ranked time, without the month's table or everyone's names. For the pages
// that only place a time on the day or show its first few (the result page, your month, Home's and the hub's card),
// so what they fetch stays small however many sail. Read on the server and in the browser.
import { plainName } from './name.ts'; // with its extension, so npm test's Node finds it too

export const SCORES_API = 'https://iyt.rycrentals.com/api/game';
export type BriefRow = { name: string | null; s: number; fl: string | null };
export type DayBrief = { d: string; w: string | null; races: number; ranked: number; top: BriefRow[]; s: number[] };

export const briefUrl = (day: string, base = SCORES_API) => `${base}?day=${encodeURIComponent(day)}&brief`;

// the answer read, or null when it isn't that day's. An API from before &brief sends the whole rating: read from that.
export function readBrief(j: unknown, day: string): DayBrief | null {
  const o = j as { d?: unknown; w?: unknown; races?: unknown; ranked?: unknown; top?: unknown; s?: unknown; rows?: unknown } | null;
  if (!o || o.d !== day) return null;
  const row = (r: { name?: unknown; s?: unknown; fl?: unknown }): BriefRow => ({ name: typeof r.name === 'string' ? plainName(r.name) : null, s: Number(r.s), fl: typeof r.fl === 'string' ? r.fl : null });
  const base = { d: day, w: typeof o.w === 'string' ? o.w : null, races: Number(o.races) || 0 };
  if (Array.isArray(o.s) && Array.isArray(o.top)) return { ...base, ranked: Number(o.ranked) || o.s.length, top: o.top.map(row), s: o.s.map(Number) };
  if (Array.isArray(o.rows)) return { ...base, ranked: o.rows.length, top: o.rows.slice(0, 10).map(row), s: o.rows.map((r: { s: unknown }) => Number(r.s)) };
  return null;
}
