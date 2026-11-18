import Link from 'next/link';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { ruBoats } from '@/lib/lang';
import { todayTop } from '@/lib/today';
import { Who as LbWho } from '@/components/flag';
import { DailyLock } from '@/components/daily-lock';
import { ruPlural } from '@/lib/lang';
import { courseDistance, dailyRace, fmtDistance, plannedCourse, KN, SHAPE_NAME } from '@/lib/race';
import { yachtOf } from '@/lib/yachts';
import { venueOf } from '@/lib/venues';
import { BackLink } from '@/components/back-link';
import { IconPlay, IconTrophy, IconSliders, Num, clock } from '@/components/ui';
import { FreeQuick, MatchCard } from '@/components/hub-client';
import { PassportRow } from '@/components/passport';
import { ProgressRows, RivalRow } from '@/components/progress';
import { SceneBrand } from '@/components/scene-brand';
import { GameScene } from '@/components/game-scene';
import { PauseCard } from '@/components/pause-card';
import { MyRow } from '@/components/home-client';

// Built for everyone alike and refreshed every five minutes, as Home is (today's fastest move): who is signed in is
// the browser's to show (lib/me.ts: .if-me, .if-guest, the initials; the pause card's account reads the cookie).
export const revalidate = 300;

export const generateMetadata = titled('Race hub: today’s sailing race and free races', 'Меню гонок: парусная гонка дня и свободные гонки', {
  path: '/race',
  today: true,
  description: [
    'Today’s race: the same venue, wind, course and fleet for every player, a new one at midnight UTC. Sail it as often as you like, beat today’s fastest times, or set up a free race of your own.',
    'Гонка дня: одинаковые место, ветер, дистанция и флот для всех, новая — каждую полночь по UTC. Проходи сколько хочешь, побей лучшие времена дня или настрой свою свободную гонку.'],
});

