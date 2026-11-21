'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSceneStart } from '@/lib/scene-start';

// A word of sailing sailed on the water, in 3D: the race's own scene for it (public/word-view, game/word-scenes.js),
// in the sailing dictionary's pages (app/[lang]/dictionary). It starts once the page has loaded and gone idle, and
// draws nothing while scrolled out of sight. With `tour`, the dictionary's own page: it goes from word to word every
// few seconds, the one shown named over it as a link to its page.
//
// The page is all there without it: the words are in the page as it is sent, and the scene only shows them.
const TOUR_S = 14;
// className: the box it fills (the page's picture's place); the word named over it is beside the box, over the page's shade
export function WordScene({ lang, word, tour, title, now, className = '' }: { lang: string; word?: string; tour?: { id: string; term: string; href: string }[]; title: string; now?: string; className?: string }) {
  const { go } = useSceneStart(false);
  const [live, setLive] = useState(false);
  const [i, setI] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const first = word || tour?.[0]?.id || 'beat';
  const post = (msg: object) => frame.current?.contentWindow?.postMessage(msg, location.origin);
  // the part of the scene the page's heading and words leave clear, from its top: the scene frames the word there
  // (on a narrow screen the words are under the picture, and it is all clear)
  const fit = () => {
    const box = frame.current?.parentElement, text = box?.parentElement?.querySelector('.hm-ph');
    if (!box || !text) return;
    const b = box.getBoundingClientRect(), tt = text.getBoundingClientRect();
    const clear = tt.top > b.top && tt.top < b.bottom ? (tt.top - b.top) / b.height : 1;
    post({ type: 'view', h: Math.min(1, Math.max(0.35, clear)) });
  };
  useEffect(() => {
    if (!go) return;
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === 'ready') fit();
      if (e.data?.type === 'live') { setLive(true); fit(); }
    };
    addEventListener('message', on);
    addEventListener('resize', fit);
    const io = new IntersectionObserver(([e]) => post({ type: 'away', on: !e.isIntersecting }));
    if (frame.current) io.observe(frame.current);
    return () => { removeEventListener('message', on); removeEventListener('resize', fit); io.disconnect(); };
  }, [go]); // eslint-disable-line react-hooks/exhaustive-deps
  // the tour: on to the next word, a few seconds each
  useEffect(() => {
    if (!tour?.length || !live) return;
    const id = window.setInterval(() => setI((k) => (k + 1) % tour.length), TOUR_S * 1000);
    return () => clearInterval(id);
  }, [tour, live]);
  useEffect(() => { if (tour?.length && i) post({ type: 'word', id: tour[i].id }); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = tour?.[i];
  return (<>
    <div className={`${className} wd-scene${live ? ' live' : ''}`}>
      {go ? <iframe ref={frame} src={`/word-view?w=${encodeURIComponent(first)}&lang=${lang}`} title={title} /> : null}
    </div>
    {tour && shown && live ? <Link className="wd-now" href={shown.href}><span>{now}</span>{shown.term}</Link> : null}
  </>);
}
