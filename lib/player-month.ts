// One sailor's month of today's race, day by day, from the scores API (api/game.mjs in the iyt-test repo, GET
// ?month=YYYY-MM&k=<key>): the days they ranked on, each with their best time, their place among that day's ranked
// sailors and the points it took (ranked − place + 1), and their place on the month's table. The same days and points
// as the month's board, so the days add up to the points the board gives them. For /race/month.
import { SCORES_API } from './day-brief.ts'; // with its extension, so npm test's Node finds it too
import { plainName } from './name.ts';
import { LOCALE, type Lang } from './lang.ts';

export type MonthDay = { d: string; s: number; place: number; of: number; pts: number };
export type NearRow = { k: string; name: string | null; fl: string | null; pts: number; place: number; me: boolean };
export type PlayerMonth = {
  m: string; k: string; pts: number; place: number | null; of: number; wins: number; podiums: number; sailed: number;
  days: MonthDay[]; near: NearRow[]; above: { place: number; pts: number } | null;
};

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;
export const monthUrl = (m: string, k: string, base = SCORES_API) => `${base}?month=${m}&k=${encodeURIComponent(k)}`;

// the month that a day (YYYY-MM-DD) is in, its days, and the months either side of one
export const lastDay = (m: string) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).toISOString().slice(0, 10);
export const shiftMonth = (m: string, by: number) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + by, 1)).toISOString().slice(0, 7);
export const monthName = (m: string, lang: Lang) => {
  const s = new Date(`${m}-15T12:00:00Z`).toLocaleDateString(LOCALE[lang], { month: 'long', timeZone: 'UTC' });
  return s.charAt(0).toLocaleUpperCase(LOCALE[lang]) + s.slice(1);
};
// 1st, 1-е, 1.º, 1., 1., 1er, 1º, 1º
export const ordinal = (n: number, lang: Lang) => {
  if (lang === 'en') return `${n}${(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 || n % 10 === 0 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10]}`;
  return lang === 'ru' ? `${n}-е` : lang === 'es' ? `${n}.º` : lang === 'de' || lang === 'tr' ? `${n}.` : lang === 'fr' ? (n === 1 ? '1er' : `${n}e`) : `${n}º`;
};

const int = (v: unknown, min = 0) => (Number.isInteger(v) && (v as number) >= min ? (v as number) : null);
// the answer read and checked, or null when it isn't that sailor's month (or isn't one)
export function readPlayerMonth(j: unknown, m: string, k: string): PlayerMonth | null {
  const o = j as Record<string, unknown> | null;
  if (!o || o.m !== m || o.k !== k || !Array.isArray(o.days) || !Array.isArray(o.near)) return null;
  const days: MonthDay[] = [];
  for (const x of o.days as Record<string, unknown>[]) {
    const place = int(x?.place, 1), of = int(x?.of, 1), pts = int(x?.pts, 1), s = Number(x?.s);
    if (typeof x?.d !== 'string' || !x.d.startsWith(`${m}-`) || place == null || of == null || pts == null || !(s > 0)) continue;
    days.push({ d: x.d, s, place, of, pts });
  }
  days.sort((a, b) => (a.d < b.d ? -1 : 1));
  const near: NearRow[] = (o.near as Record<string, unknown>[]).filter((x) => typeof x?.k === 'string' && int(x.pts) != null && int(x.place, 1) != null)
    .map((x) => ({ k: x.k as string, name: typeof x.name === 'string' ? plainName(x.name) : null, fl: typeof x.fl === 'string' ? x.fl : null, pts: x.pts as number, place: x.place as number, me: x.me === true }));
  const a = o.above as Record<string, unknown> | null;
  return {
    m, k, pts: int(o.pts) ?? 0, place: int(o.place, 1), of: int(o.of) ?? 0, wins: int(o.wins) ?? 0, podiums: int(o.podiums) ?? 0, sailed: int(o.sailed) ?? 0,
    days, near, above: a && int(a.place, 1) != null && int(a.pts) != null ? { place: a.place as number, pts: a.pts as number } : null,
  };
}

// null when it can't be had (the API is down): the page says so rather than showing no days
export async function getPlayerMonth(m: string, k: string): Promise<PlayerMonth | null> {
  try {
    const r = await fetch(monthUrl(m, k), { next: { revalidate: 300 }, signal: AbortSignal.timeout(6000) });
    return r.ok ? readPlayerMonth(await r.json(), m, k) : null;
  } catch {
    return null;
  }
}
