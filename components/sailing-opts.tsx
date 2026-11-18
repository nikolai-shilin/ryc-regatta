'use client';
import { useEffect, useState } from 'react';
import { tx, type Lang } from '@/lib/lang';
import { DEFAULTS, readOpts, saveOpts, type Opts } from '@/lib/opts';

type Keys = 'autoTrim' | 'camera' | 'guides';

// How you sail, the same rows in the same order wherever they're set: /settings, the Settings of the race hub and the
// free race, and the race's pause menu (public/play/index.html). Every change is saved at once where the game reads it.
export function SailingOpts({ lang }: { lang: Lang }) {
  const t = tx(lang);
  const [o, setO] = useState<Pick<Opts, Keys>>(DEFAULTS);
  useEffect(() => { setO(readOpts()); }, []);
  const set = <K extends Keys>(k: K, v: Opts[K]) => { saveOpts({ [k]: v, ...(k === 'autoTrim' && { trimV: 1 }) }); setO((x) => ({ ...x, [k]: v })); };
  const seg = <K extends Keys>(k: K, label: string, opts: [Opts[K], string][]) => (
    <div className="srow srow-seg">
      <span className="srow-k" id={`l-${k}`}>{label}</span>
      <div className="segc" role="radiogroup" aria-labelledby={`l-${k}`}>
        {opts.map(([v, l]) => <button key={String(v)} type="button" role="radio" aria-checked={o[k] === v} className={o[k] === v ? 'on' : ''} onClick={() => set(k, v)}>{l}</button>)}
      </div>
    </div>
  );
  const sw = (k: 'guides', label: string) => (
    <div className="srow">
      <span className="srow-k" id={`l-${k}`}>{label}</span>
      <button type="button" className="tgl" role="switch" aria-checked={!!o[k]} aria-labelledby={`l-${k}`} onClick={() => set(k, o[k] ? 0 : 1)}><i /></button>
    </div>
  );
  return (
    <div className="st-sail">
      {seg('autoTrim', t('Sails', 'Паруса'), [[0, t('I trim', 'Сам')], [1, t('Auto', 'Авто')], [2, t('Main + jib', 'Грот + стаксель')]])}
      {seg('camera', t('Camera', 'Камера'), [['drone', t('Drone', 'Дрон')], ['top', t('Top', 'Сверху')], ['helm', t('Helm', 'Штурвал')]])}
      {sw('guides', t('Guides on the water', 'Подсказки на воде'))}
    </div>
  );
}
