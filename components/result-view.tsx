'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ruBoats, tx, type Lang } from '@/lib/lang';
import RULES from '@/lib/rules.json';
import { IconBack, IconRestart, clock } from './ui';
import { CourseMap } from './course-map';
import { courseDistance, fmtDistance, legDistances } from '@/lib/race';

// What the game keeps for a finished race (public/game/main.js, finishToPage).
type Boat = { name: string | null; me: boolean; color: string | null; done: boolean; dsq: boolean; secs: number | null; track: [number, number][] };
type Foul = { rule: string; who: string | null; t: number | null; x: number | null; z: number | null };
type Result = {
  v: 1; id: string; at: number; daily: string | null; preset: 'light' | 'medium' | 'strong'; length: string; laps: number; start: number; current: boolean;
  course: { windward: [number, number]; gate: [number, number][]; pin: [number, number]; committee: [number, number]; legs: string[]; wing?: [number, number]; type?: 'tri' };
  boats: Boat[];
  log: { gunD: number | null; gunV: number | null; ocs: boolean; startDsq: string | null; startT: number | null; sailing: number; pct: number | null; head: number; lift: number; tacks: number;
    dirty: number; penT: number; hails: Record<string, number>; legs: number[]; legPlaces: number[]; fouls: Foul[] };
  pb: { best: number; isNew: boolean } | null;
};
type Top = { name: string | null; s: number };

const RULE_LINK: Record<string, string> = { 10: 'rightofway#sec-r10', 11: 'rightofway#sec-r11', 12: 'rightofway#sec-r12', 13: 'rightofway#sec-r13', 18: 'marks#sec-room',
  15: 'limits#sec-r15', 16: 'limits#sec-r16-1', 17: 'limits#sec-r17', 20: 'obstructions#sec-tack', 31: 'penalties#sec-how', 44: 'penalties#sec-how',
  '18.3': 'marks#sec-tack', '18.4': 'marks#sec-gybe', 19: 'obstructions#sec-room' };
