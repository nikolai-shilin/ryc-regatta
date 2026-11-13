'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { tx, type Lang } from '@/lib/lang';
import { IconDevice, IconPlay, IconGrid, IconHull, IconSail, IconKite, IconImage, IconHash, IconCrew } from './ui';
import { DEFAULT_BOAT, DEFAULT_LOGO, PRESETS, SWATCHES, readBoat, saveBoat, shrinkLogo, type Boat, type Logo } from '@/lib/boat';

// The boat page, laid out like the free race: the page head and the choices (the ready schemes, the hull, the sails, the
// gennaker, the logo, the sail number and the team) on the left, and beside them the live 3D preview (the game's own
// yacht, in /boat-view) with the race button. Every change shows at once and is saved where the game reads it.
export function BoatEditor({ lang, head }: { lang: Lang; head?: ReactNode }) {
  const t = tx(lang);
  const [b, setB] = useState<Boat>(DEFAULT_BOAT);
  const [ready, setReady] = useState(false);
  const [down, setDown] = useState(false);
  const [err, setErr] = useState('');
  const [shots, setShots] = useState<Record<string, string>>({});
  const frame = useRef<HTMLIFrameElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const latest = useRef({ b, down });
  latest.current = { b, down };

  const post = (msg: object) => frame.current?.contentWindow?.postMessage(msg, location.origin);
  useEffect(() => { setB(readBoat()); setReady(true); }, []);
  useEffect(() => {
    if (!ready) return;
    post({ type: 'look', boat: b });
    setErr(saveBoat(b) ? '' : t('This browser didn’t keep it: try a smaller logo.', 'Браузер не сохранил: попробуй логотип поменьше.'));
  }, [b, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { post({ type: 'pose', down }); }, [down]);
  // the preview says when it's up: then it gets the boat as it is now, and draws the presets' pictures (once a visit:
  // they're kept for the session, until the presets or the pictures' version, v2, change)
  useEffect(() => {
    let cached: Record<string, string> | null = null, asked = false;
    try { const c = JSON.parse(sessionStorage.getItem(SHOTS_KEY) || 'null'); if (c?.v === SHOTS_V) { cached = c.shots; setShots(c.shots); } } catch {}
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === 'ready') {
        post({ type: 'look', boat: latest.current.b }); post({ type: 'pose', down: latest.current.down });
        if (!cached && !asked) (asked = true), post({ type: 'thumbs', items: PRESETS.map((p) => ({ id: p.id, boat: { ...p.boat, logo: 'none', nat: '', num: '' } })) });
      }
      if (e.data?.type === 'thumbs' && e.data.shots) {
        cached = e.data.shots; setShots(e.data.shots);
        try { sessionStorage.setItem(SHOTS_KEY, JSON.stringify({ v: SHOTS_V, shots: e.data.shots })); } catch {}
      }
    };
    addEventListener('message', on);
    post({ type: 'hello' }); // in case the preview was up before this page listened: it answers ready again
    return () => removeEventListener('message', on);
  }, []);

  const set = (patch: Partial<Boat>) => setB((x) => ({ ...x, ...patch, preset: undefined }));
  const setLogo = (logo: Logo) => {
    setB((x) => ({ ...x, logo }));
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try { const logoImg = await shrinkLogo(f); setB((x) => ({ ...x, logo: 'custom', logoImg })); setDown(false); }
    catch { setErr(t('That file isn’t a picture we can use: try a PNG, JPG or SVG.', 'Этот файл не подходит: попробуй PNG, JPG или SVG.')); }
    if (file.current) file.current.value = '';
  };

  // one setting as the free race has it: a kicker with its mark, then the swatches; a part of a bigger group gets a
  // small serif label instead
  const swatches = (k: 'hull' | 'cloth' | 'ink' | 'kite' | 'crew' | 'pants', label: string, sub = false) => (
    <div className={sub ? 'bt-part' : 'fs-g'}>
      {sub ? <span className="bt-sub" id={`l-${k}`}>{label}</span> : null}
      <Swatches label={`l-${k}`} value={b[k]} options={SWATCHES[k]} onChange={(v) => { set({ [k]: v }); if (k === 'kite') setDown(true); else if (k !== 'crew' && k !== 'pants') setDown(false); }} t={t} />
    </div>
  );
  const kicker = (id: string, ico: ReactNode, label: string) => <span className="kicker fs-gk" id={id}>{ico}{label}</span>;
  const tags = <V extends string | boolean>(label: string, value: V, opts: [V, string][], pick: (v: V) => void) => (
    <div className="qtags" role="radiogroup" aria-labelledby={label}>
      {opts.map(([v, l]) => <button key={String(v)} type="button" role="radio" aria-checked={value === v} className="qtag" onClick={() => pick(v)}>{l}</button>)}
    </div>
  );

  return (
    <div className="bt">
      <div className="bt-head">{head}</div>

      <section className="bt-q" aria-label={t('Colours, logo and sail number', 'Цвета, логотип и номер')}>
        <div className="fs-g">
          {kicker('l-presets', <IconGrid />, t('Presets', 'Готовые схемы'))}
          <div className="presets" role="list" aria-labelledby="l-presets">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" role="listitem" className={`preset ${b.preset === p.id ? 'on' : ''}`} aria-pressed={b.preset === p.id}
                aria-label={t(p.en, p.ru)} title={t(p.en, p.ru)} style={{ ['--c' as string]: p.boat.hull }}
                onClick={() => setB((x) => ({ ...x, ...p.boat, preset: p.id }))}>
                <span className="preset-pic">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {shots[p.id] ? <img src={shots[p.id]} alt="" /> : <i aria-hidden="true" />}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="fs-g">
          {kicker('l-hull', <IconHull />, t('Hull', 'Корпус'))}
          <Swatches label="l-hull" value={b.hull} options={SWATCHES.hull} onChange={(v) => { set({ hull: v }); setDown(false); }} t={t} />
        </div>

        <div className="fs-g">
          {kicker('l-sails', <IconSail s={14} />, t('Sails', 'Паруса'))}
          {tags('l-sails', b.laminate, [[false, t('Dacron', 'Дакрон')], [true, t('Laminate', 'Ламинат')]], (v) => { set({ laminate: v }); setDown(false); })}
          {swatches('cloth', t('Colour', 'Цвет'), true)}
        </div>

        <div className="fs-g">
          {kicker('l-kite', <IconKite />, t('Gennaker', 'Геннакер'))}
          <Swatches label="l-kite" value={b.kite} options={SWATCHES.kite} onChange={(v) => { set({ kite: v }); setDown(true); }} t={t} />
        </div>

        <div className="fs-g">
          {kicker('l-logo', <IconImage />, t('Logo on the sails', 'Логотип на парусах'))}
          {tags('l-logo', b.logo, [['ryc', 'RYC'], ['custom', t('Yours', 'Свой')], ['none', t('None', 'Нет')]] as [Logo, string][], (v) => { setLogo(v); setDown(false); })}
          <div className="bt-logo">
            <span className="logo-thumb" style={{ backgroundColor: b.cloth }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={b.logoImg || DEFAULT_LOGO} alt={b.logoImg ? t('Your logo', 'Свой логотип') : 'RYC Rentals Bot'} /></span>
            <p className="hint">{b.logoImg ? t('Your logo. A PNG with a clear background works best.', 'Твой логотип. Лучше всего PNG с прозрачным фоном.') : t('Yours is RYC Rentals Bot until you upload your own.', '«Свой» — это RYC Rentals Bot, пока не загрузишь собственный.')}</p>
            {b.logoImg && <button type="button" className="mini" onClick={() => { setB((x) => ({ ...x, logoImg: undefined })); setDown(false); }}><span className="btn-t">{t('Default', 'Стандартный')}</span></button>}
            <button type="button" className="mini" onClick={() => file.current?.click()}><span className="btn-t">{b.logoImg ? t('Change', 'Заменить') : t('Upload', 'Загрузить')}</span></button>
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
        </div>

        <div className="fs-g">
          <label className="kicker fs-gk" htmlFor="b-num"><IconHash />{t('Sail number', 'Номер на парусе')}</label>
          <div className="num-pair">
            {b.logo === 'none' && <input className="num-in" aria-label={t('Letters on the sail', 'Буквы на парусе')} value={b.nat} maxLength={3} onChange={(e) => set({ nat: e.target.value.toUpperCase().replace(/[^A-ZА-ЯЁ]/g, '') })} />}
            <input id="b-num" className="num-in" inputMode="numeric" value={b.num} maxLength={3} onChange={(e) => set({ num: e.target.value.replace(/[^0-9]/g, '') })} onBlur={() => { if (!b.num) set({ num: '1' }); }} />
          </div>
          {swatches('ink', t('Colour', 'Цвет'), true)}
        </div>

        <div className="fs-g">
          {kicker('l-team', <IconCrew />, t('Team', 'Команда'))}
          {swatches('crew', t('Jackets', 'Куртки'), true)}
          {swatches('pants', t('Trousers', 'Брюки'), true)}
        </div>

        <div className="fs-note bt-note">
          <span className="fs-note-i"><IconDevice /></span>
          <p>{t('Saved on this device. You race in her from the next start.', 'Сохранено на этом устройстве. В гонке — со следующего старта.')}</p>
          <button type="button" className="mini" onClick={() => { setB({ ...DEFAULT_BOAT, logoImg: b.logoImg }); setDown(false); }}><span className="btn-t">{t('Reset', 'Сбросить')}</span></button>
        </div>
      </section>

      <aside className="bt-aside" aria-label={t('Your boat in 3D', 'Твоя яхта в 3D')}>
        <span className="kicker bt-k">{t('Preview', 'Предпросмотр')}</span>
        <div className="bt-view">
          <div className="bt-prev">
            <iframe ref={frame} src="/boat-view" onLoad={() => post({ type: 'hello' })} title={t('Your boat in 3D', 'Твоя яхта в 3D')} />
            <div className="segc bt-pose" role="radiogroup" aria-label={t('Point of sail', 'Курс')}>
              <button type="button" role="radio" aria-checked={!down} className={!down ? 'on' : ''} onClick={() => setDown(false)}>{t('Upwind', 'Бейдевинд')}</button>
              <button type="button" role="radio" aria-checked={down} className={down ? 'on' : ''} onClick={() => setDown(true)}>{t('Gennaker', 'Геннакер')}</button>
            </div>
            <span className="meta bt-hint">{t('Drag to turn', 'Тяни, чтобы повернуть')}</span>
          </div>
        </div>
        {/* upright on a phone the race button stays pinned to the bottom of the screen */}
        <div className="bt-go">
          {err && <p className="err" role="alert">{err}</p>}
          <a className="pill pill-primary pill-wide pill-s" href="/play?race=today"><IconPlay /><span className="btn-t">{t('Sail her in today’s race', 'В гонку дня на ней')}</span></a>
        </div>
      </aside>
    </div>
  );
}

