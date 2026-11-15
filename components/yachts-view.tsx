'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { tx, type Lang } from '@/lib/lang';
import { saveOpts } from '@/lib/opts';
import { YACHTS, yachtOf, type YachtId } from '@/lib/yachts';
import { IconPlay, IconSail, IconBoats } from './ui';
import { LoadBar } from './skeleton';
import { SceneBrand } from './scene-brand';

// The yachts: each class you can race, all afloat together in the game's own scene (/fleet-view, Lake Garda on a summer
// evening) in your colours, with what she is and how she sails in the game in the boat page's dark glass card. Another
// yacht is the same scene: the drone flies over to her (up and out until both are in the frame, across, and down).
// Today's race is always the club's 40-footer; Race her opens a free race set up in the one shown.
export function YachtsView({ lang, start, back }: { lang: Lang; start: YachtId; back: ReactNode }) {
  const t = tx(lang);
  const [id, setId] = useState<YachtId>(start);
  const [down, setDown] = useState(false);
  const [live, setLive] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const card = useRef<HTMLElement>(null), info = useRef<HTMLDivElement>(null);
  const now = useRef({ id, down }); now.current = { id, down };
  const y = yachtOf(id);

  const post = (msg: object) => frame.current?.contentWindow?.postMessage(msg, location.origin);
  const inset = () => {
    const c = card.current?.getBoundingClientRect(), h = info.current?.getBoundingClientRect(), W = innerWidth, H = innerHeight;
    const p = info.current?.querySelector('.bt-p')?.getBoundingClientRect(), st = info.current?.querySelector('.bt-stats')?.getBoundingClientRect();
    if (!c || !h) return;
    const tall = c.width > W * 0.7, head = (p && p.height ? p.bottom : h.top + 120) / H;
    post({ type: 'inset', l: 0, r: tall ? 0 : (W - c.left) / W, t: Math.min(0.4, tall ? h.bottom / H : head * 0.6), b: tall ? (H - c.top) / H : st ? (H - st.top) / H * 0.5 : 0 });
  };
  // another yacht: the drone flies over to her; the address follows
  const pick = (next: YachtId) => {
    if (next === id) return;
    setId(next);
    post({ type: 'focus', id: next });
    try { history.replaceState(null, '', `${location.pathname}?y=${next}`); } catch {}
  };
  useEffect(() => { post({ type: 'pose', down }); }, [down]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // the scene is up: it opens on the yacht shown, posed as chosen, in the part of the frame the words leave clear
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === 'ready') { post({ type: 'focus', id: now.current.id }); post({ type: 'pose', down: now.current.down }); inset(); }
      if (e.data?.type === 'live') setLive(true);
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
      <LoadBar label={t('Loading the yachts', 'Загружаем яхты')} on={!live} />
      <iframe ref={frame} className={`bt-scene bt-fade ${live ? 'on' : ''}`} src="/fleet-view?wind=medium" title={t('The yachts in 3D', 'Яхты в 3D')}
        onLoad={() => post({ type: 'hello' })} />

      <div className="bt-info" ref={info}>
        <div className="bt-top">{back}<SceneBrand /></div>
        <span className="bt-kick">{t('The yachts', 'Яхты')}</span>
        <h1 className="bt-h">{t(...y.name)}</h1>
        <p className="bt-p">{t(...y.kind)}. {t(...y.tagline)} {t('Drag to circle her.', 'Тяни, чтобы облететь.')}</p>
        <div className="bt-stats">
          <div><span className="bt-sk">{t('Length', 'Длина')}</span><b>{t(...spec('Length')!.v)}</b></div>
          <div><span className="bt-sk">{t('Crew', 'Экипаж')}</span><b>{t(...spec('Crew')!.v)}</b></div>
          <div><span className="bt-sk">{t('Upwind', 'Бейдевинд')}</span><b>{kn(y.speed.up)}</b><span className="bt-sv">{t('in 12 kn of wind', 'при ветре 12 уз')}</span></div>
          <div><span className="bt-sk">{t('Downwind', 'Фордевинд')}</span><b>{kn(y.speed.down)}</b><span className="bt-sv">{t('in 12 kn of wind', 'при ветре 12 уз')}</span></div>
        </div>
      </div>

      <section className="bt-card" ref={card} aria-labelledby="yt-card">
        <div className="bt-card-h"><span className="lbl-ink" id="yt-card">{t('The yachts you can race', 'Яхты, на которых можно гоняться')}</span></div>
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
          <Link className="bt-row" href={`/fleet?y=${id}`}><IconBoats s={18} /><span>{t('The whole fleet', 'Весь флот')}</span><span className="bt-row-m">{t('Together', 'Вместе')}</span></Link>
          <Link className="bt-row" href="/boat"><IconSail s={18} /><span>{t('Your colours', 'Твои цвета')}</span><span className="bt-row-m">{t('Every yacht', 'Для всех яхт')}</span></Link>
        </div>
      </section>
    </div>
  );
}
