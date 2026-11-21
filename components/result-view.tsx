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
import { sailedAt } from '@/lib/venues';
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
import { DuelRating } from './duel-rating';
import { FirstFinish } from './first-finish';
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
const LEVEL: Record<string, [number, string, string, string, string, string, string, string, string]> = { beginner: [1, 'Beginner', 'Новичок', 'Principiante', 'Anfänger', 'Acemi', 'Débutant', 'Principiante', 'Iniciante'], club: [2, 'Club', 'Клуб', 'Club', 'Club', 'Kulüp', 'Club', 'Club', 'Clube'], racer: [3, 'Racer', 'Гонщик', 'Regatista', 'Regattasegler', 'Yarışçı', 'Régatier', 'Regatante', 'Regatista'], expert: [4, 'Expert', 'Эксперт', 'Experto', 'Experte', 'Uzman', 'Expert', 'Esperto', 'Especialista'] };
const Pips = ({ n }: { n: number }) => <span className="rs-key" aria-hidden="true">{[1, 2, 3, 4].map((k) => <i key={k} className={k <= n ? 'on' : ''} />)}</span>;
function Level({ lv, t }: { lv?: string; t: (en: string, ru: string, es?: string, de?: string, tr?: string, fr?: string, it?: string, pt?: string) => string }) {
  const L = lv ? LEVEL[lv] : undefined;
  if (!L) return <span className="rs-lv" aria-hidden="true" />;
  return (
    <span className={`rs-lv l${L[0]}`} title={t(L[1], L[2], L[3], L[4], L[5], L[6], L[7], L[8])} role="img" aria-label={t(L[1], L[2], L[3], L[4], L[5], L[6], L[7], L[8])}>
      <i /><i /><i /><i />
    </span>
  );
}
type Foul = { rule: string; who: string | null; t: number | null; x: number | null; z: number | null };
type Result = {
  v: 1; id: string; at: number; daily: string | null; oneOnOne?: boolean; duel?: { code: string; seed: number }; // duel: a 1-on-1 race's code and seed, for its rating (components/duel-rating.tsx)
  first?: boolean; preset: 'light' | 'medium' | 'strong'; length: string; laps: number; start: number; current: boolean;
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
const rule = (k: string, lang: Lang) => { const r = (RULES as Record<string, { en: string; ru: string; es?: string; de?: string; tr?: string; fr?: string; it?: string; pt?: string }>)[k]; return (r && (r[lang] || r.en)) || ''; };
// Your own race, kept on this device, flies your boat's flag where it was started without one (a boat set on another
// device or address, before the account brought it here): the flag you fly now, as the rating shows it too
const withMyFlag = (r: Result): Result => {
  const f = readBoat().flag;
  return f && r.boats.some((b) => b.me && !b.flag) ? { ...r, boats: r.boats.map((b) => (b.me && !b.flag ? { ...b, flag: f } : b)) } : r;
};
const ordEs = (n: number) => `${n}.º`;
const ordDe = (n: number) => `${n}.`;
const ordTr = (n: number) => `${n}.`;
const ordFr = (n: number) => (n === 1 ? '1er' : `${n}e`);
const ordIt = (n: number) => `${n}º`;
const ordPt = (n: number) => `${n}º`;
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
  if (res === undefined) return <div className="scr bt-scr rs-scr bc" lang={lang}><ResultSkeleton label={t('Loading the race', 'Загружаем гонку', 'Cargando la regata', 'Die Regatta wird geladen', 'Yarış yükleniyor', 'Chargement de la régate', 'Caricamento della regata', 'Carregando a regata')} /></div>;
  if (!res) {
    return (
      <div className="scr help bc" lang={lang}>
        {head}
        <div className="hwrap">
          <header className="hhead">
            <div className="lhead">
              <BackLink className="round round-s round-muted" href="/race" label={t('Back to the race hub', 'Назад в меню гонок', 'Volver al centro de regatas', 'Zurück zum Regatta-Hub', 'Yarış merkezine dön', 'Retour au centre de régate', 'Torna al centro regate', 'Voltar à central de regatas')} />
              <span className="kicker">{t('Race result', 'Результат гонки', 'Resultado de la regata', 'Regattaergebnis', 'Yarış sonucu', 'Résultat de la régate', 'Risultato della regata', 'Resultado da regata')}</span>
            </div>
            <h1 className="h-land">{t('This race can’t be found', 'Эта гонка не найдена', 'No se encuentra esta regata', 'Diese Regatta wurde nicht gefunden', 'Bu yarış bulunamıyor', 'Régate introuvable', 'Impossibile trovare questa regata', 'Esta regata não foi encontrada')}</h1>
            <p className="lead">{t('A result goes online when its race is finished, and the device it was sailed on keeps its last twenty. This one is in neither place.', 'Результат попадает в сеть, когда гонка закончена, а устройство, где её прошли, хранит двадцать последних. Этой нет ни там, ни там.', 'Un resultado se sube cuando termina su regata, y el dispositivo en que se navegó guarda las últimas veinte. Esta no está en ninguno de los dos sitios.', 'Ein Ergebnis geht online, wenn seine Regatta beendet ist, und das Gerät, auf dem gesegelt wurde, behält die letzten zwanzig. Diese ist an keinem von beiden Orten.', 'Bir sonuç, yarışı bitince çevrimiçi olur ve yarışılan cihaz son yirmisini tutar. Bu ikisinde de yok.', 'Un résultat est mis en ligne quand sa régate est terminée, et l’appareil sur lequel elle a été courue garde ses vingt derniers. Celui-ci n’est ni à l’un ni à l’autre endroit.', 'Un risultato va online quando la sua regata è finita, e il dispositivo su cui è stata corsa conserva le ultime venti. Questa non è in nessuno dei due posti.', 'Um resultado vai para a internet quando a regata termina, e o aparelho em que ela foi corrida guarda as últimas vinte. Esta não está em nenhum dos dois.')}</p>
            <div className="btn-row"><Link className="pill pill-primary pill-s" href="/race"><span className="btn-t">{t('Race hub', 'Меню гонок', 'Centro de regatas', 'Regattazentrale', 'Yarış merkezi', 'Centre de régate', 'Centro regate', 'Central de regatas')}</span></Link></div>
          </header>
        </div>
        {foot}
      </div>
    );
  }

  const me = res.boats.find((b) => b.me)!, place = res.boats.indexOf(me) + 1, winner = winnerOf(res), ended = standing(res, me);
  const L = res.log;
  const windW = { light: t('light', 'слабый', 'flojo', 'leicht', 'hafif', 'faible', 'leggero', 'fraco'), medium: t('medium', 'средний', 'medio', 'mittel', 'orta', 'moyen', 'medio', 'médio'), strong: t('strong', 'сильный', 'fuerte', 'stark', 'kuvvetli', 'fort', 'forte', 'forte') }[res.preset];
  const kn = { light: 7, medium: 12, strong: 19 }[res.preset];
  const date = new Date(res.at).toLocaleDateString(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'short' });
  // the course's shape, named unless it's up and down
  const shape = shapeOf(res.course), shapeW = shape === 'wl' ? null : t(...SHAPE_NAME[shape]).toLowerCase();
  const one = !!res.oneOnOne; // a 1-on-1 race: two people, no ranking, no best time, no link to share
  const kicker = one
    ? `${t('1-on-1 race', 'Гонка 1 на 1', 'Regata 1 contra 1', '1-gegen-1-Regatta', 'Bire bir yarış', 'Duel 1 contre 1', 'Duello 1 contro 1', 'Duelo 1 contra 1')} · ${windW} ${kn} ${t('kn', 'уз', 'kn', 'kn', 'kn', 'kn', 'kn', 'nós')} · ${shapeW ? `${shapeW} · ` : ''}${res.laps} ${t(res.laps > 1 ? 'laps' : 'lap', res.laps > 1 ? 'круга' : 'круг', res.laps > 1 ? 'vueltas' : 'vuelta', res.laps > 1 ? 'Runden' : 'Runde', 'tur', res.laps > 1 ? 'tours' : 'tour', res.laps > 1 ? 'giri' : 'giro', res.laps > 1 ? 'voltas' : 'volta')}`
    : res.daily
    ? `${shared ? t('Race of the day', 'Гонка дня', 'Regata del día', 'Regatta des Tages', 'Günün yarışı', 'Régate du jour', 'Regata del giorno', 'A regata do dia') : t('Today’s race', 'Гонка дня', 'La regata del día', 'Regatta des Tages', 'Günün yarışı', 'La régate du jour', 'La regata del giorno', 'A regata do dia')} · ${date} · ${windW} ${kn} ${t('kn', 'уз', 'kn', 'kn', 'kn', 'kn', 'kn', 'nós')} · ${t(`${res.boats.length} boats`, ruBoats(res.boats.length), `${res.boats.length} ${res.boats.length === 1 ? 'barco' : 'barcos'}`, `${res.boats.length} ${res.boats.length === 1 ? 'Boot' : 'Boote'}`, `${res.boats.length} tekne`)}${shapeW ? ` · ${shapeW}` : ''}`
    : `${res.first ? t('Your first race', 'Твоя первая гонка', 'Tu primera regata', 'Deine erste Regatta', 'İlk yarışın', 'Ta première régate', 'La tua prima regata', 'Sua primeira regata') : t('Custom race', 'Своя гонка', 'Regata personalizada', 'Freie Regatta', 'Serbest yarış', 'Régate libre', 'Regata libera', 'Regata livre')} · ${windW} ${kn} ${t('kn', 'уз', 'kn', 'kn', 'kn', 'kn', 'kn', 'nós')} · ${t(`${res.boats.length} boats`, ruBoats(res.boats.length), `${res.boats.length} ${res.boats.length === 1 ? 'barco' : 'barcos'}`, `${res.boats.length} ${res.boats.length === 1 ? 'Boot' : 'Boote'}`, `${res.boats.length} tekne`)} · ${shapeW ? `${shapeW} · ` : ''}${res.laps} ${t(res.laps > 1 ? 'laps' : 'lap', res.laps > 1 ? 'круга' : 'круг', res.laps > 1 ? 'vueltas' : 'vuelta', res.laps > 1 ? 'Runden' : 'Runde', 'tur', res.laps > 1 ? 'tours' : 'tour', res.laps > 1 ? 'giri' : 'giro', res.laps > 1 ? 'voltas' : 'volta')}`;
  const rival = res.boats.find((b) => !b.me)?.name || t('The other boat', 'Соперник', 'El otro barco', 'Das andere Boot', 'Diğer tekne', 'L’autre bateau', 'L’altra barca', 'O outro barco'); // (a 1-on-1 race's: the one who dropped out)
  const title = ended === 'dsq' ? t('Disqualified', 'Дисквалификация', 'Descalificado', 'Disqualifiziert', 'Diskalifiye', 'Disqualifié', 'Squalificato', 'Desclassificado') : ended === 'dnf' ? t('Did not finish', 'Не финишировал', 'No terminó', 'Nicht im Ziel', 'Bitirmedi', 'Abandon', 'Non arrivato', 'Não terminou') : ended === 'won' ? t(`You won: ${rival} dropped out`, `Ты победил: ${rival} — сход`, `Ganaste: ${rival} abandonó`, `Du hast gewonnen: ${rival} ist ausgeschieden`, `Kazandın: ${rival} yarıştan çekildi`, `Tu as gagné : ${rival} a abandonné`, `Hai vinto: ${rival} si è ritirato`, `Você venceu: ${rival} abandonou`) : shared ? t(`Finished ${ordEn(place)}`, `${place}-е место на финише`, `Llegaste ${ordEs(place)}`, `${ordDe(place)} im Ziel`, `${ordTr(place)} bitirdi`, `Arrivé ${place}${place === 1 ? 'er' : 'e'}`, `Arrivato ${place}º`, `Chegou em ${place}º`) : t(`You finished ${ordEn(place)}`, `${place}-е место на финише`, `Llegaste ${ordEs(place)}`, `Du bist ${ordDe(place)} im Ziel`, `${ordTr(place)} bitirdin`, `Tu es arrivé ${place}${place === 1 ? 'er' : 'e'}`, `Sei arrivato ${place}º`, `Você chegou em ${place}º`);
  const gap = me.secs != null && winner?.secs != null && winner !== me ? `+${(me.secs - winner.secs).toFixed(1)} ${t('s', 'с', 's', 's', 'sn', 's', 's', 's')}` : '—';
  const again = one ? '/match/new' : res.daily ? '/play?race=today' : '/play?race=free';
  const isToday = res.daily === new Date().toISOString().slice(0, 10); // the daily race's day is the UTC date, as the game's
  // someone else's race: today's race, for you to sail
  // a newcomer's first race (the game's easy one, public/game/main.js FIRST): on to today's race next
  const firstRace = !shared && !one && !!res.first;
  const cta = shared
    ? { href: '/race', label: t('Sail today’s race', 'Пройти гонку дня', 'Navega la regata del día', 'Die Regatta des Tages segeln', 'Günün yarışına çık', 'Courir la régate du jour', 'Corri la regata del giorno', 'Velejar a regata do dia') }
    : firstRace ? { href: '/play?race=today', label: t('Today’s race', 'Гонка дня', 'La regata del día', 'Regatta des Tages', 'Günün yarışı', 'La régate du jour', 'La regata del giorno', 'A regata do dia') }
    : { href: again, label: one ? t('Another 1-on-1 race', 'Ещё одна гонка 1 на 1', 'Otra regata 1 contra 1', 'Noch eine 1-gegen-1-Regatta', 'Bir bire bir yarış daha', 'Un autre duel', 'Un altro duello', 'Outro duelo 1 contra 1') : t('Race again', 'Ещё гонку', 'Regatear otra vez', 'Nochmal segeln', 'Yeniden yarış', 'Recourir', 'Corri di nuovo', 'Correr de novo') };
  const mine = me.secs != null && !me.dsq ? me.secs : null;
  const you = shared ? t('This boat', 'Эта лодка', 'Este barco', 'Dieses Boot', 'Bu tekne', 'Ce bateau', 'Questa barca', 'Este barco') : t('You', 'Ты', 'Tú', 'Du', 'Sen', 'Toi', 'Tu', 'Você');
  // the link to this page, with a line to go with it, for the share sheet (components/share-sheet): each app gets it
  // with its own utm_source, so the analytics say which app a visit came from
  const shareText = () => {
    const time = me.secs != null && !me.dsq ? clock(me.secs) : '';
    return me.dsq ? t('My race in Up and down', 'Моя гонка в Up and down', 'Mi regata en Up and down', 'Meine Regatta in Up and down', 'Up and down’daki yarışım', 'Ma régate dans Up and down', 'La mia regata in Up and down', 'Minha regata no Up and down')
      : res.daily && isToday ? t(`I finished ${ordEn(place)} in ${time} in today’s race. Can you beat it?`, `${place}-е место за ${time} в гонке дня. Сможешь быстрее?`, `Terminé ${ordEs(place)} con ${time} en la regata de hoy. ¿Puedes batirlo?`, `Ich wurde ${ordDe(place)} in ${time} in der Regatta des Tages. Schlägst du das?`, `Günün yarışında ${time} ile ${ordTr(place)} bitirdim. Sen geçebilir misin?`, `J’ai fini ${place}${place === 1 ? 'er' : 'e'} en ${time} dans la régate du jour. Tu fais mieux ?`, `Sono arrivato ${place}º in ${time} nella regata del giorno. Riesci a fare meglio?`, `Cheguei em ${place}º com ${time} na regata do dia. Você consegue superar?`)
      : t(`I finished ${ordEn(place)} in ${time}`, `${place}-е место за ${time}`, `Terminé ${ordEs(place)} con ${time}`, `Ich wurde ${ordDe(place)} in ${time}`, `${time} ile ${ordTr(place)} bitirdim`, `J’ai fini ${place}${place === 1 ? 'er' : 'e'} en ${time}`, `Sono arrivato ${place}º in ${time}`, `Cheguei em ${place}º com ${time}`);
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
  if (L.startDsq) items.push({ k: t('Start', 'Старт', 'Salida', 'Start', 'Start', 'Départ', 'Partenza', 'Largada'), good: false, v: L.startDsq === 'U' ? t('Disqualified at the start (U flag)', 'Дисквалификация на старте (флаг U)', 'Descalificado en la salida (bandera U)', 'Am Start disqualifiziert (U-Flagge)', 'Startta diskalifiye (U bayrağı)', 'Disqualifié au départ (pavillon U)', 'Squalificato in partenza (bandiera U)', 'Desclassificado na largada (bandeira U)') : t('Disqualified at the start (black flag)', 'Дисквалификация на старте (чёрный флаг)', 'Descalificado en la salida (bandera negra)', 'Am Start disqualifiziert (schwarze Flagge)', 'Startta diskalifiye (siyah bayrak)', 'Disqualifié au départ (pavillon noir)', 'Squalificato in partenza (bandiera nera)', 'Desclassificado na largada (bandeira preta)'), tip: t('Under U or the black flag, stay below the line for the whole last minute.', 'Под флагом U или чёрным держись за линией всю последнюю минуту.', 'Con la bandera U o la negra, mantente bajo la línea todo el último minuto.', 'Bleib unter U oder der schwarzen Flagge die ganze letzte Minute unterhalb der Linie.', 'U ya da siyah bayrakta, son dakika boyunca hattın altında kal.', 'Sous le pavillon U ou le pavillon noir, reste sous la ligne pendant toute la dernière minute.', 'Con la U o la bandiera nera, resta sotto la linea per tutto l’ultimo minuto.', 'Com a bandeira U ou a preta, fique abaixo da linha durante todo o último minuto.') , drill: 'start' });
  else if (L.ocs) items.push({ k: t('Start', 'Старт', 'Salida', 'Start', 'Start', 'Départ', 'Partenza', 'Largada'), good: false, v: t('At the gun: over the line — you had to go back', 'На сигнале старта: за линией — пришлось возвращаться', 'En la señal: sobre la línea — tuviste que volver', 'Beim Startsignal: über der Linie — du musstest zurück', 'Start işaretinde: hattın üzerinde — geri dönmen gerekti', 'Au signal : au-dessus de la ligne — tu as dû revenir', 'Al segnale: oltre la linea, dovevi tornare indietro', 'No tiro: acima da linha — você teve que voltar'), tip: t('Aim to be a boat length behind the line, at full speed, as the gun goes.', 'Цель — быть в корпусе от линии на полной скорости в момент сигнала.', 'Procura estar a una eslora de la línea, a toda velocidad, cuando suene la señal.', 'Sei beim Startsignal eine Bootslänge hinter der Linie, mit voller Fahrt.', 'Start işareti verilirken hattın bir tekne boyu gerisinde, tam hızda olmayı hedefle.', 'Vise une longueur de bateau derrière la ligne, à pleine vitesse, au coup de canon.', 'Cerca di essere una lunghezza dietro la linea, a tutta velocità, quando parte il segnale.', 'Tente estar a um comprimento de barco atrás da linha, em velocidade máxima, na hora do tiro.') , drill: 'start' });
  else if (L.gunD != null && L.gunV != null) {
    // good: near the line and moving at the gun, and over it within 5 s of it (the start drill's three stars, 10 m at
    // 4.5 kn, cross in about that). 21 m back at 3.9 kn crossed 18 s late and last off the line: not one that wins races
    const good = L.gunD >= 0 && L.gunD < 25 && L.gunV > 3.5 && (L.startT == null || L.startT <= 5), d = Math.round(Math.max(0, L.gunD)), v = L.gunV.toFixed(1);
    items.push({ k: t('Start', 'Старт', 'Salida', 'Start', 'Start', 'Départ', 'Partenza', 'Largada'), good, v: t(`At the gun: ${d} m from the line at ${v} kn`, `На сигнале старта: ${d} м до линии, ${v.replace('.', ',')} уз`, `En la señal: a ${d} m de la línea a ${v.replace('.', ',')} kn`, `Beim Startsignal: ${d} m von der Linie bei ${v.replace('.', ',')} kn`, `Start işaretinde: hattan ${d} m, ${v} kn hızla`, `Au signal : à ${d} m de la ligne à ${v.replace('.', ',')} kn`, `Al segnale: a ${d} m dalla linea a ${v.replace('.', ',')} nodi`, `No tiro: a ${d} m da linha a ${v.replace('.', ',')} kn`), tip: good ? t('Close to the line and up to speed at the gun: that is the start that wins races.', 'У линии и на скорости в момент старта — так и выигрываются гонки.', 'Cerca de la línea y a velocidad en la señal: esa es la salida que gana regatas.', 'Dicht an der Linie und in Fahrt beim Startsignal: So gewinnt man Regatten.', 'Start işaretinde hatta yakın ve hızda olmak: yarış kazandıran start budur.', 'Près de la ligne et lancé au coup de canon : c’est le départ qui gagne les régates.', 'Vicino alla linea e già in velocità al segnale: è la partenza che vince le regate.', 'Perto da linha e em velocidade no tiro: essa é a largada que ganha regatas.') : t('Aim to be a boat length behind the line, at full speed, as the gun goes.', 'Цель — быть в корпусе от линии на полной скорости в момент сигнала.', 'Procura estar a una eslora de la línea, a toda velocidad, cuando suene la señal.', 'Sei beim Startsignal eine Bootslänge hinter der Linie, mit voller Fahrt.', 'Start işareti verilirken hattın bir tekne boyu gerisinde, tam hızda olmayı hedefle.', 'Vise une longueur de bateau derrière la ligne, à pleine vitesse, au coup de canon.', 'Cerca di essere una lunghezza dietro la linea, a tutta velocità, quando parte il segnale.', 'Tente estar a um comprimento de barco atrás da linha, em velocidade máxima, na hora do tiro.') , drill: good ? undefined : 'start' });
  }
  if (L.pct != null) items.push({ k: t('Speed', 'Скорость', 'Velocidad', 'Geschwindigkeit', 'Hız', 'Vitesse', 'Velocità', 'Velocidade'), good: L.pct >= 90, v: t(`${L.pct}% of target on average`, `В среднем ${L.pct}% от целевой`, `${L.pct} % del objetivo de media`, `${L.pct} % des Zieltempos im Schnitt`, `Hedefe oranla ortalama %${L.pct}`, `${L.pct} % de la cible en moyenne`, `${L.pct}% dell’obiettivo in media`, `${L.pct}% do alvo em média`), tip: L.pct >= 90 ? t('The sheet stayed in the green band: the boat sailed close to her best.', 'Шкот был в зелёной полосе — лодка шла близко к лучшей скорости.', 'La escota se mantuvo en la banda verde: el barco navegó cerca de su mejor rendimiento.', 'Die Schot blieb im grünen Bereich: Das Boot segelte nahe an seinem Besten.', 'İskota yeşil bantta kaldı: tekne en iyisine yakın yelken açtı.', 'L’écoute est restée dans la bande verte : le bateau a navigué près de son meilleur.', 'La scotta è rimasta nella fascia verde: la barca ha navigato vicino al suo meglio.', 'A escota ficou na faixa verde: o barco velejou perto do seu melhor.') : t('Keep the sheet in the green band and steer smoothly: every turn of the rudder brakes the boat.', 'Держи шкот в зелёной полосе и рули плавно: каждое движение руля тормозит.', 'Mantén la escota en la banda verde y gobierna con suavidad: cada giro del timón frena el barco.', 'Halte die Schot im grünen Bereich und steuere ruhig: Jede Ruderbewegung bremst das Boot.', 'İskotayı yeşil bantta tut ve düzgün dümen kır: dümenin her dönüşü tekneyi frenler.', 'Garde l’écoute dans la bande verte et barre en douceur : chaque coup de safran freine le bateau.', 'Tieni la scotta nella fascia verde e timona dolcemente: ogni colpo di timone frena la barca.', 'Mantenha a escota na faixa verde e governe com suavidade: cada movimento do leme freia o barco.') });
  // the tacks on the beat that came in a shift (main.js: 3° or more either way); with none, there's nothing to judge
  if (L.tacks && L.head + L.lift) items.push({ k: t('Tacks', 'Повороты', 'Virajes', 'Wenden', 'Tramolalar', 'Virements', 'Virate', 'Cambadas'), good: L.lift <= L.head, v: t(`On the beat: ${L.head} in a header, ${L.lift} in a lift`, `На лавировке: ${L.head} — когда ветер зашёл, ${L.lift} — когда отошёл`, `En la ceñida: ${L.head} con rolada desfavorable, ${L.lift} con rolada favorable`, `Auf dem Kreuz: ${L.head} im Dreher, ${L.lift} im Raumer`, `Orsada: aleyhte dönüşte ${L.head}, lehte dönüşte ${L.lift}`, `Au près : ${L.head} sur un refus, ${L.lift} sur une adonnante`, `Di bolina: ${L.head} con un salto a scarso, ${L.lift} con un salto a buono`, `Na orça: ${L.head} numa rondada contra, ${L.lift} numa rondada a favor`), tip: L.lift <= L.head ? t('You tacked on the headers: each one turned the shift into ground gained.', 'Ты поворачивал на заходах — и каждый превращал сдвиг ветра в выигрыш.', 'Viraste con las roladas desfavorables: cada una se convirtió en terreno ganado.', 'Du hast in den Drehern gewendet: Jeder machte aus dem Winddreher gewonnene Strecke.', 'Aleyhte dönüşlerde tramola attın: her biri rüzgâr dönüşünü kazanılan yola çevirdi.', 'Tu as viré sur les refus : chacun a transformé la bascule en terrain gagné.', 'Hai virato sui salti a scarso: ognuno ha trasformato il salto di vento in terreno guadagnato.', 'Você cambou nas rondadas contra: cada uma virou terreno ganho.') : t('Tack when the wind heads you (Header in the wind box), not when it lifts you (Lift).', 'Поворачивай, когда ветер заходит («Заход» в окне ветра), а не когда отходит («Отход»).', 'Vira cuando el viento te cierra (rolada desfavorable), no cuando te abre (rolada favorable).', 'Wende, wenn der Wind dich abdreht (Dreher in der Windanzeige), nicht wenn er dich anhebt (Raumer).', 'Rüzgâr seni aleyhe çevirdiğinde (rüzgâr kutusunda Aleyhte) tramola at, lehine çevirdiğinde (Lehte) değil.', 'Vire quand le vent te refuse (Refus dans la case du vent), pas quand il adonne (Adonnante).', 'Vira quando il vento ti scarseggia (Scarso nel riquadro del vento), non quando ti fa buono (Buono).', 'Cambe quando o vento rondar contra (Contra, na caixa do vento), não quando rondar a favor (A favor).') , drill: L.lift <= L.head ? undefined : 'tacks' });
  if (L.dirty >= 10) items.push({ k: t('Dirty air', 'Ветровая тень', 'Aire sucio', 'Abwind', 'Kirli hava', 'Vent perturbé', 'Aria sporca', 'Vento sujo'), good: L.dirty < 30, v: t(`${L.dirty} s in another boat’s dirty air`, `${L.dirty} с в ветровой тени другой лодки`, `${L.dirty} s en el aire sucio de otro barco`, `${L.dirty} s im Abwind eines anderen Bootes`, `Başka bir teknenin kirli havasında ${L.dirty} sn`, `${L.dirty} s dans le vent perturbé d’un autre bateau`, `${L.dirty} s nell’aria sporca di un’altra barca`, `${L.dirty} s no vento sujo de outro barco`), tip: L.dirty < 30 ? t('Mostly in clear air, where the wind is full.', 'Почти всё время в чистом ветре, где он полный.', 'Sobre todo en aire limpio, donde el viento es pleno.', 'Meist in freier Luft, wo der Wind voll ist.', 'Çoğunlukla rüzgârın dolu olduğu temiz havada.', 'Surtout en air libre, là où le vent est plein.', 'Quasi sempre in aria pulita, dove il vento è pieno.', 'Quase sempre em vento limpo, onde o vento é pleno.') : t('Behind and downwind of another boat the wind is weaker: tack away or sail clear of it.', 'За другой лодкой и под ветром от неё ветер слабее: поверни или уйди из ветровой тени.', 'Detrás y a sotavento de otro barco el viento es más flojo: vira para alejarte o navega libre de él.', 'Hinter und in Lee eines anderen Bootes ist der Wind schwächer: Wende weg oder segle frei davon.', 'Başka bir teknenin gerisinde ve rüzgâraltında rüzgâr zayıftır: tramola atıp uzaklaş ya da ondan uzakta yelken aç.', 'Derrière et sous le vent d’un autre bateau, le vent est plus faible : vire pour t’en éloigner ou dégage-toi.', 'Dietro e sottovento a un’altra barca il vento è più debole: vira via o allontanati da lei.', 'Atrás e a sotavento de outro barco o vento é mais fraco: cambe para sair dele ou velejar livre dele.') });
  if (L.penT > 1) items.push({ k: t('Penalties', 'Штрафы', 'Penalizaciones', 'Strafen', 'Cezalar', 'Pénalités', 'Penalità', 'Penalidades'), good: false, v: t(`${L.penT} s spinning penalty turns`, `${L.penT} с на штрафных оборотах`, `${L.penT} s en giros de penalización`, `${L.penT} s Strafkringel gedreht`, `Ceza dönüşlerinde ${L.penT} sn dönüp durdun`, `${L.penT} s en tours de pénalité`, `${L.penT} s in giri di penalità`, `${L.penT} s fazendo giros de penalidade`), tip: t('The rule behind each foul is below.', 'Правило за каждым нарушением — ниже.', 'La regla de cada infracción está abajo.', 'Die Regel hinter jedem Foul steht unten.', 'Her faulün arkasındaki kural aşağıda.', 'La règle derrière chaque faute est indiquée plus bas.', 'La regola dietro ogni infrazione è qui sotto.', 'A regra de cada infração está abaixo.') , drill: 'penalties' });
  const hails = Object.values(L.hails || {}).reduce((a, b) => a + b, 0);
  if (hails) items.push({ k: t('Hails', 'Оклики', 'Avisos', 'Zurufe', 'Seslenmeler', 'Hélages', 'Richiami', 'Chamadas'), good: false, v: t(`Hailed ${hails}× by boats you had to keep clear of`, `${hails} раз(а) окликнули лодки, которым ты должен был уступить`, `Avisado ${hails}× por barcos de los que debías mantenerte separado`, `${hails}× von Booten angerufen, denen du ausweichen musstest`, `Uzak durman gereken teknelerce ${hails}× seslenildi`, `Hélé ${hails}× par des bateaux dont tu devais te maintenir à l’écart`, `Richiamato ${hails}× da barche da cui dovevi tenerti discosto`, `Chamado ${hails}× por barcos dos quais você tinha que se manter afastado`), tip: t('A hail is a warning, not a penalty — keep clear in time.', 'Оклик — предупреждение, а не штраф: уступай вовремя.', 'Un aviso es una advertencia, no una penalización: mantente separado a tiempo.', 'Ein Zuruf ist eine Warnung, keine Strafe — halte rechtzeitig frei.', 'Seslenme bir uyarıdır, ceza değil — zamanında uzak dur.', 'Un hélage est un avertissement, pas une pénalité — écarte-toi à temps.', 'Un richiamo è un avvertimento, non una penalità: tieniti discosto in tempo.', 'Uma chamada é um aviso, não uma penalidade — mantenha-se afastado a tempo.'), note: true });
  if (!L.fouls.length && !L.ocs && !L.startDsq && !hails) items.push({ k: t('Rules', 'Правила', 'Reglas', 'Regeln', 'Kurallar', 'Règles', 'Regole', 'Regras'), good: true, v: t('No fouls and no penalties — a clean race', 'Ни нарушений, ни штрафов — чистая гонка', 'Sin infracciones ni penalizaciones: una regata limpia', 'Keine Fouls und keine Strafen — eine saubere Regatta', 'Faul yok, ceza yok — temiz bir yarış', 'Aucune faute, aucune pénalité — une régate propre', 'Nessuna infrazione e nessuna penalità: una regata pulita', 'Sem infrações e sem penalidades — uma regata limpa'), tip: t('You kept clear in time, every time.', 'Ты всегда вовремя уступал дорогу.', 'Te mantuviste separado a tiempo, siempre.', 'Du hast dich jedes Mal rechtzeitig freigehalten.', 'Her seferinde zamanında uzak durdun.', 'Tu t’es maintenu à l’écart à temps, à chaque fois.', 'Ti sei tenuto discosto in tempo, ogni volta.', 'Você se manteve afastado a tempo, todas as vezes.') });
  const foulRules = [...new Map(L.fouls.map((f) => [f.rule, f])).values()];
  const legM = legDistances(res.course, res.course.legs);
  const tracks = res.boats.map((b) => ({ pts: b.track, me: b.me }));
  const fouls = L.fouls.filter((f) => f.x != null && f.z != null).map((f) => [f.x!, f.z!] as [number, number]);
  const legName = (k: string) => ({ start: t('Start', 'Старт', 'Salida', 'Start', 'Start', 'Départ', 'Partenza', 'Largada'), mark: shape === 'trap' ? t('Mark 1', 'Знак 1', 'Baliza 1', 'Marke 1', 'Şamandıra 1', 'Bouée 1', 'Boa 1', 'Boia 1') : t('Windward mark', 'Верхний знак', 'Baliza de barlovento', 'Luvtonne', 'Rüzgârüstü şamandırası', 'Bouée au vent', 'Boa di bolina', 'Boia de barlavento'), wing: t('Wing mark', 'Боковой знак', 'Baliza de través', 'Raumtonne', 'Kanat şamandırası', 'Bouée de largue', 'Boa di lasco', 'Boia de través'),
    mark2: t('Mark 2', 'Знак 2', 'Baliza 2', 'Marke 2', 'Şamandıra 2', 'Bouée 2', 'Boa 2', 'Boia 2'), offset: t('Offset mark', 'Отбойник', 'Baliza de desmarque', 'Ablauftonne', 'Ofset şamandırası', 'Dégagement', 'Boa di disimpegno', 'Boia de offset'), gate: t('Leeward gate', 'Нижние ворота', 'Puerta de sotavento', 'Leetor', 'Rüzgâraltı kapısı', 'Porte sous le vent', 'Cancello di poppa', 'Portão de sotavento'), finish: t('Finish', 'Финиш', 'Llegada', 'Ziel', 'Bitiş', 'Arrivée', 'Arrivo', 'Chegada') }[k] || k);

  const where = sailedAt(raceVenue(res, shared ? 'gocek' : readOpts().venue)); // (a first race's, its own venue: lib/venues.ts FIRST_VENUE)
  const scene = finishScene(res);
  const nb = neighbours(res);
  const gapS = (g: number) => `${g.toFixed(1).replace('.', lang === 'en' ? '.' : ',')} ${t('s', 'с', 's', 's', 'sn', 's', 's', 's')}`;
  // the finish in a line: who crossed just before and just after, as the scene shows them
  const near = me.dsq || me.dnf || me.secs == null ? ''
    : nb.ahead && nb.behind ? t(`${shared ? 'This boat' : 'You'} crossed ${gapS(nb.ahead.gap)} after ${nb.ahead.name} and ${gapS(nb.behind.gap)} before ${nb.behind.name}.`, `${shared ? 'Эта лодка пересекла' : 'Ты пересёк'} линию через ${gapS(nb.ahead.gap)} после ${nb.ahead.name} и за ${gapS(nb.behind.gap)} до ${nb.behind.name}.`, `${shared ? 'Este barco cruzó' : 'Cruzaste'} ${gapS(nb.ahead.gap)} después de ${nb.ahead.name} y ${gapS(nb.behind.gap)} antes de ${nb.behind.name}.`, `${shared ? 'Dieses Boot war' : 'Du warst'} ${gapS(nb.ahead.gap)} nach ${nb.ahead.name} und ${gapS(nb.behind.gap)} vor ${nb.behind.name} dran.`, `${shared ? 'Bu tekne' : 'Sen'} kapıdan ${nb.ahead.name} adlı tekneden ${gapS(nb.ahead.gap)} sonra, ${nb.behind.name} adlı tekneden ${gapS(nb.behind.gap)} önce geçti${shared ? '' : 'n'}.`, `${shared ? 'Ce bateau est passé' : 'Tu es passé'} ${gapS(nb.ahead.gap)} après ${nb.ahead.name} et ${gapS(nb.behind.gap)} avant ${nb.behind.name}.`, `${shared ? 'Questa barca è passata' : 'Sei passato'} ${gapS(nb.ahead.gap)} dopo ${nb.ahead.name} e ${gapS(nb.behind.gap)} prima di ${nb.behind.name}.`, `${shared ? 'Este barco cruzou' : 'Você cruzou'} ${gapS(nb.ahead.gap)} depois de ${nb.ahead.name} e ${gapS(nb.behind.gap)} antes de ${nb.behind.name}.`)
    : nb.behind ? t(`First across the line, ${gapS(nb.behind.gap)} ahead of ${nb.behind.name}.`, `Первым на финише, на ${gapS(nb.behind.gap)} раньше ${nb.behind.name}.`, `Primero en cruzar la línea, ${gapS(nb.behind.gap)} por delante de ${nb.behind.name}.`, `Als Erster über die Linie, ${gapS(nb.behind.gap)} vor ${nb.behind.name}.`, `Hattı ilk geçen, ${nb.behind.name} adlı tekneden ${gapS(nb.behind.gap)} önde.`, `Premier sur la ligne, ${gapS(nb.behind.gap)} devant ${nb.behind.name}.`, `Primo sulla linea, ${gapS(nb.behind.gap)} davanti a ${nb.behind.name}.`, `Primeiro a cruzar a linha, ${gapS(nb.behind.gap)} à frente de ${nb.behind.name}.`)
    : nb.ahead ? t(`Last across the line, ${gapS(nb.ahead.gap)} after ${nb.ahead.name}.`, `Последним на финише, через ${gapS(nb.ahead.gap)} после ${nb.ahead.name}.`, `Último en cruzar la línea, ${gapS(nb.ahead.gap)} después de ${nb.ahead.name}.`, `Als Letzter über die Linie, ${gapS(nb.ahead.gap)} nach ${nb.ahead.name}.`, `Hattı son geçen, ${nb.ahead.name} adlı tekneden ${gapS(nb.ahead.gap)} sonra.`, `Dernier sur la ligne, ${gapS(nb.ahead.gap)} après ${nb.ahead.name}.`, `Ultimo sulla linea, ${gapS(nb.ahead.gap)} dopo ${nb.ahead.name}.`, `Último a cruzar a linha, ${gapS(nb.ahead.gap)} depois de ${nb.ahead.name}.`) : '';
  const pbNote = shared ? null : res.pb?.isNew ? t('New personal best', 'Новый личный рекорд', 'Nueva mejor marca personal', 'Neue persönliche Bestzeit', 'Yeni kişisel rekor', 'Nouveau record personnel', 'Nuovo record personale', 'Novo recorde pessoal')
    : res.pb && me.secs === res.pb.best ? (res.daily ? t('Your best today', 'Твой лучший сегодня', 'Tu mejor de hoy', 'Deine Bestzeit heute', 'Bugünkü en iyin', 'Ton meilleur du jour', 'Il tuo record di oggi', 'Seu melhor hoje') : t('Your best on this course', 'Твой лучший на этой дистанции', 'Tu mejor en este recorrido', 'Deine Bestzeit auf dieser Bahn', 'Bu parkurdaki en iyin', 'Ton meilleur sur ce parcours', 'Il tuo record su questo percorso', 'Seu melhor neste percurso')) : null;
  const legs = [...L.legs.map((tm, i) => ({ k: res.course.legs[i], i, tm, pl: L.legPlaces[i] })),
    ...(me.done && me.secs != null && L.legs.length < res.course.legs.length ? [{ k: 'finish', i: res.course.legs.length - 1, tm: me.secs, pl: me.dsq ? 0 : place }] : [])];

  // the race in four numbers, as the broadcast's finish has them: each only when the race kept what it needs (a result
  // saved before the game kept the leg times, the gybes and the top speed shows fewer, or none)
  const lost = costliest(res.boats), st = startOf(L, res.boats), bl = goodLeg(res.boats, lost?.seg), pens = me.pens ?? L.fouls.length;
  const num = (x: number) => x.toFixed(1).replace('.', lang === 'en' ? '.' : ',');
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  const endW = { pin: t('at the pin end', 'у пина', 'en el extremo de la baliza', 'am Pinnende', 'pin ucunda', 'côté bouée', 'dal lato boa', 'na ponta da boia'), boat: t('at the boat end', 'у судейского судна', 'en el extremo del barco', 'am Bootsende', 'tekne ucunda', 'côté bateau comité', 'dal lato barca comitato', 'na ponta do barco da comissão'), middle: t('mid-line', 'в середине линии', 'a media línea', 'mittig', 'hat ortasında', 'au milieu de la ligne', 'a metà linea', 'no meio da linha') };
  type Tile = { k: string; v: string; u?: string; s: string; up?: boolean };
  const tiles = ([
    st && { k: t('Start', 'Старт', 'Salida', 'Start', 'Start', 'Départ', 'Partenza', 'Largada'), v: num(st.late), u: t('s late', 'с после сигнала', 's tarde', 's zu spät', 'sn geç', 's en retard', 's in ritardo', 's atrasado'),
      s: L.ocs ? t('Over early: back and started again', 'Фальстарт: вернулся и стартовал снова', 'Antes de tiempo: volviste y saliste de nuevo', 'Zu früh drüber: zurück und neu gestartet', 'Erken geçtin: geri dönüp yeniden start aldın', 'Parti trop tôt : revenu et reparti', 'Partito in anticipo: rientrato e ripartito', 'Largada queimada: voltou e largou de novo')
        : cap([st.place ? t(`${ordEn(st.place)} off the line`, `${st.place}-м пересёк линию`, `${ordEs(st.place)} en salir de la línea`, `${ordDe(st.place)} an der Linie`, `Hattan ayrılışta ${ordTr(st.place)}`, `${st.place}${st.place === 1 ? 'er' : 'e'} à quitter la ligne`, `${st.place}º a lasciare la linea`, `${st.place}º a sair da linha`) : '', st.end ? endW[st.end] : ''].filter(Boolean).join(', ')) || t('After the gun', 'После сигнала', 'Tras la señal', 'Nach dem Startsignal', 'Start işaretinden sonra', 'Après le signal', 'Dopo il segnale', 'Depois do tiro') },
    bl && { k: t('Best leg', 'Лучший отрезок', 'Mejor tramo', 'Bester Schenkel', 'En iyi ayak', 'Meilleur bord', 'Lato migliore', 'Melhor perna'), v: t(`Leg ${bl.leg}`, `Отрезок ${bl.leg}`, `Tramo ${bl.leg}`, `Schenkel ${bl.leg}`, `Ayak ${bl.leg}`, `Bord ${bl.leg}`, `Lato ${bl.leg}`, `Perna ${bl.leg}`), up: bl.place === 1,
      s: bl.place === 1 ? (bl.by < 0.05 ? t('Level with the fastest', 'Вровень с лучшим', 'A la par del más rápido', 'Gleichauf mit dem Schnellsten', 'En hızlıyla aynı', 'À égalité avec le plus rapide', 'Alla pari con il più veloce', 'Empatado com o mais rápido') : t(`Fastest of the fleet, by ${gapS(bl.by)}`, `Быстрее всех, на ${gapS(bl.by)}`, `Más rápido de la flota, por ${gapS(bl.by)}`, `Schnellster im Feld, um ${gapS(bl.by)}`, `Filonun en hızlısı, ${gapS(bl.by)} farkla`, `Le plus rapide de la flotte, de ${gapS(bl.by)}`, `Il più veloce della flotta, di ${gapS(bl.by)}`, `O mais rápido da flotilha, por ${gapS(bl.by)}`))
        : t(`${ordEn(bl.place)} fastest of ${bl.of}, ${gapS(bl.by)} off`, `${bl.place}-й из ${bl.of}, ${gapS(bl.by)} от лучшего`, `${ordEs(bl.place)} más rápido de ${bl.of}, a ${gapS(bl.by)}`, `${ordDe(bl.place)} schnellster von ${bl.of}, ${gapS(bl.by)} zurück`, `${bl.of} içinde ${ordTr(bl.place)} en hızlı, ${gapS(bl.by)} geride`, `${bl.place}${bl.place === 1 ? 'er' : 'e'} plus rapide sur ${bl.of}, à ${gapS(bl.by)}`, `${bl.place}º più veloce su ${bl.of}, a ${gapS(bl.by)}`, `${bl.place}º mais rápido de ${bl.of}, a ${gapS(bl.by)}`) },
    L.top ? { k: t('Top speed', 'Макс. скорость', 'Velocidad máxima', 'Höchstgeschwindigkeit', 'En yüksek hız', 'Vitesse max', 'Velocità massima', 'Velocidade máxima'), v: num(L.top), u: t('kn', 'уз', 'kn', 'kn', 'kn', 'kn', 'kn', 'nós'),
      s: cap([L.topKite ? t('under the kite', 'под генакером', 'con el gennaker', 'unter dem Spi', 'gennaker altında', 'sous gennaker', 'sotto spi', 'com o gennaker') : '', L.topLeg ? t(`leg ${L.topLeg}`, `отрезок ${L.topLeg}`, `tramo ${L.topLeg}`, `Schenkel ${L.topLeg}`, `ayak ${L.topLeg}`, `bord ${L.topLeg}`, `lato ${L.topLeg}`, `perna ${L.topLeg}`) : t('at the start', 'на старте', 'en la salida', 'am Start', 'startta', 'au départ', 'in partenza', 'na largada')].filter(Boolean).join(', ')) } : null,
    L.gybes != null ? { k: t('Tacks · gybes', 'Оверштаги · фордевинды', 'Virajes · trasluchadas', 'Wenden · Halsen', 'Tramolalar · kavançalar', 'Virements · empannages', 'Virate · strambate', 'Cambadas · jibes'), v: `${L.tacks} · ${L.gybes}`,
      s: pens ? t(`${pens} ${pens === 1 ? 'penalty' : 'penalties'}`, `Штрафов: ${pens}`, `${pens} ${pens === 1 ? 'penalización' : 'penalizaciones'}`, `${pens} ${pens === 1 ? 'Strafe' : 'Strafen'}`, `${pens} ceza`, `${pens} ${pens === 1 ? 'pénalité' : 'pénalités'}`, `${pens} ${pens === 1 ? 'penalità' : 'penalità'}`, `${pens} ${pens === 1 ? 'penalidade' : 'penalidades'}`) : t('No penalties', 'Без штрафов', 'Sin penalizaciones', 'Keine Strafen', 'Ceza yok', 'Aucune pénalité', 'Nessuna penalità', 'Sem penalidades') } : null,
  ] as (Tile | null)[]).filter((x): x is Tile => !!x);
  const hasPens = res.boats.some((b) => b.pens != null);
  const hasLevels = res.boats.some((b) => b.level && LEVEL[b.level]); // a race kept before the skippers had levels has none
  // a new best: the one it beat, beside it
  const prev = !shared && res.pb?.isNew && res.pb.prev != null ? res.pb.prev : null;

  // the next target, first thing after the result: today's race, the place above you on today's ranking (and the
  // podium, when that's further); a free race, the boat that beat you, or your best on the course. And where the time
  // went: the part of the race you lost most in to the boat that finished just ahead of you.
  const ordW = (n: number) => t(ordEn(n), `${n}-е`, ordEs(n), ordDe(n), ordTr(n), ordFr(n), ordIt(n), ordPt(n));
  let target: { v: string; s?: string; go?: string } | null = null;
  if (!shared && !one && mine != null) {
    // today's race counts your best of the day (the game's record of it), which may be an earlier race than this one
    const best = res.daily && res.pb ? Math.min(mine, res.pb.best) : mine;
    const faster = res.daily && isToday && field ? field.filter((s) => s < best - 0.05).sort((a, b) => a - b) : null;
    if (faster && faster.length) {
      const pl = faster.length, need = best - faster[pl - 1] + 0.1;
      target = { v: t(`${gapS(need)} to ${ordEn(pl)} on today’s ranking`, `${gapS(need)} до ${pl}-го места в рейтинге дня`, `${gapS(need)} para ${ordEs(pl)} en la clasificación de hoy`, `${gapS(need)} bis ${ordDe(pl)} in der Rangliste des Tages`, `Günün sıralamasında ${ordTr(pl)} için ${gapS(need)}`, `${gapS(need)} de la ${pl}${pl === 1 ? 're' : 'e'} place au classement du jour`, `${gapS(need)} dal ${pl}º posto nella classifica del giorno`, `${gapS(need)} para o ${pl}º lugar na classificação do dia`), go: t('climb the ranking', 'вверх по рейтингу', 'sube en la clasificación', 'in der Rangliste steigen', 'sıralamada yüksel', 'monte au classement', 'risali la classifica', 'suba na classificação'),
        s: [pl > 3 ? t(`${gapS(best - faster[2] + 0.1)} to the podium`, `${gapS(best - faster[2] + 0.1)} до подиума`, `${gapS(best - faster[2] + 0.1)} para el podio`, `${gapS(best - faster[2] + 0.1)} bis zum Podium`, `Podyuma ${gapS(best - faster[2] + 0.1)}`, `${gapS(best - faster[2] + 0.1)} du podium`, `${gapS(best - faster[2] + 0.1)} dal podio`, `${gapS(best - faster[2] + 0.1)} para o pódio`) : '',
          best < mine - 0.05 ? t(`from your best today, ${clock(best)}`, `от твоего лучшего сегодня, ${clock(best)}`, `de tu mejor de hoy, ${clock(best)}`, `von deiner Bestzeit heute, ${clock(best)}`, `bugünkü en iyinden, ${clock(best)}`, `depuis ton meilleur du jour, ${clock(best)}`, `dal tuo record di oggi, ${clock(best)}`, `do seu melhor de hoje, ${clock(best)}`) : ''].filter(Boolean).join(' · ') || undefined };
    } else if (faster && field?.length) {
      const next = field.filter((s) => s > best + 0.05).sort((a, b) => a - b)[0];
      target = { v: t('Fastest today', 'Быстрее всех сегодня', 'El más rápido hoy', 'Heute am schnellsten', 'Bugünün en hızlısı', 'Le plus rapide du jour', 'Il più veloce di oggi', 'O mais rápido hoje'), s: next != null ? t(`${gapS(next - best)} clear of 2nd: stretch it`, `${gapS(next - best)} впереди второго — увеличь отрыв`, `${gapS(next - best)} de ventaja sobre el 2.º: amplíala`, `${gapS(next - best)} vor dem Zweiten: Bau es aus`, `İkinciden ${gapS(next - best)} önde: farkı aç`, `${gapS(next - best)} d’avance sur le 2e : creuse l’écart`, `${gapS(next - best)} di vantaggio sul 2º: allunga`, `${gapS(next - best)} de vantagem sobre o 2º: aumente`) : t('The first time on today’s ranking', 'Первое время в рейтинге дня', 'El primer tiempo en la clasificación de hoy', 'Die erste Zeit in der Rangliste des Tages', 'Günün sıralamasındaki ilk süre', 'Le premier temps au classement du jour', 'Il primo tempo nella classifica del giorno', 'O primeiro tempo na classificação do dia') };
    } else if (nb.ahead && place > 1) {
      target = { v: t(`${gapS(nb.ahead.gap + 0.1)} to ${ordEn(place - 1)}`, `${gapS(nb.ahead.gap + 0.1)} до ${place - 1}-го места`, `${gapS(nb.ahead.gap + 0.1)} para ${ordEs(place - 1)}`, `${gapS(nb.ahead.gap + 0.1)} bis ${ordDe(place - 1)}`, `${ordTr(place - 1)} için ${gapS(nb.ahead.gap + 0.1)}`, `${gapS(nb.ahead.gap + 0.1)} de la ${place - 1}${place === 2 ? 're' : 'e'} place`, `${gapS(nb.ahead.gap + 0.1)} dal ${place - 1}º posto`, `${gapS(nb.ahead.gap + 0.1)} para o ${place - 1}º lugar`), go: t(`go for ${ordEn(place - 1)}`, `за ${place - 1}-м местом`, `ve a por ${ordEs(place - 1)}`, `greif nach ${ordDe(place - 1)}`, `${ordTr(place - 1)} için git`, `va chercher la ${place - 1}${place === 2 ? 're' : 'e'} place`, `punta al ${place - 1}º posto`, `vá atrás do ${place - 1}º lugar`), s: nb.ahead.name ? t(`${nb.ahead.name} took it`, `его заняла ${nb.ahead.name}`, `${nb.ahead.name} se lo llevó`, `${nb.ahead.name} holte ihn`, `${nb.ahead.name} aldı`, `${nb.ahead.name} l’a prise`, `${nb.ahead.name} l’ha preso`, `${nb.ahead.name} levou`) : undefined };
    } else if (res.pb && !res.pb.isNew && mine > res.pb.best) {
      target = { v: t(`${gapS(mine - res.pb.best)} off your best`, `${gapS(mine - res.pb.best)} до твоего рекорда`, `a ${gapS(mine - res.pb.best)} de tu mejor marca`, `${gapS(mine - res.pb.best)} hinter deiner Bestzeit`, `En iyinden ${gapS(mine - res.pb.best)} geride`, `à ${gapS(mine - res.pb.best)} de ton meilleur`, `a ${gapS(mine - res.pb.best)} dal tuo record`, `a ${gapS(mine - res.pb.best)} do seu melhor`), go: t('beat your best', 'побей свой рекорд', 'bate tu mejor marca', 'schlag deine Bestzeit', 'en iyini geç', 'bats ton meilleur temps', 'batti il tuo record', 'supere seu melhor') };
    }
  }
  // where you lost most to the boat just ahead, a tile of the debrief's beside your best leg
  if (lost) tiles.splice(Math.min(2, tiles.length), 0, { k: t('Most lost', 'Больше всего потеряно', 'Lo que más se perdió', 'Am meisten verloren', 'En çok kayıp', 'Le plus de temps perdu', 'Più perso', 'Onde mais perdeu'), v: num(lost.lost), u: t('s', 'с', 's', 's', 'sn', 's', 's', 's'),
    s: [lost.seg === 0 ? t('Off the start line', 'На старте', 'Al salir de la línea', 'An der Startlinie', 'Start hattından', 'Au départ de la ligne', 'Uscita dalla linea di partenza', 'Na saída da linha') : t(`Leg ${lost.seg} (${legName(res.course.legs[lost.seg]).toLowerCase()})`, `Отрезок ${lost.seg} (${legName(res.course.legs[lost.seg]).toLowerCase()})`, `Tramo ${lost.seg} (${legName(res.course.legs[lost.seg]).toLowerCase()})`, `Schenkel ${lost.seg} (${legName(res.course.legs[lost.seg])})`, `Ayak ${lost.seg} (${legName(res.course.legs[lost.seg]).toLowerCase()})`, `Bord ${lost.seg} (${legName(res.course.legs[lost.seg]).toLowerCase()})`, `Lato ${lost.seg} (${legName(res.course.legs[lost.seg]).toLowerCase()})`, `Perna ${lost.seg} (${legName(res.course.legs[lost.seg]).toLowerCase()})`),
      lost.name ? t(`against ${lost.name}`, `против ${lost.name}`, `contra ${lost.name}`, `gegen ${lost.name}`, `${lost.name} karşısında`, `face à ${lost.name}`, `contro ${lost.name}`, `contra ${lost.name}`) : ''].filter(Boolean).join(', ') });
  const ctaLabel = !shared && !firstRace && target?.go ? `${cta.label} · ${target.go}` : cta.label; // (a first race's target is the Optimist's, not today's)

  // a first race at this venue (your stamp's race is this one), or a day of a streak
  const firstHere = !shared && !!log && log.v[where.id] === res.at && !me.dsq && me.done;
  const strk = !shared && log && res.daily && res.daily === todayUtc() ? streakOf(log.d) : null;
  const stampN = log ? Object.keys(log.v).length : 0;
  const logNote = firstHere ? t(`First race at ${where.name[0]} · ${stampN} ${stampN === 1 ? 'venue' : 'venues'} raced`,`Первая гонка в ${where.name[1]} · акваторий: ${stampN}`, `Primera regata en ${where.name[2] ?? where.name[0]} · ${stampN} ${stampN === 1 ? 'sede navegada' : 'sedes navegadas'}`, `Erste Regatta in ${(where.name[3] ?? where.name[0])} · ${stampN} ${stampN === 1 ? 'Revier' : 'Reviere'} gesegelt`, `${(where.name[4] ?? where.name[0])} yarış alanında ilk yarış · ${stampN} yarış alanında yarışıldı`, `Première régate à ${(where.name[5] ?? where.name[0])} · ${stampN} ${stampN === 1 ? 'plan d’eau couru' : 'plans d’eau courus'}`, `Prima regata a ${(where.name[6] ?? where.name[0])} · ${stampN} ${stampN === 1 ? 'campo di regata' : 'campi di regata'}`, `Primeira regata em ${(where.name[7] ?? where.name[0])} · ${stampN} ${stampN === 1 ? 'raia corrida' : 'raias corridas'}`)
    : strk && strk.today && strk.n > 1 ? streakWords(strk.n, lang) : null;

  // the result as the broadcast lays it out: the finish as it was behind the result and the full table, then, as the
  // page scrolls on, the debrief beside the track and the legs, and today's ranking beside your best and sharing
  const drills = readDrills(); // your stars, for whether a drill's level is open (this part is drawn only in the browser)
  const tag = (x: Item) => (x.note ? ['note', t('Note', 'Заметка', 'Nota', 'Hinweis', 'Not', 'À noter', 'Nota', 'Observação')] : x.good ? ['ok', t('Good', 'Хорошо', 'Buena', 'Gut', 'İyi', 'Bonne', 'Buona', 'Boa')] : ['work', t('Work on it', 'Поработай', 'A trabajar', 'Daran arbeiten', 'Üzerinde çalış', 'À travailler', 'Da migliorare', 'Para treinar')]);
  return (
    <div className="scr bt-scr rs-scr bc" lang={lang}>
      <div className="bt">
        <GameScene venue={where.id} boat={res.yacht} wind={res.preset} finish={scene} title={t('The finish in 3D, as it was', 'Финиш в 3D, как он был', 'La llegada en 3D, tal como fue', 'Das Ziel in 3D, wie es war', 'Bitiş 3D, olduğu gibi', 'L’arrivée en 3D, telle qu’elle a eu lieu', 'L’arrivo in 3D, com’era', 'A chegada em 3D, como foi')} loading={t('Loading the finish', 'Загружаем финиш', 'Cargando la llegada', 'Das Ziel wird geladen', 'Bitiş yükleniyor', 'Chargement de l’arrivée', 'Caricamento dell’arrivo', 'Carregando a chegada')} />
        {!shared && <Soundtrack />}

        <div className="bt-info">
          <div className="bt-top">
            <BackLink href="/race" label={t('Back to the race hub', 'Назад в меню гонок', 'Volver al centro de regatas', 'Zurück zum Regatta-Hub', 'Yarış merkezine dön', 'Retour au centre de régate', 'Torna al centro regate', 'Voltar à central de regatas')} />
            <SceneBrand lang={lang} />
          </div>
          <div className="bt-kicks">
            <span className="bt-kick">{kicker}</span>
            {pbNote && res.pb?.isNew ? <span className="bt-kick rs-kick-g">{pbNote}</span> : null}
            {logNote ? <span className="bt-kick rs-kick-s">{logNote}</span> : null}
          </div>
          <h1 className="bt-h">{title}</h1>
          <p className="bt-p">{t(...where.name)}{where.place[0] !== where.name[0] && `, ${t(...where.place)}`}. {near || t('The boats are where they were at the finish.', 'Лодки там, где были на финише.', 'Los barcos están donde estaban en la llegada.', 'Die Boote sind dort, wo sie im Ziel waren.', 'Tekneler bitişte oldukları yerde.', 'Les bateaux sont là où ils étaient à l’arrivée.', 'Le barche sono dov’erano all’arrivo.', 'Os barcos estão onde estavam na chegada.')}</p>
          <div className="bt-stats">
            <div><span className="bt-sk">{t('Place', 'Место', 'Puesto', 'Platz', 'Sıra', 'Place', 'Posizione', 'Colocação')}</span><b>{ended === 'dsq' ? 'DSQ' : ended === 'dnf' ? 'DNF' : ended === 'won' ? t('Won', 'Победа', 'Ganó', 'Gewonnen', 'Kazandı', 'Gagné', 'Vinto', 'Venceu') : t(ordEn(place), `${place}-е`, ordEs(place), ordDe(place), ordTr(place))}</b><span className="bt-sv">{ended === 'dsq' ? t('disqualified', 'дисквалификация', 'descalificado', 'disqualifiziert', 'diskalifiye', 'disqualifié', 'squalificato', 'desclassificado') : ended === 'dnf' ? t('did not finish', 'не финишировал', 'no terminó', 'nicht im Ziel', 'bitirmedi', 'abandon', 'non arrivato', 'não terminou') : ended === 'won' ? t(`${rival} dropped out`, `${rival}: сход`, `${rival} abandonó`, `${rival} ist ausgeschieden`, `${rival} yarıştan çekildi`, `${rival} a abandonné`, `${rival} si è ritirato`, `${rival} abandonou`) : t(`of ${res.boats.length} boats`, `из ${ruBoatsOf(res.boats.length)}`, `de ${res.boats.length} barcos`, `von ${res.boats.length} Booten`, `${res.boats.length} tekne içinde`, `sur ${res.boats.length} bateaux`, `su ${res.boats.length} barche`, `de ${res.boats.length} barcos`)}</span></div>
            <div><span className="bt-sk">{t('Time', 'Время', 'Tiempo', 'Zeit', 'Süre', 'Temps', 'Tempo', 'Tempo')}</span><b className={res.pb?.isNew && !shared ? 'is-gold' : ''}>{me.secs != null && !me.dsq ? <CountUp v={clock(me.secs)} ms={1200} /> : '—'}</b><span className="bt-sv">{pbNote || (one && !me.done ? t('no finish', 'без финиша', 'sin llegada', 'nicht im Ziel', 'bitiş yok', 'pas d’arrivée', 'nessun arrivo', 'sem chegada') : t('at the line', 'на финише', 'en la línea', 'an der Linie', 'hatta', 'sur la ligne', 'sulla linea', 'na linha'))}</span></div>
            <div><span className="bt-sk">{t('Behind', 'Отставание', 'Detrás', 'Zurück', 'Geride', 'Écart', 'Distacco', 'Atrás')}</span><b>{winner && winner !== me && me.secs != null && winner.secs != null ? <CountUp v={`+${gapS(me.secs - winner.secs)}`} /> : '—'}</b><span className="bt-sv">{winner && winner !== me ? t(`${winner.name} won`, `победа: ${winner.name}`, `Ganó ${winner.name}`, `${winner.name} gewann`, `${winner.name} kazandı`, `${winner.name} a gagné`, `Ha vinto ${winner.name}`, `${winner.name} venceu`) : !winner ? t('No winner', 'Без победителя', 'Sin ganador', 'Kein Sieger', 'Kazanan yok', 'Pas de vainqueur', 'Nessun vincitore', 'Sem vencedor') : shared ? t('this boat won', 'эта лодка победила', 'ganó este barco', 'dieses Boot gewann', 'bu tekne kazandı', 'ce bateau a gagné', 'ha vinto questa barca', 'este barco venceu') : t('you won', 'ты победил', 'ganaste', 'du hast gewonnen', 'sen kazandın', 'tu as gagné', 'hai vinto', 'você venceu')}</span></div>
            <div><span className="bt-sk">{t('Penalties', 'Штрафы', 'Penalizaciones', 'Strafen', 'Cezalar', 'Pénalités', 'Penalità', 'Penalidades')}</span><b className={L.penT > 1 ? 'is-down' : 'is-up'}><Num v={L.penT > 1 ? `${L.penT} ${t('s', 'с', 's', 's', 'sn', 's', 's', 's')}` : '0'} /></b><span className="bt-sv">{L.penT > 1 ? t('turning circles', 'штрафные обороты', 'círculos de giro', 'Kreise', 'dönüş daireleri', 'en tours de pénalité', 'giri su sé stessi', 'fazendo giros de penalidade') : t('A clean race', 'Чистая гонка', 'Una regata limpia', 'Eine saubere Regatta', 'Temiz bir yarış', 'Une régate propre', 'Una regata pulita', 'Uma regata limpa')}</span></div>
          </div>
          {firstRace && <FirstFinish lang={lang} id={res.id} signed={!!signedName} place={ended === 'place' || ended === 'won' ? place : null} />}{/* a newcomer's first race: keep it, before anything else */}
          {target ? (
            <div className="rs-target" role="note" title={target.s}>
              <span className="bt-sk">{t('Next target', 'Следующая цель', 'Próximo objetivo', 'Nächstes Ziel', 'Sonraki hedef', 'Prochain objectif', 'Prossimo obiettivo', 'Próximo alvo')}</span>
              <b>{target.v}</b>
              {target.s ? <span className="rs-target-s">{target.s}</span> : null}
            </div>
          ) : null}
          <div className="rs-acts">
            <a className="bt-go" href={cta.href} onClick={() => track(shared ? 'Challenge taken' : 'Race again', { race: one ? 'one-on-one' : res.daily ? 'daily' : 'free', ...(target?.go && { target: 1 }) })}>{shared ? <IconPlay /> : <IconRestart />}<span>{ctaLabel}</span></a>
            {!shared && !one && <ShareButton lang={lang} data={shareData} className="bt-show rs-ghost" title={t('Share your result', 'Поделиться результатом', 'Comparte tu resultado', 'Teile dein Ergebnis', 'Sonucunu paylaş', 'Partage ton résultat', 'Condividi il tuo risultato', 'Compartilhar seu resultado')} />}
            <Link className="bt-show rs-ghost" href="/race">{t('Race hub', 'Меню гонок', 'Centro de regatas', 'Regattazentrale', 'Yarış merkezi', 'Centre de régate', 'Centro regate', 'Central de regatas')}</Link>
            {res.boats.some((b) => b.track?.length > 1) ? <Replay res={res} myLegs={me.legT} lang={lang} /> : null}
          </div>
        </div>

        {/* the full table, as the broadcast's results board */}
        <PauseCard lang={lang} back={`/race/result/${res.id}`} title={t('Results', 'Результаты', 'Resultados', 'Ergebnisse', 'Sonuçlar', 'Résultats', 'Risultati', 'Resultados')} icon={<IconTrophy s={14} />} note={t('Time · gap', 'Время · разрыв', 'Tiempo · diferencia', 'Zeit · Abstand', 'Süre · fark', 'Temps · écart', 'Tempo · distacco', 'Tempo · diferença')}>
          <ol className="hm-lb bt-lb rs-lb">
            {res.boats.map((b, i) => (
              <li key={i} className={`${b.me ? 'me' : ''} ${(one ? b === winner : i === 0 && !b.dsq && !b.dnf) ? 'first' : ''}`}>
                <span className="hm-n">{standing(res, b) === 'place' ? i + 1 : '–'}</span>
                <span className="rs-name"><span className="rs-dot" style={{ background: b.me ? 'var(--you)' : b.color || 'rgba(255,255,255,.4)' }} /><FlagImg code={b.flag} lang={lang} />{b.me ? you : b.name}</span>
                {hasLevels && <Level lv={b.level} t={t} />}
                {hasPens && <span className="rs-pen" title={b.pens ? t('Penalties she got', 'Сколько штрафов получила', 'Penalizaciones que recibió', 'Erhaltene Strafen', 'Aldığı cezalar', 'Pénalités reçues', 'Penalità ricevute', 'Penalidades que recebeu') : undefined}>{b.pens ? t(`${b.pens} pen`, `${b.pens} штр.`, `${b.pens} pen`, `${b.pens} Str.`, `${b.pens} ceza`, `${b.pens} pén.`, `${b.pens} pen.`, `${b.pens} pen.`) : ''}</span>}
                <span className="hm-t">{b.dsq ? 'DSQ' : standing(res, b) === 'dnf' ? 'DNF' : b.secs != null ? clock(b.secs) : '—'}</span>
                <span className="rs-gap">{b.secs != null && winner?.secs != null && b !== winner && !b.dsq ? `+${(b.secs - winner.secs).toFixed(1)}` : ''}</span>
              </li>
            ))}
          </ol>
          {hasLevels && <p className="bt-hint rs-hint">{t('Computer skippers:', 'Компьютерные шкиперы:', 'Patrones del ordenador:', 'Computer-Steuerleute:', 'Bilgisayar kaptanları:', 'Skippers de l’ordinateur :', 'Skipper del computer:', 'Timoneiros do computador:')} <Pips n={1} /> {t('beginner to', 'от новичка до', 'de principiante a', 'Anfänger bis', 'acemiden', 'de débutant à', 'da principiante a', 'de iniciante a')} <Pips n={4} /> {t('expert', 'эксперта', 'experto', 'Experte', 'uzmana', 'expert', 'esperto', 'especialista')}</p>}
          {!one && <p className="bt-hint rs-hint">{res.daily ? t('Today’s race is the one that ranks: everyone sails the same one.', 'В рейтинг идёт гонка дня: у всех она одна.', 'La regata de hoy es la que puntúa: todos navegan la misma.', 'Die Regatta des Tages ist die, die zählt: Alle segeln dieselbe.', 'Sıralamaya giren günün yarışıdır: herkes aynısını yarışır.', 'C’est la régate du jour qui compte au classement : tout le monde court la même.', 'La regata del giorno è quella che conta per la classifica: tutti corrono la stessa.', 'A regata do dia é a que vale para a classificação: todos correm a mesma.') : t('Custom races stay with you; today’s race is the one that ranks.', 'Свои гонки остаются у тебя; в рейтинг идёт гонка дня.', 'Las regatas personalizadas se quedan contigo; la de hoy es la que puntúa.', 'Eigene Regatten bleiben bei dir; die Regatta des Tages ist die, die zählt.', 'Serbest yarışlar sende kalır; sıralamaya giren günün yarışıdır.', 'Les régates libres restent chez toi ; c’est la régate du jour qui compte au classement.', 'Le regate libere restano tue; la regata del giorno è quella che conta per la classifica.', 'As regatas livres ficam com você; a regata do dia é a que vale para a classificação.')}</p>}
          {!shared && one && typeof res.duel?.code === 'string' && Number.isInteger(res.duel.seed) && <DuelRating duel={res.duel} lang={lang} />}{/* what your 1-on-1 race did to your rating */}
          {!shared && !one && Date.now() - res.at < 864e5 && <RateRace id={res.id} lang={lang} />}{/* how was it: your own race, just sailed */}
        </PauseCard>
        <a className="rs-down" href="#debrief" aria-label={t('The debrief', 'Разбор', 'El análisis', 'Die Nachbesprechung', 'Değerlendirme', 'Le débriefing', 'Il debriefing', 'A análise')}><span>{t('The debrief', 'Разбор', 'El análisis', 'Die Nachbesprechung', 'Değerlendirme', 'Le débriefing', 'Il debriefing', 'A análise')}</span><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" /></svg></a>
      </div>

      <div className="rs-more">
        <section className="rs-row" id="debrief">
          <div className="rs-col rs-wide">
            <span className="rs-kick">{t('Debrief', 'Разбор', 'Análisis', 'Nachbesprechung', 'Değerlendirme', 'Débriefing', 'Debriefing', 'Análise')}</span>
            <h2 className="rs-h2">{t('Where the time went', 'Куда ушло время', 'Dónde se fue el tiempo', 'Wo die Zeit blieb', 'Zaman nereye gitti', 'Où le temps s’est perdu', 'Dove è finito il tempo', 'Para onde foi o tempo')}</h2>
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
                      {dl && <a className="rs-rule-a" href={dl.href}>{dl.open ? t(`Practise it: the “${dl.name[0].replace(/^The /, "")}” drill, ${dl.min} min`, `Потренируйся: «${dl.name[1]}», ${dl.min} мин`, `Practícalo: ${dl.name[2] ?? dl.name[0]}, ${dl.min} min`, `Üb es: die Übung „${(dl.name[3] ?? dl.name[0]).replace(/^The /, "")}“, ${dl.min} min`, `Çalış: “${(dl.name[4] ?? dl.name[0]).replace(/^The /, "")}” alıştırması, ${dl.min} dk`, `Entraîne-toi : l’entraînement « ${dl.name[0].replace(/^The /, "")} », ${dl.min} min`, `Esercitati: l’esercizio «${dl.name[0].replace(/^The /, "")}», ${dl.min} min`, `Pratique: o treino “${(dl.name[7] ?? dl.name[0])}”, ${dl.min} min`) : t('Practise it in the drills', 'Потренируйся в тренировках', 'Practícalo en los ejercicios', 'Üb es in den Übungen', 'Alıştırmalarda çalış', 'Entraîne-toi dans les entraînements', 'Esercitati negli esercizi', 'Pratique nos treinos')}</a>}</span>
                  </li>
                );
              })}
            </ul>
            {foulRules.map((f) => (
              <div key={f.rule} className="rs-rule">
                <span className="rs-rule-k">{t(`Rule ${f.rule}`, `Правило ${f.rule}`, `Regla ${f.rule}`, `Regel ${f.rule}`, `Kural ${f.rule}`, `Règle ${f.rule}`, `Regola ${f.rule}`, `Regra ${f.rule}`)}{f.t != null ? ` · ${clock(Math.max(0, f.t))}` : ''}{f.who ? ` · ${f.who}` : ''}</span>
                <b>{rule('r' + f.rule, lang)}</b>
                <span className="rs-db-tip">{rule('x' + f.rule, lang)}</span>
                {RULE_LINK[f.rule] && <a className="rs-rule-a" href={`https://iyt.rycrentals.com${lang === 'ru' ? '/ru' : ''}/racing-rules/${RULE_LINK[f.rule]}`}>{t('Read the rule', 'Прочитать правило', 'Leer la regla', 'Regel lesen', 'Kuralı oku', 'Lire la règle', 'Leggi la regola', 'Ler a regra')}</a>}
              </div>
            ))}
          </div>
          <div className="rs-col">
            <span className="rs-kick">{shared ? t('The track', 'Трек', 'La trayectoria', 'Die Spur', 'İz', 'La trace', 'La traccia', 'A trajetória') : t('Your track', 'Твой трек', 'Tu trayectoria', 'Deine Spur', 'Senin izin', 'Ta trace', 'La tua traccia', 'Sua trajetória')}</span>
            <h2 className="rs-h2">{t('Leg by leg', 'По отрезкам', 'Tramo a tramo', 'Schenkel für Schenkel', 'Ayak ayak', 'Bord par bord', 'Lato per lato', 'Perna a perna')}</h2>
            <div className="rs-card rs-pad">
              <CourseMap className="cmap rs-track" lang={lang} geo={res.course} preset={res.preset} W={320} H={320} tracks={tracks} fouls={fouls} />
              <div className="rs-key"><span className="is-you">— {shared ? t('this boat', 'эта лодка', 'este barco', 'dieses Boot', 'bu tekne', 'ce bateau', 'questa barca', 'este barco') : t('you', 'ты', 'tú', 'du', 'sen', 'toi', 'tu', 'você')}</span><span>— {t('fleet', 'соперники', 'flota', 'Feld', 'filo', 'flotte', 'flotta', 'flotilha')}</span>
                <span>{t('Course', 'Дистанция', 'Recorrido', 'Bahn', 'Parkur', 'Parcours', 'Percorso', 'Percurso')} {fmtDistance(courseDistance(res.course, res.laps), lang)}</span>{L.fouls.length ? <span>{t('red rings mark the fouls', 'красные кольца — нарушения', 'los aros rojos marcan las infracciones', 'rote Ringe markieren die Fouls', 'kırmızı halkalar faulleri gösterir', 'les cercles rouges marquent les fautes', 'gli anelli rossi segnano le infrazioni', 'os círculos vermelhos marcam as infrações')}</span> : null}</div>
            </div>
            {!!legs.length && (
              <ol className="rs-card rs-legs">
                {/* the game logs the clock as you pass each mark; the finish is your finishing time and place */}
                {legs.map((x, i) => (
                  <li key={i}>
                    <span className="rs-leg-n">{legName(x.k)}</span>
                    <span className="rs-leg-d">{legM[x.i] ? `${Math.round(legM[x.i])} ${t('m', 'м', 'm', 'm', 'm', 'm', 'm', 'm')}` : ''}</span>
                    <span className="rs-leg-t">{clock(Math.max(0, x.tm))}</span>
                    <span className="rs-leg-p">{x.pl ? t(`${ordEn(x.pl)} of ${res.boats.length}`, `${x.pl}-й из ${res.boats.length}`, `${ordEs(x.pl)} de ${res.boats.length}`, `${ordDe(x.pl)} von ${res.boats.length}`, `${res.boats.length} içinde ${ordTr(x.pl)}`, `${x.pl}${x.pl === 1 ? 'er' : 'e'} sur ${res.boats.length}`, `${x.pl}º su ${res.boats.length}`, `${x.pl}º de ${res.boats.length}`) : ''}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <section className="rs-row">
          {res.daily ? (
            <div className="rs-col rs-wide">
              <span className="rs-kick">{t('Today’s race', 'Гонка дня', 'La regata del día', 'Regatta des Tages', 'Günün yarışı', 'La régate du jour', 'La regata del giorno', 'A regata do dia')}</span>
              <h2 className="rs-h2">{t('Today’s fastest', 'Самые быстрые сегодня', 'Los más rápidos de hoy', 'Die Schnellsten von heute', 'Günün en hızlıları', 'Les plus rapides du jour', 'I più veloci di oggi', 'Os mais rápidos de hoje')}</h2>
              <Ranking t={t} lang={lang} top={top} field={field} id={res.id} daily={!!res.daily} me={me} signedName={shared ? null : signedName} you={shared ? you : null} />
            </div>
          ) : null}
          {!shared && !one && (
            <div className="rs-col">
              <span className="rs-kick">{t('Your best', 'Твой рекорд', 'Tu mejor marca', 'Deine Bestzeit', 'En iyin', 'Ton meilleur', 'Il tuo record', 'Seu melhor')}</span>
              <h2 className="rs-h2">{t('On this course', 'На этой дистанции', 'En este recorrido', 'Auf dieser Bahn', 'Bu parkurda', 'Sur ce parcours', 'Su questo percorso', 'Neste percurso')}</h2>
              <div className="bt-stats rs-best">
                <div><span className="bt-sk">{res.daily ? t('Your best today', 'Твой лучший сегодня', 'Tu mejor de hoy', 'Deine Bestzeit heute', 'Bugünkü en iyin', 'Ton meilleur du jour', 'Il tuo record di oggi', 'Seu melhor hoje') : t('Your best', 'Твой лучший', 'Tu mejor marca', 'Deine Bestzeit', 'En iyin', 'Ton meilleur', 'Il tuo record', 'Seu melhor')}</span><b className="is-gold">{res.pb ? clock(res.pb.best) : '—'}</b><span className="bt-sv">{res.pb?.isNew ? t('New personal best', 'Новый личный рекорд', 'Nueva mejor marca personal', 'Neue persönliche Bestzeit', 'Yeni kişisel rekor', 'Nouveau record personnel', 'Nuovo record personale', 'Novo recorde pessoal') : t('kept on this device', 'хранится на этом устройстве', 'guardada en este dispositivo', 'auf diesem Gerät gespeichert', 'bu cihazda saklı', 'gardé sur cet appareil', 'conservato su questo dispositivo', 'guardado neste aparelho')}</span></div>
                {prev != null && res.pb
                  ? <div><span className="bt-sk">{res.daily ? t('Earlier today', 'Раньше сегодня', 'Antes, hoy', 'Heute zuvor', 'Bugün daha önce', 'Plus tôt aujourd’hui', 'Prima, oggi', 'Mais cedo hoje') : t('Before this race', 'До этой гонки', 'Antes de esta regata', 'Vor dieser Regatta', 'Bu yarıştan önce', 'Avant cette régate', 'Prima di questa regata', 'Antes desta regata')}</span><b>{clock(prev)}</b><span className="bt-sv"><span className="is-up">−{gapS(prev - res.pb.best)}</span></span></div>
                  : <div><span className="bt-sk">{t('This race', 'Эта гонка', 'Esta regata', 'Diese Regatta', 'Bu yarış', 'Cette régate', 'Questa regata', 'Esta regata')}</span><b>{me.secs != null && !me.dsq ? clock(me.secs) : '—'}</b><span className="bt-sv">{res.pb && me.secs != null && !me.dsq && me.secs > res.pb.best ? `+${gapS(me.secs - res.pb.best)}` : t('at the line', 'на финише', 'en la línea', 'an der Linie', 'hatta', 'sur la ligne', 'sulla linea', 'na linha')}</span></div>}
              </div>
              <div className="rs-card rs-pad rs-share">
                <span className="bt-k">{t('Share this race', 'Поделиться гонкой', 'Comparte esta regata', 'Diese Regatta teilen', 'Bu yarışı paylaş', 'Partager cette régate', 'Condividi questa regata', 'Compartilhar esta regata')}</span>
                <p className="rs-ps">“{shareText()}” {t('A result link opens on any device, as this boat’s result.', 'Ссылка открывается на любом устройстве — как результат этой лодки.', 'Un enlace de resultado se abre en cualquier dispositivo, como el resultado de este barco.', 'Ein Ergebnis-Link öffnet sich auf jedem Gerät, als Ergebnis dieses Bootes.', 'Bir sonuç bağlantısı, bu teknenin sonucu olarak her cihazda açılır.', 'Un lien de résultat s’ouvre sur n’importe quel appareil, comme le résultat de ce bateau.', 'Un link al risultato si apre su qualsiasi dispositivo, come risultato di questa barca.', 'Um link de resultado abre em qualquer aparelho, como o resultado deste barco.')}</p>
                <div className="rs-share-b">
                  <CopyLink lang={lang} data={shareData} className="bt-show rs-ghost" />
                  <ShareButton lang={lang} data={shareData} className="bt-show rs-ghost" title={t('Share your result', 'Поделиться результатом', 'Comparte tu resultado', 'Teile dein Ergebnis', 'Sonucunu paylaş', 'Partage ton résultat', 'Condividi il tuo risultato', 'Compartilhar seu resultado')} />
                </div>
              </div>
            </div>
          )}
        </section>

        <nav className="rs-card rs-next" aria-label={t('Where next', 'Куда дальше', 'Siguiente', 'Wohin als Nächstes', 'Sıradaki', 'Et ensuite', 'Dove andare', 'Próximo destino')}>
          <a className="bt-row" href={again}><IconRestart s={18} /><span>{one ? t('Another 1-on-1 race', 'Ещё одна гонка 1 на 1', 'Otra regata 1 contra 1', 'Noch eine 1-gegen-1-Regatta', 'Bir bire bir yarış daha', 'Un autre duel', 'Un altro duello', 'Outro duelo 1 contra 1') : res.daily ? t('Today’s race again', 'Гонка дня ещё раз', 'La regata de hoy otra vez', 'Die Regatta des Tages nochmal', 'Yine günün yarışı', 'Encore la régate du jour', 'Di nuovo la regata del giorno', 'A regata do dia de novo') : t('The same race again', 'Эту же гонку ещё раз', 'La misma regata otra vez', 'Dieselbe Regatta nochmal', 'Yine aynı yarış', 'La même régate encore', 'Di nuovo la stessa regata', 'A mesma regata de novo')}</span></a>
          {!one && <Link className="bt-row" href={res.daily ? '/race/free?from=today' : '/race/free'}><IconSliders /><span>{res.daily ? t('A custom race in these conditions', 'Своя гонка в этих условиях', 'Una regata personalizada en estas condiciones', 'Eine eigene Regatta unter diesen Bedingungen', 'Bu koşullarda bir serbest yarış', 'Une régate libre dans ces conditions', 'Una regata libera in queste condizioni', 'Uma regata livre nestas condições') : t('Custom race', 'Своя гонка', 'Regata personalizada', 'Freie Regatta', 'Serbest yarış', 'Régate libre', 'Regata libera', 'Regata livre')}</span><span className="bt-row-m">{t('Set it up', 'Настроить', 'Prepararla', 'Einrichten', 'Kur', 'La préparer', 'Preparala', 'Montar')}</span></Link>}
          <Link className="bt-row" href="/race"><IconFlag s={18} /><span>{t('Race hub', 'Меню гонок', 'Centro de regatas', 'Regattazentrale', 'Yarış merkezi', 'Centre de régate', 'Centro regate', 'Central de regatas')}</span></Link>
          <Link className="bt-row" href="/boat"><IconSail s={18} /><span>{t('Your yacht', 'Твоя яхта', 'Tu yate', 'Deine Yacht', 'Yatın', 'Ton yacht', 'Il tuo yacht', 'Seu veleiro')}</span></Link>
        </nav>
      </div>
    </div>
  );
}

// you: how a shared result names its boat; then there's no asking to sign in, as it isn't the viewer's race
function Ranking({ t, lang, top, field, id, daily, me, signedName, you }: { t: (en: string, ru: string, es?: string, de?: string, tr?: string, fr?: string, it?: string, pt?: string) => string; lang: Lang; top: Top[] | null; field: number[] | null; id: string; daily: boolean; me: Boat; signedName: string | null; you: string | null }) {
  // where this time stands in the day's field: signed in, it's on it; a guest's would be, if they signed in
  const mine = me.secs != null && !me.dsq ? me.secs : null;
  const listed = mine != null && !!field && field.some((s) => Math.abs(s - mine) < 0.05);
  const place = mine != null && field ? field.filter((s) => s < mine - 0.05).length + 1 : 0, of = field ? field.length + (listed ? 0 : 1) : 0;
  const ordP = lang === 'ru' ? `${place}-е` : lang === 'es' ? `${place}.º` : lang === 'pt' ? `${place}º` : lang === 'it' ? `${place}º` : lang === 'fr' ? (place === 1 ? '1er' : `${place}e`) : lang === 'de' || lang === 'tr' ? `${place}.` : `${place}${['th', 'st', 'nd', 'rd'][(place % 100 > 10 && place % 100 < 14) || place % 10 > 3 ? 0 : place % 10]}`;
  const standing = !place ? '' : signedName && !you && listed ? t(`${ordP} of ${of} today`, `${ordP} место из ${of} сегодня`, `${ordP} de ${of} hoy`, `${ordP} von ${of} heute`, `Bugün ${of} içinde ${ordP}`, `${ordP} sur ${of} aujourd’hui`, `${ordP} su ${of} oggi`, `${ordP} de ${of} hoje`)
    : !you && !signedName ? t(`${clock(mine!)} would be ${ordP} of ${of} today`, `${clock(mine!)} — это ${ordP} место из ${of} сегодня`, `${clock(mine!)} sería ${ordP} de ${of} hoy`, `${clock(mine!)} wäre heute ${ordP} von ${of}`, `${clock(mine!)} bugün ${of} içinde ${ordP} olurdu`, `${clock(mine!)} serait ${ordP} sur ${of} aujourd’hui`, `${clock(mine!)} sarebbe ${ordP} su ${of} oggi`, `${clock(mine!)} seria ${ordP} de ${of} hoje`) : '';
  return (
    <div className="rs-card rs-rank">
      {standing && <p className="rs-standing"><b>{standing}</b></p>}
      <ol className="hm-lb bt-lb">
        {(top || []).map((r, i) => <li key={i} className={i === 0 ? 'first' : ''}><span className="hm-n">{i + 1}</span><Who fl={r.fl} name={r.name || t('No name', 'Без имени', 'Sin nombre', 'Kein Name', 'Adsız', 'Sans nom', 'Senza nome', 'Sem nome')} lang={lang} /><span className="hm-t">{clock(r.s)}</span></li>)}
        {top === null && daily && [0, 1, 2, 3, 4].map((i) => <li key={i} className="sk-li" aria-hidden="true"><Sk w={20} h={14} /><Sk w="60%" h={14} /><Sk w={48} h={14} /></li>)}
        {top && !top.length && <li><span className="hm-n">·</span><span className="hm-muted">{t('No times yet today', 'Сегодня ещё нет результатов', 'Aún no hay tiempos hoy', 'Heute noch keine Zeiten', 'Bugün henüz süre yok', 'Pas encore de temps aujourd’hui', 'Ancora nessun tempo oggi', 'Ainda não há tempos hoje')}</span><span /></li>}
        <li className="me"><span className="hm-n">{listed ? place : '·'}</span><Who fl={me.flag} name={you || (signedName ? `${signedName} (${t('you', 'ты', 'tú', 'du', 'sen', 'toi', 'tu', 'você')})` : t('You', 'Ты', 'Tú', 'Du', 'Sen', 'Toi', 'Tu', 'Você'))} lang={lang} /><span className="hm-t">{me.secs != null && !me.dsq ? clock(me.secs) : '—'}</span></li>
      </ol>
      {daily && <Link className="lb-more" href="/race/rating">{t('Full rating and the month’s points', 'Весь рейтинг и очки за месяц', 'Clasificación completa y puntos del mes', 'Gesamtrangliste und Punkte des Monats', 'Tam sıralama ve ayın puanları', 'Classement complet et points du mois', 'Classifica completa e punti del mese', 'Classificação completa e os pontos do mês')}</Link>}
      {!signedName && !you && (
        <div className="rs-sign">
          <span className="rs-ps"><b>{t('Not on the ranking', 'Не в рейтинге', 'Fuera de la clasificación', 'Nicht in der Rangliste', 'Sıralamada değil', 'Pas au classement', 'Non in classifica', 'Fora da classificação')}</b> · {t('sign in and your times go on it.', 'войди — и время попадёт в рейтинг.', 'inicia sesión y tus tiempos entrarán.', 'Melde dich an, dann kommen deine Zeiten hinein.', 'giriş yap, sürelerin oraya girsin.', 'connecte-toi et tes temps y entreront.', 'accedi e i tuoi tempi ci entrano.', 'entre e seus tempos passam a contar.')}</span>
          <Link className="bt-mini bt-mini-on" href={`/sign-in?next=${encodeURIComponent(`/race/result/${id}`)}`}>{t('Sign in', 'Войти', 'Iniciar sesión', 'Anmelden', 'Giriş yap', 'Se connecter', 'Accedi', 'Entrar')}</Link>
        </div>
      )}
    </div>
  );
}
