'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LOCALE, pick, tx, type Lang } from '@/lib/lang';
import { signed as sgn } from '@/lib/elo';
import { byMonth, parseMyDuels, type MyDuels } from '@/lib/my-duels';
import { monthName, monthUrl, ordinal, readPlayerMonth, shiftMonth, type PlayerMonth } from '@/lib/player-month';
import { dailyRace } from '@/lib/race';
import { venueOf, VENUES } from '@/lib/venues';
import { yachtOf, isYacht } from '@/lib/yachts';
import type { Count } from '@/lib/players';

// The tabs of a player's card on /players (release 7d of the 1-on-1 plan; components/players-view.tsx): the overview,
// 1-on-1 (your own card alone: your rivals and every 1-on-1 by month, from GET /connect/duels/me), today's
// races (any card: the last three months day by day, from the scores API's month read, as /race/month has it) and the
// venues. The tabs are buttons over one card; the overview is the card as it was.
export type Tab = 'over' | 'duel' | 'daily' | 'venues';
export function TabBar({ lang, tab, set, duel }: { lang: Lang; tab: Tab; set: (t: Tab) => void; duel: boolean }) {
  const t = tx(lang);
  const tabs: [Tab, string][] = [
    ['over', t('Overview', 'Обзор', 'Resumen', 'Überblick', 'Genel', 'Aperçu', 'Panoramica', 'Visão geral')],
    ...(duel ? [['duel', t('1-on-1', '1 на 1', '1 contra 1', '1 gegen 1', 'Bire bir', 'Duels', '1 contro 1', 'Duelos')] as [Tab, string]] : []),
    ['daily', t('Today’s races', 'Гонки дня', 'Regatas del día', 'Tagesregatten', 'Günün yarışları', 'Régates du jour', 'Regate del giorno', 'Regatas do dia')],
    ['venues', t('Venues', 'Акватории', 'Sedes', 'Reviere', 'Yarış alanları', 'Plans d’eau', 'Campi', 'Raias')],
  ];
  return (
    <div className="pt-tabs" role="tablist" aria-label={t('The player’s card', 'Карточка игрока', 'La ficha del jugador', 'Die Spielerkarte', 'Oyuncu kartı', 'La carte du joueur', 'La scheda del giocatore', 'O cartão do jogador')}>
      {tabs.map(([k, label]) => (
        <button key={k} type="button" role="tab" id={`pt-${k}`} aria-selected={tab === k} aria-controls={`pt-p-${k}`} className="pt-tab" onClick={() => set(k)}>{label}</button>
      ))}
    </div>
  );
}

