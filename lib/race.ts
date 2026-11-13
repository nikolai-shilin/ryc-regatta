// Today's race and the race options, as the game has them (public/game/sim.js: dailyRace and the option values).
// The same date gives the same race on the hub and in the game.

function rng(seed: number) {
  // exactly as sim.js, signed shift included, so the numbers match the game's
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

export type Wind = 'light' | 'medium' | 'strong';
export type Length = 'short' | 'medium' | 'long';
export type Daily = { day: string; seed: number; preset: Wind; fleet: number; length: Length; laps: number; start: number; current: number };

export function dailyRace(date = new Date()): Daily {
  const day = date.toISOString().slice(0, 10), n = Math.floor(Date.parse(day) / 864e5), r = rng(n * 2654435761);
  r(); r();
  return { day, seed: (n * 7919) % 100000, preset: (['light', 'medium', 'strong'] as const)[Math.floor(r() * 3)], fleet: 5, length: 'short', laps: 1, start: 1, current: r() < 0.3 ? 1 : 0 };
}

export const KN: Record<Wind, number> = { light: 7, medium: 12, strong: 19 };

// The course on the water, in metres, as public/game/sim.js lays it out (makeCourse, Race): x across, z down the wind
// (the wind blows from −z), the start line through z = 0. A planned course has no skew; the game gives each race a
// small random one, which the result page has from the race itself.
export type XZ = [number, number];
export type CourseGeo = { windward: XZ; gate: XZ[]; pin: XZ; committee: XZ };
export const COURSE_LEN: Record<Length, number> = { short: 1, medium: 2, long: 3.4 };
export const BEAT_LEN: Record<Wind, number> = { light: 200, medium: 260, strong: 280 };
// the close-hauled angle to the true wind at each preset's wind speed (sim.js P_BEAT)
export const BEAT_ANGLE: Record<Wind, number> = { light: 43, medium: 39.5, strong: 38.5 };

export function plannedCourse(preset: Wind, length: Length, fleet: number): CourseGeo {
  const beat = BEAT_LEN[preset] * COURSE_LEN[length], half = Math.max(70, fleet * 10);
  return { windward: [0, -beat], gate: fleet > 5 ? [[-27, -50], [27, -50]] : [[-22, -45], [22, -45]], pin: [-half, 0], committee: [half, 0] };
}

const mid = (a: XZ, b: XZ): XZ => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const dist = (a: XZ, b: XZ) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const lineMid = (c: CourseGeo) => mid(c.pin, c.committee);
export const gateMid = (c: CourseGeo) => mid(c.gate[0], c.gate[1]);

// each leg's length mark to mark, in the order the game sails them: the beat to the windward mark, the run to the gate
// and back up, the run to the finish (the line's middle)
export function legDistances(c: CourseGeo, legs: string[]): number[] {
  let at: XZ = lineMid(c);
  return legs.map((k) => {
    if (k === 'start') return 0;
    const to = k === 'mark' ? c.windward : k === 'gate' ? gateMid(c) : lineMid(c);
    const d = dist(at, to); at = to; return d;
  });
}
export const courseLegs = (laps: number) => ['start', ...Array.from({ length: laps }, (_, i) => (i < laps - 1 ? ['mark', 'gate'] : ['mark'])).flat(), 'finish'];
export const courseDistance = (c: CourseGeo, laps: number) => legDistances(c, courseLegs(laps)).reduce((a, b) => a + b, 0);

// "520 m · 0.28 nm"
export function fmtDistance(m: number, lang: 'en' | 'ru') {
  const nm = (m / 1852).toFixed(2), r = Math.round(m / 10) * 10;
  return lang === 'ru' ? `${r} м · ${nm.replace('.', ',')} мили` : `${r} m · ${nm} nm`;
}
