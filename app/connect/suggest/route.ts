import type { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { KINDS, parseState } from '@/lib/suggest';

// For you, for the signed-in sailor (components/for-you.tsx, lib/suggest.ts):
//   GET  /connect/suggest                         → { weights, out, stale } or null (not signed in)
//   POST /connect/suggest { ev, kinds }           → the same, after: 'shown' for the kinds on the list, or 'tap',
//                                                   'dismiss' or 'fewer' for one
// The database's regatta_suggest_state() and regatta_suggest_mark(), for the session's account alone. A POST only from
// this site's own pages. Never cached.
const known = new Set<string>(KINDS);
const json = (body: unknown) => Response.json(body, { headers: { 'cache-control': 'no-store' } });
export async function GET() {
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.rpc('regatta_suggest_state');
    return json(error ? null : parseState(data));
  } catch { return json(null); }
}
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  let host = '';
  try { host = origin ? new URL(origin).host : ''; } catch {}
  if (origin && host !== (request.headers.get('host') || request.nextUrl.host)) return json(null);
  let body: { ev?: unknown; kinds?: unknown } = {};
  try { body = JSON.parse(await request.text()) ?? {}; } catch {}
  const ev = ['shown', 'tap', 'dismiss', 'fewer'].includes(body.ev as string) ? (body.ev as string) : null;
  const kinds = Array.isArray(body.kinds) ? body.kinds.filter((k): k is string => typeof k === 'string' && known.has(k)).slice(0, 3) : [];
  if (!ev || !kinds.length) return json(null);
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.rpc('regatta_suggest_mark', { p_ev: ev, p_kinds: kinds });
    return json(error ? null : parseState(data));
  } catch { return json(null); }
}
