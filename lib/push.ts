import { streakOf, type Log } from './log';
import type { Lang } from './lang';

// The daily reminder, in the browser: a web push this browser asks for (components/push-button.tsx), sent once a day
// in the afternoon (UTC) by app/push/remind to those who haven't finished today's race, and shown by public/sw.js.
//
// The subscription is kept in Supabase (public.regatta_push, reached only through its functions), with the last day of
// today's race this browser finished and the streak then, so the reminder can say what is at stake and skip those who
// have sailed: PushSync sends both again whenever they change. Straight to Supabase's REST API with the publishable
// key, as the functions allow it: no Supabase client in the page.

// The VAPID public key: the server's private half is VAPID_PRIVATE_KEY (app/push/remind). Not a secret.
export const VAPID_PUBLIC = 'BC4sG5MyE2jDQO84LgK8zrNq2xT7hcS7jvyOrbHE-7GCynZk2TCmD7vWght2DcxARJyvpzPXr_HhpqpaFHi04GE';
const SYNC_KEY = 'regatta-push'; // what was last sent for this browser's subscription: endpoint|last day|streak|lang

const rpc = (fn: string, body: Record<string, unknown>) =>
  fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST', keepalive: true,
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

// Can this browser take a push at all: not iOS Safari in a tab (only once the site is added to the Home Screen), not
// an old browser, not a page that isn't a secure context.
export const pushable = () =>
  typeof window !== 'undefined' && window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export async function currentSub(): Promise<PushSubscription | null> {
  if (!pushable()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ? reg.pushManager.getSubscription() : null;
}

const lastDay = (log: Log | null) => (log ? Object.keys(log.d).sort().at(-1) ?? null : null);
const syncKey = (endpoint: string, log: Log | null, lang: Lang) => `${endpoint}|${lastDay(log) ?? ''}|${log ? streakOf(log.d).n : 0}|${lang}`;
const read = () => { try { return localStorage.getItem(SYNC_KEY); } catch { return null; } };
const write = (v: string | null) => { try { if (v) localStorage.setItem(SYNC_KEY, v); else localStorage.removeItem(SYNC_KEY); } catch {} };

async function save(sub: PushSubscription, lang: Lang, log: Log | null) {
  const j = sub.toJSON();
  if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) return false;
  const r = await rpc('regatta_push_save', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_lang: lang, p_last: lastDay(log), p_streak: log ? streakOf(log.d).n : 0 });
  if (r.ok) write(syncKey(j.endpoint, log, lang));
  return r.ok;
}

const key = (b64: string) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

// Ask for the reminder: the browser's permission, the service worker, the subscription, and the row that keeps it.
// 'denied' when the browser (or the reader) says no; 'failed' when the push service or the save didn't answer.
export async function subscribe(lang: Lang, log: Log | null): Promise<'on' | 'denied' | 'failed'> {
  if (!pushable()) return 'failed';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(VAPID_PUBLIC) }));
    return (await save(sub, lang, log)) ? 'on' : 'failed';
  } catch {
    return 'failed';
  }
}

export async function unsubscribe() {
  const sub = await currentSub();
  write(null);
  if (!sub) return;
  await rpc('regatta_push_drop', { p_endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

// On every page (components/push-sync.tsx): when the day last finished, the streak or the language has changed since
// it was last sent, send them again. Nothing at all for a browser that never asked.
export async function pushSync(lang: Lang, log: Log) {
  if (!pushable() || Notification.permission !== 'granted') return;
  const sub = await currentSub();
  if (!sub || read() === syncKey(sub.endpoint, log, lang)) return;
  await save(sub, lang, log).catch(() => {});
}
