import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

// The 1-on-1 race's way to Supabase Realtime: the game (public/game/) is static and has no Supabase client or keys of
// its own, so it asks here, on the same origin, for the project's address, its publishable key (public by design, as in
// the browser's own client), the ranking name of whoever is signed in, and the build the page came from (both screens of
// a race must run the same game: each says its build in its hellos, and a mismatch asks for a reload). Never cached.
//
//   GET /connect → { url, key, name, build }   (name is null for a guest; build is 'dev' off Vercel)
export async function GET() {
  let name: string | null = null;
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    name = String(data.user?.user_metadata?.display_name || '') || null;
  } catch { /* no session: a guest */ }
  const build = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || 'dev';
  return NextResponse.json({ url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, name, build }, { headers: { 'cache-control': 'no-store' } });
}
