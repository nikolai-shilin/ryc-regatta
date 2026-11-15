import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

// The match race's way to Supabase Realtime: the game (public/game/) is static and has no Supabase client or keys of
// its own, so it asks here, on the same origin, for the project's address, its publishable key (public by design, as in
// the browser's own client) and the ranking name of whoever is signed in. Never cached.
//
//   GET /connect → { url, key, name }   (name is null for a guest)
export async function GET() {
  let name: string | null = null;
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    name = String(data.user?.user_metadata?.display_name || '') || null;
  } catch { /* no session: a guest */ }
  return NextResponse.json({ url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, name }, { headers: { 'cache-control': 'no-store' } });
}
