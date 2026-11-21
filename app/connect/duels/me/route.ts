import { supabaseServer } from '@/lib/supabase/server';
import { parseMyDuels } from '@/lib/my-duels';

// The signed-in sailor's own 1-on-1 races and rivals, for the 1-on-1 tab of their card on /players
// (components/player-tabs.tsx):
//   GET /connect/duels/me → { races: [...], rivals: [...] } or null (not signed in)
// From the database's regatta_my_duels(), which answers for the session's account alone. Never cached.
export async function GET() {
  let body = null;
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.rpc('regatta_my_duels');
    if (!error) body = parseMyDuels(data);
  } catch {}
  return Response.json(body, { headers: { 'cache-control': 'no-store' } });
}
