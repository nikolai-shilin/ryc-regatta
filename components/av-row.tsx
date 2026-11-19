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

// what's chosen, read again whenever the settings change: all of it, and the graphics level alone
function useSummary(lang: Lang) {
  const [sum, setSum] = useState({ all: '', gfx: '' });
  useEffect(() => {
    let live = true;
    const load = async () => {
      const { avGfx, avSummary } = await import('@/public/game/av-menu.js');
      if (live) { const o = readOpts(); setSum({ all: avSummary(o, lang), gfx: avGfx(o, lang) }); }
    };
    load();
    addEventListener(OPTS_EVENT, load);
    return () => { live = false; removeEventListener(OPTS_EVENT, load); };
  }, [lang]);
  return sum;
}

// the button in the head of every panel over a 3D scene: the menu in one tap, with the level the scene is drawn at
export function AvButton({ lang }: { lang: Lang }) {
  const t = tx(lang), sum = useSummary(lang), name = t('Audio & graphics', 'Звук и графика', 'Audio y gráficos');
  return (
    <button type="button" className="bt-gfx" onClick={() => openAv(lang)} aria-haspopup="dialog" aria-label={sum.all ? `${name}: ${sum.all}` : name} title={name}>
      <IconSliders /><span>{t('Graphics', 'Графика', 'Gráficos')}</span>{sum.gfx && <b>{sum.gfx}</b>}
    </button>
  );
}

// a row of the panels' Settings; `wide`: the row across /settings
export function AvRow({ lang, wide = false }: { lang: Lang; wide?: boolean }) {
  const t = tx(lang), sum = useSummary(lang).all, name = t('Audio & graphics', 'Звук и графика', 'Audio y gráficos');
  if (wide) return (
    <button type="button" className="st-boat st-av" onClick={() => openAv(lang)}>
      <IconSliders /><b>{name}</b><span className="st-boat-k">{sum}</span>
      <span className="st-boat-e">{t('Open', 'Открыть', 'Abrir')}<IconArrow s={14} /></span>
    </button>
  );
  return <button type="button" className="bt-row" onClick={() => openAv(lang)}><IconSliders /><span>{name}</span>{sum && <span className="bt-row-m">{sum}</span>}</button>;
}

// the line in the header's menu
export function AvMenuItem({ lang }: { lang: Lang }) {
  return <button type="button" className="hm-mi hm-mi-btn" onClick={(e) => { e.currentTarget.closest('details')?.removeAttribute('open'); openAv(lang); }}>{tx(lang)('Audio & graphics', 'Звук и графика', 'Audio y gráficos')}</button>;
}
