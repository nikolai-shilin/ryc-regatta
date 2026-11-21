import type { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { parseAchievements } from '@/lib/achievements';

// The signed-in sailor's achievements, for their card on /players (components/achievements.tsx):
//   POST /connect/achievements → { got: [{ key, at, detail }], progress: { key: [have, need] } } or null (not signed in)
// The database's regatta_achievements() runs the rules for the session's account alone and keeps any new one with the
// day it came (lib/achievements.ts), so it is a POST: asking may add to them. Only from this site's own pages. Never cached.
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  let host = '';
  try { host = origin ? new URL(origin).host : ''; } catch {}
  if (origin && host !== (request.headers.get('host') || request.nextUrl.host)) return Response.json(null, { headers: { 'cache-control': 'no-store' } });
  let body = null;
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.rpc('regatta_achievements');
    if (!error) body = parseAchievements(data);
  } catch {}
  return Response.json(body, { headers: { 'cache-control': 'no-store' } });
}
