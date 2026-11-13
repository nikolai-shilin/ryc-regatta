import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { safeNext } from '@/lib/next-path';

// Google (and the link in the sign-in email) come back here with a code; it becomes the session cookie.
// A first sign-in without a ranking name goes to /sign-in/name first.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get('next'));
  const code = url.searchParams.get('code');
  if (!code) return NextResponse.redirect(new URL(`/sign-in?error=1&next=${encodeURIComponent(next)}`, url));
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL(`/sign-in?error=1&next=${encodeURIComponent(next)}`, url));
  const named = !!data.user.user_metadata?.display_name;
  return NextResponse.redirect(new URL(named ? next : `/sign-in/name?next=${encodeURIComponent(next)}`, url));
}
