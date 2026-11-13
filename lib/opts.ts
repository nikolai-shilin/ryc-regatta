// The player's settings, shared with the game on this origin: localStorage 'regatta' is the object the game reads at
// the start of every race (public/game/main.js, "settings"). fleetV and optsV mark them as current, so the game keeps them.
import type { Length, Shape, Wind } from './race';

export type Opts = {
  mode: 'daily' | 'free';
  preset: Wind; fleet: number; length: Length; laps: number; start: number; current: number; course: Shape;
  autoTrim: number; // 0 I trim · 1 auto · 2 main + jib
  sound: number; guides: number; gfx: 'auto' | 'high' | 'medium' | 'low';
  camera: 'drone' | 'top' | 'helm'; vibration: number;
  lastFree?: number; played?: number; fleetV: number; optsV: number;
};

export const DEFAULTS: Opts = {
  mode: 'daily', preset: 'medium', fleet: 5, length: 'short', laps: 1, start: 1, current: 0, course: 'wl',
  autoTrim: 0, sound: 1, guides: 1, gfx: 'auto', camera: 'drone', vibration: 1, fleetV: 3, optsV: 4,
};

export function readOpts(): Opts {
  try {
    const o = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('regatta') || '{}'), fleetV: 3, optsV: 4 };
    delete o.undefined; // junk an older game wrote; dropped on the next save
    return o;
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveOpts(patch: Partial<Opts>) {
  const next = { ...readOpts(), ...patch };
  try { localStorage.setItem('regatta', JSON.stringify(next)); } catch {}
  return next;
}

// personal bests the game keeps: daily|<day> for today's race, <wind>|<laps>|<length>|<fleet> for a free one
export function readPb(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem('regatta-pb') || '{}'); } catch { return {}; }
}
