'use client';
import { useEffect, useState } from 'react';
import { tx, ruPlural, type Lang } from '@/lib/lang';
import { VENUES, type VenueId } from '@/lib/venues';
import { harvest, LOG_EVENT, passport, streakOf, type Log } from '@/lib/log';
import { passportQuery } from '@/lib/passport-share';
import { ShareButton } from './share-sheet';

// your passport as a link to share (/players with the passport in its address, its card app/og/passport): the numbers, and your name when signed in
export function passportShare(log: Log, lang: Lang) {
  const t = tx(lang), p = passport(log), st = streakOf(log.d).n;
  const name = typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue('--me-name').trim().replace(/^"|"$/g, '').split(/[\s@]/)[0];
  const url = `${location.origin}/players?${passportQuery({ streak: st, raced: p.raced, name })}${lang === 'en' ? '' : `&lang=${lang}`}`;
  const text = st >= 2 ? t(`${st} days in a row on the water, ${p.n} of ${p.of} venues raced. Can you keep up?`, `${st} ${ruPlural(st, ['день', 'дня', 'дней'])} подряд на воде, ${p.n} из ${p.of} акваторий. Догонишь?`, `${st} ${st === 1 ? 'día' : 'días'} seguidos en el agua, ${p.n} de ${p.of} sedes regateadas. ¿Puedes seguir el ritmo?`, `${st} Tage in Folge auf dem Wasser, ${p.n} von ${p.of} Revieren gesegelt. Hältst du mit?`, `Suda üst üste ${st} gün, ${p.of} yarış alanından ${p.n} tanesinde yarıştım. Yetişebilir misin?`)
    : t(`${p.n} of ${p.of} regatta venues raced. Can you get further?`, `Пройдено ${p.n} из ${p.of} регатных акваторий. Сможешь дальше?`, `${p.n} de ${p.of} sedes de regata regateadas. ¿Puedes llegar más lejos?`, `${p.n} von ${p.of} Regattarevieren gesegelt. Kommst du weiter?`, `${p.of} regata yarış alanından ${p.n} tanesinde yarıştım. Sen daha ileri gidebilir misin?`);
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
export const streakWords = (n: number, lang: Lang) => tx(lang)(`${n}-day streak`, `${n} ${ruPlural(n, ['день', 'дня', 'дней'])} подряд`, `Racha de ${n} ${n === 1 ? 'día' : 'días'}`, `${n}-Tage-Serie`, `${n} günlük seri`);

// Home's venues, one a day: each you've raced tinted green, today's lit, and over them how many you have and your streak
export function VenueList({ lang, today }: { lang: Lang; today: VenueId }) {
  const t = tx(lang), log = useLog();
  const p = log ? passport(log) : null, st = log ? streakOf(log.d) : null;
  return (
    <div className="ho-venues-w">
      {p && p.n > 0 ? (
        <p className="ho-pass" role="status">
          <b>{t(`${p.n} of ${p.of} raced`, `Пройдено ${p.n} из ${p.of}`, `${p.n} de ${p.of} regateadas`, `${p.n} von ${p.of} gesegelt`, `${p.of} içinde ${p.n} yarışıldı`)}</b>
          {st && st.n > 1 ? <span className={st.risk ? 'risk' : ''}>{streakWords(st.n, lang)}{st.risk ? t(' · race today to keep it', ' · пройди сегодня, чтобы не прервать', ' · regatea hoy para mantenerla', ' · segle heute, um sie zu halten', ' · korumak için bugün yarış') : ''}</span> : null}
          {log ? <ShareButton lang={lang} data={() => passportShare(log, lang)} className="bt-show ho-pass-share" title={t('Share your passport', 'Поделиться паспортом', 'Comparte tu pasaporte', 'Teile deinen Pass', 'Pasaportunu paylaş')} /> : null}
        </p>
      ) : null}
      <ul className="ho-venues">
        {VENUES.map((v) => {
          const raced = !!p?.raced.has(v.id), name = t(...v.name);
          return (
            <li key={v.id} className={`${v.id === today ? 'today' : ''}${raced ? ' raced' : ''}`.trim() || undefined} title={raced ? t(`You’ve raced at ${name}`, `Ты уже гонялся в ${name}`, `Has regateado en ${name}`, `Du bist in ${name} gesegelt`, `${name} yarış alanında yarıştın`) : undefined}>
              {v.id === today ? t(`${v.name[0]} · today`, `${v.name[1]} · сегодня`, `${(v.name[2] ?? v.name[0])} · hoy`, `${(v.name[3] ?? v.name[0])} · heute`, `${(v.name[4] ?? v.name[0])} · bugün`) : name}
            </li>
          );
        })}
        <li className="next">{t('Tomorrow · ?', 'Завтра · ?', 'Mañana · ?', 'Morgen · ?', 'Yarın · ?')}</li>
      </ul>
    </div>
  );
}
