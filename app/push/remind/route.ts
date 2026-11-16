import webpush from 'web-push';
import { dailyRace } from '@/lib/race';
import { venueOf } from '@/lib/venues';
import { yachtOf } from '@/lib/yachts';
import { todayTop } from '@/lib/today';
import { SITE } from '@/lib/seo';
import { VAPID_PUBLIC } from '@/lib/push';

// The daily reminder (lib/push.ts), sent by the cron in vercel.json at 17:00 UTC, seven hours before today's race
// closes: evening in Europe, afternoon in the Americas. To every browser that asked for it and hasn't finished today's
// race; a streak still alive is what it's about, else today's race itself and the time to beat.
//
// Vercel's cron calls it with Authorization: Bearer CRON_SECRET. It needs VAPID_PRIVATE_KEY (the private half of
// VAPID_PUBLIC) and PUSH_LIST_KEY (the key in Supabase's vault that regatta_push_due asks for).
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Row = { endpoint: string; p256dh: string; auth: string; lang: 'en' | 'ru'; last_day: string | null; streak: number };
const shift = (d: string, n: number) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const clock = (s: number) => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(1).padStart(4, '0')}`; };
const ruDays = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'день' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'дня' : 'дней');

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET, priv = process.env.VAPID_PRIVATE_KEY, key = process.env.PUSH_LIST_KEY;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Not allowed', { status: 401 });
  if (!priv || !key) return Response.json({ error: 'VAPID_PRIVATE_KEY or PUSH_LIST_KEY is not set' }, { status: 500 });
  webpush.setVapidDetails(SITE, VAPID_PUBLIC, priv);

  const d = dailyRace(), day = d.day;
  const sb = (fn: string, body: Record<string, unknown>) => fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST', cache: 'no-store',
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const due = await sb('regatta_push_due', { p_key: key, p_day: day });
  if (!due.ok) return Response.json({ error: `regatta_push_due: ${due.status}` }, { status: 502 });
  const rows: Row[] = await due.json();

  const venue = venueOf(d.venue).name, yacht = yachtOf(d.yacht).name;
  const top = await todayTop().catch(() => null);
  const best = top && top.d === day ? top.top[0] : null;
  const say = (r: Row) => {
    const ru = r.lang === 'ru', v = venue[ru ? 1 : 0], y = yacht[ru ? 1 : 0];
    // the streak is alive while no two days in a row are missed (lib/log.ts streakOf): yesterday's or the day before's
    const alive = r.streak >= 2 && r.last_day != null && r.last_day >= shift(day, -2);
    const title = alive
      ? ru ? `Серия: ${r.streak} ${ruDays(r.streak)} подряд` : `Keep your ${r.streak}-day streak`
      : ru ? `Гонка дня: ${v}` : `Today’s race: ${v}`;
    const body = alive
      ? ru ? `Гонка дня — ${v}, ${y}. Закроется через 7 часов.` : `Today’s race at ${v} on the ${y} closes in 7 hours.`
      : best
        ? ru ? `${y}. Время, которое надо побить: ${clock(best.s)}. Закроется через 7 часов.` : `The ${y}. The time to beat is ${clock(best.s)}. Closes in 7 hours.`
        : ru ? `${y}. Гонку ещё никто не прошёл: задай время дня.` : `The ${y}. Nobody has finished it yet: set the time to beat.`;
    return JSON.stringify({ title, body, lang: r.lang, tag: `daily-${day}`, url: `/race?from=push` });
  };

  let sent = 0, failed = 0;
  const gone: string[] = [];
  for (let i = 0; i < rows.length; i += 25) {
    await Promise.all(rows.slice(i, i + 25).map((r) =>
      webpush.sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, say(r), { TTL: 6 * 3600, urgency: 'normal' })
        .then(() => { sent++; })
        .catch((e: { statusCode?: number }) => { if (e.statusCode === 404 || e.statusCode === 410) gone.push(r.endpoint); else failed++; })));
  }
  // the subscriptions the push service says are gone (the browser unsubscribed, the site's data cleared)
  await Promise.all(gone.map((endpoint) => sb('regatta_push_drop', { p_endpoint: endpoint }).catch(() => null)));
  return Response.json({ day, due: rows.length, sent, gone: gone.length, failed });
}
