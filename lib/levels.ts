import { pick, type Lang, type Pair } from './lang';

// The 1-on-1 rating's seven levels, 200 apart: Novice under 1200, then Local, Fleet, Regional, National and
// International, and Olympian from 2200. Everyone starts at 1500, in Fleet. A level is shown once the first five rated races
// are done (lib/elo.ts PROVISIONAL); until then the rating shows with a ~ and no level.
export type LevelKey = 'novice' | 'local' | 'fleet' | 'regional' | 'national' | 'international' | 'olympian';
export type Level = { key: LevelKey; min: number; name: Pair };

export const LEVELS: readonly Level[] = [
  { key: 'novice', min: -Infinity, name: ['Novice', 'Новичок', 'Novato', 'Neuling', 'Acemi', 'Novice', 'Novizio', 'Novato'] },
  { key: 'local', min: 1200, name: ['Local', 'Местный', 'Local', 'Lokal', 'Yerel', 'Local', 'Locale', 'Local'] },
  { key: 'fleet', min: 1400, name: ['Fleet', 'Флот', 'Flota', 'Flotte', 'Filo', 'Flotte', 'Flotta', 'Frota'] },
  { key: 'regional', min: 1600, name: ['Regional', 'Региональный', 'Regional', 'Regional', 'Bölgesel', 'Régional', 'Regionale', 'Regional'] },
  { key: 'national', min: 1800, name: ['National', 'Национальный', 'Nacional', 'National', 'Ulusal', 'National', 'Nazionale', 'Nacional'] },
  { key: 'international', min: 2000, name: ['International', 'Международный', 'Internacional', 'International', 'Uluslararası', 'International', 'Internazionale', 'Internacional'] },
  { key: 'olympian', min: 2200, name: ['Olympian', 'Олимпийский', 'Olímpico', 'Olympisch', 'Olimpik', 'Olympique', 'Olimpico', 'Olímpico'] },
];

export const levelOf = (rating: number): Level => {
  let l = LEVELS[0];
  for (const x of LEVELS) if (rating >= x.min) l = x;
  return l;
};
export const levelName = (rating: number, lang: Lang) => pick(levelOf(rating).name, lang);

// the next level up and how far it is (null at the top), for the level bar: where the rating sits between this level's
// floor and the next one's, 0 … 1
export function nextLevel(rating: number): { level: Level; to: number; at: number } | null {
  const i = LEVELS.indexOf(levelOf(rating)), next = LEVELS[i + 1];
  if (!next) return null;
  const floor = Number.isFinite(LEVELS[i].min) ? LEVELS[i].min : next.min - 200;
  return { level: next, to: next.min - rating, at: Math.min(1, Math.max(0, (rating - floor) / (next.min - floor))) };
}
