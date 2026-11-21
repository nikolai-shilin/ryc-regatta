// A sailor's choice of messages (release 5d of the 1-on-1 plan; iyt-test supabase/migrations/20261122000000_regatta_messages.sql):
// Match found while away by browser push and from the Telegram bot, and quiet hours in their own time zone, when nothing
// is sent (no Match found, no daily reminder). GET/POST /connect/messages (app/connect/messages/route.ts); the Messages
// card on /settings (components/messages-form.tsx).
export type Msg = { push: boolean; telegram: boolean; quietFrom: number | null; quietTo: number | null; tz: string; browsers: number; bot: boolean; quietNow: boolean };

// the quiet hours offered: off, or from–to in whole hours
export const QUIET: readonly (readonly [number, number] | null)[] = [null, [22, 8], [23, 7], [0, 9]];

const hour = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 23 ? v : null);

export function parseMsg(j: unknown): Msg | null {
  const o = j as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || typeof o.push !== 'boolean' || typeof o.telegram !== 'boolean') return null;
  const f = hour(o.quiet_from), t = hour(o.quiet_to), n = Number(o.browsers);
  return { push: o.push, telegram: o.telegram, quietFrom: f != null && t != null ? f : null, quietTo: f != null && t != null ? t : null,
    tz: typeof o.tz === 'string' && o.tz ? o.tz.slice(0, 64) : 'UTC', browsers: Number.isInteger(n) && n > 0 ? n : 0, bot: o.bot === true, quietNow: o.quiet_now === true };
}

// what the page sends: the switches, the quiet hours (both or neither), the browser's own time zone
export function msgBody(b: unknown): { p_push: boolean; p_telegram: boolean; p_quiet_from: number | null; p_quiet_to: number | null; p_tz: string } | null {
  const o = b as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || typeof o.push !== 'boolean' || typeof o.telegram !== 'boolean') return null;
  const f = hour(o.quietFrom), t = hour(o.quietTo), both = f != null && t != null && f !== t;
  const tz = typeof o.tz === 'string' && /^[A-Za-z_+\-/0-9]{1,64}$/.test(o.tz) ? o.tz : 'UTC';
  return { p_push: o.push, p_telegram: o.telegram, p_quiet_from: both ? f : null, p_quiet_to: both ? t : null, p_tz: tz };
}

export const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
