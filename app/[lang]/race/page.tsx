import Link from 'next/link';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { pick, LOCALE, ruBoats } from '@/lib/lang';
import { todayTop } from '@/lib/today';
import { Who as LbWho } from '@/components/flag';
import { DailyLock } from '@/components/daily-lock';
import { ruPlural } from '@/lib/lang';
import { courseDistance, dailyRace, fmtDistance, plannedCourse, KN, SHAPE_NAME } from '@/lib/race';
import { yachtOf } from '@/lib/yachts';
import { venueOf } from '@/lib/venues';
import { BackLink } from '@/components/back-link';
import { IconTrophy, Num, clock } from '@/components/ui';
import { FreeQuick, MatchCard, TodayGo } from '@/components/hub-client';
import { RivalRow } from '@/components/progress';
import { SceneBrand } from '@/components/scene-brand';
import { GameScene } from '@/components/game-scene';
import { PauseCard } from '@/components/pause-card';
import { MyRow } from '@/components/home-client';

// Built for everyone alike and refreshed every five minutes, as Home is (today's fastest move): who is signed in is
// the browser's to show (lib/me.ts: .if-me, .if-guest, the initials; the pause card's account reads the cookie).
export const revalidate = 300;

export const generateMetadata = titled('Race hub: today’s sailing race and custom races', 'Меню гонок: парусная гонка дня и свои гонки', 'Centro de regatas: regata del día y regatas personalizadas', {
  path: '/race',
  today: true,
  description: [
    'Today’s race: the same venue, wind, course and fleet for every player, a new one at midnight UTC. Sail it as often as you like, beat today’s fastest times, or set up a custom race of your own.',
    'Гонка дня: одинаковые место, ветер, дистанция и флот для всех, новая — каждую полночь по UTC. Проходи сколько хочешь, побей лучшие времена дня или настрой свою гонку.', 'La regata del día: la misma sede, viento, recorrido y flota para todos los jugadores, una nueva a medianoche UTC. Navégala las veces que quieras, bate los mejores tiempos de hoy o prepara una regata personalizada propia.'],
});

