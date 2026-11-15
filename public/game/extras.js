// What the game does round the race itself, kept out of main.js, which calls in here at four places: newRace (a race
// is built), start (it starts), frame (each frame, after the race has stepped) and settings (what a drill sails).
//
//   The ghost: a boat that sails a race already sailed, see-through and out of the race (no rules, no collisions),
//     where her track had her at each moment of the clock: your own best in today's race, kept on this device (only when
//     Settings › Ghost of your best is on: it's off by default), or the
//     race a result link names (/play?race=today&ghost=<id>, from the result page's "Race this ghost"). Over the board,
//     how far ahead or behind her you are: the clock now against hers where she was nearest you on the same leg.
//   The drills: a minute or two each, from /race/drills (/play?race=free&drill=<id>). A computer skipper sails your
//     boat to the moment the drill is about (or not, for the start), hands her over, and the drill ends when it's
//     done: stars for how it went, kept on this device (localStorage regatta-drills), never posted as a race.
//   The analytics: the race's moments as Vercel Web Analytics events (/play loads its script; the pages send theirs
//   with @vercel/analytics):
//     a race started, a race left before the finish, a drill done.
import { makeBoatView } from './boats3d.js';
import { LOOKS, playerLook } from './yacht.js';
import { VENUE } from './venues.js';
import { along, ghostGap } from './track.js';
import { polarSpeed, beatAngle, lineT, KN, D2R } from './sim.js';

const tr = (en, ru) => (ctx?.LANG === 'ru' ? ru : en); // the game's language (main.js), handed over at init
const q = new URLSearchParams(location.search);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fmt = (s) => { const a = Math.abs(s), m = Math.floor(a / 60), r = a - m * 60; return `${m}:${r.toFixed(1).padStart(4, '0')}`; };
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };

// ---------- analytics ----------
// Vercel Web Analytics: /play loads its script itself (play/index.html), with the queue below for what's sent first
window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
export const track = (name, data) => { try { window.va('event', { name, data }); } catch (e) {} };

