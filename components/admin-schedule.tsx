import { tx, type Lang } from '@/lib/lang';
import { courseDistance, dailyRace, fmtDistance, plannedCourse, KN, SHAPE_NAME, type Daily } from '@/lib/race';
import { venueOf } from '@/lib/venues';
import type { Today } from '@/lib/today';
import { IconClock, IconFlag, clock } from './ui';

// The admin's look at today's race (lib/race.ts dailyRace, the same race the game sails) and the days after it: each
// day's venue, wind and course are fixed by its date, a new one at midnight UTC. Drawn on the server, per request.
const AHEAD = 7;

export function AdminSchedule({ lang, today, now = new Date() }: { lang: Lang; today: Today | null; now?: Date }) {
  const t = tx(lang), L = lang === 'ru' ? 1 : 0;
  const d = dailyRace(now), v = venueOf(d.venue);
  const day = (s: string, weekday: 'short' | 'long' = 'short') =>
    new Date(s + 'T12:00:00Z').toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { weekday, day: 'numeric', month: 'short', timeZone: 'UTC' });
  const metres = (r: Daily) => fmtDistance(courseDistance(plannedCourse(r.preset, r.length, r.fleet, r.course), r.laps), lang).split(' · ')[0];
  const breeze = { light: t('light', 'слабый'), medium: t('medium', 'средний'), strong: t('strong', 'сильный') }[d.preset];
  const live = today && today.d === d.day ? today : null;
  const left = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime();
  const h = Math.floor(left / 36e5), m = Math.floor((left % 36e5) / 6e4);
  const next = Array.from({ length: AHEAD }, (_, i) => dailyRace(new Date(Date.parse(d.day) + (i + 1) * 864e5)));

  return (
    <div className="set-grid adm-day">
      <div className="set-sec">
        <div className="group-k"><IconFlag /><span className="kicker">{t('Today’s race', 'Гонка дня')} · {day(d.day, 'long')}</span></div>
        <div className="srow"><span className="srow-k">{t('Venue', 'Место')}</span><span className="adm-v">{v.name[L]}, {v.place[L]}</span></div>
        <div className="srow"><span className="srow-k">{t('Wind', 'Ветер')}</span><span className="adm-v">{KN[d.preset]} {t('kn', 'уз')} · {breeze} · {v.wind[L]}</span></div>
        <div className="srow"><span className="srow-k">{t('Course', 'Дистанция')}</span><span className="adm-v">{SHAPE_NAME[d.course][L]} · {metres(d)} · {t(`${d.laps} lap`, `${d.laps} круг`)}</span></div>
        <div className="srow"><span className="srow-k">{t('Current', 'Течение')}</span><span className="adm-v">{d.current ? t('Runs across', 'Поперёк') : t('None', 'Нет')}</span></div>
        <div className="srow"><span className="srow-k">{t('Fleet and start', 'Флот и старт')}</span><span className="adm-v">{t(`${d.fleet} boats · ${d.start} min sequence`, `${d.fleet} яхт · старт за ${d.start} мин`)}</span></div>
        <div className="srow">
          <span className="srow-k">{t('Sailed today', 'Пройдено сегодня')}</span>
          <span className="adm-v">{live?.races
            ? t(`${live.races} races${live.top[0] ? ` · best ${clock(live.top[0].s)}${live.top[0].name ? `, ${live.top[0].name}` : ''}` : ''}`,
                `заездов: ${live.races}${live.top[0] ? ` · лучшее ${clock(live.top[0].s)}${live.top[0].name ? `, ${live.top[0].name}` : ''}` : ''}`)
            : t('No races yet', 'Ещё нет заездов')}</span>
        </div>
        <p className="hint adm-day-h">{t(`The same race for every player. The next one starts at midnight UTC, in ${h} h ${m} min.`, `Одна гонка для всех игроков. Следующая — в полночь по UTC, через ${h} ч ${m} мин.`)}</p>
      </div>
      <div className="set-sec">
        <div className="group-k"><IconClock /><span className="kicker">{t(`The next ${AHEAD} days`, `Следующие ${AHEAD} дней`)}</span></div>
        <ol className="adm-sched">
          {next.map((r) => (
            <li key={r.day} className="srow">
              <span className="srow-k"><span className="adm-sched-d">{day(r.day)}</span>{venueOf(r.venue).name[L]}</span>
              <span className="adm-v">{KN[r.preset]} {t('kn', 'уз')} · {SHAPE_NAME[r.course][L]}{r.current ? t(' · current', ' · течение') : ''}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
