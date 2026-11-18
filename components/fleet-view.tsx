'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { tx, type Lang } from '@/lib/lang';
import { saveOpts } from '@/lib/opts';
import { YACHTS, yachtOf, type YachtId } from '@/lib/yachts';
import { DAILY_YACHTS, dailyYacht } from '@/lib/race';
import { IconPlay, IconSail, IconBoats, IconBack, IconArrow, IconGrid } from './ui';
import { LoadBar, ScenePoster } from './skeleton';
import { SceneBrand } from './scene-brand';
import { PauseCard } from './pause-card';

// The fleet: every yacht you can race afloat abreast in one line by length, in one scene (/fleet-view, Lake Garda on a summer evening, in
// your colours), the drone flying from one to the next — up and out until both are in the frame, across, and down to
// her — with what she is, her numbers and how she sails in the game beside her. It tours the fleet by itself, a yacht
// every DWELL seconds once the drone is there; picking one, the arrows or taking hold of the view stops the tour, and
// the play button starts it again. All shows the whole fleet from up and back. The site's one yachts page, /yachts
// (/fleet, its old address, comes here too): `tour` false when you came for one yacht (?y=), so it stays on her.
// A yacht's own page, /yachts/<id>, is this too (`own`): opened on her, its address follows the yacht picked
// (/yachts/<id>, and /yachts for the whole fleet), the yachts in the strip are links to their pages, and `foot` (her
// page's byline) closes the card.
const DWELL = 9;

