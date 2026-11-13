import 'server-only';

// Today's fastest, from the public scores API the game already posts to (api/game.mjs in the iyt-test repo).
// The edge caches it for five minutes, and so do we.
export type TopRow = { name: string | null; s: number };
export type Today = { d: string; w?: string; races: number; top: TopRow[] };

export async function todayTop(): Promise<Today | null> {
  try {
    const r = await fetch('https://iyt.rycrentals.com/api/game', { next: { revalidate: 300 } });
    if (!r.ok) return null;
    const j = await r.json();
    const d = j && j.daily;
    return d && Array.isArray(d.top) ? { d: d.d, w: d.w, races: d.races || 0, top: d.top.slice(0, 3) } : null;
  } catch {
    return null;
  }
}
