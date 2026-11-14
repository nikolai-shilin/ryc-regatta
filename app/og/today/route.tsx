import { isLang, ruBoats, tx, type Lang } from '@/lib/lang';
import { dailyRace, plannedCourse, KN, BEAT_ANGLE, SHAPE_NAME } from '@/lib/race';
import { venueOf } from '@/lib/venues';
import { todayTop } from '@/lib/today';
import { card, CourseSvg } from '@/lib/og';

// /og/today?lang=ru&d=2026-11-14 — the share card of the home page and Today's race: today's race (the wind, the
// fleet, the course, drawn), and the time to beat so far. A new picture every day (and as the time to beat falls), so a
// link to the game shared today doesn't look like one shared last week; `d` is only there so chat apps, which cache a
// preview by its address, fetch the new day's.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('lang');
  const lang: Lang = isLang(q) ? q : 'en';
  const t = tx(lang);
  const d = dailyRace(), today = await todayTop();
  const best = today && today.d === d.day ? today.top[0] : null;
  const clock = (s: number) => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(1).padStart(4, '0')}`; };
  const date = new Date(d.day + 'T12:00:00Z').toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const wind = { light: t('Light breeze', 'Слабый ветер'), medium: t('Medium breeze', 'Средний ветер'), strong: t('Strong breeze', 'Сильный ветер') }[d.preset];
  const len = { short: t('short', 'короткая'), medium: t('medium', 'средняя'), long: t('long', 'длинная') }[d.length];
  const shape = t(...SHAPE_NAME[d.course]).toLowerCase();
  const races = today && today.d === d.day && today.races ? t(` · ${today.races} races sailed`, ` · пройдено гонок: ${today.races}`) : '';
  const img = await card({
    kind: `${t('Today’s race', 'Гонка дня')} · ${date} · ${t(...venueOf(d.venue).name)}`,
    headline: best ? t(`Time to beat: ${clock(best.s)}`, `Побей ${clock(best.s)}`) : t('Be first today', 'Будь первым'),
    detail: `${wind} ${KN[d.preset]} ${t('kn', 'уз')} · ${t(`${d.fleet} boats`, ruBoats(d.fleet))} · ${shape} · ${len}${races}`,
    call: t('Sail today’s race', 'Пройди гонку дня'),
    windLabel: `${KN[d.preset]} ${t('kn', 'уз')}`,
    panel: <CourseSvg course={plannedCourse(d.preset, d.length, d.fleet, d.course)} route={BEAT_ANGLE[d.preset]} wind />,
  });
  img.headers.set('cache-control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600'); // the time to beat moves
  return img;
}