const rule = (k: string, lang: Lang) => (RULES as Record<string, { en: string; ru: string }>)[k]?.[lang] || '';
const ordEn = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`;

// head and foot: the site's header and footer, rendered by the page (server components) and passed in
export default function ResultView({ id, lang, signedName, head, foot }: { id: string; lang: Lang; signedName: string | null; head?: ReactNode; foot?: ReactNode }) {
  const t = tx(lang);
  const [res, setRes] = useState<Result | null | undefined>(undefined);
  const [top, setTop] = useState<Top[] | null>(null);
  // shared: the race isn't on this device, but the game posted it to the server when it finished (stats.js raceResult),
  // so this is someone's link: the page speaks of "this boat", not "you"
  const [shared, setShared] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let mine: Result | null = null;
    try { mine = JSON.parse(localStorage.getItem('regatta-result-' + id) || 'null'); } catch {}
    if (mine) { setRes(mine); return; }
    let live = true;
    fetch(`https://iyt.rycrentals.com/api/game?race=${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : null)).then((j: Result | null) => {
      if (!live) return;
      if (j && j.v === 1 && Array.isArray(j.boats) && j.boats.some((b) => b.me)) { setShared(true); setRes(j); } else setRes(null);
    }).catch(() => live && setRes(null));
    return () => { live = false; };
  }, [id]);
  useEffect(() => {
    if (!res?.daily) return;
    fetch('https://iyt.rycrentals.com/api/game').then((r) => (r.ok ? r.json() : null)).then((j) => {
      const d = j?.daily; if (d && d.d === res.daily) setTop((d.top || []).slice(0, 3));
    }).catch(() => {});
  }, [res]);

  if (res === undefined) return <div className="scr help" lang={lang}>{head}</div>;
  if (!res) {
    return (
      <div className="scr help" lang={lang}>
        {head}
        <div className="hwrap">
          <header className="hhead">
            <div className="lhead">
              <Link className="round round-s round-muted" href="/race" aria-label={t('Back to the race hub', 'Назад в меню гонок')}><IconBack /></Link>
              <span className="kicker">{t('Race result', 'Результат гонки')}</span>
            </div>
            <h1 className="h-land">{t('This race can’t be found', 'Эта гонка не найдена')}</h1>
            <p className="lead">{t('A result goes online when its race is finished, and the device it was sailed on keeps its last twenty. This one is in neither place.', 'Результат попадает в сеть, когда гонка закончена, а устройство, где её прошли, хранит двадцать последних. Этой нет ни там, ни там.')}</p>
            <div className="btn-row"><Link className="pill pill-primary pill-s" href="/race"><span className="btn-t">{t('Race hub', 'Меню гонок')}</span></Link></div>
          </header>
        </div>
        {foot}
      </div>
    );
  }

  const me = res.boats.find((b) => b.me)!, place = res.boats.indexOf(me) + 1, winner = res.boats.find((b) => b.done && !b.dsq);
  const L = res.log;
  const windW = { light: t('light', 'слабый'), medium: t('medium', 'средний'), strong: t('strong', 'сильный') }[res.preset];
  const kn = { light: 7, medium: 12, strong: 19 }[res.preset];
  const date = new Date(res.at).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const kicker = res.daily
    ? `${shared ? t('Race of the day', 'Гонка дня') : t('Today’s race', 'Гонка дня')} · ${date} · ${windW} ${kn} ${t('kn', 'уз')} · ${t(`${res.boats.length} boats`, ruBoats(res.boats.length))}`
    : `${t('Free race', 'Свободная гонка')} · ${windW} ${kn} ${t('kn', 'уз')} · ${t(`${res.boats.length} boats`, ruBoats(res.boats.length))} · ${res.course.wing ? `${t('triangle', 'треугольник')} · ` : ''}${res.laps} ${t(res.laps > 1 ? 'laps' : 'lap', res.laps > 1 ? 'круга' : 'круг')}`;
  const title = me.dsq ? t('Disqualified', 'Дисквалификация') : shared ? t(`Finished ${ordEn(place)}`, `${place}-е место на финише`) : t(`You finished ${ordEn(place)}`, `${place}-е место на финише`);
  const gap = me.secs != null && winner?.secs != null && winner !== me ? `+${(me.secs - winner.secs).toFixed(1)} ${t('s', 'с')}` : '—';
  const again = res.daily ? '/play?race=today' : '/play?race=free';
  const isToday = res.daily === new Date().toISOString().slice(0, 10); // the daily race's day is the UTC date, as the game's
  // someone else's race: beat their time if it's today's, else today's race
  const cta = shared
    ? (isToday && me.secs != null && !me.dsq ? { href: '/play?race=today', label: t('Beat this time', 'Побей это время') } : { href: '/race', label: t('Sail today’s race', 'Пройти гонку дня') })
    : { href: again, label: t('Race again', 'Ещё гонку') };
  const you = shared ? t('This boat', 'Эта лодка') : t('You', 'Ты');
  // the link to this page, with a line to go with it: shared by the phone's own sheet, or copied where there's none
  const share = async () => {
    // in Russian the card and the title are too; utm_source says in the analytics how many come from a shared result
    const url = `${location.origin}/race/result/${encodeURIComponent(res.id)}?${lang === 'ru' ? 'lang=ru&' : ''}utm_source=share&utm_medium=result`;
    const time = me.secs != null && !me.dsq ? clock(me.secs) : '';
    const text = me.dsq ? t('My race in Up and down', 'Моя гонка в Up and down')
      : res.daily && isToday ? t(`I finished ${ordEn(place)} in ${time} in today’s race. Can you beat it?`, `${place}-е место за ${time} в гонке дня. Сможешь быстрее?`)
      : t(`I finished ${ordEn(place)} in ${time}`, `${place}-е место за ${time}`);
    try {
      if (navigator.share) { await navigator.share({ title: 'Up and down', text, url }); return; }
    } catch (e) { if ((e as Error)?.name === 'AbortError') return; }
    const line = `${text} ${url}`;
    let ok = false;
    try { await navigator.clipboard.writeText(line); ok = true; } catch {
      // no clipboard API here (Telegram's webview, an embedded browser): the old way, through a selected field
      const f = document.createElement('textarea');
      f.value = line; f.setAttribute('readonly', ''); f.style.position = 'fixed'; f.style.opacity = '0';
      document.body.append(f); f.select();
      try { ok = document.execCommand('copy'); } catch {}
      f.remove();
    }
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2500); }
  };

  // the debrief: the game's own items, each good or one to work on
  type Item = { k: string; good: boolean; v: string; tip: string };
  const items: Item[] = [];
  if (L.startDsq) items.push({ k: t('Start', 'Старт'), good: false, v: L.startDsq === 'U' ? t('Disqualified at the start (U flag)', 'Дисквалификация на старте (флаг U)') : t('Disqualified at the start (black flag)', 'Дисквалификация на старте (чёрный флаг)'), tip: t('Under U or the black flag, stay below the line for the whole last minute.', 'Под флагом U или чёрным держись за линией всю последнюю минуту.') });
  else if (L.ocs) items.push({ k: t('Start', 'Старт'), good: false, v: t('At the gun: over the line — you had to go back', 'На сигнале старта: за линией — пришлось возвращаться'), tip: t('Aim to be a boat length behind the line, at full speed, as the gun goes.', 'Цель — быть в корпусе от линии на полной скорости в момент сигнала.') });
  else if (L.gunD != null && L.gunV != null) {
    const good = L.gunD >= 0 && L.gunD < 25 && L.gunV > 3.5, d = Math.round(Math.max(0, L.gunD)), v = L.gunV.toFixed(1);
    items.push({ k: t('Start', 'Старт'), good, v: t(`At the gun: ${d} m from the line at ${v} kn`, `На сигнале старта: ${d} м до линии, ${v.replace('.', ',')} уз`), tip: good ? '' : t('Aim to be a boat length behind the line, at full speed, as the gun goes.', 'Цель — быть в корпусе от линии на полной скорости в момент сигнала.') });
  }
  if (L.pct != null) items.push({ k: t('Speed', 'Скорость'), good: L.pct >= 90, v: t(`${L.pct}% of target on average`, `В среднем ${L.pct}% от целевой`), tip: L.pct >= 90 ? '' : t('Keep the sheet in the blue band and steer smoothly: every turn of the rudder brakes the boat.', 'Держи шкот в синей полосе и рули плавно: каждое движение руля тормозит.') });
  if (L.tacks) items.push({ k: t('Tacks', 'Повороты'), good: L.lift <= L.head, v: t(`On the beat: ${L.head} in a header, ${L.lift} in a lift`, `На лавировке: ${L.head} — когда ветер зашёл, ${L.lift} — когда отошёл`), tip: L.lift <= L.head ? '' : t('Tack when the wind heads you (the orange chip), not when it lifts you (the blue one).', 'Поворачивай, когда ветер заходит (оранжевая метка), а не когда отходит (синяя).') });
  if (L.dirty >= 10) items.push({ k: t('Dirty air', 'Ветровая тень'), good: L.dirty < 30, v: t(`${L.dirty} s in another boat’s dirty air`, `${L.dirty} с в ветровой тени другой лодки`), tip: L.dirty < 30 ? '' : t('Behind and downwind of another boat the wind is weaker: tack away or sail clear of it.', 'За другой лодкой и под ветром от неё ветер слабее: поверни или уйди из ветровой тени.') });
  if (L.penT > 1) items.push({ k: t('Penalties', 'Штрафы'), good: false, v: t(`${L.penT} s spinning penalty turns`, `${L.penT} с на штрафных оборотах`), tip: t('The rule behind each foul is below.', 'Правило за каждым нарушением — ниже.') });
  const hails = Object.values(L.hails || {}).reduce((a, b) => a + b, 0);
  if (hails) items.push({ k: t('Hails', 'Оклики'), good: false, v: t(`Hailed ${hails}× by boats you had to keep clear of`, `${hails} раз(а) окликнули лодки, которым ты должен был уступить`), tip: t('A hail is a warning, not a penalty — keep clear in time.', 'Оклик — предупреждение, а не штраф: уступай вовремя.') });
  if (!L.fouls.length && !L.ocs && !L.startDsq && !hails) items.push({ k: t('Rules', 'Правила'), good: true, v: t('No fouls and no penalties — a clean race', 'Ни нарушений, ни штрафов — чистая гонка'), tip: '' });
  const foulRules = [...new Map(L.fouls.map((f) => [f.rule, f])).values()];
  const legM = legDistances(res.course, res.course.legs);
  const tracks = res.boats.map((b) => ({ pts: b.track, me: b.me }));
  const fouls = L.fouls.filter((f) => f.x != null && f.z != null).map((f) => [f.x!, f.z!] as [number, number]);
  const legName = (k: string) => ({ start: t('Start', 'Старт'), mark: t('Windward mark', 'Верхний знак'), wing: t('Wing mark', 'Боковой знак'), gate: t('Leeward gate', 'Нижние ворота'), finish: t('Finish', 'Финиш') }[k] || k);

  return (
    <div className="scr help result" lang={lang} data-acct={signedName ? 'signed' : 'guest'}>
      {head}
      <div className="hwrap">
        <header className="hhead">
          <div className="lhead">
            <Link className="round round-s round-muted" href="/race" aria-label={t('Back to the race hub', 'Назад в меню гонок')}><IconBack /></Link>
            <span className="kicker">{kicker}</span>
          </div>
          <h1 className="h-land">{title}</h1>
          <div className="rfacts">
            <div className="stat"><span className="meta">{t('Time', 'Время')}</span><b>{me.secs != null ? clock(me.secs) : '—'}</b></div>
            <div className="stat"><span className="meta">{t('Behind the winner', 'От победителя')}</span><b>{gap}</b></div>
            <div className="stat"><span className="meta">{t('Penalties', 'Штрафы')}</span><b>{L.penT > 1 ? `${L.penT} ${t('s', 'с')}` : '0'}</b></div>
            {!shared && res.pb?.isNew && <span className="chip chip-on">{t('New personal best', 'Новый личный рекорд')}</span>}
            {!shared && !res.pb?.isNew && res.pb && me.secs === res.pb.best && <span className="chip chip-on">{res.daily ? t('Your best today', 'Твой лучший сегодня') : t('Your best on this course', 'Твой лучший на этой дистанции')}</span>}
          </div>
          <div className="btn-row">
            <a className="pill pill-primary pill-s" href={cta.href}>{!shared && <IconRestart />}<span className="btn-t">{cta.label}</span></a>
            {!shared && <button type="button" className="pill pill-s" onClick={share}><span className="btn-t">{copied ? t('Link copied', 'Ссылка скопирована') : t('Share', 'Поделиться')}</span></button>}
            <Link className="pill pill-s" href="/race"><span className="btn-t">{t('Race hub', 'Меню гонок')}</span></Link>
          </div>
        </header>

        {/* the whole race from above, as wide as the page: a square map on a phone, a wide one where there's room */}
        <section className="hsec">
          <div className="rcard line">
            <div className="lhead"><span className="meta">{shared ? t('The track', 'Трек') : t('Your track', 'Твой трек')}</span><span className="sp" /><span className="small muted ico-t"><span className="bdot bdot-you" />{shared ? t('this boat', 'эта лодка') : t('you', 'ты')}<span className="bdot bdot-fleet" />{t('the fleet', 'соперники')}</span></div>
            <CourseMap className="track only-narrow" lang={lang} geo={res.course} preset={res.preset} W={340} H={340} tracks={tracks} fouls={fouls} />
            <CourseMap className="track track-wide only-wide" lang={lang} geo={res.course} preset={res.preset} W={1000} H={580} tracks={tracks} fouls={fouls} />
            <span className="small muted">{t('Course', 'Дистанция')} {fmtDistance(courseDistance(res.course, res.laps), lang)}{L.fouls.length ? ` · ${t('orange rings mark the fouls', 'оранжевые кольца — нарушения')}` : ''}</span>
          </div>
        </section>

        <section className="hsec">
          <div className="hsplit">
            <div className="hcol">
              <div className="rcard line">
                <span className="meta">{t('Results', 'Результаты')}</span>
                <ol className="rtable">
                  {res.boats.map((b, i) => (
                    <li key={i} className={b.me ? 'me' : ''}>
                      <span className="n">{b.dsq ? '–' : i + 1}</span>
                      <span className="bdot" style={{ background: b.me ? 'var(--accent)' : b.color || 'var(--tag-line)' }} />
                      <span>{b.me ? you : b.name}</span>
                      <span>{b.dsq ? 'DSQ' : b.secs != null ? clock(b.secs) : '—'}</span>
                      <span className="g">{b.secs != null && winner?.secs != null && b !== winner && !b.dsq ? `+${(b.secs - winner.secs).toFixed(1)}` : '—'}</span>
                    </li>
                  ))}
                </ol>
              </div>
              {res.daily ? <Ranking t={t} top={top} me={me} signedName={shared ? null : signedName} you={shared ? you : null} /> : shared ? null : (
                <div className="rcard">
                  <span className="meta">{t('Your best on this course', 'Твой лучший на этой дистанции')}</span>
                  <span className="h-land">{res.pb ? clock(res.pb.best) : '—'}</span>
                  <p className="lead muted">{t('Free races stay with you; today’s race is the one that ranks.', 'Свободные гонки остаются у тебя; в рейтинг идёт гонка дня.')}</p>
                </div>
              )}
            </div>
            <div className="hcol">
              {!!L.legs.length && (
                <div className="rcard line">
                  <span className="meta">{t('Leg by leg', 'По отрезкам')}</span>
                  <ol className="legs">
                    {/* the game logs the clock as you pass each mark; the finish is your finishing time and place */}
                    {[...L.legs.map((tm, i) => ({ k: res.course.legs[i], i, tm, pl: L.legPlaces[i] })),
                      ...(me.done && me.secs != null && L.legs.length < res.course.legs.length ? [{ k: 'finish', i: res.course.legs.length - 1, tm: me.secs, pl: me.dsq ? 0 : place }] : [])].map((x, i) => (
                      <li key={i} className="done">
                        <span>{legName(x.k)}{x.pl || legM[x.i] ? <span className="d">{[legM[x.i] ? `${Math.round(legM[x.i])} ${t('m', 'м')}` : '', x.pl ? t(`${ordEn(x.pl)} of ${res.boats.length}`, `${x.pl}-й из ${res.boats.length}`) : ''].filter(Boolean).join(' · ')}</span> : null}</span>
                        <span className="t">{clock(Math.max(0, x.tm))}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="hsec">
          <div className="hsec-k"><span className="kicker">{shared ? t('The race', 'Гонка') : t('Your race', 'Твоя гонка')}</span><h2 className="h-land-s">{t('Where the time went', 'Куда ушло время')}</h2></div>
          <div className="dbgrid">
            {items.map((x, i) => (
              <div key={i} className="dbi">
                <div className="lhead"><span className="meta">{x.k}</span><span className="sp" /><span className={`st ${x.good ? 'st-good' : 'st-work'}`}>{x.good ? t('Good', 'Хорошо') : t('Work on it', 'Поработай')}</span></div>
                <span className="v">{x.v}</span>
                {x.tip && <p className="tip">{x.tip}</p>}
              </div>
            ))}
          </div>
          {foulRules.map((f) => (
            <div key={f.rule} className="rule-box">
              <span className="meta accent">{t(`Rule ${f.rule}`, `Правило ${f.rule}`)}{f.t != null ? ` · ${clock(Math.max(0, f.t))}` : ''}{f.who ? ` · ${f.who}` : ''}</span>
              <span className="card-title">{rule('r' + f.rule, lang)}</span>
              <p className="lead muted">{rule('x' + f.rule, lang)}</p>
              {RULE_LINK[f.rule] && <a className="back-link" href={`https://iyt.rycrentals.com${lang === 'ru' ? '/ru' : ''}/racing-rules/${RULE_LINK[f.rule]}`}>{t('Read the rule →', 'Прочитать правило →')}</a>}
            </div>
          ))}
        </section>

        <section className="hsec">
          <div className="btn-row">
            <a className="pill pill-primary pill-s" href={cta.href}>{!shared && <IconRestart />}<span className="btn-t">{cta.label}</span></a>
            <Link className="pill pill-s" href="/race/free"><span className="btn-t">{t('Free race', 'Свободная гонка')}</span></Link>
            <Link className="pill pill-s pill-quiet" href="/race"><span className="btn-t">{t('Race hub', 'Меню гонок')}</span></Link>
          </div>
        </section>
      </div>
      {foot}
    </div>
  );
}

// you: how a shared result names its boat; then there's no asking to sign in, as it isn't the viewer's race
function Ranking({ t, top, me, signedName, you }: { t: (en: string, ru: string) => string; top: Top[] | null; me: Boat; signedName: string | null; you: string | null }) {
  return (
    <div className="rcard">
      <span className="meta">{t('Today’s fastest', 'Самые быстрые сегодня')}</span>
      <ol className="lb">
        {(top || []).map((r, i) => <li key={i}><span className="n">{i + 1}</span><span>{r.name || t('No name', 'Без имени')}</span><span>{clock(r.s)}</span></li>)}
        {top && !top.length && <li><span className="n">·</span><span className="muted">{t('No times yet today', 'Сегодня ещё нет результатов')}</span><span /></li>}
        <li className="me"><span className="n">·</span><span>{you || (signedName ? `${signedName} (${t('you', 'ты')})` : t('You', 'Ты'))}</span><span>{me.secs != null && !me.dsq ? clock(me.secs) : '—'}</span></li>
      </ol>
      {!signedName && !you && (
        <>
          <p className="lead muted">{t('Sign in and your times go on today’s ranking, with your best times on any device.', 'Войди — и твоё время попадёт в рейтинг дня, а лучшие результаты будут на любом устройстве.')}</p>
          <Link className="pill pill-primary pill-s" href="/sign-in?next=/race"><span className="btn-t">{t('Sign in', 'Войти')}</span></Link>
        </>
      )}
    </div>
  );
}
