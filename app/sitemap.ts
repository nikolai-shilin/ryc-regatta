import type { MetadataRoute } from 'next';
import { SITE, langUrl, languages } from '@/lib/seo';
import { LANGS } from '@/lib/lang';
import { GUIDES, GUIDE_DATES } from '@/lib/guides';
import { VENUES } from '@/lib/venues';
import { YACHT_IDS } from '@/lib/yachts';
import { PAGES_DATE } from '@/lib/venue-guides';
import { RULEBOOK_DATE } from '@/lib/rulebook';
import { glossary, dictPath } from '@/lib/glossary';
import { tx } from '@/lib/lang';

// The pages worth finding, each in English (the bare address), Russian (?lang=ru), Spanish (?lang=es), German (?lang=de), Turkish (?lang=tr), French (?lang=fr), Italian (?lang=it) and Portuguese (?lang=pt), with hreflang
// links between them so a search engine shows each reader their own language. lastmod is when the page's text last changed in
// substance (Google reads it, and ignores priority and changefreq); the pages that change every day say today, and a
// page with no date known says none rather than a wrong one.
//
// rebuilt hourly, so the daily pages' date turns over soon after midnight
export const revalidate = 3600;

type Page = [path: string, priority: number, lastmod?: string];
const today = () => new Date().toISOString().slice(0, 10);

export default function sitemap(): MetadataRoute.Sitemap {
  const day = today();
  const PAGES: Page[] = [['/', 1, day], ['/race', 0.9, day], ['/rating', 0.7, day], ['/race/drills', 0.6], ['/help', 0.8], ['/help/race', 0.7], ['/help/duel', 0.7], ['/faq', 0.8], ['/race/free', 0.6], ['/boat', 0.5],
    ['/yachts', 0.6], ...YACHT_IDS.map((id): Page => [`/yachts/${id}`, 0.6, PAGES_DATE]),
    ['/venues', 0.7, PAGES_DATE], ...VENUES.map((v): Page => [`/venues/${v.id}`, 0.6, PAGES_DATE]),
    ['/players', 0.5, day], ['/iyt', 0.6], ['/social', 0.4], ['/sponsorship', 0.4],
    ['/learn', 0.7], ...GUIDES.map((g): Page => [`/learn/${g}`, 0.8, GUIDE_DATES[g].modified]), ['/learn/glossary', 0.7], ['/rulebook', 0.8, RULEBOOK_DATE],
    [dictPath(), 0.7], ...glossary(tx('en')).map((x): Page => [dictPath(x.id), 0.6])];
  const abs = (p: string) => SITE + p;
  return PAGES.flatMap(([path, priority, lastmod]) => {
    const alternates = { languages: Object.fromEntries(Object.entries(languages(path)).map(([k, v]) => [k, abs(v)])) };
    const changeFrequency = lastmod === day ? 'daily' as const : 'weekly' as const;
    return LANGS.map((lang) => ({ url: abs(langUrl(path, lang)), ...(lastmod && { lastModified: lastmod }), changeFrequency, priority, alternates }));
  });
}
