import Link from 'next/link';
import type { Lang } from '@/lib/lang';
import { ruPlural } from '@/lib/lang';
import type { Rating } from '@/lib/rating';
import { todayUtc } from '@/lib/rating';
import { dailyRace, KN } from '@/lib/race';
import { venueOf } from '@/lib/venues';
import { IconPlay, IconTrophy } from './ui';
import { Who } from './flag';
import { CountUp } from './count-up';

type T = (en: string, ru: string) => string;
const clock = (s: number) => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(1).padStart(4, '0')}`; };
const at = (d: string) => new Date(d + 'T12:00:00Z');
const shift = (d: string, n: number) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const href = (d: string) => (d === todayUtc() ? '/race/rating' : `/race/rating/${d}`);

// R2 · The day's rating: that day's race (everyone sails the same one), its sailors by their best time with the
// points each took, and the month's standings, the points added up day by day. Days of the month along the top.
export function RatingView({ day, data, lang, t, signedIn }: { day: string; data: Rating | null; lang: Lang; t: T; signedIn: boolean }) {
  const loc = lang === 'ru' ? 'ru-RU' : 'en-GB';
  const today = todayUtc(), isToday = day === today;
  const race = dailyRace(at(day)), venue = venueOf(race.venue);
  const wind = { light: t('Light breeze', 'Слабый ветер'), medium: t('Medium breeze', 'Средний ветер'), strong: t('Strong breeze', 'Сильный ветер') }[race.preset];
  const title = at(day).toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const month = at(day).toLocaleDateString(loc, { month: 'long', timeZone: 'UTC' });
  // the month's days so far, newest first; those with a ranked finisher are marked
  const first = day.slice(0, 8) + '01', last = (() => { const e = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7), 0)).toISOString().slice(0, 10); return e < today ? e : today; })();
  const days: string[] = []; for (let d = last; d >= first; d = shift(d, -1)) days.push(d);
  const raced = new Set(data?.days || []);
  const rows = data?.rows || [], best = rows[0]?.s;
  const n = rows.length;
  const races = (k: number) => t(`${k} ${k === 1 ? 'race' : 'races'}`, `${k} ${ruPlural(k, ['заезд', 'заезда', 'заездов'])}`);
  const pts = (k: number) => t(`${k} ${k === 1 ? 'pt' : 'pts'}`, `${k} ${ruPlural(k, ['очко', 'очка', 'очков'])}`);

  return (
    <>
      <header className="hm-page hm-ph rt-head">
        <span className="kicker">{isToday ? t('Today’s rating', 'Рейтинг дня') : t('Rating', 'Рейтинг')}</span>
        <h1 className="hm-ph-h">{title}</h1>
        <p className="hm-text">
          {t(...venue.name)} · {wind} {KN[race.preset]} {t('kn', 'уз')}
          {data ? <> · {races(data.races)}{n ? <>, {t(`${n} ranked`, `в рейтинге ${n}`)}</> : null}</> : null}
        </p>
        <nav className="rt-days" aria-label={t('Days of the month', 'Дни месяца')}>
          <Link className="rt-step" href={href(shift(day, -1))} aria-label={t('The day before', 'Предыдущий день')} prefetch={false}>‹</Link>
          <div className="rt-strip">
            {days.map((d) => (
              <Link key={d} href={href(d)} className={`rt-day ${d === day ? 'on' : ''} ${raced.has(d) ? 'has' : ''}`} aria-current={d === day ? 'page' : undefined} prefetch={false}>
                <b>{+d.slice(8)}</b><span>{at(d).toLocaleDateString(loc, { weekday: 'short', timeZone: 'UTC' })}</span>
              </Link>
            ))}
          </div>
          {day < today ? <Link className="rt-step" href={href(shift(day, 1))} aria-label={t('The day after', 'Следующий день')} prefetch={false}>›</Link> : <span className="rt-step off" aria-hidden="true">›</span>}
        </nav>
      </header>

      <main className="hm-page rt">
        {!data ? (
          <section className="rt-card rt-empty">
            <span className="lbl-ink">{t('The rating can’t be loaded right now', 'Рейтинг сейчас не загружается')}</span>
            <p>{t('The scores server didn’t answer. Times are still being kept: try again in a minute.', 'Сервер результатов не ответил. Время всё равно записывается — попробуй через минуту.')}</p>
            <a className="rt-go" href="/play?race=today"><IconPlay /><span>{t('Sail today’s race', 'Пройти гонку дня')}</span></a>
          </section>
        ) : (
          <div className="rt-grid">
            <section className="rt-card" aria-labelledby="rt-day-h">
              <div className="rt-card-h"><span className="lbl-ink" id="rt-day-h"><IconTrophy s={13} />{t('The day’s race', 'Гонка дня')}</span><span className="lbl">{t('Best time · points', 'Лучшее время · очки')}</span></div>
              {n ? (
                <ol className="rt-lb">
                  {rows.map((r, i) => {
                    const place = rows.findIndex((x) => x.s === r.s) + 1; // equal times share a place
                    return (
                      <li key={r.k} className={place === 1 ? 'first' : place <= 3 ? 'pod' : ''} style={{ ['--i' as string]: Math.min(i, 12) }}>
                        <span className="rt-n">{place}</span>
                        <Who fl={r.fl} name={r.name || t('No name', 'Без имени')} lang={lang} />
                        <span className="rt-t">{clock(r.s)}{i > 0 && best != null ? <small>+{(r.s - best).toFixed(1)}</small> : null}</span>
                        <span className="rt-p"><b>+{r.pts}</b></span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="rt-none">{isToday ? t('No ranked times yet today. The first to finish takes the top.', 'Сегодня ещё нет результатов в рейтинге. Первый на финише — первый в таблице.') : t('No one ranked on this day.', 'В этот день в рейтинге никого.')}</p>
              )}
              {data.guests > 0 && (
                <p className="rt-guests">
                  {t(`${data.guests} ${data.guests === 1 ? 'race was' : 'races were'} sailed signed out and ${data.guests === 1 ? 'doesn’t' : 'don’t'} rank.`, `${data.guests} ${ruPlural(data.guests, ['заезд пройден', 'заезда пройдено', 'заездов пройдено'])} без входа и не ${data.guests === 1 ? 'попал' : 'попали'} в рейтинг.`)}
                  {!signedIn && <> <Link href={`/sign-in?next=${encodeURIComponent(href(day))}`}>{t('Sign in to rank', 'Войди, чтобы попасть в рейтинг')} ›</Link></>}
                </p>
              )}
              {isToday && <a className="rt-go" href="/play?race=today"><IconPlay /><span>{n ? t('Beat these times', 'Побей эти времена') : t('Sail today’s race', 'Пройти гонку дня')}</span></a>}
            </section>

            <aside className="rt-card rt-month" aria-labelledby="rt-month-h">
              <div className="rt-card-h"><span className="lbl-ink" id="rt-month-h">{t(`${month} standings`, `Итоги: ${month}`)}</span><span className="lbl">{t(`${data.month.days} race ${data.month.days === 1 ? 'day' : 'days'}`, `${data.month.days} ${ruPlural(data.month.days, ['день', 'дня', 'дней'])} гонок`)}</span></div>
              {data.month.rows.length ? (
                <ol className="rt-lb rt-lb-m">
                  {data.month.rows.slice(0, 20).map((r, i) => (
                    <li key={r.k} className={i === 0 ? 'first' : i < 3 ? 'pod' : ''} style={{ ['--i' as string]: Math.min(i, 12) }}>
                      <span className="rt-n">{i + 1}</span>
                      <span className="rt-mw">
                        <Who fl={r.fl} name={r.name || t('No name', 'Без имени')} lang={lang} />
                        <small>{t(`${r.days} ${r.days === 1 ? 'day' : 'days'}`, `${r.days} ${ruPlural(r.days, ['день', 'дня', 'дней'])}`)}{r.wins ? <> · <span className="is-gold">{t(`${r.wins} ${r.wins === 1 ? 'win' : 'wins'}`, `${r.wins} ${ruPlural(r.wins, ['победа', 'победы', 'побед'])}`)}</span></> : null}{r.podiums - r.wins > 0 ? <> · {t(`${r.podiums} podiums`, `подиумов: ${r.podiums}`)}</> : null}</small>
                      </span>
                      <span className="rt-p"><b><CountUp v={String(r.pts)} /></b><small>{t(r.pts === 1 ? 'pt' : 'pts', ruPlural(r.pts, ['очко', 'очка', 'очков']))}</small></span>
                    </li>
                  ))}
                </ol>
              ) : <p className="rt-none">{t('No points yet this month.', 'В этом месяце очков ещё нет.')}</p>}
              <div className="rt-how">
                <span className="lbl-ink">{t('How the points work', 'Как считаются очки')}</span>
                <p>{t('Each day, your best time in that day’s race counts. You get a point for finishing and one more for every sailor you beat: first of ten takes 10, last takes 1. The month adds up the days, so racing every day pays.', 'Каждый день считается твоё лучшее время в гонке дня. Очко за финиш и ещё по одному за каждого, кого ты обогнал: первый из десяти получает 10, последний — 1. За месяц очки складываются, так что гоняться каждый день выгодно.')}</p>
                <p className="rt-ex">{isToday ? t('Today', 'Сегодня') : t('That day', 'В тот день')}: {n ? t(`${n} ranked, so the winner takes ${pts(n)}.`, `в рейтинге ${n}, победитель получает ${pts(n)}.`) : t('no one ranked yet.', 'в рейтинге пока никого.')}</p>
              </div>
            </aside>
          </div>
        )}
        {/* the flags, for a sailor wondering where theirs is */}
        <p className="rt-foot">{t('The flag is the one you fly on ', 'Флаг — тот, что ты поднял на странице ')}<Link href="/boat">{t('your boat', 'своей яхты')}</Link>.</p>
      </main>
    </>
  );
}
