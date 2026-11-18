import 'server-only';
import { todayUtc } from './rating';
import { briefUrl, readBrief, type DayBrief } from './day-brief';
import { plainRows, shortName } from './name';

// the scores API; SCORES_API points the site at another one (a local copy, a stub for testing)
const SCORES = process.env.SCORES_API || 'https://iyt.rycrentals.com/api/game';

// Today's fastest, from the public scores API the game already posts to (api/game.mjs in the iyt-test repo).
// The edge caches it for five minutes, and so do we.
export type TopRow = { name: string | null; s: number; fl?: string | null }; // fl: the flag they fly (lib/flags.ts)
// top: the first five; n: how many the list can hold (5 from the day's rating, 3 from the plain API's daily.top); ranked:
// everyone ranked today and tenth the 10th time, when the rating could be had
export type Today = { d: string; w?: string; races: number; top: TopRow[]; n: number; ranked?: number; tenth?: number | null };
export const TOP = 5;

// The plain API's daily.top has only the first three, so the top five come from the day's rating in brief
// (lib/day-brief.ts: its first rows and every ranked time, not the month), asked at the same time; when that fails the
// first three still show.
export async function todayTop(): Promise<Today | null> {
  const plain = fetch(SCORES, { next: { revalidate: 300 }, signal: AbortSignal.timeout(6000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const day = todayUtc();
  const brief = fetch(briefUrl(day, SCORES), { next: { revalidate: 300 }, signal: AbortSignal.timeout(6000) })
    .then((r) => (r.ok ? r.json() : null)).then((j): DayBrief | null => readBrief(j, day)).catch(() => null);
  const [j, b] = await Promise.all([plain, brief]);
  const d = j && j.daily;
  if (b) {
    return { d: day, w: b.w ?? d?.w, races: b.races || d?.races || 0, top: b.top.slice(0, TOP).map((r) => ({ name: shortName(r.name), s: r.s, fl: r.fl })),
      n: TOP, ranked: b.ranked, tenth: b.s.length >= 10 ? b.s[9] : null };
  }
  return d && Array.isArray(d.top) ? { d: d.d, w: d.w, races: d.races || 0, top: plainRows<TopRow>(d.top.slice(0, 3)), n: 3 } : null;
}
