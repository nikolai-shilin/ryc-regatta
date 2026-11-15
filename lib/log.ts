import { dailyVenue } from './race.ts'; // with their extensions, so npm test's Node finds them too
import { VENUES, venueOf } from './venues.ts';

// The player's log, kept for good: the days they finished today's race (with their best time that day) and the venues
// they have raced at (with when they first did). The game itself keeps a day's best only a week (regatta-pb) and the
// last twenty results (regatta-result-<id>), so the pages gather both into this on every visit (harvest), and for a
// signed-in player components/bests-sync.tsx merges it with the account's copy (user_metadata.log), as the bests are.
// From it: the venue passport (the venues raced, of all of them), the streak (days in a row), your month on the rating.
//
// localStorage regatta-log: { d: { 'YYYY-MM-DD': best seconds }, v: { venue id: first raced, ms } }
export const LOG_KEY = 'regatta-log';
export const LOG_EVENT = 'regatta-log'; // fired when the account's log has just been merged into this device's
export type Log = { d: Record<string, number>; v: Record<string, number> };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ids = new Set<string>(VENUES.map((v) => v.id));

// a log as stored or as the account holds it, with anything malformed left out
export function cleanLog(x: unknown): Log {
  const out: Log = { d: {}, v: {} };
  if (!x || typeof x !== 'object') return out;
  const { d, v } = x as { d?: unknown; v?: unknown };
  if (d && typeof d === 'object') for (const [k, s] of Object.entries(d)) if (DAY.test(k) && typeof s === 'number' && s > 0) out.d[k] = s;
  if (v && typeof v === 'object') for (const [k, t] of Object.entries(v)) if (ids.has(k) && typeof t === 'number' && t > 0) out.v[k] = t;
  return out;
}

// two logs as one: every day either has, at the faster time; every venue, at the earlier first race
export function mergeLog(a: Log, b: Log): Log {
  const out: Log = { d: { ...a.d }, v: { ...a.v } };
  for (const [k, s] of Object.entries(b.d)) if (!(out.d[k] <= s)) out.d[k] = s;
  for (const [k, t] of Object.entries(b.v)) if (!(out.v[k] <= t)) out.v[k] = t;
  return out;
}
export const sameLog = (a: Log, b: Log) => JSON.stringify(sortLog(a)) === JSON.stringify(sortLog(b));
const sortLog = (l: Log) => ({ d: Object.entries(l.d).sort(), v: Object.entries(l.v).sort() });

// a finished race, into the log: a day of today's race at the time, and its venue at when it was sailed
export function addDay(l: Log, day: string, secs: number) {
  if (!DAY.test(day) || !(secs > 0)) return;
  if (!(l.d[day] <= secs)) l.d[day] = secs;
  // the venue's stamp: when it was sailed isn't known from a best alone, so the day's end (a result of that day,
  // which knows its time, is earlier and wins)
  stamp(l, dailyVenue(new Date(day + 'T12:00:00Z')), Date.parse(day + 'T23:59:59Z'));
}
export function stamp(l: Log, venue: string, at: number) {
  if (ids.has(venue) && at > 0 && !(l.v[venue] <= at)) l.v[venue] = at;
}

// what the game keeps of a finished race, as far as the log reads it
type Kept = { at?: number; daily?: string | null; venue?: string; boats?: { me?: boolean; done?: boolean; dsq?: boolean; secs?: number | null }[] };
export function addResult(l: Log, r: Kept) {
  const me = r?.boats?.find((b) => b.me);
  if (!me || !me.done || me.dsq || me.secs == null) return;
  if (r.daily) addDay(l, r.daily, me.secs);
  const venue = r.venue ? venueOf(r.venue).id : r.daily ? dailyVenue(new Date(r.daily + 'T12:00:00Z')) : null;
  if (venue && r.at) stamp(l, venue, r.at);
}

const read = (k: string) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
export const readLog = (): Log => cleanLog(read(LOG_KEY));
export function saveLog(l: Log) { try { localStorage.setItem(LOG_KEY, JSON.stringify(l)); } catch {} }

// the log, with everything this device's game keeps gathered in: the week's daily bests and the results it holds
export function harvest(): Log {
  const was = readLog(), l = mergeLog(was, { d: {}, v: {} });
  const pb = read('regatta-pb');
  if (pb && typeof pb === 'object') for (const [k, s] of Object.entries(pb)) if (k.startsWith('daily|') && typeof s === 'number') addDay(l, k.slice(6), s);
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('regatta-result-')) addResult(l, read(k));
    }
  } catch {}
  if (!sameLog(l, was)) saveLog(l);
  return l;
}

// the date n days from a day (UTC), and today's (the daily race's day is the UTC date)
export const shiftDay = (d: string, n: number) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
export const todayUtc = () => new Date().toISOString().slice(0, 10);

// The streak: the days of today's race finished in a row, back from today (or from yesterday, while today's is still
// to sail). One day missed doesn't break it, two in a row do. n: the days finished in it; today: today's is in it;
// risk: yesterday was missed, so today's is needed to keep it.
export function streakOf(days: Record<string, number> | string[], today = todayUtc()) {
  const has = new Set(Array.isArray(days) ? days : Object.keys(days));
  const inToday = has.has(today);
  let d = inToday ? today : shiftDay(today, -1), n = 0, miss = 0;
  for (let i = 0; i < 2000; i++, d = shiftDay(d, -1)) {
    if (has.has(d)) { n++; miss = 0; } else if (++miss >= 2 || !n && i > 1) break;
  }
  return { n, today: inToday, risk: n > 0 && !inToday && !has.has(shiftDay(today, -1)) };
}

// the passport: the venues raced, in the venues' order, and how many there are
export function passport(l: Log) {
  const raced = VENUES.filter((v) => l.v[v.id]).map((v) => v.id);
  return { raced: new Set<string>(raced), n: raced.length, of: VENUES.length };
}
