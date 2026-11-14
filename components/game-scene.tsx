'use client';
import { useEffect, useRef, useState } from 'react';
import type { VenueId } from '@/lib/venues';
import type { Wind } from '@/lib/race';
import { LoadBar } from './skeleton';

// The scene behind the pages laid out as the race's pause screen (the race hub, the free race's set-up): the game at a
// venue (public/boat-view), your yacht afloat there on a clear evening. Another venue is a new page, loaded beside the
// one showing and faded in over it once its first frame is up; a venue picked while one loads takes its place. Each is
// told the wind as it changes, and what the page's card (.bt-card) and heading (.bt-info) cover, so the boat stands
// in the part left clear. With `finish` (lib/finish.ts) it is the result page's scene: the finish of the race as it was,
// sent to the scene once it is up.
//
// With `setup` it is the free race's set-up: the race as it will be laid (every boat, the marks, the committee boat),
// and `setup.view` says what the drone shows: the fleet, the wind or the current over the course, or the course.
export type SceneSetup = {
  race: { preset: Wind; fleet: number; length: string; laps: number; course: string; current: number; start: number; daytime?: string };
  view: 'boats' | 'wind' | 'current' | 'course';
  labels: Record<string, string>;
};
export function GameScene({ venue, wind, title, finish, setup, loading }: { venue: VenueId; wind: Wind; title: string; finish?: object; setup?: SceneSetup; loading?: string }) {
  const [frames, setFrames] = useState<{ id: number; venue: VenueId; wind: Wind; live: boolean }[]>(() => [{ id: 0, venue, wind, live: false }]);
  const refs = useRef(new Map<number, HTMLIFrameElement>());
  const windNow = useRef(wind); windNow.current = wind;
  const fin = useRef(finish); fin.current = finish;
  const su = useRef(setup); su.current = setup;
  const first = (): object => (fin.current ? { type: 'finish', ...fin.current } : su.current ? { type: 'setup', ...su.current } : { type: 'wind', preset: windNow.current });
  const post = (msg: object, id?: number) => refs.current.forEach((f, k) => { if (id == null || id === k) f.contentWindow?.postMessage(msg, location.origin); });
  const parts = () => ({ card: document.querySelector('.bt-card'), info: document.querySelector('.bt-info') });
  const inset = (id?: number) => {
    const { card, info } = parts();
    const c = card?.getBoundingClientRect(), h = info?.getBoundingClientRect(), W = innerWidth, H = innerHeight;
    const p = info?.querySelector('.bt-p')?.getBoundingClientRect(), st = info?.querySelector('.bt-stats')?.getBoundingClientRect();
    if (!c || !h) return;
    const tall = c.width > W * 0.7, head = (p && p.height ? p.bottom : h.top + 120) / H;
    post({ type: 'inset', l: 0, r: tall ? 0 : (W - c.left) / W, t: Math.min(0.4, tall ? h.bottom / H : head * 0.6), b: tall ? (H - c.top) / H : st ? (H - st.top) / H * 0.5 : 0 }, id);
  };
  // a new venue: a new page beside the one showing (or in place of one still loading)
  useEffect(() => {
    setFrames((fs) => {
      const top = fs[fs.length - 1];
      if (top.venue === venue) return fs;
      const next = { id: top.id + 1, venue, wind: windNow.current, live: false };
      return top.live ? [...fs.filter((f) => f.live), next] : [...fs.filter((f) => f !== top), next];
    });
  }, [venue]);
  useEffect(() => { if (!su.current) post({ type: 'wind', preset: wind }); }, [wind]); // eslint-disable-line react-hooks/exhaustive-deps
  const setupKey = setup ? JSON.stringify(setup) : '';
  useEffect(() => { if (su.current) post({ type: 'setup', ...su.current }); }, [setupKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin) return;
      const id = [...refs.current].find(([, f]) => f.contentWindow === e.source)?.[0];
      if (id == null) return;
      if (e.data?.type === 'ready') { inset(id); post(first(), id); }
      if (e.data?.type === 'live') {
        setFrames((fs) => fs.map((f) => (f.id === id ? { ...f, live: true } : f)));
        setTimeout(() => setFrames((fs) => fs.filter((f) => f.id >= id)), 900); // the one under it, once faded over
      }
    };
    const fit = () => inset();
    addEventListener('message', on);
    addEventListener('resize', fit);
    const ro = new ResizeObserver(fit), { card, info } = parts();
    if (card) ro.observe(card);
    if (info) ro.observe(info);
    return () => { removeEventListener('message', on); removeEventListener('resize', fit); ro.disconnect(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // the bar runs while the venue on top is still coming up
  const busy = !frames[frames.length - 1].live;
  return <>{loading ? <LoadBar label={loading} on={busy} /> : null}{frames.map((f) => (
    <iframe key={f.id} ref={(el) => { if (el) refs.current.set(f.id, el); else refs.current.delete(f.id); }} className={`bt-scene bt-fade ${f.live ? 'on' : ''}`}
      src={`/boat-view?venue=${f.venue}&wind=${f.wind}${finish ? '&finish=1' : setup ? '&setup=1' : ''}`} title={title} onLoad={() => post({ type: 'hello' }, f.id)} />
  ))}</>;
}
