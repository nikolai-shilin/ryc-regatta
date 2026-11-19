'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { tx, type Lang } from '@/lib/lang';
import { DAYTIMES, readOpts, readPb, saveOpts, type Daytime } from '@/lib/opts';
import type { VenueId } from '@/lib/venues';
import { YACHTS, isYacht, yachtOf, type YachtId } from '@/lib/yachts';
import { lengthOffered, shapeOffered, venueOf, VENUES } from '@/lib/venues';
import { courseDistance, dailyRace, fmtDistance, pbKey, plannedCourse, raceMinutes, savedShape, KN, SHAPE_NAME, SHAPES, type Length, type Shape, type Wind } from '@/lib/race';
import { CourseMap } from './course-map';
import { GameScene, type SceneSetup } from './game-scene';
import { PauseCard } from './pause-card';
import { BackLink } from './back-link';
import { IconPin, IconPlay, IconWind, IconBoats, IconRoute, IconLaps, IconFlag, IconTide, IconSail, IconSun, Num, clock } from './ui';
import { SceneBrand } from './scene-brand';
import { newCode } from '@/lib/code';
import { useLog } from './passport';

// the way round each shape but up and down, under its choice
const SHAPE_HINT: Partial<Record<Shape, [en: string, ru: string, es?: string, de?: string, tr?: string]>> = {
  tri: ['Up to the windward mark, a tight reach out to the wing mark, a gybe there and a broad reach back.', 'Вверх к верхнему знаку, галфвинд к боковому знаку, там поворот фордевинд и бакштаг обратно.', 'Hasta la baliza de barlovento, un través cerrado hasta la baliza de través, una trasluchada allí y un largo de vuelta.', 'Hoch zur Luvtonne, ein hoher Halbwindkurs zur Raumtonne, dort eine Halse und ein Raumschotskurs zurück.', 'Rüzgârüstü şamandırasına orsa, kanat şamandırasına dar apaz, orada kavança ve geniş apazla geri.'],
  trap: ['Up to mark 1, a broad reach out to mark 2, a run down to the gate, and a beam reach home to a finish line of its own.', 'Вверх к знаку 1, бакштаг к знаку 2, фордевинд к воротам и галфвинд к своей финишной линии.', 'Hasta la baliza 1, un largo hasta la baliza 2, una empopada hasta la puerta y un través de vuelta a una línea de llegada propia.', 'Hoch zu Marke 1, ein weiter Raumschotskurs zu Marke 2, ein Vorwindkurs hinunter zum Tor und ein Halbwindkurs heim zu einer eigenen Ziellinie.', 'Şamandıra 1’e orsa, şamandıra 2’ye geniş apaz, kapıya pupa ve kendi bitiş hattına tam apazla eve.'],
  wlu: ['Up to the windward mark, a short reach to the offset mark, a run down through the gate, and a last beat up to a finish line below the windward mark.', 'Вверх к верхнему знаку, короткий галфвинд к отбойнику, фордевинд через ворота и последняя лавировка к финишу чуть ниже верхнего знака.', 'Hasta la baliza de barlovento, un través corto hasta la baliza de desmarque, una empopada por la puerta y una última ceñida hasta una línea de llegada bajo la baliza de barlovento.', 'Hoch zur Luvtonne, ein kurzer Raumschotskurs zur Ablauftonne, ein Vorwindkurs hinunter durchs Tor und ein letztes Kreuz hinauf zu einer Ziellinie unterhalb der Luvtonne.', 'Rüzgârüstü şamandırasına orsa, ofset şamandırasına kısa apaz, kapıdan pupa ve rüzgârüstü şamandırasının altındaki bir bitiş hattına son bir orsa ayağı.'],
};

type Pick = { venue: VenueId; yacht: YachtId; preset: Wind; fleet: number; length: Length; laps: number; start: number; current: number; course: Shape; daytime: Daytime; contact: 'turn' | 'dsq' };

// a rough guide to the race's length on the water, so a choice shows its effect (lib/race.ts), at the yacht's own pace
const minutes = (p: Pick) => raceMinutes({ ...p, timeK: yachtOf(p.yacht).timeK });
// what the scene shows as each choice is made: the fleet, the wind or the current over the course, or the course
type View = SceneSetup['view'];
const VIEW_OF: Record<keyof Pick, View> = { venue: 'boats', yacht: 'boats', fleet: 'boats', start: 'boats', preset: 'wind', current: 'current', course: 'course', length: 'course', laps: 'course', daytime: 'boats', contact: 'boats' };
// the breeze as the game blows it (sim.js PRESETS): its gusts' top and how far it swings either way
const GUST: Record<Wind, [number, number]> = { light: [9, 12], medium: [16, 13], strong: [26, 14] };

