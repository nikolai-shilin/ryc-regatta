// Two languages, English and Russian. Copy sits inline as pairs: t('Settings', 'Настройки').
export type Lang = 'en' | 'ru';
export type T = (en: string, ru: string) => string;
export const tx = (lang: Lang): T => (en, ru) => (lang === 'ru' ? ru : en);
export const isLang = (v: unknown): v is Lang => v === 'en' || v === 'ru';

// Russian counts take one of three forms: 1 лодка, 3 лодки, 5 лодок (and 11–14 лодок, 21 лодка, 22 лодки…)
export const ruPlural = (n: number, [one, few, many]: [string, string, string]) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
};
export const ruBoats = (n: number) => `${n} ${ruPlural(n, ['лодка', 'лодки', 'лодок'])}`;

// The reader's language, as proxy.ts picks it for every page: the address's (?lang=ru, the address search engines
// index each language by, lib/seo.ts), else the player's choice (the lang cookie, set by /lang and ?lang=, and read by
// the game too), else the browser's.
export const pickLang = (q: string | null | undefined, cookie: string | null | undefined, acceptLanguage: string | null | undefined): Lang =>
  isLang(q) ? q : isLang(cookie) ? cookie : /^(ru|uk|be|kk)\b/i.test(acceptLanguage || '') ? 'ru' : 'en';
