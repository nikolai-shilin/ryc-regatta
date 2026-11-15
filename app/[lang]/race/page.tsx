import Link from 'next/link';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { ruBoats } from '@/lib/lang';
import { getAccount, initials } from '@/lib/supabase/server';
import { todayTop } from '@/lib/today';
import { Who as LbWho } from '@/components/flag';
import { DailyLock } from '@/components/daily-lock';
import { ruPlural } from '@/lib/lang';
import { courseDistance, dailyRace, fmtDistance, plannedCourse, KN, SHAPE_NAME } from '@/lib/race';
import { venueOf } from '@/lib/venues';
import { IconBack, IconPlay, IconTrophy, IconSliders, IconBoats, Num, clock } from '@/components/ui';
import { BoatRow, FreeQuick } from '@/components/hub-client';
import { SceneBrand } from '@/components/scene-brand';
import { GameScene } from '@/components/game-scene';
import { PauseCard, SettingsRow, type Who } from '@/components/pause-card';
import { MyRow } from '@/components/home-client';

export const generateMetadata = titled('Race hub', 'Меню гонок', {
  path: '/race',
  today: true,
  description: [
    'Today’s race: the same venue, wind, course and fleet for every player, a new one at midnight UTC. Sail it as often as you like, beat today’s fastest times, or set up a free race of your own.',
    'Гонка дня: одинаковые место, ветер, дистанция и флот для всех, новая — каждую полночь по UTC. Проходи сколько хочешь, побей лучшие времена дня или настрой свою свободную гонку.'],
});

