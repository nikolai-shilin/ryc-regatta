import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isLang, pickLang } from '@/lib/lang';

// Every page, in the reader's language, from the CDN. The pages live under app/[lang]/ and are built once per language
// at deploy (or every few minutes, Home), so this picks the language (lib/lang.ts pickLang: ?lang=, else the lang
// cookie, else the browser's) and rewrites /help to /ru/help; the address stays /help. ?lang= also stays as the
// cookie, so the next page and the game speak it too. /ru/help typed in goes to its real address, /help?lang=ru.
//
// It also keeps the Supabase session fresh: reads the auth cookies, refreshes an expiring token and writes it back.
export async function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const seg = /^\/(en|ru)(\/.*)?$/.exec(url.pathname);
  if (seg) {
    const to = url.clone();
    to.pathname = seg[2] || '/';
    to.searchParams.set('lang', seg[1]);
    return NextResponse.redirect(to, 308);
  }
  const q = url.searchParams.get('lang');
  const urlLang = isLang(q) ? q : null;
  // the route handlers (sign-in callbacks, /lang) answer at their own address; everything else is a page
  const page = !/^\/(auth\/|lang$|_)/.test(url.pathname);
  const target = url.clone();
  if (page) {
    target.pathname = `/${pickLang(q, request.cookies.get('lang')?.value, request.headers.get('accept-language'))}${url.pathname === '/' ? '' : url.pathname}`;
    target.searchParams.delete('lang');
  }
  const pass = () => (page ? NextResponse.rewrite(target, { request }) : NextResponse.next({ request }));
  let response = pass();
  // a guest has no session to refresh (and most visitors are guests)
  if (request.cookies.getAll().some((c) => /^sb-.+-auth-token/.test(c.name))) {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list, headers) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = pass();
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers || {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    });
    // getClaims, not getUser: it refreshes an expiring session just the same, but checks the token here against the
    // project's signing key (ES256, its JWKS cached across requests) instead of asking Supabase on every page.
    await supabase.auth.getClaims();
  }
  if (urlLang && request.cookies.get('lang')?.value !== urlLang) response.cookies.set('lang', urlLang, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return response;
}

export const config = {
  // not for the game's files, the pictures, Next's own assets or the files for crawlers
  matcher: ['/((?!_next/static|_next/image|_vercel|game/|vendor/|play|boat-view|hero-view|images/|flags/|favicon.ico|logo-black.svg|og/|robots.txt|sitemap.xml|llms.txt|indexnow.txt|manifest.webmanifest|apple-icon|icon).*)'],
};
