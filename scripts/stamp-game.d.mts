// The types of scripts/stamp-game.mjs, for next.config.ts, which caches each file of the game's at its hash (hashes()).
export const PAGES: string[];
export function hashOf(dir: string, path: string): string;
export function hashes(dir: string): Record<string, string>;
export function assetsOf(dir: string): string[];
export function reach(dir: string, page: string): { html: string; reached: string[]; preloaded: string[] };
export function stamp(dir: string): void;
