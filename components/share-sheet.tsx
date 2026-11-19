'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { tx, type Lang } from '@/lib/lang';
import { SHARE_TARGETS, canSms, copyText, nativeShare, openShare, shareHref, tagged, type ShareData, type ShareTarget } from '@/lib/share';
import { IconSend, IconCheck } from './ui';
import { AppMark } from './app-marks';
import { track } from '@/lib/track';

// what was shared (its path: /race/result, /players) and where to, for the analytics
const shared = (url: string, via: string) => { try { track('Share', { what: new URL(url).pathname.split('/').slice(0, 3).join('/'), via }); } catch {} };

const L = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const F = { fill: 'currentColor' };
const IconLink = ({ s = 20 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...L} aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>;
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
    if (await copyText(`${open.text} ${tagged(open.url, 'copy')}`)) { shared(open.url, 'copy'); setCopied(true); setTimeout(() => setCopied(false), 2500); }
  };
  const native = async () => {
    if (!open) return;
    const r = await nativeShare(open);
    if (r) { shared(open.url, 'native'); close(); }
  };

  const targets = SHARE_TARGETS.filter((a) => a.id !== 'sms' || sms);
  const sheet = open && host && createPortal(
    <div className="shr" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="shr-p" role="dialog" aria-modal="true" aria-label={title || t('Share', 'Поделиться', 'Compartir')} ref={panel}>
        <div className="shr-h">
          <b>{title || t('Share', 'Поделиться', 'Compartir')}</b>
          <button type="button" className="shr-x" onClick={close} aria-label={t('Close', 'Закрыть', 'Cerrar')}>×</button>
        </div>
        <p className="shr-l">{open.text}</p>
        <div className="shr-g">
          {targets.map((a) => (
            <a key={a.id} className="shr-a" href={shareHref(a.id, open)} target={a.id === 'email' || a.id === 'sms' ? undefined : '_blank'} rel="noopener noreferrer"
              onClick={(e) => { shared(open.url, a.id); if (openShare(a.id, open)) e.preventDefault(); close(); }}>
              <span className="shr-i" style={{ background: a.color }}><AppMark app={a.id} s={22} /></span>
              <span>{a.id === 'email' ? t('Email', 'Почта', 'Correo') : a.name}</span>
            </a>
          ))}
          <button type="button" className="shr-a" onClick={copy}>
            <span className="shr-i shr-i-n">{copied ? <IconCheck s={20} /> : <IconLink />}</span>
            <span aria-live="polite">{copied ? t('Copied', 'Скопировано', 'Copiado') : t('Copy link', 'Ссылка', 'Copiar enlace')}</span>
          </button>
          {more && (
            <button type="button" className="shr-a" onClick={native}>
              <span className="shr-i shr-i-n"><IconMore /></span>
              <span>{t('More', 'Ещё', 'Más')}</span>
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
        <IconSend s={15} /><span>{t('Share', 'Поделиться', 'Compartir')}</span>
      </button>
      {sheet}
    </>
  );
}

// Copy link, beside Share: the link Share would send, on the clipboard as it is, then Copied for a moment
export function CopyLink({ lang, data, className = 'bt-show' }: { lang: Lang; data: () => ShareData; className?: string }) {
  const t = tx(lang);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const d = data();
    if (await copyText(tagged(d.url, 'copy'))) { shared(d.url, 'copy'); setCopied(true); setTimeout(() => setCopied(false), 2500); }
  };
  return (
    <button type="button" className={className} onClick={copy}>
      {copied ? <IconCheck s={15} /> : <IconLink s={15} />}<span aria-live="polite">{copied ? t('Copied', 'Скопировано', 'Copiado') : t('Copy link', 'Скопировать ссылку', 'Copiar enlace')}</span>
    </button>
  );
}
