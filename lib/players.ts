import 'server-only';
import type { Boat } from './boat';

// the scores API; SCORES_API points the site at another one (a local copy, a stub for testing), as lib/rating.ts
const SCORES = process.env.SCORES_API || 'https://iyt.rycrentals.com/api/game';

// The players, from the scores API (api/game.mjs in the iyt-test repo): everyone who races signed in (inside Telegram
// or with a site account; guests are not players), the most races first, PER a page (GET ?players&page=), and one
// player's card with their boat (GET ?player=<k>). k is a key that stays the player's (not their id), the same one the
// rating gives them; fl their flag; yacht the class they sail most (null: the JPK 1050).
export type PlayerRow = {
  k: string; name: string | null; ph: string | null; fl: string | null;
  n: number; fin: number; wins: number; podiums: number; days: number; last: string; yacht: string | null;
};
export type PlayerList = { total: number; page: number; pages: number; per: number; rows: PlayerRow[] };
export type Count = { id: string; n: number };
export type PlayerCard = PlayerRow & {
  first: string; dsq: number; best: number | null; fleet: number | null;
  daily: { n: number; days: number; wins: number; best: number | null };
  yachts: Count[]; venues: Count[];
  boat: Partial<Boat> | null;
};

export const KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;
const get = async <T>(q: string): Promise<T | null> => {
  try {
    const r = await fetch(`${SCORES}?${q}`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(6000) });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
};

// null when it can't be had (the API is down): the page says so rather than showing nobody
export async function getPlayers(page: number): Promise<PlayerList | null> {
  const j = await get<PlayerList>(`players&page=${page}`);
  return j && Array.isArray(j.rows) && Number.isFinite(j.pages) ? j : null;
}

// null for a key nobody has, or when the API is down
export async function getPlayer(k: string): Promise<PlayerCard | null> {
  if (!KEY_RE.test(k)) return null;
  const j = await get<PlayerCard>(`player=${encodeURIComponent(k)}`);
  return j && j.k === k ? j : null;
}
