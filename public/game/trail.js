// The way back: every back arrow on the site and every way out of the race takes you to the page you came from, as the
// browser's back would, wherever you are. The site's pages (components/back-link.tsx) and the race (main.js) keep one
// trail for the tab, in sessionStorage, so it outlives the full loads between them (the race is a page of its own).
//
// The trail is a list of steps { p, n }: p the page's address (path and query), n how many of the browser's history
// entries that step is from the one before it: 1 for a link, 2 when a page loaded again in place (the language switch,
// /lang, goes out and comes back to the same page), 0 when nobody knows (we jumped to it, or it came first). Going back
// one step whose n is known is the browser's own back (history.go(-n)), so the history stays as it was; otherwise the
// arrow goes to the page, as a link would.
//
// Back never goes to the race (/play: it would start a race again), to the language switch, to the page you are on,
// nor, once you are out of signing in, to its pages. With nothing left behind you, it goes where the arrow's href says.
// test/trail.test.mjs.

export const KEY = 'ud-trail';
const MAX = 40;

const bare = (p) => (String(p).split(/[?#]/)[0].replace(/\/+$/, '') || '/');
export const same = (a, b) => bare(a) === bare(b);
const isRace = (p) => bare(p) === '/play';
const isAuth = (p) => /^\/(sign-in|auth)(\/|$)/.test(bare(p));
const isLang = (p) => bare(p) === '/lang';

// a page arrived at: { pop } the browser's back or forward, { reload } the same page loaded again, { full, from } a full
// load and the address it came from on this site (document.referrer), if any
export function step(trail, here, { pop = false, reload = false, full = false, from = '' } = {}) {
  const t = trail.map((s) => ({ ...s }));
  const last = t[t.length - 1];
  if (!last) {
    if (from && !same(from, here)) t.push({ p: from, n: 0 });
    t.push({ p: here, n: from && !same(from, here) ? 1 : 0 });
  } else if (same(last.p, here)) {
    // the same page: a reload, a change of query, the arrival of a back that was already counted, or the page loaded
    // again from itself (the language switch), which is one more history entry to go back over
    if (pop && last.n > 1) last.n -= 1;
    else if (full && !reload && !pop && from && same(from, here) && last.n > 0) last.n += 1;
    last.p = here;
  } else if (pop && t.length > 1 && same(t[t.length - 2].p, here)) {
    t.pop();
    t[t.length - 1].p = here;
  } else t.push({ p: here, n: 1 });
  return t.slice(-MAX);
}

// where back goes from here: { trail } to keep, { to } the page, and { go: n } when it is n entries back in the history
export function back(trail, here, fallback) {
  const t = trail.map((s) => ({ ...s }));
  if (!t.length || !same(t[t.length - 1].p, here)) t.push({ p: here, n: 0 }); // out of step: start from here
  const cur = t[t.length - 1], auth = isAuth(here);
  let i = t.length - 2;
  while (i >= 0 && (isRace(t[i].p) || isLang(t[i].p) || same(t[i].p, here) || (!auth && isAuth(t[i].p)))) i--;
  if (i < 0) return { trail: [{ p: fallback, n: 0 }], to: fallback };
  const kept = t.slice(0, i + 1);
  if (i === t.length - 2 && cur.n > 0) return { trail: kept, go: cur.n, to: kept[i].p };
  kept[i] = { p: kept[i].p, n: 0 }; // reached by a jump: the history behind it is no longer this trail's
  return { trail: kept, to: kept[i].p };
}

// the trail once the race's page is replaced by another (main.js replaceRace): its steps go, so the page that takes its
// place is one step on from the page the race was started from
export function dropRace(trail) {
  const t = trail.map((s) => ({ ...s }));
  while (t.length && isRace(t[t.length - 1].p)) t.pop();
  return t;
}

// ---------- in the browser ----------
let mem = [];
export function load() {
  try { const v = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (Array.isArray(v)) mem = v.filter((s) => s && typeof s.p === 'string'); } catch (e) {}
  return mem;
}
export function save(t) { mem = t; try { sessionStorage.setItem(KEY, JSON.stringify(t)); } catch (e) {} }

const address = () => location.pathname + location.search;
const referrer = () => {
  try { const r = document.referrer ? new URL(document.referrer) : null; return r && r.origin === location.origin ? r.pathname + r.search : ''; } catch (e) { return ''; }
};

// a back of our own, under way: its arrival is already counted in the trail, not the browser's back
const GOING = KEY + '-going';
const ours = () => {
  let g = null;
  try { g = sessionStorage.getItem(GOING); sessionStorage.removeItem(GOING); } catch (e) {}
  return g != null && same(g, address());
};

// this page, just loaded in full (or brought back from the browser's cache: { pop: true })
export function arriveLoaded(o = {}) {
  let type = '';
  try { type = (performance.getEntriesByType('navigation')[0] || {}).type || ''; } catch (e) {}
  const own = ours();
  save(step(load(), address(), { full: true, pop: !own && (o.pop || type === 'back_forward'), reload: type === 'reload', from: own ? '' : referrer() }));
}
// this page, reached within the site's app (a link, or the browser's back: { pop: true })
export function arriveWithin(o = {}) { save(step(load(), address(), { pop: !ours() && !!o.pop })); }

// out of the race to a page that takes its place in the history (its result, the free race's set-up): the race's step
// goes, and its arrival there is ours, not a link from the race
export function outOfRace(to) {
  save(dropRace(load()));
  try { sessionStorage.setItem(GOING, to); } catch (e) {}
}
// go back from here; navigate(to) goes to a page (the app's router), without it location.href. The race passes { extra }:
// the history entry it adds of its own (main.js keeps the browser's back for its pause menu), and { single }: only the
// browser's back over one page, as a race loaded again in place (a new day) leaves entries it can't count.
export function goBack(fallback, navigate, { extra = 0, single = false } = {}) {
  const r = back(load(), address(), fallback);
  try { sessionStorage.setItem(GOING, r.to); } catch (e) {}
  if (r.go && (!single || r.go === 1) && history.length > r.go + extra) { save(r.trail); history.go(-r.go - extra); return; }
  save(r.trail.map((s, i, a) => (i === a.length - 1 ? { p: s.p, n: 0 } : s)));
  if (navigate) navigate(r.to); else location.href = r.to;
}
