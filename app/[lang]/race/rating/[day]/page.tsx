import { LOCALE } from '@/lib/lang';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getT } from '@/lib/i18n';
import { pageMeta } from '@/lib/seo';
import { getRating, todayUtc, validDay } from '@/lib/rating';
import { RatingView } from '@/components/rating-view';
import { SiteHead, SiteFoot } from '@/components/site-chrome';

type P = { params: Promise<{ lang: string; day: string }> };

// Each day built the first time it is asked for, then served as it is: the same for everyone (whether you're signed in
// is the browser's to show). Again every five minutes, so yesterday stops sending you to today's soon after midnight;
// a past day's rating itself is cached an hour (lib/rating.ts), so that costs next to nothing.
export const revalidate = 300;
export const generateStaticParams = () => [];

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const [{ day }, { lang, t }] = await Promise.all([params, getT(params)]);
  const date = validDay(day) ? new Date(day + 'T12:00:00Z').toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';
  // one day's table: kept out of search, the rating page itself is the one to find
  return pageMeta(lang, { title: t(`Leaderboard · ${date}`, `Рейтинг · ${date}`, `Clasificación · ${date}`, `Rangliste · ${date}`), index: false, ...(validDay(day) && { card: `/og/page/rating?day=${day}` }) });
}

// R2 · A day's rating, the days before today (today's is /race/rating)
export default async function DayRating({ params }: P) {
  const [{ day }, { lang, t }] = await Promise.all([params, getT(params)]);
  if (!validDay(day)) notFound();
  if (day === todayUtc()) redirect(lang === 'en' ? '/race/rating' : `/race/rating?lang=${lang}`);
  const data = await getRating(day);
  return (
    <div className="scr help hp bc rt-scr" lang={lang}>
      <SiteHead lang={lang} t={t} page="rating" />
      <RatingView day={day} data={data} lang={lang} t={t} />
      <SiteFoot lang={lang} t={t} back={`/race/rating/${day}`} />
    </div>
  );
}
