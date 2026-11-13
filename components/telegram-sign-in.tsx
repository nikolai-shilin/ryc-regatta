'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// From the IYT mini app the site opens with Telegram's launch data, which the head script in app/layout keeps in
// sessionStorage. Once per launch data it goes to /auth/telegram, which signs the player in; then the page is drawn
// again with their account. A refusal (launch data older than a day) is not asked again; a failure is, on the next page.
const LAUNCH = '__telegram__initParams', DONE = 'regatta-tg-signin';

export function TelegramSignIn() {
  const router = useRouter();
  useEffect(() => {
    let initData = '';
    try { initData = String(JSON.parse(sessionStorage.getItem(LAUNCH) || '{}')?.tgWebAppData || ''); } catch {}
    if (!initData) return;
    const id = new URLSearchParams(initData).get('hash') || initData.slice(-64);
    try { if (sessionStorage.getItem(DONE) === id) return; } catch {}
    const done = () => { try { sessionStorage.setItem(DONE, id); } catch {} };
    fetch('/auth/telegram', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ initData }) })
      .then(async (r) => {
        if (r.status >= 500) return;
        done();
        if (r.ok && (await r.json()).changed) router.refresh();
      })
      .catch(() => {});
  }, [router]);
  return null;
}
