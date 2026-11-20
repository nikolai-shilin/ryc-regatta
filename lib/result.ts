import { LOCALE, ruBoats, tx, type Lang } from './lang.ts'; // with their extensions, so npm test's Node finds them too
import { shapeOf, SHAPE_NAME, type Shape } from './race.ts';
import { clock } from './clock.ts';

// A finished race as the game posted it for its result link (public/game/stats.js raceResult → iyt.rycrentals.com
// api/game, which serves it back by id). Only the parts the share card and the page title read.
export type XZ = [number, number];
export type SharedResult = {
  v: 1; id: string; at: number; daily: string | null; preset: 'light' | 'medium' | 'strong'; length: string; laps: number;
  // `type`, `marks` and `finish` came with the course shapes: a result saved before them has none
  course: { windward: XZ; gate: XZ[]; pin: XZ; committee: XZ; wing?: XZ; type?: Shape; marks?: Record<string, XZ>; finish?: [XZ, XZ] };
  boats: { me: boolean; done: boolean; dsq: boolean; secs: number | null; track: XZ[] }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// null when there is none (yet): a result goes online as its race finishes, so a miss isn't cached (Next keeps only a
// 200 in its data cache), and a hit is kept a day: a posted result never changes.
export async function getResult(id: string): Promise<SharedResult | null> {
  if (!UUID.test(id)) return null;
  try {
    const r = await fetch(`https://iyt.rycrentals.com/api/game?race=${id.toLowerCase()}`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.v === 1 && Array.isArray(j.boats) && j.boats.some((b: { me?: boolean }) => b.me) ? j : null;
  } catch { return null; }
}

export const ordEs = (n: number) => `${n}.º`;
export const ordDe = (n: number) => `${n}.`;
export const ordTr = (n: number) => `${n}.`;
export const ordEn = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`;

// The race in words, for the title, the description and the card: "2nd in 3:45.7", "Race of the day · Fri 13 Nov",
// "Light breeze 7 kn · 6 boats · short course, 1 lap"; and the same facts one by one for the card's cells: the day, the
// wind in knots, the course's length and shape, the boats.
export function describe(res: SharedResult, lang: Lang) {
  const t = tx(lang);
  const me = res.boats.find((b) => b.me)!, place = res.boats.indexOf(me) + 1;
  const time = me.secs != null && !me.dsq ? clock(me.secs) : null;
  const headline = me.dsq || !time ? t('Disqualified', 'Дисквалификация', 'Descalificado', 'Disqualifiziert', 'Diskalifiye', 'Disqualifié') : t(`${ordEn(place)} in ${time}`, `${place}-е место · ${time}`, `${ordEs(place)} en ${time}`, `${ordDe(place)} in ${time}`, `${ordTr(place)}, ${time}`, `${place === 1 ? '1er' : `${place}e`} en ${time}`);
  const date = new Date(res.at).toLocaleDateString(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const kind = res.daily ? `${t('Race of the day', 'Гонка дня', 'Regata del día', 'Regatta des Tages', 'Günün yarışı', 'Régate du jour')} · ${date}` : t('Custom race', 'Своя гонка', 'Regata personalizada', 'Freie Regatta', 'Serbest yarış', 'Régate libre');
  const wind = { light: t('Light breeze', 'Слабый ветер', 'Brisa suave', 'Leichte Brise', 'Hafif meltem', 'Petite brise'), medium: t('Medium breeze', 'Средний ветер', 'Brisa media', 'Mittlere Brise', 'Orta meltem', 'Brise moyenne'), strong: t('Strong breeze', 'Сильный ветер', 'Brisa fuerte', 'Starke Brise', 'Kuvvetli meltem', 'Forte brise') }[res.preset];
  const kn = { light: 7, medium: 12, strong: 19 }[res.preset];
  const len = ({ short: t('short', 'короткая', 'corto', 'kurz', 'kısa', 'court'), medium: t('medium', 'средняя', 'medio', 'mittel', 'orta', 'moyen'), long: t('long', 'длинная', 'largo', 'lang', 'uzun', 'long') } as Record<string, string>)[res.length] || '';
  const shape = t(...SHAPE_NAME[shapeOf(res.course)]).toLowerCase();
  const laps = t(`${res.laps} ${res.laps > 1 ? 'laps' : 'lap'}`, `${res.laps} ${res.laps > 1 ? 'круга' : 'круг'}`, `${res.laps} ${res.laps > 1 ? 'vueltas' : 'vuelta'}`, `${res.laps} ${res.laps > 1 ? 'Runden' : 'Runde'}`, `${res.laps} tur`, `${res.laps} ${res.laps > 1 ? 'tours' : 'tour'}`);
  const detail = `${wind} ${kn} ${t('kn', 'уз', 'kn', 'kn', 'kn', 'kn')} · ${t(`${res.boats.length} boats`, ruBoats(res.boats.length), `${res.boats.length} ${res.boats.length === 1 ? 'barco' : 'barcos'}`, `${res.boats.length} ${res.boats.length === 1 ? 'Boot' : 'Boote'}`, `${res.boats.length} tekne`)} · ${shape}${len ? `, ${len}` : ''}, ${laps}`;
  const isToday = res.daily === new Date().toISOString().slice(0, 10);
  const call = time && res.daily && isToday ? t('Beat this time', 'Побей это время', 'Bate este tiempo', 'Zeit zum Schlagen', 'Bu süreyi geç', 'Bats ce temps') : t('Sail today’s race', 'Пройди гонку дня', 'Navega la regata del día', 'Die Regatta des Tages segeln', 'Günün yarışına çık', 'Cours la régate du jour');
  const length = ({ short: t('Short', 'Короткая', 'Corta', 'Kurz', 'Kısa', 'Courte'), medium: t('Medium', 'Средняя', 'Media', 'Mittel', 'Orta', 'Moyenne'), long: t('Long', 'Длинная', 'Larga', 'Lang', 'Uzun', 'Longue') } as Record<string, string>)[res.length] || '';
  return { me, place, time, headline, kind, detail, call, date, kn, length, shape: t(...SHAPE_NAME[shapeOf(res.course)]), boats: res.boats.length };
}
