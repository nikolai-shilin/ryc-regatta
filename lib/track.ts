import { track as vaTrack } from '@vercel/analytics';

// A Vercel Web Analytics event, never dropped: @vercel/analytics' track() sends only once window.va is there, and the
// <Analytics /> in the layout sets it up in its own effect, which runs after a page's own (a child's effects first). So
// an event sent as a page comes up (the result's Race finish) was lost. The queue set up here is the one the package's
// own sets up (initQueue), which its script reads as it loads.
type Props = Record<string, string | number | boolean | null>;
export function track(name: string, data?: Props) {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { va?: (...a: unknown[]) => void; vaq?: unknown[][] };
  if (!w.va) w.va = function (...a: unknown[]) { (w.vaq = w.vaq || []).push(a); };
  vaTrack(name, data);
}
