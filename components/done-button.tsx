'use client';
import { useRouter } from 'next/navigation';

// Done on a page you open on the way somewhere (Settings): back where you came from on this site, else the race hub.
// Every change is already saved as you make it, so Done only leaves.
export function DoneButton({ label, fallback = '/race' }: { label: string; fallback?: string }) {
  const router = useRouter();
  const done = () => {
    let same = false;
    try { same = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch {}
    if (same && history.length > 1) router.back(); else router.push(fallback);
  };
  return <button type="button" className="done-btn" onClick={done}>{label}</button>;
}
