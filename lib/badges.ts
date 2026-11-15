// The badges: each for something a good sailor does, earned by doing it. A race's own (its result's log: the start,
// the speed, the tacks, the fouls, the places) and the player's over time (their log, lib/log.ts: the streak, the
// venues; the drills' stars). lib/log.ts keeps when each was first earned (log.b); /race/badges shows them all, and a
// result the ones that race earned. Pure, so npm test's Node reads it.
export type BadgeId = 'first' | 'clean' | 'gun' | 'shifts' | 'speed' | 'podium' | 'win' | 'comeback' | 'streak7' | 'venues7' | 'venues28' | 'drills';
// three families, each its colour (components/badge-pennant.tsx): what a race ends in, what a sailor does well in it,
// what a player keeps up over the days
export type BadgeFam = 'result' | 'skill' | 'season';
type Pair = [en: string, ru: string];
export const BADGES: { id: BadgeId; fam: BadgeFam; name: Pair; how: Pair; race?: boolean }[] = [
  { id: 'first', fam: 'result', race: true, name: ['First finish', 'Первый финиш'], how: ['Finish a race.', 'Дойди до финиша.'] },
  { id: 'clean', fam: 'skill', race: true, name: ['Clean race', 'Чистая гонка'], how: ['Finish with no fouls, no penalties and no hails.', 'Финишируй без нарушений, штрафов и окликов.'] },
  { id: 'gun', fam: 'skill', race: true, name: ['On the gun', 'Точно со стартом'], how: ['Cross the line within 2 seconds of the gun, at speed, and not over early.', 'Пересеки линию в пределах 2 секунд после сигнала, на скорости и без фальстарта.'] },
  { id: 'shifts', fam: 'skill', race: true, name: ['Shift player', 'Игрок на сдвигах'], how: ['Tack on two headers or more in a race, and never on a lift.', 'Поверни на двух заходах или больше и ни разу на отходе.'] },
  { id: 'speed', fam: 'skill', race: true, name: ['In the groove', 'В канавке'], how: ['Sail at 95% of target speed or better over a race.', 'Держи в среднем 95% целевой скорости или больше.'] },
  { id: 'podium', fam: 'result', race: true, name: ['Podium', 'Подиум'], how: ['Finish in the first three of a fleet of four or more.', 'Финишируй в тройке флота из четырёх лодок или больше.'] },
  { id: 'win', fam: 'result', race: true, name: ['Line honours', 'Первым на финише'], how: ['Win a race.', 'Выиграй гонку.'] },
  { id: 'comeback', fam: 'skill', race: true, name: ['Comeback', 'Камбэк'], how: ['Finish two places or more ahead of where you rounded the first mark.', 'Финишируй на два места или больше выше, чем огибал первый знак.'] },
  { id: 'streak7', fam: 'season', name: ['Week on the water', 'Неделя на воде'], how: ['Finish today’s race seven days in a row.', 'Пройди гонку дня семь дней подряд.'] },
  { id: 'venues7', fam: 'season', name: ['Explorer', 'Путешественник'], how: ['Race at seven venues.', 'Погоняйся на семи акваториях.'] },
  { id: 'venues28', fam: 'season', name: ['Round the world', 'Вокруг света'], how: ['Race at every venue.', 'Погоняйся на всех акваториях.'] },
  { id: 'drills', fam: 'season', name: ['Drilled', 'Отработано'], how: ['Get three stars on every drill.', 'Получи три звезды во всех тренировках.'] },
];
export const FAMS: { id: BadgeFam; name: Pair; many: Pair }[] = [
  { id: 'result', name: ['Result', 'Результат'], many: ['Results', 'Результаты'] },
  { id: 'skill', name: ['Skill', 'Мастерство'], many: ['Skills', 'Мастерство'] },
  { id: 'season', name: ['Season', 'Сезон'], many: ['Season', 'Сезон'] },
];
export const famOf = (id: BadgeId): BadgeFam => BADGES.find((b) => b.id === id)?.fam ?? 'result';

// what a race's result keeps that the badges read (public/game/main.js finishToPage)
export type RaceForBadges = {
  boats: { me: boolean; done: boolean; dsq: boolean; secs: number | null; pens?: number }[];
  log?: { ocs?: boolean; startDsq?: string | null; startT?: number | null; gunV?: number | null; head?: number; lift?: number; pct?: number | null;
    fouls?: unknown[]; hails?: Record<string, number>; legPlaces?: number[]; penT?: number };
};

// the badges a race earned
export function raceBadges(r: RaceForBadges): BadgeId[] {
  const me = r.boats.find((b) => b.me);
  if (!me || !me.done || me.dsq || me.secs == null) return [];
  const L = r.log || {}, place = r.boats.indexOf(me) + 1, n = r.boats.length;
  const hails = Object.values(L.hails || {}).reduce((a, b) => a + b, 0);
  const out: BadgeId[] = ['first'];
  if (!(L.fouls || []).length && !(me.pens ?? 0) && !(L.penT && L.penT > 1) && !hails && !L.ocs) out.push('clean');
  if (!L.ocs && !L.startDsq && L.startT != null && L.startT <= 2 && (L.gunV ?? 0) > 3.5) out.push('gun');
  if ((L.head ?? 0) >= 2 && L.lift === 0) out.push('shifts');
  if (L.pct != null && L.pct >= 95) out.push('speed');
  if (n >= 4 && place <= 3) out.push('podium');
  if (place === 1) out.push('win');
  const atMark = L.legPlaces?.[1];
  if (atMark && atMark - place >= 2) out.push('comeback');
  return out;
}

// the badges a player's log and drills have earned
export function logBadges(o: { streak: number; venues: number; of: number; drills: Record<string, number>; drillIds: string[] }): BadgeId[] {
  const out: BadgeId[] = [];
  if (o.streak >= 7) out.push('streak7');
  if (o.venues >= 7) out.push('venues7');
  if (o.venues >= o.of) out.push('venues28');
  if (o.drillIds.length && o.drillIds.every((d) => (o.drills[d] || 0) >= 3)) out.push('drills');
  return out;
}
