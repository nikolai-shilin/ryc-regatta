// Types for av-menu.js, which the site's pages import too (components/av-row.tsx).
type AvOpts = Record<string, unknown>;
export function avTitle(lang: string): string;
export function avSummary(o: AvOpts, lang: string): string;
export function avGfx(o: AvOpts, lang: string): string;
export function openAvMenu(o: {
  lang?: string;
  read: () => AvOpts;
  write: (patch: never) => unknown;
  now?: () => string;
  zIndex?: number;
  onClose?: () => void;
}): () => void;
