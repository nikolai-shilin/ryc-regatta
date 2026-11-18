'use client';
import { useEffect, useState } from 'react';
import { tx, type Lang } from '@/lib/lang';
import { OPTS_EVENT, readOpts, saveOpts } from '@/lib/opts';
import { IconArrow } from './ui';

// The ways into Audio & graphics on the site's pages. The menu itself (public/game/av-menu.js) is the race's too, and
// is only fetched when it's opened.
const openAv = async (lang: Lang) => {
  const { openAvMenu } = await import('@/public/game/av-menu.js');
  openAvMenu({ lang, read: readOpts, write: saveOpts });
};

const IconSliders = () => <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M4 7h9M19 7h1M4 17h1M11 17h9" /><circle cx="16" cy="7" r="2.5" /><circle cx="8" cy="17" r="2.5" /></svg>;

// what's chosen, read again whenever the settings change
function useSummary(lang: Lang) {
  const [sum, setSum] = useState('');
  useEffect(() => {
    let live = true;
    const load = async () => { const { avSummary } = await import('@/public/game/av-menu.js'); if (live) setSum(avSummary(readOpts(), lang)); };
    load();
    addEventListener(OPTS_EVENT, load);
    return () => { live = false; removeEventListener(OPTS_EVENT, load); };
  }, [lang]);
  return sum;
}

// a row of the race hub's and the free race's Settings; `wide`: the row across /settings
export function AvRow({ lang, wide = false }: { lang: Lang; wide?: boolean }) {
  const t = tx(lang), sum = useSummary(lang), name = t('Audio & graphics', 'Звук и графика');
  if (wide) return (
    <button type="button" className="st-boat st-av" onClick={() => openAv(lang)}>
      <IconSliders /><b>{name}</b><span className="st-boat-k">{sum}</span>
      <span className="st-boat-e">{t('Open', 'Открыть')}<IconArrow s={14} /></span>
    </button>
  );
  return <button type="button" className="bt-row" onClick={() => openAv(lang)}><IconSliders /><span>{name}</span>{sum && <span className="bt-row-m">{sum}</span>}</button>;
}

// the line in the header's menu
export function AvMenuItem({ lang }: { lang: Lang }) {
  return <button type="button" className="hm-mi hm-mi-btn" onClick={() => openAv(lang)}>{tx(lang)('Audio & graphics', 'Звук и графика')}</button>;
}
