'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { find, fold } from '@/public/game/words.js';
import { useSceneStart } from '@/lib/scene-start';

// /dictionary as the race shows its dictionary (public/game/words.js): the water in 3D filling the screen (public/word-view,
// the race's own scenes) and the panel docked at its side (at its foot on a phone held upright), in the same look
// (words.js WORDS_CSS) and working the same way: a field that finds a word in the names and the definitions, tabs that
// keep one group, each word a button that sails it on the water, and the caption over the water naming what's shown.
// Every word is in the page as it is sent, and each one's name is the link to its own page (/dictionary/<word>), so a
// search engine reads them all; a click shows it on the water instead, and the caption leads to its page. The word
// shown is kept in the address (#layline), so a link can open on it.
export type DictGroup = { id: string; title: string; terms: { id: string; term: string; def: string }[] };
export type DictWords = {
  title: string; back: string; find: string; clear: string; topics: string; all: string; allGroups: string;
  notShown: string; notIn: string; none: string; page: string; scene: string; more: string;
  links: [string, string][];
};

// a term's name with what the search found in it marked (words.js named())
function Named({ term, q, lang }: { term: string; q: string; lang: string }) {
  const parts = fold(q, lang).split(/\s+/).filter(Boolean), f = fold(term, lang);
  if (!parts.length || f.length !== term.length) return <>{term}</>;
  const on = new Array(term.length).fill(false);
  for (const p of parts) for (let i = f.indexOf(p); i >= 0; i = f.indexOf(p, i + 1)) on.fill(true, i, i + p.length);
  const out = [];
  for (let i = 0; i < term.length;) { let j = i; while (j < term.length && on[j] === on[i]) j++; out.push(on[i] ? <mark key={i}>{term.slice(i, j)}</mark> : <span key={i}>{term.slice(i, j)}</span>); i = j; }
  return <>{out}</>;
}

