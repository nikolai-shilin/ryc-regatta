import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { getLang, getT, type LangParams } from '@/lib/i18n';
import { applyMe, readMe } from '@/lib/me';
import { pageMeta, SITE, NAME, HOME_TITLE, HOME_DESC } from '@/lib/seo';
import { TelegramSignIn } from '@/components/telegram-sign-in';
import { BestsSync } from '@/components/bests-sync';
import { PushSync } from '@/components/home-back';
import { Me } from '@/components/me';
import { NavTrail } from '@/components/back-link';
import '@/styles/tokens.css';
import '@/styles/ryc.css';
import '@/public/ui/tokens.css';
import '@/styles/broadcast.css';
import { FONT_VARS } from '@/lib/fonts';
import { NO_ZOOM } from '@/lib/no-zoom';

// The defaults every page starts from: the site's name and the share card. Each page then gives its own title,
// description, canonical address and languages (lib/seo.ts, through titled() in lib/i18n.ts).
// Every language is built at deploy (proxy.ts rewrites /help to /en/help, /ru/help, /es/help, /de/help or /tr/help); no other segment is a page.
export const generateStaticParams = () => [{ lang: 'en' }, { lang: 'ru' }, { lang: 'es' }, { lang: 'de' }, { lang: 'tr' }, { lang: 'fr' }];

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const { lang, t } = await getT(params);
  const base = pageMeta(lang, { title: t(...HOME_TITLE), description: t(...HOME_DESC), absolute: true });
  return {
    ...base,
    metadataBase: new URL(SITE),
    title: { default: t(...HOME_TITLE), template: `%s · ${NAME}` },
    applicationName: NAME,
    authors: [{ name: 'RYC', url: 'https://www.rycrentals.com/' }],
    creator: 'RYC',
    publisher: 'RYC',
    category: 'game',
    // the search consoles' ownership checks, from the environment (Vercel › Settings › Environment Variables), so a
    // code from Google Search Console, Yandex Webmaster or Bing Webmaster Tools needs no commit
    verification: {
      ...(process.env.GOOGLE_SITE_VERIFICATION && { google: process.env.GOOGLE_SITE_VERIFICATION }),
      ...(process.env.YANDEX_VERIFICATION && { yandex: process.env.YANDEX_VERIFICATION }),
      ...(process.env.BING_SITE_VERIFICATION && { other: { 'msvalidate.01': process.env.BING_SITE_VERIFICATION } }),
    },
    // favicon.ico for the small sizes, the broadcast title block as a PNG (app/icon.tsx) for Google's results and an installed app
    icons: { icon: [{ url: '/favicon.ico', sizes: '16x16 32x32 48x48' }, { url: '/icon', type: 'image/png', sizes: '512x512' }], apple: [{ url: '/apple-icon', sizes: '180x180' }] },
  };
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: 'cover', themeColor: '#070d16' }; // the broadcast's ground (public/ui/tokens.css), under the browser's bar

// The IYT mini app opens this site with Telegram's launch data in the hash (#tgWebAppData=…), but the race itself is
// on /play, a page or two later, where the hash is gone. Telegram's own script (loaded by the race page) reads the
// launch data from the hash or, failing that, from sessionStorage under __telegram__initParams, so whichever page
// the player lands on keeps it there in the same shape; then the race knows the Telegram player and names their races.
// It also signs the player in (components/telegram-sign-in), so it comes off the address bar: a copied link must not
// carry it.
const KEEP_TG_LAUNCH = `try{var h=new URLSearchParams(location.hash.slice(1));if(h.get('tgWebAppData')){var k='__telegram__initParams',p=JSON.parse(sessionStorage.getItem(k)||'{}')||{};h.forEach(function(v,n){p[n]=v});sessionStorage.setItem(k,JSON.stringify(p));history.replaceState(history.state,'',location.pathname+location.search)}}catch(e){}`;

// The header's avatar and the footer's account link, from the session cookie before the first paint (lib/me.ts).
const ME = `;(${applyMe.toString()})(${readMe.toString()});`;

// Has this device raced before (lib/log.ts's log has a day, or the game keeps a result): <html data-back> before the
// first paint, so Home shows a returning player their strip and folds the explainers without a flash
// (components/home-back.tsx, styles/home-back.css).
const BACK = `;try{var s=localStorage,l=JSON.parse(s.getItem('regatta-log')||'null'),b=!!(l&&l.d&&Object.keys(l.d).length);for(var i=0;!b&&i<s.length;i++)b=/^regatta-result-/.test(s.key(i)||'');if(b)document.documentElement.setAttribute('data-back','')}catch(e){}`;

export default async function RootLayout({ children, params }: LangParams & { children: React.ReactNode }) {
  const lang = await getLang(params);
  return (
    // suppressHydrationWarning: the head script marks <html> (data-me, --me-ini) before React sees it
    <html lang={lang} className={FONT_VARS} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: KEEP_TG_LAUNCH + ME + BACK + NO_ZOOM }} />
      </head>
      <body>
        {children}
        <TelegramSignIn />
        <BestsSync />
        <PushSync lang={lang} />
        <Me />
        <NavTrail />
        <Analytics />
      </body>
    </html>
  );
}
