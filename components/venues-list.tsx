'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { tx, type Lang } from '@/lib/lang';
import { readBoat } from '@/lib/boat';
import { FLAGS } from '@/lib/flags';
import type { VenueId } from '@/lib/venues';
import { IconPin, IconArrow, IconSail, IconBook } from './ui';
import { LoadBar, ScenePoster } from './skeleton';
import { SceneBrand } from './scene-brand';
import { PauseCard } from './pause-card';
import { FlagImg } from './flag';
import '@/styles/venues.css';

// The venues (/venues), as /players: the game's own scene behind the page (/venues-view: your yacht sailing at the
// venue of today's race, the drone starting close by her, then pulling up and away into a slow, wide circuit of the
// water and the land round it), and every venue in the card on the right, by country and name, A to Z. Each row is the
// venue's own page (/venues/<id>), so search engines find every one from here.
type Pair = [string, string];
export type VenueRow = { id: VenueId; name: Pair; place: Pair; wind: Pair; nation: string; about: Pair };

export function VenuesList({ lang, list, today, back }: { lang: Lang; list: VenueRow[]; today: VenueId; back: ReactNode }) {
  const t = tx(lang);
  const [live, setLive] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null), card = useRef<HTMLElement>(null), info = useRef<HTMLDivElement>(null);
  const here = list.find((v) => v.id === today) ?? list[0];

  const post = useCallback((msg: object) => frame.current?.contentWindow?.postMessage(msg, location.origin), []);
  // the part of the frame the words cover, so what the drone looks at stands in what is left
  const inset = useCallback(() => {
    const c = card.current?.getBoundingClientRect(), h = info.current?.getBoundingClientRect(), W = innerWidth, H = innerHeight;
    const p = info.current?.querySelector('.bt-p')?.getBoundingClientRect();
    if (!c || !h) return;
    const tall = c.width > W * 0.7, head = (p && p.height ? p.bottom : h.top + 120) / H;
    post({ type: 'inset', l: 0, r: tall ? 0 : (W - c.left) / W, t: Math.min(0.4, tall ? h.bottom / H : head * 0.6), b: tall ? (H - c.top) / H : 0 });
  }, [post]);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === 'ready') {
        post({ type: 'look', boat: readBoat() }); inset(); // your own boat, in your colours
        try { if (frame.current?.contentDocument?.querySelector('canvas.live')) setLive(true); } catch {}
      }
      if (e.data?.type === 'live') setLive(true);
    };
    addEventListener('message', on); addEventListener('resize', inset);
    const ro = new ResizeObserver(inset);
    for (const el of [card.current, info.current]) if (el) ro.observe(el);
    post({ type: 'hello' }); // in case the scene was up before this page listened: it answers ready again
    return () => { removeEventListener('message', on); removeEventListener('resize', inset); ro.disconnect(); };
  }, [inset, post]);

  // by country, the countries A to Z and the venues A to Z in each, in the page's language, one list with each row's
  // flag. The country is the one the venue's sail letters fly (lib/flags.ts), and Hong Kong, whose boats carry HKG on
  // their sails, is listed under China with China's flag; one with no flag drawn goes by the last part of its place
  const abc = new Intl.Collator(lang === 'ru' ? 'ru' : 'en').compare;
  const rows = list.map((v) => {
    const f = FLAGS.find((x) => x.ioc === (v.nation === 'HKG' ? 'CHN' : v.nation));
    return { v, flag: f?.code ?? null, country: f ? t(f.en, f.ru) : t(...v.place).split(', ').pop()!, name: t(...v.name) };
  }).sort((a, b) => abc(a.country, b.country) || abc(a.name, b.name));

  return (
    <div className="bt vs-view">
      <LoadBar label={t('Loading the water', 'Загружаем акваторию')} on={!live} />
      <iframe ref={frame} className={`bt-scene bt-fade ${live ? 'on' : ''}`} src={`/venues-view?venue=${here.id}`}
        title={t(`${t(...here.name)} from the drone`, `${t(...here.name)} с дрона`)} onLoad={() => post({ type: 'hello' })} />
      <ScenePoster label={t('Loading the water', 'Загружаем акваторию')} on={!live} />

      <div className="bt-info" ref={info}>
        <div className="bt-top">{back}<SceneBrand /></div>
        <span className="bt-kick">{t(`Regatta venues · ${list.length}`, `Регатные акватории · ${list.length}`)}</span>
        <h1 className="bt-h">{t('The venues', 'Акватории')}</h1>
        <p className="bt-p">{t('Every place you can race in the game is a real one, laid out from the map: the Solent, Newport, Sydney Harbour, the Mediterranean and beyond. Pick one for its water, its wind, its regattas and how to race it.', 'Каждое место для гонки в игре — настоящее, построенное по карте: Солент, Ньюпорт, гавань Сиднея, Средиземное море и не только. Выбери любое — там его вода, ветер, регаты и как на нём гоняться.')}</p>
        <span className="vs-now"><IconPin s={13} />{t(`Over ${t(...here.name)}, today’s race`, `Над акваторией ${t(...here.name)} — гонка дня`)}</span>
      </div>

      <PauseCard lang={lang} back="/venues" title={`${t('The venues', 'Акватории')} · ${list.length}`} icon={<IconPin s={14} />} cardRef={card}>
        <ol className="vs-tab" aria-label={t('The venues', 'Акватории')}>
          {rows.map(({ v, flag, name }, i) => (
            <li key={v.id}>
              <Link href={`/venues/${v.id}`} className="vs-tr" aria-current={v.id === today ? 'true' : undefined} title={t(...v.about)}>
                <span className="vs-i">{String(i + 1).padStart(2, '0')}</span>
                <span className="vs-who">
                  <span className="vs-fl"><FlagImg code={flag} lang={lang} /></span>
                  <span className="vs-nm"><b>{name}</b><small>{t(...v.place)}</small></span>
                </span>
                {v.id === today ? <span className="vs-today">{t('Today', 'Сегодня')}</span> : <span className="vs-wind">{t(...v.wind)}</span>}
                <IconArrow s={14} />
              </Link>
            </li>
          ))}
        </ol>
        <p className="bt-hint">{t('The wind is the one the game gives each venue, its usual breeze. Today’s race goes to a new venue every day, each in turn.', 'Ветер — тот, что игра даёт каждой акватории, её обычный бриз. Гонка дня каждый день идёт на новую акваторию, по очереди.')}</p>

        <div className="bt-rows">
          <Link className="bt-row" href="/race/free"><IconSail s={18} /><span>{t('Race anywhere', 'Гоняться где угодно')}</span><span className="bt-row-m">{t('Free race', 'Свободная гонка')}</span></Link>
          <Link className="bt-row" href="/learn"><IconBook s={18} /><span>{t('The guides', 'Гиды')}</span><span className="bt-row-m">{t('Learn to race', 'Учись гоняться')}</span></Link>
        </div>
      </PauseCard>
    </div>
  );
}
