// The 1-on-1 tab of your player card (release 7d of the 1-on-1 plan; components/player-tabs.tsx), from the database's
// regatta_my_duels() (iyt-test supabase/migrations/20261122050000_regatta_my_duels.sql), which answers for the
// session's sailor alone: every 1-on-1 they finished, the latest first, and their rivals, the most met first. Here: the
// answer checked, and the races grouped by month.
import { plainName } from './name.ts'; // with its extension, so npm test's Node finds it too

export type DuelRace = { at: string; them: string | null; won: boolean | null; margin: number | null; forfeit: boolean; delta: number | null; venue: string | null; yacht: string | null };
export type Rival = { name: string | null; met: number; wins: number; losses: number; rating: number | null; races: number | null };
export type MyDuels = { races: DuelRace[]; rivals: Rival[] };

const int = (v: unknown) => (Number.isInteger(v) ? (v as number) : null);
export function parseMyDuels(j: unknown): MyDuels | null {
  const o = j as { races?: unknown; rivals?: unknown } | null;
  if (!o || typeof o !== 'object' || !Array.isArray(o.races) || !Array.isArray(o.rivals)) return null;
  const races: DuelRace[] = (o.races as Record<string, unknown>[]).filter((r) => typeof r?.at === 'string' && Number.isFinite(Date.parse(r.at))).map((r) => ({
    at: r.at as string, them: typeof r.them === 'string' ? plainName(r.them) : null, won: typeof r.won === 'boolean' ? r.won : null,
    margin: typeof r.margin === 'number' && Number.isFinite(r.margin) ? r.margin : null, forfeit: r.forfeit === true, delta: int(r.delta),
    venue: typeof r.venue === 'string' ? r.venue : null, yacht: typeof r.yacht === 'string' ? r.yacht : null,
  }));
  races.sort((a, b) => (a.at < b.at ? 1 : -1));
  const rivals: Rival[] = (o.rivals as Record<string, unknown>[]).filter((r) => int(r?.met) != null && int(r?.wins) != null).map((r) => ({
    name: typeof r.name === 'string' ? plainName(r.name) : null, met: r.met as number, wins: r.wins as number, losses: int(r.losses) ?? (r.met as number) - (r.wins as number),
    rating: int(r.rating), races: int(r.races),
  }));
  return { races, rivals };
}

// the races by month (UTC), the latest month first: each month's races, its record and the rating's change in it
export type Month = { m: string; races: DuelRace[]; wins: number; losses: number; delta: number };
export function byMonth(races: DuelRace[]): Month[] {
  const out = new Map<string, Month>();
  for (const r of races) {
    const m = r.at.slice(0, 7), x = out.get(m) ?? { m, races: [], wins: 0, losses: 0, delta: 0 };
    x.races.push(r);
    if (r.won === true) x.wins++; else if (r.won === false) x.losses++;
    x.delta += r.delta ?? 0;
    out.set(m, x);
  }
  return [...out.values()].sort((a, b) => (a.m < b.m ? 1 : -1));
}
