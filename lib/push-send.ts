import webpush from 'web-push';
import { SITE } from './seo';
import { VAPID_PUBLIC } from './push';
import { isLang, tx, type Lang } from './lang';
import { levelName } from './levels';
import { provisional, shown } from './elo';
import { plainName } from './name';
import { hourMessage } from './duel-hour';

// Match found, sent to a sailor who asked to be looked for after leaving /duel (release 5b of the 1-on-1 plan;
// iyt-test supabase/migrations/20261121240000_regatta_away.sql). The site's server, having just made a pair
// (app/connect/seek/route.ts), asks regatta_pair_push for the away sailor's devices, once per pair and only with the
// key the daily reminder's list takes (PUSH_LIST_KEY), and sends each a push in its own language: who, level and
// rating, and the minute to say Ready. public/sw.js shows it; a tap opens /duel?resume, which picks the pair up. A
// device the push service says is gone is dropped (regatta_push_drop), as the daily reminder does.
// A sailor signed in with Telegram whom the bot may write to gets it from the bot as well (kind 'telegram', release 5c):
// the IYT server holds the bot's token, and is asked with the secret both share (REGATTA_NOTIFY_SECRET; iyt-test
// api/regatta-notify.mjs); its button opens /duel?resume inside Telegram, signed in from the launch data.
export type PushRow = { kind?: 'push' | 'telegram'; endpoint: string | null; p256dh: string | null; auth: string | null; telegram_id?: number | null;
  lang: string; them_name: string | null; them_rating: number; them_races: number; ttl: number };
const IYT = process.env.IYT_API_URL || 'https://iyt.rycrentals.com';

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

