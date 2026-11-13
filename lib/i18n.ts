import 'server-only';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { isLang, tx, type Lang } from './lang';
import { pageMeta } from './seo';

// The language: the address's (?lang=ru, passed on by proxy.ts as x-lang, so search engines can fetch each language
// at an address of its own), else the player's choice (the lang cookie, set by /lang and read by the game too),
// else the browser's.
export async function getLang(): Promise<Lang> {
  const h = await headers();
  const q = h.get('x-lang');
  if (isLang(q)) return q;
  const c = (await cookies()).get('lang')?.value;
  if (isLang(c)) return c;
  const al = h.get('accept-language') || '';
  return /^(ru|uk|be|kk)\b/i.test(al) ? 'ru' : 'en';
}

export async function getT() {
  const lang = await getLang();
  return { lang, t: tx(lang) };
}

// A page's title, description and share card in the reader's language:
//   export const generateMetadata = titled('Settings', 'Настройки', { index: false });
//   export const generateMetadata = titled('How to play', 'Как играть', { path: '/help', description: ['…', '…'] });
type Opts = { path?: string; description?: [string, string]; index?: boolean };
export const titled = (en: string, ru: string, o: Opts = {}) => async (): Promise<Metadata> => {
  const { lang, t } = await getT();
  return pageMeta(lang, { title: t(en, ru), description: o.description && t(...o.description), path: o.path, index: o.index });
};
