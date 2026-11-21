'use client';
import { useEffect, useState } from 'react';
import { LOCALE, pick, tx, type Lang } from '@/lib/lang';
import { ACHIEVEMENTS, detailOf, parseAchievements, type Achievements, type Kind } from '@/lib/achievements';
import { ordinal } from '@/lib/player-month';
import { dailyRace } from '@/lib/race';
import { venueOf } from '@/lib/venues';
import '@/styles/achievements.css';

// Your achievements on your own card on /players (release 7c of the 1-on-1 plan; lib/achievements.ts): how many of
// them you have, then each, had ones first: its badge, name and what earns it, and the day it came with what it was
// ("Podium · 9 Nov · 3rd of 25 · Cowes"), or how far along you are, or nothing yet. From POST /connect/achievements,
// which the database answers the same on every device; nothing for a sailor not signed in.
// one ask a page, shared by whoever wants them (the card's achievements and its history): the rules run once
let asked: { at: number; p: Promise<Achievements | null> } | null = null;
export function readAchievements(): Promise<Achievements | null> {
  if (asked && Date.now() - asked.at < 30_000) return asked.p;
  const p = fetch('/connect/achievements', { method: 'POST', cache: 'no-store', credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null)).then(parseAchievements, () => null);
  asked = { at: Date.now(), p };
  return p;
}
export function useAchievements(on = true) {
  const [a, setA] = useState<Achievements | null>(null);
  useEffect(() => {
    if (!on) return;
    let live = true;
    readAchievements().then((x) => { if (live) setA(x); });
    return () => { live = false; };
  }, [on]);
  return a;
}
export function MyAchievements({ lang }: { lang: Lang }) {
  const a = useAchievements();
  return a ? <AchievementsView a={a} lang={lang} /> : null;
}

export function AchievementsView({ a, lang }: { a: Achievements; lang: Lang }) {
  const t = tx(lang), loc = LOCALE[lang], ord = (n: number) => ordinal(n, lang);
  const had = new Map(a.got.map((g) => [g.key, g]));
  const day = (iso: string) => new Date(iso).toLocaleDateString(loc, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const kindName = (k: Kind) => (k === 'race'
    ? t('Today’s race', 'Гонка дня', 'Regata del día', 'Regatta des Tages', 'Günün yarışı', 'Régate du jour', 'Regata del giorno', 'Regata do dia')
    : k === 'venues' ? t('Venues', 'Акватории', 'Sedes', 'Reviere', 'Yarış alanları', 'Plans d’eau', 'Campi', 'Raias')
      : t('1-on-1', '1 на 1', '1 contra 1', '1 gegen 1', 'Bire bir', 'Duel', '1 contro 1', 'Duelo'));
  // had first (the latest first), then those under way (the nearest first), then the rest in the list's order
  const order = [...ACHIEVEMENTS].sort((x, y) => {
    const gx = had.get(x.key), gy = had.get(y.key);
    if (gx && gy) return gx.at < gy.at ? 1 : -1;
    if (gx || gy) return gx ? -1 : 1;
    const px = a.progress[x.key], py = a.progress[y.key], fx = px && px[0] ? px[0] / px[1] : 0, fy = py && py[0] ? py[0] / py[1] : 0;
    return fy - fx;
  });
  return (
    <div className="bt-g ach">
      <span className="bt-k">{t(`Achievements · ${had.size} of ${ACHIEVEMENTS.length}`, `Достижения · ${had.size} из ${ACHIEVEMENTS.length}`, `Logros · ${had.size} de ${ACHIEVEMENTS.length}`, `Erfolge · ${had.size} von ${ACHIEVEMENTS.length}`, `Başarılar · ${ACHIEVEMENTS.length} içinde ${had.size}`, `Succès · ${had.size} sur ${ACHIEVEMENTS.length}`, `Traguardi · ${had.size} su ${ACHIEVEMENTS.length}`, `Conquistas · ${had.size} de ${ACHIEVEMENTS.length}`)}</span>
      <ul className="ach-list">{order.map((d) => {
        const g = had.get(d.key), p = !g ? a.progress[d.key] : null, part = p && p[0] > 0;
        const venue = g && typeof g.detail.day === 'string' ? pick(venueOf(dailyRace(new Date(`${g.detail.day}T12:00:00Z`)).venue).name, lang) : null;
        const more = g ? [detailOf(g, lang, ord), venue].filter(Boolean).join(' · ') : '';
        return (
          <li key={d.key} className={`ach-${d.kind}${g ? ' got' : part ? ' part' : ' none'}`}>
            <span className="ach-badge" aria-hidden="true">{d.icon}</span>
            <span className="ach-t">
              <span className="ach-k">{kindName(d.kind)}</span>
              <b>{pick(d.name, lang)}</b>
              <span className="ach-how">{pick(d.how, lang)}</span>
              {g ? <span className="ach-got">{t('Got it', 'Получено', 'Conseguido', 'Geschafft', 'Kazanıldı', 'Obtenu', 'Ottenuto', 'Conquistado')} · {day(g.at)}{more ? ` · ${more}` : ''}</span>
                : part ? <span className="ach-prog"><span className="ach-bar"><i style={{ width: `${Math.round((p[0] / p[1]) * 100)}%` }} /></span>{p[0]} / {p[1]}</span>
                  : <span className="ach-not">{t('Not yet', 'Пока нет', 'Aún no', 'Noch nicht', 'Henüz değil', 'Pas encore', 'Non ancora', 'Ainda não')}</span>}
            </span>
          </li>
        );
      })}</ul>
    </div>
  );
}
