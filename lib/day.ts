// A race day's address, /race/rating/YYYY-MM-DD: what a day is, on its own (no server-only imports), so proxy.ts can
// turn a day the rating can't show into a real 404 before the page's loading screen has already answered 200.
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const todayUtc = () => new Date().toISOString().slice(0, 10);
// a day the rating can show: a real date, not after today (UTC), within the last 400 days (as the API keeps them)
export function validDay(d: string) {
  if (!DAY_RE.test(d)) return false;
  const t = Date.parse(d + 'T00:00:00Z');
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === d && d <= todayUtc() && Date.now() - t < 400 * 864e5;
}
