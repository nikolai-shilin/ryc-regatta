// Today's race and the race options, as the game has them (public/game/sim.js: dailyRace and the option values;
// classes.js: dailyYacht).
// The same date gives the same race on the hub and in the game.
import { VENUES, type VenueId } from './venues.ts'; // with its extension, so npm test's Node finds it too
import type { YachtId } from './yachts.ts';

function rng(seed: number) {
  // exactly as sim.js, signed shift included, so the numbers match the game's
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

export type Wind = 'light' | 'medium' | 'strong';
export type Length = 'short' | 'medium' | 'long';
export type Shape = 'wl' | 'tri' | 'trap' | 'wlu';
export type Daily = { day: string; seed: number; preset: Wind; fleet: number; length: Length; laps: number; start: number; current: number; course: Shape; venue: VenueId; yacht: YachtId };

// today's venue, as public/game/venues.js dailyVenue: the days go round all the venues in a shuffled order, a venue
// added later (`from`) among them from its day, the days before going round the ones there were then
const dayN = (s: string) => Math.floor(Date.parse(s) / 864e5);
const ROUNDS = [0, ...new Set(VENUES.filter((v) => v.from).map((v) => dayN(v.from!)))].sort((a, b) => a - b)
  .map((n0) => ({ n0, ids: VENUES.filter((v) => !v.from || dayN(v.from) <= n0).map((v) => v.id) }));
function round(ids: VenueId[], k: number) {
  const a = ids.slice(), r = rng((k + 1) * 40503 + 977);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function venueOn(n: number): VenueId {
  let e = ROUNDS.length - 1; while (e > 0 && n < ROUNDS[e].n0) e--;
  const { n0, ids } = ROUNDS[e], len = ids.length, k = Math.floor((n - n0) / len), a = round(ids, k);
  if (a[0] === (k > 0 || e === 0 ? round(ids, k - 1)[len - 1] : venueOn(n0 - 1))) [a[0], a[1]] = [a[1], a[0]];
  return a[n - n0 - k * len];
}
export const dailyVenue = (date = new Date()): VenueId => venueOn(Math.floor(Date.parse(date.toISOString().slice(0, 10)) / 864e5));

// today's yacht, as public/game/classes.js dailyYacht: from the day each joins today's races (DAILY_YACHTS) the days go
// round them in a shuffled order, never the same two days running; the days before the first joined, the JPK 1050
// (the Dragon and the Optimist from 17 November, the AC75 and the J Class from 18 November; the scores server checks the AC75's and
// the Optimist's times against their own share of its floor; every class sails them from then on)
export const DAILY_YACHTS: Partial<Record<YachtId, string>> = { jpk1050: '2026-11-16', bavaria46: '2026-11-16', j70: '2026-11-16', rs21: '2026-11-16', laser: '2026-11-16', dragon: '2026-11-17', optimist: '2026-11-17', ac75: '2026-11-18', jclass: '2026-11-18' };
const YACHT_ROUNDS = [...new Set(Object.values(DAILY_YACHTS).map((s) => dayN(s!)))].sort((a, b) => a - b)
  .map((n0) => ({ n0, ids: (Object.keys(DAILY_YACHTS) as YachtId[]).filter((id) => dayN(DAILY_YACHTS[id]!) <= n0) }));
function yachtRound(ids: YachtId[], k: number) {
  const a = ids.slice(), r = rng((k + 1) * 69069 + 4111);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function yachtOn(n: number): YachtId {
  if (n < YACHT_ROUNDS[0].n0) return 'jpk1050';
  let e = YACHT_ROUNDS.length - 1; while (e > 0 && n < YACHT_ROUNDS[e].n0) e--;
  const { n0, ids } = YACHT_ROUNDS[e], len = ids.length, k = Math.floor((n - n0) / len), a = yachtRound(ids, k);
  if (len > 1 && a[0] === (k > 0 ? yachtRound(ids, k - 1)[len - 1] : yachtOn(n0 - 1))) [a[0], a[1]] = [a[1], a[0]];
  return a[n - n0 - k * len];
}
export const dailyYacht = (date = new Date()): YachtId => yachtOn(dayN(date.toISOString().slice(0, 10)));

export const SHAPES_FROM = '2026-11-18';
// From SHAPES_FROM today's race goes round the four shapes as it goes round the venues and the yachts: each round of
// four days takes them in an order of its own (shuffled, seeded by the round), and never the same shape two days
// running (where a round would start with the last one's, its first two swap). The days before are all up and down.
const SHAPE_ORDER: Shape[] = ['wl', 'tri', 'trap', 'wlu'];
function shapeRound(k: number): Shape[] {
  let s = ((k + 1) * 48271 + 7) >>> 0 || 1; // a generator of its own, as the venues' and the yachts' rounds
  const r = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const a = SHAPE_ORDER.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function shapeOn(n: number): Shape {
  const n0 = Math.floor(Date.parse(SHAPES_FROM) / 864e5);
  if (n < n0) return 'wl';
  const k = Math.floor((n - n0) / 4), a = shapeRound(k);
  if (a[0] === (k > 0 ? shapeRound(k - 1)[3] : 'wl')) [a[0], a[1]] = [a[1], a[0]];
  return a[n - n0 - k * 4];
}
export function dailyRace(date = new Date()): Daily {
  const day = date.toISOString().slice(0, 10), n = Math.floor(Date.parse(day) / 864e5), r = rng(n * 2654435761);
  r(); r();
  // the draws stay in this order: the wind, the current (the shape's draw after them is no longer used), so the days
  // that came before don't move
  const preset = (['light', 'medium', 'strong'] as const)[Math.floor(r() * 3)], current = r() < 0.3 ? 1 : 0;
  const course: Shape = shapeOn(n);
  return { day, seed: (n * 7919) % 100000, preset, fleet: 5, length: 'short', laps: 1, start: 1, current, course, venue: dailyVenue(date), yacht: dailyYacht(date) };
}

export const KN: Record<Wind, number> = { light: 7, medium: 12, strong: 19 };
// about how long a race takes, start sequence included, in minutes: the free race's set-up and the home page say it.
// Each shape's factor is as the computer boats take it, against up and down.
const SHAPE_TIME: Record<Shape, number> = { wl: 1, tri: 1.3, trap: 1.25, wlu: 1.6 };
// timeK: the yacht's pace against the JPK 1050's (lib/yachts.ts), 1 without one
export const raceMinutes = (p: { preset: Wind; length: Length; laps: number; start: number; course: Shape; timeK?: number }) =>
  Math.round({ short: 4.5, medium: 7, long: 9.5 }[p.length] * p.laps * { light: 1.25, medium: 1, strong: 0.9 }[p.preset] * SHAPE_TIME[p.course] * (p.timeK ?? 1) + p.start);

// The course on the water, in metres, as public/game/sim.js lays it out (makeCourse, Race): x across, z down the wind
// (the wind blows from −z), the start line through z = 0. A planned course has no skew; the game gives each race a
// small random one, which the result page has from the race itself.
export type XZ = [number, number];
// a triangle has a wing mark too, out to the left (sim.js makeCourse); `marks` has every rounding mark by the leg that
// goes to it, and `finish` the finish line's two ends (left, right) when it has one of its own (the trapezoid, and up
// and down with an upwind finish). `type` is optional only for a result saved before the shapes
export type CourseGeo = {
  windward: XZ; gate: XZ[]; pin: XZ; committee: XZ; wing?: XZ;
  marks?: Partial<Record<'mark' | 'wing' | 'mark2' | 'offset', XZ>>; finish?: [XZ, XZ]; type?: Shape;
};
export const COURSE_LEN: Record<Length, number> = { short: 1, medium: 2, long: 3.4 };
export const BEAT_LEN: Record<Wind, number> = { light: 200, medium: 260, strong: 280 };
// the close-hauled angle to the true wind at each preset's wind speed (7, 12 and 19 knots: the JPK 1050's beat, classes.js)
export const BEAT_ANGLE: Record<Wind, number> = { light: 41.5, medium: 39, strong: 39 };

// another class of yacht (lib/yachts.ts) sails a course of her own size, as sim.js lays it (scaleCourse): courseK as
// long, everything across the water lineK as wide
export function plannedCourse(preset: Wind, length: Length, fleet: number, shape: Shape = 'wl', yacht?: { courseK: number; lineK: number }): CourseGeo & { type: Shape } {
  if (!yacht || yacht.lineK === 1) return laid(preset, length, fleet, shape, yacht?.courseK ?? 1);
  const K = yacht.lineK, c = laid(preset, length, fleet, shape, yacht.courseK / K), S = (p: XZ): XZ => [p[0] * K, p[1] * K];
  return { type: c.type, windward: S(c.windward), gate: c.gate.map(S), pin: S(c.pin), committee: S(c.committee),
    marks: Object.fromEntries(Object.entries(c.marks || {}).map(([k, m]) => [k, S(m as XZ)])), ...(c.wing && { wing: S(c.wing) }), ...(c.finish && { finish: [S(c.finish[0]), S(c.finish[1])] as [XZ, XZ] }) };
}
function laid(preset: Wind, length: Length, fleet: number, shape: Shape, k: number): CourseGeo & { type: Shape } {
  const beat = BEAT_LEN[preset] * COURSE_LEN[length] * k, half = Math.max(70, fleet * 10);
  let gate: XZ[] = fleet > 5 ? [[-27, -50], [27, -50]] : [[-22, -45], [22, -45]];
  const windward: XZ = [0, -beat], marks: NonNullable<CourseGeo['marks']> = { mark: windward };
  let wing: XZ | undefined, finish: [XZ, XZ] | undefined;
  if (shape === 'tri') {
    const B = beat + gate[0][1];
    wing = [-0.85 * B, gate[0][1] - 0.85 * B]; marks.wing = wing;
  } else if (shape === 'trap') {
    // the gate level with the start line, out to the left; mark 2 straight up from it, 115 degrees off the wind from mark 1
    const gx = -(1.2 * half + 125), gz = -20;
    marks.mark2 = [gx, -beat + gx / Math.tan(115 * Math.PI / 180)];
    gate = gate.map((g): XZ => [g[0] + gx, gz]);
    finish = [[gx + 50, gz - 20], [gx + 50, gz + 20]];
  } else if (shape === 'wlu') {
    marks.offset = [-55, -beat + 10];
    finish = [[5, -beat + 15], [65, -beat + 15]];
  }
  return { type: shape, windward, gate, pin: [-half, 0], committee: [half, 0], marks, ...(wing && { wing }), ...(finish && { finish }) };
}

export const SHAPE_NAME: Record<Shape, [en: string, ru: string, es?: string, de?: string]> = {
  wl: ['Up and down', 'Апвинд — даунвинд', 'Barlovento–sotavento', 'Luv–Lee'],
  tri: ['Triangle', 'Треугольник', 'Triángulo', 'Dreieck'],
  trap: ['Trapezoid', 'Трапеция', 'Trapecio', 'Trapez'],
  wlu: ['Up and down, upwind finish', 'Апвинд — даунвинд, финиш наверху', 'Barlovento–sotavento, llegada en ceñida', 'Luv–Lee, Ziel am Wind'],
};
export const SHAPES = Object.keys(SHAPE_NAME) as Shape[];
const isShape = (s: unknown): s is Shape => typeof s === 'string' && (SHAPES as string[]).includes(s);
// a course saved in the options: one of the four shapes, else up and down
export const savedShape = (s: unknown): Shape => (isShape(s) ? s : 'wl');
// a course's shape: its `type`, or for a result saved before the shapes, a triangle if it has a wing mark
export const shapeOf = (c: { type?: unknown; wing?: unknown }): Shape => (isShape(c.type) ? c.type : c.wing ? 'tri' : 'wl');
// the key of a free race's best time on this device (public/game/main.js pbKey): each shape but up and down its own
// (and each class of yacht but the JPK 1050 too)
export const pbKey = (o: { preset: Wind; laps: number; length: Length; fleet: number; course: Shape; yacht?: string }) =>
  `${o.preset}|${o.laps}|${o.length}|${o.fleet}${o.course === 'wl' ? '' : '|' + o.course}${o.yacht && o.yacht !== 'jpk1050' ? '|' + o.yacht : ''}`;

const mid = (a: XZ, b: XZ): XZ => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const dist = (a: XZ, b: XZ) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const lineMid = (c: CourseGeo) => mid(c.pin, c.committee);
export const gateMid = (c: CourseGeo) => mid(c.gate[0], c.gate[1]);

// each leg's length mark to mark, in the order the game sails them: the beat to the windward mark, the run to the gate
// (on a triangle the two reaches by the wing mark, on a trapezoid the reach to mark 2 and the run) and back up, and the
// leg to the finish (the middle of the finish line when it has its own, else of the start line)
export function legDistances(c: CourseGeo, legs: string[]): number[] {
  let at: XZ = lineMid(c);
  return legs.map((k) => {
    if (k === 'start') return 0;
    const m = (c.marks as Record<string, XZ | undefined> | undefined)?.[k] ?? (k === 'mark' ? c.windward : k === 'wing' ? c.wing : undefined);
    const to: XZ = m ?? (k === 'gate' ? gateMid(c) : k === 'finish' && c.finish ? mid(c.finish[0], c.finish[1]) : lineMid(c));
    const d = dist(at, to); at = to; return d;
  });
}
export const courseLegs = (laps: number, shape: Shape = 'wl') => {
  const lapsOf = (each: string[], last = each) => Array.from({ length: laps }, (_, i) => (i < laps - 1 ? each : last)).flat();
  if (shape === 'trap') return ['start', 'mark', 'mark2', 'gate', ...Array.from({ length: laps - 1 }, () => ['mark2', 'gate']).flat(), 'finish'];
  if (shape === 'tri') return ['start', ...lapsOf(['mark', 'wing', 'gate'], ['mark', 'wing']), 'finish'];
  if (shape === 'wlu') return ['start', ...lapsOf(['mark', 'offset', 'gate']), 'finish'];
  return ['start', ...lapsOf(['mark', 'gate'], ['mark']), 'finish'];
};
export const courseDistance = (c: CourseGeo, laps: number) =>
  legDistances(c, courseLegs(laps, shapeOf(c))).reduce((a, b) => a + b, 0);

// "520 m · 0.28 nm"
export function fmtDistance(m: number, lang: 'en' | 'ru' | 'es' | 'de') {
  const nm = (m / 1852).toFixed(2), r = Math.round(m / 10) * 10;
  return lang === 'ru' ? `${r} м · ${nm.replace('.', ',')} мили` : lang === 'es' ? `${r} m · ${nm.replace('.', ',')} millas` : lang === 'de' ? `${r} m · ${nm.replace('.', ',')} sm` : `${r} m · ${nm} nm`;
}
