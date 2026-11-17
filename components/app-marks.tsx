import type { ReactNode } from 'react';
import type { ShareTarget } from '@/lib/share';

// The apps' marks, drawn in currentColor on a 24px grid: white on each app's colour in the share sheet
// (components/share-sheet.tsx) and on the channels' cards (/social)
const F = { fill: 'currentColor' };
const L = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const MARKS: Record<ShareTarget, ReactNode> = {
  telegram: <path {...F} d="M20.7 4.2 2.9 11.1c-1.2.5-1.2 1.2-.2 1.5l4.6 1.4 1.7 5.4c.2.6.4.8.9.8.4 0 .6-.2.9-.4l2.2-2.1 4.6 3.4c.8.5 1.4.2 1.6-.8l3-14.3c.3-1.3-.5-1.8-1.5-1.4zM9.4 14.3l8.8-5.6c.4-.3.8-.1.5.2l-7.3 6.6-.3 3z" />,
  whatsapp: <><path {...L} d="M4 20l1.2-3.6A8 8 0 1 1 8 19z" /><path {...F} d="M9 7.8c.2-.4.4-.4.7-.4h.5c.2 0 .4 0 .5.4l.7 1.7c.1.2 0 .4-.1.6l-.5.6c-.1.1-.2.3 0 .5.7 1.2 1.6 2 2.8 2.6.2.1.4.1.5 0l.6-.8c.2-.2.3-.2.6-.1l1.6.8c.3.1.4.2.4.4 0 .5-.2 1.2-.6 1.5-.5.4-1.3.7-2.2.5-1.9-.5-4.2-2.2-5.4-4.3-.7-1.2-.7-2.4-.1-3.1z" /></>,
  facebook: <path {...F} d="M13.4 21v-7.6H16l.4-3h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.7v3h2.6V21z" />,
  x: <path {...F} d="M17.2 3.5h3l-6.6 7.5 7.7 9.5h-6l-4.7-6.1-5.4 6.1h-3l7-8L1.9 3.5h6.2l4.3 5.6zm-1 15.3h1.7L7.1 5.1H5.3z" />,
  vk: <path {...F} d="M12.8 17.5c-5.6 0-8.8-3.8-8.9-10.2h2.8c.1 4.7 2.2 6.6 3.8 7V7.3h2.6v4c1.6-.2 3.3-2 3.8-4h2.6c-.4 2.5-2.2 4.3-3.5 5 1.3.6 3.3 2.2 4.1 5.2h-2.9c-.6-2-2.2-3.5-4.1-3.7v3.7z" />,
  linkedin: <><circle {...F} cx="6" cy="6" r="1.8" /><path {...F} d="M4.4 9.4h3.2V20H4.4zM9.8 9.4h3.1v1.5c.4-.8 1.5-1.7 3.1-1.7 3.3 0 3.9 2.2 3.9 5V20h-3.2v-5.2c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V20H9.8z" /></>,
  email: <><rect {...L} x="3" y="5.5" width="18" height="13" rx="2" /><path {...L} d="m3.5 7 8.5 6 8.5-6" /></>,
  sms: <path {...L} d="M5 18.5V17a7.5 7 0 1 1 3 1.3L4 20z" />,
};

export const AppMark = ({ app, s = 22 }: { app: ShareTarget; s?: number }) => (
  <svg viewBox="0 0 24 24" width={s} height={s} aria-hidden="true">{MARKS[app]}</svg>
);
