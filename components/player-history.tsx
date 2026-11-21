'use client';
import { LOCALE, pick, tx, type Lang } from '@/lib/lang';
import { signed as sgn } from '@/lib/elo';
import { ordinal, monthName, type PlayerMonth } from '@/lib/player-month';
import { dailyRace } from '@/lib/race';
import { venueOf, VENUES } from '@/lib/venues';
import { yachtOf, isYacht } from '@/lib/yachts';
import { ACHIEVEMENTS, detailOf } from '@/lib/achievements';
import { bestOf, byMonth, type Entry } from '@/lib/history';
import type { Log } from '@/lib/log';
import type { Count } from '@/lib/players';
import { useMonths, useMyDuels } from './player-tabs';
import { useAchievements } from './achievements';

// A sailor's best of and history on their card's overview (release 8a of the 1-on-1 plan; lib/history.ts): the best
// place in today's race, the biggest 1-on-1 win, the longest streak, the longest run of wins and the venue sailed most;
// then the last three months, the latest first, each with its sum and every day of today's race ranked, every 1-on-1
// finished and every achievement, mixed by day. Today's race is anyone's (the scores API's months, by their key); the
// 1-on-1s, the achievements and the streak are your own card's alone.
const venueName = (id: string, lang: Lang) => { const v = VENUES.find((x) => x.id === id); return v ? pick(v.name, lang) : null; };

