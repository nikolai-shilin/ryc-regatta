'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { LOCALE, ruBoats, ruBoatsOf, tx, type Lang } from '@/lib/lang';
import RULES from '@/lib/rules.json';
import { IconRestart, IconPlay, IconTrophy, IconFlag, IconSail, IconSliders, Num, clock } from './ui';
import { BackLink } from './back-link';
import { CopyLink, ShareButton } from './share-sheet';
import { SceneBrand } from './scene-brand';
import { CountUp } from './count-up';
import { ResultSkeleton, Sk } from './skeleton';
import { FlagImg, Who } from './flag';
import { CourseMap } from './course-map';
import { GameScene } from './game-scene';
import { Soundtrack } from './soundtrack';
import { courseDistance, fmtDistance, legDistances, shapeOf, SHAPE_NAME, type Shape } from '@/lib/race';
import { finishScene, neighbours, raceVenue, standing, winnerOf, type Pose } from '@/lib/finish';
import { venueOf } from '@/lib/venues';
import { readOpts } from '@/lib/opts';
import { costliest, goodLeg, startOf } from '@/lib/race-log';
import { streakOf, todayUtc } from '@/lib/log';
import { streakWords, useLog } from './passport';
import { Replay } from './replay';
import { track } from '@/lib/track';
import { plainRows, shortName } from '@/lib/name';
import { BOAT_EVENT, readBoat } from '@/lib/boat';
import { briefUrl, readBrief, SCORES_API } from '@/lib/day-brief';
import { useWho } from './me';
import { RateRace } from './rate-race';
import { PauseCard } from './pause-card';
import { DEBRIEF_DRILL, drillLink, readDrills } from '@/lib/drills';

// What the game keeps for a finished race (public/game/main.js, finishToPage).
// legT (the clock as she finished each leg, the start's crossing first) and pens (her penalties) came with the finish's
// tiles: a result saved before them has neither, and the page leaves out what it can't say
// won and trackEnd: a 1-on-1 race's, the boat that won, home or not, and the clock the track of a boat not home ends at
type Boat = { name: string | null; me: boolean; color: string | null; flag?: string | null; done: boolean; dsq: boolean; dnf?: boolean; won?: boolean; secs: number | null; trackEnd?: number; track: [number, number][]; at?: Pose;
  legT?: number[]; pens?: number; level?: string };

// a computer skipper's level (public/game/sim.js LEVELS): four pips lit to it and its name, as the race's board shows it
const LEVEL: Record<string, [number, string, string, string]> = { beginner: [1, 'Beginner', 'Новичок', 'Principiante'], club: [2, 'Club', 'Клуб', 'Club'], racer: [3, 'Racer', 'Гонщик', 'Regatista'], expert: [4, 'Expert', 'Эксперт', 'Experto'] };
const Pips = ({ n }: { n: number }) => <span className="rs-key" aria-hidden="true">{[1, 2, 3, 4].map((k) => <i key={k} className={k <= n ? 'on' : ''} />)}</span>;
function Level({ lv, t }: { lv?: string; t: (en: string, ru: string, es?: string) => string }) {
  const L = lv ? LEVEL[lv] : undefined;
  if (!L) return <span className="rs-lv" aria-hidden="true" />;
  return (
    <span className={`rs-lv l${L[0]}`} title={t(L[1], L[2], L[3])} role="img" aria-label={t(L[1], L[2], L[3])}>
      <i /><i /><i /><i />
    </span>
  );
}
type Foul = { rule: string; who: string | null; t: number | null; x: number | null; z: number | null };
type Result = {
  v: 1; id: string; at: number; daily: string | null; oneOnOne?: boolean; preset: 'light' | 'medium' | 'strong'; length: string; laps: number; start: number; current: boolean;
  // `type`, `marks` (every rounding mark, by the leg that goes to it) and `finish` (a finish line of its own) came with the
  // course shapes: a result saved before them has none, and a wing mark makes it a triangle
  course: { windward: [number, number]; gate: [number, number][]; pin: [number, number]; committee: [number, number]; legs: string[]; wing?: [number, number];
    type?: Shape; marks?: Record<string, [number, number]>; finish?: [[number, number], [number, number]] };
  boats: Boat[];
  log: { gunD: number | null; gunV: number | null; ocs: boolean; startDsq: string | null; startT: number | null; sailing: number; pct: number | null; head: number; lift: number; tacks: number;
    dirty: number; penT: number; hails: Record<string, number>; legs: number[]; legPlaces: number[]; fouls: Foul[];
    // with the finish's tiles: the gybes, where along the line you started (0 the pin, 1 the committee boat), the top speed
    gybes?: number; startAt?: number | null; top?: number; topLeg?: number; topKite?: boolean };
  pb: { best: number; isNew: boolean; prev?: number } | null; // prev: the best a new one beat
  yacht?: string; // the class it was sailed in (lib/yachts.ts), when not the JPK 1050
  venue?: string; origin?: [number, number]; seed?: number | null; // where it was sailed: kept since the finish scene
};
type Top = { name: string | null; s: number; fl?: string | null };

const RULE_LINK: Record<string, string> = { 10: 'rightofway#sec-r10', 11: 'rightofway#sec-r11', 12: 'rightofway#sec-r12', 13: 'rightofway#sec-r13', 18: 'marks#sec-room',
  15: 'limits#sec-r15', 16: 'limits#sec-r16-1', 17: 'limits#sec-r17', 20: 'obstructions#sec-tack', 31: 'penalties#sec-how', 44: 'penalties#sec-how',
  '18.3': 'marks#sec-tack', '18.4': 'marks#sec-gybe', 19: 'obstructions#sec-room' };
