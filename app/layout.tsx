import type { Metadata, Viewport } from 'next';
import { Merriweather, Carlito } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { getLang } from '@/lib/i18n';
import { TelegramSignIn } from '@/components/telegram-sign-in';
import '@/styles/tokens.css';
import '@/styles/ryc.css';

// The RYC look: Carlito for text and controls, Merriweather Light for headings and big numbers; both carry Cyrillic.
const merri = Merriweather({ subsets: ['latin', 'cyrillic'], weight: ['300', '400', '700'], variable: '--f-merri', display: 'swap' });
const carlito = Carlito({ subsets: ['latin', 'cyrillic'], weight: ['400', '700'], variable: '--f-carlito', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Up and down — a sailing race game', template: '%s · Up and down' },
  description: 'Race a yacht round a windward–leeward course against the computer boats, in shifting wind, under the real racing rules.',
  icons: { icon: '/favicon.ico' },
};

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
        <Analytics />
      </body>
    </html>
  );
}
