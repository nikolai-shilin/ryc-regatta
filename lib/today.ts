import 'server-only';
import { getRating, todayUtc } from './rating';

// the scores API; SCORES_API points the site at another one (a local copy, a stub for testing)
const SCORES = process.env.SCORES_API || 'https://iyt.rycrentals.com/api/game';

// Today's fastest, from the public scores API the game already posts to (api/game.mjs in the iyt-test repo).
// The edge caches it for five minutes, and so do we.
export type TopRow = { name: string | null; s: number; fl?: string | null }; // fl: the flag they fly (lib/flags.ts)
// top: the first five; n: how many the list can hold (5 from the day's rating, 3 from the plain API's daily.top); ranked:
// everyone ranked today and tenth the 10th time, when the rating could be had
export type Today = { d: string; w?: string; races: number; top: TopRow[]; n: number; ranked?: number; tenth?: number | null };
export const TOP = 5;

// The plain API's daily.top has only the first three, so the top five come from the day's rating (lib/rating.ts,
// every finisher of the day), asked at the same time; when that fails the first three still show.
export async function todayTop(): Promise<Today | null> {
  const plain = fetch(SCORES, { next: { revalidate: 300 } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const day = todayUtc();
  const [j, rating] = await Promise.all([plain, getRating(day)]);
  const d = j && j.daily;
  if (rating && rating.d === day) {
    const rows = rating.rows;
    return { d: day, w: rating.w ?? d?.w, races: rating.races || d?.races || 0, top: rows.slice(0, TOP).map((r) => ({ name: r.name, s: r.s, fl: r.fl })),
      n: TOP, ranked: rows.length, tenth: rows.length >= 10 ? rows[9].s : null };
  }
  return d && Array.isArray(d.top) ? { d: d.d, w: d.w, races: d.races || 0, top: d.top.slice(0, 3), n: 3 } : null;
}
