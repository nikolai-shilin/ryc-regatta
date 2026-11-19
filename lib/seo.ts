import type { Metadata } from 'next';
import { LANGS, LOCALE, tx, type Lang, type Pair } from './lang.ts'; // with its extension, so npm test's Node finds it too

// What search engines, AI answer engines and link previews (Telegram, WhatsApp, Facebook, X, LinkedIn…) read.
//
// Every page speaks English or Russian from the same address (the lang cookie, else the browser's language). For
// search engines each language also has an address of its own: the bare path is English, ?lang=ru is Russian
// (proxy.ts reads ?lang= ahead of the cookie and keeps it). The canonical and hreflang links point at those, so
// Google and Yandex index both languages instead of whichever one their crawler happened to be served.
export const SITE = 'https://www.sailupdown.com';
export const NAME = 'Up and down';
// The share picture: the race from the drone with today's HUD, 1200 × 630 and under 300 KB, so WhatsApp shows it too.
export const OG_IMAGE = { url: '/images/og-v9.jpg', width: 1200, height: 630, type: 'image/jpeg' };

// The home page's title and description, also the defaults for any page that doesn't give its own.
export const HOME_TITLE: Pair = ['Up and down — a free online sailing race game', 'Up and down — парусная гонка и симулятор яхты онлайн', 'Up and down — un juego de regatas de vela gratis en línea'];
export const HOME_DESC: Pair = [
  'A free 3D sailing game and yacht race simulator in your browser. Win the start, play the wind shifts and race up to six boats round the marks at famous regatta venues, under the real racing rules. A new race of the day every midnight.',
  'Бесплатный 3D-парусный симулятор и гонка яхт в браузере. Возьми старт, лови заходы ветра и обойди до шести лодок на знаменитых регатных акваториях по настоящим правилам парусных гонок. Новая гонка дня каждую полночь.', 'Un juego de vela en 3D y simulador de regatas de yates gratis en tu navegador. Gana la salida, juega con las roladas del viento y compite con hasta seis barcos alrededor de las balizas en famosas sedes de regatas, con el reglamento real. Cada medianoche, una nueva regata del día.'];

// IndexNow (Bing, Yandex and others): the key is public by design, served at /indexnow.txt; scripts/indexnow.mjs
// sends the sitemap's addresses after a deploy, so new and changed pages are crawled within minutes, not weeks.
export const INDEXNOW_KEY = '98bc80b477c59bf3f8eb4da1345aa18d';

export const langUrl = (path: string, lang: Lang) => (lang === 'en' ? path : `${path}?lang=${lang}`);
export const languages = (path: string) => ({ en: langUrl(path, 'en'), ru: langUrl(path, 'ru'), es: langUrl(path, 'es'), 'x-default': path });
const OG_LOCALE: Record<Lang, string> = { en: 'en_GB', ru: 'ru_RU', es: 'es_ES' };

type PageMeta = {
  title: string;
  description?: string;
  path?: string; // the page's own address, for the canonical and hreflang links; left out on pages kept out of search
  index?: boolean; // false: noindex (account pages, a result that lives on one device)
  absolute?: boolean; // the title as is, without " · Up and down"
  today?: boolean; // the share card is today's race (app/og/today), not the site's picture: home and Today's race
  // the page's own drawn share card (app/og/page/[key]): its address without the language, e.g. '/og/page/yachts' or
  // '/og/page/player?p=…'; live ones (the rating, the players) carry the day too, so chat apps fetch the new day's
  card?: string; live?: boolean;
};

export function pageMeta(lang: Lang, { title, description, path, index = true, absolute = false, today = false, card, live = false }: PageMeta): Metadata {
  const full = absolute ? title : `${title} · ${NAME}`;
  const url = path ? langUrl(path, lang) : undefined;
  const alt = today ? tx(lang)('Today’s race: the wind, the course and the time to beat', 'Гонка дня: ветер, дистанция и время, которое нужно побить', 'La regata del día: el viento, el recorrido y el tiempo a batir')
    : card ? full : tx(lang)('A race in the game', 'Гонка в игре', 'Una regata en el juego');
  // today's card carries the day in its address, so a chat app fetches the new day's instead of its cached one
  const day = new Date().toISOString().slice(0, 10);
  const drawn = (u: string) => ({ url: u, width: 1200, height: 630, type: 'image/jpeg' });
  const image = today ? drawn(`/og/today?lang=${lang}&d=${day}`)
    : card ? drawn(`${card}${card.includes('?') ? '&' : '?'}lang=${lang}${live ? `&d=${day}` : ''}`) : OG_IMAGE;
  return {
    title: absolute ? { absolute: title } : title,
    ...(description && { description }),
    ...(path && { alternates: { canonical: url, languages: languages(path) } }),
    ...(!index && { robots: { index: false, follow: true } }),
    openGraph: {
      type: 'website', siteName: NAME, title: full, ...(description && { description }), ...(url && { url }),
      locale: OG_LOCALE[lang], alternateLocale: LANGS.filter((l) => l !== lang).map((l) => OG_LOCALE[l]),
      images: [{ ...image, alt }],
    },
    twitter: { card: 'summary_large_image', title: full, ...(description && { description }), images: [{ url: image.url, alt }] },
  };
}

// Who writes the guides and the venue pages: the byline under each one's title and the author in its Article data.
// sameAs: the author's public profiles, so search engines and AI assistants can tell who he is.
export const AUTHOR = { name: ['Nikolai Shilin', 'Николай Шилин', 'Nikolai Shilin'] as Pair, org: 'RYC', sameAs: [] as string[] };
export const RYC_LD = { '@type': 'Organization', '@id': `${SITE}/#ryc`, name: 'RYC', url: 'https://www.rycrentals.com/', logo: { '@type': 'ImageObject', url: `${SITE}/logo-black.svg` } };
export const AUTHOR_LD = {
  '@type': 'Person', '@id': `${SITE}/#author`, name: AUTHOR.name[0], alternateName: AUTHOR.name[1], worksFor: RYC_LD,
  ...(AUTHOR.sameAs.length && { sameAs: AUTHOR.sameAs }),
};
// a date as the bylines say it: 17 November 2026, 17 ноября 2026 г.
export const longDate = (day: string, lang: Lang) => new Date(day + 'T12:00:00Z').toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// Escaped for a <script type="application/ld+json">: no "</script>" can close it early.
export const jsonLd = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, '\\u003c') });
