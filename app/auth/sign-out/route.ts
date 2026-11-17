import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

// Sign out: ends the session; the game's settings stay on the device. Back to the race hub, or to the page the form
// names in next (the header's menu: the page it was opened on), a path on this site only.
export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  const next = String((await request.formData().catch(() => null))?.get('next') || '');
  const to = /^\/(?![/\\])/.test(next) ? next : '/race';
  return NextResponse.redirect(new URL(to, request.url), 303);
}
