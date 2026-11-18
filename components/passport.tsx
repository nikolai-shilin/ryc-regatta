'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { tx, ruPlural, type Lang } from '@/lib/lang';
import { VENUES, type VenueId } from '@/lib/venues';
import { harvest, LOG_EVENT, passport, streakOf, type Log } from '@/lib/log';
import { passportQuery } from '@/lib/passport-share';
import { ShareButton } from './share-sheet';

// your passport as a link to share (/players with the passport in its address, its card app/og/passport): the numbers, and your name when signed in
export function passportShare(log: Log, lang: Lang) {
  const t = tx(lang), p = passport(log), st = streakOf(log.d).n;
  const name = typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue('--me-name').trim().replace(/^"|"$/g, '').split(/[\s@]/)[0];
  const url = `${location.origin}/players?${passportQuery({ streak: st, raced: p.raced, name })}${lang === 'ru' ? '&lang=ru' : ''}`;
  const text = st >= 2 ? t(`${st} days in a row on the water, ${p.n} of ${p.of} venues raced. Can you keep up?`, `${st} дней подряд на воде, ${p.n} из ${p.of} акваторий. Догонишь?`)
    : t(`${p.n} of ${p.of} regatta venues raced. Can you get further?`, `Пройдено ${p.n} из ${p.of} регатных акваторий. Сможешь дальше?`);
  return { title: 'Up and down', text, url };
}

// The player's log (lib/log.ts) on this device, gathered from what the game keeps as the page comes up, and again when
// the account's has just been merged in. null until then: the pages are cached, so the server can't know it.
export function useLog() {
  const [log, setLog] = useState<Log | null>(null);
  useEffect(() => {
    const load = () => setLog(harvest());
    load();
    addEventListener(LOG_EVENT, load);
    return () => removeEventListener(LOG_EVENT, load);
  }, []);
  return log;
}

// "5-day streak", "1 day"
export const streakWords = (n: number, lang: Lang) => tx(lang)(`${n}-day streak`, `${n} ${ruPlural(n, ['день', 'дня', 'дней'])} подряд`);

const IconStamp = ({ s = 18 }: { s?: number }) => (
  <svg viewBox="0 0 20 20" width={s} height={s} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden="true">
    <rect x="2.5" y="3.5" width="15" height="13" rx="1.5" /><path d="M6 10.2l2.6 2.6L14 7.4" strokeLinecap="round" />
  </svg>
);

// Home's venues, one a day: each you've raced tinted green, today's lit, and over them how many you have and your streak
export function VenueList({ lang, today }: { lang: Lang; today: VenueId }) {
  const t = tx(lang), log = useLog();
  const p = log ? passport(log) : null, st = log ? streakOf(log.d) : null;
  return (
    <div className="ho-venues-w">
      {p && p.n > 0 ? (
        <p className="ho-pass" role="status">
          <b>{t(`${p.n} of ${p.of} raced`, `Пройдено ${p.n} из ${p.of}`)}</b>
          {st && st.n > 1 ? <span className={st.risk ? 'risk' : ''}>{streakWords(st.n, lang)}{st.risk ? t(' · race today to keep it', ' · пройди сегодня, чтобы не прервать') : ''}</span> : null}
          {log ? <ShareButton lang={lang} data={() => passportShare(log, lang)} className="bt-show ho-pass-share" title={t('Share your passport', 'Поделиться паспортом')} /> : null}
        </p>
      ) : null}
      <ul className="ho-venues">
        {VENUES.map((v) => {
          const raced = !!p?.raced.has(v.id), name = t(...v.name);
          return (
            <li key={v.id} className={`${v.id === today ? 'today' : ''}${raced ? ' raced' : ''}`.trim() || undefined} title={raced ? t(`You’ve raced at ${name}`, `Ты уже гонялся в ${name}`) : undefined}>
              {v.id === today ? t(`${v.name[0]} · today`, `${v.name[1]} · сегодня`) : name}
            </li>
          );
        })}
        <li className="next">{t('Tomorrow · ?', 'Завтра · ?')}</li>
      </ul>
    </div>
  );
}

// The race hub's row: the venues you've raced and your streak, or what a first race starts
export function PassportRow({ lang }: { lang: Lang }) {
  const t = tx(lang), log = useLog();
  const p = log ? passport(log) : null, st = log ? streakOf(log.d) : null;
  // short, for a phone's row (the row says they're venues): 3 of 28 · 4 in a row
  const meta = !p ? '' : [t(`${p.n} of ${p.of}`, `${p.n} из ${p.of}`), st && st.n > 1 ? t(`${st.n} in a row`, `${st.n} подряд`) : ''].filter(Boolean).join(' · ');
  return (
    <Link className={`bt-row${st?.risk ? ' bt-row-risk' : ''}`} href="/#h-venues">
      <IconStamp /><span>{st?.risk ? t('Race today to keep your streak', 'Пройди сегодня — не прерви серию') : t('Venues you’ve raced', 'Твои акватории')}</span>
      {meta && <span className="bt-row-m">{meta}</span>}
    </Link>
  );
}
