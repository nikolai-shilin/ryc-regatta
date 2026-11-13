import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isLang } from '@/lib/lang';

// Keeps the Supabase session fresh: reads the auth cookies, refreshes an expiring token and writes it back.
// Also the language in the address: /help?lang=ru is the Russian page (the address search engines index it by, see
// lib/seo.ts). It reaches the pages as the x-lang header and stays as the lang cookie, so the next page and the game
// speak it too.
export async function proxy(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('lang');
  const urlLang = isLang(q) ? q : null;
  if (urlLang) request.headers.set('x-lang', urlLang);
  else request.headers.delete('x-lang');
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers || {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });
  // getClaims, not getUser: it refreshes an expiring session just the same, but checks the token here against the
  // project's signing key (ES256, its JWKS cached across requests) instead of asking Supabase on every page. The page
  // itself still asks Supabase (getAccount in lib/supabase/server.ts), so a signed-in page waits on one round trip, not two.
  await supabase.auth.getClaims();
  if (urlLang && request.cookies.get('lang')?.value !== urlLang) response.cookies.set('lang', urlLang, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return response;
}

export const config = {
  // not for the game's files, the pictures, Next's own assets or the files for crawlers
  matcher: ['/((?!_next/static|_next/image|game/|vendor/|play|boat-view|hero-view|images/|favicon.ico|logo-black.svg|og/|robots.txt|sitemap.xml|llms.txt|indexnow.txt|manifest.webmanifest|apple-icon|icon).*)'],
};
