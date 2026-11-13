import type { Metadata, Viewport } from 'next';
import { Merriweather, Carlito } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { getLang, getT } from '@/lib/i18n';
import { TelegramSignIn } from '@/components/telegram-sign-in';
import '@/styles/tokens.css';
import '@/styles/ryc.css';

// The RYC look: Carlito for text and controls, Merriweather Light for headings and big numbers; both carry Cyrillic.
const merri = Merriweather({ subsets: ['latin', 'cyrillic'], weight: ['300', '400', '700'], variable: '--f-merri', display: 'swap' });
const carlito = Carlito({ subsets: ['latin', 'cyrillic'], weight: ['400', '700'], variable: '--f-carlito', display: 'swap' });

// The title and description search engines and link previews show, with the hero picture as the preview image.
export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getT();
  const title = t('Up and down — a sailing race game', 'Up and down — парусная гонка');
  const description = t(
    'A free 3D sailing race in your browser. Win the start, play the wind shifts and race up to six boats round the marks in Göcek bay, under the real racing rules. A new race of the day every midnight.',
    'Бесплатная 3D-парусная гонка в браузере. Возьми старт, лови заходы ветра и обойди до шести лодок в бухте Гёчек по настоящим правилам парусных гонок. Новая гонка дня каждую полночь.');
  return {
    metadataBase: new URL('https://regatta.rycrentals.com'),
    title: { default: title, template: '%s · Up and down' },
    description,
    icons: { icon: '/favicon.ico' },
    openGraph: {
      type: 'website', siteName: 'Up and down', title, description, locale: lang === 'ru' ? 'ru_RU' : 'en_GB',
      images: [{ url: '/images/drone-desk-v3.jpg', alt: t('A race in the game', 'Гонка в игре') }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['/images/drone-desk-v3.jpg'] },
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
        <Analytics />
      </body>
    </html>
  );
}
