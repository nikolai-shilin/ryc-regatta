import { CODE_RE } from '@/lib/code';
import { VENUES } from '@/lib/venues';
import { YACHTS } from '@/lib/yachts';
import { noEmoji } from '@/lib/name';

// What the 1-on-1 race's game reports to POST /connect/log (app/connect/log/route.ts), checked before it reaches the
// database: the database casts these to smallint and int, so a number out of range would raise there and lose the
// report. parseReport answers the report as the site understands it, or null for anything that is not exactly one of the
// five (an invite, a start, a join, an end, a perf). toRow makes the p_report of regatta_duel_log from it.
//
// Both screens report the end: the host's with the write token it sent with the start, the guest's (side 'guest') with the
// token she sent with her join. The database keeps the host's as the race's result and the guest's beside it, and a race
// whose two ends name the same state and winner is agreed (a race of two accounts, agreed, is one the rating may count).
//
// The settings' lists are those of cleanSettings in public/game/match.js; a name is cleaned as `clean` in
// public/game/match-ui.js does it.

export type Settings = { venue: string; yacht: string; preset: string; length: string; course: string; laps: number; start: number; current: number; daytime: string };
export type Result = { place: number | null; secs: number | null; mark: 'DSQ' | 'DNF' | null; pens: number | null };
export type Side = 'host' | 'guest';
export type Report =
  | { kind: 'start'; code: string; seed: number; token: string; host: string; guest: string; settings: Settings }
  | { kind: 'join'; code: string; seed: number; name: string; token: string | null }
  | { kind: 'end'; code: string; seed: number; token: string; side: Side; state: 'finished' | 'abandoned'; winner: Side | null; margin: number | null; forfeited: Side | null;
      recalls: number | null; prep: 'P' | 'I' | 'U' | 'B' | null; gun: boolean | null; left: Side | null; host: Result; guest: Result }
  | { kind: 'perf'; code: string; seed: number; side: Side; perf: Perf }
  | { kind: 'invite'; code: string; host: string; settings: Settings };

// How the race ran on one screen, as the game's stats.js perfSummary and match.js net() measure it: the middle frame's
// rate (fps) and the slow end's (low, the 95th percentile frame), stalls over 100 ms a minute, seconds measured, the
// graphics level at the start and the end and the setting, the battery saver, the resolution below Low at the end (rs, 1: none), the device, and how the other screen's
// messages came (rtt: the least way there and back, ms, measured on the guest's screen alone; late: messages more than
// 250 ms past their due, a minute). fps and secs must be good; any other field that isn't is kept as null.
export type Perf = {
  fps: number; low: number | null; stall: number | null; secs: number; q0: string | null; q: string | null; gfx: string | null; saver: 0 | 1; rs: number | null;
  dev: string | null; tg: 0 | 1; os: string | null; br: string | null; dpr: number | null; cores: number | null; mem: number | null; gpu: string | null;
  w: number | null; h: number | null; net: { rtt: number | null; late: number | null } | null;
};

const CHOICES = { preset: ['medium', 'light', 'strong'], length: ['short', 'medium', 'long'], course: ['wl', 'tri', 'trap', 'wlu'], laps: [1, 2], start: [1, 3, 5], current: [0, 1],
  daytime: ['any', 'morning', 'midday', 'afternoon', 'evening', 'sunset'] } as const;
const VENUE_IDS: string[] = VENUES.map((v) => v.id);
const YACHT_IDS: string[] = YACHTS.map((y) => y.id);
const MAX_SECS = 86400;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const int = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const span = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_SECS;
const isToken = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{32,64}$/i.test(v);
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

const LEVELS = ['high', 'medium', 'low', 'custom'] as const, SETS = ['auto', 'high', 'medium', 'low', 'custom'] as const;
const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? Math.round(v * 100) / 100 : null);
const whole = (v: unknown, lo: number, hi: number) => (int(v, lo, hi) ? v : null);
const word = (v: unknown) => (typeof v === 'string' && /^[a-z0-9_-]{1,16}$/.test(v) ? v : null);
const pick = <T extends string>(v: unknown, list: readonly T[]) => (oneOf(v, list) ? v : null);
function perfOf(p: unknown): Perf | null {
  if (!isObj(p)) return null;
  const fps = num(p.fps, 0, 1000), secs = whole(p.secs, 0, MAX_SECS);
  if (fps === null || secs === null) return null;
  const n = isObj(p.net) ? p.net : null;
  return {
    fps, low: num(p.low, 0, 1000), stall: num(p.stall, 0, 10000), secs, q0: pick(p.q0, LEVELS), q: pick(p.q, LEVELS), gfx: pick(p.gfx, SETS), saver: p.saver === 1 ? 1 : 0, rs: num(p.rs, 0.25, 1),
    dev: pick(p.dev, ['phone', 'tablet', 'desktop'] as const), tg: p.tg === 1 ? 1 : 0, os: word(p.os), br: word(p.br), dpr: num(p.dpr, 0.25, 8),
    cores: whole(p.cores, 1, 1024), mem: num(p.mem, 0, 1024), gpu: typeof p.gpu === 'string' && /^[\w ()+\-.,/:]{1,60}$/.test(p.gpu) ? p.gpu : null,
    w: whole(p.w, 1, 20000), h: whole(p.h, 1, 20000), net: n && { rtt: whole(n.rtt, 0, 60000), late: num(n.late, 0, 10000) },
  };
}

