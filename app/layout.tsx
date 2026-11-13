import type { Metadata, Viewport } from 'next';
import { Merriweather, Carlito } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { getLang, getT } from '@/lib/i18n';
import { pageMeta, SITE, NAME, HOME_TITLE, HOME_DESC } from '@/lib/seo';
import { TelegramSignIn } from '@/components/telegram-sign-in';
import { BestsSync } from '@/components/bests-sync';
import '@/styles/tokens.css';
import '@/styles/ryc.css';

// The RYC look: Carlito for text and controls, Merriweather Light for headings and big numbers; both carry Cyrillic.
const merri = Merriweather({ subsets: ['latin', 'cyrillic'], weight: ['300', '400', '700'], variable: '--f-merri', display: 'swap' });
const carlito = Carlito({ subsets: ['latin', 'cyrillic'], weight: ['400', '700'], variable: '--f-carlito', display: 'swap' });

// The defaults every page starts from: the site's name and the share card. Each page then gives its own title,
// description, canonical address and languages (lib/seo.ts, through titled() in lib/i18n.ts).
export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getT();
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang} className={`${merri.variable} ${carlito.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: KEEP_TG_LAUNCH }} />
      </head>
      <body>
        {children}
        <TelegramSignIn />
        <BestsSync />
        <Analytics />
      </body>
    </html>
  );
}
