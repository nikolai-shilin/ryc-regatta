import type { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { msgBody, parseMsg } from '@/lib/messages';

// The signed-in sailor's choice of messages (lib/messages.ts; the database's regatta_msg_get and regatta_msg_set):
//   GET  /connect/messages                                       → the choices, or null for a visitor
//   POST /connect/messages { push, telegram, quietFrom, quietTo, tz } → the choices as saved
// Only from this site's own pages. Never cached.
const json = (body: unknown) => Response.json(body, { headers: { 'cache-control': 'no-store' } });

export async function GET() {
  try {
    const { data, error } = await (await supabaseServer()).rpc('regatta_msg_get');
    return json(error ? null : parseMsg(data));
  } catch { return json(null); }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  let host = '';
  try { host = origin ? new URL(origin).host : ''; } catch {}
  if (origin && host !== (request.headers.get('host') || request.nextUrl.host)) return json(null);
  let b: unknown = null;
  try { b = JSON.parse(await request.text()); } catch {}
  const args = msgBody(b);
  if (!args) return json(null);
  try {
    const { data, error } = await (await supabaseServer()).rpc('regatta_msg_set', args);
    return json(error ? null : parseMsg(data));
  } catch { return json(null); }
}
