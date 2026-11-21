// The 1-on-1 rating's own page (release 7b of the 1-on-1 plan; app/[lang]/duel/rating), from the database's
// regatta_rating_page() (iyt-test supabase/migrations/20261122030000_regatta_rating_page.sql), which answers for the
// session's sailor alone: their rating, record, best and lowest, place among the settled sailors, the day's change, how
// many hold each level, the spread of all settled ratings, and every rated race of theirs with what it was worked out
// from (lib/elo.ts: before, the other sailor's rating, the chance, K). Here: the answer checked, the record against
// stronger, level and weaker sailors, and why each race moved the rating as far as it did.
import { tx, type Lang } from './lang.ts'; // with its extension, so npm test's Node finds it too
import { plainName } from './name.ts';

export type Change = {
  at: string; before: number; after: number; delta: number; won: boolean; k: number; chance: number; n: number;
  them: string | null; themBefore: number; margin: number | null; forfeit: boolean; venue: string | null; yacht: string | null;
};
export type RatingPage = {
  rating: number; races: number; wins: number; losses: number; best: number; lowest: number;
  place: number | null; of: number; below: number | null; today: number;
  levels: number[]; spread: { at: number; n: number }[]; history: Change[];
};

const int = (v: unknown) => (Number.isInteger(v) ? (v as number) : null);
export function parseRatingPage(j: unknown): RatingPage | null {
  const o = j as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') return null;
  const rating = int(o.rating), races = int(o.races);
  if (rating == null || races == null) return null;
  const history: Change[] = [];
  for (const x of Array.isArray(o.history) ? (o.history as Record<string, unknown>[]) : []) {
    const before = int(x?.before), after = int(x?.after), delta = int(x?.delta), k = int(x?.k), n = int(x?.n), themBefore = int(x?.them_before), chance = Number(x?.chance);
    if (typeof x?.at !== 'string' || before == null || after == null || delta == null || k == null || n == null || themBefore == null || !(chance >= 0 && chance <= 1)) continue;
    history.push({ at: x.at, before, after, delta, won: x.won === true, k, chance, n, them: typeof x.them === 'string' ? plainName(x.them) : null, themBefore,
      margin: typeof x.margin === 'number' && Number.isFinite(x.margin) ? x.margin : null, forfeit: x.forfeit === true,
      venue: typeof x.venue === 'string' ? x.venue : null, yacht: typeof x.yacht === 'string' ? x.yacht : null });
  }
  history.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const levels = Array.isArray(o.levels) && o.levels.length === 7 && o.levels.every((x) => int(x) != null) ? (o.levels as number[]) : [0, 0, 0, 0, 0, 0, 0];
  const spread = (Array.isArray(o.spread) ? (o.spread as Record<string, unknown>[]) : []).filter((x) => int(x?.at) != null && int(x?.n) != null).map((x) => ({ at: x.at as number, n: x.n as number }));
  return {
    rating, races, wins: int(o.wins) ?? 0, losses: int(o.losses) ?? 0, best: int(o.best) ?? rating, lowest: int(o.lowest) ?? rating,
    place: int(o.place), of: int(o.of) ?? 0, below: int(o.below), today: int(o.today) ?? 0, levels, spread, history,
  };
}

// the record against sailors 100 or more above you (then), within 100, and 100 or more below; each with the race that
// moved the rating most in that band
export const BAND = 100;
export type Band = { key: 'above' | 'level' | 'below'; wins: number; losses: number; best: Change | null };
export function bands(history: Change[]): Band[] {
  const out: Band[] = [{ key: 'above', wins: 0, losses: 0, best: null }, { key: 'level', wins: 0, losses: 0, best: null }, { key: 'below', wins: 0, losses: 0, best: null }];
  for (const c of history) {
    const gap = c.themBefore - c.before, b = out[gap >= BAND ? 0 : gap <= -BAND ? 2 : 1];
    if (c.won) b.wins++; else b.losses++;
    if (c.won && (!b.best || c.delta > b.best.delta)) b.best = c;
  }
  return out;
}

