import { plainName } from './name';

// A 1-on-1 race's result, shared: the race's own link (/match/<code>, which opens the waiting room to race again), with
// who won, who lost and by how much in its address, so the link's card says it (app/og/page/[key] 'duel') and whoever opens
// it can race the sharer next. Names are as the race had them, cut to 16 characters; the margin in seconds, 0 to 600.
export type DuelShare = { w: string; l: string; m: number | null };

const name = (v: unknown) => (typeof v === 'string' ? [...(plainName(v.replace(/[\u0000-\u001f\u007f<>]/g, '')) ?? '')].slice(0, 16).join('').trim() : '');
const margin = (v: unknown) => { const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d{1,3}(\.\d)?$/.test(v) ? Number(v) : NaN; return Number.isFinite(n) && n > 0 && n <= 600 ? Math.round(n * 10) / 10 : null; };

// the result in the link's address: w, l and m beside the race's own v (venue) and b (yacht); null without both names
export function duelShareUrl(origin: string, code: string, o: { venue: string; yacht?: string | null; winner: string; loser: string; margin: number | null }) {
  const w = name(o.winner), l = name(o.loser), m = margin(o.margin);
  if (!w || !l) return null;
  const q = new URLSearchParams({ v: o.venue, ...(o.yacht ? { b: o.yacht } : {}), w, l, ...(m != null ? { m: m.toFixed(1) } : {}), utm_source: 'share', utm_medium: 'duel' });
  return `${origin}/match/${encodeURIComponent(code)}?${q}`;
}

// the result read back from such an address (a page's searchParams, or the card's query): null when either name is missing
export function duelFrom(get: (k: string) => string | null | undefined): DuelShare | null {
  const w = name(get('w')), l = name(get('l'));
  return w && l ? { w, l, m: margin(get('m')) } : null;
}
