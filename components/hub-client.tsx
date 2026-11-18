'use client';
import { useEffect, useState } from 'react';
import { ruBoats, tx, type Lang } from '@/lib/lang';
import Link from 'next/link';
import { readOpts, saveOpts } from '@/lib/opts';
import { venueOf } from '@/lib/venues';
import { KN, type Wind } from '@/lib/race';
import { IconBoats, IconWind } from './ui';

// The free race in the race hub's card: one tap starts a free race in that wind (with the venue, fleet, course and
// start you chose last time), as the pause menu's pills.
export function FreeQuick({ lang }: { lang: Lang }) {
  const t = tx(lang);
  const [last, setLast] = useState('');
  useEffect(() => {
    const o = readOpts();
    if (!o.lastFree) return;
    const w = { light: t('light', 'слабый'), medium: t('medium', 'средний'), strong: t('strong', 'сильный') }[o.preset];
    const v = t(...venueOf(o.venue).name), laps = o.laps > 1 ? t(`, ${o.laps} laps`, `, ${o.laps} круга`) : '';
    setLast(t(`Last: ${v}, ${w}, ${o.fleet} boats${laps}`, `Прошлая: ${v}, ${w}, ${ruBoats(o.fleet)}${laps}`));
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (preset: Wind) => { saveOpts({ preset, mode: 'free', lastFree: Date.now() }); location.href = '/play?race=free'; };
  const winds: [Wind, string][] = [['light', t('Light', 'Слабый')], ['medium', t('Medium', 'Средний')], ['strong', t('Strong', 'Сильный')]];
  return (
    <div className="bt-g">
      <span className="bt-k" id="fq-k"><IconWind s={13} />{t('Custom race', 'Своя гонка')}{last && <span className="bt-k-r" title={last}>{last}</span>}</span>
      <div className="bt-pills" role="group" aria-labelledby="fq-k">
        {winds.map(([w, label]) => (
          <button key={w} type="button" className="bt-pill bt-pill-go" onClick={() => go(w)}>{label} <small>{KN[w]} {t('kn', 'уз')}</small></button>
        ))}
      </div>
      <Link className="lb-more" href="/race/free">{t('Set up a custom race: place, wind, course', 'Настроить свою гонку: место, ветер, дистанция')}</Link>
    </div>
  );
}

// The 1-on-1 race, against a friend: a link to send. Until the owner's test race it shows only when
// the hub's address has ?match (the hub is built once for everyone, so the address is read here in the browser).
export function MatchCard({ lang }: { lang: Lang }) {
  const t = tx(lang);
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(new URLSearchParams(location.search).has('match')); }, []);
  if (!on) return null;
  return (
    <div className="bt-g">
      <span className="bt-k"><IconBoats s={13} />{t('1-on-1 race', 'Гонка 1 на 1')}</span>
      <p className="bt-hint">{t('You and a friend, one on one: send a link.', 'Вы и друг, один на один: отправьте ссылку.')}</p>
      <Link className="lb-more" href="/match/new">{t('Set up a 1-on-1 race', 'Настроить гонку 1 на 1')}</Link>
    </div>
  );
}
