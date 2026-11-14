import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getT } from '@/lib/i18n';
import { pageMeta } from '@/lib/seo';
import { getRating, todayUtc, validDay } from '@/lib/rating';
import { getAccount } from '@/lib/supabase/server';
import { RatingView } from '@/components/rating-view';
import { SiteHead, SiteFoot } from '@/components/site-chrome';

type P = { params: Promise<{ lang: string; day: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const [{ day }, { lang, t }] = await Promise.all([params, getT(params)]);
  const date = validDay(day) ? new Date(day + 'T12:00:00Z').toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';
  // one day's table: kept out of search, the rating page itself is the one to find
  return pageMeta(lang, { title: t(`Rating · ${date}`, `Рейтинг · ${date}`), index: false });
}

// R2 · A day's rating, the days before today (today's is /race/rating)
export default async function DayRating({ params }: P) {
  const [{ day }, { lang, t }] = await Promise.all([params, getT(params)]);
  if (!validDay(day)) notFound();
  if (day === todayUtc()) redirect(lang === 'ru' ? '/race/rating?lang=ru' : '/race/rating');
  const [data, account] = await Promise.all([getRating(day), getAccount()]);
  return (
    <div className="scr help hp bc rt-scr" lang={lang}>
      <SiteHead lang={lang} t={t} page="rating" />
      <RatingView day={day} data={data} lang={lang} t={t} signedIn={!!account} />
      <SiteFoot lang={lang} t={t} back={`/race/rating/${day}`} />
    </div>
  );
}
