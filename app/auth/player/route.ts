import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { SCORES_API } from '@/lib/day-brief';

// The header menu's "Your player card" (components/home-client.tsx SiteMenu): the key /players?p= takes for the
// signed-in player. The key is made by the scores server (api/game.mjs in the iyt-test repo) from a secret of its own,
// so it is asked here, server to server, with the session's access token: it asks Supabase whose the token is and
// answers with that player's key alone (GET ?me). Nobody can ask for another's. proxy.ts runs first and refreshes an
// expiring session. Not readable from any other site (no CORS), never cached.
//
//   GET /auth/player → { k } for a player who has raced, 204 for a guest, a new account or no answer
const none = () => new NextResponse(null, { status: 204, headers: { 'cache-control': 'private, no-store' } });
export async function GET() {
  const supabase = await supabaseServer();
  // as /auth/token: the token's signature checked here, the scores server asks Supabase whose it is all the same
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return none();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return none();
  try {
    const r = await fetch(`${SCORES_API}?me`, {
      headers: { authorization: `Bearer ${session.access_token}` }, cache: 'no-store', signal: AbortSignal.timeout(5000),
    });
    const j = r.ok ? await r.json() : null;
    const k = typeof j?.k === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(j.k) ? j.k : null;
    return k ? NextResponse.json({ k }, { headers: { 'cache-control': 'private, no-store' } }) : none();
  } catch {
    return none();
  }
}