// why one race moved the rating as far as it did, with the sum: "Anna K. was 45 above you: your chance was 44%. A win
// earns 32 × 56% = 18." A race of the first five says it counted double.
export function whyMoved(c: Change, lang: Lang): string {
  const t = tx(lang), who = c.them || t('The other sailor', 'Соперник', 'El otro regatista', 'Der andere Segler', 'Diğer denizci', 'L’autre régatier', 'L’altro velista', 'O outro velejador');
  const gap = c.themBefore - c.before, g = Math.abs(gap), p = Math.round(c.chance * 100), q = 100 - p, d = Math.abs(c.delta);
  const where = gap === 0
    ? t(`${who} was level with you: your chance was ${p}%.`, `${who} — на твоём уровне: шансы ${p}%.`, `${who} estaba a tu nivel: tu probabilidad era ${p}%.`, `${who} war auf deinem Niveau: deine Chance war ${p} %.`, `${who} seninle aynı seviyedeydi: şansın %${p} idi.`, `${who} était à ton niveau : ta chance était de ${p} %.`, `${who} era al tuo livello: la tua probabilità era ${p}%.`, `${who} estava no seu nível: sua chance era ${p}%.`)
    : gap > 0
      ? t(`${who} was ${g} above you: your chance was ${p}%.`, `${who} — на ${g} выше: шансы ${p}%.`, `${who} estaba ${g} por encima: tu probabilidad era ${p}%.`, `${who} lag ${g} über dir: deine Chance war ${p} %.`, `${who} senden ${g} yukarıdaydı: şansın %${p} idi.`, `${who} avait ${g} de plus : ta chance était de ${p} %.`, `${who} era ${g} sopra di te: la tua probabilità era ${p}%.`, `${who} estava ${g} acima: sua chance era ${p}%.`)
      : t(`${who} was ${g} below you: your chance was ${p}%.`, `${who} — на ${g} ниже: шансы ${p}%.`, `${who} estaba ${g} por debajo: tu probabilidad era ${p}%.`, `${who} lag ${g} unter dir: deine Chance war ${p} %.`, `${who} senden ${g} aşağıdaydı: şansın %${p} idi.`, `${who} avait ${g} de moins : ta chance était de ${p} %.`, `${who} era ${g} sotto di te: la tua probabilità era ${p}%.`, `${who} estava ${g} abaixo: sua chance era ${p}%.`);
  const sum = c.won
    ? t(`A win earns ${c.k} × ${q}% = ${d}.`, `Победа даёт ${c.k} × ${q}% = ${d}.`, `Una victoria da ${c.k} × ${q}% = ${d}.`, `Ein Sieg bringt ${c.k} × ${q} % = ${d}.`, `Galibiyet ${c.k} × %${q} = ${d} kazandırır.`, `Une victoire rapporte ${c.k} × ${q} % = ${d}.`, `Una vittoria vale ${c.k} × ${q}% = ${d}.`, `Uma vitória rende ${c.k} × ${q}% = ${d}.`)
    : t(`A loss costs ${c.k} × ${p}% = ${d}.`, `Поражение стоит ${c.k} × ${p}% = ${d}.`, `Una derrota cuesta ${c.k} × ${p}% = ${d}.`, `Eine Niederlage kostet ${c.k} × ${p} % = ${d}.`, `Yenilgi ${c.k} × %${p} = ${d} kaybettirir.`, `Une défaite coûte ${c.k} × ${p} % = ${d}.`, `Una sconfitta costa ${c.k} × ${p}% = ${d}.`, `Uma derrota custa ${c.k} × ${p}% = ${d}.`);
  const first = c.k > 32 ? ` ${t(`Race ${c.n + 1} of your first five: counted double.`, `Гонка ${c.n + 1} из первых пяти: вдвойне.`, `Regata ${c.n + 1} de tus cinco primeras: contó doble.`, `Regatta ${c.n + 1} deiner ersten fünf: doppelt gezählt.`, `İlk beş yarışından ${c.n + 1}.: iki kat sayıldı.`, `Régate ${c.n + 1} de tes cinq premières : comptée double.`, `Regata ${c.n + 1} delle prime cinque: contata doppio.`, `Regata ${c.n + 1} das cinco primeiras: contou em dobro.`)}` : '';
  return `${where} ${sum}${first}`;
}
