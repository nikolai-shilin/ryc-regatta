import { plainName } from './name';

// The 1-on-1 rating's board, for the leaderboard on /race (components/race-board.tsx; iyt-test
// supabase/migrations/20261122010000_regatta_rating_board.sql): settled ratings (five rated races or more) first by rating,
// then provisional ones; fifty at most. Read without a session (the page is built once for everyone, every five minutes).
export type DuelBoardRow = { name: string | null; rating: number; races: number; wins: number; losses: number };
export type DuelBoard = { settled: number; provisional: number; rows: DuelBoardRow[] };

const int = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0;

export function parseDuelBoard(j: unknown): DuelBoard | null {
  const o = j as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || !Array.isArray(o.rows)) return null;
  const n = (v: unknown) => (int(Number(v)) ? Number(v) : 0);
  const rows = (o.rows as Record<string, unknown>[]).filter((r) => r && [r.rating, r.races, r.wins, r.losses].every(int)).slice(0, 50)
    .map((r) => ({ name: plainName(r.name as string) ?? null, rating: r.rating as number, races: r.races as number, wins: r.wins as number, losses: r.losses as number }));
  return { settled: n(o.settled), provisional: n(o.provisional), rows };
}

// null when it can't be had: the tab says so rather than showing nobody
export async function getDuelBoard(): Promise<DuelBoard | null> {
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/regatta_rating_board`, {
      method: 'POST', body: '{}', next: { revalidate: 300 }, signal: AbortSignal.timeout(6000),
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' },
    });
    return r.ok ? parseDuelBoard(await r.json()) : null;
  } catch { return null; }
}
