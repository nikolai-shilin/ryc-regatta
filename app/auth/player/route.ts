import { NextResponse } from 'next/server';
import { myPlayerKey } from '@/lib/player-key';

// The header menu's "Your player card" (components/home-client.tsx SiteMenu): the key /players?p= takes for the
// signed-in player, asked of the scores server with the session (lib/player-key.ts). proxy.ts runs first and refreshes
// an expiring session. Not readable from any other site (no CORS), never cached.
//
//   GET /auth/player → { k } for a player who has raced, 204 for a guest, a new account or no answer
const none = () => new NextResponse(null, { status: 204, headers: { 'cache-control': 'private, no-store' } });
export async function GET() {
  const { k } = await myPlayerKey();
  return k ? NextResponse.json({ k }, { headers: { 'cache-control': 'private, no-store' } }) : none();
}
