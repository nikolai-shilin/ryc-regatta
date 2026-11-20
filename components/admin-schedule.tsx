import { pick, LOCALE, tx, type Lang } from '@/lib/lang';
import { courseDistance, dailyRace, fmtDistance, plannedCourse, KN, SHAPE_NAME, type Daily } from '@/lib/race';
import { venueOf } from '@/lib/venues';
import { yachtOf } from '@/lib/yachts';
import type { Today } from '@/lib/today';
import { IconClock, IconFlag, clock } from './ui';

// The admin's look at today's race (lib/race.ts dailyRace, the same race the game sails) and the days after it: each
// day's venue, yacht, wind and course are fixed by its date, a new one at midnight UTC. Drawn on the server, per request.
const AHEAD = 7;

export function AdminSchedule({ lang, today, now = new Date() }: { lang: Lang; today: Today | null; now?: Date }) {
  const t = tx(lang);
  const d = dailyRace(now), v = venueOf(d.venue);
  const day = (s: string, weekday: 'short' | 'long' = 'short') =>
    new Date(s + 'T12:00:00Z').toLocaleDateString(LOCALE[lang], { weekday, day: 'numeric', month: 'short', timeZone: 'UTC' });
  const metres = (r: Daily) => fmtDistance(courseDistance(plannedCourse(r.preset, r.length, r.fleet, r.course, yachtOf(r.yacht)), r.laps), lang).split(' · ')[0];
  const breeze = { light: t('light', 'слабый', 'flojo', 'leicht', 'hafif', 'faible', 'leggero', 'fraco'), medium: t('medium', 'средний', 'medio', 'mittel', 'orta', 'moyen', 'medio', 'médio'), strong: t('strong', 'сильный', 'fuerte', 'stark', 'kuvvetli', 'fort', 'forte', 'forte') }[d.preset];
  const live = today && today.d === d.day ? today : null;
  const left = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime();
  const h = Math.floor(left / 36e5), m = Math.floor((left % 36e5) / 6e4);
  const next = Array.from({ length: AHEAD }, (_, i) => dailyRace(new Date(Date.parse(d.day) + (i + 1) * 864e5)));

  return (
    <div className="set-grid adm adm-day">
      <div className="set-sec">
        <div className="group-k"><IconFlag /><span className="kicker">{t('Today’s race', 'Гонка дня', 'La regata del día', 'Regatta des Tages', 'Günün yarışı', 'La régate du jour', 'La regata del giorno', 'A regata do dia')} · {day(d.day, 'long')}</span></div>
        <div className="srow"><span className="srow-k">{t('Venue', 'Место', 'Sede', 'Revier', 'Yarış alanı', 'Plan d’eau', 'Campo di regata', 'Raia')}</span><span className="adm-v">{pick(v.name, lang)}, {pick(v.place, lang)}</span></div>
        <div className="srow"><span className="srow-k">{t('Yacht', 'Яхта', 'Yate', 'Yacht', 'Yat', 'Yacht', 'Yacht', 'Veleiro')}</span><span className="adm-v">{pick(yachtOf(d.yacht).name, lang)}</span></div>
        <div className="srow"><span className="srow-k">{t('Wind', 'Ветер', 'Viento', 'Wind', 'Rüzgâr', 'Vent', 'Vento', 'Vento')}</span><span className="adm-v">{KN[d.preset]} {t('kn', 'уз', 'kn', 'kn', 'kn', 'kn', 'kn', 'nós')} · {breeze} · {pick(v.wind, lang)}</span></div>
        <div className="srow"><span className="srow-k">{t('Course', 'Дистанция', 'Recorrido', 'Bahn', 'Parkur', 'Parcours', 'Percorso', 'Percurso')}</span><span className="adm-v">{pick(SHAPE_NAME[d.course], lang)} · {metres(d)} · {t(`${d.laps} lap`, `${d.laps} круг`, `${d.laps} vuelta`, `${d.laps} Runde`, `${d.laps} tur`, `${d.laps} tour`, `${d.laps} giro`, `${d.laps} volta`)}</span></div>
        <div className="srow"><span className="srow-k">{t('Current', 'Течение', 'Corriente', 'Strömung', 'Akıntı', 'En cours', 'Corrente', 'Correnteza')}</span><span className="adm-v">{d.current ? t('Runs across', 'Поперёк', 'Va de lado a lado', 'Läuft quer', 'Çapraz akar', 'En travers', 'Si svolge su', 'Atravessa') : t('None', 'Нет', 'Ninguna', 'Keine', 'Yok', 'Aucun', 'Nessuno', 'Nenhum')}</span></div>
        <div className="srow"><span className="srow-k">{t('Fleet and start', 'Флот и старт', 'Flota y salida', 'Feld und Start', 'Filo ve start', 'Flotte et départ', 'Flotta e partenza', 'Flotilha e largada')}</span><span className="adm-v">{t(`${d.fleet} boats · ${d.start} min sequence`, `${d.fleet} яхт · старт за ${d.start} мин`, `${d.fleet} barcos · secuencia de ${d.start} min`, `${d.fleet} Boote · ${d.start} min Startfolge`, `${d.fleet} tekne · ${d.start} dk sekans`, `${d.fleet} bateaux · procédure de ${d.start} min`, `${d.fleet} barche · procedura di ${d.start} min`, `${d.fleet} barcos · sequência de ${d.start} min`)}</span></div>
        <div className="srow">
          <span className="srow-k">{t('Sailed today', 'Пройдено сегодня', 'Navegada hoy', 'Heute gesegelt', 'Bugün yarışılan', 'Courues aujourd’hui', 'Regatata oggi', 'Corrida hoje')}</span>
          <span className="adm-v">{live?.races
            ? t(`${live.races} ${live.races === 1 ? 'race' : 'races'}${live.top[0] ? ` · best ${clock(live.top[0].s)}${live.top[0].name ? `, ${live.top[0].name}` : ''}` : ''}`,
                `заездов: ${live.races}${live.top[0] ? ` · лучшее ${clock(live.top[0].s)}${live.top[0].name ? `, ${live.top[0].name}` : ''}` : ''}`, `${live.races} ${live.races === 1 ? 'regata' : 'regatas'}${live.top[0] ? ` · mejor ${clock(live.top[0].s)}${live.top[0].name ? `, ${live.top[0].name}` : ''}` : ''}`, `${live.races} ${live.races === 1 ? 'Regatta' : 'Regatten'}${live.top[0] ? ` · beste ${clock(live.top[0].s)}${live.top[0].name ? `, ${live.top[0].name}` : ''}` : ''}`, `${live.races} yarış${live.top[0] ? ` · en iyi ${clock(live.top[0].s)}${live.top[0].name ? `, ${live.top[0].name}` : ''}` : ''}`, `${live.races} ${live.races === 1 ? 'régate' : 'régates'}${live.top[0] ? ` · meilleur ${clock(live.top[0].s)}${live.top[0].name ? `, ${live.top[0].name}` : ''}` : ''}`, `${live.races} ${live.races === 1 ? 'regata' : 'regate'}${live.top[0] ? ` · migliore ${clock(live.top[0].s)}${live.top[0].name ? `, ${live.top[0].name}` : ''}` : ''}`, `${live.races} ${live.races === 1 ? 'regata' : 'regatas'}${live.top[0] ? ` · melhor ${clock(live.top[0].s)}${live.top[0].name ? `, ${live.top[0].name}` : ''}` : ''}`)
            : t('No races yet', 'Ещё нет заездов', 'Aún no hay regatas', 'Noch keine Regatten', 'Henüz yarış yok', 'Aucune régate pour l’instant', 'Ancora nessuna regata', 'Nenhuma regata ainda')}</span>
        </div>
        <p className="hint adm-day-h">{t(`The same race for every player. The next one starts at midnight UTC, in ${h} h ${m} min.`, `Одна гонка для всех игроков. Следующая — в полночь по UTC, через ${h} ч ${m} мин.`, `La misma regata para todos los jugadores. La siguiente empieza a medianoche UTC, dentro de ${h} h ${m} min.`, `Dieselbe Regatta für alle Spieler. Die nächste startet um Mitternacht UTC, in ${h} h ${m} min.`, `Her oyuncu için aynı yarış. Bir sonrakisi UTC gece yarısı başlar, ${h} sa ${m} dk sonra.`, `La même régate pour tous les joueurs. La prochaine commence à minuit UTC, dans ${h} h ${m} min.`, `La stessa regata per ogni giocatore. La prossima inizia a mezzanotte UTC, tra ${h} h ${m} min.`, `A mesma regata para todos os jogadores. A próxima começa à meia-noite UTC, em ${h} h ${m} min.`)}</p>
      </div>
      <div className="set-sec">
        <div className="group-k"><IconClock /><span className="kicker">{t(`The next ${AHEAD} days`, `Следующие ${AHEAD} дней`, `Los próximos ${AHEAD} días`, `Die nächsten ${AHEAD} Tage`, `Önümüzdeki ${AHEAD} gün`, `Les ${AHEAD} prochains jours`, `I prossimi ${AHEAD} giorni`, `Os próximos ${AHEAD} dias`)}</span></div>
        <ol className="adm-sched">
          {next.map((r) => (
            <li key={r.day} className="srow">
              <span className="srow-k"><span className="adm-sched-d">{day(r.day)}</span>{pick(venueOf(r.venue).name, lang)}</span>
              <span className="adm-v">{pick(yachtOf(r.yacht).name, lang)} · {KN[r.preset]} {t('kn', 'уз', 'kn', 'kn', 'kn', 'kn', 'kn', 'nós')} · {pick(SHAPE_NAME[r.course], lang)}{r.current ? t(' · current', ' · течение', ' · corriente', ' · aktuell', ' · şimdiki', ' · courant', ' · in corso', ' · atual') : ''}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
