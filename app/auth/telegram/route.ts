import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

// Signs a Telegram player in: the IYT mini app opens this site with Telegram's launch data, and components/telegram-sign-in
// posts it here. The iyt-test server (api/regatta-session.mjs, which holds the bot token and the Supabase secret key)
// checks it and answers a one-time token for the player's account; verifying it here sets the session cookie.
// Someone already signed in with Google or email stays as they are; another Telegram account is switched.
const IYT = process.env.IYT_API_URL || 'https://iyt.rycrentals.com';
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });

// the Telegram id the launch data claims, only to compare with the session (the iyt server checks the signature)
const claimedId = (initData: string) => {
  try { return Number(JSON.parse(new URLSearchParams(initData).get('user') || 'null')?.id) || 0; } catch { return 0; }
};

export async function POST(request: NextRequest) {
  let initData = '';
  try { const b = await request.json(); initData = typeof b?.initData === 'string' ? b.initData.slice(0, 4096) : ''; } catch {}
  if (!initData) return json({ error: 'bad request' }, 400);

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const tgId = Number(user?.app_metadata?.telegram_id) || 0;
  if (user && (!tgId || tgId === claimedId(initData))) return json({ changed: false });

  let res: Response;
  try {
    res = await fetch(`${IYT}/api/regatta-session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ initData }), cache: 'no-store' });
  } catch {
    return json({ error: 'unavailable' }, 502);
  }
  if (res.status === 403 || res.status === 400) return json({ error: 'forbidden' }, 403);
  const token_hash = res.ok ? (await res.json().catch(() => null))?.token_hash : null;
  if (typeof token_hash !== 'string' || !token_hash) return json({ error: 'unavailable' }, 502);
  const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'magiclink' });
  if (error) return json({ error: 'unavailable' }, 502);
  return json({ changed: true });
}
