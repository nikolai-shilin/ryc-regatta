'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { applyMe, readMe } from '@/lib/me';
import { initials } from '@/lib/name';
import { tx, type Lang } from '@/lib/lang';

// Re-reads who is signed in (lib/me.ts) after each navigation and router.refresh(): signing in with a code or from
// Telegram, or changing the ranking name, happen without a page load, and the cached pages can't say it themselves.
export function Me() {
  usePathname(); // a new page draws this again
  useEffect(() => applyMe());
  return null;
}

// Who is signed in, for the parts of a cached page that say more than the initials (the pause card's account, the
// result page's "(you)"): from the session cookie, after the page is up (null until then, and for a guest).
export type Who = { name: string; email: string; via: string; initials: string } | null;
export function useWho(lang: Lang): Who {
  const path = usePathname();
  const [who, setWho] = useState<Who>(null);
  useEffect(() => {
    const me = readMe(), t = tx(lang);
    setWho(me && { name: me.name, email: me.email, initials: initials(me.name, me.email),
      via: me.provider === 'google' ? 'Google' : me.provider === 'telegram' ? 'Telegram' : t('email code', 'код по почте', 'código por correo', 'E-Mail-Code', 'e-posta kodu') });
  }, [lang, path]);
  return who;
}
