// What the game does round the race itself, kept out of main.js, which calls in here at four places: newRace (a race
// is built), start (it starts), frame (each frame, after the race has stepped) and settings (what a drill sails).
//
//   The ghost: a boat that sails a race already sailed, see-through and out of the race (no rules, no collisions),
//     where her track had her at each moment of the clock: your own best in today's race, kept on this device, or the
//     race a result link names (/play?race=today&ghost=<id>, from the result page's "Race this ghost"). Over the board,
//     how far ahead or behind her you are: the clock now against hers where she was nearest you on the same leg.
//   The drills: a minute or two each, from /race/drills (/play?race=free&drill=<id>). A computer skipper sails your
//     boat to the moment the drill is about (or not, for the start), hands her over, and the drill ends when it's
//     done: stars for how it went, kept on this device (localStorage regatta-drills), never posted as a race.
//   The analytics: the race's moments as Vercel Web Analytics events (the pages send theirs with @vercel/analytics):
//     a race started, a race left before the finish, a drill done.
import { makeBoatView } from './boats3d.js';
import { LOOKS, playerLook } from './yacht.js';
import { VENUE } from './venues.js';
import { along, ghostGap } from './track.js';

const tr = (en, ru) => (ctx?.LANG === 'ru' ? ru : en); // the game's language (main.js), handed over at init
const q = new URLSearchParams(location.search);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fmt = (s) => { const a = Math.abs(s), m = Math.floor(a / 60), r = a - m * 60; return `${m}:${r.toFixed(1).padStart(4, '0')}`; };
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };

// ---------- analytics ----------
// Vercel Web Analytics' own script, as the pages have it (they load it with @vercel/analytics); not on a local copy.
window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
if (!/^(localhost|127\.|\[::1\])/.test(location.hostname)) {
  document.head.append(Object.assign(document.createElement('script'), { src: '/_vercel/insights/script.js', defer: true }));
}
export const track = (name, data) => { try { window.va('event', { name, data }); } catch (e) {} };

// ---------- the drills ----------
// Each drill's race (a free race of its own, whatever the set-up page last chose), where it hands over, when it ends
// and how it scores: 3 stars, 2, 1, or 0 for not done.
export const DRILLS = {
  start: { race: { preset: 'medium', fleet: 6, length: 'short', laps: 1, start: 1, current: 0, course: 'wl' } },
  mark: { race: { preset: 'medium', fleet: 6, length: 'short', laps: 1, start: 1, current: 0, course: 'wl' } },
  beat: { race: { preset: 'light', fleet: 6, length: 'short', laps: 1, start: 1, current: 0, course: 'wl' } },
};
export const DRILL_ORDER = ['start', 'mark', 'beat'];
const drillId = q.get('drill') && DRILLS[q.get('drill')] ? q.get('drill') : null;
export const drill = drillId;
// what a drill sails, over the free race's own choices (main.js settings())
export const drillSettings = () => (drillId ? DRILLS[drillId].race : null);
const drillName = (id) => ({ start: tr('The start', 'Старт'), mark: tr('The top mark', 'Верхний знак'), beat: tr('The shifts', 'Сдвиги ветра') })[id];