export function DictionaryScreen({ lang, groups, shown3d, w }: { lang: string; groups: DictGroup[]; shown3d: string[]; w: DictWords }) {
  const [q, setQ] = useState(''), [tab, setTab] = useState(''), [picked, setPicked] = useState<string | null>(null), [live, setLive] = useState(false);
  const { go } = useSceneStart(false);
  const water = useRef<HTMLIFrameElement>(null), card = useRef<HTMLElement>(null), cap = useRef<HTMLDivElement>(null), field = useRef<HTMLInputElement>(null);
  const has = useMemo(() => new Set(shown3d), [shown3d]);
  const tuples = useMemo(() => groups.map((g) => ({ id: g.id, title: g.title, terms: g.terms.map((x) => [x.id, x.term, x.def] as [string, string, string]) })), [groups]);
  const byId = useMemo(() => new Map(groups.flatMap((g) => g.terms.map((x) => [x.id, { ...x, group: g.title }]))), [groups]);
  const v = q.trim(), res = find(tuples, v, tab, lang);
  const any = res.reduce((s, g) => s + (g.shown ? g.count : 0), 0), total = byId.size;
  const first = useMemo(() => groups.flatMap((g) => g.terms).find((x) => has.has(x.id))?.id ?? null, [groups, has]);
  const [start, setStart] = useState<string | null>(null); // the word the scene is opened on (the address's, or the first)

  const post = (msg: object) => water.current?.contentWindow?.postMessage(msg, location.origin);
  const choose = (id: string) => {
    if (!byId.has(id)) return;
    setPicked(id);
    if (has.has(id)) post({ type: 'word', id });
    try { history.replaceState(history.state, '', `#${id}`); } catch { /* (a sandboxed page) */ }
  };
  // the word in the address, or the first the game sails
  useEffect(() => {
    const h = decodeURIComponent(location.hash.slice(1)), id = byId.has(h) ? h : first;
    if (id) { setPicked(id); setStart(has.has(id) ? id : first); }
    // another word's address followed on this page (a link to #gybe)
    const moved = () => { const k = decodeURIComponent(location.hash.slice(1)); if (byId.has(k)) choose(k); };
    addEventListener('hashchange', moved);
    return () => removeEventListener('hashchange', moved);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (picked) document.querySelector(`.wd-w[data-id="${CSS.escape(picked)}"]`)?.scrollIntoView({ block: 'nearest' }); }, [start]); // eslint-disable-line react-hooks/exhaustive-deps

  // the open part of the screen: beside the panel, or over it on a phone held upright; the caption at its foot (its
  // top), and the scene told to frame the word there (words.js place())
  const place = () => {
    const c = card.current?.getBoundingClientRect(); if (!c) return;
    const W = innerWidth, H = innerHeight, side = c.width < W * 0.8;
    const open = side ? { x: c.right, y: 0, w: Math.max(1, W - c.right), h: H } : { x: 0, y: 0, w: W, h: Math.max(1, c.top) };
    post({ type: 'view', x: open.x / W, y: open.y / H, w: open.w / W, h: open.h / H });
    const s = cap.current?.style;
    if (s) { cap.current!.classList.toggle('top', !side); Object.assign(s, { left: `${open.x + 16}px`, right: '16px', top: side ? 'auto' : '12px', bottom: side ? '16px' : 'auto' }); }
  };
  useLayoutEffect(() => { place(); addEventListener('resize', place); return () => removeEventListener('resize', place); }); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!go) return;
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== water.current?.contentWindow) return;
      if (e.data?.type === 'ready') place();
      if (e.data?.type === 'live') { setLive(true); place(); }
    };
    addEventListener('message', on);
    return () => removeEventListener('message', on);
  }, [go]); // eslint-disable-line react-hooks/exhaustive-deps

  // the keys: / to the field, Esc clears it, ↑ ↓ from word to word, ← → along the tabs
  const keys = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement;
    if (e.key === 'Escape' && q) { e.preventDefault(); setQ(''); return; }
    if (e.key === '/' && el !== field.current) { e.preventDefault(); field.current?.focus(); return; }
    const go1 = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (go1 && el.classList.contains('wd-pick')) {
      e.preventDefault();
      const ps = [...(card.current?.querySelectorAll<HTMLElement>('.wd-pick') ?? [])].filter((p) => p.offsetParent !== null), next = ps[ps.indexOf(el) + go1];
      if (next) { choose(next.closest<HTMLElement>('.wd-w')!.dataset.id!); next.focus({ preventScroll: true }); next.scrollIntoView({ block: 'nearest' }); }
      return;
    }
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (step && el.getAttribute('role') === 'radio') {
      e.preventDefault();
      const rs = [...el.parentElement!.children] as HTMLElement[], next = rs[(rs.indexOf(el) + step + rs.length) % rs.length];
      next.click(); next.focus();
    }
  };
  const pick = (e: MouseEvent, id: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; // (a new tab: the word's page)
    e.preventDefault(); choose(id);
  };

  const p = picked ? byId.get(picked) : null;
  const tabs = [{ id: '', name: w.all }, ...groups.map((g) => ({ id: g.id, name: g.title }))];
  return (
    <>
      {go && start ? <iframe ref={water} className={`dc-water${live ? ' live' : ''}`} src={`/word-view?w=${encodeURIComponent(start)}&lang=${lang}`} title={w.scene} /> : null}
      <div className="wd bc staged" onKeyDown={keys}>
        <section className="wd-card" ref={card} aria-labelledby="dc-h">
          <div className="wd-top">
            <h1 id="dc-h">{w.title}</h1><span className="wd-n">{total}</span>
            <a className="wd-back" href="/learn" onClick={(e) => { if (document.referrer.startsWith(location.origin) && history.length > 1) { e.preventDefault(); history.back(); } }}>{w.back}</a>
          </div>
          <div className="wd-bar">
            <div className="wd-find">
              <input ref={field} className="wd-q" type="search" placeholder={w.find} aria-label={w.find} autoComplete="off" spellCheck={false} enterKeyHint="search" value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="wd-x" type="button" aria-label={w.clear} hidden={!q} onClick={() => { setQ(''); field.current?.focus(); }}>×</button>
            </div>
            <div className="wd-tabs" role="radiogroup" aria-label={w.topics}>
              {tabs.map((tb) => {
                const k = tb.id ? res.find((g) => g.id === tb.id)!.count : res.reduce((s, g) => s + g.count, 0);
                return <button key={tb.id || 'all'} type="button" role="radio" aria-checked={tb.id === tab} tabIndex={tb.id === tab ? 0 : -1} className={k ? undefined : 'none'} data-g={tb.id} onClick={() => setTab(tb.id)}>{tb.name}<i>{k}</i></button>;
              })}
            </div>
          </div>
          <div className="wd-body">
            <div className="wd-cols">
              {res.map((g, gi) => (
                <section key={g.id} className="wd-g" id={g.id} hidden={!g.shown}>
                  <h2 className="dc-h3"><b>{String(gi + 1).padStart(2, '0')}</b><span>{g.title}</span></h2>
                  <dl>
                    {g.terms.map((x) => (
                      <div key={x.id} className={`wd-w${x.id === picked ? ' on' : ''}${x.named ? ' hit' : ''}`} data-id={x.id} hidden={!x.shown}>
                        <dt><a className="wd-pick" href={`/dictionary/${x.id}`} aria-current={x.id === picked ? 'true' : undefined} onClick={(e) => pick(e, x.id)}>
                          <span className="wd-tn"><Named term={x.term} q={x.shown ? v : ''} lang={lang} /></span>{has.has(x.id) ? <span className="wd-3d">3D</span> : null}
                        </a></dt>
                        <dd>{x.def}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
            <p className="wd-say" hidden={any > 0}>
              {any > 0 ? null : <>{(tab && res.some((g) => g.count) ? w.notIn : w.none).replace('%s', v)}<button type="button" onClick={() => { if (tab) setTab(''); else setQ(''); field.current?.focus(); }}>{tab ? w.allGroups : w.clear}</button></>}
            </p>
            <nav className="dc-foot" aria-label={w.more}>
              {w.links.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
            </nav>
          </div>
        </section>
        <div className="wd-cap" ref={cap} hidden={!p} aria-live="polite">
          {p ? <>
            <span>{p.group}</span><b>{p.term}</b><p>{p.def}</p>
            {has.has(p.id) ? null : <i>{w.notShown}</i>}
            <a className="dc-cap-go" href={`/dictionary/${p.id}`}>{w.page} →</a>
          </> : null}
        </div>
      </div>
    </>
  );
}
