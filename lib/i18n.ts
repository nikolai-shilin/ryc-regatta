import 'server-only';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLang, tx, type Lang } from './lang';
import { pageMeta } from './seo';

// Every page lives under app/[lang]/, a segment no address shows: proxy.ts picks the language (the address's ?lang=,
// else the player's lang cookie, else the browser's) and rewrites /help to /ru/help. So a page is built once per
// language at deploy and served from the CDN, while its address stays /help (and /help?lang=ru, see lib/seo.ts).
export type LangParams = { params: Promise<{ lang: string }> };

export async function getLang(params: LangParams['params']): Promise<Lang> {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return lang;
}

export async function getT(params: LangParams['params']) {
  const lang = await getLang(params);
  return { lang, t: tx(lang) };
}

// A page's title, description and share card in the reader's language:
//   export const generateMetadata = titled('Settings', 'Настройки', { index: false });
//   export const generateMetadata = titled('How to play', 'Как играть', { path: '/help', description: ['…', '…'] });
type Opts = { path?: string; description?: [string, string]; index?: boolean; today?: boolean };
export const titled = (en: string, ru: string, o: Opts = {}) => async ({ params }: LangParams): Promise<Metadata> => {
  const { lang, t } = await getT(params);
  return pageMeta(lang, { title: t(en, ru), description: o.description && t(...o.description), path: o.path, index: o.index, today: o.today });
};
