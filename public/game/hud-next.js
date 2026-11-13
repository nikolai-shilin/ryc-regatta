// The lighter HUD, tried behind ?hud=next (?hud=old goes back; H switches live). It takes the current HUD's
// controls and readouts and gives them less room: one slim pill for speed and the race, a small wind dial, a
// smaller map, a camera button that cycles, controls that fade back when your thumbs are off them, and the
// target labelled on the water. Everything moves rather than jumps.
import { D2R, KN, clamp, wrap, idealSail, sheetFor, beatAngle } from './sim.js';

const ic = (svg) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'>${svg}</svg>`)}")`;
const ICON = {
  tack: ic("<g fill='none' stroke='#000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M4 9c2.5-4.5 9.5-4.5 12 0'/><path d='M12.5 9H16.5V5'/><path d='M10 11.5V17'/></g>"),
  kite: ic("<path d='M5 17C4 11 6 5 11 2c5 4 6 10 4 15Z' fill='#000'/>"),
  reef: ic("<g stroke='#000' stroke-width='2.2' stroke-linecap='round'><path d='M4 5h12M6 10h8M8 15h4'/></g>"),
  jib: ic("<path d='M7 2.5v14.5h9.5Z' fill='#000'/>"),
  hail: ic("<path d='M3 8v4h3l6 4V4L6 8Z' fill='#000'/><path d='M15 7c1.4 1.7 1.4 4.3 0 6' fill='none' stroke='#000' stroke-width='2' stroke-linecap='round'/>"),
  cam: ic("<g fill='none' stroke='#000' stroke-width='1.8' stroke-linejoin='round'><rect x='2' y='5' width='11' height='10' rx='2.5'/><path d='M13 9l5-2.6v7.2L13 11'/></g>"),
};