// I1 · The race hub, as the race's pause screen: today's venue in the game's own scene behind it all (your yacht afloat
// there on a clear evening, in today's wind), the race's place and numbers over it, and in the pause menu's glass
// card the start, today's fastest and a free race one tap away.
export default async function Hub({ params }: LangParams) {
  const { lang, t } = await getT(params);
  const [account, today] = await Promise.all([getAccount(), todayTop()]);
  const d = dailyRace(), v = venueOf(d.venue), L = lang === 'ru' ? 1 : 0;
  const date = new Date(d.day + 'T12:00:00Z').toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const top = today && today.d === d.day ? today.top : [];
  const best = top[0];
  const metres = fmtDistance(courseDistance(plannedCourse(d.preset, d.length, d.fleet, d.course), d.laps), lang).split(' · ')[0];
  const breeze = { light: t('Light breeze', 'Слабый ветер'), medium: t('Medium breeze', 'Средний ветер'), strong: t('Strong breeze', 'Сильный ветер') }[d.preset];
  const races = today && today.d === d.day ? today.races : 0;
  const who: Who = account ? { name: account.name, email: account.email, initials: initials(account.name, account.email), via: account.provider === 'google' ? 'Google' : account.provider === 'telegram' ? 'Telegram' : t('email code', 'код по почте') } : null;

  return (
    <div className="scr bt-scr bc" lang={lang} data-acct={account ? 'signed' : 'guest'}>
      <div className="bt">
        <GameScene venue={d.venue} wind={d.preset} title={t('Today’s venue in 3D', 'Место гонки дня в 3D')} loading={t('Loading the venue', 'Загружаем место гонки')} />

        <div className="bt-info">
          <div className="bt-top">
            <Link className="bt-back" href="/" aria-label={t('Home', 'На главную')}><IconBack /></Link>
            <SceneBrand />
            <span className="bt-top-r">
              <span className="bt-tick"><span className="dot-live" aria-hidden="true" /><time dateTime={d.day}>{date}</time></span>
              <Link className="bt-ico" href="/help" aria-label={t('How to play', 'Как играть')} title={t('How to play', 'Как играть')}>?</Link>
            </span>
          </div>
          <span className="bt-kick">{t('Today’s race', 'Гонка дня')}</span>
          <h1 className="bt-h bt-hero">{v.name[L]}</h1>
          <p className="bt-p">{v.place[L]}. {v.about[L]} {best
            ? t(`The same race for everyone today: ${races} sailed so far.`, `Сегодня у всех одна гонка: уже ${races} ${ruPlural(races, ['заезд', 'заезда', 'заездов'])}.`)
            : t('The same race for everyone today. Nobody has finished it yet.', 'Сегодня у всех одна гонка. Её ещё никто не прошёл.')}</p>
          <div className="bt-stats bt-stats-lock">
            <div data-lock role="button" tabIndex={0} aria-haspopup="dialog"><span className="bt-sk">{t('Wind', 'Ветер')}</span><b><Num v={`${KN[d.preset]} ${t('kn', 'уз')}`} /></b><span className="bt-sv">{t(`${breeze}, shifting`, `${breeze}, переменчивый`)}</span></div>
            <div data-lock role="button" tabIndex={0} aria-haspopup="dialog"><span className="bt-sk">{t('Course', 'Дистанция')}</span><b><Num v={metres} /></b><span className="bt-sv">{t(`${SHAPE_NAME[d.course][0]} · ${d.laps} lap`, `${SHAPE_NAME[d.course][1]} · ${d.laps} круг`)}</span></div>
            <div data-lock role="button" tabIndex={0} aria-haspopup="dialog"><span className="bt-sk">{t('Fleet', 'Флот')}</span><b>{d.fleet}</b><span className="bt-sv">{t(`You and ${d.fleet - 1} boats`, `Ты и ${ruBoats(d.fleet - 1)}`)}</span></div>
            <div data-lock role="button" tabIndex={0} aria-haspopup="dialog"><span className="bt-sk">{t('Start', 'Старт')}</span><b><Num v={t(`${d.start} min`, `${d.start} мин`)} /></b><span className="bt-sv">{d.current ? t('A current runs across', 'Течение поперёк') : t('Class flag, P, the gun', 'Флаг класса, P, сигнал')}</span></div>
          </div>
        </div>

        <PauseCard lang={lang} who={who} back="/race" label={t('Today’s race', 'Гонка дня')}>
          <div className="bt-card-h">
            <span className="lbl-ink">{t('Today’s race', 'Гонка дня')}</span>
            {who
              ? <Link className="bt-acct bt-acct-me" href="/settings" aria-label={t(`Settings, signed in as ${who.name || who.email}`, `Настройки, вход как ${who.name || who.email}`)}>{who.initials}</Link>
              : <Link className="bt-acct" href="/sign-in?next=/race">{t('Sign in', 'Войти')}</Link>}
          </div>
          <a className="bt-go" href="/play?race=today"><IconPlay /><span>{t('Start today’s race', 'Начать гонку дня')}</span></a>
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
            <Link className="lb-more" href="/race/rating">{t('Full rating and the month’s points', 'Весь рейтинг и очки за месяц')} ›</Link>
          </div>
          <FreeQuick lang={lang} />
          <div className="bt-rows">
            <button type="button" className="bt-row" data-lock aria-haspopup="dialog"><IconSliders /><span>{t('Change the wind or course', 'Изменить ветер или дистанцию')}</span><span className="bt-row-m">{t('A free race', 'Свободная гонка')}</span></button>
            <BoatRow lang={lang} />
            <Link className="bt-row" href="/yachts"><IconBoats s={18} /><span>{t('The yachts', 'Яхты')}</span><span className="bt-row-m">J/70 · RS21 · AC75</span></Link>
            <SettingsRow lang={lang} note />
          </div>
        </PauseCard>
      </div>
      <DailyLock lang={lang} chips={[`${t(...venueOf(d.venue).name)}`, `${breeze} ${KN[d.preset]} ${t('kn', 'уз')}`, `${t(...SHAPE_NAME[d.course])} · ${metres}`, t(`${d.fleet} boats`, `${d.fleet} лодок`), t(`${d.start} min start`, `старт ${d.start} мин`), d.current ? t('Current on', 'С течением') : t('No current', 'Без течения')]} />
    </div>
  );
}
