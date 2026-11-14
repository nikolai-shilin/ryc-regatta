// Sharing a link to one app at a time: each app's own "share" address, opened in a new tab (or, in Telegram's mini
// app, through Telegram), so the link lands in the chat or post with its line already written. The page's share card
// (app/og/…) is what the app then shows under it. utm_source says in the analytics which app a visit came from.

export type ShareTarget = 'telegram' | 'whatsapp' | 'facebook' | 'x' | 'vk' | 'linkedin' | 'email' | 'sms';
export type ShareData = { url: string; text: string; title?: string };

export const SHARE_TARGETS: { id: ShareTarget; name: string; color: string }[] = [
  { id: 'telegram', name: 'Telegram', color: '#26a5e4' },
  { id: 'whatsapp', name: 'WhatsApp', color: '#25d366' },
  { id: 'facebook', name: 'Facebook', color: '#1877f2' },
  { id: 'x', name: 'X', color: '#000000' },
  { id: 'vk', name: 'VK', color: '#0077ff' },
  { id: 'linkedin', name: 'LinkedIn', color: '#0a66c2' },
  { id: 'email', name: 'Email', color: '#6d7a7e' },
  { id: 'sms', name: 'SMS', color: '#34c759' },
];

// the link with the app it went to as utm_source (and the page's own utm_medium kept)
export function tagged(url: string, source: string) {
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', source);
    return u.toString();
  } catch { return url; }
}

const q = encodeURIComponent;

// the app's share address for this link and line
export function shareHref(target: ShareTarget, { url, text, title }: ShareData): string {
  const link = tagged(url, target);
  switch (target) {
    case 'telegram': return `https://t.me/share/url?url=${q(link)}&text=${q(text)}`;
    // WhatsApp and SMS take one message: the line, then the link, which the chat turns into its card
    case 'whatsapp': return `https://wa.me/?text=${q(`${text} ${link}`)}`;
    // Facebook reads everything from the page's own card: it takes the link only
    case 'facebook': return `https://www.facebook.com/sharer/sharer.php?u=${q(link)}`;
    case 'x': return `https://x.com/intent/post?text=${q(text)}&url=${q(link)}`;
    case 'vk': return `https://vk.com/share.php?url=${q(link)}&title=${q(text)}`;
    case 'linkedin': return `https://www.linkedin.com/sharing/share-offsite/?url=${q(link)}`;
    case 'email': return `mailto:?subject=${q(title || text)}&body=${q(`${text}\n\n${link}`)}`;
    // iOS reads the body after "&", Android after "?": "?&" works on both
    case 'sms': return `sms:?&body=${q(`${text} ${link}`)}`;
  }
}

// SMS only where there's a phone to send it from
export const canSms = () => typeof navigator !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent);

type TgApp = { initData?: string; openTelegramLink?: (u: string) => void; openLink?: (u: string) => void };
const tgApp = (): TgApp | null => {
  const w = typeof window !== 'undefined' ? (window as unknown as { Telegram?: { WebApp?: TgApp } }) : null;
  const app = w?.Telegram?.WebApp;
  return app && app.initData ? app : null;
};

// Opens the app's share address. Returns false when the browser should follow the link itself (an ordinary page),
// true when it was opened another way: in Telegram's mini app a new tab can't open, so Telegram opens it.
export function openShare(target: ShareTarget, data: ShareData): boolean {
  const href = shareHref(target, data);
  const tg = tgApp();
  if (!tg) return false;
  if (href.startsWith('https://t.me/') && tg.openTelegramLink) tg.openTelegramLink(href);
  else if (href.startsWith('https://') && tg.openLink) tg.openLink(href);
  else location.href = href;
  return true;
}

// Copies the line and the link. The clipboard API first, then, where there's none (Telegram's webview, an embedded
// browser), the old way through a selected field.
export async function copyText(line: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(line); return true; } catch {}
  const f = document.createElement('textarea');
  f.value = line; f.setAttribute('readonly', ''); f.style.position = 'fixed'; f.style.opacity = '0';
  document.body.append(f); f.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch {}
  f.remove();
  return ok;
}

// The phone's own share sheet, for every other app. false if there's none or it failed; null if the user closed it.
export async function nativeShare({ url, text, title }: ShareData): Promise<boolean | null> {
  if (typeof navigator === 'undefined' || !navigator.share) return false;
  try { await navigator.share({ title, text, url: tagged(url, 'native') }); return true; }
  catch (e) { return (e as Error)?.name === 'AbortError' ? null : false; }
}