export function PlayerHistory({ lang, k, mine, log, venues }: { lang: Lang; k: string; mine: boolean; log: Log | null; venues: Count[] }) {
  const t = tx(lang), loc = LOCALE[lang], ord = (n: number) => ordinal(n, lang);
  const months = useMonths(k), duels = useMyDuels(mine), ach = useAchievements(mine);
  if (months === null || (mine && duels === undefined)) return null; // (the months and your 1-on-1s in first; the achievements join when they come)
  const days = months.filter((m): m is PlayerMonth => !!m).flatMap((m) => m.days);
  const races = mine && duels ? duels.races : [], got = mine && ach ? ach.got : [];
  const best = bestOf({ days, duels: races, logDays: mine && log ? Object.keys(log.d) : [], venues });
  const list = byMonth({ days, duels: races, got }).slice(0, 3);
  const dayS = (iso: string) => new Date(iso).toLocaleDateString(loc, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const anyone = t('a sailor', 'соперник', 'un regatista', 'einen Segler', 'bir denizci', 'un régatier', 'un velista', 'um velejador');
  const raceWhere = (d: string) => { const r = dailyRace(new Date(`${d}T12:00:00Z`)); return `${pick(venueOf(r.venue).name, lang)} · ${pick(yachtOf(r.yacht).name, lang)}`; };
  const ofN = (p: number, n: number) => t(`${ord(p)} of ${n}`, `${p}-е из ${n}`, `${ord(p)} de ${n}`, `${ord(p)} von ${n}`, `${n} içinde ${ord(p)}`, `${ord(p)} sur ${n}`, `${ord(p)} su ${n}`, `${ord(p)} de ${n}`);

  const bests: [string, string][] = [];
  if (best.place) bests.push([t('Best place, today’s race', 'Лучшее место в гонке дня', 'Mejor puesto, regata del día', 'Bester Platz, Regatta des Tages', 'Günün yarışında en iyi sıra', 'Meilleure place, régate du jour', 'Miglior posizione, regata del giorno', 'Melhor posição, regata do dia'),
    `${ofN(best.place.place, best.place.of)} · ${pick(venueOf(dailyRace(new Date(`${best.place.d}T12:00:00Z`)).venue).name, lang)} · ${dayS(`${best.place.d}T12:00:00Z`)}`]);
  if (best.win) bests.push([t('Biggest 1-on-1 win', 'Самая ценная победа 1 на 1', 'Mayor victoria 1 contra 1', 'Größter 1-gegen-1-Sieg', 'En büyük bire bir galibiyet', 'Plus belle victoire en duel', 'Vittoria 1 contro 1 più grande', 'Maior vitória em duelo'),
    `${sgn(best.win.delta!)} · ${best.win.them || anyone} · ${dayS(best.win.at)}`]);
  if (best.streak && best.streak.n >= 2) bests.push([t('Longest streak', 'Самая длинная серия', 'Racha más larga', 'Längste Serie', 'En uzun seri', 'Plus longue série', 'Serie più lunga', 'Maior sequência'),
    t(`${best.streak.n} days · to ${dayS(`${best.streak.end}T12:00:00Z`)}`, `${best.streak.n} дн. · до ${dayS(`${best.streak.end}T12:00:00Z`)}`, `${best.streak.n} días · hasta el ${dayS(`${best.streak.end}T12:00:00Z`)}`, `${best.streak.n} Tage · bis ${dayS(`${best.streak.end}T12:00:00Z`)}`, `${best.streak.n} gün · ${dayS(`${best.streak.end}T12:00:00Z`)} tarihine kadar`, `${best.streak.n} jours · jusqu’au ${dayS(`${best.streak.end}T12:00:00Z`)}`, `${best.streak.n} giorni · fino al ${dayS(`${best.streak.end}T12:00:00Z`)}`, `${best.streak.n} dias · até ${dayS(`${best.streak.end}T12:00:00Z`)}`)]);
  if (best.run >= 2) bests.push([t('Best 1-on-1 run', 'Лучшая серия побед 1 на 1', 'Mejor racha 1 contra 1', 'Beste 1-gegen-1-Serie', 'En iyi bire bir serisi', 'Meilleure série en duel', 'Miglior serie 1 contro 1', 'Melhor sequência em duelos'),
    t(`${best.run} wins in a row`, `${best.run} побед подряд`, `${best.run} victorias seguidas`, `${best.run} Siege in Folge`, `üst üste ${best.run} galibiyet`, `${best.run} victoires d’affilée`, `${best.run} vittorie di fila`, `${best.run} vitórias seguidas`)]);
  if (best.venue && venueName(best.venue.id, lang)) bests.push([t('Most sailed', 'Чаще всего', 'Más navegada', 'Am meisten gesegelt', 'En çok yarışılan', 'Le plus couru', 'Il più corso', 'Mais velejada'),
    t(`${venueName(best.venue.id, lang)} · ${best.venue.n} races`, `${venueName(best.venue.id, lang)} · гонок: ${best.venue.n}`, `${venueName(best.venue.id, lang)} · ${best.venue.n} regatas`, `${venueName(best.venue.id, lang)} · ${best.venue.n} Regatten`, `${venueName(best.venue.id, lang)} · ${best.venue.n} yarış`, `${venueName(best.venue.id, lang)} · ${best.venue.n} régates`, `${venueName(best.venue.id, lang)} · ${best.venue.n} regate`, `${venueName(best.venue.id, lang)} · ${best.venue.n} regatas`)]);

  const row = (e: Entry, i: number) => {
    if (e.kind === 'day') return (
      <li key={`d${i}`} className={`ph-day${e.day.place <= 3 ? ' pod' : ''}`}><span className="ph-i" aria-hidden="true">{e.day.place <= 99 ? e.day.place : '·'}</span>
        <span className="pt-w"><b>{t(`${ofN(e.day.place, e.day.of)} in today’s race`, `${e.day.place}-е из ${e.day.of} в гонке дня`, `${ofN(e.day.place, e.day.of)} en la regata del día`, `${ofN(e.day.place, e.day.of)} in der Regatta des Tages`, `günün yarışında ${ofN(e.day.place, e.day.of)}`, `${ofN(e.day.place, e.day.of)} à la régate du jour`, `${ofN(e.day.place, e.day.of)} nella regata del giorno`, `${ofN(e.day.place, e.day.of)} na regata do dia`)}</b><small>{dayS(e.at)} · {raceWhere(e.day.d)}</small></span>
        <span className="pt-v">{e.day.pts}</span></li>
    );
    if (e.kind === 'duel') { const r = e.race; return (
      <li key={`r${i}`} className={r.won === true ? 'ph-won' : r.won === false ? 'ph-lost' : 'ph-duel'}><span className="ph-i" aria-hidden="true">{r.won === true ? 'W' : r.won === false ? 'L' : '·'}</span>
        <span className="pt-w"><b>{r.won === true ? t('Beat', 'Победа над', 'Ganó a', 'Sieg gegen', 'Yendi:', 'Victoire sur', 'Batte', 'Venceu') : r.won === false ? t('Lost to', 'Поражение от', 'Perdió con', 'Niederlage gegen', 'Kaybetti:', 'Défaite contre', 'Perso contro', 'Perdeu para') : t('Raced', 'Гонка с', 'Regateó con', 'Regatta mit', 'Yarıştı:', 'Régate avec', 'Regata con', 'Correu com')} {r.them || anyone}</b>
          <small>{[dayS(r.at), r.venue ? venueName(r.venue, lang) : null, r.yacht && isYacht(r.yacht) ? pick(yachtOf(r.yacht).name, lang) : null, r.forfeit ? t('forfeit', 'сдача', 'abandono', 'Aufgabe', 'hükmen', 'forfait', 'ritiro', 'desistência') : r.margin != null ? `${r.margin.toFixed(1)} s` : null, r.delta == null ? t('just for fun', 'для себя', 'por diversión', 'zum Spaß', 'eğlencesine', 'pour le plaisir', 'per divertimento', 'por diversão') : null].filter(Boolean).join(' · ')}</small></span>
        <span className={`pt-v ${r.delta && r.delta > 0 ? 'up' : r.delta && r.delta < 0 ? 'down' : ''}`}>{r.delta != null ? sgn(r.delta) : ''}</span></li>
    ); }
    const def = ACHIEVEMENTS.find((a) => a.key === e.got.key)!, more = detailOf(e.got, lang, ord);
    return (
      <li key={`a${i}`} className={`ph-ach ph-ach-${def.kind}`}><span className="ph-i" aria-hidden="true">★</span>
        <span className="pt-w"><b>{pick(def.name, lang)}</b><small>{[dayS(e.at), t('achievement', 'достижение', 'logro', 'Erfolg', 'başarı', 'succès', 'traguardo', 'conquista'), more].filter(Boolean).join(' · ')}</small></span>
        <span className="pt-v" /></li>
    );
  };

  return (
    <>
      {bests.length ? (
        <div className="bt-g">
          <span className="bt-k">{t('Best of', 'Лучшее', 'Lo mejor', 'Das Beste', 'En iyiler', 'Le meilleur', 'Il meglio', 'O melhor')}</span>
          <dl className="ph-best">{bests.map(([k2, v]) => <div key={k2}><dt>{k2}</dt><dd>{v}</dd></div>)}</dl>
        </div>
      ) : null}
      {list.map((m) => (
        <div className="bt-g" key={m.m}>
          <span className="bt-k">{monthName(m.m, lang)} {m.m.slice(0, 4)}</span>
          <p className="ph-sum">{[
            m.days === 1 ? t(`1 day of today’s race · ${m.pts} pts`, `1 день в гонке дня · ${m.pts} оч.`, `1 día de regata del día · ${m.pts} ptos`, `1 Tag Regatta des Tages · ${m.pts} Pkt`, `günün yarışında 1 gün · ${m.pts} puan`, `1 jour de régate du jour · ${m.pts} pts`, `1 giorno di regata del giorno · ${m.pts} pt`, `1 dia de regata do dia · ${m.pts} pts`)
              : m.days ? t(`${m.days} days of today’s race · ${m.pts} pts`, `дней в гонке дня: ${m.days} · ${m.pts} оч.`, `${m.days} días de regata del día · ${m.pts} ptos`, `${m.days} Tage Regatta des Tages · ${m.pts} Pkt`, `günün yarışında ${m.days} gün · ${m.pts} puan`, `${m.days} jours de régate du jour · ${m.pts} pts`, `${m.days} giorni di regata del giorno · ${m.pts} pt`, `${m.days} dias de regata do dia · ${m.pts} pts`) : null,
            m.wins + m.losses ? `${t('1-on-1', '1 на 1', '1 contra 1', '1 gegen 1', 'bire bir', 'duels', '1 contro 1', 'duelos')} ${m.wins}–${m.losses}${m.delta ? `, ${sgn(m.delta)}` : ''}` : null,
            m.got === 1 ? t('an achievement', 'достижение', 'un logro', 'ein Erfolg', 'bir başarı', 'un succès', 'un traguardo', 'uma conquista')
              : m.got ? t(`${m.got} achievements`, `достижений: ${m.got}`, `${m.got} logros`, `${m.got} Erfolge`, `${m.got} başarı`, `${m.got} succès`, `${m.got} traguardi`, `${m.got} conquistas`) : null,
          ].filter(Boolean).join(' · ')}</p>
          <ul className="pt-list ph-list">{m.entries.map(row)}</ul>
        </div>
      ))}
    </>
  );
}