// the bot's words: the title and the body as one message, and its button
export function telegramNotice(r: PushRow) {
  const m = matchFoundMessage(r), t = tx(m.lang);
  return { telegram_id: r.telegram_id, text: `${m.title}\n${m.body}`,
    button: { text: t('Open Match found', 'Открыть: соперник найден', 'Abrir: rival encontrado', 'Öffnen: Gegner gefunden', 'Aç: rakip bulundu', 'Ouvrir : adversaire trouvé', 'Apri: avversario trovato', 'Abrir: adversário encontrado'), url: `${SITE}${m.url}` } };
}
const tell = (body: object) => fetch(`${IYT}/api/regatta-notify`, { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(10000),
  headers: { authorization: `Bearer ${process.env.REGATTA_NOTIFY_SECRET}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });

// the away sailor(s) of this pair told; how many messages went. Never throws: a message that doesn't go leaves the pair
// as it is (the sailor still finds it on /duel within its minute)
export async function sendMatchFound(pairId: string, send: typeof webpush.sendNotification = (s, p, o) => webpush.sendNotification(s, p, o), bot: (body: object) => Promise<Response> = tell): Promise<number> {
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
      if (row.kind === 'telegram') {
        if (!process.env.REGATTA_NOTIFY_SECRET || !row.telegram_id) return;
        try { if ((await bot(telegramNotice(row))).ok) sent++; } catch { /* the bot's server didn't answer: the pair still waits on /duel */ }
        return;
      }
      if (!row.endpoint || !row.p256dh || !row.auth) return;
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

// The duel hour's message (release 6d; lib/duel-hour.ts), 15 minutes before 19:00 UTC, to every sailor in for that
// day's hour: by the browsers tied to their account and from the bot, as they take Match found and not in their quiet
// hours, once each (regatta_hour_due marks them told). A device the push service says is gone is dropped.
export type HourRow = { kind: 'push' | 'telegram'; endpoint: string | null; p256dh: string | null; auth: string | null; telegram_id: number | null; lang: string; n_in: number };
export async function sendDuelHour(day: string, send: typeof webpush.sendNotification = (s, p, o) => webpush.sendNotification(s, p, o), bot: (body: object) => Promise<Response> = tell) {
  const key = process.env.PUSH_LIST_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!key || !priv) return { error: 'VAPID_PRIVATE_KEY or PUSH_LIST_KEY is not set' };
  const r = await sb('regatta_hour_due', { p_key: key, p_day: day });
  if (!r.ok) return { error: `regatta_hour_due: ${r.status}` };
  const rows: HourRow[] = await r.json();
  webpush.setVapidDetails(SITE, VAPID_PUBLIC, priv);
  let sent = 0, failed = 0, gone = 0;
  await Promise.all((Array.isArray(rows) ? rows : []).map(async (row) => {
    const m = hourMessage(row.lang, row.n_in);
    if (row.kind === 'telegram') {
      if (!process.env.REGATTA_NOTIFY_SECRET || !row.telegram_id) return;
      try { if ((await bot({ telegram_id: row.telegram_id, text: `${m.title}\n${m.body}`, button: { text: m.button, url: `${SITE}${m.url}` } })).ok) sent++; else failed++; } catch { failed++; }
      return;
    }
    if (!row.endpoint || !row.p256dh || !row.auth) return;
    try {
      await send({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify({ title: m.title, body: m.body, lang: m.lang, tag: m.tag, url: m.url }), { TTL: 75 * 60, urgency: 'high', topic: 'duel-hour' });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { gone++; await sb('regatta_push_drop', { p_endpoint: row.endpoint }).catch(() => {}); } else failed++;
    }
  }));
  return { day, due: Array.isArray(rows) ? rows.length : 0, sent, gone, failed };
}

// "A sailor at your level is looking" (release 8c; For you's live message): when a sailor starts looking and nobody near
// their rating is looking too, up to three sailors within 100 of them who raced a 1-on-1 lately are told (the database
// chooses: regatta_ping_due, one a day each at most, never in quiet hours, not to one who put "ready" out of their For
// you), by push and from the bot, with a tap that challenges the searcher at once. A searcher sets it off once in thirty
// minutes at most.
export type PingRow = { kind: 'push' | 'telegram'; endpoint: string | null; p256dh: string | null; auth: string | null; telegram_id: number | null;
  lang: string; them_name: string | null; them_rating: number; them_races: number; handle: string };
export function lookMessage(r: PingRow) {
  const lang: Lang = isLang(r.lang) ? r.lang : 'en', t = tx(lang);
  const who = plainName(r.them_name ?? '') || t('A sailor', 'Соперник', 'Un regatista', 'Ein Segler', 'Bir denizci', 'Un régatier', 'Un velista', 'Um velejador');
  const lvl = provisional(r.them_races) ? t('new to 1-on-1', 'новичок в 1 на 1', 'nuevo en 1 contra 1', 'neu im 1 gegen 1', 'bire birde yeni', 'nouveau en duel', 'nuovo all’1 contro 1', 'novo no 1 contra 1') : levelName(r.them_rating, lang);
  return {
    title: t(`${who} is looking for a race`, `${who} ищет гонку`, `${who} busca regata`, `${who} sucht eine Regatta`, `${who} yarış arıyor`, `${who} cherche une régate`, `${who} cerca una regata`, `${who} procura uma regata`),
    body: t(`${shown(r.them_rating, r.them_races)} · ${lvl}, near your rating. Tap to race them now.`, `${shown(r.them_rating, r.them_races)} · ${lvl}, рядом с твоим рейтингом. Нажми, чтобы сразиться.`, `${shown(r.them_rating, r.them_races)} · ${lvl}, cerca de tu rating. Toca para regatear ahora.`, `${shown(r.them_rating, r.them_races)} · ${lvl}, nahe deiner Wertung. Tippe, um jetzt zu segeln.`, `${shown(r.them_rating, r.them_races)} · ${lvl}, reytingine yakın. Şimdi yarışmak için dokun.`, `${shown(r.them_rating, r.them_races)} · ${lvl}, proche de ton classement. Touche pour régater maintenant.`, `${shown(r.them_rating, r.them_races)} · ${lvl}, vicino al tuo rating. Tocca per sfidarlo ora.`, `${shown(r.them_rating, r.them_races)} · ${lvl}, perto do seu rating. Toque para regatear agora.`),
    lang, tag: 'duel-look', url: `/duel?challenge=${r.handle}`,
    button: t('Race them', 'Сразиться', 'Regatear', 'Segeln', 'Yarış', 'Régater', 'Sfida', 'Regatear'),
  };
}
export async function sendLookPing(seeker: string, send: typeof webpush.sendNotification = (s, p, o) => webpush.sendNotification(s, p, o), bot: (body: object) => Promise<Response> = tell): Promise<number> {
  const key = process.env.PUSH_LIST_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!key || !priv || !/^[0-9a-f-]{36}$/i.test(seeker)) return 0;
  try {
    const r = await sb('regatta_ping_due', { p_key: key, p_seeker: seeker });
    if (!r.ok) return 0;
    const rows: PingRow[] = await r.json();
    if (!Array.isArray(rows) || !rows.length) return 0;
    webpush.setVapidDetails(SITE, VAPID_PUBLIC, priv);
    let sent = 0;
    await Promise.all(rows.map(async (row) => {
      if (!/^[0-9a-f]{12}$/.test(row.handle)) return;
      const m = lookMessage(row);
      if (row.kind === 'telegram') {
        if (!process.env.REGATTA_NOTIFY_SECRET || !row.telegram_id) return;
        try { if ((await bot({ telegram_id: row.telegram_id, text: `${m.title}\n${m.body}`, button: { text: m.button, url: `${SITE}${m.url}` } })).ok) sent++; } catch { /* the bot's server didn't answer */ }
        return;
      }
      if (!row.endpoint || !row.p256dh || !row.auth) return;
      try {
        await send({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify({ title: m.title, body: m.body, lang: m.lang, tag: m.tag, url: m.url }), { TTL: 300, urgency: 'high', topic: 'duel-look' });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await sb('regatta_push_drop', { p_endpoint: row.endpoint }).catch(() => {});
      }
    }));
    return sent;
  } catch { return 0; }
}