// S1 · Free race set-up, as the boat page: the game's own scene at the chosen venue behind it all (your yacht afloat there
// on a clear evening, /boat-view), the race's place and numbers over it as the pause screen has them, and the choices
// in the pause menu's dark glass card. Picking another place loads that venue's scene and fades it in over the last.
// The scene is the race as it will be laid, all its boats afloat together; each choice flies the drone to where it shows
// (the wind or the current over the course, the course itself), and Show course does too. Start and Show course stay at
// the card's top, your boat and Settings at its bottom. Start saves the choice where the game reads it and opens the race.
// from: 'today' (today's race, as a free race), 'race' (the free race you were sailing; the game's Change the race), or none
// match: the 1-on-1 race's set-up (/match/new): everything a free race offers but the number of boats, opening with today's
// settings, and the button makes the race: a code, saved here as the host's, and the game opens at it.
export default function FreeSetup({ lang, from, match }: { lang: Lang; from: 'today' | 'race' | null; match?: boolean }) {
  const fromToday = from === 'today';
  const t = tx(lang);
  const [p, setP] = useState<Pick>({ venue: 'gocek', yacht: 'jpk1050', preset: 'medium', fleet: 5, length: 'short', laps: 1, start: 1, current: 0, course: 'wl', daytime: 'any', contact: 'turn' });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const o = readOpts();
    const d = dailyRace();
    const venue = venueOf(o.venue).id, daytime = DAYTIMES.includes(o.daytime) ? o.daytime : 'any';
    // a yacht asked for in the address (the yachts page's Race her), else the one last raced
    const asked = new URLSearchParams(location.search).get('yacht'), yacht = isYacht(asked) ? asked : isYacht(o.yacht) ? o.yacht : 'jpk1050';
    const start: Pick = fromToday || match ? { venue: d.venue, yacht: d.yacht, preset: d.preset, fleet: d.fleet, length: d.length, laps: d.laps, start: d.start, current: d.current, course: d.course, daytime, contact: 'turn' }
      : { venue, yacht, preset: o.preset, fleet: o.fleet, length: o.length, laps: o.laps, start: o.start, current: o.current, course: savedShape(o.course), daytime, contact: o.contact === 'dsq' ? 'dsq' : 'turn' };
    setP(start); if (from) setBase(start);
    setNear([d.venue, venue]);
    setReady(true);
  }, [from, match]); // eslint-disable-line react-hooks/exhaustive-deps
  // today's venue and the one you sailed last: the first of the places offered, before the rest A to Z
  const [near, setNear] = useState<VenueId[]>([]);
  const [allPlaces, setAllPlaces] = useState(false);
  // the race this page was opened from, to mark what's changed from it
  const [base, setBase] = useState<Pick | null>(null);
  const changed = base ? (Object.keys(base) as (keyof Pick)[]).filter((k) => base[k] !== p[k]) : [];
  const [view, setView] = useState<View>('boats');
  const set = <K extends keyof Pick>(k: K, v: Pick[K]) => { setP((x) => ({ ...x, [k]: v })); setView(VIEW_OF[k]); };
  // the shapes this venue has room for at this length; one it hasn't goes back to up and down (the drone stays put)
  const shapes = SHAPES.filter((s) => shapeOffered(p.venue, s, p.length));
  useEffect(() => { if (!shapeOffered(p.venue, p.course, p.length)) setP((x) => ({ ...x, course: 'wl' })); }, [p.venue, p.course, p.length]);
  // and the lengths it has room for: one it hasn't goes down to the longest it has
  useEffect(() => { if (!lengthOffered(p.venue, p.length)) setP((x) => ({ ...x, length: lengthOffered(x.venue, 'medium') ? 'medium' : 'short' })); }, [p.venue, p.length]);
  const go = () => {
    if (match) {
      const code = newCode();
      try {
        localStorage.setItem('regatta-match-host', JSON.stringify({ code }));
        localStorage.setItem('regatta-match-settings', JSON.stringify({ venue: p.venue, yacht: p.yacht, preset: p.preset, length: p.length, course: p.course, laps: p.laps, start: p.start, current: p.current, daytime: p.daytime }));
      } catch { /* storage blocked: the game still opens at the code */ }
      location.href = `/play?match=${code}&venue=${p.venue}&boat=${p.yacht}`;
      return;
    }
    saveOpts({ ...p, mode: 'free', lastFree: Date.now() }); location.href = '/play?race=free';
  };

  // a blue dot on a choice changed from the race this page was opened from
  const chg = (k: keyof Pick) => changed.includes(k) ? <i className="bt-chg" title={t('Changed', 'Изменено', 'Cambiado', 'Geändert', 'Değişti')}><span className="vh">{t('changed', 'изменено', 'cambiado', 'geändert', 'değişti')}</span></i> : null;
  // one choice as the pause menu's quick switches: a label, then pills with a light that's on
  const tags = <K extends keyof Pick>(k: K, ico: React.ReactNode, label: string, opts: [Pick[K], string][], hint?: React.ReactNode) => (
    <div className="bt-g">
      <span className="bt-k" id={`fs-${k}`}>{ico}{label}{chg(k)}</span>
      <div className="bt-pills" role="radiogroup" aria-labelledby={`fs-${k}`}>
        {opts.map(([v, l]) => (
          <button key={String(v)} type="button" role="radio" aria-checked={p[k] === v} className="bt-pill" onClick={() => set(k, v)}>{l}</button>
        ))}
      </div>
      {hint}
    </div>
  );
  const log = useLog();
  const [pb, setPb] = useState<Record<string, number>>({});
  useEffect(() => { setPb(readPb()); }, []);
  const best = pb[pbKey(p)];
  const boat = yachtOf(p.yacht);
  const geo = plannedCourse(p.preset, p.length, p.fleet, p.course, boat);
  const where = venueOf(p.venue);
  const courseName = { short: t('Short', 'Короткая', 'Corta', 'Kurz', 'Kısa'), medium: t('Medium', 'Средняя', 'Media', 'Mittel', 'Orta'), long: t('Long', 'Длинная', 'Larga', 'Lang', 'Uzun') }[p.length];
  const metres = fmtDistance(courseDistance(geo, p.laps), lang).split(' · ')[0];
  const shapeName = t(...SHAPE_NAME[p.course]);
  const lapsName = `${p.laps} ${t(p.laps > 1 ? 'laps' : 'lap', p.laps > 1 ? 'круга' : 'круг', p.laps > 1 ? 'vueltas' : 'vuelta', p.laps > 1 ? 'Runden' : 'Runde', 'tur')}`;
  const beat = Math.round(Math.abs(geo.windward[1]));
  const scene: SceneSetup = {
    race: { preset: p.preset, fleet: p.fleet, length: p.length, laps: p.laps, course: p.course, current: p.current, start: p.start, daytime: p.daytime },
    view,
    // the marks' names (on a trapezoid the windward mark is mark 1), and the start line's: the finish too, unless the
    // shape has a finish line of its own
    labels: { windward: p.course === 'trap' ? t('Mark 1', 'Знак 1', 'Baliza 1', 'Marke 1', 'Şamandıra 1') : t('Windward mark', 'Верхний знак', 'Baliza de barlovento', 'Luvtonne', 'Rüzgârüstü şamandırası'), gate: t('Gate', 'Ворота', 'Puerta', 'Tor', 'Kapı'), wing: t('Wing mark', 'Боковой знак', 'Baliza de través', 'Raumtonne', 'Kanat şamandırası'),
      mark2: t('Mark 2', 'Знак 2', 'Baliza 2', 'Marke 2', 'Şamandıra 2'), offset: t('Offset mark', 'Отбойник', 'Baliza de desmarque', 'Ablauftonne', 'Ofset şamandırası'), finish: t('Finish', 'Финиш', 'Llegada', 'Ziel', 'Bitiş'),
      line: geo.finish ? t('Start', 'Старт', 'Salida', 'Start', 'Start') : t('Start · Finish', 'Старт · Финиш', 'Salida · Llegada', 'Start · Ziel', 'Start · Bitiş'), beat: t(`Beat ${beat} m`, `Лавировка ${beat} м`, `Ceñida ${beat} m`, `Kreuz ${beat} m`, `Orsa ${beat} m`) },
  };
  // a word on what the scene shows, when it shows more than the boats
  const cap: Record<Exclude<View, 'boats'>, [en: string, ru: string, es?: string, de?: string, tr?: string]> = {
    wind: [t(`Wind · ${KN[p.preset]} kn`, `Ветер · ${KN[p.preset]} уз`, `Viento · ${KN[p.preset]} kn`, `Wind · ${KN[p.preset]} kn`, `Rüzgâr · ${KN[p.preset]} kn`),
      t(`The streaks run with the breeze down the course. The gold ones are gusts, up to ${GUST[p.preset][0]} kn; the wind swings up to ${GUST[p.preset][1]}° either way.`,
        `Штрихи бегут с ветром вниз по дистанции. Золотые — порывы, до ${GUST[p.preset][0]} уз; ветер гуляет до ${GUST[p.preset][1]}° в каждую сторону.`, `Las rayas corren con la brisa por el recorrido. Las doradas son rachas, de hasta ${GUST[p.preset][0]} kn; el viento rola hasta ${GUST[p.preset][1]}° a cada lado.`, `Die Streifen laufen mit der Brise die Bahn hinunter. Die goldenen sind Böen, bis ${GUST[p.preset][0]} kn; der Wind dreht bis ${GUST[p.preset][1]}° nach beiden Seiten.`, `Çizgiler meltemle birlikte parkur boyunca akar. Altın renkliler hamlelerdir, en çok ${GUST[p.preset][0]} kn; rüzgâr her iki yana en çok ${GUST[p.preset][1]}° döner.`)],
    current: p.current || where.runs
      ? [t('Current · the venue’s own', 'Течение · местное', 'Corriente · la propia de la sede', 'Strömung · die des Reviers', 'Akıntı · yarış alanına özgü'), t('The water runs as it does there: the tide along the channel, a river downstream, or, where the sea has no tide, the wind’s light drift. Harder in places, and it builds and eases as you race.', 'Вода идёт так, как там на самом деле: приливное течение вдоль пролива, река вниз по течению, а где прилива нет — лёгкий дрейф по ветру. Где-то сильнее, и то крепчает, то слабеет по ходу гонки.', 'El agua corre como allí: la marea por el canal, un río aguas abajo o, donde el mar no tiene marea, la suave deriva del viento. Más fuerte en algunos puntos, y crece y cede mientras regateas.', 'Das Wasser fließt dort, wie es eben fließt: die Gezeiten entlang der Rinne, ein Fluss flussabwärts oder, wo das Meer keine Gezeiten hat, die leichte Drift des Windes. Stellenweise stärker, und sie baut sich auf und lässt nach, während du segelst.', 'Su oradaki gibi akar: kanal boyunca gelgit, aşağı akan bir nehir ya da gelgitsiz bir denizde rüzgârın hafif sürüklemesi. Yer yer daha sert, yarışırken güçlenir ve zayıflar.')]
      : [t('No current', 'Без течения', 'Sin corriente', 'Keine Strömung', 'Akıntı yok'), t('The water stands still. Switch the current on to see the tide run over the course.', 'Вода стоит. Включи течение — и увидишь, как оно идёт по дистанции.', 'El agua está quieta. Activa la corriente para ver correr la marea por el recorrido.', 'Das Wasser steht still. Schalte die Strömung ein, um die Gezeiten über die Bahn laufen zu sehen.', 'Su durgun. Gelgitin parkurda aktığını görmek için akıntıyı aç.')],
    course: [`${shapeName} · ${lapsName} · ${metres}`, {
      wl: `${t('From the start up to the windward mark and down to the gate', 'От старта вверх к верхнему знаку и вниз к воротам', 'Desde la salida hasta la baliza de barlovento y bajando hasta la puerta', 'Vom Start hoch zur Luvtonne und hinunter zum Tor', 'Starttan rüzgârüstü şamandırasına, oradan aşağı kapıya')}${p.laps > 1 ? t(', then round again; lap 1 in gold, lap 2 in blue.', ', потом ещё круг; первый круг золотой, второй синий.', ', luego otra vuelta; vuelta 1 en dorado, vuelta 2 en azul.', ', dann noch eine Runde; Runde 1 in Gold, Runde 2 in Blau.', ', sonra yine tur; 1. tur altın, 2. tur mavi.') : t(', then down to the finish.', ', потом вниз на финиш.', ', luego hasta la llegada.', ', dann hinunter ins Ziel.', ', sonra bitişe iniş.')}`,
      tri: `${t('From the start up to the windward mark, a reach out to the wing mark and back down to the gate', 'От старта вверх к верхнему знаку, галфвинд к боковому знаку и вниз к воротам', 'Desde la salida hasta la baliza de barlovento, un través hasta la baliza de través y de vuelta a la puerta', 'Vom Start hoch zur Luvtonne, ein Raumschotskurs zur Raumtonne und zurück hinunter zum Tor', 'Starttan rüzgârüstü şamandırasına, kanat şamandırasına apaz ve oradan kapıya geri')}${p.laps > 1 ? t(', then round again; lap 1 in gold, lap 2 in blue.', ', потом ещё круг; первый круг золотой, второй синий.', ', luego otra vuelta; vuelta 1 en dorado, vuelta 2 en azul.', ', dann noch eine Runde; Runde 1 in Gold, Runde 2 in Blau.', ', sonra yine tur; 1. tur altın, 2. tur mavi.') : t(', then down to the finish.', ', потом вниз на финиш.', ', luego hasta la llegada.', ', dann hinunter ins Ziel.', ', sonra bitişe iniş.')}`,
      trap: `${t('From the start up to mark 1, a reach out to mark 2 and down to the gate', 'От старта вверх к знаку 1, бакштаг к знаку 2 и вниз к воротам', 'Desde la salida hasta la baliza 1, un través hasta la baliza 2 y bajando hasta la puerta', 'Vom Start hoch zu Marke 1, ein Raumschotskurs zu Marke 2 und hinunter zum Tor', 'Starttan şamandıra 1’e, şamandıra 2’ye apaz ve kapıya iniş')}${p.laps > 1
        ? t(', then back up to mark 2 and down again; lap 1 in gold, lap 2 in blue. Last, a reach across to the finish line.', ', потом снова вверх к знаку 2 и вниз; первый круг золотой, второй синий. В конце — галфвинд к финишной линии.', ', luego otra vez hasta la baliza 2 y de nuevo abajo; vuelta 1 en dorado, vuelta 2 en azul. Por último, un través hasta la línea de llegada.', ', dann wieder hoch zu Marke 2 und nochmals hinunter; Runde 1 in Gold, Runde 2 in Blau. Zuletzt ein Raumschotskurs hinüber zur Ziellinie.', ', sonra yine şamandıra 2’ye çıkış ve yeniden iniş; 1. tur altın, 2. tur mavi. Son olarak bitiş hattına apaz.')
        : t(', then a reach across to the finish line.', ', потом галфвинд к финишной линии.', ', luego un través hasta la línea de llegada.', ', dann ein Raumschotskurs hinüber zur Ziellinie.', ', sonra bitiş hattına apaz.')}`,
      wlu: `${t('From the start up to the windward mark, out to the offset mark and down to the gate', 'От старта вверх к верхнему знаку, к отбойнику и вниз к воротам', 'Desde la salida hasta la baliza de barlovento, hasta la baliza de desmarque y bajando hasta la puerta', 'Vom Start hoch zur Luvtonne, hinaus zur Ablauftonne und hinunter zum Tor', 'Starttan rüzgârüstü şamandırasına, ofset şamandırasına ve kapıya iniş')}${p.laps > 1
        ? t(', then round again; lap 1 in gold, lap 2 in blue. Last, a beat up to the finish line below the windward mark.', ', потом ещё круг; первый круг золотой, второй синий. В конце — лавировка к финишу чуть ниже верхнего знака.', ', luego otra vuelta; vuelta 1 en dorado, vuelta 2 en azul. Por último, una ceñida hasta la línea de llegada bajo la baliza de barlovento.', ', dann noch eine Runde; Runde 1 in Gold, Runde 2 in Blau. Zuletzt ein Kreuz hinauf zur Ziellinie unterhalb der Luvtonne.', ', sonra yine tur; 1. tur altın, 2. tur mavi. Son olarak rüzgârüstü şamandırasının altındaki bitiş hattına orsa.')
        : t(', then a beat up to the finish line below the windward mark.', ', потом лавировка к финишу чуть ниже верхнего знака.', ', luego una ceñida hasta la línea de llegada bajo la baliza de barlovento.', ', dann ein Kreuz hinauf zur Ziellinie unterhalb der Luvtonne.', ', sonra rüzgârüstü şamandırasının altındaki bitiş hattına orsa.')}`,
    }[p.course]],
  };
  // the places: four to pick from (today's, your last, then the first A to Z; the one chosen always among them), and
  // All opens every one, by name in the page's language (VENUES' own order is today's race's rotation, so it stays)
  const byName = VENUES.map((v) => [v.id, t(...v.name)] as [VenueId, string]).sort((a, b) => a[1].localeCompare(b[1], lang));
  const four = [...new Set([...near, ...byName.map(([id]) => id)])].slice(0, 4);
  if (!four.includes(p.venue)) four[3] = p.venue;
  const places = allPlaces ? byName : four.map((id) => byName.find(([v]) => v === id)!);

  return (
    <div className="scr bt-scr bc fs-scr" lang={lang}>
      <div className="bt">
        {ready && <GameScene venue={p.venue} boat={p.yacht} wind={p.preset} setup={scene} title={t('The race’s venue in 3D', 'Место гонки в 3D', 'La sede de la regata en 3D', 'Das Revier der Regatta in 3D', 'Yarışın yarış alanı 3D')} loading={t('Loading the venue', 'Загружаем место гонки', 'Cargando la sede', 'Revier wird geladen', 'Yarış alanı yükleniyor')} />}

        <div className="bt-info">
          <div className="bt-top">
            <BackLink href="/race" label={t('Back to the race hub', 'Назад в меню гонок', 'Volver al centro de regatas', 'Zurück zum Regatta-Hub', 'Yarış merkezine dön')} />
            <SceneBrand lang={lang} />
          </div>
          <span className="bt-kick bt-kick-w">{match ? t('1-on-1 race', 'Гонка 1 на 1', 'Regata 1 contra 1', '1-gegen-1-Regatta', 'Bire bir yarış') : from === 'race' ? t('Change the race', 'Изменить гонку', 'Cambiar la regata', 'Regatta ändern', 'Yarışı değiştir') : t('Custom race', 'Своя гонка', 'Regata personalizada', 'Freie Regatta', 'Serbest yarış')}</span>
          <h1 className="bt-h" id="fs-title">{t(...where.name)} <span className="bt-h-cc">{where.nation}</span></h1>
          <p className="bt-p">{t(...where.place)} · {t(`prevailing wind ${where.wind[0]}`, `преобладающий ветер ${where.wind[1]}`, `viento predominante ${where.wind[0]}`, `vorherrschender Wind ${where.wind[0]}`, `hâkim rüzgâr ${where.wind[0]}`)}. {t(...where.about)}</p>
          {view !== 'boats' && (
            <div className="bt-cap" role="status">
              <span className="bt-cap-t"><b>{cap[view][0]}</b><span>{cap[view][1]}</span></span>
              <button type="button" className="bt-cap-x" onClick={() => setView('boats')} aria-label={t('Back to the boats', 'Назад к лодкам', 'Volver a los barcos', 'Zurück zu den Booten', 'Teknelere dön')}>×</button>
            </div>
          )}
          <div className="bt-stats">
            <div><span className="bt-sk">{t('Beat', 'Лавировка', 'Ceñida', 'Kreuz', 'Orsa')}</span><b><Num v={`${beat} ${t('m', 'м', 'm', 'm', 'm')}`} /></b></div>
            <div><span className="bt-sk">{t('About', 'Около', 'Unos', 'Etwa', 'Yaklaşık')}</span><b><Num v={`${minutes(p)} ${t('min', 'мин', 'min', 'min', 'dk')}`} /></b></div>
            {/* a 1-on-1 race has no best time: a free race's says nothing of it */}
            {match
              ? <div><span className="bt-sk">{t('Race', 'Гонка', 'Regata', 'Regatta', 'Yarış')}</span><b>{t('1-on-1', '1 на 1', '1 contra 1', '1 gegen 1', 'Bire bir')}</b></div>
              : <div><span className="bt-sk">{t('Your best', 'Рекорд', 'Tu mejor marca', 'Deine Bestzeit', 'En iyin')}</span><b className={best != null ? 'is-gold' : ''}>{best != null ? clock(best) : '—'}</b></div>}
          </div>
        </div>

        <PauseCard lang={lang} back={match ? '/match/new' : fromToday ? '/race/free?from=today' : '/race/free'} title={match ? t('Set up your 1-on-1 race', 'Настрой гонку 1 на 1', 'Prepara tu regata 1 contra 1', 'Deine 1-gegen-1-Regatta einrichten', 'Bire bir yarışını kur') : t('Set up your race', 'Настрой гонку', 'Prepara tu regata', 'Deine Regatta einrichten', 'Yarışını kur')}
          foot={['boat', ['yachts', `/yachts?y=${p.yacht}&from=free`]]}
          action={<>
            <button type="button" className="bt-go" onClick={go}><IconPlay /><span>{match ? t('Create the race', 'Создать гонку', 'Crear la regata', 'Regatta erstellen', 'Yarışı oluştur') : from === 'race' ? t('Restart with these', 'Заново с этими', 'Reiniciar con esto', 'Mit diesen neu starten', 'Bunlarla yeniden başla') : t('Start race', 'Начать гонку', 'Empezar regata', 'Regatta starten', 'Yarışı başlat')}</span></button>
            <button type="button" className="bt-show" aria-pressed={view === 'course'} onClick={() => setView(view === 'course' ? 'boats' : 'course')}>
              {view === 'course' ? <IconBoats s={15} /> : <IconRoute s={15} />}<span>{view === 'course' ? t('Boats', 'Лодки', 'Barcos', 'Boote', 'Tekneler') : t('Show course', 'Дистанция', 'Ver recorrido', 'Bahn zeigen', 'Parkuru göster')}</span>
            </button>
          </>}>
          <div className="bt-g">
            <span className="bt-k" id="fs-venue"><IconPin />{t('Where', 'Где', 'Dónde', 'Wo', 'Nerede')}{chg('venue')}</span>
            <div className={`fs-where${allPlaces ? '' : ' fs-one'}`}>
              <div className="bt-pills" id="fs-places" role="radiogroup" aria-labelledby="fs-venue">
                {places.map(([v, l]) => {
                  // the venues you've raced (today's race or a free one) carry a tick, as the passport stamps them
                  const done = !!log?.v[v];
                  return (
                    <button key={v} type="button" role="radio" aria-checked={p.venue === v} className={`bt-pill${done ? ' is-raced' : ''}`} title={done ? t('You’ve raced here', 'Ты здесь уже гонялся', 'Ya has regateado aquí', 'Du bist hier gesegelt', 'Burada yarıştın') : undefined} onClick={() => { set('venue', v); setAllPlaces(false); }}>
                      {l}{done ? <span className="vh">{t(' · raced', ' · пройдено', ' · regateado', ' · gesegelt', ' · yarışıldı')}</span> : null}
                    </button>
                  );
                })}
              </div>
              <button type="button" className="bt-pill fs-all" aria-expanded={allPlaces} aria-controls="fs-places" onClick={() => setAllPlaces(!allPlaces)}>
                {t(`All ${VENUES.length}`, `Все ${VENUES.length}`, `Todas ${VENUES.length}`, `Alle ${VENUES.length}`, `Tümü ${VENUES.length}`)}<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
              </button>
            </div>
          </div>
          {tags('yacht', <IconSail s={14} />, t('Yacht', 'Яхта', 'Yate', 'Yacht', 'Yat'), YACHTS.map((y) => [y.id, t(...y.name)] as [YachtId, string]),
            <p className="bt-hint">{t(...boat.tagline)} <Link href={`/yachts?y=${boat.id}&from=free`}>{t('About the yachts', 'О яхтах', 'Sobre los yates', 'Über die Yachten', 'Yatlar hakkında')}</Link></p>)}
          {tags('preset', <IconWind s={14} />, t('Wind', 'Ветер', 'Viento', 'Wind', 'Rüzgâr'), [['light', t('Light 7 kn', 'Слабый 7 уз', 'Flojo 7 kn', 'Leicht 7 kn', 'Hafif 7 kn')], ['medium', t('Medium 12 kn', 'Средний 12 уз', 'Medio 12 kn', 'Mittel 12 kn', 'Orta 12 kn')], ['strong', t('Strong 19 kn', 'Сильный 19 уз', 'Fuerte 19 kn', 'Stark 19 kn', 'Kuvvetli 19 kn')]])}
          {tags('daytime', <IconSun />, t('Time of day', 'Время суток', 'Hora del día', 'Tageszeit', 'Günün saati'), [['any', t('Any', 'Любое', 'Cualquiera', 'Beliebig', 'Herhangi')], ['morning', t('Morning', 'Утро', 'Mañana', 'Morgen', 'Sabah')], ['midday', t('Midday', 'Полдень', 'Mediodía', 'Mittag', 'Öğle')], ['afternoon', t('Afternoon', 'День', 'Tarde', 'Nachmittag', 'Öğleden sonra')], ['evening', t('Evening', 'Вечер', 'Atardecer', 'Abend', 'Akşam')], ['sunset', t('Sunset', 'Закат', 'Puesta de sol', 'Sonnenuntergang', 'Gün batımı')]],
            <p className="bt-hint">{{
              any: t('A new hour every race, now and then under a grey sky.', 'Каждая гонка в новый час, иногда под серым небом.', 'Una hora nueva en cada regata, de vez en cuando bajo un cielo gris.', 'Jede Regatta eine neue Stunde, ab und zu unter grauem Himmel.', 'Her yarışta yeni bir saat, arada bir de gri bir gökyüzü altında.'),
              morning: t('Early, the sun low in the east and the air still fresh.', 'Рано: солнце низко на востоке, воздух ещё свежий.', 'Temprano, con el sol bajo en el este y el aire aún fresco.', 'Früh, die Sonne tief im Osten und die Luft noch frisch.', 'Erken, güneş doğuda alçakta, hava hâlâ serin.'),
              midday: t('The sun at its highest, the sea at its bluest.', 'Солнце в зените, море самое синее.', 'El sol en lo más alto, el mar en su azul más intenso.', 'Die Sonne auf ihrem Höchststand, das Meer am blauesten.', 'Güneş en tepede, deniz en mavi.'),
              afternoon: t('The sun past its highest, swinging west.', 'Солнце уже за зенитом, уходит на запад.', 'El sol pasado el cenit, girando hacia el oeste.', 'Die Sonne hat ihren Höchststand überschritten und wandert nach Westen.', 'Güneş tepeyi geçmiş, batıya doğru kayıyor.'),
              evening: t('Golden light, the sun an hour above the horizon.', 'Золотой свет, солнце за час до заката.', 'Luz dorada, el sol una hora sobre el horizonte.', 'Goldenes Licht, die Sonne eine Stunde über dem Horizont.', 'Altın ışık, güneş ufkun bir saat üstünde.'),
              sunset: t('The sun on the horizon, the sky and the sea gone orange.', 'Солнце у горизонта, небо и море в оранжевом.', 'El sol en el horizonte, el cielo y el mar teñidos de naranja.', 'Die Sonne am Horizont, Himmel und Meer orange gefärbt.', 'Güneş ufukta, gökyüzü ve deniz turuncuya döndü.'),
            }[p.daytime]}</p>)}
          {tags('course', <IconRoute />, t('Shape', 'Форма', 'Forma', 'Form', 'Şekil'), shapes.map((s) => [s, t(...SHAPE_NAME[s])] as [Shape, string]),
            SHAPE_HINT[p.course] && <p className="bt-hint">{t(...SHAPE_HINT[p.course]!)}</p>)}
          {/* the race's size, two to a row on a wide screen */}
          <div className="fs-grid">
            {tags('length', <IconRoute />, t('Course', 'Дистанция', 'Recorrido', 'Bahn', 'Parkur'), ([['short', t('Short', 'Короткая', 'Corta', 'Kurz', 'Kısa')], ['medium', t('Medium', 'Средняя', 'Media', 'Mittel', 'Orta')], ['long', t('Long', 'Длинная', 'Larga', 'Lang', 'Uzun')]] as [Length, string][]).filter(([l]) => lengthOffered(p.venue, l)))}
            {!match && tags('fleet', <IconBoats />, t('Boats', 'Лодки', 'Barcos', 'Boote', 'Tekneler'), [[3, t('3 boats', '3 лодки', '3 barcos', '3 Boote', '3 tekne')], [5, t('5 boats', '5 лодок', '5 barcos', '5 Boote', '5 tekne')], [7, t('7 boats', '7 лодок', '7 barcos', '7 Boote', '7 tekne')]])}
            {tags('laps', <IconLaps />, t('Laps', 'Круги', 'Vueltas', 'Runden', 'Turlar'), [[1, t('1 lap', '1 круг', '1 vuelta', '1 Runde', '1 tur')], [2, t('2 laps', '2 круга', '2 vueltas', '2 Runden', '2 tur')]])}
            {tags('start', <IconFlag />, t('Start', 'Старт', 'Salida', 'Start', 'Start'), [[1, t('1 min', '1 мин', '1 min', '1 min', '1 dk')], [3, t('3 min', '3 мин', '3 min', '3 min', '3 dk')], [5, t('5 min', '5 мин', '5 min', '5 min', '5 dk')]])}
            {tags('current', <IconTide />, t('Current', 'Течение', 'Corriente', 'Strömung', 'Akıntı'), [[0, t('Off', 'Выкл', 'No', 'Aus', 'Kapalı')], [1, t('On', 'Вкл', 'Sí', 'Ein', 'Açık')]],
              <p className="bt-hint">{where.runs ? t('The water runs here whichever you choose.', 'Вода здесь идёт при любом выборе.', 'Aquí el agua corre elijas lo que elijas.', 'Das Wasser fließt hier, was du auch wählst.', 'Hangisini seçersen seç, su burada akar.') : t('On: the venue’s tide, river or drift sets every boat.', 'Вкл: местное приливное течение, река или дрейф сносит все лодки.', 'Sí: la marea, el río o la deriva de la sede mueve a todos los barcos.', 'Ein: Die Gezeiten, der Fluss oder die Drift des Reviers versetzen jedes Boot.', 'Açık: yarış alanının gelgiti, nehri ya da sürüklemesi her tekneyi sürükler.')}</p>)}
            {!match && tags('contact', <IconFlag />, t('Contact', 'Столкновение', 'Contacto', 'Berührung', 'Temas'), [['turn', t('Penalty turn', 'Штрафной оборот', 'Giro de penalización', 'Strafkringel', 'Ceza dönüşü')], ['dsq', 'DSQ']],
              <p className="bt-hint">{p.contact === 'dsq' ? t('The boat at fault is out of the race at once. The rudder is read, and a boat with right of way can be at fault too.', 'Виновная яхта сразу снимается с гонки. Судья смотрит на угол руля, и яхта с правом дороги тоже может оказаться виновной.', 'El barco en falta queda fuera de la regata al instante. Se lee el timón, y un barco con derecho de paso también puede estar en falta.', 'Das schuldige Boot scheidet sofort aus der Regatta aus. Die Ruderlage zählt, und auch ein Boot mit Wegerecht kann schuldig sein.', 'Hatalı tekne hemen yarıştan çıkar. Dümen okunur ve geçiş hakkı olan bir tekne de hatalı olabilir.') : t('The boat at fault takes a penalty turn and sails on.', 'Виновная яхта делает штрафной оборот и продолжает гонку.', 'El barco en falta hace un giro de penalización y sigue navegando.', 'Das schuldige Boot dreht einen Strafkringel und segelt weiter.', 'Hatalı tekne bir ceza dönüşü yapar ve yoluna devam eder.')}</p>)}
          </div>
          <div className="bt-g fs-course-in">
            <span className="bt-k"><IconRoute />{t('Your course', 'Твоя дистанция', 'Tu recorrido', 'Deine Bahn', 'Parkurun')}<span className="bt-k-r">{p.course !== 'wl' ? `${shapeName} · ` : ''}{courseName} · {lapsName} · {metres}</span></span>
            <CourseMap className="cmap bt-map" lang={lang} geo={geo} preset={p.preset} W={250} H={210} route fleet={p.fleet} />
          </div>
          {base && changed.length ? <p className="bt-what" role="status"><b>{t('What happens', 'Что будет', 'Qué pasa', 'Was passiert', 'Ne olur')}</b> {from === 'today' ? t(`A custom race with ${changed.length} ${changed.length === 1 ? 'change' : 'changes'} from today’s. It doesn’t go on today’s ranking.`, `Своя гонка, изменений по сравнению с гонкой дня: ${changed.length}. В рейтинг дня она не идёт.`, `Una regata personalizada con ${changed.length} ${changed.length === 1 ? 'cambio' : 'cambios'} respecto a la de hoy. No entra en la clasificación del día.`, `Eine eigene Regatta mit ${changed.length} ${changed.length === 1 ? 'Änderung' : 'Änderungen'} gegenüber der heutigen. Sie kommt nicht in die Rangliste des Tages.`, `Günün yarışından ${changed.length} değişiklikle bir serbest yarış. Günün sıralamasına girmez.`) : t(`The race starts over, with ${changed.length} ${changed.length === 1 ? 'change' : 'changes'}.`, `Гонка начнётся заново, изменений: ${changed.length}.`, `La regata vuelve a empezar, con ${changed.length} ${changed.length === 1 ? 'cambio' : 'cambios'}.`, `Die Regatta startet neu, mit ${changed.length} ${changed.length === 1 ? 'Änderung' : 'Änderungen'}.`, `Yarış ${changed.length} değişiklikle yeniden başlar.`)}</p> : null}
          {match ? <p className="bt-saved bt-saved-l">{t('You and a friend, one on one. After you create the race you get a link to send.', 'Вы и друг, один на один. Когда создашь гонку, получишь ссылку, чтобы отправить.', 'Tú y un amigo, uno contra uno. Al crear la regata recibes un enlace para enviar.', 'Du und ein Freund, eins gegen eins. Nach dem Erstellen der Regatta bekommst du einen Link zum Verschicken.', 'Sen ve bir arkadaşın, bire bir. Yarışı oluşturduktan sonra göndermek için bir bağlantı alırsın.')}</p> : <p className="bt-saved bt-saved-l">{best != null
            ? t(`Your best in this wind, fleet and course, at any venue: ${clock(best)}. Beat it and the result page says so.`, `Твой лучший результат при этом ветре, флоте и дистанции, на любой акватории: ${clock(best)}. Побьёшь — страница результата скажет.`, `Tu mejor marca con este viento, flota y recorrido, en cualquier sede: ${clock(best)}. Supérala y la página de resultados lo dirá.`, `Deine Bestzeit bei diesem Wind, diesem Feld und dieser Bahn, in jedem Revier: ${clock(best)}. Schlag sie, und die Ergebnisseite sagt es.`, `Bu rüzgârda, filoda ve parkurda, her yarış alanında en iyin: ${clock(best)}. Geçersen sonuç sayfası söyler.`)
            : t('The game keeps your best time on every course. A custom race doesn’t go on today’s ranking.', 'Игра помнит лучшее время на каждой дистанции. Своя гонка в рейтинг дня не идёт.', 'El juego guarda tu mejor tiempo en cada recorrido. Una regata personalizada no entra en la clasificación de hoy.', 'Das Spiel merkt sich deine Bestzeit auf jeder Bahn. Eine eigene Regatta kommt nicht in die Rangliste des Tages.', 'Oyun her parkurdaki en iyi süreni tutar. Serbest yarış günün sıralamasına girmez.')}</p>}
        </PauseCard>
      </div>
    </div>
  );
}
