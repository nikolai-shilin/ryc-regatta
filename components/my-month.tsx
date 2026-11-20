'use client';
import { clock } from '@/lib/clock';
import { useEffect, useState } from 'react';
import { LOCALE, tx, ruPlural, type Lang } from '@/lib/lang';
import { placeAmong } from '@/lib/race-log';
import { shiftDay, todayUtc } from '@/lib/log';
import { useLog } from './passport';
import { briefUrl, readBrief } from '@/lib/day-brief';

// Your month on the rating page: for each day of the month you finished today's race, where your best time that day
// stood among that day's ranked times, as a bar: how much of the field you beat (all of it: first). The times are
// this device's log (lib/log.ts; for a signed-in player, the account's too); the days' fields are the scores API's.
// The board names no one by account, so it's your times placed against it, as the result page places them.
// a day of yours: your best that day, its place among that day's ranked times and how many there are (with yours if it
// isn't on the board), and whether it is (a signed-in player's are: those earn the month's points)
export type MyDay = { d: string; s: number; place: number; of: number; listed: boolean };
export const monthOf = (day: string) => {
  const today = todayUtc(), first = day.slice(0, 8) + '01';
  const e = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7), 0)).toISOString().slice(0, 10);
  return { first, end: e < today ? e : today };
};

// your days of the month that `day` is in, each placed on that day's ranking (null until known)
export function useMyDays(day: string) {
  const log = useLog();
  const [days, setDays] = useState<MyDay[] | null>(null);
  const { first, end } = monthOf(day);
  const mine = log ? Object.entries(log.d).filter(([d]) => d >= first && d <= end).sort(([a], [b]) => (a < b ? -1 : 1)) : null;
  const key = mine ? `m|${mine.map(([d, s]) => `${d}:${s}`).join(',')}` : ''; // m|: the log is in, with or without days
  useEffect(() => {
    if (!mine) return;
    if (!mine.length) { setDays([]); return; }
    let live = true;
    Promise.all(mine.map(([d, s]) => fetch(briefUrl(d)).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((j) => {
      const field: number[] = readBrief(j, d)?.s || [];
      const listed = field.some((x) => Math.abs(x - s) < 0.05);
      return { d, s, place: placeAmong(field, s), of: field.length + (listed ? 0 : 1), listed };
    }))).then((r) => live && setDays(r));
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return log ? days : null;
}
// the month's points your listed days earned: on a day with N ranked, place p takes N − p + 1 (lib/rating.ts)
export const myPoints = (days: MyDay[]) => days.filter((x) => x.listed).reduce((a, x) => a + x.of - x.place + 1, 0);

export function MyMonth({ day, lang }: { day: string; lang: Lang }) {
  const t = tx(lang), log = useLog(), days = useMyDays(day);
  const [hover, setHover] = useState<string | null>(null);
  const { first, end } = monthOf(day);
  if (!log || !days) return null;
  const loc = LOCALE[lang];
  const all: string[] = []; for (let d = first; d <= end; d = shiftDay(d, 1)) all.push(d);
  const by = new Map(days.map((x) => [x.d, x]));
  const share = (x: MyDay) => (x.of <= 1 ? 1 : (x.of - x.place) / (x.of - 1)); // of the field beaten: 1 first, 0 last
  const ord = (n: number) => t(`${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`, `${n}-е`, `${n}.º`, `${n}.`, `${n}.`, `${n === 1 ? '1er' : `${n}e`}`, `${n}º`, `${n}º`);
  // a day nobody else ranked has no field to place you in: drawn hollow, and neither a win nor your best
  const placed = days.filter((x) => x.of > 1);
  const best = placed.length ? placed.reduce((a, b) => (share(b) > share(a) || (share(b) === share(a) && b.place < a.place) ? b : a)) : null;
  const wins = placed.filter((x) => x.place === 1).length, podiums = placed.filter((x) => x.place <= 3).length;
  const dateW = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  // the day the strip under the chart reads: the one pointed at, else today's, else your best
  const shown = (hover && by.get(hover)) || by.get(end) || best;
  const stat = (k: string, v: string, u?: string, gold = false) => (
    <div className="rt-ms"><span className="lbl">{k}</span><b className={gold ? 'is-gold' : undefined}>{v}{u ? <span className="unit">{u}</span> : null}</b></div>
  );

  return (
    <section className="rt-mine" aria-labelledby="rt-mine-h">
      <div className="rt-card-h"><span className="lbl-ink" id="rt-mine-h">{t('Your month', 'Твой месяц', 'Tu mes', 'Dein Monat', 'Senin ayın', 'Ton mois', 'Il tuo mese', 'Seu mês')}</span>
        <span className="lbl">{new Date(day + 'T12:00:00Z').toLocaleDateString(loc, { month: 'long', timeZone: 'UTC' })}</span></div>
      {days.length ? (
        <>
          {/* the month in four numbers, as the pause card's */}
          <div className="rt-mstats">
            {stat(t('Days', 'Дней', 'Días', 'Tage', 'Gün', 'Jours', 'Giorni', 'Dias'), String(days.length))}
            {stat(t('Best', 'Лучшее', 'Mejor', 'Beste', 'En iyi', 'Meilleure', 'Migliore', 'Melhor'), best ? (lang === 'ru' ? `${best.place}` : lang === 'es' ? `${best.place}.º` : lang === 'pt' ? `${best.place}º` : lang === 'it' ? `${best.place}º` : lang === 'fr' ? (best.place === 1 ? '1er' : `${best.place}e`) : lang === 'de' || lang === 'tr' ? `${best.place}.` : ord(best.place)) : '—', best ? t(`of ${best.of}`, `из ${best.of}`, `de ${best.of}`, `von ${best.of}`, `${best.of} içinde`, `sur ${best.of}`, `su ${best.of}`, `de ${best.of}`) : undefined, best?.place === 1)}
            {stat(t('Wins', 'Победы', 'Victorias', 'Siege', 'Galibiyet', 'Victoires', 'Vittorie', 'Vitórias'), String(wins), undefined, wins > 0)}
            {stat(t('Podiums', 'Подиумы', 'Podios', 'Podien', 'Podyum', 'Podiums', 'Podi', 'Pódios'), String(podiums))}
          </div>
          {/* each day you raced: a marker at your place that day (the top first, the foot last), on a stem from the foot;
              a win gold, your best labelled; the days you didn't, a tick on the foot */}
          <div className="rt-mc" role="img" aria-label={t('Your place each day this month: higher is better, the top is first that day', 'Твоё место в каждый день месяца: чем выше, тем лучше, верх — первое место', 'Tu puesto cada día de este mes: más alto es mejor, arriba es el primero ese día', 'Dein Platz an jedem Tag dieses Monats: höher ist besser, ganz oben heißt an dem Tag Erster', 'Bu ay her günkü sıran: yüksek daha iyi, tepe o günün birincisi', 'Ta place chaque jour ce mois-ci : plus c’est haut, mieux c’est ; tout en haut, c’est premier ce jour-là', 'La tua posizione ogni giorno di questo mese: più in alto è meglio, in cima è primo quel giorno', 'Sua posição a cada dia deste mês: mais alto é melhor, o topo é o primeiro do dia')}
            onPointerLeave={() => setHover(null)}>
            <span className="rt-mc-g top"><i>{t('1st', '1-е', '1.º', '1.', '1.', '1er', '1º', '1º')}</i></span>
            <span className="rt-mc-g mid" />
            <span className="rt-mc-g foot"><i>{t('Last', 'Посл.', 'Último', 'Letzter', 'Son', 'Dernier', 'Ultimo', 'Último')}</i></span>
            <div className="rt-mc-cols">
              {all.map((d) => {
                const x = by.get(d), y = x && x.of > 1 ? share(x) : 0; // a day nobody else ranked: on the foot, hollow
                return (
                  <span key={d} className={`rt-mc-d${x ? ' has' : ''}${x && x.of > 1 && x.place === 1 ? ' win' : ''}${x && x.of <= 1 ? ' alone' : ''}${d === end ? ' on' : ''}${shown?.d === d ? ' sel' : ''}`}
                    style={{ ['--y' as string]: y.toFixed(3) }}
                    onPointerEnter={() => x && setHover(d)} onFocus={() => x && setHover(d)} onBlur={() => setHover(null)} tabIndex={x ? 0 : -1}
                    aria-label={x ? `${dateW(d)}: ${x.of > 1 ? t(`${ord(x.place)} of ${x.of}`, `${x.place}-е из ${x.of}`, `${ord(x.place)} de ${x.of}`, `${ord(x.place)} von ${x.of}`, `${x.of} içinde ${ord(x.place)}`, `${ord(x.place)} sur ${x.of}`, `${ord(x.place)} su ${x.of}`, `${ord(x.place)} de ${x.of}`) : t('no one else ranked', 'других в рейтинге нет', 'nadie más clasificado', 'niemand sonst in der Rangliste', 'başka sıralanan yok', 'personne d’autre au classement', 'nessun altro in classifica', 'ninguém mais classificado')}, ${clock(x.s)}` : undefined}>
                    {x ? <><i className="rt-mc-st" /><i className="rt-mc-mk" />{best?.d === d ? <b className="rt-mc-lb">{lang === 'ru' ? `${x.place}-е` : lang === 'es' ? `${x.place}.º` : lang === 'pt' ? `${x.place}º` : lang === 'it' ? `${x.place}º` : lang === 'fr' ? (x.place === 1 ? '1er' : `${x.place}e`) : lang === 'de' || lang === 'tr' ? `${x.place}.` : ord(x.place)}</b> : null}</> : null}
                    <small>{+d.slice(8)}</small>
                  </span>
                );
              })}
            </div>
          </div>
          {/* the day, as the race's split at a mark: the date, the place, the time */}
          {shown ? (
            <div className="rt-msplit" aria-live="polite">
              <span className="k">{dateW(shown.d)}</span>
              <b className={`t${shown.of > 1 && shown.place === 1 ? ' gold' : ''}`}>{shown.of > 1 ? t(`${ord(shown.place)} of ${shown.of}`, `${shown.place}-е из ${shown.of}`, `${ord(shown.place)} de ${shown.of}`, `${ord(shown.place)} von ${shown.of}`, `${shown.of} içinde ${ord(shown.place)}`, `${ord(shown.place)} sur ${shown.of}`, `${ord(shown.place)} su ${shown.of}`, `${ord(shown.place)} de ${shown.of}`) : t('No one else ranked', 'Других в рейтинге нет', 'Nadie más clasificado', 'Niemand sonst in der Rangliste', 'Başka sıralanan yok', 'Personne d’autre au classement', 'Nessun altro in classifica', 'Ninguém mais classificado')}</b>
              <span className="v">{clock(shown.s)}</span>
            </div>
          ) : null}
        </>
      ) : (
        <p className="rt-none">{t('No races of yours this month on this device yet. Finish today’s race and it shows here.', 'На этом устройстве в этом месяце твоих гонок пока нет. Пройди гонку дня — и она появится здесь.', 'Aún no hay regatas tuyas este mes en este dispositivo. Termina la regata de hoy y aparecerá aquí.', 'Noch keine Regatten von dir in diesem Monat auf diesem Gerät. Beende die Regatta des Tages, dann erscheint sie hier.', 'Bu ay bu cihazda henüz yarışın yok. Günün yarışını bitir, burada görünür.', 'Pas encore de régate à toi ce mois-ci sur cet appareil. Termine la régate du jour et elle s’affichera ici.', 'Ancora nessuna tua regata questo mese su questo dispositivo. Finisci la regata del giorno e comparirà qui.', 'Ainda não há regatas suas este mês neste aparelho. Termine a regata do dia e ela aparece aqui.')}</p>
      )}
    </section>
  );
}
