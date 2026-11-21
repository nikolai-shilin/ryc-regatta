import webpush from 'web-push';
import { SITE } from './seo';
import { VAPID_PUBLIC } from './push';
import { isLang, tx, type Lang } from './lang';
import { levelName } from './levels';
import { provisional, shown } from './elo';
import { plainName } from './name';

// Match found, sent to a sailor who asked to be looked for after leaving /duel (release 5b of the 1-on-1 plan;
// iyt-test supabase/migrations/20261121240000_regatta_away.sql). The site's server, having just made a pair
// (app/connect/seek/route.ts), asks regatta_pair_push for the away sailor's devices, once per pair and only with the
// key the daily reminder's list takes (PUSH_LIST_KEY), and sends each a push in its own language: who, level and
// rating, and the minute to say Ready. public/sw.js shows it; a tap opens /duel?resume, which picks the pair up. A
// device the push service says is gone is dropped (regatta_push_drop), as the daily reminder does.
export type PushRow = { endpoint: string; p256dh: string; auth: string; lang: string; them_name: string | null; them_rating: number; them_races: number; ttl: number };

export function matchFoundMessage(r: PushRow) {
  const lang: Lang = isLang(r.lang) ? r.lang : 'en', t = tx(lang);
  const who = plainName(r.them_name ?? '') || t('A sailor', 'Соперник', 'Un regatista', 'Ein Segler', 'Bir denizci', 'Un marin', 'Un velista', 'Um velejador');
  const lvl = provisional(r.them_races) ? t('new to 1-on-1', 'новичок в 1 на 1', 'nuevo en 1 contra 1', 'neu im 1 gegen 1', 'bire birde yeni', 'nouveau en duel', 'nuovo all’1 contro 1', 'novo no 1 contra 1') : levelName(r.them_rating, lang);
  const secs = Math.max(10, r.ttl);
  return {
    title: t(`Match found: ${who}`, `Соперник найден: ${who}`, `Rival encontrado: ${who}`, `Gegner gefunden: ${who}`, `Rakip bulundu: ${who}`, `Adversaire trouvé : ${who}`, `Avversario trovato: ${who}`, `Adversário encontrado: ${who}`),
    body: t(`${shown(r.them_rating, r.them_races)} · ${lvl}. Tap within ${secs} s to say Ready.`, `${shown(r.them_rating, r.them_races)} · ${lvl}. Нажми в течение ${secs} с, чтобы ответить «Готов».`, `${shown(r.them_rating, r.them_races)} · ${lvl}. Toca en ${secs} s para decir Listo.`, `${shown(r.them_rating, r.them_races)} · ${lvl}. Tippe innerhalb von ${secs} s, um Bereit zu sagen.`, `${shown(r.them_rating, r.them_races)} · ${lvl}. Hazırım demek için ${secs} sn içinde dokun.`, `${shown(r.them_rating, r.them_races)} · ${lvl}. Touche dans les ${secs} s pour dire Prêt.`, `${shown(r.them_rating, r.them_races)} · ${lvl}. Tocca entro ${secs} s per dire Pronto.`, `${shown(r.them_rating, r.them_races)} · ${lvl}. Toque em até ${secs} s para dizer Pronto.`),
    lang, tag: 'duel-found', url: '/duel?resume', sticky: true,
  };
}

const sb = (fn: string, body: Record<string, unknown>) => fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/${fn}`, {
  method: 'POST', cache: 'no-store',
  headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// the away sailor(s) of this pair told; how many pushes went. Never throws: a message that doesn't go leaves the pair
// as it is (the sailor still finds it on /duel within its minute)
export async function sendMatchFound(pairId: string, send: typeof webpush.sendNotification = (s, p, o) => webpush.sendNotification(s, p, o)): Promise<number> {
  const key = process.env.PUSH_LIST_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!key || !priv) return 0;
  try {
    const r = await sb('regatta_pair_push', { p_key: key, p_pair: pairId });
    if (!r.ok) return 0;
    const rows: PushRow[] = await r.json();
    if (!Array.isArray(rows) || !rows.length) return 0;
    webpush.setVapidDetails(SITE, VAPID_PUBLIC, priv);
    let sent = 0;
    await Promise.all(rows.map(async (row) => {
      try {
        await send({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify(matchFoundMessage(row)), { TTL: Math.max(10, row.ttl), urgency: 'high', topic: 'duel-found' });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await sb('regatta_push_drop', { p_endpoint: row.endpoint }).catch(() => {});
      }
    }));
    return sent;
  } catch { return 0; }
}
