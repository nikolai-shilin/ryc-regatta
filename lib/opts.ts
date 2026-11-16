// The player's settings, shared with the game on this origin: localStorage 'regatta' is the object the game reads at
// the start of every race (public/game/main.js, "settings"). fleetV, optsV and musicV mark them as current, so the game keeps them.
import type { Length, Shape, Wind } from './race';
import type { VenueId } from './venues';
import type { YachtId } from './yachts';

export type Music = 'racing' | 'groove' | 'riff' | 'openwater' | 'off';
export const TRACKS: readonly Music[] = ['racing', 'groove', 'riff', 'openwater']; // public/game/music.js: MUSIC_STYLES
export type Sea = 'loud' | 'normal' | 'quiet' | 'off';
export type Volume = 'loud' | 'normal' | 'quiet';

export type Daytime = 'any' | 'morning' | 'midday' | 'afternoon' | 'evening';
export const DAYTIMES: readonly Daytime[] = ['any', 'morning', 'midday', 'afternoon', 'evening'];

export type Opts = {
  mode: 'daily' | 'free';
  venue: VenueId; // where a free race is sailed (public/game/venues.js); today's race goes to the day's venue
  yacht: YachtId; // the class a free race is sailed in (public/game/classes.js); today's race, the day's (lib/race.ts dailyYacht)
  preset: Wind; fleet: number; length: Length; laps: number; start: number; current: number; course: Shape;
  daytime: Daytime; // the time of day a free race is sailed at (public/game/light.js: DAYTIMES); 'any' a new hour every race
  autoTrim: number; // 0 I trim · 1 auto · 2 main + jib
  sound: number; guides: number; gfx: 'auto' | 'high' | 'medium' | 'low';
  ghost: number; // 1: today's race again has the ghost of your best today in it (public/game/extras.js); off unless chosen
  ghostV: number; // 1: ghost is the player's own choice (before, it was on for everyone)
  camera: 'drone' | 'top' | 'helm'; vibration: number;
  voice: number; // the skipper's voice (the crew's calls in English), apart from Sound
  music: Music; // the soundtrack's track (public/game/music.js), or none
  musicVol: Volume; // how loud the music is (public/game/main.js: MUSIC_VOL)
  sea: Sea; // how loud the sea and the wind are (public/game/main.js: SEA)
  lastFree?: number; played?: number; trimV?: number; fleetV: number; optsV: number; musicV: number;
};

export const DEFAULTS: Opts = {
  mode: 'daily', venue: 'gocek', yacht: 'jpk1050', preset: 'medium', fleet: 5, length: 'short', laps: 1, start: 1, current: 0, course: 'wl', daytime: 'any',
  autoTrim: 1, sound: 1, guides: 1, ghost: 0, gfx: 'auto', camera: 'drone', vibration: 1, voice: 1, music: 'racing', musicVol: 'normal', sea: 'normal', fleetV: 3, optsV: 4, musicV: 1, ghostV: 1,
};

export function readOpts(): Opts {
  try {
    const saved = JSON.parse(localStorage.getItem('regatta') || '{}');
    const o = { ...DEFAULTS, ...saved, fleetV: 3, optsV: 4, musicV: 1, ghostV: 1 };
    if (saved.musicV !== 1) o.music = 'racing'; // Racing is the default music now, as in the game: once, then theirs
    if (saved.ghostV !== 1) o.ghost = 0; // the ghost of your best is off now unless you turn it on: once, then theirs
    if (o.music !== 'off' && !TRACKS.includes(o.music)) o.music = 'racing'; // a style that's gone (Ambient, Film, Folk)
    delete o.undefined; // junk an older game wrote; dropped on the next save
    return o;
  } catch {
    return { ...DEFAULTS };
  }
}

// told on this page whenever the settings are saved, so what plays here (components/soundtrack.tsx) follows at once
export const OPTS_EVENT = 'regatta-opts';

export function saveOpts(patch: Partial<Opts>) {
  const next = { ...readOpts(), ...patch };
  try { localStorage.setItem('regatta', JSON.stringify(next)); } catch {}
  try { window.dispatchEvent(new Event(OPTS_EVENT)); } catch {}
  return next;
}

// personal bests the game keeps: daily|<day> for today's race, <wind>|<laps>|<length>|<fleet> for a free one
export function readPb(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem('regatta-pb') || '{}'); } catch { return {}; }
}
