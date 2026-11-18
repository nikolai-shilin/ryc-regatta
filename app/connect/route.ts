import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

// The 1-on-1 race's way to Supabase Realtime: the game (public/game/) is static and has no Supabase client or keys of
// its own, so it asks here, on the same origin, for the project's address, its publishable key (public by design, as in
// the browser's own client), the ranking name of whoever is signed in, and the build the page came from (both screens of
// a race must run the same game: each says its build in its hellos, and a mismatch asks for a reload). Never cached.
// It is also the site's word on hosting: only an account may host a 1-on-1 race (public/game/match-ui.js opens no room as
// host without canHost), while anyone with a link may join one.
//
//   GET /connect → { url, key, name, canHost, build }   (name is null for a guest, canHost false; build is 'dev' off Vercel)
export async function GET() {
  let name: string | null = null, canHost = false;
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    name = String(data.user?.user_metadata?.display_name || '') || null;
    canHost = !!data.user;
  } catch { /* no session: a guest */ }
  const build = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || 'dev';
  return NextResponse.json({ url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, name, canHost, build }, { headers: { 'cache-control': 'no-store' } });
}
