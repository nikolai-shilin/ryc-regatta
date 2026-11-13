import type { Metadata, Viewport } from 'next';
import { Merriweather, Carlito } from 'next/font/google';
import { getLang } from '@/lib/i18n';
import '@/styles/bundle.css';
import '@/styles/ryc.css';
import '@/styles/app.css';

// The RYC look: Merriweather (Light for headings) and Carlito for labels; both carry Cyrillic.
const merri = Merriweather({ subsets: ['latin', 'cyrillic'], weight: ['300', '400', '700'], variable: '--f-merri', display: 'swap' });
const carlito = Carlito({ subsets: ['latin', 'cyrillic'], weight: ['400', '700'], variable: '--f-carlito', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Up and down — a sailing race game', template: '%s · Up and down' },
  description: 'Race a yacht round a windward–leeward course against the computer boats, in shifting wind, under the real racing rules.',
  icons: { icon: '/favicon.ico' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#ffffff' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang} className={`${merri.variable} ${carlito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
