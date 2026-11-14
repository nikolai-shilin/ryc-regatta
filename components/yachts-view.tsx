'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { tx, type Lang } from '@/lib/lang';
import { readBoat } from '@/lib/boat';
import { saveOpts } from '@/lib/opts';
import { YACHTS, yachtOf, type YachtId } from '@/lib/yachts';
import { IconPlay, IconSail, IconBoats } from './ui';

// The yachts: each class you can race, in the game's own scene (/boat-view?boat=…, Lake Garda on a summer evening) in
// your colours, as the boat page shows yours, with what she is and how she sails in the game in the boat page's dark
// glass card. Another yacht is another scene, faded in over the last once its first frame is up. Today's race is
// always the club's 40-footer; Race her opens a free race set up in the one shown.
export function YachtsView({ lang, start, back }: { lang: Lang; start: YachtId; back: ReactNode }) {
  const t = tx(lang);
  const [id, setId] = useState<YachtId>(start);
  const [down, setDown] = useState(false);
  const [frames, setFrames] = useState<{ n: number; id: YachtId; live: boolean }[]>(() => [{ n: 0, id: start, live: false }]);
  const refs = useRef(new Map<number, HTMLIFrameElement>());
  const card = useRef<HTMLElement>(null), info = useRef<HTMLDivElement>(null);
  const downNow = useRef(down); downNow.current = down;
  const y = yachtOf(id);

  const post = (msg: object, n?: number) => refs.current.forEach((f, k) => { if (n == null || n === k) f.contentWindow?.postMessage(msg, location.origin); });
  const inset = (n?: number) => {
    const c = card.current?.getBoundingClientRect(), h = info.current?.getBoundingClientRect(), W = innerWidth, H = innerHeight;
    const p = info.current?.querySelector('.bt-p')?.getBoundingClientRect(), st = info.current?.querySelector('.bt-stats')?.getBoundingClientRect();
    if (!c || !h) return;
    const tall = c.width > W * 0.7, head = (p && p.height ? p.bottom : h.top + 120) / H;
    post({ type: 'inset', l: 0, r: tall ? 0 : (W - c.left) / W, t: Math.min(0.4, tall ? h.bottom / H : head * 0.6), b: tall ? (H - c.top) / H : st ? (H - st.top) / H * 0.5 : 0 }, n);
  };
  // another yacht: a new scene beside the one showing (or in place of one still loading); the address follows
  const pick = (next: YachtId) => {
    setId(next);
    setFrames((fs) => {
      const top = fs[fs.length - 1];
      if (top.id === next) return fs;
      const f = { n: top.n + 1, id: next, live: false };
      return top.live ? [...fs.filter((x) => x.live), f] : [...fs.filter((x) => x !== top), f];
    });
    try { history.replaceState(null, '', `${location.pathname}?y=${next}`); } catch {}
  };
  useEffect(() => { post({ type: 'pose', down }); }, [down]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin) return;
      const n = [...refs.current].find(([, f]) => f.contentWindow === e.source)?.[0];
      if (n == null) return;
      if (e.data?.type === 'ready') { post({ type: 'look', boat: readBoat() }, n); post({ type: 'pose', down: downNow.current }, n); inset(n); }
      if (e.data?.type === 'live') {
        setFrames((fs) => fs.map((f) => (f.n === n ? { ...f, live: true } : f)));
        setTimeout(() => setFrames((fs) => fs.filter((f) => f.n >= n)), 900);
      }
    };
    const fit = () => inset();
    addEventListener('message', on); addEventListener('resize', fit);
    const ro = new ResizeObserver(fit);
    if (card.current) ro.observe(card.current);
    if (info.current) ro.observe(info.current);
    return () => { removeEventListener('message', on); removeEventListener('resize', fit); ro.disconnect(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const race = () => { saveOpts({ yacht: id }); location.href = `/race/free?yacht=${id}`; };
  const kn = (v: number) => `${v} ${t('kn', 'уз')}`;
  const spec = (k: string) => y.specs.find((s) => s.k[0] === k);

  return (
    <div className="bt">
      {frames.map((f) => (
        <iframe key={f.n} ref={(el) => { if (el) refs.current.set(f.n, el); else refs.current.delete(f.n); }} className={`bt-scene bt-fade ${f.live ? 'on' : ''}`}
          src={`/boat-view?venue=garda&wind=medium${f.id !== 'club40' ? `&boat=${f.id}` : ''}`} title={t(`The ${yachtOf(f.id).name[0]} in 3D`, `${yachtOf(f.id).name[1]} в 3D`)}
          onLoad={() => post({ type: 'hello' }, f.n)} />
      ))}

      <div className="bt-info" ref={info}>
        <div className="bt-top">{back}<span className="bt-kick">{t('The yachts', 'Яхты')}</span></div>
        <h1 className="bt-h">{t(...y.name)}</h1>
        <p className="bt-p">{t(...y.kind)}. {t(...y.tagline)} {t('Drag to circle her.', 'Тяни, чтобы облететь.')}</p>
        <div className="bt-stats">
          <div><span className="bt-sk">{t('Length', 'Длина')}</span><b>{t(...spec('Length')!.v)}</b></div>
          <div><span className="bt-sk">{t('Crew', 'Экипаж')}</span><b>{t(...spec('Crew')!.v)}</b></div>
          <div><span className="bt-sk">{t('Upwind', 'Бейдевинд')}</span><b>{kn(y.speed.up)}</b><span className="bt-sv">{t('in 12 kn of wind', 'при ветре 12 уз')}</span></div>
          <div><span className="bt-sk">{t('Downwind', 'Фордевинд')}</span><b>{kn(y.speed.down)}</b><span className="bt-sv">{t('in 12 kn of wind', 'при ветре 12 уз')}</span></div>
        </div>
      </div>

      <section className="bt-card" ref={card} aria-label={t('The yachts you can race', 'Яхты, на которых можно гоняться')}>
        <button type="button" className="bt-go" onClick={race}><IconPlay /><span>{t(`Race the ${y.name[0]}`, `В гонку на ${id === 'club40' ? 'Клубе 40' : y.name[1]}`)}</span></button>
        <div className="bt-seg" role="radiogroup" aria-label={t('Point of sail', 'Курс')}>
          <button type="button" role="radio" aria-checked={!down} onClick={() => setDown(false)}>{t('Upwind', 'Бейдевинд')}</button>
          <button type="button" role="radio" aria-checked={down} onClick={() => setDown(true)}>{t('Downwind', 'Фордевинд')}</button>
        </div>

        <div className="bt-g">
          <span className="bt-k" id="yt-pick"><IconBoats />{t('Yacht', 'Яхта')}</span>
          <div className="bt-pills" role="radiogroup" aria-labelledby="yt-pick">
            {YACHTS.map((x) => <button key={x.id} type="button" role="radio" aria-checked={x.id === id} className="bt-pill" onClick={() => pick(x.id)}>{t(...x.name)}</button>)}
          </div>
          <p className="bt-hint">{id === 'club40'
            ? t('Today’s race is sailed in her, the same boat for everyone. Any yacht can sail a free race.', 'Гонка дня идёт на ней — у всех одна и та же лодка. В свободной гонке — любая яхта.')
            : t('In a free race, the whole fleet sails her. Today’s race is always sailed in the Club 40.', 'В свободной гонке на ней идёт весь флот. Гонка дня — всегда на Клубе 40.')}</p>
        </div>

        <div className="bt-g yt-about">
          <span className="bt-k"><IconSail s={14} />{t('About her', 'О яхте')}</span>
          {y.about.map((p, i) => <p key={i}>{t(...p)}</p>)}
        </div>

        <div className="bt-g yt-about">
          <span className="bt-k"><IconPlay />{t('In the game', 'В игре')}</span>
          <p>{t(...y.race)}</p>
        </div>

        <div className="bt-g">
          <span className="bt-k">{t('Specifications', 'Характеристики')}</span>
          <dl className="yt-spec">
            {y.specs.map((s) => <div key={s.k[0]}><dt>{t(...s.k)}</dt><dd>{t(...s.v)}</dd></div>)}
          </dl>
        </div>

        <div className="bt-rows">
          {id === 'club40' && <a className="bt-row" href="/play?race=today"><IconPlay /><span>{t('Today’s race', 'Гонка дня')}</span></a>}
          <Link className="bt-row" href="/boat"><IconSail s={18} /><span>{t('Your colours', 'Твои цвета')}</span><span className="bt-row-m">{t('Every yacht', 'Для всех яхт')}</span></Link>
        </div>
      </section>
    </div>
  );
}
