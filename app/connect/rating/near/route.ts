import { supabaseServer } from '@/lib/supabase/server';
import { parseNear } from '@/lib/duel-page';

// The 1-on-1 rating around the signed-in sailor, for the 1-on-1 page (components/duel-finder.tsx):
//   GET /connect/rating/near → { place, of, rows: [{ place, name, rating, races, wins, losses, me }] } or null (not signed in)
// From the database's regatta_rating_near(): three places above to three below theirs among the settled ratings, or the top
// seven for a sailor not settled yet. Never cached.
export async function GET() {
  let body = null;
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.rpc('regatta_rating_near');
    if (!error) body = parseNear(data);
  } catch {}
  return Response.json(body, { headers: { 'cache-control': 'no-store' } });
}
