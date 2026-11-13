import { NextResponse, type NextRequest } from 'next/server';
import { isLang } from '@/lib/lang';

// /lang?to=ru&back=/race — sets the language (a cookie the game reads too) and goes back.
export function GET(request: NextRequest) {
  const to = request.nextUrl.searchParams.get('to');
  const back = request.nextUrl.searchParams.get('back') || '/';
  const safe = back.startsWith('/') && !back.startsWith('//') ? back : '/';
  const res = NextResponse.redirect(new URL(safe, request.url));
  if (isLang(to)) res.cookies.set('lang', to, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return res;
}
