import { supabaseServer } from '@/lib/supabase/server';
import { SCORES_API } from '@/lib/day-brief';

// The signed-in player's own key, the one /players?p= and the boards give them (app/auth/player for the menu's "Your
// player card", and your month at /race/month). The key is made by the scores server (api/game.mjs in the iyt-test
// repo) from a secret of its own, so it is asked there, server to server, with the session's access token: it asks
// Supabase whose the token is and answers with that player's key alone (GET ?me). Nobody can ask for another's.
//   signedIn: there is a session; k: the key, null for a guest, an account that has never raced or no answer
export async function myPlayerKey(): Promise<{ signedIn: boolean; k: string | null }> {
  const supabase = await supabaseServer();
  // as /auth/token: the token's signature checked here, the scores server asks Supabase whose it is all the same
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { signedIn: false, k: null };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { signedIn: false, k: null };
  try {
    const r = await fetch(`${SCORES_API}?me`, {
      headers: { authorization: `Bearer ${session.access_token}` }, cache: 'no-store', signal: AbortSignal.timeout(5000),
    });
    const j = r.ok ? await r.json() : null;
    return { signedIn: true, k: typeof j?.k === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(j.k) ? j.k : null };
  } catch {
    return { signedIn: true, k: null };
  }
}
