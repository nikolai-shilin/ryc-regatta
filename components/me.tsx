'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { applyMe } from '@/lib/me';

// Re-reads who is signed in (lib/me.ts) after each navigation and router.refresh(): signing in with a code or from
// Telegram, or changing the ranking name, happen without a page load, and the cached pages can't say it themselves.
export function Me() {
  usePathname(); // a new page draws this again
  useEffect(() => applyMe());
  return null;
}
