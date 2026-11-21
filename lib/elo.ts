// The 1-on-1 rating: plain Elo, one number, the same sums on the help page, here and in the database
// (iyt-test supabase/migrations/20261121140000_regatta_rating.sql, regatta_rate_duel, which must stay in step with this file:
// test/elo.test.mjs holds both to the same cases).
//
// - Everyone starts at 1500.
// - Your chance against another sailor: 1 / (1 + 10^((theirs − yours) / 400)).
// - A win earns round(K × (1 − chance)), a loss costs round(K × chance). K is 32, and 64 (each race counts double) for a
//   sailor's first five rated races, while the rating is provisional and shows with a ~.
// - Time away changes nothing: there is no decay and no uncertainty band.

export const START = 1500;
export const K = 32;
export const K_NEW = 64;
export const PROVISIONAL = 5; // rated races before the rating settles

export const chance = (mine: number, theirs: number) => 1 / (1 + Math.pow(10, (theirs - mine) / 400));
export const kFor = (racesBefore: number) => (racesBefore < PROVISIONAL ? K_NEW : K);
export const provisional = (races: number) => races < PROVISIONAL;

// what one race would do to a sailor of `mine` with `racesBefore` rated races, against one of `theirs`: the win's gain and
// the loss's cost (both as positive numbers), and the chance. Rounded half up, as Postgres rounds a positive numeric
export function stakes(mine: number, theirs: number, racesBefore: number) {
  const e = chance(mine, theirs), k = kFor(racesBefore);
  return { chance: e, k, win: Math.round(k * (1 - e)), loss: Math.round(k * e) };
}

export type Side = { rating: number; races: number };
export type Change = { before: number; after: number; delta: number; k: number; chance: number };

// a rated race between a and b: each side's change, each with its own K (a provisional sailor moves twice as far as a
// settled one, so a race between the two isn't zero-sum)
export function rate(a: Side, b: Side, aWon: boolean): { a: Change; b: Change } {
  const sa = stakes(a.rating, b.rating, a.races), sb = stakes(b.rating, a.rating, b.races);
  const da = aWon ? sa.win : -sa.loss, db = aWon ? -sb.loss : sb.win;
  return {
    a: { before: a.rating, after: a.rating + da, delta: da, k: sa.k, chance: sa.chance },
    b: { before: b.rating, after: b.rating + db, delta: db, k: sb.k, chance: sb.chance },
  };
}

// a rating as it is shown: with a ~ while provisional
export const shown = (rating: number, races: number) => `${provisional(races) ? '~' : ''}${rating}`;
// a change as it is shown: +18, −16 (a true minus sign), ±0
export const signed = (delta: number) => (delta > 0 ? `+${delta}` : delta < 0 ? `−${-delta}` : '±0');
