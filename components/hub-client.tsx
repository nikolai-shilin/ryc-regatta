'use client';
import { useEffect, useState } from 'react';
import { ruBoats, tx, type Lang } from '@/lib/lang';
import { readOpts, saveOpts } from '@/lib/opts';
import { KN, type Wind } from '@/lib/race';
import { IconWind } from './ui';

// The free race in the race hub's card: one tap starts a free race in that wind (with the venue, fleet, course and
// start you chose last time), as the pause menu's pills.
export function FreeQuick({ lang }: { lang: Lang }) {
  const t = tx(lang);
  const [last, setLast] = useState('');
  useEffect(() => {
    const o = readOpts();
    if (!o.lastFree) return;
    const w = { light: t('light', 'слабый'), medium: t('medium', 'средний'), strong: t('strong', 'сильный') }[o.preset];
    setLast(t(`Last: ${w}, ${o.fleet} boats`, `Прошлая: ${w}, ${ruBoats(o.fleet)}`));
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (preset: Wind) => { saveOpts({ preset, mode: 'free', lastFree: Date.now() }); location.href = '/play?race=free'; };
  const winds: [Wind, string][] = [['light', t('Light', 'Слабый')], ['medium', t('Medium', 'Средний')], ['strong', t('Strong', 'Сильный')]];
  return (
    <div className="bt-g">
      <span className="bt-k" id="fq-k"><IconWind s={13} />{t('Or a free race, in a wind you pick', 'Или свободная гонка в свой ветер')}{last && <span className="bt-k-r">{last}</span>}</span>
      <div className="bt-pills" role="group" aria-labelledby="fq-k">
        {winds.map(([w, label]) => (
          <button key={w} type="button" className="bt-pill bt-pill-go" onClick={() => go(w)}>{label} {KN[w]} {t('kn', 'уз')}</button>
        ))}
      </div>
    </div>
  );
}
