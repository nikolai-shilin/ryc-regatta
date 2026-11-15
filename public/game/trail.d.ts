// Types for trail.js, which the site's pages import too (components/back-link.tsx).
export type Step = { p: string; n: number };
export const KEY: string;
export function same(a: string, b: string): boolean;
export function step(trail: Step[], here: string, how?: { pop?: boolean; reload?: boolean; full?: boolean; from?: string }): Step[];
export function back(trail: Step[], here: string, fallback: string): { trail: Step[]; to: string; go?: number };
export function load(): Step[];
export function save(t: Step[]): void;
export function arriveLoaded(o?: { pop?: boolean }): void;
export function arriveWithin(o?: { pop?: boolean }): void;
export function goBack(fallback: string, navigate?: ((to: string) => void) | null, o?: { extra?: number; single?: boolean }): void;
