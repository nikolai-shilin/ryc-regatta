// A boat's track as a finished race keeps it, read back: where she was at any moment, and how far ahead or behind
// her a boat is. No imports, so npm test reads it in Node (test/log.test.mjs keeps along() in step with lib/finish.ts).
// where a track had its boat at T (race clock, s), as lib/finish.ts along() does (npm test keeps the two in step): the
// game records a boat's position about once a second (every 61 steps of 1/60 s) from the first signal's lead-in and
// once more as she finishes, and the result keeps at most some 160 of them, every k-th and the last
export const TICK = 61 / 60;
export const clock0 = (start) => (start === 5 ? -300 - 8 : start === 3 ? -180 - 8 : -60 - 4);
export function trackTimes(n, end, start) {
  const c0 = clock0(start), N = end != null ? Math.round((end - c0) / TICK) : n, k = Math.max(1, Math.ceil(N / 160));
  return (i) => (i === n - 1 && end != null ? end : c0 + (i * k + 1) * TICK);
}
export function along(tr, end, start, T) {
  const n = tr.length;
  if (!n) return null;
  if (n === 1) return { x: tr[0][0], z: tr[0][1], h: 0 };
  const time = trackTimes(n, end, start);
  const head = (a, b) => Math.atan2(b[0] - a[0], -(b[1] - a[1]));
  if (T >= time(n - 1)) { const h = head(tr[n - 2], tr[n - 1]), d = Math.min(90, (T - time(n - 1)) * 3); return { x: tr[n - 1][0] + Math.sin(h) * d, z: tr[n - 1][1] - Math.cos(h) * d, h }; }
  let i = 0;
  while (i < n - 2 && time(i + 1) < T) i++;
  const f = Math.max(0, Math.min(1, (T - time(i)) / (time(i + 1) - time(i) || 1)));
  return { x: tr[i][0] + (tr[i + 1][0] - tr[i][0]) * f, z: tr[i][1] + (tr[i + 1][1] - tr[i][1]) * f, h: head(tr[i], tr[i + 1]) };
}
// how far ahead (−) or behind (+) of the ghost you are: your clock now, against hers when she was nearest where you
// are, on the leg you're on (her leg times say which part of her track that is)
export function ghostGap(g, x, z, leg, clock) {
  if (leg < 1 || !g.legT || g.legT.length < leg) return null;
  const from = g.legT[leg - 1], to = g.legT[leg] ?? g.secs ?? from + 600;
  let best = null, bd = Infinity;
  for (let T = from; T <= to; T += 1) { const p = along(g.track, g.secs, g.start, T); const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = T; } }
  return best == null || bd > 150 * 150 ? null : clock - best;
}