const rule = (k: string, lang: Lang) => { const r = (RULES as Record<string, { en: string; ru: string; es?: string }>)[k]; return (r && (r[lang] || r.en)) || ''; };
// Your own race, kept on this device, flies your boat's flag where it was started without one (a boat set on another
// device or address, before the account brought it here): the flag you fly now, as the rating shows it too
const withMyFlag = (r: Result): Result => {
  const f = readBoat().flag;
  return f && r.boats.some((b) => b.me && !b.flag) ? { ...r, boats: r.boats.map((b) => (b.me && !b.flag ? { ...b, flag: f } : b)) } : r;
};
const ordEs = (n: number) => `${n}.º`;
const ordEn = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`;

// head and foot: the site's header and footer, rendered by the page (server components) and passed in, for a race that
// can't be found
export default function ResultView({ id, lang, head, foot }: { id: string; lang: Lang; head?: ReactNode; foot?: ReactNode }) {
  const t = tx(lang);
  const who = useWho(lang), signedName = who ? who.name || who.email : null; // from the session cookie (lib/me.ts)
  const [res, setRes] = useState<Result | null | undefined>(undefined);
  const [top, setTop] = useState<Top[] | null>(null);
  // the day's whole field, for "2nd of 37 today": the times of everyone ranked (null until known, or if the server can't say)
  const [field, setField] = useState<number[] | null>(null);
  // shared: the race isn't on this device, but the game posted it to the server when it finished (stats.js raceResult),
  // so this is someone's link: the page speaks of "this boat", not "you"
  const [shared, setShared] = useState(false);
  const log = useLog(); // the venues you've raced and your streak, for the note on a first race somewhere or a day in a row
  // the analytics: a race of yours just finished (the game opens this page as it does), once
  useEffect(() => {
    if (!res || shared || Date.now() - res.at > 10 * 60e3) return;
    try { if (sessionStorage.getItem('tracked-' + res.id)) return; sessionStorage.setItem('tracked-' + res.id, '1'); } catch {}
    const me = res.boats.find((b) => b.me)!, place = res.boats.indexOf(me) + 1, ended = standing(res, me);
    track('Race finish', { race: res.oneOnOne ? 'one-on-one' : res.daily ? 'daily' : 'free', place: ended === 'place' ? `${place}/${res.boats.length}` : ended, pb: res.pb?.isNew ? 1 : 0, venue: res.venue || '' });
  }, [res, shared]);
  useEffect(() => {
    let mine: Result | null = null;
    try { mine = JSON.parse(localStorage.getItem('regatta-result-' + id) || 'null'); } catch {}
    if (mine) {
      setRes(withMyFlag(mine));
      const on = () => setRes((r) => (r ? withMyFlag(r) : r)); // the account's boat, just brought to this device
      addEventListener(BOAT_EVENT, on);
      return () => removeEventListener(BOAT_EVENT, on);
    }
    let live = true;
    fetch(`https://iyt.rycrentals.com/api/game?race=${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : null)).then((j: Result | null) => {
      if (!live) return;
      if (j && j.v === 1 && Array.isArray(j.boats) && j.boats.some((b) => b.me)) { setShared(true); setRes(j); } else setRes(null);
    }).catch(() => live && setRes(null));
    return () => { live = false; };
  }, [id]);
  useEffect(() => {
    if (!res?.daily) return;
    // the day's rating has every ranked time: its first five are the board; if it can't be had, the plain API's
    // first three (today's only). Both asked at once.
    const get = (u: string) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    let live = true;
    Promise.all([get(SCORES_API), get(briefUrl(res.daily))]).then(([j, day]) => {
      if (!live) return;
      const b = readBrief(day, res.daily!), d = j?.daily;
      if (b) setField(b.s);
      setTop(b ? b.top.slice(0, 5).map((r) => ({ name: shortName(r.name), s: r.s, fl: r.fl })) : d && d.d === res.daily ? plainRows((d.top || []).slice(0, 3)) : []);
    });
    return () => { live = false; };
  }, [res]);

  // most often found: its own layout greyed out while it comes, not the site's header
  if (res === undefined) return <div className="scr bt-scr rs-scr bc" lang={lang}><ResultSkeleton label={t('Loading the race', 'Загружаем гонку', 'Cargando la regata')} /></div>;
  if (!res) {
    return (
      <div className="scr help bc" lang={lang}>
        {head}
        <div className="hwrap">
          <header className="hhead">
            <div className="lhead">
              <BackLink className="round round-s round-muted" href="/race" label={t('Back to the race hub', 'Назад в меню гонок', 'Volver al centro de regatas')} />
              <span className="kicker">{t('Race result', 'Результат гонки', 'Resultado de la regata')}</span>
            </div>
            <h1 className="h-land">{t('This race can’t be found', 'Эта гонка не найдена', 'No se encuentra esta regata')}</h1>
            <p className="lead">{t('A result goes online when its race is finished, and the device it was sailed on keeps its last twenty. This one is in neither place.', 'Результат попадает в сеть, когда гонка закончена, а устройство, где её прошли, хранит двадцать последних. Этой нет ни там, ни там.', 'Un resultado se sube cuando termina su regata, y el dispositivo en que se navegó guarda las últimas veinte. Esta no está en ninguno de los dos sitios.')}</p>
            <div className="btn-row"><Link className="pill pill-primary pill-s" href="/race"><span className="btn-t">{t('Race hub', 'Меню гонок', 'Centro de regatas')}</span></Link></div>
          </header>
        </div>
        {foot}
      </div>
    );
  }

  const me = res.boats.find((b) => b.me)!, place = res.boats.indexOf(me) + 1, winner = winnerOf(res), ended = standing(res, me);
  const L = res.log;
  const windW = { light: t('light', 'слабый', 'flojo'), medium: t('medium', 'средний', 'medio'), strong: t('strong', 'сильный', 'fuerte') }[res.preset];
  const kn = { light: 7, medium: 12, strong: 19 }[res.preset];
  const date = new Date(res.at).toLocaleDateString(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'short' });
  // the course's shape, named unless it's up and down
  const shape = shapeOf(res.course), shapeW = shape === 'wl' ? null : t(...SHAPE_NAME[shape]).toLowerCase();
  const one = !!res.oneOnOne; // a 1-on-1 race: two people, no ranking, no best time, no link to share
  const kicker = one
    ? `${t('1-on-1 race', 'Гонка 1 на 1', 'Regata 1 contra 1')} · ${windW} ${kn} ${t('kn', 'уз', 'kn')} · ${shapeW ? `${shapeW} · ` : ''}${res.laps} ${t(res.laps > 1 ? 'laps' : 'lap', res.laps > 1 ? 'круга' : 'круг', res.laps > 1 ? 'vueltas' : 'vuelta')}`
    : res.daily
    ? `${shared ? t('Race of the day', 'Гонка дня', 'Regata del día') : t('Today’s race', 'Гонка дня', 'La regata del día')} · ${date} · ${windW} ${kn} ${t('kn', 'уз', 'kn')} · ${t(`${res.boats.length} boats`, ruBoats(res.boats.length), `${res.boats.length} ${res.boats.length === 1 ? 'barco' : 'barcos'}`)}${shapeW ? ` · ${shapeW}` : ''}`
    : `${t('Custom race', 'Своя гонка', 'Regata personalizada')} · ${windW} ${kn} ${t('kn', 'уз', 'kn')} · ${t(`${res.boats.length} boats`, ruBoats(res.boats.length), `${res.boats.length} ${res.boats.length === 1 ? 'barco' : 'barcos'}`)} · ${shapeW ? `${shapeW} · ` : ''}${res.laps} ${t(res.laps > 1 ? 'laps' : 'lap', res.laps > 1 ? 'круга' : 'круг', res.laps > 1 ? 'vueltas' : 'vuelta')}`;
  const rival = res.boats.find((b) => !b.me)?.name || t('The other boat', 'Соперник', 'El otro barco'); // (a 1-on-1 race's: the one who dropped out)
  const title = ended === 'dsq' ? t('Disqualified', 'Дисквалификация', 'Descalificado') : ended === 'dnf' ? t('Did not finish', 'Не финишировал', 'No terminó') : ended === 'won' ? t(`You won: ${rival} dropped out`, `Ты победил: ${rival} — сход`, `Ganaste: ${rival} abandonó`) : shared ? t(`Finished ${ordEn(place)}`, `${place}-е место на финише`, `Llegaste ${ordEs(place)}`) : t(`You finished ${ordEn(place)}`, `${place}-е место на финише`, `Llegaste ${ordEs(place)}`);
  const gap = me.secs != null && winner?.secs != null && winner !== me ? `+${(me.secs - winner.secs).toFixed(1)} ${t('s', 'с', 's')}` : '—';
  const again = one ? '/match/new' : res.daily ? '/play?race=today' : '/play?race=free';
  const isToday = res.daily === new Date().toISOString().slice(0, 10); // the daily race's day is the UTC date, as the game's
  // someone else's race: today's race, for you to sail
  const cta = shared
    ? { href: '/race', label: t('Sail today’s race', 'Пройти гонку дня', 'Navega la regata del día') }
    : { href: again, label: one ? t('Another 1-on-1 race', 'Ещё одна гонка 1 на 1', 'Otra regata 1 contra 1') : t('Race again', 'Ещё гонку', 'Regatear otra vez') };
  const mine = me.secs != null && !me.dsq ? me.secs : null;
  const you = shared ? t('This boat', 'Эта лодка', 'Este barco') : t('You', 'Ты', 'Tú');
  // the link to this page, with a line to go with it, for the share sheet (components/share-sheet): each app gets it
  // with its own utm_source, so the analytics say which app a visit came from
  const shareText = () => {
    const time = me.secs != null && !me.dsq ? clock(me.secs) : '';
    return me.dsq ? t('My race in Up and down', 'Моя гонка в Up and down', 'Mi regata en Up and down')
      : res.daily && isToday ? t(`I finished ${ordEn(place)} in ${time} in today’s race. Can you beat it?`, `${place}-е место за ${time} в гонке дня. Сможешь быстрее?`, `Terminé ${ordEs(place)} con ${time} en la regata de hoy. ¿Puedes batirlo?`)
      : t(`I finished ${ordEn(place)} in ${time}`, `${place}-е место за ${time}`, `Terminé ${ordEs(place)} con ${time}`);
  };
  const shareData = () => {
    // in Russian the card and the title are too
    const url = `${location.origin}/race/result/${encodeURIComponent(res.id)}?${lang === 'en' ? '' : `lang=${lang}&`}utm_source=share&utm_medium=result`;
    return { title: 'Up and down', text: shareText(), url };
  };

  // the debrief: the game's own items, each good or one to work on
  // drill: the drill for it (lib/drills.ts DEBRIEF_DRILL), offered when it's one to work on
  type Item = { k: string; good: boolean; v: string; tip: string; note?: boolean; drill?: keyof typeof DEBRIEF_DRILL };
  const items: Item[] = [];
  if (L.startDsq) items.push({ k: t('Start', 'Старт', 'Salida'), good: false, v: L.startDsq === 'U' ? t('Disqualified at the start (U flag)', 'Дисквалификация на старте (флаг U)', 'Descalificado en la salida (bandera U)') : t('Disqualified at the start (black flag)', 'Дисквалификация на старте (чёрный флаг)', 'Descalificado en la salida (bandera negra)'), tip: t('Under U or the black flag, stay below the line for the whole last minute.', 'Под флагом U или чёрным держись за линией всю последнюю минуту.', 'Con la bandera U o la negra, mantente bajo la línea todo el último minuto.') , drill: 'start' });
  else if (L.ocs) items.push({ k: t('Start', 'Старт', 'Salida'), good: false, v: t('At the gun: over the line — you had to go back', 'На сигнале старта: за линией — пришлось возвращаться', 'En la señal: sobre la línea — tuviste que volver'), tip: t('Aim to be a boat length behind the line, at full speed, as the gun goes.', 'Цель — быть в корпусе от линии на полной скорости в момент сигнала.', 'Procura estar a una eslora de la línea, a toda velocidad, cuando suene la señal.') , drill: 'start' });
  else if (L.gunD != null && L.gunV != null) {
    const good = L.gunD >= 0 && L.gunD < 25 && L.gunV > 3.5, d = Math.round(Math.max(0, L.gunD)), v = L.gunV.toFixed(1);
    items.push({ k: t('Start', 'Старт', 'Salida'), good, v: t(`At the gun: ${d} m from the line at ${v} kn`, `На сигнале старта: ${d} м до линии, ${v.replace('.', ',')} уз`, `En la señal: a ${d} m de la línea a ${v} kn`), tip: good ? t('Close to the line and up to speed at the gun: that is the start that wins races.', 'У линии и на скорости в момент старта — так и выигрываются гонки.', 'Cerca de la línea y a velocidad en la señal: esa es la salida que gana regatas.') : t('Aim to be a boat length behind the line, at full speed, as the gun goes.', 'Цель — быть в корпусе от линии на полной скорости в момент сигнала.', 'Procura estar a una eslora de la línea, a toda velocidad, cuando suene la señal.') , drill: good ? undefined : 'start' });
  }
  if (L.pct != null) items.push({ k: t('Speed', 'Скорость', 'Velocidad'), good: L.pct >= 90, v: t(`${L.pct}% of target on average`, `В среднем ${L.pct}% от целевой`, `${L.pct} % del objetivo de media`), tip: L.pct >= 90 ? t('The sheet stayed in the green band: the boat sailed close to her best.', 'Шкот был в зелёной полосе — лодка шла близко к лучшей скорости.', 'La escota se mantuvo en la banda verde: el barco navegó cerca de su mejor rendimiento.') : t('Keep the sheet in the green band and steer smoothly: every turn of the rudder brakes the boat.', 'Держи шкот в зелёной полосе и рули плавно: каждое движение руля тормозит.', 'Mantén la escota en la banda verde y gobierna con suavidad: cada giro del timón frena el barco.') });
  if (L.tacks) items.push({ k: t('Tacks', 'Повороты', 'Virajes'), good: L.lift <= L.head, v: t(`On the beat: ${L.head} in a header, ${L.lift} in a lift`, `На лавировке: ${L.head} — когда ветер зашёл, ${L.lift} — когда отошёл`, `En la ceñida: ${L.head} con rolada desfavorable, ${L.lift} con rolada favorable`), tip: L.lift <= L.head ? t('You tacked on the headers: each one turned the shift into ground gained.', 'Ты поворачивал на заходах — и каждый превращал сдвиг ветра в выигрыш.', 'Viraste con las roladas desfavorables: cada una se convirtió en terreno ganado.') : t('Tack when the wind heads you (Header in the wind box), not when it lifts you (Lift).', 'Поворачивай, когда ветер заходит («Заход» в окне ветра), а не когда отходит («Отход»).', 'Vira cuando el viento te cierra (rolada desfavorable), no cuando te abre (rolada favorable).') , drill: L.lift <= L.head ? undefined : 'tacks' });
  if (L.dirty >= 10) items.push({ k: t('Dirty air', 'Ветровая тень', 'Aire sucio'), good: L.dirty < 30, v: t(`${L.dirty} s in another boat’s dirty air`, `${L.dirty} с в ветровой тени другой лодки`, `${L.dirty} s en el aire sucio de otro barco`), tip: L.dirty < 30 ? t('Mostly in clear air, where the wind is full.', 'Почти всё время в чистом ветре, где он полный.', 'Sobre todo en aire limpio, donde el viento es pleno.') : t('Behind and downwind of another boat the wind is weaker: tack away or sail clear of it.', 'За другой лодкой и под ветром от неё ветер слабее: поверни или уйди из ветровой тени.', 'Detrás y a sotavento de otro barco el viento es más flojo: vira para alejarte o navega libre de él.') });
  if (L.penT > 1) items.push({ k: t('Penalties', 'Штрафы', 'Penalizaciones'), good: false, v: t(`${L.penT} s spinning penalty turns`, `${L.penT} с на штрафных оборотах`, `${L.penT} s en giros de penalización`), tip: t('The rule behind each foul is below.', 'Правило за каждым нарушением — ниже.', 'La regla de cada infracción está abajo.') , drill: 'penalties' });
  const hails = Object.values(L.hails || {}).reduce((a, b) => a + b, 0);
  if (hails) items.push({ k: t('Hails', 'Оклики', 'Avisos'), good: false, v: t(`Hailed ${hails}× by boats you had to keep clear of`, `${hails} раз(а) окликнули лодки, которым ты должен был уступить`, `Avisado ${hails}× por barcos de los que debías mantenerte separado`), tip: t('A hail is a warning, not a penalty — keep clear in time.', 'Оклик — предупреждение, а не штраф: уступай вовремя.', 'Un aviso es una advertencia, no una penalización: mantente separado a tiempo.'), note: true });
  if (!L.fouls.length && !L.ocs && !L.startDsq && !hails) items.push({ k: t('Rules', 'Правила', 'Reglas'), good: true, v: t('No fouls and no penalties — a clean race', 'Ни нарушений, ни штрафов — чистая гонка', 'Sin infracciones ni penalizaciones: una regata limpia'), tip: t('You kept clear in time, every time.', 'Ты всегда вовремя уступал дорогу.', 'Te mantuviste separado a tiempo, siempre.') });
  const foulRules = [...new Map(L.fouls.map((f) => [f.rule, f])).values()];
  const legM = legDistances(res.course, res.course.legs);
  const tracks = res.boats.map((b) => ({ pts: b.track, me: b.me }));
  const fouls = L.fouls.filter((f) => f.x != null && f.z != null).map((f) => [f.x!, f.z!] as [number, number]);
  const legName = (k: string) => ({ start: t('Start', 'Старт', 'Salida'), mark: shape === 'trap' ? t('Mark 1', 'Знак 1', 'Baliza 1') : t('Windward mark', 'Верхний знак', 'Baliza de barlovento'), wing: t('Wing mark', 'Боковой знак', 'Baliza de través'),
    mark2: t('Mark 2', 'Знак 2', 'Baliza 2'), offset: t('Offset mark', 'Отбойник', 'Baliza de desmarque'), gate: t('Leeward gate', 'Нижние ворота', 'Puerta de sotavento'), finish: t('Finish', 'Финиш', 'Llegada') }[k] || k);

  const where = venueOf(raceVenue(res, shared ? 'gocek' : readOpts().venue));
  const scene = finishScene(res);
  const nb = neighbours(res);
  const gapS = (g: number) => `${g.toFixed(1).replace('.', lang === 'en' ? '.' : ',')} ${t('s', 'с', 's')}`;
  // the finish in a line: who crossed just before and just after, as the scene shows them
  const near = me.dsq || me.dnf || me.secs == null ? ''
    : nb.ahead && nb.behind ? t(`${shared ? 'This boat' : 'You'} crossed ${gapS(nb.ahead.gap)} after ${nb.ahead.name} and ${gapS(nb.behind.gap)} before ${nb.behind.name}.`, `${shared ? 'Эта лодка пересекла' : 'Ты пересёк'} линию через ${gapS(nb.ahead.gap)} после ${nb.ahead.name} и за ${gapS(nb.behind.gap)} до ${nb.behind.name}.`, `${shared ? 'Este barco cruzó' : 'Cruzaste'} ${gapS(nb.ahead.gap)} después de ${nb.ahead.name} y ${gapS(nb.behind.gap)} antes de ${nb.behind.name}.`)
    : nb.behind ? t(`First across the line, ${gapS(nb.behind.gap)} ahead of ${nb.behind.name}.`, `Первым на финише, на ${gapS(nb.behind.gap)} раньше ${nb.behind.name}.`, `Primero en cruzar la línea, ${gapS(nb.behind.gap)} por delante de ${nb.behind.name}.`)
    : nb.ahead ? t(`Last across the line, ${gapS(nb.ahead.gap)} after ${nb.ahead.name}.`, `Последним на финише, через ${gapS(nb.ahead.gap)} после ${nb.ahead.name}.`, `Último en cruzar la línea, ${gapS(nb.ahead.gap)} después de ${nb.ahead.name}.`) : '';
  const pbNote = shared ? null : res.pb?.isNew ? t('New personal best', 'Новый личный рекорд', 'Nueva mejor marca personal')
    : res.pb && me.secs === res.pb.best ? (res.daily ? t('Your best today', 'Твой лучший сегодня', 'Tu mejor de hoy') : t('Your best on this course', 'Твой лучший на этой дистанции', 'Tu mejor en este recorrido')) : null;
  const legs = [...L.legs.map((tm, i) => ({ k: res.course.legs[i], i, tm, pl: L.legPlaces[i] })),
    ...(me.done && me.secs != null && L.legs.length < res.course.legs.length ? [{ k: 'finish', i: res.course.legs.length - 1, tm: me.secs, pl: me.dsq ? 0 : place }] : [])];

  // the race in four numbers, as the broadcast's finish has them: each only when the race kept what it needs (a result
  // saved before the game kept the leg times, the gybes and the top speed shows fewer, or none)
  const lost = costliest(res.boats), st = startOf(L, res.boats), bl = goodLeg(res.boats, lost?.seg), pens = me.pens ?? L.fouls.length;
  const num = (x: number) => x.toFixed(1).replace('.', lang === 'en' ? '.' : ',');
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  const endW = { pin: t('at the pin end', 'у пина', 'en el extremo de la baliza'), boat: t('at the boat end', 'у судейского судна', 'en el extremo del barco'), middle: t('mid-line', 'в середине линии', 'a media línea') };
  type Tile = { k: string; v: string; u?: string; s: string; up?: boolean };
  const tiles = ([
    st && { k: t('Start', 'Старт', 'Salida'), v: num(st.late), u: t('s late', 'с после сигнала', 's tarde'),
      s: L.ocs ? t('Over early: back and started again', 'Фальстарт: вернулся и стартовал снова', 'Antes de tiempo: volviste y saliste de nuevo')
        : cap([st.place ? t(`${ordEn(st.place)} off the line`, `${st.place}-м пересёк линию`, `${ordEs(st.place)} en salir de la línea`) : '', st.end ? endW[st.end] : ''].filter(Boolean).join(', ')) || t('After the gun', 'После сигнала', 'Tras la señal') },
    bl && { k: t('Best leg', 'Лучший отрезок', 'Mejor tramo'), v: t(`Leg ${bl.leg}`, `Отрезок ${bl.leg}`, `Tramo ${bl.leg}`), up: bl.place === 1,
      s: bl.place === 1 ? (bl.by < 0.05 ? t('Level with the fastest', 'Вровень с лучшим', 'A la par del más rápido') : t(`Fastest of the fleet, by ${gapS(bl.by)}`, `Быстрее всех, на ${gapS(bl.by)}`, `Más rápido de la flota, por ${gapS(bl.by)}`))
        : t(`${ordEn(bl.place)} fastest of ${bl.of}, ${gapS(bl.by)} off`, `${bl.place}-й из ${bl.of}, ${gapS(bl.by)} от лучшего`, `${ordEs(bl.place)} más rápido de ${bl.of}, a ${gapS(bl.by)}`) },
    L.top ? { k: t('Top speed', 'Макс. скорость', 'Velocidad máxima'), v: num(L.top), u: t('kn', 'уз', 'kn'),
      s: cap([L.topKite ? t('under the kite', 'под генакером', 'con el gennaker') : '', L.topLeg ? t(`leg ${L.topLeg}`, `отрезок ${L.topLeg}`, `tramo ${L.topLeg}`) : t('at the start', 'на старте', 'en la salida')].filter(Boolean).join(', ')) } : null,
    L.gybes != null ? { k: t('Tacks · gybes', 'Оверштаги · фордевинды', 'Virajes · trasluchadas'), v: `${L.tacks} · ${L.gybes}`,
      s: pens ? t(`${pens} ${pens === 1 ? 'penalty' : 'penalties'}`, `Штрафов: ${pens}`, `${pens} ${pens === 1 ? 'penalización' : 'penalizaciones'}`) : t('No penalties', 'Без штрафов', 'Sin penalizaciones') } : null,
  ] as (Tile | null)[]).filter((x): x is Tile => !!x);
  const hasPens = res.boats.some((b) => b.pens != null);
  const hasLevels = res.boats.some((b) => b.level && LEVEL[b.level]); // a race kept before the skippers had levels has none
  // a new best: the one it beat, beside it
  const prev = !shared && res.pb?.isNew && res.pb.prev != null ? res.pb.prev : null;

  // the next target, first thing after the result: today's race, the place above you on today's ranking (and the
  // podium, when that's further); a free race, the boat that beat you, or your best on the course. And where the time
  // went: the part of the race you lost most in to the boat that finished just ahead of you.
  const ordW = (n: number) => t(ordEn(n), `${n}-е`, ordEs(n));
  let target: { v: string; s?: string; go?: string } | null = null;
  if (!shared && !one && mine != null) {
    // today's race counts your best of the day (the game's record of it), which may be an earlier race than this one
    const best = res.daily && res.pb ? Math.min(mine, res.pb.best) : mine;
    const faster = res.daily && isToday && field ? field.filter((s) => s < best - 0.05).sort((a, b) => a - b) : null;
    if (faster && faster.length) {
      const pl = faster.length, need = best - faster[pl - 1] + 0.1;
      target = { v: t(`${gapS(need)} to ${ordEn(pl)} on today’s ranking`, `${gapS(need)} до ${pl}-го места в рейтинге дня`, `${gapS(need)} para ${ordEs(pl)} en la clasificación de hoy`), go: t('climb the ranking', 'вверх по рейтингу', 'sube en la clasificación'),
        s: [pl > 3 ? t(`${gapS(best - faster[2] + 0.1)} to the podium`, `${gapS(best - faster[2] + 0.1)} до подиума`, `${gapS(best - faster[2] + 0.1)} para el podio`) : '',
          best < mine - 0.05 ? t(`from your best today, ${clock(best)}`, `от твоего лучшего сегодня, ${clock(best)}`, `de tu mejor de hoy, ${clock(best)}`) : ''].filter(Boolean).join(' · ') || undefined };
    } else if (faster && field?.length) {
      const next = field.filter((s) => s > best + 0.05).sort((a, b) => a - b)[0];
      target = { v: t('Fastest today', 'Быстрее всех сегодня', 'El más rápido hoy'), s: next != null ? t(`${gapS(next - best)} clear of 2nd: stretch it`, `${gapS(next - best)} впереди второго — увеличь отрыв`, `${gapS(next - best)} de ventaja sobre el 2.º: amplíala`) : t('The first time on today’s ranking', 'Первое время в рейтинге дня', 'El primer tiempo en la clasificación de hoy') };
    } else if (nb.ahead && place > 1) {
      target = { v: t(`${gapS(nb.ahead.gap + 0.1)} to ${ordEn(place - 1)}`, `${gapS(nb.ahead.gap + 0.1)} до ${place - 1}-го места`, `${gapS(nb.ahead.gap + 0.1)} para ${ordEs(place - 1)}`), go: t(`go for ${ordEn(place - 1)}`, `за ${place - 1}-м местом`, `ve a por ${ordEs(place - 1)}`), s: nb.ahead.name ? t(`${nb.ahead.name} took it`, `его заняла ${nb.ahead.name}`, `${nb.ahead.name} se lo llevó`) : undefined };
    } else if (res.pb && !res.pb.isNew && mine > res.pb.best) {
      target = { v: t(`${gapS(mine - res.pb.best)} off your best`, `${gapS(mine - res.pb.best)} до твоего рекорда`, `${gapS(mine - res.pb.best)} sobre tu mejor marca`), go: t('beat your best', 'побей свой рекорд', 'bate tu mejor marca') };
    }
  }
  // where you lost most to the boat just ahead, a tile of the debrief's beside your best leg
  if (lost) tiles.splice(Math.min(2, tiles.length), 0, { k: t('Most lost', 'Больше всего потеряно', 'Lo que más se perdió'), v: num(lost.lost), u: t('s', 'с', 's'),
    s: [lost.seg === 0 ? t('Off the start line', 'На старте', 'Al salir de la línea') : t(`Leg ${lost.seg} (${legName(res.course.legs[lost.seg]).toLowerCase()})`, `Отрезок ${lost.seg} (${legName(res.course.legs[lost.seg]).toLowerCase()})`, `Tramo ${lost.seg} (${legName(res.course.legs[lost.seg]).toLowerCase()})`),
      lost.name ? t(`against ${lost.name}`, `против ${lost.name}`, `contra ${lost.name}`) : ''].filter(Boolean).join(', ') });
  const ctaLabel = !shared && target?.go ? `${cta.label} · ${target.go}` : cta.label;

  // a first race at this venue (your stamp's race is this one), or a day of a streak
  const firstHere = !shared && !!log && log.v[where.id] === res.at && !me.dsq && me.done;
  const strk = !shared && log && res.daily && res.daily === todayUtc() ? streakOf(log.d) : null;
  const stampN = log ? Object.keys(log.v).length : 0;
  const logNote = firstHere ? t(`First race at ${where.name[0]} · ${stampN} ${stampN === 1 ? 'venue' : 'venues'} raced`,`Первая гонка в ${where.name[1]} · акваторий: ${stampN}`, `Primera regata en ${where.name[2] ?? where.name[0]} · ${stampN} ${stampN === 1 ? 'sede navegada' : 'sedes navegadas'}`)
    : strk && strk.today && strk.n > 1 ? streakWords(strk.n, lang) : null;

  // the result as the broadcast lays it out: the finish as it was behind the result and the full table, then, as the
  // page scrolls on, the debrief beside the track and the legs, and today's ranking beside your best and sharing
  const drills = readDrills(); // your stars, for whether a drill's level is open (this part is drawn only in the browser)
  const tag = (x: Item) => (x.note ? ['note', t('Note', 'Заметка', 'Nota')] : x.good ? ['ok', t('Good', 'Хорошо', 'Buena')] : ['work', t('Work on it', 'Поработай', 'A trabajar')]);
  return (
    <div className="scr bt-scr rs-scr bc" lang={lang}>
      <div className="bt">
        <GameScene venue={where.id} boat={res.yacht} wind={res.preset} finish={scene} title={t('The finish in 3D, as it was', 'Финиш в 3D, как он был', 'La llegada en 3D, tal como fue')} loading={t('Loading the finish', 'Загружаем финиш', 'Cargando la llegada')} />
        {!shared && <Soundtrack />}

        <div className="bt-info">
          <div className="bt-top">
            <BackLink href="/race" label={t('Back to the race hub', 'Назад в меню гонок', 'Volver al centro de regatas')} />
            <SceneBrand lang={lang} />
          </div>
          <div className="bt-kicks">
            <span className="bt-kick">{kicker}</span>
            {pbNote && res.pb?.isNew ? <span className="bt-kick rs-kick-g">{pbNote}</span> : null}
            {logNote ? <span className="bt-kick rs-kick-s">{logNote}</span> : null}
          </div>
          <h1 className="bt-h">{title}</h1>
          <p className="bt-p">{t(...where.name)}{where.place[0] !== where.name[0] && `, ${t(...where.place)}`}. {near || t('The boats are where they were at the finish.', 'Лодки там, где были на финише.', 'Los barcos están donde estaban en la llegada.')}</p>
          <div className="bt-stats">
            <div><span className="bt-sk">{t('Place', 'Место', 'Puesto')}</span><b>{ended === 'dsq' ? 'DSQ' : ended === 'dnf' ? 'DNF' : ended === 'won' ? t('Won', 'Победа', 'Ganó') : t(ordEn(place), `${place}-е`, ordEs(place))}</b><span className="bt-sv">{ended === 'dsq' ? t('disqualified', 'дисквалификация', 'descalificado') : ended === 'dnf' ? t('did not finish', 'не финишировал', 'no terminó') : ended === 'won' ? t(`${rival} dropped out`, `${rival}: сход`, `${rival} abandonó`) : t(`of ${res.boats.length} boats`, `из ${ruBoatsOf(res.boats.length)}`, `de ${res.boats.length} barcos`)}</span></div>
            <div><span className="bt-sk">{t('Time', 'Время', 'Tiempo')}</span><b className={res.pb?.isNew && !shared ? 'is-gold' : ''}>{me.secs != null && !me.dsq ? <CountUp v={clock(me.secs)} ms={1200} /> : '—'}</b><span className="bt-sv">{pbNote || (one && !me.done ? t('no finish', 'без финиша', 'sin llegada') : t('at the line', 'на финише', 'en la línea'))}</span></div>
            <div><span className="bt-sk">{t('Behind', 'Отставание', 'Detrás')}</span><b>{winner && winner !== me && me.secs != null && winner.secs != null ? <CountUp v={`+${gapS(me.secs - winner.secs)}`} /> : '—'}</b><span className="bt-sv">{winner && winner !== me ? t(`${winner.name} won`, `победа: ${winner.name}`, `Ganó ${winner.name}`) : !winner ? t('No winner', 'Без победителя', 'Sin ganador') : shared ? t('this boat won', 'эта лодка победила', 'ganó este barco') : t('you won', 'ты победил', 'ganaste')}</span></div>
            <div><span className="bt-sk">{t('Penalties', 'Штрафы', 'Penalizaciones')}</span><b className={L.penT > 1 ? 'is-down' : 'is-up'}><Num v={L.penT > 1 ? `${L.penT} ${t('s', 'с', 's')}` : '0'} /></b><span className="bt-sv">{L.penT > 1 ? t('turning circles', 'штрафные обороты', 'círculos de giro') : t('A clean race', 'Чистая гонка', 'Una regata limpia')}</span></div>
          </div>
          {target ? (
            <div className="rs-target" role="note" title={target.s}>
              <span className="bt-sk">{t('Next target', 'Следующая цель', 'Próximo objetivo')}</span>
              <b>{target.v}</b>
              {target.s ? <span className="rs-target-s">{target.s}</span> : null}
            </div>
          ) : null}
          <div className="rs-acts">
            <a className="bt-go" href={cta.href} onClick={() => track(shared ? 'Challenge taken' : 'Race again', { race: one ? 'one-on-one' : res.daily ? 'daily' : 'free', ...(target?.go && { target: 1 }) })}>{shared ? <IconPlay /> : <IconRestart />}<span>{ctaLabel}</span></a>
            {!shared && !one && <ShareButton lang={lang} data={shareData} className="bt-show rs-ghost" title={t('Share your result', 'Поделиться результатом', 'Comparte tu resultado')} />}
            <Link className="bt-show rs-ghost" href="/race">{t('Race hub', 'Меню гонок', 'Centro de regatas')}</Link>
            {res.boats.some((b) => b.track?.length > 1) ? <Replay res={res} myLegs={me.legT} lang={lang} /> : null}
          </div>
        </div>

        {/* the full table, as the broadcast's results board */}
        <PauseCard lang={lang} back={`/race/result/${res.id}`} title={t('Results', 'Результаты', 'Resultados')} icon={<IconTrophy s={14} />} note={t('Time · gap', 'Время · разрыв', 'Tiempo · diferencia')}>
          <ol className="hm-lb bt-lb rs-lb">
            {res.boats.map((b, i) => (
              <li key={i} className={`${b.me ? 'me' : ''} ${(one ? b === winner : i === 0 && !b.dsq && !b.dnf) ? 'first' : ''}`}>
                <span className="hm-n">{standing(res, b) === 'place' ? i + 1 : '–'}</span>
                <span className="rs-name"><span className="rs-dot" style={{ background: b.me ? 'var(--you)' : b.color || 'rgba(255,255,255,.4)' }} /><FlagImg code={b.flag} lang={lang} />{b.me ? you : b.name}</span>
                {hasLevels && <Level lv={b.level} t={t} />}
                {hasPens && <span className="rs-pen" title={b.pens ? t('Penalties she got', 'Сколько штрафов получила', 'Penalizaciones que recibió') : undefined}>{b.pens ? t(`${b.pens} pen`, `${b.pens} штр.`, `${b.pens} pen`) : ''}</span>}
                <span className="hm-t">{b.dsq ? 'DSQ' : standing(res, b) === 'dnf' ? 'DNF' : b.secs != null ? clock(b.secs) : '—'}</span>
                <span className="rs-gap">{b.secs != null && winner?.secs != null && b !== winner && !b.dsq ? `+${(b.secs - winner.secs).toFixed(1)}` : ''}</span>
              </li>
            ))}
          </ol>
          {hasLevels && <p className="bt-hint rs-hint">{t('Computer skippers:', 'Компьютерные шкиперы:', 'Patrones del ordenador:')} <Pips n={1} /> {t('beginner to', 'от новичка до', 'de principiante a')} <Pips n={4} /> {t('expert', 'эксперта', 'experto')}</p>}
          {!one && <p className="bt-hint rs-hint">{res.daily ? t('Today’s race is the one that ranks: everyone sails the same one.', 'В рейтинг идёт гонка дня: у всех она одна.', 'La regata de hoy es la que puntúa: todos navegan la misma.') : t('Custom races stay with you; today’s race is the one that ranks.', 'Свои гонки остаются у тебя; в рейтинг идёт гонка дня.', 'Las regatas personalizadas se quedan contigo; la de hoy es la que puntúa.')}</p>}
          {!shared && !one && Date.now() - res.at < 864e5 && <RateRace id={res.id} lang={lang} />}{/* how was it: your own race, just sailed */}
        </PauseCard>
        <a className="rs-down" href="#debrief" aria-label={t('The debrief', 'Разбор', 'El análisis')}><span>{t('The debrief', 'Разбор', 'El análisis')}</span><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" /></svg></a>
      </div>

      <div className="rs-more">
        <section className="rs-row" id="debrief">
          <div className="rs-col rs-wide">
            <span className="rs-kick">{t('Debrief', 'Разбор', 'Análisis')}</span>
            <h2 className="rs-h2">{t('Where the time went', 'Куда ушло время', 'Dónde se fue el tiempo')}</h2>
            {tiles.length ? (
              <div className="rs-tiles">
                {tiles.map((x) => (
                  <div key={x.k} className="rs-tile">
                    <span className="bt-sk">{x.k}</span>
                    <b className={x.up ? 'is-up' : undefined}>{x.v}{x.u ? <span className="unit">{x.u}</span> : null}</b>
                    <span className="rs-tile-s">{x.s}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <ul className="rs-card rs-db">
              {items.map((x, i) => {
                const [k, w] = tag(x), dl = x.drill && !shared ? drillLink(DEBRIEF_DRILL[x.drill], drills) : null;
                return (
                  <li key={i} className={k}>
                    <span className="rs-tag">{w}</span>
                    <span className="rs-db-t"><span className="rs-db-k">{x.k}</span><span className="rs-db-v">{x.v}</span>{x.tip && <span className="rs-db-tip">{x.tip}</span>}
                      {dl && <a className="rs-rule-a" href={dl.href}>{dl.open ? t(`Practise it: the “${dl.name[0].replace(/^The /, "")}” drill, ${dl.min} min`, `Потренируйся: «${dl.name[1]}», ${dl.min} мин`, `Practícalo: ${dl.name[2] ?? dl.name[0]}, ${dl.min} min`) : t('Practise it in the drills', 'Потренируйся в тренировках', 'Practícalo en los entrenamientos')}</a>}</span>
                  </li>
                );
              })}
            </ul>
            {foulRules.map((f) => (
              <div key={f.rule} className="rs-rule">
                <span className="rs-rule-k">{t(`Rule ${f.rule}`, `Правило ${f.rule}`, `Regla ${f.rule}`)}{f.t != null ? ` · ${clock(Math.max(0, f.t))}` : ''}{f.who ? ` · ${f.who}` : ''}</span>
                <b>{rule('r' + f.rule, lang)}</b>
                <span className="rs-db-tip">{rule('x' + f.rule, lang)}</span>
                {RULE_LINK[f.rule] && <a className="rs-rule-a" href={`https://iyt.rycrentals.com${lang === 'ru' ? '/ru' : ''}/racing-rules/${RULE_LINK[f.rule]}`}>{t('Read the rule', 'Прочитать правило', 'Leer la regla')}</a>}
              </div>
            ))}
          </div>
          <div className="rs-col">
            <span className="rs-kick">{shared ? t('The track', 'Трек', 'La trayectoria') : t('Your track', 'Твой трек', 'Tu trayectoria')}</span>
            <h2 className="rs-h2">{t('Leg by leg', 'По отрезкам', 'Tramo a tramo')}</h2>
            <div className="rs-card rs-pad">
              <CourseMap className="cmap rs-track" lang={lang} geo={res.course} preset={res.preset} W={320} H={320} tracks={tracks} fouls={fouls} />
              <div className="rs-key"><span className="is-you">— {shared ? t('this boat', 'эта лодка', 'este barco') : t('you', 'ты', 'tú')}</span><span>— {t('fleet', 'соперники', 'flota')}</span>
                <span>{t('Course', 'Дистанция', 'Recorrido')} {fmtDistance(courseDistance(res.course, res.laps), lang)}</span>{L.fouls.length ? <span>{t('red rings mark the fouls', 'красные кольца — нарушения', 'los aros rojos marcan las infracciones')}</span> : null}</div>
            </div>
            {!!legs.length && (
              <ol className="rs-card rs-legs">
                {/* the game logs the clock as you pass each mark; the finish is your finishing time and place */}
                {legs.map((x, i) => (
                  <li key={i}>
                    <span className="rs-leg-n">{legName(x.k)}</span>
                    <span className="rs-leg-d">{legM[x.i] ? `${Math.round(legM[x.i])} ${t('m', 'м', 'm')}` : ''}</span>
                    <span className="rs-leg-t">{clock(Math.max(0, x.tm))}</span>
                    <span className="rs-leg-p">{x.pl ? t(`${ordEn(x.pl)} of ${res.boats.length}`, `${x.pl}-й из ${res.boats.length}`, `${ordEs(x.pl)} de ${res.boats.length}`) : ''}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <section className="rs-row">
          {res.daily ? (
            <div className="rs-col rs-wide">
              <span className="rs-kick">{t('Today’s race', 'Гонка дня', 'La regata del día')}</span>
              <h2 className="rs-h2">{t('Today’s fastest', 'Самые быстрые сегодня', 'Los más rápidos de hoy')}</h2>
              <Ranking t={t} lang={lang} top={top} field={field} id={res.id} daily={!!res.daily} me={me} signedName={shared ? null : signedName} you={shared ? you : null} />
            </div>
          ) : null}
          {!shared && !one && (
            <div className="rs-col">
              <span className="rs-kick">{t('Your best', 'Твой рекорд', 'Tu mejor marca')}</span>
              <h2 className="rs-h2">{t('On this course', 'На этой дистанции', 'En este recorrido')}</h2>
              <div className="bt-stats rs-best">
                <div><span className="bt-sk">{res.daily ? t('Your best today', 'Твой лучший сегодня', 'Tu mejor de hoy') : t('Your best', 'Твой лучший', 'Tu mejor marca')}</span><b className="is-gold">{res.pb ? clock(res.pb.best) : '—'}</b><span className="bt-sv">{res.pb?.isNew ? t('New personal best', 'Новый личный рекорд', 'Nueva mejor marca personal') : t('kept on this device', 'хранится на этом устройстве', 'guardada en este dispositivo')}</span></div>
                {prev != null && res.pb
                  ? <div><span className="bt-sk">{res.daily ? t('Earlier today', 'Раньше сегодня', 'Antes, hoy') : t('Before this race', 'До этой гонки', 'Antes de esta regata')}</span><b>{clock(prev)}</b><span className="bt-sv"><span className="is-up">−{gapS(prev - res.pb.best)}</span></span></div>
                  : <div><span className="bt-sk">{t('This race', 'Эта гонка', 'Esta regata')}</span><b>{me.secs != null && !me.dsq ? clock(me.secs) : '—'}</b><span className="bt-sv">{res.pb && me.secs != null && !me.dsq && me.secs > res.pb.best ? `+${gapS(me.secs - res.pb.best)}` : t('at the line', 'на финише', 'en la línea')}</span></div>}
              </div>
              <div className="rs-card rs-pad rs-share">
                <span className="bt-k">{t('Share this race', 'Поделиться гонкой', 'Comparte esta regata')}</span>
                <p className="rs-ps">“{shareText()}” {t('A result link opens on any device, as this boat’s result.', 'Ссылка открывается на любом устройстве — как результат этой лодки.', 'Un enlace de resultado se abre en cualquier dispositivo, como el resultado de este barco.')}</p>
                <div className="rs-share-b">
                  <CopyLink lang={lang} data={shareData} className="bt-show rs-ghost" />
                  <ShareButton lang={lang} data={shareData} className="bt-show rs-ghost" title={t('Share your result', 'Поделиться результатом', 'Comparte tu resultado')} />
                </div>
              </div>
            </div>
          )}
        </section>

        <nav className="rs-card rs-next" aria-label={t('Where next', 'Куда дальше', 'Siguiente')}>
          <a className="bt-row" href={again}><IconRestart s={18} /><span>{one ? t('Another 1-on-1 race', 'Ещё одна гонка 1 на 1', 'Otra regata 1 contra 1') : res.daily ? t('Today’s race again', 'Гонка дня ещё раз', 'La regata de hoy otra vez') : t('The same race again', 'Эту же гонку ещё раз', 'La misma regata otra vez')}</span></a>
          {!one && <Link className="bt-row" href={res.daily ? '/race/free?from=today' : '/race/free'}><IconSliders /><span>{res.daily ? t('A custom race in these conditions', 'Своя гонка в этих условиях', 'Una regata personalizada en estas condiciones') : t('Custom race', 'Своя гонка', 'Regata personalizada')}</span><span className="bt-row-m">{t('Set it up', 'Настроить', 'Prepararla')}</span></Link>}
          <Link className="bt-row" href="/race"><IconFlag s={18} /><span>{t('Race hub', 'Меню гонок', 'Centro de regatas')}</span></Link>
          <Link className="bt-row" href="/boat"><IconSail s={18} /><span>{t('Your yacht', 'Твоя яхта', 'Tu yate')}</span></Link>
        </nav>
      </div>
    </div>
  );
}

// you: how a shared result names its boat; then there's no asking to sign in, as it isn't the viewer's race
function Ranking({ t, lang, top, field, id, daily, me, signedName, you }: { t: (en: string, ru: string, es?: string) => string; lang: Lang; top: Top[] | null; field: number[] | null; id: string; daily: boolean; me: Boat; signedName: string | null; you: string | null }) {
  // where this time stands in the day's field: signed in, it's on it; a guest's would be, if they signed in
  const mine = me.secs != null && !me.dsq ? me.secs : null;
  const listed = mine != null && !!field && field.some((s) => Math.abs(s - mine) < 0.05);
  const place = mine != null && field ? field.filter((s) => s < mine - 0.05).length + 1 : 0, of = field ? field.length + (listed ? 0 : 1) : 0;
  const ordP = lang === 'ru' ? `${place}-е` : lang === 'es' ? `${place}.º` : `${place}${['th', 'st', 'nd', 'rd'][(place % 100 > 10 && place % 100 < 14) || place % 10 > 3 ? 0 : place % 10]}`;
  const standing = !place ? '' : signedName && !you && listed ? t(`${ordP} of ${of} today`, `${ordP} место из ${of} сегодня`, `${ordP} de ${of} hoy`)
    : !you && !signedName ? t(`${clock(mine!)} would be ${ordP} of ${of} today`, `${clock(mine!)} — это ${ordP} место из ${of} сегодня`, `${clock(mine!)} sería ${ordP} de ${of} hoy`) : '';
  return (
    <div className="rs-card rs-rank">
      {standing && <p className="rs-standing"><b>{standing}</b></p>}
      <ol className="hm-lb bt-lb">
        {(top || []).map((r, i) => <li key={i} className={i === 0 ? 'first' : ''}><span className="hm-n">{i + 1}</span><Who fl={r.fl} name={r.name || t('No name', 'Без имени', 'Sin nombre')} lang={lang} /><span className="hm-t">{clock(r.s)}</span></li>)}
        {top === null && daily && [0, 1, 2, 3, 4].map((i) => <li key={i} className="sk-li" aria-hidden="true"><Sk w={20} h={14} /><Sk w="60%" h={14} /><Sk w={48} h={14} /></li>)}
        {top && !top.length && <li><span className="hm-n">·</span><span className="hm-muted">{t('No times yet today', 'Сегодня ещё нет результатов', 'Aún no hay tiempos hoy')}</span><span /></li>}
        <li className="me"><span className="hm-n">{listed ? place : '·'}</span><Who fl={me.flag} name={you || (signedName ? `${signedName} (${t('you', 'ты', 'tú')})` : t('You', 'Ты', 'Tú'))} lang={lang} /><span className="hm-t">{me.secs != null && !me.dsq ? clock(me.secs) : '—'}</span></li>
      </ol>
      {daily && <Link className="lb-more" href="/race/rating">{t('Full rating and the month’s points', 'Весь рейтинг и очки за месяц', 'Clasificación completa y puntos del mes')}</Link>}
      {!signedName && !you && (
        <div className="rs-sign">
          <span className="rs-ps"><b>{t('Not on the ranking', 'Не в рейтинге', 'Fuera de la clasificación')}</b> · {t('sign in and your times go on it.', 'войди — и время попадёт в рейтинг.', 'inicia sesión y tus tiempos entrarán.')}</span>
          <Link className="bt-mini bt-mini-on" href={`/sign-in?next=${encodeURIComponent(`/race/result/${id}`)}`}>{t('Sign in', 'Войти', 'Iniciar sesión')}</Link>
        </div>
      )}
    </div>
  );
}
