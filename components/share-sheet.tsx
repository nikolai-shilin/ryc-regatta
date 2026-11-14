'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { tx, type Lang } from '@/lib/lang';
import { SHARE_TARGETS, canSms, copyText, nativeShare, openShare, shareHref, tagged, type ShareData, type ShareTarget } from '@/lib/share';
import { IconSend, IconCheck } from './ui';

// The apps' marks, white on each app's colour (24px grid)
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
const IconLink = () => <svg viewBox="0 0 24 24" width={20} height={20} {...L} aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>;
const IconMore = () => <svg viewBox="0 0 24 24" width={20} height={20} {...F} aria-hidden="true"><circle cx="5.5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="18.5" cy="12" r="1.8" /></svg>;

// The Share button and its sheet: the apps one by one, the link to copy, and the phone's own sheet for the rest.
// data: what's shared, built when the button is pressed (the link's origin is the page's, known only in the browser).
export function ShareButton({ lang, data, className = 'bt-show', title }: { lang: Lang; data: () => ShareData; className?: string; title?: string }) {
  const t = tx(lang);
  const [open, setOpen] = useState<ShareData | null>(null);
  const [copied, setCopied] = useState(false);
  const [more, setMore] = useState(false); // the phone has a share sheet of its own
  const [sms, setSms] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<Element | null>(null);

  useEffect(() => { setMore(typeof navigator !== 'undefined' && !!navigator.share); setSms(canSms()); }, []);
  // the sheet goes in the screen's root: under the card's blur a fixed box would be the card's size, and there it
  // keeps the screen's colours
  const show = () => {
    setHost(btn.current?.closest('.scr') || document.body);
    setOpen(data()); setCopied(false);
  };
  const close = () => { setOpen(null); btn.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>('a, button')?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [open]);

  const copy = async () => {
    if (!open) return;
    if (await copyText(`${open.text} ${tagged(open.url, 'copy')}`)) { setCopied(true); setTimeout(() => setCopied(false), 2500); }
  };
  const native = async () => {
    if (!open) return;
    const r = await nativeShare(open);
    if (r) close();
  };

  const targets = SHARE_TARGETS.filter((a) => a.id !== 'sms' || sms);
  const sheet = open && host && createPortal(
    <div className="shr" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="shr-p" role="dialog" aria-modal="true" aria-label={title || t('Share', 'Поделиться')} ref={panel}>
        <div className="shr-h">
          <b>{title || t('Share', 'Поделиться')}</b>
          <button type="button" className="shr-x" onClick={close} aria-label={t('Close', 'Закрыть')}>×</button>
        </div>
        <p className="shr-l">{open.text}</p>
        <div className="shr-g">
          {targets.map((a) => (
            <a key={a.id} className="shr-a" href={shareHref(a.id, open)} target={a.id === 'email' || a.id === 'sms' ? undefined : '_blank'} rel="noopener noreferrer"
              onClick={(e) => { if (openShare(a.id, open)) e.preventDefault(); close(); }}>
              <span className="shr-i" style={{ background: a.color }}><svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true">{MARKS[a.id]}</svg></span>
              <span>{a.id === 'email' ? t('Email', 'Почта') : a.name}</span>
            </a>
          ))}
          <button type="button" className="shr-a" onClick={copy}>
            <span className="shr-i shr-i-n">{copied ? <IconCheck s={20} /> : <IconLink />}</span>
            <span aria-live="polite">{copied ? t('Copied', 'Скопировано') : t('Copy link', 'Ссылка')}</span>
          </button>
          {more && (
            <button type="button" className="shr-a" onClick={native}>
              <span className="shr-i shr-i-n"><IconMore /></span>
              <span>{t('More', 'Ещё')}</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    host,
  );

  return (
    <>
      <button type="button" ref={btn} className={className} onClick={show} aria-haspopup="dialog" aria-expanded={!!open}>
        <IconSend s={15} /><span>{t('Share', 'Поделиться')}</span>
      </button>
      {sheet}
    </>
  );
}
