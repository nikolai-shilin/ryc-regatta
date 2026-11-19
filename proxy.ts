import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isLang, pickLang } from '@/lib/lang';
import { validDay } from '@/lib/day';

// Every page, in the reader's language, from the CDN. The pages live under app/[lang]/ and are built once per language
// at deploy (or every few minutes, Home), so this picks the language (lib/lang.ts pickLang: ?lang=, else the lang
// cookie, else the browser's) and rewrites /help to /ru/help; the address stays /help. ?lang= also stays as the
// cookie, so the next page and the game speak it too. /ru/help typed in goes to its real address, /help?lang=ru.
//
// It also keeps the Supabase session fresh: reads the auth cookies, refreshes an expiring token and writes it back.

// search engines' and AI answer engines' crawlers, by their user agents (not the chat apps' link previews: a link
// shared in Telegram or WhatsApp still previews in the sharer's language, as it always has)
const CRAWLER = /googlebot|google-inspectiontool|googleother|storebot-google|bingbot|yandex|duckduckbot|baiduspider|applebot|petalbot|seznambot|slurp|gptbot|oai-searchbot|chatgpt-user|claudebot|claude-user|claude-searchbot|perplexitybot|perplexity-user|ccbot|amazonbot|meta-externalagent|bytespider|ahrefsbot|semrushbot|mj12bot/i;

export async function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const seg = /^\/(en|ru|es|de|tr)(\/.*)?$/.exec(url.pathname);
  if (seg) {
    const to = url.clone();
    to.pathname = seg[2] || '/';
    to.searchParams.set('lang', seg[1]);
    return NextResponse.redirect(to, 308);
  }
  const q = url.searchParams.get('lang');
  const urlLang = isLang(q) ? q : null;
  // the route handlers (sign-in callbacks, /lang, the jib's ad /sponsor, the daily reminder's /push/…) answer at their own
  // address; everything else is a page
  const page = !/^\/(auth\/|lang$|sponsor$|push\/|_)/.test(url.pathname);
  const target = url.clone();
  const hadLang = request.cookies.get('lang')?.value;
  if (page) {
    // a day's rating the API can't have (not a date, after today, too long ago) is a 404 here, as the page itself can
    // only say so after its loading screen has gone out with a 200: no page answers /404, so app/global-not-found does
    const day = /^\/race\/rating\/([^/]+)$/.exec(url.pathname)?.[1];
    const path = day && !validDay(day) ? '/404' : url.pathname;
    // a crawler gets the address's own language (the bare address English, ?lang=ru Russian), whatever its
    // Accept-Language: YandexBot asks for Russian, and served Russian at /help it would take the English address for a
    // copy of /help?lang=ru, the page's canonical, and never index the English
    const lang = pickLang(q, hadLang, CRAWLER.test(request.headers.get('user-agent') || '') ? null : request.headers.get('accept-language'));
    target.pathname = `/${lang}${path === '/' ? '' : path}`;
    target.searchParams.delete('lang');
    // the language chosen, as the request's cookie: the 404 (app/global-not-found.tsx) has no [lang] to read it from
    if (hadLang !== lang) request.cookies.set('lang', lang);
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
  if (urlLang && hadLang !== urlLang) response.cookies.set('lang', urlLang, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return response;
}

export const config = {
  // not for the game's files (and ui/, the design system's stylesheets it shares with the site), the pictures, Next's
  // own assets or the files for crawlers (/play and its folder, not /players)
  matcher: ['/((?!_next/static|_next/image|_vercel|game/|ui/|vendor/|connect|play(?:/|$)|boat-view|hero-view|fleet-view|venue-view|venues-view|images/|flags/|favicon.ico|sw.js|logo-black.svg|og/|robots.txt|sitemap.xml|llms.txt|llms-full.txt|indexnow.txt|manifest.webmanifest|apple-icon|icon).*)'],
};
