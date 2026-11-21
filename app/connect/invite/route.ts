import type { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { CODE_RE } from '@/lib/code';
import { parseInvite } from '@/lib/duel-invite';

// Who is asking, for a 1-on-1 race's invite page (components/invite-info.tsx):
//   GET /connect/invite?code=K7M2QZ → { name, rating, races, venue, yacht, …, minutes, sailed } or null (no such link yet)
// From the database's regatta_invite(code), which answers anyone with the link. Cached briefly: a host's settings rarely change.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code') ?? '';
  let body = null;
  if (CODE_RE.test(code)) {
    try {
      const supabase = await supabaseServer();
      const { data, error } = await supabase.rpc('regatta_invite', { p_code: code });
      if (!error) body = parseInvite(data);
    } catch {}
  }
  return Response.json(body, { headers: { 'cache-control': 'public, max-age=30' } });
}
