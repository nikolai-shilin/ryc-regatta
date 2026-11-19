import { getT, titled, type LangParams } from '@/lib/i18n';
import { getRating, todayUtc } from '@/lib/rating';
import { RatingView } from '@/components/rating-view';
import { SiteHead, SiteFoot } from '@/components/site-chrome';

// Built for everyone alike, again every five minutes as the scores API's answer is (lib/rating.ts)
export const revalidate = 300;

export const generateMetadata = titled('Today’s leaderboard', 'Рейтинг дня', 'Clasificación de hoy', 'Rangliste von heute', {
  path: '/race/rating', card: '/og/page/rating', live: true,
  description: [
    'Today’s race ranked: every sailor’s best time in the day’s race, the points each took, and the month’s standings, with the flags they fly.',
    'Гонка дня в рейтинге: лучшее время каждого гонщика, очки за день и итоги месяца, с флагами, под которыми они ходят.', 'La regata del día clasificada: el mejor tiempo de cada regatista en la regata del día, los puntos que sumó cada uno y la clasificación del mes, con las banderas que enarbolan.', 'Die Regatta des Tages in der Rangliste: die beste Zeit jedes Seglers in der Regatta des Tages, die Punkte, die jeder bekam, und die Monatswertung, mit den Flaggen, die sie führen.',
  ],
});

// R2 · Today's rating (the days before have their own address, /race/rating/YYYY-MM-DD)
export default async function TodayRating({ params }: LangParams) {
  const day = todayUtc();
  const [{ lang, t }, data] = await Promise.all([getT(params), getRating(day)]);
  return (
    <div className="scr help hp bc rt-scr" lang={lang}>
      <SiteHead lang={lang} t={t} page="rating" />
      <RatingView day={day} data={data} lang={lang} t={t} />
      <SiteFoot lang={lang} t={t} back="/race/rating" />
    </div>
  );
}
