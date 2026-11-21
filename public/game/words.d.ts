// Types for words.js, which the site's /dictionary imports too (components/dictionary-screen.tsx).
export const WORDS_CSS: string;
export function wordsTitle(lang: string): string;
export function fold(s: string, lang?: string): string;
export type Found = { id: string; title: string; count: number; shown: boolean; terms: { id: string; term: string; def: string; en: string; shown: boolean; named: boolean }[] };
export function find(groups: { id: string; title: string; terms: ([string, string, string] | [string, string, string, string])[] }[], q: string, tab?: string, lang?: string): Found[];
export function openWords(o: { lang?: string; title?: string; url: string; zIndex?: number; onClose?: () => void; stage?: { ids: string[]; show: (id: string) => boolean; view: (r: { x: number; y: number; w: number; h: number }) => void } | null }): () => void;