const SHOTS_KEY = 'regatta-boat-shots', SHOTS_V = 'v2:' + PRESETS.map((p) => p.id + JSON.stringify(p.boat)).join('|');

// a row of colour swatches, named for the screen reader and on hover by the preset that colour comes from
function Swatches({ label, value, options, onChange, t }: { label: string; value: string; options: string[]; onChange: (v: string) => void; t: (en: string, ru: string) => string }) {
  return (
    <div className="sws" role="radiogroup" aria-labelledby={label}>
      {options.map((c) => {
        const on = c.toLowerCase() === value.toLowerCase(), name = colourName(c, t);
        return <button key={c} type="button" role="radio" aria-checked={on} aria-label={name} title={name} className="sw" style={{ ['--c' as string]: c }} onClick={() => onChange(c)} />;
      })}
    </div>
  );
}

const NAMES: Record<string, [string, string]> = {
  '#ffffff': ['White', 'Белый'], '#1d1d1d': ['Black', 'Чёрный'], '#f4f2ea': ['Sailcloth white', 'Белая парусина'], '#ebe3cd': ['Cream', 'Кремовый'],
  '#dfe4e8': ['Mylar', 'Майлар'], '#868c93': ['Grey laminate', 'Серый ламинат'], '#3a3d42': ['Charcoal', 'Графит'], '#2a2c30': ['Carbon', 'Карбон'],
  '#262a31': ['Dark grey', 'Тёмно-серый'],
};
function colourName(c: string, t: (en: string, ru: string) => string) {
  const k = c.toLowerCase(), p = PRESETS.find((x) => x.boat.hull.toLowerCase() === k), n = NAMES[k];
  return p ? t(p.en, p.ru) : n ? t(n[0], n[1]) : c;
}

