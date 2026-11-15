import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

// The race page's way to the player's account: the game (public/game/stats.js) is static and has no Supabase client
// of its own, so it asks here, on the same origin, for the session's access token and posts it with its race to the
// scores server (api/game.mjs in the iyt-test repo), which asks Supabase whose it is and names the race after them.
// proxy.ts runs first and refreshes an expiring session. Not readable from any other site (no CORS), never cached.
//
//   GET /auth/token → { token, expires } when signed in, 204 when not
export async function GET() {
  const supabase = await supabaseServer();
  // getClaims, not getUser: the token's signature is checked here against the project's key (ES256, its JWKS cached),
  // without asking Supabase on every race page. The scores server asks Supabase whose the token is all the same.
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return new NextResponse(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return new NextResponse(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  return NextResponse.json({ token: session.access_token, expires: session.expires_at }, { headers: { 'cache-control': 'no-store' } });
}