let ctx = null, ghost = null, dr = null;
const css = `
.b-ghost { display: flex; align-items: center; gap: var(--s-3, 12px); height: 30px; padding: 0 var(--s-3, 12px); border-top: 1px solid var(--rule, rgba(255,255,255,.12)); font: 700 var(--fs-small, 14px)/1 var(--cond, sans-serif); text-transform: uppercase; letter-spacing: var(--ls-button, .04em); }
.b-ghost i { width: 10px; height: 10px; border-radius: 50%; background: rgba(255,255,255,.55); box-shadow: 0 0 0 2px rgba(255,255,255,.18); flex: none; }
.b-ghost span { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-2, #aab); }
.b-ghost b { font-variant-numeric: tabular-nums; } .b-ghost b.up { color: var(--up, #2ee6a0); } .b-ghost b.down { color: var(--down, #ff8a3d); }
.drill-k { position: fixed; left: 50%; top: calc(14px + env(safe-area-inset-top)); translate: -50% 0; z-index: 40; display: flex; align-items: stretch; height: 30px; pointer-events: none;
  font: 700 var(--fs-small, 14px)/1 var(--cond, sans-serif); letter-spacing: var(--ls-label, .08em); text-transform: uppercase; }
.drill-k > * { display: flex; align-items: center; padding: 0 var(--s-4, 16px); }
.drill-k b { background: var(--gold, #f5c400); color: var(--ink-on, #070d16); } .drill-k span { background: var(--panel, rgba(10,18,30,.8)); color: var(--ink, #fff); }
.drill-end { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(4, 9, 16, 0.55); }
.drill-end .in { width: min(440px, 100%); display: flex; flex-direction: column; gap: var(--s-4, 16px); padding: var(--s-6, 24px); background: var(--panel-2, #0d1724); color: var(--ink, #fff); box-shadow: 0 20px 60px rgba(0,0,0,.5); }
.drill-end .k { font: 700 var(--fs-small, 14px)/1 var(--cond, sans-serif); letter-spacing: var(--ls-label, .08em); text-transform: uppercase; color: var(--ink-2, #aab); }
.drill-end h2 { margin: 0; font: 800 var(--fs-title, 28px)/1 var(--cond, sans-serif); text-transform: uppercase; }
.drill-end .st { display: flex; gap: 6px; font-size: 34px; line-height: 1; color: rgba(255,255,255,.18); } .drill-end .st .on { color: var(--gold, #f5c400); }
.drill-end p { margin: 0; font: 500 var(--fs-body, 16px)/1.45 var(--sans, sans-serif); color: var(--ink-2, #ccd); }
.drill-end .bs { display: flex; flex-wrap: wrap; gap: 8px; }
.drill-end a { border-radius: 0; display: inline-flex; align-items: center; height: 44px; padding: 0 18px; background: var(--fill-2, rgba(255,255,255,.12)); color: var(--ink, #fff); font: 700 var(--fs-small, 14px)/1 var(--cond, sans-serif); letter-spacing: var(--ls-button, .04em); text-transform: uppercase; text-decoration: none; }
.drill-end a.go { background: var(--you, #3db8ff); color: var(--ink-on, #070d16); }
`;

// main.js hands over what the hooks need: the world, the toast, and how to stop the race (a drill's end)
export function initExtras(c) {
  ctx = c;
  document.head.append(Object.assign(document.createElement('style'), { textContent: css }));
  // a race left before its finish (not a drill): where it was left
  addEventListener('pagehide', () => {
    const race = ctx.getRace();
    if (!ctx.isRunning() || !race || race.over || race.player.done || dr) return;
    track('Race left', { race: race.settings?.daily ? 'daily' : 'free', leg: race.player.leg, min: Math.max(0, Math.round(race.clock / 60)) });
  });
}

// ---------- the ghost ----------
// the ghost to sail against: a result link's race (today's only: the same course), else your best today on this device
async function ghostFor(race) {
  const day = race.settings?.daily;
  if (!day || drillId) return null;
  const want = q.get('ghost');
  const pick = (r, own) => {
    const b = r && r.daily === day && Array.isArray(r.boats) && r.boats.find((x) => x.me);
    return b && b.done && !b.dsq && b.secs != null && b.track?.length > 1 ? { track: b.track, secs: b.secs, legT: b.legT || [], start: r.start || 1, own, id: r.id } : null;
  };
  if (want && UUID.test(want)) {
    const mine = read('regatta-result-' + want);
    if (mine) return pick(mine, true);
    try {
      const r = await fetch(`https://iyt.rycrentals.com/api/game?race=${want.toLowerCase()}`).then((x) => (x.ok ? x.json() : null));
      return pick(r, false);
    } catch (e) { return null; }
  }
  if ((read('regatta') || {}).ghost === 0) return null; // Settings › Ghost of your best: off
  let best = null;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('regatta-result-')) continue;
    const g = pick(read(k), true);
    if (g && (!best || g.secs < best.secs)) best = g;
  }
  return best;
}

function makeGhost(g) {
  const { world } = ctx;
  const look = g.own ? playerLook() : LOOKS.Aurora;
  const name = g.own ? tr('Your best', 'Твой лучший') : tr('Ghost', 'Призрак');
  const v = makeBoatView({ look, label: { text: `${name} ${fmt(g.secs)}`, color: 0xffffff } });
  // see-through, and never hiding what's behind her
  v.root.traverse((o) => {
    if (!o.material) return;
    o.material = Array.isArray(o.material) ? o.material.map((m) => see(m)) : see(o.material);
    o.castShadow = false;
  });
  world.scene.add(v.root);
  // her own boat, posed each frame: your boat's properties, then where the track had her
  const P = ctx.getRace().player, b = Object.assign(Object.create(Object.getPrototypeOf(P)), P);
  const el = document.createElement('div'); el.className = 'b-ghost';
  el.innerHTML = `<i></i><span>${name} · ${fmt(g.secs)}</span><b></b>`;
  document.querySelector('.b-board')?.append(el);
  return { ...g, v, b, el, gapEl: el.querySelector('b'), lastGap: 0 };
}
function see(m) { const c = m.clone(); c.transparent = true; c.opacity = 0.32 * (m.opacity ?? 1); c.depthWrite = false; return c; }
function dropGhost() {
  if (!ghost) return;
  ctx.world.scene.remove(ghost.v.root);
  ghost.el.remove();
  ghost = null;
}

