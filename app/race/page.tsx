import type { Metadata } from 'next';
import Image from 'next/image';
import { getT } from '@/lib/i18n';
import { getAccount } from '@/lib/supabase/server';
import { todayTop } from '@/lib/today';
import { courseDistance, dailyRace, fmtDistance, plannedCourse, KN } from '@/lib/race';
import { IconPlay, IconWind, IconRoute, IconBoats, IconFlag, clock } from '@/components/ui';
import { SiteHead } from '@/components/site-chrome';
import { TodayChips, FreeCard } from '@/components/hub-client';
import { MyRow } from '@/components/home-client';

export const metadata: Metadata = { title: 'Race hub' };

// I1 · The race hub, as a rycrentals subpage: today's race in the head, its course with the tag and the start,
// today's fastest beside it, and a free race one tap away.
export default async function Hub() {
  const { lang, t } = await getT();
  const [account, today] = await Promise.all([getAccount(), todayTop()]);
  const d = dailyRace();
  const wind = { light: t('Light breeze', 'Слабый ветер'), medium: t('Medium breeze', 'Средний ветер'), strong: t('Strong breeze', 'Сильный ветер') }[d.preset];
  const course = { short: t('short', 'короткий'), medium: t('medium', 'средний'), long: t('long', 'длинный') }[d.length];
  const title = t(`${wind}, ${d.fleet} boats, one ${course} lap`, `${wind}, ${d.fleet} лодок, один ${course} круг`);
  const date = new Date(d.day + 'T12:00:00Z').toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  // the tiles show the race; the chip says it is fixed for today and, tapped, why (and how to make it a free race)
  const chips = [t('The same for everyone today', 'Одна для всех сегодня')];
  const top = today && today.d === d.day ? today.top : [];

  const best = top[0];
  const metres = fmtDistance(courseDistance(plannedCourse(d.preset, d.length, d.fleet, d.course), d.laps), lang).split(' · ')[0];
  const breeze = { light: t('Light breeze', 'Слабый ветер'), medium: t('Medium breeze', 'Средний ветер'), strong: t('Strong breeze', 'Сильный ветер') }[d.preset];
  // today's race in four tiles, as rycrentals sums up a selection: an icon and a label, the figure, a line under it
  const tiles: [React.ReactNode, string, string, string][] = [
    [<IconWind key="w" s={14} />, t('Wind', 'Ветер'), `${KN[d.preset]} ${t('kn', 'уз')}`, t(`${breeze}, shifting`, `${breeze}, переменчивый`)],
    [<IconRoute key="c" />, t('Course', 'Дистанция'), metres, t(`Up and down, ${d.laps} lap`, `Апвинд — даунвинд, ${d.laps} круг`)],
    [<IconBoats key="f" />, t('Fleet', 'Флот'), String(d.fleet), t(`You and ${d.fleet - 1} computer boats`, `Ты и ${d.fleet - 1} компьютерных лодки`)],
    [<IconFlag key="s" />, t('Start', 'Старт'), t(`${d.start} min`, `${d.start} мин`), d.current ? t('A current runs across', 'Течение поперёк дистанции') : t('Class flag, P, the gun', 'Флаг класса, P, сигнал')],
  ];
  const races = today && today.d === d.day ? today.races : 0;

  return (
    <div className="scr app" lang={lang} data-acct={account ? 'signed' : 'guest'}>
      <SiteHead lang={lang} t={t} account={account} page="race" />
      <div className="lay page hub-page">
        <div className="aph">
          <span className="kicker">{t('Today’s race', 'Гонка дня')} · {date}</span>
          <h1 className="aph-h">{title}</h1>
          <p className="aph-p">{best
            ? t(`The same race for everyone today: ${races} sailed so far, the best in ${clock(best.s)}.`, `Сегодня у всех одна гонка: уже ${races} заездов, лучшее время ${clock(best.s)}.`)
            : t('The same race for everyone today, so the times compare fairly. Nobody has finished it yet.', 'Сегодня у всех одна гонка, поэтому время сравнивается честно. Её ещё никто не прошёл.')}</p>
        </div>
        <div className="hub2">
          <div className="hub-main">
            <a className="hub-photo" href="/play?race=today">
              <span className="hm-clip"><Image src="/images/top-v2.jpg" alt={t('Today’s course from above', 'Дистанция дня сверху')} fill sizes="(min-width: 1024px) 680px, 100vw" /></span>
              <span className="hm-ptag"><span className="hm-ptag-a">{KN[d.preset]} {t('kn', 'уз')}</span><span className="hm-ptag-b"><span>{t('Today', 'Сегодня')}</span><b>{t(`${d.laps} lap`, `${d.laps} круг`)}</b><span>{t(`${d.fleet} boats`, `${d.fleet} лодок`)}</span></span></span>
            </a>
            <dl className="qstats">
              {tiles.map(([ico, k, v, note]) => (
                <div key={k}><dt className="meta">{ico}{k}</dt><dd className="qstat-v">{v}</dd><dd className="hm-meta">{note}</dd></div>
              ))}
            </dl>
            <TodayChips lang={lang} chips={chips} day={date} />
            <a className="pill pill-primary" href="/play?race=today"><IconPlay /><span className="btn-t">{t('Start today’s race', 'Начать гонку дня')}</span></a>
          </div>
          <div className="hub-side">
            <div className="hm-board hub-board">
              <div className="hm-board-h"><span className="meta">{t('Today’s fastest', 'Самые быстрые сегодня')}</span>{races ? <span className="meta">{t(`${races} races`, `заездов: ${races}`)}</span> : null}</div>
              <ol className="hm-lb">
                {top.map((r, i) => (
                  <li key={i} className={i === 0 ? 'first' : ''}>
                    <span className="hm-n">{i + 1}</span><span>{r.name || t('Guest', 'Гость')}</span>
                    <span className="hm-t">{clock(r.s)}{i > 0 && best ? <small>+{(r.s - best.s).toFixed(1)}</small> : null}</span>
                  </li>
                ))}
                {!top.length && <li><span className="hm-n">·</span><span className="hm-muted">{t('No times yet today', 'Сегодня ещё нет результатов')}</span><span /></li>}
                <MyRow lang={lang} day={d.day} signedIn={!!account} next="/race" />
              </ol>
            </div>
            <FreeCard lang={lang} />
          </div>
        </div>
      </div>
    </div>
  );
}
