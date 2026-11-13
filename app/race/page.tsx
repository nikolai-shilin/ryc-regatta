import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getT } from '@/lib/i18n';
import { getAccount, initials } from '@/lib/supabase/server';
import { todayTop } from '@/lib/today';
import { dailyRace, KN } from '@/lib/race';
import { Logo, IconHelp, IconSliders, IconPlay, IconSail, clock } from '@/components/ui';
import { TodayChips, MyToday, FreeCard } from '@/components/hub-client';

export const metadata: Metadata = { title: 'Race hub' };

// I1 · The race hub: today's race first, today's fastest, a free race one tap away.
export default async function Hub() {
  const { lang, t } = await getT();
  const [account, today] = await Promise.all([getAccount(), todayTop()]);
  const d = dailyRace();
  const wind = { light: t('Light breeze', 'Слабый ветер'), medium: t('Medium breeze', 'Средний ветер'), strong: t('Strong breeze', 'Сильный ветер') }[d.preset];
  const course = { short: t('short', 'короткий'), medium: t('medium', 'средний'), long: t('long', 'длинный') }[d.length];
  const title = t(`${wind}, ${d.fleet} boats, one ${course} lap`, `${wind}, ${d.fleet} лодок, один ${course} круг`);
  const date = new Date(d.day + 'T12:00:00Z').toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  // only what the title doesn't already say (it names the wind, the fleet, the course and the lap)
  const chips = [
    `${KN[d.preset]} ${t('kn', 'уз')}`,
    t(`${d.start}-min start`, `старт ${d.start} мин`),
    ...(d.current ? [t('current', 'течение')] : []),
  ];
  const top = today && today.d === d.day ? today.top : [];

  return (
    <div className="scr" lang={lang} data-acct={account ? 'signed' : 'guest'}>
      <div className="lay page">
        <div className="lhead">
          <Link href="/" aria-label="Up and down"><Logo /></Link>
          <span className="kicker no-port">Up and down</span>
          <span className="sp" />
          <a className="back-link no-port" href="https://iyt.rycrentals.com/">{t('← IYT Test', '← Тест IYT')}</a>
          <Link className="round round-s round-muted" href="/help" aria-label={t('Help', 'Помощь')}><IconHelp /></Link>
          <Link className="round round-s round-muted" href="/boat" aria-label={t('Your boat', 'Твоя яхта')}><IconSail /></Link>
          <Link className="round round-s round-muted" href="/settings" aria-label={t('Settings', 'Настройки')}><IconSliders /></Link>
          {account
            ? <Link className="avatar" href="/settings" aria-label={account.name || account.email}>{initials(account.name, account.email)}</Link>
            : <Link className="pill pill-xs" href="/sign-in?next=/race"><span className="btn-t">{t('Sign in', 'Войти')}</span></Link>}
        </div>
        <div className="hub-grid">
          <div className="band today">
            <div className="today-photo only-desk"><Image src="/images/top.jpg" alt={t('Today’s course from above', 'Дистанция дня сверху')} fill sizes="680px" /></div>
            <div className="today-body">
              <div className="lhead"><span className="kicker">{t('Today’s race', 'Гонка дня')}</span><span className="sp" /><span className="meta">{date}</span></div>
              <h1 className="h-land-s today-title">{title}</h1>
              <TodayChips lang={lang} chips={chips} day={date} />
              <span className="sp" />
              <a className="pill pill-primary pill-wide pill-s" href="/play?race=today"><IconPlay /><span className="btn-t">{t('Start today’s race', 'Начать гонку дня')}</span></a>
            </div>
          </div>
          <div className="hub-side">
            <div className="band-line fastest">
              <span className="meta">{t('Today’s fastest', 'Самые быстрые сегодня')}</span>
              <ol className="lb">
                {top.map((r, i) => <li key={i}><span className="n">{i + 1}</span><span>{r.name || t('Guest', 'Гость')}</span><span>{clock(r.s)}</span></li>)}
                {!top.length && <li><span className="n">·</span><span className="muted">{t('No times yet today', 'Сегодня ещё нет результатов')}</span><span /></li>}
                {account
                  ? <MyToday lang={lang} day={d.day} name={account.name} />
                  : <li className="me"><span className="n">·</span><Link href="/sign-in?next=/race" className="accent">{t('Sign in to get on it', 'Войди, чтобы попасть сюда')}</Link><span /></li>}
              </ol>
            </div>
            <FreeCard lang={lang} />
          </div>
        </div>
      </div>
    </div>
  );
}
