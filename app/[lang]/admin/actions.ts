'use server';
import { updateTag } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';

// After the admin page saves or clears a sail's picture or the banner: /sponsor reads it afresh on the next request, not a minute later.
// Only for an admin (public.is_regatta_admin(), by the account's email), though all it does is drop a cache.
export async function sponsorChanged() {
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc('is_regatta_admin');
  if (data === true) updateTag('sponsor');
}