// 1-on-1: the way to your rating's page, your rivals and every 1-on-1 you finished, by month (your rating itself is on the
// overview)
export function DuelTab({ lang }: { lang: Lang }) {
  const t = tx(lang), loc = LOCALE[lang];
  const [d, setD] = useState<MyDuels | null | undefined>(undefined);
  useEffect(() => {
    let on = true;
    fetch('/connect/duels/me', { cache: 'no-store', credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (on) setD(parseMyDuels(j)); }, () => { if (on) setD(null); });
    return () => { on = false; };
  }, []);
  const day = (s: string) => new Date(s).toLocaleDateString(loc, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const anyone = t('A sailor', 'Соперник', 'Un regatista', 'Ein Segler', 'Bir denizci', 'Un régatier', 'Un velista', 'Um velejador');
  return (
    <div className="pt-p" role="tabpanel" id="pt-p-duel" aria-labelledby="pt-duel">
      <Link className="df-help" href="/duel/rating">{t('Your rating, race by race', 'Твой рейтинг по гонкам', 'Tu rating, regata a regata', 'Deine Wertung, Regatta für Regatta', 'Yarış yarış reytingin', 'Ton classement, régate par régate', 'Il tuo rating, regata per regata', 'Seu rating, regata a regata')} ›</Link>
      {d && d.rivals.length ? (
        <div className="bt-g">
          <span className="bt-k">{t('Rivals', 'Соперники', 'Rivales', 'Rivalen', 'Rakipler', 'Rivaux', 'Rivali', 'Rivais')}</span>
          <ul className="pt-rivals">{d.rivals.map((r, i) => (
            <li key={i}><b>{r.name || anyone}</b>
              <span className="pt-m">{r.rating != null ? `${r.rating} · ` : ''}{t(`${r.met} races`, `гонок: ${r.met}`, `${r.met} regatas`, `${r.met} Regatten`, `${r.met} yarış`, `${r.met} régates`, `${r.met} regate`, `${r.met} regatas`)}</span>
              <span className={`pt-h ${r.wins > r.losses ? 'up' : r.wins < r.losses ? 'down' : ''}`}>{r.wins}–{r.losses}</span></li>
          ))}</ul>
        </div>
      ) : null}
      {d === undefined ? null : !d || !d.races.length ? (
        <p className="bt-hint">{t('No 1-on-1 races finished yet.', 'Гонок 1 на 1 пока нет.', 'Aún no has terminado regatas 1 contra 1.', 'Noch keine 1-gegen-1-Regatta beendet.', 'Henüz bitirilmiş bire bir yarış yok.', 'Pas encore de duel terminé.', 'Ancora nessuna regata 1 contro 1 finita.', 'Nenhum duelo terminado ainda.')} <Link href="/duel">{t('Find a race', 'Найти гонку', 'Buscar una regata', 'Regatta finden', 'Yarış bul', 'Trouver une régate', 'Trova una regata', 'Achar uma regata')} ›</Link></p>
      ) : byMonth(d.races).map((m) => (
        <div className="bt-g" key={m.m}>
          <span className="bt-k">{monthName(m.m, lang)} {m.m.slice(0, 4)} · {m.wins}–{m.losses}{m.delta ? ` · ${sgn(m.delta)}` : ''}</span>
          <ul className="pt-list">{m.races.map((r, i) => (
            <li key={i} className={r.won === true ? 'won' : r.won === false ? 'lost' : undefined}>
              <span className="pt-d">{day(r.at)}</span>
              <span className="pt-w"><b>{r.won === true ? t('Beat', 'Победа над', 'Ganó a', 'Sieg gegen', 'Yendi:', 'Victoire sur', 'Batte', 'Venceu') : r.won === false ? t('Lost to', 'Поражение от', 'Perdió con', 'Niederlage gegen', 'Kaybetti:', 'Défaite contre', 'Perso contro', 'Perdeu para') : t('Raced', 'Гонка с', 'Regateó con', 'Regatta mit', 'Yarıştı:', 'Régate avec', 'Regata con', 'Correu com')} {r.them || anyone}</b>
                <small>{[r.venue ? pick(venueOf(r.venue).name, lang) : null, r.yacht && isYacht(r.yacht) ? pick(yachtOf(r.yacht).name, lang) : null, r.forfeit ? t('forfeit', 'сдача', 'abandono', 'Aufgabe', 'hükmen', 'forfait', 'ritiro', 'desistência') : r.margin != null ? `${r.margin.toFixed(1)} s` : null, r.delta == null ? t('just for fun', 'для себя', 'por diversión', 'zum Spaß', 'eğlencesine', 'pour le plaisir', 'per divertimento', 'por diversão') : null].filter(Boolean).join(' · ')}</small></span>
              <span className={`pt-v ${r.delta && r.delta > 0 ? 'up' : r.delta && r.delta < 0 ? 'down' : ''}`}>{r.delta != null ? sgn(r.delta) : ''}</span>
            </li>
          ))}</ul>
        </div>
      ))}
    </div>
  );
}

// today's races: the last three months, each day with where, the place of how many and the points (the month's read
// that /race/month has; anyone's, by their key)
export function DailyTab({ lang, k, mine }: { lang: Lang; k: string; mine: boolean }) {
  const t = tx(lang), loc = LOCALE[lang], ord = (n: number) => ordinal(n, lang);
  const [months, setMonths] = useState<(PlayerMonth | null)[] | null>(null);
  useEffect(() => {
    let on = true;
    const cur = new Date().toISOString().slice(0, 7), ms = [0, -1, -2].map((n) => shiftMonth(cur, n));
    Promise.all(ms.map((m) => fetch(monthUrl(m, k)).then((r) => (r.ok ? r.json() : null)).then((j) => readPlayerMonth(j, m, k)).catch(() => null)))
      .then((x) => { if (on) setMonths(x); });
    return () => { on = false; };
  }, [k]);
  const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const sailed = (months ?? []).filter((m): m is PlayerMonth => !!m && m.days.length > 0);
  const pts = (n: number) => t(`${n} pts`, `${n} оч.`, `${n} ptos`, `${n} Pkt`, `${n} puan`, `${n} pts`, `${n} pt`, `${n} pts`);
  return (
    <div className="pt-p" role="tabpanel" id="pt-p-daily" aria-labelledby="pt-daily">
      {months === null ? null : !sailed.length ? (
        <p className="bt-hint">{months.every((m) => m === null)
          ? t('Today’s races can’t be loaded right now. Try again in a minute.', 'Гонки дня сейчас не загружаются. Попробуй через минуту.', 'Las regatas del día no se pueden cargar ahora. Inténtalo en un minuto.', 'Die Tagesregatten lassen sich gerade nicht laden. Versuch es in einer Minute.', 'Günün yarışları şu an yüklenemiyor. Bir dakika sonra dene.', 'Les régates du jour ne se chargent pas pour l’instant. Réessaie dans une minute.', 'Le regate del giorno non si caricano ora. Riprova tra un minuto.', 'As regatas do dia não carregam agora. Tente em um minuto.')
          : t('No day of today’s race ranked in the last three months.', 'За последние три месяца нет дней в рейтинге гонки дня.', 'Ningún día clasificado en la regata del día en los últimos tres meses.', 'Kein gewerteter Tag der Regatta des Tages in den letzten drei Monaten.', 'Son üç ayda günün yarışında sıralanmış gün yok.', 'Aucun jour classé à la régate du jour ces trois derniers mois.', 'Nessun giorno in classifica nella regata del giorno negli ultimi tre mesi.', 'Nenhum dia classificado na regata do dia nos últimos três meses.')}</p>
      ) : sailed.map((m) => (
        <div className="bt-g" key={m.m}>
          <span className="bt-k">{monthName(m.m, lang)} {m.m.slice(0, 4)} · {pts(m.pts)}{m.place ? ` · ${t(`${ord(m.place)} of ${m.of}`, `${m.place}-е из ${m.of}`, `${ord(m.place)} de ${m.of}`, `${ord(m.place)} von ${m.of}`, `${m.of} içinde ${ord(m.place)}`, `${ord(m.place)} sur ${m.of}`, `${ord(m.place)} su ${m.of}`, `${ord(m.place)} de ${m.of}`)}` : ''}</span>
          <ul className="pt-list">{[...m.days].reverse().map((x) => (
            <li key={x.d} className={x.place <= 3 ? 'pod' : undefined}>
              <span className="pt-d">{day(x.d)}</span>
              <span className="pt-w"><b>{t(`${ord(x.place)} of ${x.of}`, `${x.place}-е из ${x.of}`, `${ord(x.place)} de ${x.of}`, `${ord(x.place)} von ${x.of}`, `${x.of} içinde ${ord(x.place)}`, `${ord(x.place)} sur ${x.of}`, `${ord(x.place)} su ${x.of}`, `${ord(x.place)} de ${x.of}`)}</b>
                <small>{pick(venueOf(dailyRace(new Date(`${x.d}T12:00:00Z`)).venue).name, lang)} · {pick(yachtOf(dailyRace(new Date(`${x.d}T12:00:00Z`)).yacht).name, lang)}</small></span>
              <span className="pt-v up">{pts(x.pts)}</span>
            </li>
          ))}</ul>
        </div>
      ))}
      <Link className="df-help" href={mine ? '/race/month' : `/race/month?p=${encodeURIComponent(k)}`}>{t('The month, day by day', 'Месяц по дням', 'El mes, día a día', 'Der Monat, Tag für Tag', 'Ay, gün gün', 'Le mois, jour par jour', 'Il mese, giorno per giorno', 'O mês, dia a dia')} ›</Link>
    </div>
  );
}

// the venues: where they race most (the passport itself is drawn by the card, above this)
export function VenueCounts({ lang, venues }: { lang: Lang; venues: Count[] }) {
  const t = tx(lang), byId = new Map<string, (typeof VENUES)[number]>(VENUES.map((v) => [v.id, v])), top = venues.filter((v) => byId.has(v.id)).sort((a, b) => b.n - a.n).slice(0, 8);
  if (!top.length) return null;
  const max = top[0].n;
  return (
    <div className="bt-g">
      <span className="bt-k">{t('Most raced', 'Чаще всего', 'Las más navegadas', 'Am meisten gesegelt', 'En çok yarışılan', 'Les plus courus', 'I più corsi', 'Mais velejadas')}</span>
      <ul className="pt-bars">{top.map((v) => (
        <li key={v.id}><span>{pick(byId.get(v.id)!.name, lang)}</span><i style={{ width: `${Math.round((v.n / max) * 100)}%` }} /><b>{v.n}</b></li>
      ))}</ul>
    </div>
  );
}