// I1 · The race hub, as the race's pause screen: today's venue in the game's own scene behind it all (today's yacht afloat
// there on a clear evening, in today's wind), the race's place and numbers over it, and in the pause menu's glass
// card the start, today's fastest and a free race one tap away.
export default async function Hub({ params }: LangParams) {
  const { lang, t } = await getT(params);
  const today = await todayTop();
  const d = dailyRace(), v = venueOf(d.venue), boat = yachtOf(d.yacht);
  const date = new Date(d.day + 'T12:00:00Z').toLocaleDateString(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const top = today && today.d === d.day ? today.top : [];
  const best = top[0];
  const metres = fmtDistance(courseDistance(plannedCourse(d.preset, d.length, d.fleet, d.course, boat), d.laps), lang).split(' · ')[0];
  const breeze = { light: t('Light breeze', 'Слабый ветер', 'Brisa suave'), medium: t('Medium breeze', 'Средний ветер', 'Brisa media'), strong: t('Strong breeze', 'Сильный ветер', 'Brisa fuerte') }[d.preset];
  const races = today && today.d === d.day ? today.races : 0;

  return (
    <div className="scr bt-scr bc" lang={lang}>
      <div className="bt">
        <GameScene venue={d.venue} boat={d.yacht} wind={d.preset} title={t('Today’s venue in 3D', 'Место гонки дня в 3D', 'La sede de hoy en 3D')} loading={t('Loading the venue', 'Загружаем место гонки', 'Cargando la sede')} />

        <div className="bt-info">
          <div className="bt-top">
            <BackLink href="/" label={t('Home', 'На главную', 'Inicio')} />
            <SceneBrand lang={lang} />
            <span className="bt-top-r">
              <span className="bt-tick"><span className="dot-live" aria-hidden="true" /><time dateTime={d.day}>{date}</time></span>
              <Link className="bt-ico" href="/help" aria-label={t('How to play', 'Как играть', 'Cómo jugar')} title={t('How to play', 'Как играть', 'Cómo jugar')}>?</Link>
            </span>
          </div>
          <span className="bt-kick">{t('Today’s race', 'Гонка дня', 'La regata del día')} · {pick(boat.name, lang)}</span>
          <h1 className="bt-h bt-hero">{pick(v.name, lang)} <span className="bt-h-cc">{v.nation}</span></h1>
          <p className="bt-p">{pick(v.place, lang)}. {pick(v.about, lang)} {best
            ? t(`The same race for everyone today, in the ${boat.name[0]}: ${races} sailed so far.`, `Сегодня у всех одна гонка, на ${boat.name[1]}: уже ${races} ${ruPlural(races, ['заезд', 'заезда', 'заездов'])}.`, `La misma regata para todos hoy, en ${(boat.name[2] ?? boat.name[0])}: ${races} navegadas hasta ahora.`)
            : t(`The same race for everyone today, in the ${boat.name[0]}. Nobody has finished it yet.`, `Сегодня у всех одна гонка, на ${boat.name[1]}. Её ещё никто не прошёл.`, `La misma regata para todos hoy, en el ${boat.name[2] ?? boat.name[0]}. Todavía no la ha terminado nadie.`)} {t('A new yacht every day.', 'Каждый день — новая яхта.', 'Un yate nuevo cada día.')}</p>
          <div className="bt-stats bt-stats-lock">
            <div data-lock role="button" tabIndex={0} aria-haspopup="dialog"><span className="bt-sk">{t('Wind', 'Ветер', 'Viento')}</span><b><Num v={`${KN[d.preset]} ${t('kn', 'уз', 'kn')}`} /></b><span className="bt-sv">{t(`${breeze}, shifting`, `${breeze}, переменчивый`, `${breeze}, con roladas`)}</span></div>
            <div data-lock role="button" tabIndex={0} aria-haspopup="dialog"><span className="bt-sk">{t('Course', 'Дистанция', 'Recorrido')}</span><b><Num v={metres} /></b><span className="bt-sv">{t(`${SHAPE_NAME[d.course][0]} · ${d.laps} lap`, `${SHAPE_NAME[d.course][1]} · ${d.laps} круг`, `${SHAPE_NAME[d.course][0]} · ${d.laps} vuelta`)}</span></div>
            <div data-lock role="button" tabIndex={0} aria-haspopup="dialog"><span className="bt-sk">{t('Fleet', 'Флот', 'Flota')}</span><b>{d.fleet}</b><span className="bt-sv">{t(`You and ${d.fleet - 1} boats`, `Ты и ${ruBoats(d.fleet - 1)}`, `Tú y ${d.fleet - 1} barcos`)}</span></div>
            <div data-lock role="button" tabIndex={0} aria-haspopup="dialog"><span className="bt-sk">{t('Start', 'Старт', 'Salida')}</span><b><Num v={t(`${d.start} min`, `${d.start} мин`, `${d.start} min`)} /></b><span className="bt-sv">{d.current || venueOf(d.venue).runs ? t('A current runs across', 'Течение поперёк', 'Hay corriente de través') : t('Class flag, P, the gun', 'Флаг класса, P, сигнал', 'Bandera de clase, P, la señal')}</span></div>
          </div>
        </div>

        <PauseCard lang={lang} back="/race" title={t('Today’s race', 'Гонка дня', 'La regata del día')}
          tools={<>
            <Link className="bt-acct bt-acct-me if-me me-ini" href="/settings" aria-label={t('Settings, signed in', 'Настройки, ты вошёл', 'Ajustes, sesión iniciada')} />
            <Link className="bt-acct if-guest" href="/sign-in?next=/race">{t('Sign in', 'Войти', 'Iniciar sesión')}</Link>
          </>}
          action={<TodayGo lang={lang} day={d.day} />}>
          <div className="bt-g">
            <span className="bt-k"><IconTrophy />{t('Today’s fastest', 'Самые быстрые сегодня', 'Los más rápidos de hoy')}{races ? <span className="bt-k-r">{t(`${races} ${races === 1 ? 'race' : 'races'}`, `заездов: ${races}`, `${races} ${races === 1 ? 'regata' : 'regatas'}`)}</span> : null}</span>
            <ol className="hm-lb bt-lb">
              {top.map((r, i) => (
                <li key={i} className={i === 0 ? 'first' : ''}>
                  <span className="hm-n">{i + 1}</span><LbWho fl={r.fl} name={r.name || t('No name', 'Без имени', 'Sin nombre')} lang={lang} />
                  <span className="hm-t">{clock(r.s)}{i > 0 && best ? <small>+{(r.s - best.s).toFixed(1)}</small> : null}</span>
                </li>
              ))}
              {!top.length && <li><span className="hm-n">·</span><span className="hm-muted">{t('No times yet today', 'Сегодня ещё нет результатов', 'Aún no hay tiempos hoy')}</span><span /></li>}
              <MyRow lang={lang} day={d.day} top={top} cap={today?.n} next="/race" />
            </ol>
            <Link className="lb-more" href="/race/rating">{t('Full rating and the month’s points', 'Весь рейтинг и очки за месяц', 'Clasificación completa y puntos del mes')}</Link>
          </div>
          <FreeQuick lang={lang} />
          <MatchCard lang={lang} />
          <div className="bt-rows">
            <RivalRow lang={lang} />
          </div>
        </PauseCard>
      </div>
      <DailyLock lang={lang} chips={[`${t(...venueOf(d.venue).name)}`, t(...boat.name), `${breeze} ${KN[d.preset]} ${t('kn', 'уз', 'kn')}`, `${t(...SHAPE_NAME[d.course])} · ${metres}`, t(`${d.fleet} boats`, `${d.fleet} лодок`, `${d.fleet} barcos`), t(`${d.start} min start`, `старт ${d.start} мин`, `Salida de ${d.start} min`), d.current ? t('Current on', 'С течением', 'Con corriente') : t('No current', 'Без течения', 'Sin corriente')]} />
    </div>
  );
}
