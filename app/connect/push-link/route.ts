import type { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

// This browser's push subscription (lib/push.ts, the daily reminder's) is the signed-in sailor's too, so a 1-on-1 match
// found while they are away can reach it (lib/push-send.ts): POST /connect/push-link { endpoint } → { linked }. The
// sailor is the session's (the database's regatta_push_link); only a subscription already saved is linked. Only from
// this site's own pages. Never cached.
const json = (body: object) => Response.json(body, { headers: { 'cache-control': 'no-store' } });

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  let host = '';
  try { host = origin ? new URL(origin).host : ''; } catch {}
  if (origin && host !== (request.headers.get('host') || request.nextUrl.host)) return json({ linked: false });
  let endpoint: unknown = null;
  try { endpoint = (JSON.parse(await request.text()) ?? {}).endpoint; } catch {}
  if (typeof endpoint !== 'string' || !/^https:\/\/[^\s]{8,1000}$/.test(endpoint)) return json({ linked: false });
  try {
    const { data, error } = await (await supabaseServer()).rpc('regatta_push_link', { p_endpoint: endpoint });
    return json({ linked: !error && data === true });
  } catch { return json({ linked: false }); }
}
