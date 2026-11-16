'use client';
import { useEffect } from 'react';
import type { Lang } from '@/lib/lang';
import { harvest, passport } from '@/lib/log';
import { passportShare } from './passport';

// /passport opened with no shared passport in its address (from the footer, typed in): yours instead, from this device's
// log, as the address you'd share, so the page shows your venues lit rather than none. Nothing raced yet: it stays empty.
export function OwnPassport({ lang }: { lang: Lang }) {
  useEffect(() => {
    const log = harvest();
    if (!passport(log).n) return;
    location.replace(passportShare(log, lang).url);
  }, [lang]);
  return null;
}