const CSS = `
#hud.next { --hz: 1; --nx-w: 84px; zoom: var(--hz); --glass: rgba(8, 14, 20, 0.42); --line: rgba(255, 255, 255, 0.14); --ok: #2ee6a0; --ease: cubic-bezier(.2, .8, .2, 1); }
@media (min-width: 1100px) and (min-height: 640px) { #hud.next, #nxTag { --hz: 1.15; } }
@media (min-width: 1500px) and (min-height: 860px) { #hud.next, #nxTag { --hz: 1.3; } }
.nx { display: none !important; }
#hud.next .nx { display: flex !important; }
#hud.next .tc > .speed, #hud.next #status, #hud.next #perf, #hud.next .zoom, #hud.next #camSeg, #hud.next #sheet .cap, #hud.next #jibSheet .cap { display: none !important; }
#hud.next #trim:not([data-s="irons"]) { display: none; }
#hud.next .nxg { background: var(--glass); backdrop-filter: blur(10px) saturate(1.2); -webkit-backdrop-filter: blur(10px) saturate(1.2); border: 1px solid var(--line); }

/* top centre: one slim pill */
#hud.next .tc { gap: 5px; top: calc(8px + var(--st)); }
.nx-pill { height: 32px; border-radius: 54px; align-items: center; padding: 0 4px; font: 700 12px var(--sans); white-space: nowrap; font-variant-numeric: tabular-nums; animation: nx-drop .55s var(--ease) both; }
.nx-pill > span { display: inline-flex; align-items: center; gap: 5px; padding: 0 10px; height: 18px; }
.nx-pill > span + span { border-left: 1px solid var(--line); }
.nx-pill > span:empty { display: none; }
.nx-spd { flex-direction: column; align-items: center !important; justify-content: center; gap: 3px !important; height: 26px !important; padding: 0 12px !important; }
.nx-spd b { font: 700 12px/1 var(--sans); display: inline-flex; align-items: baseline; }
.nx-spd b small { font: 700 9px var(--sans); text-transform: uppercase; margin-left: 3px; color: rgba(255,255,255,.62); letter-spacing: .03em; }
.nx-gauge { position: relative; width: 40px; height: 3px; border-radius: 2px; background: rgba(255,255,255,.18); }
.nx-gauge i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 2px; background: var(--warn); transition: width .35s var(--ease), background-color .5s; }
.nx-gauge::after { content: ''; position: absolute; left: 90.9%; top: -2px; width: 1.5px; height: 7px; background: rgba(255,255,255,.85); border-radius: 1px; }
.nx-gauge.good i { background: var(--ok); } .nx-gauge.mid i { background: #fff; }
.nx-pct { color: rgba(255,255,255,.6); font-size: 10.5px; margin-left: -4px; }
.nx-to svg { width: 12px; height: 12px; transition: transform .25s linear; }
.nx-to.flash { animation: nx-flash 1.2s var(--ease); }
.nx-place { transition: color .4s; }
.nx-place.up { animation: nx-pop .9s var(--ease); color: var(--ok); }
.nx-place.down { animation: nx-pop .9s var(--ease); color: var(--danger); }
.nx-mute { color: rgba(255,255,255,.62); font-weight: 700; }
#hud.next .chip { height: 22px; font-size: 11px; }
/* chips: one element each, its words changing in place; in with a soft drop, out with a fade while the others slide over */
.nx-chip { overflow: hidden; white-space: nowrap; max-width: 0; padding-left: 0 !important; padding-right: 0 !important; margin: 0 -3px; opacity: 0; transform: translateY(-8px) scale(.94);
  transition: opacity .45s ease, transform .55s var(--ease), max-width .55s var(--ease), padding .55s var(--ease), margin .55s var(--ease), background-color .5s, color .5s; }
.nx-chip.in { max-width: 340px; padding-left: 9px !important; padding-right: 9px !important; margin: 0; opacity: 1; transform: none; }
.nx-chip.out { transition: opacity .5s ease, transform .6s var(--ease), max-width .6s var(--ease) .15s, padding .6s var(--ease) .15s, margin .6s var(--ease) .15s, background-color .5s, color .5s; }
#hud.next #toast { font-size: 13px; padding: 7px 14px; transform: translateY(-8px) scale(.97); transition: opacity .5s ease, transform .6s var(--ease), visibility 0s .5s; }
#hud.next #toast.show { transform: none; transition: opacity .4s ease, transform .55s var(--ease); }
/* the start flags: smaller */
#hud.next .flags { gap: 10px; padding: 6px 10px 5px; border-radius: 12px; background: var(--glass); animation: nx-drop .4s var(--ease) both; }
#hud.next .flag { width: 36px; height: 24px; } #hud.next .flag.cls { font-size: 16px; line-height: 24px; } #hud.next .flag.P::after { inset: 7px 12px; }
#hud.next .flags figcaption { font-size: 9px; }
/* the countdown: only the last ten seconds, smaller, a beat per second */
#hud.next #count:not(.final) { display: none; }
#hud.next #count.final { font-size: clamp(56px, 13vmin, 92px); bottom: calc(96px + var(--sb)); }
#hud.next #count.beat { animation: nx-beat .9s var(--ease); }

/* top left: a small wind dial */
.nx-inst { position: absolute; left: calc(10px + var(--sl)); top: calc(8px + var(--st)); gap: 12px; align-items: flex-start; animation: nx-slide-l .55s var(--ease) both; }
.nx-inst .col { display: flex; flex-direction: column; align-items: center; gap: 9px; }
.nx-dial { width: var(--nx-w); height: var(--nx-w); border-radius: 50%; display: block; }
.nx-dial text { font-family: var(--sans); font-weight: 700; }
#hud.next .tr .row .nx-b { position: static; width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--line); background: var(--glass); color: #fff; font: 700 10px var(--sans); padding: 0; margin: 0; pointer-events: auto; transition: background-color .2s, transform .15s; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
#hud.next .tr .row #zoomIn, #hud.next .tr .row #zoomOut { font-size: 16px; line-height: 1; }
#hud.next .tr .row .nx-b:active { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
#hud.next .tr .row #speedBtn.fast { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
#hud.next .tr .row .nx-b:active { transform: scale(.9); }

/* top right: camera that cycles, pause, a smaller map */
#hud.next .tr { gap: 6px; animation: nx-slide-r .55s var(--ease) both; }
#hud.next .tr .row { gap: 6px; }
.nx-cam { height: 28px; min-width: 28px; border-radius: 54px; padding: 0 7px; align-items: center; gap: 0; color: #fff; pointer-events: auto; cursor: pointer; font: 700 10.5px var(--sans); text-transform: uppercase; letter-spacing: .03em; transition: gap .3s var(--ease), transform .15s; }
.nx-cam::before { content: ''; width: 14px; height: 14px; background: currentColor; -webkit-mask: ${ICON.cam} center / contain no-repeat; mask: ${ICON.cam} center / contain no-repeat; flex: none; }
.nx-cam span { max-width: 0; overflow: hidden; opacity: 0; transition: max-width .35s var(--ease), opacity .25s; white-space: nowrap; }
.nx-cam.say { gap: 5px; } .nx-cam.say span { max-width: 80px; opacity: 1; }
.nx-cam:active { transform: scale(.92); }
#hud.next .round-s { width: 28px; height: 28px; border: 1px solid var(--line); background: var(--glass); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
#hud.next #mini { width: var(--nx-w); height: var(--nx-w); border-radius: 14px; background: var(--glass); border: 1px solid var(--line); opacity: .88; transition: width .3s var(--ease), height .3s var(--ease), opacity .3s; }
#hud.next #mini.big { width: min(260px, calc(100vh - 140px)); height: min(260px, calc(100vh - 140px)); opacity: 1; }

/* bottom left: the rudder fades back when no one is steering */
#hud.next #rudder { width: 150px; height: 84px; opacity: .45; transition: opacity .4s; }
#hud.next #rudder.act { opacity: 1; transition: opacity .12s; }
#hud.next #rudder .track { stroke: rgba(8, 14, 20, .38); stroke-width: 10; }
#hud.next #rudder .ticks { stroke: rgba(255, 255, 255, .3); }
#hud.next #rudderKnob { r: 11; transition: r .15s; }
#hud.next #rudder.act #rudderKnob { r: 13; }
.nx-mid { stroke: rgba(255,255,255,.55); stroke-width: 2; stroke-linecap: round; display: none; }
#hud.next .nx-mid { display: inline; }

/* bottom right: a slim sheet; the advice shows at the end to pull towards, and bounces */
#hud.next #sheetZone { width: 52px; transition: opacity .4s; }
#hud.next #sheetZone.auto { opacity: .4; }
#hud.next #sheet, #hud.next #jibSheet { width: 14px; border-width: 1px; border-color: var(--line); background: var(--glass); }
#hud.next #sheet .band, #hud.next #jibSheet .band { left: 1px; right: 1px; background: rgba(46, 230, 160, .8); box-shadow: 0 0 8px rgba(46, 230, 160, .6); transition: top .3s var(--ease), height .3s var(--ease); }
#hud.next #sheet .knob, #hud.next #jibSheet .knob { left: -7px; width: 26px; height: 14px; border-width: 1.5px; transition: background-color .25s, transform .15s; }
#hud.next #sheet.off .knob, #hud.next #jibSheet.off .knob { background: var(--warn); }
#hud.next #sheetZone:active .knob { transform: translateY(-50%) scale(1.12); }
.nx-adv { position: absolute; right: -4px; height: 20px; padding: 0 8px; border-radius: 54px; background: var(--warn); color: #1a1000; font: 700 10px var(--sans); text-transform: uppercase; letter-spacing: .03em; white-space: nowrap; align-items: center; gap: 3px; pointer-events: none; opacity: 0; transition: opacity .25s; }
.nx-adv { top: -25px; } /* always above the slider, clear of the buttons below; the arrow says which way */
.nx-adv.on { opacity: 1; }
.nx-adv i { font-style: normal; display: inline-block; animation: nx-bob .9s ease-in-out infinite; }
.nx-adv.t i { animation-name: nx-bob-up; }

/* action pills: icon + word, stacked from the bottom, sliding in as they come */
.nx-acts { position: absolute; right: calc(62px + var(--sr)); bottom: calc(12px + var(--sb)); flex-direction: column; align-items: flex-end; gap: 8px; pointer-events: none; }
#hud.next.split-trim .nx-acts { right: calc(110px + var(--sr)); }
#hud.next .nx-acts > .round { position: static; width: auto !important; height: 36px !important; border-radius: 54px; padding: 0 13px 0 10px; display: inline-flex; align-items: center; gap: 6px; font: 700 11px var(--sans); letter-spacing: .03em; background: var(--glass); border: 1px solid rgba(53, 176, 242, .7); color: #fff; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); pointer-events: auto; animation: nx-pill-in .4s var(--ease) both; transition: background-color .2s, transform .12s, box-shadow .3s; }
#hud.next .nx-acts > .round::before { content: ''; width: 16px; height: 16px; flex: none; background: currentColor; -webkit-mask: var(--ic) center / contain no-repeat; mask: var(--ic) center / contain no-repeat; }
#hud.next .nx-acts > #tackBtn { height: 44px !important; padding: 0 16px 0 12px; font-size: 12px; background: rgba(53, 176, 242, .24); --ic: ${ICON.tack}; }
#hud.next .nx-acts > #kiteBtn { --ic: ${ICON.kite}; } #hud.next .nx-acts > #reefBtn { --ic: ${ICON.reef}; }
#hud.next .nx-acts > #jibBtn { --ic: ${ICON.jib}; } #hud.next .nx-acts > #hailBtn { --ic: ${ICON.hail}; background: var(--warn); color: #1a1200; border-color: var(--warn); }
#hud.next .nx-acts > .round:active, #hud.next .nx-acts > .round.down { transform: scale(.94); background: var(--accent); color: var(--on-accent); }
#hud.next .nx-acts > .round.on { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
#hud.next .nx-acts > .round[hidden] { display: none !important; }
#hud.next .nx-acts > .round.fresh { animation: nx-pill-in .4s var(--ease) both, nx-glow 1.5s ease-in-out .4s infinite; }

/* the target, labelled on the water (or at the edge, pointing) */
#nxTag { position: fixed; left: 0; top: 0; z-index: 2; pointer-events: none; zoom: var(--hz, 1); display: none; will-change: transform; }
#nxTag.on { display: block; }
#nxTag .in { position: absolute; left: 0; bottom: 0; transform: translate(-50%, -12px); display: flex; align-items: center; gap: 5px; height: 20px; padding: 0 8px 0 6px; border-radius: 54px; background: rgba(8, 14, 20, .5); border: 1px solid rgba(255, 214, 64, .55); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); color: #fff; font: 700 10.5px var(--sans); white-space: nowrap; font-variant-numeric: tabular-nums; animation: nx-fade .5s both; }
#nxTag .dot { position: relative; width: 7px; height: 7px; border-radius: 50%; background: var(--c, #ffd640); flex: none; }
#nxTag .dot::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; border: 1.5px solid var(--c, #ffd640); animation: nx-ping 1.8s ease-out infinite; }
#nxTag .stem { position: absolute; left: -0.75px; bottom: 0; width: 1.5px; height: 12px; background: linear-gradient(var(--c, #ffd640), transparent); }
#nxTag.mark .in { border-color: rgba(255, 138, 61, .6); } #nxTag.mark { --c: #ff8a3d; }
#nxTag.edge .stem { display: none; } #nxTag.edge .in { transform: translate(-50%, 50%); }
#nxTag .ptr { display: none; width: 14px; height: 14px; flex: none; color: var(--c, #ffd640); transition: transform .2s linear; }
#nxTag .ptr svg { display: block; width: 100%; height: 100%; }
#nxTag.edge .ptr { display: block; } #nxTag.edge .dot { display: none; }

@keyframes nx-drop { from { opacity: 0; transform: translateY(-10px); } }
@keyframes nx-slide-l { from { opacity: 0; transform: translateX(-14px); } }
@keyframes nx-slide-r { from { opacity: 0; transform: translateX(14px); } }
@keyframes nx-fade { from { opacity: 0; } }
@keyframes nx-pill-in { from { opacity: 0; transform: translateX(18px) scale(.9); } }
@keyframes nx-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(53, 176, 242, 0); } 50% { box-shadow: 0 0 0 5px rgba(53, 176, 242, .22), 0 0 16px rgba(53, 176, 242, .55); } }
@keyframes nx-pop { 0% { transform: scale(1); } 30% { transform: scale(1.18); } 100% { transform: scale(1); } }
@keyframes nx-flash { 0% { color: #ffd640; } 100% { color: inherit; } }
@keyframes nx-beat { 0% { transform: translateX(-50%) scale(1.25); opacity: .4; } 35% { transform: translateX(-50%) scale(1); opacity: 1; } }
@keyframes nx-bob { 50% { transform: translateY(2px); } }
@keyframes nx-bob-up { 50% { transform: translateY(-2px); } }
@keyframes nx-ping { 0% { transform: scale(.6); opacity: .9; } 100% { transform: scale(1.9); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { #hud.next *, #hud.next, #nxTag * { animation: none !important; transition: none !important; } }

@media (orientation: portrait) {
  #hud.next { --nx-w: 62px; }
  #hud.next .tc { top: calc(158px + var(--st)); } /* under the dial and the map */
  .nx-pct { display: none !important; }
  #hud.next #mini { border-radius: 12px; }
  #hud.next #rudder { width: 140px; height: 78px; }
}
`;

