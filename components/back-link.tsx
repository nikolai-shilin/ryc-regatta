'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { IconBack } from './ui';

// The back arrow in the top bar takes you to the page you came from on this site, as the browser's back would; its
// href is only where it goes when there is none (you opened the page from a link elsewhere, or typed it). The race
// itself (/play) is never gone back to: from the result, back is the href, as before.
//
// The trail is this tab's pages on the site since it last loaded one in full, kept by <NavTrail /> in the layout: a
// full load starts it from the referrer (when it is this site), a link pushes, the browser's back (or this arrow) pops.
let trail: string[] = [];
let popped = false;

export function NavTrail() {
  const path = usePathname();
  useEffect(() => {
    const onPop = () => { popped = true; };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    if (!trail.length) {
      try {
        const r = document.referrer ? new URL(document.referrer) : null;
        if (r && r.origin === location.origin && r.pathname !== path) trail.push(r.pathname);
      } catch {}
      trail.push(path);
    } else if (trail[trail.length - 1] !== path) {
      if (popped && trail[trail.length - 2] === path) trail.pop(); else trail.push(path);
    }
    popped = false;
  }, [path]);
  return null;
}

const canGoBack = () => {
  const prev = trail[trail.length - 2];
  return !!prev && !prev.startsWith('/play') && history.length > 1;
};

export function BackLink({ href, label, className = 'bt-back' }: { href: string; label: string; className?: string }) {
  const router = useRouter();
  const go = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; // a new tab gets the href
    if (!canGoBack()) return;
    e.preventDefault();
    router.back();
  };
  return <Link className={className} href={href} onClick={go} aria-label={label}><IconBack /></Link>;
}
