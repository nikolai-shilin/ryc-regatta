'use client';
import { useEffect, useRef, useState } from 'react';
import { tx, type Lang } from '@/lib/lang';
import { readMe } from '@/lib/me';
import { readLog, todayUtc } from '@/lib/log';
import { briefUrl, readBrief } from '@/lib/day-brief';
import { parseMine } from '@/lib/duel-rating';
import { parseReady } from '@/lib/duel-seek';
import { parseHour } from '@/lib/duel-hour';
import { parseAchievements } from '@/lib/achievements';
import { localState, markLocal, parseState, suggest, type Card, type Inputs, type Local, type State } from '@/lib/suggest';
import { track } from '@/lib/track';
import '@/styles/for-you.css';

// For you (release 7e of the 1-on-1 plan; lib/suggest.ts): up to three things to do next, best first, each with why in
// a line and one button; × hides that kind for a week, "Fewer like this" shows it less. On the home page, on /duel, and
// after a race on its result page (two there: release 8d).
// What it knows is gathered in the browser, as the pages are built once for everyone: this device's log, today's
// ranked times once you've sailed today, and for a signed-in sailor their 1-on-1 rating, who is looking now, the duel
// hour and the achievements under way; their weights are the database's (GET/POST /connect/suggest), a guest's this
// device's. Who is looking, the duel hour and today's times are read again every minute while the page is seen; the
// achievements and the rating once a visit.
const LOCAL = 'regatta-suggest', EVERY_MS = 60_000;
const readLocal = (): Local => { try { const o = JSON.parse(localStorage.getItem(LOCAL) || 'null'); return o && typeof o === 'object' && o.w && o.out ? o : { w: {}, out: {} }; } catch { return { w: {}, out: {} }; } };
const saveLocal = (l: Local) => { try { localStorage.setItem(LOCAL, JSON.stringify(l)); } catch { /* not kept: the list still forgets for this visit */ } };
const post = (url: string, body: object) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const get = (url: string) => fetch(url, { cache: 'no-store', credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

// once: (the achievements' rules and your rating don't change between two looks a minute apart; who's looking does)
type Once = { mine?: unknown; ach?: unknown };
async function gatherInputs(once: Once): Promise<{ inputs: Inputs; state: State | null }> {
  const back = document.documentElement.hasAttribute('data-back'), signed = !!readMe(), log = readLog(), today = todayUtc();
  const sailed = log.d[today] != null;
  const [brief, mine, ready, hour, ach, st] = await Promise.all([
    sailed ? fetch(briefUrl(today)).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null,
    signed ? ('mine' in once ? once.mine : get('/connect/rating/me').then((j) => (once.mine = j))) : null,
    signed ? post('/connect/seek', { do: 'ready_now' }) : null,
    signed ? post('/connect/seek', { do: 'hour' }) : null,
    signed ? ('ach' in once ? once.ach : post('/connect/achievements', {}).then((j) => (once.ach = j))) : null,
    signed ? get('/connect/suggest') : null,
  ]);
  const r = parseMine(mine);
  return {
    inputs: { now: Date.now(), back, signed, log, field: readBrief(brief, today)?.s ?? null, rating: r ? { rating: r.rating, races: r.races } : null,
      ready: parseReady(ready?.list), hour: parseHour(hour?.hour), achievements: parseAchievements(ach) },
    state: signed ? parseState(st) : localState(readLocal()),
  };
}

// max: how many at most (the result page's card is narrow: two)
export function ForYou({ lang, max = 3 }: { lang: Lang; max?: number }) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const signed = useRef(false), seen = useRef(new Set<string>()), once = useRef<Once>({});
  useEffect(() => {
    let on = true;
    const read = async () => {
      if (document.visibilityState === 'hidden') return;
      const { inputs, state } = await gatherInputs(once.current);
      if (!on) return;
      signed.current = inputs.signed;
      const list = suggest(inputs, lang, state).slice(0, max);
      setCards(list);
      // a showing told once a visit for each kind (the database counts one in ten minutes anyway)
      const fresh = list.map((c) => c.kind).filter((k) => !seen.current.has(k));
      fresh.forEach((k) => seen.current.add(k));
      if (fresh.length && inputs.signed) post('/connect/suggest', { ev: 'shown', kinds: fresh });
    };
    read();
    const i = setInterval(read, EVERY_MS);
    return () => { on = false; clearInterval(i); };
  }, [lang, max]);
  const mark = (c: Card, ev: 'tap' | 'dismiss' | 'fewer') => {
    track('For you', { kind: c.kind, ev });
    if (signed.current) post('/connect/suggest', { ev, kinds: [c.kind] });
    else saveLocal(markLocal(readLocal(), ev, c.kind));
    if (ev !== 'tap') setCards((x) => (x ? x.filter((y) => y.kind !== c.kind) : x));
  };
  return cards && cards.length ? <ForYouView lang={lang} cards={cards} mark={mark} /> : null;
}

export function ForYouView({ lang, cards, mark }: { lang: Lang; cards: Card[]; mark: (c: Card, ev: 'tap' | 'dismiss' | 'fewer') => void }) {
  const t = tx(lang);
  // what kind of thing each card is, over its title (the design's GOAL, LIVE, …)
  const kindName = (k: string) => ({
    first_race: t('First race', 'Первая гонка', 'Primera regata', 'Erste Regatta', 'İlk yarış', 'Première régate', 'Prima regata', 'Primeira regata'),
    sign_in: t('Keep it', 'Сохрани', 'Guárdalo', 'Behalten', 'Sakla', 'Garde-le', 'Tienilo', 'Guarde'),
    today: t('Today’s race', 'Гонка дня', 'Regata del día', 'Regatta des Tages', 'Günün yarışı', 'Régate du jour', 'Regata del giorno', 'Regata do dia'),
    today_better: t('Today’s race', 'Гонка дня', 'Regata del día', 'Regatta des Tages', 'Günün yarışı', 'Régate du jour', 'Regata del giorno', 'Regata do dia'),
    ready: t('1-on-1', '1 на 1', '1 contra 1', '1 gegen 1', 'Bire bir', 'Duel', '1 contro 1', '1 contra 1'),
    hour: t('Duel hour', 'Час дуэлей', 'Hora de duelos', 'Duell-Stunde', 'Düello saati', 'Heure des duels', 'Ora dei duelli', 'Hora dos duelos'),
    level: t('Level', 'Уровень', 'Nivel', 'Niveau', 'Seviye', 'Niveau', 'Livello', 'Nível'),
    first_duel: t('1-on-1', '1 на 1', '1 contra 1', '1 gegen 1', 'Bire bir', 'Duel', '1 contro 1', '1 contra 1'),
    goal: t('Goal', 'Цель', 'Meta', 'Ziel', 'Hedef', 'Objectif', 'Obiettivo', 'Meta'),
  } as Record<string, string>)[k] ?? '';
  return (
    <section className="fy" aria-labelledby="fy-h">
      <h2 className="fy-h" id="fy-h">{t('For you', 'Для тебя', 'Para ti', 'Für dich', 'Senin için', 'Pour toi', 'Per te', 'Para você')}</h2>
      <ol className="fy-list">{cards.map((c) => (
        <li key={c.kind} className={`fy-c fy-${c.kind}${c.live ? ' live' : ''}`}>
          {c.live ? <span className="fy-live"><span className="dot-live" />{t('Now', 'Сейчас', 'Ahora', 'Jetzt', 'Şimdi', 'Maintenant', 'Ora', 'Agora')}</span> : <span className="fy-kind">{kindName(c.kind)}</span>}
          <b className="fy-t">{c.title}</b>
          <p className="fy-why"><span>{t('Why:', 'Почему:', 'Por qué:', 'Warum:', 'Neden:', 'Pourquoi :', 'Perché:', 'Por quê:')}</span> {c.why}</p>
          <div className="fy-acts">
            <a className="fy-go" href={c.href} onClick={() => mark(c, 'tap')}>{c.act}</a>
            <button type="button" className="fy-less" onClick={() => mark(c, 'fewer')}>{t('Fewer like this', 'Реже такое', 'Menos como esto', 'Weniger davon', 'Bunlardan daha az', 'Moins de ce genre', 'Meno così', 'Menos assim')}</button>
          </div>
          <button type="button" className="fy-x" aria-label={t('Hide this for a week', 'Скрыть на неделю', 'Ocultar una semana', 'Eine Woche ausblenden', 'Bir hafta gizle', 'Masquer une semaine', 'Nascondi per una settimana', 'Ocultar por uma semana')} onClick={() => mark(c, 'dismiss')}>×</button>
        </li>
      ))}</ol>
    </section>
  );
}