const LEG = { start: 'lineStart', mark: 'mark', wing: 'wing', gate: 'gate', finish: 'finish' };
const CAMS = ['drone', 'top', 'helm'];

export function createHudNext({ t, LANG, fmt, world, getRace, setCam }) {
  const $ = (s) => document.querySelector(s);
  const hud = $('#hud'), tc = hud.querySelector('.tc'), row = hud.querySelector('.tr .row'), zoomBox = hud.querySelector('.zoom');
  const speedBtn = $('#speedBtn'), zoomIn = $('#zoomIn'), zoomOut = $('#zoomOut'), rudder = $('#rudder'), sz = $('#sheetZone'), sheet = $('#sheet'), jibSheet = $('#jibSheet');
  const count = $('#count'), mini = $('#mini'), trBox = hud.querySelector('.tr');
  const nf = (x, d = 1) => (LANG === 'ru' ? x.toFixed(d).replace('.', ',') : x.toFixed(d));
  const M = LANG === 'ru' ? 'м' : 'm';
  document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));

  const html = (s) => { const d = document.createElement('div'); d.innerHTML = s.trim(); return d.firstChild; };
  // the pill
  const pill = html(`<div class="nx nx-pill nxg"><span class="nx-spd"><b><span>0,0</span><small>${t('kn')}</small></b><span class="nx-gauge"><i></i></span></span><span class="nx-pct"></span><span class="nx-clock"></span><span class="nx-to"><svg viewBox="0 0 12 12"><path d="M6 .8 L10.6 10.4 L6 8.2 L1.4 10.4 Z" fill="#ffd640"/></svg><span></span></span><span class="nx-fav nx-mute"></span><span class="nx-place"></span></div>`);
  tc.prepend(pill);
  const P_ = { spd: pill.querySelector('.nx-spd b span'), gauge: pill.querySelector('.nx-gauge'), gi: pill.querySelector('.nx-gauge i'), pct: pill.querySelector('.nx-pct'),
    clock: pill.querySelector('.nx-clock'), to: pill.querySelector('.nx-to'), arrow: pill.querySelector('.nx-to svg'), toT: pill.querySelector('.nx-to span'), fav: pill.querySelector('.nx-fav'), place: pill.querySelector('.nx-place') };
  // the wind dial
  const inst = html(`<div class="nx nx-inst"><div class="col">
    <svg class="nx-dial nxg" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="1"/>
      <path class="nogo" fill="rgba(255,106,92,.32)"/>
      <g stroke="rgba(255,255,255,.3)" stroke-width="1"><line x1="32" y1="6" x2="32" y2="9"/><line x1="58" y1="32" x2="55" y2="32"/><line x1="32" y1="58" x2="32" y2="55"/><line x1="6" y1="32" x2="9" y2="32"/></g>
      <path d="M32 21 C 35 25 35.6 32 35 40 L 29 40 C 28.4 32 29 25 32 21 Z" fill="#fff"/>
      <g class="tw"><line x1="32" y1="2.5" x2="32" y2="12" stroke="#35b0f2" stroke-width="2.4" stroke-linecap="round"/><path d="M28.2 10.5 L32 16 L35.8 10.5 Z" fill="#35b0f2"/></g>
      <text class="tws" x="32" y="51" text-anchor="middle" font-size="7.5" fill="rgba(255,255,255,.75)"></text>
    </svg></div></div>`);
  hud.append(inst);
  const D = { nogo: inst.querySelector('.nogo'), tw: inst.querySelector('.tw'), tws: inst.querySelector('.tws') };
  // the camera button
  const cam = html(`<button class="nx nx-cam nxg" aria-label="camera (X/C/V)"><span></span></button>`);
  row.prepend(cam);
  let sayT = 0;
  cam.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const m = CAMS[(CAMS.indexOf(world.mode) + 1) % CAMS.length]; setCam(m);
    cam.classList.add('say'); clearTimeout(sayT); sayT = setTimeout(() => cam.classList.remove('say'), 1400);
  });
  // the rudder's centre mark
  const mid = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  Object.entries({ class: 'nx-mid', x1: 105, y1: 12, x2: 105, y2: 28 }).forEach(([k, v]) => mid.setAttribute(k, v));
  rudder.insertBefore(mid, $('#rudderKnob'));
  // the advice at each slider's ends
  const adv = (el) => { const a = html(`<span class="nx nx-adv"><i></i><span></span></span>`); el.append(a); return a; };
  const advMain = adv(sheet), advJib = jibSheet ? adv(jibSheet) : null;
  // the action pills
  const acts = html(`<div class="nx nx-acts"></div>`);
  hud.append(acts);
  const btnIds = ['hailBtn', 'jibBtn', 'reefBtn', 'kiteBtn', 'tackBtn']; // top to bottom
  const fresh = {};
  for (const id of btnIds) { const b = document.getElementById(id); b && b.addEventListener('pointerdown', () => b.classList.remove('fresh')); }
  // the target tag
  const tag = html(`<div id="nxTag"><span class="stem"></span><div class="in"><b class="ptr"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7h9.5M7.5 3l4 4-4 4"/></svg></b><i class="dot"></i><span></span></div></div>`);
  document.body.append(tag);
  const tagT = tag.querySelector('.in span'), tagIn = tag.querySelector('.in');
  const v3 = world.camera.position.clone();

  let on = false, chipsReady = false;
  try {
    const q = new URLSearchParams(location.search).get('hud');
    if (q === 'next') localStorage.setItem('hudNext', '1'); else if (q === 'old') localStorage.removeItem('hudNext');
    on = localStorage.getItem('hudNext') === '1';
  } catch (e) { on = /[?&]hud=next\b/.test(location.search); }

  function apply(v) {
    on = v; hud.classList.toggle('next', on);
    if (chipsReady) clearChips();
    for (const id of btnIds) { const b = document.getElementById(id); if (b) (on ? acts : hud).append(b); }
    for (const b of [zoomIn, zoomOut, speedBtn]) b.classList.toggle('nx-b', on);
    if (on) cam.before(zoomIn, zoomOut, speedBtn); else zoomBox.append(zoomIn, zoomOut, speedBtn);
    (on ? inst.querySelector('.col') : trBox).append(mini); // the map under the wind dial, the same size
    if (!on) tag.classList.remove('on');
    // replay the entrance
    for (const el of [pill, inst, hud.querySelector('.tr')]) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
  }
  apply(on);

  let twaS = null, lastPlace = 0, lastLeg = -1, lastCount = '', placeT = 0;
  const txt = (e, s) => { if (e._t !== s) { e._t = s; e.textContent = s; } };
  const pt = (a, r) => `${(32 + r * Math.sin(a)).toFixed(2)} ${(32 - r * Math.cos(a)).toFixed(2)}`;

  function update(P, dt) {
    if (!on) return;
    const race = getRace(), c = race.course, kn = P.v / KN, twa = P.twa;
    // the pill: speed against target
    txt(P_.spd, nf(kn));
    const pct = P.polar > 0.5 ? kn / P.polar : 0;
    P_.gi.style.width = `${(clamp(pct, 0, 1.1) / 1.1) * 100}%`;
    P_.gauge.classList.toggle('good', pct >= 0.95); P_.gauge.classList.toggle('mid', pct >= 0.7 && pct < 0.95);
    txt(P_.pct, P.polar > 0.5 && race.clock >= 0 ? `${Math.round(pct * 100)}%` : '');
    const m = race.nextMark(P), brg = Math.atan2(m.x - P.x, -(m.z - P.z)), rel = wrap(brg - P.h) / D2R;
    P_.arrow.style.transform = `rotate(${rel.toFixed(1)}deg)`;
    const leg = c.legs[P.leg];
    if (race.clock < 0) {
      const li = race.lineInfo(P), close = (Math.sin(P.h) * c.normal.x - Math.cos(P.h) * c.normal.z) * P.v;
      const ux = Math.sin(race.wind.dir()), uz = -Math.cos(race.wind.dir());
      const fav = (c.pin.x - c.committee.x) * ux + (c.pin.z - c.committee.z) * uz;
      txt(P_.clock, `${t('startIn')} ${fmt(-race.clock + 0.999)}`);
      txt(P_.toT, `${Math.max(0, -li.d).toFixed(0)} ${M}` + (close > 0.3 && li.d < 0 ? ` · ${fmt(-li.d / close)}` : ''));
      txt(P_.fav, Math.abs(fav) < 4 ? t('square') : fav > 0 ? t('favPin') : t('favBoat'));
      txt(P_.place, '');
    } else {
      txt(P_.fav, '');
      if (P.done) { txt(P_.clock, fmt(P.finish)); txt(P_.toT, t('finish')); }
      else { txt(P_.clock, fmt(race.clock)); txt(P_.toT, `${t(LEG[leg])} · ${Math.round(race.distToNext(P))} ${M}`); }
      const place = P.done ? P.place : race.standings().indexOf(P) + 1;
      txt(P_.place, `${place}/${race.boats.length}`);
      if (lastPlace && place !== lastPlace) {
        P_.place.classList.remove('up', 'down'); void P_.place.offsetWidth;
        P_.place.classList.add(place < lastPlace ? 'up' : 'down'); placeT = 2.2;
      }
      lastPlace = place;
    }
    if (placeT > 0 && (placeT -= dt) <= 0) P_.place.classList.remove('up', 'down');
    if (P.leg !== lastLeg) { if (lastLeg >= 0) { P_.to.classList.remove('flash'); void P_.to.offsetWidth; P_.to.classList.add('flash'); } lastLeg = P.leg; }

    // the dial: the wind swings smoothly, the no-go wedge round it
    twaS = twaS === null ? twa : twaS + wrap(twa - twaS) * (1 - Math.exp(-dt * 6));
    D.tw.setAttribute('transform', `rotate(${(twaS / D2R).toFixed(1)} 32 32)`);
    const beat = beatAngle(P.tws) * D2R;
    D.nogo.setAttribute('d', `M32 32 L${pt(twaS - beat, 26)} A26 26 0 0 1 ${pt(twaS + beat, 26)} Z`);
    txt(D.tws, `${Math.round(P.tws)} ${t('kn').toUpperCase()}`);

    // the controls fade back when no one is on them
    rudder.classList.toggle('act', Math.abs(P.rudder) > 0.04);
    // the sheet: is the knob in the band, and which way to pull
    const awa = Math.abs(P.awa) / D2R, a = Math.abs(twa) / D2R, tol = 7 / 77;
    const lo = clamp(sheetFor(idealSail(awa)) - tol, 0, 1), hi = clamp(sheetFor(idealSail(awa) + P.depower) + tol, 0, 1);
    const isOff = (s) => a >= 28 && (s < lo || s > hi);
    sheet.classList.toggle('off', isOff(P.sheet));
    if (jibSheet) jibSheet.classList.toggle('off', !!P.split && isOff(P.jibSheet));
    const want = P.trim === 'in' || P.trim === 'out' ? P.trim : null;
    const onJib = P.split && P.trimSail === 'jib';
    for (const [el, mine] of [[advMain, !onJib], [advJib, onJib]]) {
      if (!el) continue;
      const show = !P.autoTrim && want && mine;
      el.classList.toggle('on', !!show);
      if (show) {
        el.classList.toggle('t', want === 'in'); el.classList.toggle('b', want === 'out');
        txt(el.firstChild, want === 'in' ? '↑' : '↓'); txt(el.lastChild, t(want));
      }
    }

    // pills that have just come up glow until used (or for a while)
    for (const id of btnIds) {
      const b = document.getElementById(id); if (!b || id === 'tackBtn') continue;
      const vis = !b.hidden;
      if (vis && fresh[id] === false && race.clock > 0) { b.classList.add('fresh'); clearTimeout(b._ft); b._ft = setTimeout(() => b.classList.remove('fresh'), 6000); }
      if (!vis) b.classList.remove('fresh');
      fresh[id] = vis;
    }
    // the countdown's last ten: a beat each second
    const cs = count.textContent;
    if (cs !== lastCount) { lastCount = cs; if (count.classList.contains('final')) { count.classList.remove('beat'); void count.offsetWidth; count.classList.add('beat'); } }
    txt(cam.firstChild, t(world.mode));

    placeTag(race, c, leg, P);
  }

  function placeTag(race, c, leg, P) {
    if (hud.hidden || P.done) { tag.classList.remove('on'); return; }
    const next = leg === 'mark' ? [c.windward] : leg === 'wing' ? [c.wing] : leg === 'gate' ? c.gate : [c.pin, c.committee];
    const x = next.reduce((s, m) => s + m.x, 0) / next.length, z = next.reduce((s, m) => s + m.z, 0) / next.length;
    v3.set(x, 2.5, z).project(world.camera);
    const hz = parseFloat(getComputedStyle(tag).zoom) || 1, W = innerWidth / hz, H = innerHeight / hz;
    let sx = (v3.x + 1) / 2 * W, sy = (1 - v3.y) / 2 * H;
    const lw = tagIn.offsetWidth / 2 + 10; // the label must fit whole, or it goes to the edge and points
    const behind = v3.z > 1, inView = !behind && sx > lw && sx < W - lw && sy > 60 && sy < H - 40;
    tag.classList.toggle('mark', leg === 'mark' || leg === 'wing' || leg === 'gate');
    tag.classList.toggle('edge', !inView);
    let rot = 0;
    if (!inView) { // pin it to the edge, pointing the way
      let dx = sx - W / 2, dy = sy - H / 2; if (behind) { dx = -dx; dy = -dy; }
      const hw = W / 2 - lw, hh = H / 2 - 90, k = Math.min(hw / Math.abs(dx || 1e-6), hh / Math.abs(dy || 1e-6));
      sx = W / 2 + dx * k; sy = H / 2 + dy * k; rot = Math.atan2(dy, dx);
    }
    tag.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
    tag.querySelector('.ptr').style.transform = `rotate(${(rot / D2R).toFixed(0)}deg)`;
    txt(tagT, `${t(LEG[leg])} · ${Math.round(race.distToNext(P))} ${M}`);
    tag.classList.add('on');
  }

  // chips, kept by key: a new one fades in, a changed one only changes its words (and colour), one no longer
  // wanted stays a moment (no flicker at a threshold), then fades out and folds away
  const chipBox = $('#chips'), live = new Map(), LINGER = 0.9;
  function chips(list) {
    const now = performance.now() / 1000, want = new Set();
    for (const [kind, text, key = text] of list) {
      want.add(key);
      let c = live.get(key);
      if (!c) {
        const el = document.createElement('span'); el.className = `chip nx-chip ${kind}`; chipBox.append(el);
        c = { el, kind }; live.set(key, c);
        void el.offsetWidth; el.classList.add('in'); // from the start state, so it animates
      }
      if (c.kind !== kind) { c.el.classList.replace(c.kind, kind); c.kind = kind; }
      if (c.out) { c.out = false; clearTimeout(c.timer); c.el.classList.remove('out'); c.el.classList.add('in'); }
      txt(c.el, text); c.seen = now;
    }
    for (const [key, c] of live) {
      if (want.has(key) || c.out || now - c.seen < LINGER) continue;
      c.out = true; c.el.classList.remove('in'); c.el.classList.add('out');
      c.timer = setTimeout(() => { c.el.remove(); live.delete(key); }, 800);
    }
  }
  function clearChips() { for (const c of live.values()) clearTimeout(c.timer); live.clear(); chipBox.textContent = ''; }
  chipsReady = true;

  return { update, chips, get on() { return on; }, toggle() { apply(!on); try { on ? localStorage.setItem('hudNext', '1') : localStorage.removeItem('hudNext'); } catch (e) {} return on; } };
}
