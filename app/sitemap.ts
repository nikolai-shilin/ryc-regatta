import type { MetadataRoute } from 'next';
import { SITE, langUrl, languages } from '@/lib/seo';

// The pages worth finding, each in English (the bare address) and Russian (?lang=ru), with hreflang links between
// the two so a search engine shows each reader their own language.
const PAGES: [string, number][] = [['/', 1], ['/race', 0.9], ['/help', 0.8], ['/faq', 0.8], ['/race/free', 0.6], ['/boat', 0.5], ['/iyt', 0.6],
  ['/learn', 0.7], ['/learn/rules', 0.8], ['/learn/start', 0.8], ['/learn/shifts', 0.8]];

export default function sitemap(): MetadataRoute.Sitemap {
  const abs = (p: string) => SITE + p;
  return PAGES.flatMap(([path, priority]) => {
    const alternates = { languages: Object.fromEntries(Object.entries(languages(path)).map(([k, v]) => [k, abs(v)])) };
    const changeFrequency = path === '/race' || path === '/' ? 'daily' as const : 'weekly' as const;
    return (['en', 'ru'] as const).map((lang) => ({ url: abs(langUrl(path, lang)), changeFrequency, priority, alternates }));
  });
}
