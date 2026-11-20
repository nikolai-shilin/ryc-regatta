import webpush from 'web-push';
import { dailyRace } from '@/lib/race';
import { venueOf } from '@/lib/venues';
import { yachtOf } from '@/lib/yachts';
import { todayTop } from '@/lib/today';
import { SITE } from '@/lib/seo';
import { clock } from '@/lib/clock';
import { VAPID_PUBLIC } from '@/lib/push';
import { pick } from '@/lib/lang';

// The daily reminder (lib/push.ts), sent by the cron in vercel.json at 17:00 UTC, seven hours before today's race
// closes: evening in Europe, afternoon in the Americas. To every browser that asked for it and hasn't finished today's
// race; a streak still alive is what it's about, else today's race itself and the time to beat.
//
// Vercel's cron calls it with Authorization: Bearer CRON_SECRET. It needs VAPID_PRIVATE_KEY (the private half of
// VAPID_PUBLIC) and PUSH_LIST_KEY (the key in Supabase's vault that regatta_push_due asks for).
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Row = { endpoint: string; p256dh: string; auth: string; lang: 'en' | 'ru' | 'es' | 'de' | 'tr' | 'fr' | 'it' | 'pt'; last_day: string | null; streak: number };
const shift = (d: string, n: number) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
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
    const ru = r.lang === 'ru', es = r.lang === 'es', de = r.lang === 'de', tr = r.lang === 'tr', fr = r.lang === 'fr', it = r.lang === 'it', pt = r.lang === 'pt', v = pick(venue, r.lang), y = pick(yacht, r.lang);
    // the streak is alive while no two days in a row are missed (lib/log.ts streakOf): yesterday's or the day before's
    const alive = r.streak >= 2 && r.last_day != null && r.last_day >= shift(day, -2);
    const title = alive
      ? ru ? `Серия: ${r.streak} ${ruDays(r.streak)} подряд` : es ? `Mantén tu racha de ${r.streak} días` : de ? `Halte deine Serie von ${r.streak} Tagen` : tr ? `${r.streak} günlük serini koru` : fr ? `Garde ta série de ${r.streak} jours` : it ? `Mantieni la tua serie di ${r.streak} giorni` : pt ? `Mantenha sua sequência de ${r.streak} dias` : `Keep your ${r.streak}-day streak`
      : ru ? `Гонка дня: ${v}` : es ? `La regata del día: ${v}` : de ? `Die Regatta des Tages: ${v}` : tr ? `Günün yarışı: ${v}` : fr ? `La régate du jour : ${v}` : it ? `La regata del giorno: ${v}` : pt ? `A regata do dia: ${v}` : `Today’s race: ${v}`;
    const body = alive
      ? ru ? `Гонка дня — ${v}, ${y}. Закроется через 7 часов.` : es ? `La regata del día en ${v} con el ${y} cierra en 7 horas.` : de ? `Die Regatta des Tages in ${v} mit der ${y} schließt in 7 Stunden.` : tr ? `${v}'deki ${y} ile günün yarışı 7 saat sonra kapanıyor.` : fr ? `La régate du jour à ${v} en ${y} ferme dans 7 heures.` : it ? `La regata del giorno a ${v} con ${y} chiude tra 7 ore.` : pt ? `A regata do dia em ${v} com o ${y} fecha em 7 horas.` : `Today’s race at ${v} on the ${y} closes in 7 hours.`
      : best
        ? ru ? `${y}. Время, которое надо побить: ${clock(best.s)}. Закроется через 7 часов.` : es ? `El ${y}. El tiempo a batir es ${clock(best.s)}. Cierra en 7 horas.` : de ? `${y}. Die Zeit zum Schlagen ist ${clock(best.s)}. Schließt in 7 Stunden.` : tr ? `${y}. Geçilecek süre ${clock(best.s)}. 7 saat sonra kapanıyor.` : fr ? `${y}. Le temps à battre : ${clock(best.s)}. Ferme dans 7 heures.` : it ? `${y}. Il tempo da battere: ${clock(best.s)}. Chiude tra 7 ore.` : pt ? `${y}. O tempo a bater: ${clock(best.s)}. Fecha em 7 horas.` : `The ${y}. The time to beat is ${clock(best.s)}. Closes in 7 hours.`
        : ru ? `${y}. Гонку ещё никто не прошёл: задай время дня.` : es ? `El ${y}. Nadie la ha terminado todavía: marca el tiempo a batir.` : de ? `${y}. Noch hat niemand sie beendet: setz die Zeit zum Schlagen.` : tr ? `${y}. Henüz kimse bitirmedi: geçilecek süreyi sen belirle.` : fr ? `${y}. Personne ne l’a encore finie : à toi de fixer le temps à battre.` : it ? `${y}. Nessuno l’ha ancora finita: fissa tu il tempo da battere.` : pt ? `${y}. Ninguém terminou ainda: defina você o tempo a bater.` : `The ${y}. Nobody has finished it yet: set the time to beat.`;
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
