import { getT, titled, type LangParams } from '@/lib/i18n';
import { getRating, todayUtc } from '@/lib/rating';
import { getAccount } from '@/lib/supabase/server';
import { RatingView } from '@/components/rating-view';
import { SiteHead, SiteFoot } from '@/components/site-chrome';

export const generateMetadata = titled('Today’s rating', 'Рейтинг дня', {
  path: '/race/rating',
  description: [
    'Today’s race ranked: every sailor’s best time in the day’s race, the points each took, and the month’s standings, with the flags they fly.',
    'Гонка дня в рейтинге: лучшее время каждого гонщика, очки за день и итоги месяца, с флагами, под которыми они ходят.',
  ],
});

// R2 · Today's rating (the days before have their own address, /race/rating/YYYY-MM-DD)
export default async function TodayRating({ params }: LangParams) {
  const day = todayUtc();
  const [{ lang, t }, data, account] = await Promise.all([getT(params), getRating(day), getAccount()]);
  return (
    <div className="scr help hp bc rt-scr" lang={lang}>
      <SiteHead lang={lang} t={t} page="rating" />
      <RatingView day={day} data={data} lang={lang} t={t} signedIn={!!account} />
      <SiteFoot lang={lang} t={t} back="/race/rating" />
    </div>
  );
}
