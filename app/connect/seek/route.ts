import type { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { isHandle, parseReady, parseSeek, wishesOf } from '@/lib/duel-seek';
import { BANDS, callCode, parsePosted } from '@/lib/duel-call';

// Matchmaking for the signed-in sailor (components/duel-finder.tsx):
//   POST /connect/seek { do: 'seek', wishes? }      → looking | found | go | none   (asked every 3 s while looking, every 1 s once found)
//   POST /connect/seek { do: 'ready' | 'decline', pair }  → found | go | none
//   POST /connect/seek { do: 'stop' }               → none
//   POST /connect/seek { do: 'ready_now' }          → { list }: who is looking now, nearest first (asked every 10 s)
//   POST /connect/seek { do: 'challenge', handle, wishes? }  → found | none (gone: they left or were paired)
//   POST /connect/seek { do: 'call', band?, wishes? }  → { status: 'open', code, lo, hi, left } | none: an open call, while looking
//   POST /connect/seek { do: 'take', code, wishes? }   → found | none (taken, away, closed, band, mine): an open call taken
// The sailor is the session's; the database pairs (regatta_seek, regatta_seek_ready, regatta_seek_stop, regatta_ready_now, regatta_seek_challenge, regatta_call_post,
// regatta_call_take). Only from this
// site's own pages. Never cached.
const json = (body: object) => Response.json(body, { headers: { 'cache-control': 'no-store' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  let host = '';
  try { host = origin ? new URL(origin).host : ''; } catch {}
  if (origin && host !== (request.headers.get('host') || request.nextUrl.host)) return json({ status: 'none', reason: null });
  let body: { do?: unknown; pair?: unknown; wishes?: unknown; handle?: unknown; band?: unknown; code?: unknown } = {};
  try { body = JSON.parse(await request.text()) ?? {}; } catch {}
  try {
    const supabase = await supabaseServer();
    let res;
    if (body.do === 'ready_now') { const r = await supabase.rpc('regatta_ready_now'); return json({ list: r.error ? [] : parseReady(r.data) }); }
    if (body.do === 'call') {
      const band = BANDS.includes(body.band as 100) ? (body.band as number) : 100;
      const r = await supabase.rpc('regatta_call_post', { p_wishes: wishesOf(body.wishes), p_band: band });
      return json(r.error ? { status: 'none', reason: null } : parsePosted(r.data));
    }
    if (body.do === 'seek') res = await supabase.rpc('regatta_seek', { p_wishes: wishesOf(body.wishes) });
    else if ((body.do === 'ready' || body.do === 'decline') && typeof body.pair === 'string' && UUID.test(body.pair)) res = await supabase.rpc('regatta_seek_ready', { p_pair: body.pair, p_ok: body.do === 'ready' });
    else if (body.do === 'take' && callCode(body.code)) res = await supabase.rpc('regatta_call_take', { p_code: callCode(body.code), p_wishes: wishesOf(body.wishes) });
    else if (body.do === 'challenge' && isHandle(body.handle)) res = await supabase.rpc('regatta_seek_challenge', { p_handle: body.handle, p_wishes: wishesOf(body.wishes) });
    else if (body.do === 'stop') { await supabase.rpc('regatta_seek_stop'); return json({ status: 'none', reason: 'stopped' }); }
    else return json({ status: 'none', reason: null });
    return json(res.error ? { status: 'none', reason: null } : parseSeek(res.data));
  } catch { return json({ status: 'none', reason: null }); }
}