// I1 · The race hub, as the race's pause screen: today's venue in the game's own scene behind it all (today's yacht afloat
// there on a clear evening, in today's wind), the race's place and numbers over it, and in the pause menu's glass
// card the start, today's fastest and a free race one tap away.
export default async function Hub({ params }: LangParams) {
  const { lang, t } = await getT(params);
  const today = await todayTop();
  const d = dailyRace(), v = venueOf(d.venue), L = lang === 'ru' ? 1 : 0, boat = yachtOf(d.yacht);
  const date = new Date(d.day + 'T12:00:00Z').toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const top = today && today.d === d.day ? today.top : [];
  const best = top[0];
  const metres = fmtDistance(courseDistance(plannedCourse(d.preset, d.length, d.fleet, d.course, boat), d.laps), lang).split(' · ')[0];
  const breeze = { light: t('Light breeze', 'Слабый ветер'), medium: t('Medium breeze', 'Средний ветер'), strong: t('Strong breeze', 'Сильный ветер') }[d.preset];
  const races = today && today.d === d.day ? today.races : 0;

  return (
    <div className="scr bt-scr bc" lang={lang}>
      <div className="bt">
        <GameScene venue={d.venue} boat={d.yacht} wind={d.preset} title={t('Today’s venue in 3D', 'Место гонки дня в 3D')} loading={t('Loading the venue', 'Загружаем место гонки')} />

        <div className="bt-info">
          <div className="bt-top">
            <BackLink href="/" label={t('Home', 'На главную')} />
            <SceneBrand />
            <span className="bt-top-r">
              <span className="bt-tick"><span className="dot-live" aria-hidden="true" /><time dateTime={d.day}>{date}</time></span>
              <Link className="bt-ico" href="/help" aria-label={t('How to play', 'Как играть')} title={t('How to play', 'Как играть')}>?</Link>
            </span>
          </div>
          <span className="bt-kick">{t('Today’s race', 'Гонка дня')} · {boat.name[L]}</span>
          <h1 className="bt-h bt-hero">{v.name[L]} <span className="bt-h-cc">{v.nation}</span></h1>
          <p className="bt-p">{v.place[L]}. {v.about[L]} {best
            ? t(`The same race for everyone today, in the ${boat.name[0]}: ${races} sailed so far.`, `Сегодня у всех одна гонка, на ${boat.name[1]}: уже ${races} ${ruPlural(races, ['заезд', 'заезда', 'заездов'])}.`)
            : t(`The same race for everyone today, in the ${boat.name[0]}. Nobody has finished it yet.`, `Сегодня у всех одна гонка, на ${boat.name[1]}. Её ещё никто не прошёл.`)} {t('A new yacht every day.', 'Каждый день — новая яхта.')}</p>
          <div className="bt-stats bt-stats-lock">
            <div data-lock role="button" tabIndex={0} aria-haspopup="dialog"><span className="bt-sk">{t('Wind', 'Ветер')}</span><b><Num v={`${KN[d.preset]} ${t('kn', 'уз')}`} /></b><span className="bt-sv">{t(`${breeze}, shifting`, `${breeze}, переменчивый`)}</span></div>
            <div data-lock role="button" tabIndex={0} aria-haspopup="dialog"><span className="bt-sk">{t('Course', 'Дистанция')}</span><b><Num v={metres} /></b><span className="bt-sv">{t(`${SHAPE_NAME[d.course][0]} · ${d.laps} lap`, `${SHAPE_NAME[d.course][1]} · ${d.laps} круг`)}</span></div>
            <div data-lock role="button" tabIndex={0} aria-haspopup="dialog"><span className="bt-sk">{t('Fleet', 'Флот')}</span><b>{d.fleet}</b><span className="bt-sv">{t(`You and ${d.fleet - 1} boats`, `Ты и ${ruBoats(d.fleet - 1)}`)}</span></div>
            <div data-lock role="button" tabIndex={0} aria-haspopup="dialog"><span className="bt-sk">{t('Start', 'Старт')}</span><b><Num v={t(`${d.start} min`, `${d.start} мин`)} /></b><span className="bt-sv">{d.current ? t('A current runs across', 'Течение поперёк') : t('Class flag, P, the gun', 'Флаг класса, P, сигнал')}</span></div>
          </div>
        </div>

        <PauseCard lang={lang} back="/race" title={t('Today’s race', 'Гонка дня')}
          tools={<>
            <Link className="bt-acct bt-acct-me if-me me-ini" href="/settings" aria-label={t('Settings, signed in', 'Настройки, ты вошёл')} />
            <Link className="bt-acct if-guest" href="/sign-in?next=/race">{t('Sign in', 'Войти')}</Link>
          </>}
          action={<a className="bt-go" href="/play?race=today"><IconPlay /><span>{t('Start today’s race', 'Начать гонку дня')}</span></a>}>
          <div className="bt-g">
            <span className="bt-k"><IconTrophy />{t('Today’s fastest', 'Самые быстрые сегодня')}{races ? <span className="bt-k-r">{t(`${races} ${races === 1 ? 'race' : 'races'}`, `заездов: ${races}`)}</span> : null}</span>
            <ol className="hm-lb bt-lb">
              {top.map((r, i) => (
                <li key={i} className={i === 0 ? 'first' : ''}>
                  <span className="hm-n">{i + 1}</span><LbWho fl={r.fl} name={r.name || t('No name', 'Без имени')} lang={lang} />
                  <span className="hm-t">{clock(r.s)}{i > 0 && best ? <small>+{(r.s - best.s).toFixed(1)}</small> : null}</span>
                </li>
              ))}
              {!top.length && <li><span className="hm-n">·</span><span className="hm-muted">{t('No times yet today', 'Сегодня ещё нет результатов')}</span><span /></li>}
              <MyRow lang={lang} day={d.day} top={top} cap={today?.n} next="/race" />
            </ol>
            <Link className="lb-more" href="/race/rating">{t('Full rating and the month’s points', 'Весь рейтинг и очки за месяц')}</Link>
          </div>
          <FreeQuick lang={lang} />
          <MatchCard lang={lang} />
          <div className="bt-rows">
            <button type="button" className="bt-row" data-lock aria-haspopup="dialog"><IconSliders /><span>{t('Change the wind or course', 'Изменить ветер или дистанцию')}</span><span className="bt-row-m bt-row-opt">{t('A free race', 'Свободная гонка')}</span></button>
            <PassportRow lang={lang} />
            <RivalRow lang={lang} />
            <ProgressRows lang={lang} />
          </div>
        </PauseCard>
      </div>
      <DailyLock lang={lang} chips={[`${t(...venueOf(d.venue).name)}`, t(...boat.name), `${breeze} ${KN[d.preset]} ${t('kn', 'уз')}`, `${t(...SHAPE_NAME[d.course])} · ${metres}`, t(`${d.fleet} boats`, `${d.fleet} лодок`), t(`${d.start} min start`, `старт ${d.start} мин`), d.current ? t('Current on', 'С течением') : t('No current', 'Без течения')]} />
    </div>
  );
}