export function FleetView({ lang, start, back, tour = true, own = false, foot }: { lang: Lang; start: YachtId | null; back: ReactNode; tour?: boolean; own?: boolean; foot?: ReactNode }) {
  const t = tx(lang);
  const [id, setId] = useState<YachtId | null>(start);
  const [shown, setShown] = useState<YachtId>(start ?? YACHTS[0].id); // the words stay on the last yacht while the fleet shows
  const [down, setDown] = useState(false);
  const [auto, setAuto] = useState(tour);
  const [today] = useState<YachtId>(() => dailyYacht()); // today's race's yacht, fixed for the page's life
  const [live, setLive] = useState(false);
  const [landed, setLanded] = useState(0); // the flights that have landed: the tour's clock restarts on each
  const [there, setThere] = useState(false); // the drone is at the yacht picked, not on its way
  const frame = useRef<HTMLIFrameElement>(null), card = useRef<HTMLElement>(null), info = useRef<HTMLDivElement>(null), strip = useRef<HTMLDivElement>(null);
  const now = useRef({ id, down, live: false }); now.current = { id, down, live };
  const y = yachtOf(shown);

  const post = useCallback((msg: object) => frame.current?.contentWindow?.postMessage(msg, location.origin), []);
  // the part of the frame the words cover, so the yacht stands in what is left
  const inset = useCallback(() => {
    const c = card.current?.getBoundingClientRect(), h = info.current?.getBoundingClientRect(), s = strip.current?.getBoundingClientRect(), W = innerWidth, H = innerHeight;
    const p = info.current?.querySelector('.bt-p')?.getBoundingClientRect();
    if (!c || !h) return;
    const tall = c.width > W * 0.7, head = (p && p.height ? p.bottom : h.top + 120) / H;
    post({ type: 'inset', l: 0, r: tall ? 0 : (W - c.left) / W, t: Math.min(0.4, tall ? (h.bottom / H) * 0.9 : head * 0.55), b: tall ? (H - c.top) / H : s ? ((H - s.top) / H) * 0.6 : 0 });
  }, [post]);
  const go = useCallback((next: YachtId | null) => {
    setId(next); setThere(false);
    if (next) setShown(next);
    post(next ? { type: 'focus', id: next } : { type: 'overview' });
    try {
      const q = new URLSearchParams(location.search); q.delete('y');
      if (next && !own) q.set('y', next);
      const path = own ? (next ? `/yachts/${next}` : '/yachts') : location.pathname, s = q.toString();
      history.replaceState(null, '', s ? `${path}?${s}` : path);
    } catch {}
  }, [post, own]);
  const step = useCallback((k: number) => {
    const i = YACHTS.findIndex((x) => x.id === (now.current.id ?? shown));
    go(YACHTS[(i + k + YACHTS.length) % YACHTS.length].id);
  }, [go, shown]);
  const fleet = useRef(false); // you asked for the whole fleet: the opening flight to the first yacht stays home
  const pick = (next: YachtId | null) => { fleet.current = !next; setAuto(false); go(next); };
  const toggle = () => { if (!auto && !id) go(shown); setAuto(!auto); };

  // the scene's word: it is up (send it the pose and the frame, and after a moment over the whole fleet, the first
  // yacht), a flight has landed, or you took hold of the view
  useEffect(() => {
    let first: ReturnType<typeof setTimeout> | undefined;
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      const d = e.data;
      if (d?.type === 'ready') { post({ type: 'pose', down: now.current.down }); inset(); }
      if (d?.type === 'live' && !now.current.live) {
        setLive(true);
        first = setTimeout(() => { if (!fleet.current) go(now.current.id ?? YACHTS[0].id); }, 1400);
      }
      if (d?.type === 'arrived') { setThere(d.id === now.current.id); if (d.id) setLanded((n) => n + 1); }
      if (d?.type === 'touched') setAuto(false);
    };
    const fit = () => inset();
    addEventListener('message', on); addEventListener('resize', fit);
    const ro = new ResizeObserver(fit);
    for (const el of [card.current, info.current, strip.current]) if (el) ro.observe(el);
    return () => { removeEventListener('message', on); removeEventListener('resize', fit); ro.disconnect(); clearTimeout(first); };
  }, [go, inset, post]);
  useEffect(() => { post({ type: 'pose', down }); }, [down, post]);
  // the tour: the next yacht a while after the drone gets to this one
  useEffect(() => {
    if (!auto || !there || !id) return;
    const k = setTimeout(() => step(1), DWELL * 1000);
    return () => clearTimeout(k);
  }, [auto, there, id, landed, step]);
  // the arrows on the keyboard, as the buttons
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea, select')) return;
      if (e.key === 'ArrowRight') { setAuto(false); step(1); }
      if (e.key === 'ArrowLeft') { setAuto(false); step(-1); }
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [step]);

  const race = () => { saveOpts({ yacht: shown }); location.href = `/race/free?yacht=${shown}`; };
  const kn = (v: number) => `${lang === 'ru' ? String(v).replace('.', ',') : v} ${t('kn', 'уз')}`; // 8,1 уз in Russian
  const spec = (k: string) => y.specs.find((s) => s.k[0] === k);
  const n = YACHTS.findIndex((x) => x.id === shown) + 1;

  return (
    <div className="bt fl-view">
      <LoadBar label={t('Loading the yachts', 'Загружаем яхты')} on={!live} />
      <ScenePoster label={t('Loading the yachts', 'Загружаем яхты')} on={!live} />
      <iframe ref={frame} className={`bt-scene bt-fade ${live ? 'on' : ''}`} src="/fleet-view?wind=light" title={t('The yachts in 3D', 'Яхты в 3D')}
        onLoad={() => post({ type: 'hello' })} />

      <div className="bt-info" ref={info}>
        <div className="bt-top">{back}<SceneBrand /></div>
        <span className="bt-kick">{t('The yachts', 'Яхты')} <span className="fl-n">{id ? `${String(n).padStart(2, '0')} / ${String(YACHTS.length).padStart(2, '0')}` : t('All yachts', 'Все яхты')}</span></span>
        <h1 className="bt-h fl-h" key={shown}>{id ? t(...y.name) : t('Every yacht', 'Все яхты')}</h1>
        <p className="bt-p">{id ? <>{t(...y.kind)}. {t(...y.tagline)}</> : t('Every yacht in one line by length, bows level: from the America’s Cup’s 20.7 m foiler to the 2.3 m Optimist. Pick one to fly to her.', 'Все яхты в одну линию по длине, носы вровень: от 20,7-метровой летающей яхты Кубка Америки до 2,3-метрового Оптимиста. Выбери, чтобы подлететь к ней.')}</p>

        <div className="fl-strip" ref={strip}>
          <div className="fl-ctl">
            <button type="button" className="fl-btn" onClick={() => { setAuto(false); step(-1); }} aria-label={t('Previous yacht', 'Предыдущая яхта')}><IconBack s={16} /></button>
            <button type="button" className="fl-btn" onClick={toggle} aria-pressed={auto}
              aria-label={auto ? t('Stop the tour', 'Остановить облёт') : t('Tour the fleet', 'Облететь флот')}>
              {auto ? <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" /></svg> : <IconPlay s={14} />}
            </button>
            <button type="button" className="fl-btn" onClick={() => { setAuto(false); step(1); }} aria-label={t('Next yacht', 'Следующая яхта')}><IconArrow s={16} /></button>
            <button type="button" className="fl-btn fl-all" onClick={() => pick(null)} aria-pressed={!id}><IconGrid s={14} /><span>{t('All', 'Все')}</span></button>
          </div>
          <div className="fl-boats" role="radiogroup" aria-label={t('Yacht', 'Яхта')}>
            {YACHTS.map((x, i) => {
              const cell = <>
                <span className="fl-i">{String(i + 1).padStart(2, '0')}</span>
                <b>{t(...x.name)}</b>
                <span className="fl-m">{t(...x.specs[0].v)} · {kn(x.speed.down)}</span>
                {x.id === id && auto && <i className={`fl-bar ${there ? 'run' : ''}`} key={landed} style={{ animationDuration: `${DWELL}s` }} aria-hidden="true" />}
              </>;
              // on a yacht's page each is a link to hers (read by search engines), flown to here rather than followed
              return own
                ? <a key={x.id} href={`/yachts/${x.id}${lang === 'ru' ? '?lang=ru' : ''}`} role="radio" aria-checked={x.id === id} className="fl-boat"
                    onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; e.preventDefault(); pick(x.id); }}>{cell}</a>
                : <button key={x.id} type="button" role="radio" aria-checked={x.id === id} className="fl-boat" onClick={() => pick(x.id)}>{cell}</button>;
            })}
          </div>
        </div>
      </div>

      <PauseCard lang={lang} back={own ? `/yachts/${shown}` : '/yachts'} title={t(...y.name)} cardRef={card} foot={['boat', 'venues']}
        tools={id ? <Link className="bt-mini bt-all" href="/yachts" scroll={false} aria-label={t('All yachts', 'Все яхты')}
          onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; e.preventDefault(); pick(null); }}><IconBack s={14} /><span>{t('All yachts', 'Все яхты')}</span></Link> : undefined}
        action={<button type="button" className="bt-go" onClick={race}><IconPlay /><span>{t(`Race the ${y.name[0]}`, `В гонку на ${y.name[1]}`)}</span></button>}>
        <div className="bt-seg" role="radiogroup" aria-label={t('Point of sail', 'Курс')}>
          <button type="button" role="radio" aria-checked={!down} onClick={() => setDown(false)}>{t('Upwind', 'Бейдевинд')}</button>
          <button type="button" role="radio" aria-checked={down} onClick={() => setDown(true)}>{t('Downwind', 'Попутный')}</button>
        </div>

        <p className="bt-hint">{shown === today
          ? t('Today’s race is sailed in her, the same boat for everyone. A new yacht every day; any can sail a free race.', 'Сегодня гонка дня идёт на ней — у всех одна и та же лодка. Каждый день — новая яхта; в свободной гонке — любая.')
          : shown in DAILY_YACHTS
            ? t(`In a free race, the whole fleet sails her, and today’s race does on her days: a new yacht every day, today the ${yachtOf(today).name[0]}.`, `В свободной гонке на ней идёт весь флот, а в её дни — и гонка дня: каждый день новая яхта, сегодня ${yachtOf(today).name[1]}.`)
            : t(`In a free race, the whole fleet sails her. Today’s race is sailed in a new yacht every day: today the ${yachtOf(today).name[0]}.`, `В свободной гонке на ней идёт весь флот. Гонка дня — каждый день на новой яхте: сегодня ${yachtOf(today).name[1]}.`)}</p>

        <div className="fl-stats">
          <div><span className="bt-sk">{t('Length', 'Длина')}</span><b>{t(...spec('Length')!.v)}</b></div>
          <div><span className="bt-sk">{t('Crew', 'Экипаж')}</span><b>{t(...spec('Crew')!.v)}</b></div>
          <div><span className="bt-sk">{t('Upwind', 'Бейдевинд')}</span><b>{kn(y.speed.up)}</b></div>
          <div><span className="bt-sk">{t('Downwind', 'Попутный')}</span><b>{kn(y.speed.down)}</b></div>
          <span className="bt-sv">{t('Speeds in 12 kn of wind', 'Скорости при ветре 12 уз')}</span>
        </div>

        <div className="bt-g yt-about">
          <span className="bt-k"><IconSail s={14} />{t('About her', 'О яхте')}</span>
          {y.about.map((p, i) => <p key={i}>{t(...p)}</p>)}
          {!own && <p><Link className="hm-src" href={`/yachts/${y.id}`}>{t(`The ${y.name[0]}’s own page`, `Страница яхты ${y.name[1]}`)}</Link></p>}
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

        {shown === today && <div className="bt-rows"><a className="bt-row" href="/play?race=today"><IconPlay /><span>{t('Today’s race', 'Гонка дня')}</span><span className="bt-row-m">{t('In her', 'На ней')}</span></a></div>}
        {foot}
      </PauseCard>
    </div>
  );
}
