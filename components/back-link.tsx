'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { arriveLoaded, arriveWithin, goBack } from '@/public/game/trail.js';
import { IconBack } from './ui';

// The back arrow takes you to the page you came from, as the browser's back would, on every page; its href is only
// where it goes when there is none behind you (you opened the page from a link elsewhere, or typed it), and where a new
// tab goes. The trail it follows is public/game/trail.js, kept for the tab by <NavTrail /> in the layout and by the race.
let loaded = false;
let popped = false;

export function NavTrail() {
  const path = usePathname();
  useEffect(() => {
    const onPop = () => { popped = true; };
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) arriveLoaded({ pop: true }); }; // back from the browser's cache
    addEventListener('popstate', onPop);
    addEventListener('pageshow', onShow);
    return () => { removeEventListener('popstate', onPop); removeEventListener('pageshow', onShow); };
  }, []);
  useEffect(() => {
    if (!loaded) { loaded = true; arriveLoaded(); } else arriveWithin({ pop: popped });
    popped = false;
  }, [path]);
  return null;
}

export function useBack(fallback: string) {
  const router = useRouter();
  return () => goBack(fallback, (to) => router.push(to));
}

export function BackLink({ href, label, className = 'bt-back' }: { href: string; label: string; className?: string }) {
  const back = useBack(href);
  const go = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; // a new tab gets the href
    e.preventDefault();
    back();
  };
  return <Link className={className} href={href} onClick={go} aria-label={label}><IconBack /></Link>;
}