export function parseReport(body: unknown): Report | null {
  if (!isObj(body)) return null;
  const { kind, code, seed } = body;
  if (kind === 'invite') { // (a link, before any race: no seed)
    const host = typeof code === 'string' && CODE_RE.test(code) ? cleanName(body.host) : '', settings = settingsOf(body.settings);
    return host && settings ? { kind, code: code as string, host, settings } : null;
  }
  if (typeof code !== 'string' || !CODE_RE.test(code) || !int(seed, 0, 100000)) return null;
  if (kind === 'join') {
    // her token, the proof that her end is hers (a build before it sends none)
    const name = cleanName(body.name), token = body.token ?? null;
    if (!(token === null || isToken(token))) return null;
    return name ? { kind, code, seed, name, token } : null;
  }
  if (kind === 'perf') {
    const side = body.side, perf = perfOf(body.perf);
    return (side === 'host' || side === 'guest') && perf ? { kind, code, seed, side, perf } : null;
  }
  if (kind !== 'start' && kind !== 'end') return null;
  const token = body.token;
  if (!isToken(token)) return null;
  if (kind === 'start') {
    const host = cleanName(body.host), guest = cleanName(body.guest), settings = settingsOf(body.settings);
    return host && guest && settings ? { kind, code, seed, token, host, guest, settings } : null;
  }
  const { state, winner, forfeited, margin, recalls, prep } = body;
  const side = body.side ?? 'host', gun = body.gun ?? null, left = body.left ?? null; // (a build before them sends none: the host's, the gun and who left unknown)
  if (state !== 'finished' && state !== 'abandoned') return null;
  if (side !== 'host' && side !== 'guest') return null;
  if (!(gun === null || typeof gun === 'boolean')) return null;
  if (!(left === null || left === 'host' || left === 'guest')) return null;
  if (!(winner === null || winner === 'host' || winner === 'guest') || !(forfeited === null || forfeited === 'host' || forfeited === 'guest')) return null;
  if (!(margin === null || span(margin)) || !(recalls === null || int(recalls, 0, 9)) || !(prep === null || oneOf(prep, ['P', 'I', 'U', 'B'] as const))) return null;
  const host = resultOf(body.host), guest = resultOf(body.guest);
  return host && guest ? { kind, code, seed, token, side, state, winner, margin, forfeited, recalls, prep, gun, left, host, guest } : null;
}

// The p_report of regatta_duel_log. userId is the account the session names (never one the body names); hash is the
// SHA-256 of the report's token (the host's write token, or the guest's), which is never sent on.
export function toRow(r: Report, userId: string | null, hash: string | null): object {
  if (r.kind === 'join') return { kind: 'join', code: r.code, seed: r.seed, guest_user: userId, guest_name: r.name, guest_hash: hash };
  if (r.kind === 'invite') {
    const s = r.settings;
    return { kind: 'invite', code: r.code, host_user: userId, host_name: r.host, venue: s.venue, yacht: s.yacht, wind: s.preset, length: s.length,
      course: s.course, laps: s.laps, start_min: s.start, current: s.current === 1, daytime: s.daytime };
  }
  if (r.kind === 'perf') return { kind: 'perf', code: r.code, seed: r.seed, side: r.side, perf: r.perf };
  if (r.kind === 'start') {
    const s = r.settings;
    return { kind: 'start', code: r.code, seed: r.seed, write_hash: hash, host_user: userId, host_name: r.host, guest_name: r.guest, venue: s.venue, yacht: s.yacht, wind: s.preset,
      length: s.length, course: s.course, laps: s.laps, start_min: s.start, current: s.current === 1, daytime: s.daytime };
  }
  const side = (x: Result) => ({ place: x.place, secs: x.secs, mark: x.mark, pens: x.pens });
  return { kind: 'end', side: r.side, code: r.code, seed: r.seed, write_hash: hash, state: r.state, winner: r.winner, margin: r.margin, forfeited: r.forfeited, recalls: r.recalls, prep_flag: r.prep,
    gun: r.gun, left: r.left, host: side(r.host), guest: side(r.guest) };
}
