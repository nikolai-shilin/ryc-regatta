// A sailor's history on their card's overview (release 8a of the 1-on-1 plan; components/player-history.tsx): every
// day of today's race they ranked on, every 1-on-1 they finished and every achievement, month by month, the latest
// first, each month with its sum; and their best of: the best place in today's race, the biggest 1-on-1 win, the
// longest streak, the longest run of 1-on-1 wins and the venue sailed most. Pure, from what the card already reads:
// the scores API's months (lib/player-month.ts), your 1-on-1 races (lib/my-duels.ts) and achievements
// (lib/achievements.ts), this device's log (lib/log.ts) and the card's venue counts.
import type { MonthDay } from './player-month.ts'; // with their extensions, so npm test's Node finds them too
import type { DuelRace } from './my-duels.ts';
import type { Got } from './achievements.ts';

export type Entry =
  | { kind: 'day'; at: string; day: MonthDay }
  | { kind: 'duel'; at: string; race: DuelRace }
  | { kind: 'ach'; at: string; got: Got };
export type Month = { m: string; entries: Entry[]; days: number; pts: number; wins: number; losses: number; delta: number; got: number };

// everything by month (UTC), the latest first, and within a month the latest first (on one day: the achievement, the
// 1-on-1, the day's race, as they happen to end it)
export function byMonth({ days = [], duels = [], got = [] }: { days?: MonthDay[]; duels?: DuelRace[]; got?: Got[] }): Month[] {
  const entries: Entry[] = [
    ...days.map((d): Entry => ({ kind: 'day', at: `${d.d}T12:00:00Z`, day: d })),
    ...duels.map((r): Entry => ({ kind: 'duel', at: r.at, race: r })),
    ...got.map((g): Entry => ({ kind: 'ach', at: g.at, got: g })),
  ];
  const out = new Map<string, Month>();
  for (const e of entries) {
    const m = e.at.slice(0, 7), x = out.get(m) ?? { m, entries: [], days: 0, pts: 0, wins: 0, losses: 0, delta: 0, got: 0 };
    x.entries.push(e);
    if (e.kind === 'day') { x.days++; x.pts += e.day.pts; }
    else if (e.kind === 'duel') { if (e.race.won === true) x.wins++; else if (e.race.won === false) x.losses++; x.delta += e.race.delta ?? 0; }
    else x.got++;
    out.set(m, x);
  }
  const rank = { ach: 0, duel: 1, day: 2 } as const;
  for (const x of out.values()) x.entries.sort((a, b) => (a.at.slice(0, 10) !== b.at.slice(0, 10) ? (a.at < b.at ? 1 : -1) : rank[a.kind] - rank[b.kind] || (a.at < b.at ? 1 : -1)));
  return [...out.values()].sort((a, b) => (a.m < b.m ? 1 : -1));
}

// the longest streak in a log's days, counted as the site counts a streak (one day missed doesn't break it, two in a row
// do): how many days, and the last of them
export function longestStreak(days: string[]): { n: number; end: string } | null {
  const ds = [...new Set(days)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  let best: { n: number; end: string } | null = null, n = 0, prev = '';
  for (const d of ds) {
    n = prev && (Date.parse(d) - Date.parse(prev)) / 864e5 <= 2 ? n + 1 : 1;
    if (!best || n > best.n) best = { n, end: d };
    prev = d;
  }
  return best;
}

export type Best = {
  place: MonthDay | null; // the best place in today's race (the higher share of the field beaten when equal)
  win: DuelRace | null; // the 1-on-1 win that moved the rating most
  streak: { n: number; end: string } | null; run: number; // the longest streak; the most 1-on-1 wins in a row
  venue: { id: string; n: number } | null; // the venue sailed most
};
export function bestOf({ days = [], duels = [], logDays = [], venues = [] }: { days?: MonthDay[]; duels?: DuelRace[]; logDays?: string[]; venues?: { id: string; n: number }[] }): Best {
  const place = days.reduce<MonthDay | null>((a, d) => (!a || d.place < a.place || (d.place === a.place && d.of > a.of) ? d : a), null);
  const win = duels.filter((r) => r.won === true && r.delta != null && r.delta > 0).reduce<DuelRace | null>((a, r) => (!a || r.delta! > a.delta! ? r : a), null);
  let run = 0, cur = 0;
  for (const r of [...duels].sort((a, b) => (a.at < b.at ? -1 : 1))) { cur = r.won === true ? cur + 1 : 0; run = Math.max(run, cur); }
  const venue = venues.reduce<{ id: string; n: number } | null>((a, v) => (!a || v.n > a.n ? v : a), null);
  return { place, win, streak: longestStreak(logDays), run, venue };
}
