'use client';
import { useBack } from './back-link';

// Done on a page you open on the way somewhere (Settings): back where you came from, as the back arrow, else the race hub.
// Every change is already saved as you make it, so Done only leaves.
export function DoneButton({ label, fallback = '/race' }: { label: string; fallback?: string }) {
  const done = useBack(fallback);
  return <button type="button" className="done-btn" onClick={done}>{label}</button>;
}