// ---------- the hooks ----------
// a race is built (each start builds one): no ghost from the last
export function onNewRace() { dropGhost(); }

export async function onStart(race) {
  track('Race start', { race: drillId ? 'drill' : race.settings?.daily ? 'daily' : 'free', venue: VENUE.id, ...(drillId && { drill: drillId }) });
  dropGhost();
  if (drillId) { startDrill(race); return; }
  const g = await ghostFor(race);
  if (g && race === ctx.getRace() && !race.over) { ghost = makeGhost(g); track('Ghost', { own: g.own ? 1 : 0 }); if (window.__rg) window.__rg.ghost = ghost; } // ?debug: main.js's window.__rg
}

export function onFrame(race, dt, t) {
  if (ghost && race === ctx.getRace()) {
    const p = along(ghost.track, ghost.secs, ghost.start, race.clock), b = ghost.b, W = race.wind.dir();
    if (p) {
      const twa = Math.atan2(Math.sin(W - p.h), Math.cos(W - p.h)), down = Math.abs(twa) > 1.75, a = Math.abs(twa) * 180 / Math.PI;
      Object.assign(b, { x: p.x, z: p.z, h: p.h, twa, awa: twa * (down ? 0.8 : 0.6), heel: down ? 6 : a < 60 ? 14 : 10, sail: Math.min(80, Math.max(12, 16 + (a - 41) * 0.52)),
        kite: down, kiteFill: down ? 1 : 0, boom: Math.sign(twa) || 1, v: 3, rudder: 0, luff: 0, trim: 'ok', wdir: W, tws: race.wind.p.tws, done: race.clock > ghost.secs, pen: null });
      ghost.v.root.visible = true;
      ghost.v.update(b, t, ctx.world.W, ctx.world.mode === 'drone');
    }
    // the gap, a few times a second
    if ((ghost.tick = (ghost.tick || 0) + dt) > 0.4) {
      ghost.tick = 0;
      const P = race.player, s = P.done ? P.finish - ghost.secs : ghostGap(ghost, P.x, P.z, P.leg, race.clock);
      ghost.gapEl.textContent = s == null ? '—' : `${s > 0 ? '+' : '−'}${Math.abs(s).toFixed(1)}`;
      ghost.gapEl.className = s == null ? '' : s > 0.05 ? 'down' : 'up';
    }
  }
  if (dr) drillFrame(race);
}

// ---------- a drill's course ----------
function startDrill(race) {
  const P = race.player;
  dr = { id: drillId, done: false, pens: 0 };
  // the minute before: yours. The others: a computer skipper sails her to the moment, then she's yours
  if (drillId !== 'start') {
    P.ai = { ...(race.boats.find((b) => b.ai)?.ai || {}), skill: 0.92, lineT: 0.5, lastTack: -999, go: false, wp: 0, dirtyT: 0, hailT: -99, port: false, dare: 0, loiter: 1 };
    const until = drillId === 'mark' ? () => P.leg >= 1 && race.distToNext(P) < 130 : () => race.clock > 4;
    for (let n = 0; n < 60 * 600 && !until(); n++) race.step(1 / 60);
    delete P.ai; P.auto = null;
    race.messages.length = 0; for (const b of race.boats) if (b.events) b.events.length = 0; // what was said on the way: not said now
  }
  dr.t0 = race.clock; dr.place0 = race.standings().indexOf(P) + 1; dr.pens0 = P.pens || 0;
  const k = document.createElement('div'); k.className = 'drill-k';
  k.innerHTML = `<b>${tr('Drill', 'Тренировка')}</b><span>${drillName(drillId)} · ${{ start: tr('cross at the gun, at speed', 'пересеки линию со стартом, на скорости'), mark: tr('round it, gain a place', 'обогни и выиграй место'), beat: tr('to the top mark', 'до верхнего знака') }[drillId]}</span>`;
  document.body.append(k); dr.k = k;
}

