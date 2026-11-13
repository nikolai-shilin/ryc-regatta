import type { Metadata } from 'next';
import type { Lang } from './lang';

// What search engines, AI answer engines and link previews (Telegram, WhatsApp, Facebook, X, LinkedIn…) read.
//
// Every page speaks English or Russian from the same address (the lang cookie, else the browser's language). For
// search engines each language also has an address of its own: the bare path is English, ?lang=ru is Russian
// (proxy.ts reads ?lang= ahead of the cookie and keeps it). The canonical and hreflang links point at those, so
// Google and Yandex index both languages instead of whichever one their crawler happened to be served.
export const SITE = 'https://regatta.rycrentals.com';
export const NAME = 'Up and down';
// The share picture: the race from the drone with today's HUD, 1200 × 630 and under 300 KB, so WhatsApp shows it too.
export const OG_IMAGE = { url: '/images/og-v3.jpg', width: 1200, height: 630, type: 'image/jpeg' };

// The home page's title and description, also the defaults for any page that doesn't give its own.
export const HOME_TITLE: [string, string] = ['Up and down — a free online sailing race game', 'Up and down — парусная гонка и симулятор яхты онлайн'];
export const HOME_DESC: [string, string] = [
  'A free 3D sailing game and yacht race simulator in your browser. Win the start, play the wind shifts and race up to six boats round the marks in Göcek bay, under the real racing rules. A new race of the day every midnight.',
  'Бесплатный 3D-парусный симулятор и гонка яхт в браузере. Возьми старт, лови заходы ветра и обойди до шести лодок в бухте Гёчек по настоящим правилам парусных гонок. Новая гонка дня каждую полночь.'];

export const langUrl = (path: string, lang: Lang) => (lang === 'ru' ? `${path}?lang=ru` : path);
export const languages = (path: string) => ({ en: langUrl(path, 'en'), ru: langUrl(path, 'ru'), 'x-default': path });

type PageMeta = {
  title: string;
  description?: string;
  path?: string; // the page's own address, for the canonical and hreflang links; left out on pages kept out of search
  index?: boolean; // false: noindex (account pages, a result that lives on one device)
  absolute?: boolean; // the title as is, without " · Up and down"
};

export function pageMeta(lang: Lang, { title, description, path, index = true, absolute = false }: PageMeta): Metadata {
  const full = absolute ? title : `${title} · ${NAME}`;
  const url = path ? langUrl(path, lang) : undefined;
  const alt = (lang === 'ru' ? 'Гонка в игре' : 'A race in the game');
  return {
    title: absolute ? { absolute: title } : title,
    ...(description && { description }),
    ...(path && { alternates: { canonical: url, languages: languages(path) } }),
    ...(!index && { robots: { index: false, follow: true } }),
    openGraph: {
      type: 'website', siteName: NAME, title: full, ...(description && { description }), ...(url && { url }),
      locale: lang === 'ru' ? 'ru_RU' : 'en_GB', alternateLocale: lang === 'ru' ? ['en_GB'] : ['ru_RU'],
      images: [{ ...OG_IMAGE, alt }],
    },
    twitter: { card: 'summary_large_image', title: full, ...(description && { description }), images: [{ url: OG_IMAGE.url, alt }] },
  };
}

// Escaped for a <script type="application/ld+json">: no "</script>" can close it early.
export const jsonLd = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, '\\u003c') });
