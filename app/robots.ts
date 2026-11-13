import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/seo';

// For search engines and AI crawlers. The account pages and a race result stay crawlable so their noindex is seen
// (a page only blocked here can still be listed, without its text); only the sign-in plumbing and the language
// switch are off limits. The bare game (/play) carries its own noindex header.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/auth/', '/lang'] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
