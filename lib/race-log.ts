// What the result page and the name step work out from a finished race and today's ranking. Pure, so npm test's Node
// reads it as it is (no imports).

// Where a time would stand among the day's ranked times: one more than those faster by more than the tenth the times
// are kept to (a time equal to one on the board, its own row, doesn't count against it).
export function placeAmong(times: number[], mine: number) {
  return times.filter((s) => s < mine - 0.05).length + 1;
}

// The boats as the game keeps them (public/game/main.js finishToPage): legT, the clock as she finished each leg (the
// start's crossing first), and pens came with the finish's tiles; a result saved before them has neither.
export type LoggedBoat = { me: boolean; done: boolean; dsq: boolean; secs: number | null; legT?: number[]; pens?: number };
export type StartLog = { startT: number | null; startAt?: number | null };

// The start: how long after the gun you crossed the line, your place off it (among the boats whose crossing was kept)
// and where along it (0 the pin, 1 the committee boat). null when you never crossed it after the gun.
export function startOf(log: StartLog, boats: LoggedBoat[]) {
  if (log.startT == null) return null;
  const me = boats.find((b) => b.me), mine = me?.legT?.[0];
  const off = boats.map((b) => b.legT?.[0]).filter((x): x is number => x != null);
  const place = mine != null && off.length > 1 ? off.filter((x) => x < mine).length + 1 : null;
  const at = log.startAt;
  const end = at == null ? null : at < 0.34 ? 'pin' : at > 0.66 ? 'boat' : 'middle';
  return { late: Math.max(0, log.startT), place, end } as { late: number; place: number | null; end: 'pin' | 'boat' | 'middle' | null };
}

// Each leg's time for a boat: from the start's crossing to the first mark, mark to mark, the last mark to the finish
export function legTimes(b: LoggedBoat) {
  if (!b.legT?.length) return [];
  const T = [...b.legT, ...(b.done && b.secs != null ? [b.secs] : [])];
  return T.slice(1).map((x, i) => x - T[i]);
}

// Your best leg against the fleet: the one where your time placed best among the boats that sailed it, and of those
// the one you won by most (or lost by least). leg is 1-based; by is the margin over the next boat when you were
// fastest, else how far off the fastest. null without every boat's leg times (a result saved before them).
export function bestLeg(boats: LoggedBoat[]) {
  const me = boats.find((b) => b.me);
  if (!me) return null;
  const mine = legTimes(me), all = boats.map(legTimes);
  let best: { leg: number; place: number; of: number; by: number } | null = null;
  mine.forEach((m, i) => {
    const others = all.filter((x) => x !== all[boats.indexOf(me)] && x[i] != null).map((x) => x[i]);
    if (!others.length) return;
    const place = others.filter((x) => x < m).length + 1, fastest = Math.min(...others);
    const by = place === 1 ? fastest - m : m - fastest;
    const better = !best || place < best.place || (place === best.place && (place === 1 ? by > best.by : by < best.by));
    if (better) best = { leg: i + 1, place, of: others.length + 1, by };
  });
  return best as { leg: number; place: number; of: number; by: number } | null;
}