// ---------- the drills ----------
// Each drill's race (a free race of its own, whatever the set-up page last chose), where it hands over, when it ends
// and how it scores: 3 stars, 2, 1, or 0 for not done.
export const DRILLS = {
  start: { race: { preset: 'medium', fleet: 6, length: 'short', laps: 1, start: 1, current: 0, course: 'wl' } },
  // a line skewed 12°, one end or the other (drawn as the page loads, so Again may draw the other)
  end: { race: { preset: 'medium', fleet: 6, length: 'short', laps: 1, start: 1, current: 0, course: 'wl', bias: (Math.random() < 0.5 ? -1 : 1) * 12 } },
  layline: { race: { preset: 'medium', fleet: 6, length: 'short', laps: 1, start: 1, current: 0, course: 'wl' } },
  mark: { race: { preset: 'medium', fleet: 6, length: 'short', laps: 1, start: 1, current: 0, course: 'wl' } },
  beat: { race: { preset: 'medium', fleet: 6, length: 'short', laps: 1, start: 1, current: 0, course: 'wl' } },
  // two laps, so the run goes down to the gate (one lap's run is to the finish)
  run: { race: { preset: 'medium', fleet: 6, length: 'short', laps: 2, start: 1, current: 0, course: 'wl' } },
  // an upwind finish where the venue lays one (else up and down's, downwind through the start line)
  finish: { race: { preset: 'medium', fleet: 6, length: 'short', laps: 1, start: 1, current: 0, course: 'wlu' } },
  // a smaller fleet: room to spin
  penalty: { race: { preset: 'medium', fleet: 4, length: 'short', laps: 1, start: 1, current: 0, course: 'wl' } },
};
// as a race comes (lib/drills.ts lists them in this order too)
export const DRILL_ORDER = ['start', 'end', 'beat', 'layline', 'mark', 'run', 'finish', 'penalty'];
const drillId = q.get('drill') && DRILLS[q.get('drill')] ? q.get('drill') : null;
export const drill = drillId;
// what a drill sails, over the free race's own choices (main.js settings())
export const drillSettings = () => (drillId ? DRILLS[drillId].race : null);
const drillName = (id) => ({ start: tr('The start', 'Старт'), mark: tr('The top mark', 'Верхний знак'), beat: tr('The shifts', 'Сдвиги ветра'),
  run: tr('The run', 'Фордевинд'), finish: tr('The finish', 'Финиш'), end: tr('The favoured end', 'Выгодный конец'), layline: tr('The layline', 'Лейлайн'),
  penalty: tr('The penalty turn', 'Штрафной оборот') })[id];

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
.drill-end h2 { margin: 0; font: 700 var(--fs-h3, 32px)/1 var(--cond, sans-serif); text-transform: uppercase; }
.drill-end .st { display: flex; gap: 6px; font-size: 34px; line-height: 1; color: rgba(255,255,255,.18); } .drill-end .st .on { color: var(--gold, #f5c400); }
.drill-end p { margin: 0; font: 500 var(--fs-body, 16px)/1.45 var(--sans, sans-serif); color: var(--ink-2, #ccd); }
.drill-end a:focus-visible { outline: 2px solid var(--ink, #fff); outline-offset: 2px; }
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
  const o = read('regatta') || {};
  if (o.ghost !== 1 || o.ghostV !== 1) return null; // Settings › Ghost of your best: off unless turned on there
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
  const name = g.own ? tr('Your best', 'Твой лучший') : tr('Ghost', 'Призрак'), short = g.own ? tr('Best', 'Лучший') : tr('Ghost', 'Призрак');
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
  el.innerHTML = `<i></i><span title="${name} · ${fmt(g.secs)}">${short} ${fmt(g.secs)}</span><b></b>`; // the board's row: short, for a phone's
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
  if (drillId !== 'start' && drillId !== 'end') {
    P.ai = { ...(race.boats.find((b) => b.ai)?.ai || {}), skill: 0.92, lineT: 0.5, lastTack: -999, go: false, wp: 0, dirtyT: 0, hailT: -99, port: false, dare: 0, loiter: 1 };
    // the beat: halfway up it (from the middle of the line to the windward mark), so what's left is a couple of minutes
    const C = race.course, beat = Math.hypot(C.windward.x - (C.pin.x + C.committee.x) / 2, C.windward.z - (C.pin.z + C.committee.z) / 2);
    // the run: just round the windward mark, 25 m on from it (a lap's gate the leg after). The finish: 150 m from the
    // line on the last leg, whatever the course the venue laid
    const gate = C.legs.indexOf('gate'), last = C.legs.length - 1;
    const until = { mark: () => P.leg >= 1 && race.distToNext(P) < 130, beat: () => P.leg >= 1 && race.distToNext(P) < beat * 0.5,
      run: () => P.leg >= gate && Math.hypot(P.x - C.windward.x, P.z - C.windward.z) > 25, finish: () => P.leg >= last && race.distToNext(P) < 150,
      // the layline: within 170 m of the windward mark with it still inside the no-go cone (a tack to make, and the call
      // when), or 90 m from it whatever. The penalty: 30 s up the beat
      layline: () => P.leg >= 1 && ((race.distToNext(P) < 170 && Math.abs(offWind(P, race.course.windward, P.wdir)) < (beatAngle(P.tws) - 3) * D2R) || race.distToNext(P) < 90),
      penalty: () => P.leg >= 1 && race.clock > 30 }[drillId];
    for (let n = 0; n < 60 * 600 && !until(); n++) race.step(1 / 60);
    delete P.ai; P.auto = null;
    race.messages.length = 0; for (const b of race.boats) if (b.events) b.events.length = 0; // what was said on the way: not said now
  }
  // the penalty: one turn owed, a tack and a gybe (rule 44.2), as if she'd just fouled someone
  if (drillId === 'penalty') { P.pen = { tack: false, gybe: false, dir: 0 }; P.pens = (P.pens || 0) + 1; }
  // the layline: the tacks from here, and where she was after the last (here, if none) with the wind there
  if (drillId === 'layline') Object.assign(dr, { tacks: 0, inTack: false, T: { x: P.x, z: P.z, W: P.wdir }, tw: [] });
  dr.t0 = race.clock; dr.place0 = race.standings().indexOf(P) + 1; dr.pens0 = P.pens || 0; dr.leg0 = P.leg;
  const k = document.createElement('div'); k.className = 'drill-k bc';
  k.innerHTML = `<b>${tr('Drill', 'Тренировка')}</b><span>${drillName(drillId)} · ${{ start: tr('cross at the gun, at speed', 'пересеки линию со стартом, на скорости'), mark: tr('round it, gain a place', 'обогни и выиграй место'), beat: tr('to the top mark', 'до верхнего знака'),
    run: tr('down through the gate', 'вниз через ворота'), finish: tr('cross ahead', 'финишируй впереди'), end: tr('start at the end that pays', 'стартуй у выгодного конца'),
    layline: tr('tack for the mark at the right time', 'поверни на знак вовремя'), penalty: tr('tack, gybe, back up to speed', 'оверштаг, фордевинд и снова на скорость') }[drillId]}</span>`;
  document.body.append(k); dr.k = k;
}

// the bearing of `m` from the boat, off the wind `W` (radians: 0 dead upwind, signed)
const offWind = (b, m, W) => { const dx = m.x - b.x, dz = m.z - b.z; return Math.atan2(dx * Math.cos(W) + dz * Math.sin(W), dx * Math.sin(W) - dz * Math.cos(W)); };

function drillFrame(race) {
  if (dr.done) return;
  const P = race.player, L = race.log;
  let end = false;
  if (dr.id === 'layline' && P.leg === dr.leg0) {
    // a tack (not a gybe) done: count it, and the approach starts again from where she came out of it
    if (P.auto && !P.auto.gybe) dr.inTack = true;
    else if (!P.auto && dr.inTack) { dr.inTack = false; dr.tacks++; dr.T = { x: P.x, z: P.z, W: P.wdir }; dr.tw = []; }
    // the angle she sails to the wind on the way in (not the last 25 m, where she bears away round it)
    if (!P.auto && !P.pen && race.distToNext(P) > 25) dr.tw.push(Math.abs(P.twa));
  }
  if (dr.id === 'start') end = race.clock >= 8;
  else if (dr.id === 'mark') {
    if (P.leg >= 2 && dr.roundT == null) dr.roundT = race.clock;
    end = (dr.roundT != null && race.clock - dr.roundT > 20) || race.clock - dr.t0 > 180; // 20 s down the run after it
  } else if (dr.id === 'beat') end = P.leg >= 2 || race.clock - dr.t0 > 600;
  else if (dr.id === 'run') {
    if (P.leg > dr.leg0 && dr.roundT == null) dr.roundT = race.clock;
    end = (dr.roundT != null && race.clock - dr.roundT > 10) || race.clock - dr.t0 > 300; // 10 s out of the gate
  } else if (dr.id === 'finish') end = P.done || race.clock - dr.t0 > 300;
  else if (dr.id === 'end') {
    // where along the line she was at the gun (0 the pin … 1 the committee boat), and the end further upwind then
    if (dr.gunAt == null && race.clock >= 0) {
      const C = race.course, W = race.wind.mean();
      dr.gunAt = Math.min(1, Math.max(0, lineT(C, P))); dr.boatEnd = (C.committee.x - C.pin.x) * Math.sin(W) - (C.committee.z - C.pin.z) * Math.cos(W) > 0;
    }
    end = race.clock >= 8;
  }
  else if (dr.id === 'layline') end = P.leg >= 2 || race.clock - dr.t0 > 240;
  else if (dr.id === 'penalty') {
    // done: the turn taken, close-hauled again (within 12° of the beat's angle) at 85% of her speed there
    const ba = beatAngle(P.tws);
    if (!P.pen && dr.doneT == null && Math.abs(P.twa) <= (ba + 12) * D2R && P.v >= 0.85 * polarSpeed(P.tws, ba) * KN) dr.doneT = race.clock;
    end = dr.doneT != null || race.clock - dr.t0 > 90;
  }
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
  } else if (dr.id === 'end') {
    const boat = dr.boatEnd, at = dr.gunAt, d = L.gunD, v = L.gunV, endName = boat ? tr('the committee boat', 'у судейского судна') : tr('the pin', 'у пина');
    const near = at == null ? 1 : boat ? 1 - at : at; // how far along the line from the end that paid
    if (L.ocs || L.startDsq) { stars = 0; line = tr('Over the line at the gun: you had to go back.', 'На старте за линией — пришлось возвращаться.'); }
    else if (d == null || at == null) { stars = 0; line = tr('No start this time.', 'В этот раз старта не было.'); }
    else {
      stars = near <= 1 / 3 && d < 15 && v > 4 ? 3 : near <= 1 / 2 && d < 30 ? 2 : 1;
      line = tr(`The end that paid: ${boat ? 'the committee boat' : 'the pin'}. At the gun you were ${Math.round(near * 100)}% of the way along the line from it, ${Math.round(Math.max(0, d))} m from the line at the gun at ${v.toFixed(1)} kn. ${stars === 3 ? 'A head start on the whole fleet.' : 'Three stars: in the third of the line nearest that end, under 15 m at the gun, over 4 kn. Look which end is further upwind before you set up.'}`,
        `Выгодный конец — ${endName}. На сигнале ты был в ${Math.round(near * 100)}% длины линии от него, ${Math.round(Math.max(0, d))} м до линии на сигнале, ${v.toFixed(1).replace('.', ',')} уз. ${stars === 3 ? 'Фора перед всем флотом.' : 'Три звезды: в трети линии у этого конца, ближе 15 м на сигнале, быстрее 4 уз. Посмотри, какой конец выше по ветру, прежде чем заходить.'}`);
    }
  } else if (dr.id === 'layline') {
    // overstood: from where she came out of her last tack the mark lay further off the wind than she sailed (the middle
    // of her angles on the way in), by that many metres across her course. One tack takes her there from the hand-over;
    // a second is allowed, for a shift or a starboard boat
    const tw = dr.tw.slice().sort((a, b) => a - b), sails = tw.length ? tw[tw.length >> 1] : beatAngle(P.tws) * D2R;
    const T = dr.T, lie = Math.abs(offWind(T, race.course.windward, T.W)), d = Math.hypot(race.course.windward.x - T.x, race.course.windward.z - T.z);
    const over = lie > sails ? d * Math.sin(lie - sails) : 0, n = dr.tacks;
    stars = P.leg < 2 ? 0 : pens ? 1 : n <= 2 && over < 10 ? 3 : n <= 3 && over < 25 ? 2 : 1;
    const ru = n === 1 ? 'поворот' : n > 1 && n < 5 ? 'поворота' : 'поворотов';
    line = P.leg < 2 ? tr('Not at the mark in time.', 'Не дошёл до знака вовремя.')
      : tr(`${n} ${n === 1 ? 'tack' : 'tacks'}, ${over < 1 ? 'not overstood' : `overstood by ${Math.round(over)} m`}${pens ? ', with a penalty' : ''}. ${stars === 3 ? 'Tacked on the layline, not past it.' : 'Three stars: two tacks at most, under 10 m past the layline, no penalty. Tack when the mark is level with the angle you sail on the other tack, and no later.'}`,
        `${n} ${ru}, ${over < 1 ? 'без перебора' : `перебор ${Math.round(over)} м`}${pens ? ', со штрафом' : ''}. ${stars === 3 ? 'Поворот точно на лейлайне, без перебора.' : 'Три звезды: не больше двух поворотов, перебор меньше 10 м и без штрафа. Поворачивай, когда знак встаёт на угол, которым ты идёшь другим галсом, и не позже.'}`);
  } else if (dr.id === 'penalty') {
    const took = dr.doneT == null ? null : dr.doneT - dr.t0, more = pens; // (pens0 was counted with the drill's own turn)
    stars = took == null ? 0 : more > 0 ? 1 : took <= 20 ? 3 : took <= 30 ? 2 : 1;
    line = took == null ? tr('The turn wasn’t done, or she wasn’t back up to speed, in 90 s.', 'Оборот не сделан или скорость не набрана за 90 с.')
      : tr(`Turned and back up to speed in ${took.toFixed(1)} s${more > 0 ? ', but you fouled someone on the way' : ''}. ${stars === 3 ? 'Barely a dent in your race.' : 'Three stars: under 20 s, keeping clear of the others. Bear away into the gybe, then come up hard through the tack, and don’t stall head to wind.'}`,
        `Оборот и снова на скорости за ${took.toFixed(1).replace('.', ',')} с${more > 0 ? ', но по пути ты нарушил правила' : ''}. ${stars === 3 ? 'Гонка почти не пострадала.' : 'Три звезды: быстрее 20 с, никому не мешая. Уваливайся в поворот фордевинд, затем резко приводись через оверштаг и не застревай носом к ветру.'}`);
  } else if (dr.id === 'run' || dr.id === 'finish') {
    // places gained (or the lead kept) down the run and through the gate, or up the last of the beat and over the line
    const run = dr.id === 'run', made = run ? dr.roundT != null : P.done, gained = dr.place0 - place;
    stars = !made ? 0 : pens ? 1 : gained > 0 || place === 1 ? 3 : gained === 0 ? 2 : 1;
    line = !made ? (run ? tr('Not through the gate in time.', 'Не прошёл ворота вовремя.') : tr('Not over the line in time.', 'Не финишировал вовремя.'))
      : run ? tr(`${ord(dr.place0)} at the top mark, ${ord(place)} out of the gate${pens ? ', with a penalty' : ''}. ${stars === 3 ? 'Clear air down the run, the gate mark nobody else wanted.' : 'Three stars: a place gained (or the lead kept), and no penalty. Keep your air clear and take the less crowded gate mark.'}`,
        `${dr.place0}-е у верхнего знака, ${place}-е после ворот${pens ? ', со штрафом' : ''}. ${stars === 3 ? 'Чистый ветер на фордевинде и свободный знак ворот.' : 'Три звезды: выигранное место (или удержанное первое) и без штрафа. Держи чистый ветер и бери свободный знак ворот.'}`)
      : tr(`${ord(dr.place0)} with 150 m to go, ${ord(place)} over the line${pens ? ', with a penalty' : ''}. ${stars === 3 ? 'You found the end of the line that pays.' : 'Three stars: a place gained (or the lead kept), and no penalty. Finish at the end of the line nearer you.'}`,
        `${dr.place0}-е за 150 м до финиша, ${place}-е на линии${pens ? ', со штрафом' : ''}. ${stars === 3 ? 'Ты нашёл выгодный конец линии.' : 'Три звезды: выигранное место (или удержанное первое) и без штрафа. Финишируй у ближнего к тебе конца линии.'}`);
  } else {
    stars = P.leg < 2 ? 0 : place <= 2 && !pens ? 3 : place <= Math.ceil(n / 2) ? 2 : 1;
    line = P.leg < 2 ? tr('Not at the mark in time.', 'Не дошёл до знака вовремя.')
      : tr(`${ord(dr.place0)} halfway up, ${ord(place)} of ${n} at the top mark. ${stars === 3 ? 'You played the shifts.' : 'Three stars: first or second there. Tack on the headers.'}`,
        `${dr.place0}-е на половине лавировки, ${place}-е из ${n} у верхнего знака. ${stars === 3 ? 'Ты сыграл на сдвигах.' : 'Три звезды: первым или вторым. Поворачивай на заходах.'}`);
  }
  const all = read('regatta-drills') || {}, was = all[dr.id] || 0;
  if (stars > was) { all[dr.id] = stars; try { localStorage.setItem('regatta-drills', JSON.stringify(all)); } catch (e) {} }
  track('Drill done', { drill: dr.id, stars });
  ctx.stop();
  dr.k?.remove();
  const next = DRILL_ORDER[DRILL_ORDER.indexOf(dr.id) + 1];
  const el = document.createElement('div'); el.className = 'drill-end bc'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
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
