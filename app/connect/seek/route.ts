import type { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { isHandle, parseReady, parseSeek, wishesOf } from '@/lib/duel-seek';

// Matchmaking for the signed-in sailor (components/duel-finder.tsx):
//   POST /connect/seek { do: 'seek', wishes? }      → looking | found | go | none   (asked every 3 s while looking, every 1 s once found)
//   POST /connect/seek { do: 'ready' | 'decline', pair }  → found | go | none
//   POST /connect/seek { do: 'stop' }               → none
//   POST /connect/seek { do: 'ready_now' }          → { list }: who is looking now, nearest first (asked every 10 s)
//   POST /connect/seek { do: 'challenge', handle, wishes? }  → found | none (gone: they left or were paired)
// The sailor is the session's; the database pairs (regatta_seek, regatta_seek_ready, regatta_seek_stop, regatta_ready_now, regatta_seek_challenge). Only from this
// site's own pages. Never cached.
const json = (body: object) => Response.json(body, { headers: { 'cache-control': 'no-store' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  let host = '';
  try { host = origin ? new URL(origin).host : ''; } catch {}
  if (origin && host !== (request.headers.get('host') || request.nextUrl.host)) return json({ status: 'none', reason: null });
  let body: { do?: unknown; pair?: unknown; wishes?: unknown; handle?: unknown } = {};
  try { body = JSON.parse(await request.text()) ?? {}; } catch {}
  try {
    const supabase = await supabaseServer();
    let res;
    if (body.do === 'ready_now') { const r = await supabase.rpc('regatta_ready_now'); return json({ list: r.error ? [] : parseReady(r.data) }); }
    if (body.do === 'seek') res = await supabase.rpc('regatta_seek', { p_wishes: wishesOf(body.wishes) });
    else if ((body.do === 'ready' || body.do === 'decline') && typeof body.pair === 'string' && UUID.test(body.pair)) res = await supabase.rpc('regatta_seek_ready', { p_pair: body.pair, p_ok: body.do === 'ready' });
    else if (body.do === 'challenge' && isHandle(body.handle)) res = await supabase.rpc('regatta_seek_challenge', { p_handle: body.handle, p_wishes: wishesOf(body.wishes) });
    else if (body.do === 'stop') { await supabase.rpc('regatta_seek_stop'); return json({ status: 'none', reason: 'stopped' }); }
    else return json({ status: 'none', reason: null });
    return json(res.error ? { status: 'none', reason: null } : parseSeek(res.data));
  } catch { return json({ status: 'none', reason: null }); }
}
