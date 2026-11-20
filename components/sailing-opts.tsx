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
      {seg('autoTrim', t('Sails', 'Паруса', 'Velas', 'Segel', 'Yelkenler', 'Voiles', 'Vele'), [[0, t('I trim', 'Сам', 'Trimo yo', 'Ich trimme', 'Trimi ben yaparım', 'Je règle', 'Regolo io')], [1, t('Auto', 'Авто', 'Auto', 'Auto', 'Otomatik', 'Auto', 'Auto')], [2, t('Main + jib', 'Грот + стаксель', 'Mayor + foque', 'Groß + Fock', 'Ana yelken + flok', 'GV + foc', 'Randa + fiocco')]])}
      {seg('camera', t('Camera', 'Камера', 'Cámara', 'Kamera', 'Kamera', 'Caméra', 'Telecamera'), [['drone', t('Drone', 'Дрон', 'Dron', 'Drohne', 'Drone', 'Drone', 'Drone')], ['top', t('Top', 'Сверху', 'Cenital', 'Oben', 'Üst', 'Dessus', 'Dall’alto')], ['helm', t('Helm', 'Штурвал', 'Timón', 'Ruder', 'Dümen', 'Barre', 'Timoniere')]])}
      {sw('guides', t('Guides on the water', 'Подсказки на воде', 'Guías en el agua', 'Hilfslinien auf dem Wasser', 'Suda kılavuzlar', 'Aides sur l’eau', 'Guide sull’acqua'))}
    </div>
  );
}
