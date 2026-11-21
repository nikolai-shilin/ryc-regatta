import { sendDuelHour } from '@/lib/push-send';
import { hourAt } from '@/lib/duel-hour';

// The duel hour's message (lib/duel-hour.ts, lib/push-send.ts sendDuelHour), sent by the cron in vercel.json at 18:45
// UTC, 15 minutes before the hour, to every sailor in for it. Vercel's cron calls it with Authorization: Bearer
// CRON_SECRET; it needs VAPID_PRIVATE_KEY and PUSH_LIST_KEY, as the daily reminder (app/push/remind) does.
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Not allowed', { status: 401 });
  // the day of the next hour (or of this one, called late): the one the sailors are in for
  const day = new Date(hourAt().start).toISOString().slice(0, 10);
  const out = await sendDuelHour(day);
  return Response.json(out, { status: out.error ? (out.error.startsWith('regatta') ? 502 : 500) : 200 });
}
