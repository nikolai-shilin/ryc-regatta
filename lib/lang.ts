// Eight languages, English, Russian, Spanish, German, Turkish, French, Italian and Portuguese (Brazil's). Copy sits
// inline, in that order: t('Settings', 'Настройки', 'Ajustes', 'Einstellungen', 'Ayarlar', 'Réglages', 'Impostazioni',
// 'Configurações'). A line with no Spanish, German, Turkish, French, Italian or Portuguese yet reads in English there.
export type Lang = 'en' | 'ru' | 'es' | 'de' | 'tr' | 'fr' | 'it' | 'pt';
export type Pair = [en: string, ru: string, es?: string, de?: string, tr?: string, fr?: string, it?: string, pt?: string];
export type T = (en: string, ru: string, es?: string, de?: string, tr?: string, fr?: string, it?: string, pt?: string) => string;
export const tx = (lang: Lang): T => (en, ru, es, de, tr, fr, it, pt) => (lang === 'ru' ? ru : lang === 'es' ? es ?? en : lang === 'de' ? de ?? en : lang === 'tr' ? tr ?? en : lang === 'fr' ? fr ?? en : lang === 'it' ? it ?? en : lang === 'pt' ? pt ?? en : en);
// where each language's copy sits in a kept [English, Russian, Spanish, German, Turkish, French, Italian, Portuguese]
export const LANG_INDEX: Record<Lang, number> = { en: 0, ru: 1, es: 2, de: 3, tr: 4, fr: 5, it: 6, pt: 7 };
// a kept [English, Russian, Spanish, German, Turkish, French, Italian, Portuguese] in the reader's language
export function pick(p: Pair | readonly string[], lang: Lang): string;
export function pick(p: Pair | readonly string[] | undefined, lang: Lang): string | undefined;
export function pick(p: Pair | readonly string[] | undefined, lang: Lang) { return p && (p[LANG_INDEX[lang]] ?? p[0]); }
export const LANGS: readonly Lang[] = ['en', 'ru', 'es', 'de', 'tr', 'fr', 'it', 'pt'];
export const isLang = (v: unknown): v is Lang => v === 'en' || v === 'ru' || v === 'es' || v === 'de' || v === 'tr' || v === 'fr' || v === 'it' || v === 'pt';
// the locale each language writes its dates and numbers in
export const LOCALE: Record<Lang, string> = { en: 'en-GB', ru: 'ru-RU', es: 'es-ES', de: 'de-DE', tr: 'tr-TR', fr: 'fr-FR', it: 'it-IT', pt: 'pt-BR' };
// the language's name in itself, for the language switchers
export const LANG_NAME: Record<Lang, string> = { en: 'English', ru: 'Русский', es: 'Español', de: 'Deutsch', tr: 'Türkçe', fr: 'Français', it: 'Italiano', pt: 'Português' };

// Russian counts take one of three forms: 1 лодка, 3 лодки, 5 лодок (and 11–14 лодок, 21 лодка, 22 лодки…)
export const ruPlural = (n: number, [one, few, many]: [string, string, string]) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
};
export const ruBoats = (n: number) => `${n} ${ruPlural(n, ['лодка', 'лодки', 'лодок'])}`;
// after «из»: из 1 лодки, из 3 лодок, из 21 лодки
export const ruBoatsOf = (n: number) => `${n} ${ruPlural(n, ['лодки', 'лодок', 'лодок'])}`;

// The reader's language, as proxy.ts picks it for every page: the address's (?lang=ru, the address search engines
// index each language by, lib/seo.ts), else the player's choice (the lang cookie, set by /lang and ?lang=, and read by
// the game too), else the browser's.
export const pickLang = (q: string | null | undefined, cookie: string | null | undefined, acceptLanguage: string | null | undefined): Lang =>
  isLang(q) ? q : isLang(cookie) ? cookie : /^(ru|uk|be|kk)\b/i.test(acceptLanguage || '') ? 'ru' : /^es\b/i.test(acceptLanguage || '') ? 'es' : /^de\b/i.test(acceptLanguage || '') ? 'de' : /^tr\b/i.test(acceptLanguage || '') ? 'tr' : /^fr\b/i.test(acceptLanguage || '') ? 'fr' : /^it\b/i.test(acceptLanguage || '') ? 'it' : /^pt\b/i.test(acceptLanguage || '') ? 'pt' : 'en';
