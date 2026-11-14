// Today's race and the race options, as the game has them (public/game/sim.js: dailyRace and the option values).
// The same date gives the same race on the hub and in the game.
import { VENUES, type VenueId } from './venues.ts'; // with its extension, so npm test's Node finds it too

function rng(seed: number) {
  // exactly as sim.js, signed shift included, so the numbers match the game's
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

export type Wind = 'light' | 'medium' | 'strong';
export type Length = 'short' | 'medium' | 'long';
export type Shape = 'wl' | 'tri' | 'trap' | 'wlu';
export type Daily = { day: string; seed: number; preset: Wind; fleet: number; length: Length; laps: number; start: number; current: number; course: Shape; venue: VenueId };

// today's venue, as public/game/venues.js dailyVenue: the days go round all the venues in a shuffled order
function round(k: number) {
  const ids = VENUES.map((v) => v.id), r = rng((k + 1) * 40503 + 977);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  return ids;
}
export function dailyVenue(date = new Date()): VenueId {
  const n = Math.floor(Date.parse(date.toISOString().slice(0, 10)) / 864e5), len = VENUES.length, k = Math.floor(n / len), ids = round(k);
  if (ids[0] === round(k - 1)[len - 1]) [ids[0], ids[1]] = [ids[1], ids[0]];
  return ids[n - k * len];
}

// the days before SHAPES_FROM are all up and down; from it the day's course goes round the four shapes
export const SHAPES_FROM = '2026-11-20';
export function dailyRace(date = new Date()): Daily {
  const day = date.toISOString().slice(0, 10), n = Math.floor(Date.parse(day) / 864e5), r = rng(n * 2654435761);
  r(); r();
  // the draws stay in this order: the wind, the current, then the shape, so the days that came before don't move
  const preset = (['light', 'medium', 'strong'] as const)[Math.floor(r() * 3)], current = r() < 0.3 ? 1 : 0, shape = r();
  const course: Shape = day < SHAPES_FROM ? 'wl' : shape < 0.4 ? 'wl' : shape < 0.6 ? 'tri' : shape < 0.8 ? 'trap' : 'wlu';
  return { day, seed: (n * 7919) % 100000, preset, fleet: 5, length: 'short', laps: 1, start: 1, current, course, venue: dailyVenue(date) };
}

export const KN: Record<Wind, number> = { light: 7, medium: 12, strong: 19 };

// The course on the water, in metres, as public/game/sim.js lays it out (makeCourse, Race): x across, z down the wind
// (the wind blows from −z), the start line through z = 0. A planned course has no skew; the game gives each race a
// small random one, which the result page has from the race itself.
export type XZ = [number, number];
// a triangle has a wing mark too, out to the left (sim.js makeCourse)
export type CourseGeo = { windward: XZ; gate: XZ[]; pin: XZ; committee: XZ; wing?: XZ };
export const COURSE_LEN: Record<Length, number> = { short: 1, medium: 2, long: 3.4 };
export const BEAT_LEN: Record<Wind, number> = { light: 200, medium: 260, strong: 280 };
// the close-hauled angle to the true wind at each preset's wind speed (sim.js P_BEAT)
export const BEAT_ANGLE: Record<Wind, number> = { light: 43, medium: 39.5, strong: 38.5 };

export function plannedCourse(preset: Wind, length: Length, fleet: number, shape: Shape = 'wl'): CourseGeo {
  const beat = BEAT_LEN[preset] * COURSE_LEN[length], half = Math.max(70, fleet * 10);
  const gate: XZ[] = fleet > 5 ? [[-27, -50], [27, -50]] : [[-22, -45], [22, -45]], B = beat + gate[0][1];
  return { windward: [0, -beat], gate, pin: [-half, 0], committee: [half, 0], ...(shape === 'tri' && { wing: [-0.85 * B, gate[0][1] - 0.85 * B] as XZ }) };
}

const mid = (a: XZ, b: XZ): XZ => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const dist = (a: XZ, b: XZ) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const lineMid = (c: CourseGeo) => mid(c.pin, c.committee);
export const gateMid = (c: CourseGeo) => mid(c.gate[0], c.gate[1]);

// each leg's length mark to mark, in the order the game sails them: the beat to the windward mark, the run to the gate
// (on a triangle the two reaches by the wing mark) and back up, the run (or reach) to the finish (the line's middle)
export function legDistances(c: CourseGeo, legs: string[]): number[] {
  let at: XZ = lineMid(c);
  return legs.map((k) => {
    if (k === 'start') return 0;
    const to = k === 'mark' ? c.windward : k === 'wing' && c.wing ? c.wing : k === 'gate' ? gateMid(c) : lineMid(c);
    const d = dist(at, to); at = to; return d;
  });
}
export const courseLegs = (laps: number, shape: Shape = 'wl') => {
  const lap = shape === 'tri' ? ['mark', 'wing'] : ['mark'];
  return ['start', ...Array.from({ length: laps }, (_, i) => (i < laps - 1 ? [...lap, 'gate'] : lap)).flat(), 'finish'];
};
export const courseDistance = (c: CourseGeo, laps: number) => legDistances(c, courseLegs(laps, c.wing ? 'tri' : 'wl')).reduce((a, b) => a + b, 0);

// "520 m · 0.28 nm"
export function fmtDistance(m: number, lang: 'en' | 'ru') {
  const nm = (m / 1852).toFixed(2), r = Math.round(m / 10) * 10;
  return lang === 'ru' ? `${r} м · ${nm.replace('.', ',')} мили` : `${r} m · ${nm} nm`;
}
