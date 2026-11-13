import { ruBoats, tx, type Lang } from './lang';

// A finished race as the game posted it for its result link (public/game/stats.js raceResult → iyt.rycrentals.com
// api/game, which serves it back by id). Only the parts the share card and the page title read.
export type XZ = [number, number];
export type SharedResult = {
  v: 1; id: string; at: number; daily: string | null; preset: 'light' | 'medium' | 'strong'; length: string; laps: number;
  course: { windward: XZ; gate: XZ[]; pin: XZ; committee: XZ; wing?: XZ };
  boats: { me: boolean; done: boolean; dsq: boolean; secs: number | null; track: XZ[] }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// null when there is none (yet): a result goes online as its race finishes, so a miss isn't cached.
export async function getResult(id: string): Promise<SharedResult | null> {
  if (!UUID.test(id)) return null;
  try {
    const r = await fetch(`https://iyt.rycrentals.com/api/game?race=${id.toLowerCase()}`, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.v === 1 && Array.isArray(j.boats) && j.boats.some((b: { me?: boolean }) => b.me) ? j : null;
  } catch { return null; }
}

export const ordEn = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`;
const clock = (s: number) => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(1).padStart(4, '0')}`; };

// The race in words, for the title, the description and the card: "2nd in 3:45.7", "Race of the day · Fri 13 Nov",
// "Light breeze 7 kn · 6 boats · short course, 1 lap".
export function describe(res: SharedResult, lang: Lang) {
  const t = tx(lang);
  const me = res.boats.find((b) => b.me)!, place = res.boats.indexOf(me) + 1;
  const time = me.secs != null && !me.dsq ? clock(me.secs) : null;
  const headline = me.dsq || !time ? t('Disqualified', 'Дисквалификация') : t(`${ordEn(place)} in ${time}`, `${place}-е место · ${time}`);
  const date = new Date(res.at).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const kind = res.daily ? `${t('Race of the day', 'Гонка дня')} · ${date}` : t('Free race', 'Свободная гонка');
  const wind = { light: t('Light breeze', 'Слабый ветер'), medium: t('Medium breeze', 'Средний ветер'), strong: t('Strong breeze', 'Сильный ветер') }[res.preset];
  const kn = { light: 7, medium: 12, strong: 19 }[res.preset];
  const len = ({ short: t('short', 'короткая'), medium: t('medium', 'средняя'), long: t('long', 'длинная') } as Record<string, string>)[res.length] || '';
  const shape = res.course.wing ? t('triangle', 'треугольник') : t('up and down', 'апвинд — даунвинд');
  const laps = t(`${res.laps} ${res.laps > 1 ? 'laps' : 'lap'}`, `${res.laps} ${res.laps > 1 ? 'круга' : 'круг'}`);
  const detail = `${wind} ${kn} ${t('kn', 'уз')} · ${t(`${res.boats.length} boats`, ruBoats(res.boats.length))} · ${shape}${len ? `, ${len}` : ''}, ${laps}`;
  const isToday = res.daily === new Date().toISOString().slice(0, 10);
  const call = time && res.daily && isToday ? t('Beat this time', 'Побей это время') : t('Sail today’s race', 'Пройди гонку дня');
  return { me, place, time, headline, kind, detail, call };
}
