'use client';
import { useEffect, useRef, useState } from 'react';
import { tx, type Lang } from '@/lib/lang';
import { IconDevice, IconPlay } from './ui';
import { DEFAULT_BOAT, DEFAULT_LOGO, PRESETS, SWATCHES, readBoat, saveBoat, shrinkLogo, type Boat, type Logo } from '@/lib/boat';

// The boat page: a live 3D preview (the game's own yacht, in /boat-view) beside the colours of the hull, the sails, the
// gennaker and the team, the logo and the sail number. Every change shows at once and is saved where the game reads it.
export function BoatEditor({ lang }: { lang: Lang }) {
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

  const swatches = (k: 'hull' | 'cloth' | 'ink' | 'kite' | 'crew' | 'pants', label: string) => (
    <div className="srow srow-sw">
      <span className="srow-k" id={`l-${k}`}>{label}</span>
      <Swatches label={`l-${k}`} value={b[k]} options={SWATCHES[k]} onChange={(v) => { set({ [k]: v }); if (k === 'kite') setDown(true); else if (k !== 'crew' && k !== 'pants') setDown(false); }} t={t} />
    </div>
  );

  return (
    <div className="boat-grid">
      <div className="boat-prev">
        <iframe ref={frame} src="/boat-view" onLoad={() => post({ type: 'hello' })} title={t('Your boat in 3D', 'Твоя яхта в 3D')} />
        <div className="segc boat-pose" role="radiogroup" aria-label={t('Point of sail', 'Курс')}>
          <button type="button" role="radio" aria-checked={!down} className={!down ? 'on' : ''} onClick={() => setDown(false)}>{t('Upwind', 'Бейдевинд')}</button>
          <button type="button" role="radio" aria-checked={down} className={down ? 'on' : ''} onClick={() => setDown(true)}>{t('Gennaker', 'Геннакер')}</button>
        </div>
        <span className="meta boat-hint no-port">{t('Drag to turn', 'Тяни, чтобы повернуть')}</span>
      </div>

      <div className="boat-ctl">
        <div className="set-sec">
          <div className="group-k"><span className="kicker">{t('Presets', 'Готовые схемы')}</span></div>
          <div className="presets" role="list">
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

        <div className="set-sec">
          <div className="group-k"><span className="kicker">{t('Hull', 'Корпус')}</span></div>
          {swatches('hull', t('Hull colour', 'Цвет корпуса'))}
        </div>

        <div className="set-sec">
          <div className="group-k"><span className="kicker">{t('Sails', 'Паруса')}</span></div>
          <div className="srow">
            <span className="srow-k" id="l-lam">{t('Cloth', 'Ткань')}</span>
            <div className="segc" role="radiogroup" aria-labelledby="l-lam">
              <button type="button" role="radio" aria-checked={!b.laminate} className={!b.laminate ? 'on' : ''} onClick={() => { set({ laminate: false }); setDown(false); }}>{t('Dacron', 'Дакрон')}</button>
              <button type="button" role="radio" aria-checked={b.laminate} className={b.laminate ? 'on' : ''} onClick={() => { set({ laminate: true }); setDown(false); }}>{t('Laminate', 'Ламинат')}</button>
            </div>
          </div>
          {swatches('cloth', t('Sail colour', 'Цвет парусов'))}
          {swatches('ink', t('Number colour', 'Цвет номера'))}
          {swatches('kite', t('Gennaker', 'Геннакер'))}
        </div>

        <div className="set-sec">
          <div className="group-k"><span className="kicker">{t('Logo and number', 'Логотип и номер')}</span></div>
          <div className="srow">
            <span className="srow-k" id="l-logo">{t('Logo on the sails', 'Логотип на парусах')}</span>
            <div className="segc" role="radiogroup" aria-labelledby="l-logo">
              {([['ryc', 'RYC'], ['custom', t('Yours', 'Свой')], ['none', t('None', 'Нет')]] as [Logo, string][]).map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={b.logo === v} className={b.logo === v ? 'on' : ''} onClick={() => { setLogo(v); setDown(false); }}>{l}</button>
              ))}
            </div>
          </div>
          <div className="srow">
            <span className="srow-k">
              {t('Your logo', 'Свой логотип')}
              <span className="small boat-sub">{b.logoImg ? t('PNG with a clear background works best', 'Лучше всего PNG с прозрачным фоном') : t('RYC Rentals Bot until you upload your own', 'RYC Rentals Bot, пока не загрузишь свой')}</span>
            </span>
            <div className="logo-pick">
              <span className="logo-thumb" style={{ backgroundColor: b.cloth }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={b.logoImg || DEFAULT_LOGO} alt={b.logoImg ? t('Your logo', 'Свой логотип') : 'RYC Rentals Bot'} /></span>
              {b.logoImg && <button type="button" className="mini" onClick={() => { setB((x) => ({ ...x, logoImg: undefined })); setDown(false); }}><span className="btn-t">{t('Default', 'Стандартный')}</span></button>}
              <button type="button" className="mini" onClick={() => file.current?.click()}><span className="btn-t">{b.logoImg ? t('Change', 'Заменить') : t('Upload', 'Загрузить')}</span></button>
              <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            </div>
          </div>
          <div className="srow">
            <label className="srow-k" htmlFor="b-num">{t('Sail number', 'Номер на парусе')}</label>
            <div className="num-pair">
              {b.logo === 'none' && <input className="num-in" aria-label={t('Letters on the sail', 'Буквы на парусе')} value={b.nat} maxLength={3} onChange={(e) => set({ nat: e.target.value.toUpperCase().replace(/[^A-ZА-ЯЁ]/g, '') })} />}
              <input id="b-num" className="num-in" inputMode="numeric" value={b.num} maxLength={3} onChange={(e) => set({ num: e.target.value.replace(/[^0-9]/g, '') })} onBlur={() => { if (!b.num) set({ num: '1' }); }} />
            </div>
          </div>
        </div>

        <div className="set-sec">
          <div className="group-k"><span className="kicker">{t('Team', 'Команда')}</span></div>
          {swatches('crew', t('Jackets', 'Куртки'))}
          {swatches('pants', t('Trousers', 'Брюки'))}
        </div>

        {err && <p className="err" role="alert">{err}</p>}
        <div className="boat-foot">
          <span className="boat-note"><span className="fs-note-i"><IconDevice /></span><span>{t('Saved on this device. You race in her from the next start.', 'Сохранено на этом устройстве. В гонке — со следующего старта.')}</span></span>
          <button type="button" className="mini" onClick={() => { setB({ ...DEFAULT_BOAT, logoImg: b.logoImg }); setDown(false); }}><span className="btn-t">{t('Reset', 'Сбросить')}</span></button>
        </div>
        <a className="pill pill-primary boat-go" href="/play?race=today"><IconPlay /><span className="btn-t">{t('Sail her in today’s race', 'В гонку дня на ней')}</span></a>
      </div>
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

