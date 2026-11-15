'use client';
import { useEffect, useState } from 'react';
import { ruBoats, tx, type Lang } from '@/lib/lang';
import Link from 'next/link';
import { readOpts, saveOpts } from '@/lib/opts';
import { BOAT_EVENT, readBoat } from '@/lib/boat';
import { findFlag } from '@/lib/flags';
import { venueOf } from '@/lib/venues';
import { KN, type Wind } from '@/lib/race';
import { IconBoats, IconSail, IconWind } from './ui';

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
      <span className="bt-k" id="fq-k"><IconWind s={13} />{t('Or a free race, in a wind you pick', 'Или свободная гонка в свой ветер')}{last && <span className="bt-k-r">{last}</span>}</span>
      <div className="bt-pills" role="group" aria-labelledby="fq-k">
        {winds.map(([w, label]) => (
          <button key={w} type="button" className="bt-pill bt-pill-go" onClick={() => go(w)}>{label} <small>{KN[w]} {t('kn', 'уз')}</small></button>
        ))}
      </div>
      <Link className="lb-more" href="/race/free">{t('Set up a free race: place, wind, course', 'Настроить свободную гонку: место, ветер, дистанция')}</Link>
    </div>
  );
}

// The match race, one on one against a friend: a link to send. Until the umpire's calls are signed off it shows only when
// the hub's address has ?match (the hub is built once for everyone, so the address is read here in the browser).
export function MatchCard({ lang }: { lang: Lang }) {
  const t = tx(lang);
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(new URLSearchParams(location.search).has('match')); }, []);
  if (!on) return null;
  return (
    <div className="bt-g">
      <span className="bt-k"><IconBoats s={13} />{t('Match race', 'Матчевая гонка')}</span>
      <p className="bt-hint">{t('You and a friend, one on one: send a link.', 'Вы и друг, один на один: отправьте ссылку.')}</p>
      <Link className="lb-more" href="/match/new">{t('Set up a match', 'Настроить матч')}</Link>
    </div>
  );
}

// Your boat in the hub's rows, with her sail number and country on the right, as the boat saved on this device has them
export function BoatRow({ lang }: { lang: Lang }) {
  const t = tx(lang);
  const [note, setNote] = useState('');
  useEffect(() => {
    const load = () => {
      const b = readBoat(), f = findFlag(b.flag);
      setNote([`${b.nat} ${b.num || '1'}`.trim(), f ? t(f.en, f.ru) : ''].filter(Boolean).join(' · '));
    };
    load();
    addEventListener(BOAT_EVENT, load); // the account's boat, just brought to this device
    return () => removeEventListener(BOAT_EVENT, load);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Link className="bt-row" href="/boat"><IconSail s={18} /><span>{t('Your boat', 'Твоя яхта')}</span>{note && <span className="bt-row-m">{note}</span>}</Link>;
}
