import 'server-only';
import { cookies, headers } from 'next/headers';
import { isLang, tx, type Lang } from './lang';

// The language: the player's choice (the lang cookie, set by /lang and read by the game too), else the browser's.
export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get('lang')?.value;
  if (isLang(c)) return c;
  const al = (await headers()).get('accept-language') || '';
  return /^(ru|uk|be|kk)\b/i.test(al) ? 'ru' : 'en';
}

export async function getT() {
  const lang = await getLang();
  return { lang, t: tx(lang) };
}
