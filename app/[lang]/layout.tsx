import type { Metadata, Viewport } from 'next';
import { Merriweather, Carlito, Sofia_Sans, Sofia_Sans_Condensed } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { getLang, getT, type LangParams } from '@/lib/i18n';
import { applyMe } from '@/lib/me';
import { pageMeta, SITE, NAME, HOME_TITLE, HOME_DESC } from '@/lib/seo';
import { TelegramSignIn } from '@/components/telegram-sign-in';
import { BestsSync } from '@/components/bests-sync';
import { Me } from '@/components/me';
import '@/styles/tokens.css';
import '@/styles/ryc.css';
import '@/public/ui/tokens.css';

// The RYC look: Carlito for text and controls, Merriweather Light for headings and big numbers; both carry Cyrillic.
const merri = Merriweather({ subsets: ['latin', 'cyrillic'], weight: ['300', '400', '700'], variable: '--f-merri', display: 'swap' });
const carlito = Carlito({ subsets: ['latin', 'cyrillic'], weight: ['400', '700'], variable: '--f-carlito', display: 'swap' });
// The broadcast look (public/ui/tokens.css, on a screen marked .bc): Sofia Sans Condensed for numbers, names, labels and
// headlines, Sofia Sans for sentences. Both are variable fonts, so one file each covers the weights 500 to 800.
const sofia = Sofia_Sans({ subsets: ['latin', 'latin-ext', 'cyrillic'], variable: '--f-sofia', display: 'swap' });
const sofiaC = Sofia_Sans_Condensed({ subsets: ['latin', 'latin-ext', 'cyrillic'], variable: '--f-sofia-c', display: 'swap' });

// The defaults every page starts from: the site's name and the share card. Each page then gives its own title,
// description, canonical address and languages (lib/seo.ts, through titled() in lib/i18n.ts).
// Both languages are built at deploy (proxy.ts rewrites /help to /en/help or /ru/help); no other segment is a page.
export const generateStaticParams = () => [{ lang: 'en' }, { lang: 'ru' }];

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const { lang, t } = await getT(params);
  const base = pageMeta(lang, { title: t(HOME_TITLE[0], HOME_TITLE[1]), description: t(HOME_DESC[0], HOME_DESC[1]), absolute: true });
  return {
    ...base,
    metadataBase: new URL(SITE),
    title: { default: t(HOME_TITLE[0], HOME_TITLE[1]), template: `%s · ${NAME}` },
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
    // favicon.ico for the small sizes, the badge as a PNG (app/icon.tsx) for Google's results and an installed app
    icons: { icon: [{ url: '/favicon.ico', sizes: '32x32' }, { url: '/icon', type: 'image/png', sizes: '512x512' }], apple: [{ url: '/apple-icon', sizes: '180x180' }] },
  };
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#ffffff' };

// The IYT mini app opens this site with Telegram's launch data in the hash (#tgWebAppData=…), but the race itself is
// on /play, a page or two later, where the hash is gone. Telegram's own script (loaded by the race page) reads the
// launch data from the hash or, failing that, from sessionStorage under __telegram__initParams, so whichever page
// the player lands on keeps it there in the same shape; then the race knows the Telegram player and names their races.
// It also signs the player in (components/telegram-sign-in), so it comes off the address bar: a copied link must not
// carry it.
const KEEP_TG_LAUNCH = `try{var h=new URLSearchParams(location.hash.slice(1));if(h.get('tgWebAppData')){var k='__telegram__initParams',p=JSON.parse(sessionStorage.getItem(k)||'{}')||{};h.forEach(function(v,n){p[n]=v});sessionStorage.setItem(k,JSON.stringify(p));history.replaceState(history.state,'',location.pathname+location.search)}}catch(e){}`;

// The header's avatar and the footer's account link, from the session cookie before the first paint (lib/me.ts).
const ME = `;(${applyMe.toString()})();`;

export default async function RootLayout({ children, params }: LangParams & { children: React.ReactNode }) {
  const lang = await getLang(params);
  return (
    // suppressHydrationWarning: the head script marks <html> (data-me, --me-ini) before React sees it
    <html lang={lang} className={`${merri.variable} ${carlito.variable} ${sofia.variable} ${sofiaC.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: KEEP_TG_LAUNCH + ME }} />
      </head>
      <body>
        {children}
        <TelegramSignIn />
        <BestsSync />
        <Me />
        <Analytics />
      </body>
    </html>
  );
}
