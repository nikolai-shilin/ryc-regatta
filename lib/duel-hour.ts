// The duel hour (release 6d of the 1-on-1 plan; iyt-test supabase/migrations/20261122020000_regatta_duel_hour.sql):
// every day from 19:00 to 20:00 UTC sailors gather for 1-on-1 races. A signed-in sailor says "I'm in" for the next one
// on /duel (components/duel-hour.tsx), and at 18:45 UTC gets a message (app/push/hour, the cron in vercel.json) by the
// browsers tied to their account and from the Telegram bot; its tap opens /duel?hour, which starts looking.
import { isLang, tx, type Lang } from './lang.ts'; // with its extension, so npm test's Node finds it too

export const HOUR_START = 19, HOUR_END = 20, REMIND_MIN = 15;
const H = 3600e3;

// the hour as it stands at `now` (ms): on, and when it ends; or when the next one starts
export function hourAt(now = Date.now()) {
  const d = new Date(now), day0 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const start = day0 + HOUR_START * H, end = day0 + HOUR_END * H;
  if (now >= start && now < end) return { on: true, start, end, left: end - now };
  const next = now < start ? start : start + 24 * H;
  return { on: false, start: next, end: next + H, left: next - now };
}
// 1:21:04, or 21:04 under the hour
export const hms = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
};

// regatta_hour_state(), read and checked: that day's hour, how many are in; for a signed-in sailor how many of them are
// near their rating, whether they are in, and whether a message can reach them
export type HourState = { day: string; in: number; near: number | null; me: boolean; reach: boolean };
export function parseHour(j: unknown): HourState | null {
  const o = j as Record<string, unknown> | null;
  if (!o || typeof o.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.day) || !Number.isInteger(o.in) || (o.in as number) < 0) return null;
  return { day: o.day, in: o.in as number, near: Number.isInteger(o.near) ? (o.near as number) : null, me: o.me === true, reach: o.reach === true };
}

// the message 15 minutes before: how many are in, and the tap that starts looking
export function hourMessage(lang: string, n: number) {
  const l: Lang = isLang(lang) ? lang : 'en', t = tx(l), others = Math.max(0, n - 1), are = others === 1 ? 'sailor is' : 'sailors are';
  return {
    title: t('The duel hour starts in 15 minutes', 'Час дуэлей через 15 минут', 'La hora de duelos empieza en 15 minutos', 'Die Duell-Stunde beginnt in 15 Minuten', 'Düello saati 15 dakika sonra başlıyor', 'L’heure des duels commence dans 15 minutes', 'L’ora dei duelli inizia tra 15 minuti', 'A hora dos duelos começa em 15 minutos'),
    body: others
      ? t(`${others} more ${are} in tonight. 19:00–20:00 UTC: tap to find a race.`, `Сегодня с тобой ещё ${others}. 19:00–20:00 UTC: нажми, чтобы найти гонку.`, `Esta noche hay ${others} más. 19:00–20:00 UTC: toca para buscar una regata.`, `Heute Abend sind ${others} weitere dabei. 19:00–20:00 UTC: tippe, um eine Regatta zu finden.`, `Bu akşam ${others} denizci daha var. 19:00–20:00 UTC: yarış bulmak için dokun.`, `${others} autres sont là ce soir. 19:00–20:00 UTC : touche pour trouver une régate.`, `Stasera ci sono altri ${others}. 19:00–20:00 UTC: tocca per trovare una regata.`, `Hoje há mais ${others}. 19:00–20:00 UTC: toque para achar uma regata.`)
      : t('19:00–20:00 UTC: tap to find a race.', '19:00–20:00 UTC: нажми, чтобы найти гонку.', '19:00–20:00 UTC: toca para buscar una regata.', '19:00–20:00 UTC: tippe, um eine Regatta zu finden.', '19:00–20:00 UTC: yarış bulmak için dokun.', '19:00–20:00 UTC : touche pour trouver une régate.', '19:00–20:00 UTC: tocca per trovare una regata.', '19:00–20:00 UTC: toque para achar uma regata.'),
    lang: l, tag: 'duel-hour', url: '/duel?hour',
    button: t('Find a race', 'Найти гонку', 'Buscar una regata', 'Regatta finden', 'Yarış bul', 'Trouver une régate', 'Trova una regata', 'Achar uma regata'),
  };
}