function drillFrame(race) {
  if (dr.done) return;
  const P = race.player, L = race.log;
  let end = false;
  if (dr.id === 'start') end = race.clock >= 8;
  else if (dr.id === 'mark') {
    if (P.leg >= 2 && dr.roundT == null) dr.roundT = race.clock;
    end = (dr.roundT != null && race.clock - dr.roundT > 20) || race.clock - dr.t0 > 180; // 20 s down the run after it
  } else if (dr.id === 'beat') end = P.leg >= 2 || race.clock - dr.t0 > 600;
  if (!end) return;
  dr.done = true;
  const place = race.standings().indexOf(P) + 1, pens = (P.pens || 0) - dr.pens0, n = race.boats.length;
  let stars = 0, line = '';
  if (dr.id === 'start') {
    const d = L.gunD, v = L.gunV;
    if (L.ocs || L.startDsq) { stars = 0; line = tr('Over the line at the gun: you had to go back. Hold below it until the last seconds.', 'На старте за линией — пришлось возвращаться. Держись под ней до последних секунд.'); }
    else if (d == null) { stars = 0; line = tr('No start this time.', 'В этот раз старта не было.'); }
    else {
      stars = d < 10 && v > 4.5 ? 3 : d < 25 && v > 3.5 ? 2 : 1;
      line = tr(`At the gun: ${Math.round(Math.max(0, d))} m from the line at ${v.toFixed(1)} kn. ${stars === 3 ? 'That is the start that wins races.' : 'Three stars: under 10 m, over 4.5 kn.'}`,
        `На сигнале: ${Math.round(Math.max(0, d))} м до линии, ${v.toFixed(1).replace('.', ',')} уз. ${stars === 3 ? 'Такой старт и выигрывает гонки.' : 'Три звезды: ближе 10 м, быстрее 4,5 уз.'}`);
    }
  } else if (dr.id === 'mark') {
    const gained = dr.place0 - place;
    stars = P.leg < 2 ? 0 : pens ? 1 : gained > 0 || place === 1 ? 3 : gained === 0 ? 2 : 1;
    line = P.leg < 2 ? tr('The mark wasn’t rounded in time.', 'Знак не обогнут вовремя.')
      : tr(`${ord(dr.place0)} at the zone, ${ord(place)} after it${pens ? ', with a penalty' : ''}. ${stars === 3 ? 'Wide in, tight out.' : 'Three stars: a place gained (or kept at the front), and no penalty.'}`,
        `${dr.place0}-е у зоны, ${place}-е после неё${pens ? ', со штрафом' : ''}. ${stars === 3 ? 'Широко на вход, плотно на выход.' : 'Три звезды: выигранное место (или удержанное первое) и без штрафа.'}`);
  } else {
    stars = P.leg < 2 ? 0 : place <= 2 && !pens ? 3 : place <= Math.ceil(n / 2) ? 2 : 1;
    line = P.leg < 2 ? tr('Not at the mark in time.', 'Не дошёл до знака вовремя.')
      : tr(`${ord(place)} of ${n} at the top mark, ${fmt(race.clock)} after the gun. ${stars === 3 ? 'You played the shifts.' : 'Three stars: first or second there. Tack on the headers.'}`,
        `${place}-е из ${n} у верхнего знака, через ${fmt(race.clock)} после старта. ${stars === 3 ? 'Ты сыграл на сдвигах.' : 'Три звезды: первым или вторым. Поворачивай на заходах.'}`);
  }
  const all = read('regatta-drills') || {}, was = all[dr.id] || 0;
  if (stars > was) { all[dr.id] = stars; try { localStorage.setItem('regatta-drills', JSON.stringify(all)); } catch (e) {} }
  track('Drill done', { drill: dr.id, stars });
  ctx.stop();
  dr.k?.remove();
  const next = DRILL_ORDER[DRILL_ORDER.indexOf(dr.id) + 1];
  const el = document.createElement('div'); el.className = 'drill-end'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.innerHTML = `<div class="in"><span class="k">${tr('Drill', 'Тренировка')} · ${drillName(dr.id)}</span>
    <h2>${stars === 3 ? tr('Three stars', 'Три звезды') : stars ? tr(`${stars} ${stars === 1 ? 'star' : 'stars'}`, `${stars} ${stars === 1 ? 'звезда' : 'звезды'}`) : tr('Try again', 'Ещё раз')}</h2>
    <div class="st" aria-label="${stars} / 3">${[1, 2, 3].map((i) => `<span class="${i <= stars ? 'on' : ''}">★</span>`).join('')}</div>
    <p></p>${stars > was && was ? `<p>${tr('A new best on this drill.', 'Новый рекорд в этой тренировке.')}</p>` : ''}
    <div class="bs"><a class="go" href="${location.pathname}${location.search}">${tr('Again', 'Ещё раз')}</a>${next ? `<a href="/play?race=free&drill=${next}">${tr('Next drill', 'Следующая')}</a>` : ''}<a href="/race/drills">${tr('All drills', 'Все тренировки')}</a></div></div>`;
  el.querySelector('p').textContent = line;
  document.body.append(el);
  el.querySelector('a.go').focus();
}
const ord = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`;
