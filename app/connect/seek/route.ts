import { after, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { isHandle, parseReady, parseSeek, wishesOf } from '@/lib/duel-seek';
import { BANDS, callCode, parsePosted } from '@/lib/duel-call';
import { sendMatchFound, sendLookPing } from '@/lib/push-send';
import { parseHour } from '@/lib/duel-hour';

// Matchmaking for the signed-in sailor (components/duel-finder.tsx):
//   POST /connect/seek { do: 'seek', wishes? }      → looking | found | go | none   (asked every 3 s while looking, every 1 s once found)
//   POST /connect/seek { do: 'ready' | 'decline', pair }  → found | go | none
//   POST /connect/seek { do: 'stop' }               → none
//   POST /connect/seek { do: 'ready_now' }          → { list }: who is looking now, nearest first (asked every 10 s)
//   POST /connect/seek { do: 'challenge', handle, wishes? }  → found | none (gone: they left or were paired)
//   POST /connect/seek { do: 'call', band?, wishes? }  → { status: 'open', code, lo, hi, left } | none: an open call, while looking
//   POST /connect/seek { do: 'take', code, wishes? }   → found | none (taken, away, closed, band, mine): an open call taken
//   POST /connect/seek { do: 'away', on }              → { status: 'away', left } | { status: 'here' } | none (no_push, not_looking)
//   POST /connect/seek { do: 'hour' }                 → { hour }: the duel hour's day, how many are in, near you, you in (lib/duel-hour.ts)
//   POST /connect/seek { do: 'hour_in', on }           → { hour }: in, or out, for that day's hour
// A pair just made with a sailor who is away (looked for after leaving /duel) sends them Match found by push once the
// answer has gone (lib/push-send.ts; the database hands their devices over once per pair). A search just begun with nobody
// near tells a few sailors near your rating (sendLookPing).
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
  let body: { do?: unknown; pair?: unknown; wishes?: unknown; handle?: unknown; band?: unknown; code?: unknown; on?: unknown } = {};
  try { body = JSON.parse(await request.text()) ?? {}; } catch {}
  try {
    const supabase = await supabaseServer();
    let res;
    if (body.do === 'hour' || body.do === 'hour_in') {
      const r = body.do === 'hour' ? await supabase.rpc('regatta_hour_state') : await supabase.rpc('regatta_hour_join', { p_in: body.on === true });
      return json({ hour: r.error ? null : parseHour(r.data) });
    }
    if (body.do === 'ready_now') { const r = await supabase.rpc('regatta_ready_now'); return json({ list: r.error ? [] : parseReady(r.data) }); }
    if (body.do === 'call') {
      const band = BANDS.includes(body.band as 100) ? (body.band as number) : 100;
      const r = await supabase.rpc('regatta_call_post', { p_wishes: wishesOf(body.wishes), p_band: band });
      return json(r.error ? { status: 'none', reason: null } : parsePosted(r.data));
    }
    if (body.do === 'away') {
      const r = await supabase.rpc('regatta_seek_away', { p_on: body.on === true });
      const d = r.data as { status?: unknown; reason?: unknown; left?: unknown } | null;
      if (r.error || !d) return json({ status: 'none', reason: null });
      if (d.status === 'away') return json({ status: 'away', left: typeof d.left === 'number' ? d.left : 0 });
      if (d.status === 'here') return json({ status: 'here' });
      return json({ status: 'none', reason: typeof d.reason === 'string' ? d.reason : null });
    }
    if (body.do === 'seek') res = await supabase.rpc('regatta_seek', { p_wishes: wishesOf(body.wishes) });
    else if ((body.do === 'ready' || body.do === 'decline') && typeof body.pair === 'string' && UUID.test(body.pair)) res = await supabase.rpc('regatta_seek_ready', { p_pair: body.pair, p_ok: body.do === 'ready' });
    else if (body.do === 'take' && callCode(body.code)) res = await supabase.rpc('regatta_call_take', { p_code: callCode(body.code), p_wishes: wishesOf(body.wishes) });
    else if (body.do === 'challenge' && isHandle(body.handle)) res = await supabase.rpc('regatta_seek_challenge', { p_handle: body.handle, p_wishes: wishesOf(body.wishes) });
    else if (body.do === 'stop') { await supabase.rpc('regatta_seek_stop'); return json({ status: 'none', reason: 'stopped' }); }
    else return json({ status: 'none', reason: null });
    const out = res.error ? { status: 'none' as const, reason: null } : parseSeek(res.data);
    // a pair offered: its away sailor, if any, told by push (once per pair: asking again sends nothing)
    if (out.status === 'found') {
      const id = out.pair.id, task = () => sendMatchFound(id).then(() => {}, () => {});
      try { after(task); } catch { void task(); } // (outside a request, as in the tests: at once)
    }
    // just started looking, and nobody near your rating is looking too: a few sailors near it who raced lately are told
    // (lib/push-send.ts sendLookPing; the database chooses, and lets a searcher set it off once in thirty minutes)
    // (the search's own answer never waits on it, nor fails with it)
    if (body.do === 'seek' && out.status === 'looking' && out.waited <= 6 && out.near === 0) {
      try {
        const { data: claims } = await supabase.auth.getClaims();
        const me = claims?.claims?.sub;
        if (typeof me === 'string') {
          const task = () => sendLookPing(me).then(() => {}, () => {});
          try { after(task); } catch { void task(); }
        }
      } catch { /* no session to read: no message */ }
    }
    return json(out);
  } catch { return json({ status: 'none', reason: null }); }
}
