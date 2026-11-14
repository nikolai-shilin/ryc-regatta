import { dailyRace, dailyVenue, type XZ } from './race.ts'; // with their extensions, so npm test's Node finds them too
import { venueOf, type VenueId } from './venues.ts';

// The finish of a race as it was the moment you crossed the line, for the scene behind the result page
// (public/boat-view?finish=1): the race's settings, its course and where it lay at the venue, and every boat where she
// was, her heading and how she sailed. The game keeps that moment with the result (main.js, finishScene); a race kept
// before it did has only the boats' tracks, so each boat is put where her track had her at your finishing time.

// how a boat sailed at that moment, as the game keeps it
export type Pose = { x: number; z: number; h: number; twa?: number; awa?: number; heel?: number; sail?: number; kite?: number; kiteFill?: number; boom?: number; v?: number; done?: number };
type Boat = { name: string | null; me: boolean; done: boolean; dsq: boolean; secs: number | null; track: XZ[]; at?: Pose };
type Course = { windward: XZ; gate: XZ[]; pin: XZ; committee: XZ; legs: string[]; wing?: XZ; type?: 'tri' };
export type FinishResult = {
  daily: string | null; preset: 'light' | 'medium' | 'strong'; length: string; laps: number; start: number; current: boolean;
  course: Course; boats: Boat[]; venue?: string; origin?: XZ; seed?: number | null;
};
export type FinishScene = {
  race: { preset: string; length: string; laps: number; start: number; current: boolean; course: Course; origin: XZ | null; seed: number | null };
  boats: (Pose & { name: string | null; me: boolean })[];
};

// the daily race's day, as a date (its day is the UTC date)
const dayOf = (d: string) => new Date(d + 'T12:00:00Z');

// where the race was sailed: as the game says, else the day's venue for a daily race, else the one given
export function raceVenue(r: FinishResult, fallback: VenueId = 'gocek'): VenueId {
  if (r.venue) return venueOf(r.venue).id;
  if (r.daily) return dailyVenue(dayOf(r.daily));
  return fallback;
}

// the game records a boat's position about once a second (every 61 steps of 1/60 s) from the first warning signal's
// lead-in, and once more as she finishes; the result keeps at most some 160 of them, every k-th and the last
const TICK = 61 / 60;
const clock0 = (start: number) => (start === 5 ? -300 - 8 : start === 3 ? -180 - 8 : -60 - 4);

// where a track had its boat at time T (race clock, s), and her heading then (the game's: 0 north, forward (sin, −cos))
function along(tr: XZ[], end: number | null, start: number, T: number): Pose | null {
  const n = tr.length;
  if (!n) return null;
  if (n === 1) return { x: tr[0][0], z: tr[0][1], h: 0 };
  const c0 = clock0(start);
  const N = end != null ? Math.round((end - c0) / TICK) : n, k = Math.max(1, Math.ceil(N / 160));
  const time = (i: number) => (i === n - 1 && end != null ? end : c0 + (i * k + 1) * TICK);
  const head = (a: XZ, b: XZ) => Math.atan2(b[0] - a[0], -(b[1] - a[1]));
  if (T >= time(n - 1)) {
    // she finished before you: on beyond the line, as she kept sailing (at some 3 m/s, off the wind)
    const h = head(tr[n - 2], tr[n - 1]), d = Math.min(90, (T - time(n - 1)) * 3);
    return { x: tr[n - 1][0] + Math.sin(h) * d, z: tr[n - 1][1] - Math.cos(h) * d, h };
  }
  let i = 0;
  while (i < n - 2 && time(i + 1) < T) i++;
  const f = Math.max(0, Math.min(1, (T - time(i)) / (time(i + 1) - time(i) || 1)));
  return { x: tr[i][0] + (tr[i + 1][0] - tr[i][0]) * f, z: tr[i][1] + (tr[i + 1][1] - tr[i][1]) * f, h: head(tr[i], tr[i + 1]) };
}

export function finishScene(r: FinishResult): FinishScene {
  const me = r.boats.find((b) => b.me);
  const T = me?.secs ?? null;
  const boats: FinishScene['boats'] = [];
  for (const b of r.boats) {
    const p = b.at ?? (b.me ? along(b.track, b.secs, r.start, b.secs ?? Infinity) : T != null ? along(b.track, b.secs, r.start, T) : null);
    if (p) boats.push({ ...p, name: b.name, me: b.me });
  }
  const seed = r.seed ?? (r.daily ? dailyRace(dayOf(r.daily)).seed : null);
  return {
    race: { preset: r.preset, length: r.length, laps: r.laps, start: r.start, current: !!r.current, course: r.course, origin: r.origin ?? null, seed },
    boats,
  };
}

// the boats either side of you at the line: the one that crossed just before you and the one just after, and by how much
export function neighbours(r: FinishResult) {
  const me = r.boats.find((b) => b.me);
  if (!me || me.secs == null) return { ahead: null, behind: null };
  const timed = r.boats.filter((b) => !b.me && b.secs != null) as (Boat & { secs: number })[];
  const ahead = timed.filter((b) => b.secs <= me.secs!).sort((a, b) => b.secs - a.secs)[0];
  const behind = timed.filter((b) => b.secs > me.secs!).sort((a, b) => a.secs - b.secs)[0];
  return {
    ahead: ahead ? { name: ahead.name || '', gap: me.secs - ahead.secs } : null,
    behind: behind ? { name: behind.name || '', gap: behind.secs - me.secs } : null,
  };
}
