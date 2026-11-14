import 'server-only';

// the scores API; SCORES_API points the site at another one (a local copy, a stub for testing)
const SCORES = process.env.SCORES_API || 'https://iyt.rycrentals.com/api/game';

// Today's fastest, from the public scores API the game already posts to (api/game.mjs in the iyt-test repo).
// The edge caches it for five minutes, and so do we.
export type TopRow = { name: string | null; s: number; fl?: string | null }; // fl: the flag they fly (lib/flags.ts)
export type Today = { d: string; w?: string; races: number; top: TopRow[] };

export async function todayTop(): Promise<Today | null> {
  try {
    const r = await fetch(SCORES, { next: { revalidate: 300 } });
    if (!r.ok) return null;
    const j = await r.json();
    const d = j && j.daily;
    return d && Array.isArray(d.top) ? { d: d.d, w: d.w, races: d.races || 0, top: d.top.slice(0, 3) } : null;
  } catch {
    return null;
  }
}
