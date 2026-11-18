import { CODE_RE } from '@/lib/code';
import { VENUES } from '@/lib/venues';
import { YACHTS } from '@/lib/yachts';
import { noEmoji } from '@/lib/name';

// What the 1-on-1 race's game reports to POST /connect/log (app/connect/log/route.ts), checked before it reaches the
// database: the database casts these to smallint and int, so a number out of range would raise there and lose the
// report. parseReport answers the report as the site understands it, or null for anything that is not exactly one of the
// three. toRow makes the p_report of regatta_duel_log from it.
//
// The settings' lists are those of cleanSettings in public/game/match.js; a name is cleaned as `clean` in
// public/game/match-ui.js does it.

export type Settings = { venue: string; yacht: string; preset: string; length: string; course: string; laps: number; start: number; current: number; daytime: string };
export type Result = { place: number | null; secs: number | null; mark: 'DSQ' | 'DNF' | null; pens: number | null };
export type Side = 'host' | 'guest';
export type Report =
  | { kind: 'start'; code: string; seed: number; token: string; host: string; guest: string; settings: Settings }
  | { kind: 'join'; code: string; seed: number; name: string }
  | { kind: 'end'; code: string; seed: number; token: string; state: 'finished' | 'abandoned'; winner: Side | null; margin: number | null; forfeited: Side | null;
      recalls: number | null; prep: 'P' | 'U' | 'B' | null; host: Result; guest: Result };

const CHOICES = { preset: ['medium', 'light', 'strong'], length: ['short', 'medium', 'long'], course: ['wl', 'tri', 'trap', 'wlu'], laps: [1, 2], start: [1, 3, 5], current: [0, 1],
  daytime: ['any', 'morning', 'midday', 'afternoon', 'evening', 'sunset'] } as const;
const VENUE_IDS: string[] = VENUES.map((v) => v.id);
const YACHT_IDS: string[] = YACHTS.map((y) => y.id);
const MAX_SECS = 86400;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const int = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const span = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_SECS;
const oneOf = <T extends string>(v: unknown, list: readonly T[]): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);

// a name: no control characters, no < or >, no emoji, whitespace collapsed, 16 characters at most; '' when nothing is left.
// Cut by characters, not UTF-16 units, so a pair is never split (a lone half is not valid JSON for the database).
export const cleanName = (v: unknown): string =>
  typeof v === 'string' ? [...noEmoji(v.replace(/[\u0000-\u001f\u007f<>]/g, ''))].slice(0, 16).join('').trim() : '';

function settingsOf(s: unknown): Settings | null {
  if (!isObj(s) || !oneOf(s.venue, VENUE_IDS) || !oneOf(s.yacht, YACHT_IDS)) return null;
  for (const [k, list] of Object.entries(CHOICES)) if (!(list as readonly unknown[]).includes(s[k])) return null;
  return s as Settings;
}

function resultOf(r: unknown): Result | null {
  if (!isObj(r)) return null;
  const { place, secs, mark, pens } = r;
  if (!(place === null || int(place, 1, 2)) || !(secs === null || span(secs)) || !(mark === null || mark === 'DSQ' || mark === 'DNF') || !(pens === null || int(pens, 0, 99))) return null;
  return { place, secs, mark, pens } as Result;
}

export function parseReport(body: unknown): Report | null {
  if (!isObj(body)) return null;
  const { kind, code, seed } = body;
  if (typeof code !== 'string' || !CODE_RE.test(code) || !int(seed, 0, 100000)) return null;
  if (kind === 'join') {
    const name = cleanName(body.name);
    return name ? { kind, code, seed, name } : null;
  }
  if (kind !== 'start' && kind !== 'end') return null;
  const token = body.token;
  if (typeof token !== 'string' || !/^[0-9a-f]{32,64}$/i.test(token)) return null;
  if (kind === 'start') {
    const host = cleanName(body.host), guest = cleanName(body.guest), settings = settingsOf(body.settings);
    return host && guest && settings ? { kind, code, seed, token, host, guest, settings } : null;
  }
  const { state, winner, forfeited, margin, recalls, prep } = body;
  if (state !== 'finished' && state !== 'abandoned') return null;
  if (!(winner === null || winner === 'host' || winner === 'guest') || !(forfeited === null || forfeited === 'host' || forfeited === 'guest')) return null;
  if (!(margin === null || span(margin)) || !(recalls === null || int(recalls, 0, 9)) || !(prep === null || oneOf(prep, ['P', 'U', 'B'] as const))) return null;
  const host = resultOf(body.host), guest = resultOf(body.guest);
  return host && guest ? { kind, code, seed, token, state, winner, margin, forfeited, recalls, prep, host, guest } : null;
}

// The p_report of regatta_duel_log. userId is the account the session names (never one the body names); hash is the
// SHA-256 of the write token, which is never sent on.
export function toRow(r: Report, userId: string | null, hash: string | null): object {
  if (r.kind === 'join') return { kind: 'join', code: r.code, seed: r.seed, guest_user: userId, guest_name: r.name };
  if (r.kind === 'start') {
    const s = r.settings;
    return { kind: 'start', code: r.code, seed: r.seed, write_hash: hash, host_user: userId, host_name: r.host, guest_name: r.guest, venue: s.venue, yacht: s.yacht, wind: s.preset,
      length: s.length, course: s.course, laps: s.laps, start_min: s.start, current: s.current === 1, daytime: s.daytime };
  }
  const side = (x: Result) => ({ place: x.place, secs: x.secs, mark: x.mark, pens: x.pens });
  return { kind: 'end', code: r.code, seed: r.seed, write_hash: hash, state: r.state, winner: r.winner, margin: r.margin, forfeited: r.forfeited, recalls: r.recalls, prep_flag: r.prep,
    host: side(r.host), guest: side(r.guest) };
}
