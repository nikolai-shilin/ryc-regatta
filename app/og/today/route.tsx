import { isLang, ruPlural, tx, type Lang } from '@/lib/lang';
import { dailyRace, plannedCourse, KN, BEAT_ANGLE, SHAPE_NAME } from '@/lib/race';
import { yachtOf } from '@/lib/yachts';
import { venueOf } from '@/lib/venues';
import { todayTop } from '@/lib/today';
import { card, CourseSvg, C } from '@/lib/og';

// /og/today?lang=ru&d=2026-11-14 — the share card of the home page and Today's race, as the race's HUD draws (lib/og.tsx):
// today's race and its day, the time to beat so far as the start clock in gold, the wind, the fleet, the length and
// the races sailed as the lower third, and the course on the map. A new picture every day (and as the time to beat
// falls), so a link to the game shared today doesn't look like one shared last week; `d` is only there so chat apps,
// which cache a preview by its address, fetch the new day's.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('lang');
  const lang: Lang = isLang(q) ? q : 'en';
  const t = tx(lang);
  const d = dailyRace(), today = await todayTop();
  const best = today && today.d === d.day ? today.top[0] : null;
  const races = today && today.d === d.day ? today.races : 0;
  const clock = (s: number) => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(1).padStart(4, '0')}`; };
  const date = new Date(d.day + 'T12:00:00Z').toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(/\.$/, '');
  const len = { short: t('Short', 'Короткая'), medium: t('Medium', 'Средняя'), long: t('Long', 'Длинная') }[d.length];
  const kn = t('kn', 'уз');
  const img = await card({
    kind: `${t('Today’s race', 'Гонка дня')} · ${t(...venueOf(d.venue).name)} · ${t(...yachtOf(d.yacht).name)}`,
    tag: { text: date, live: true },
    hero: best
      ? { label: best.name ? `${t('Time to beat', 'Лучшее время')} · ${best.name}` : t('Time to beat', 'Лучшее время'), value: clock(best.s), color: C.gold }
      : { label: t('No time yet today', 'Сегодня ещё никто не финишировал'), value: t('Be first', 'Будь первым') },
    cells: [
      { label: t('Wind', 'Ветер'), value: KN[d.preset], unit: kn },
      { label: t('Fleet', 'Флот'), value: d.fleet, unit: t('boats', ruPlural(d.fleet, ['лодка', 'лодки', 'лодок'])) },
      { label: t('Course', 'Дистанция'), value: len },
      ...(races ? [{ label: t('Today', 'Сегодня'), value: races, unit: t(races === 1 ? 'race' : 'races', ruPlural(races, ['гонка', 'гонки', 'гонок'])) }] : []),
    ],
    call: t('Sail today’s race', 'Пройди гонку дня'),
    panel: {
      title: t('Course', 'Дистанция'), aside: t(...SHAPE_NAME[d.course]),
      body: <CourseSvg course={plannedCourse(d.preset, d.length, d.fleet, d.course, yachtOf(d.yacht))} route={BEAT_ANGLE[d.preset]} wind />,
      keys: [
        { kind: 'line', color: C.gold, label: t('Start', 'Старт') },
        { kind: 'dot', color: C.buoy, label: t('Marks', 'Знаки') },
        { kind: 'arrow', color: C.you, label: `${t('Wind', 'Ветер')} ${KN[d.preset]} ${kn}` },
      ],
    },
  });
  img.headers.set('cache-control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600'); // the time to beat moves
  return img;
}
