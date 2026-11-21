import { supabaseServer } from '@/lib/supabase/server';
import { parseMine } from '@/lib/duel-rating';

// The signed-in sailor's own 1-on-1 rating, for their card on /players (components/my-duel-rating.tsx):
//   GET /connect/rating/me → { rating, races, wins, losses, best, lowest, place, of, changes } or null (not signed in)
// From the database's regatta_my_rating(), which answers for the session's account alone. Never cached.
export async function GET() {
  let body = null;
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.rpc('regatta_my_rating');
    if (!error) body = parseMine(data);
  } catch {}
  return Response.json(body, { headers: { 'cache-control': 'no-store' } });
}
