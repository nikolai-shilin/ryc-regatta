// Regatta: the game loop, the touch controls, the instruments, the sounds and the menus.
import { Race, CLS, D2R, KN, HULL, clamp, wrap, idealSail, sheetFor, beatAngle, ZONE, dailyRace, legTargets, legAim, isBeat, hasZone, laidShape } from './sim.js';
import { World, ladderStep, beatOf, beatFrom, zoneMarks } from './world.js';
import { raceStarted, raceFinished, raceResult, perfSetup, perfFrame, statsContext, raceIncident, raceEnded, visitSend } from './stats.js';
import { initExtras, onStart, onFrame, drill, drillSettings } from './extras.js'; // the drills, the analytics
import { createHud } from './hud-bc.js';
import { autoBase, autoTuner, gfxLevel, gfxNow, gfxParts, lighterParts, saveAuto, GFX_LEVELS, GFX_PARTS, SAVER_MS } from './gfx.js';
import { openAvMenu, avSummary } from './av-menu.js'; // Audio & graphics, the site's menu too
import { LINE_DASH, mapPalette, placeLabels } from './course-map.js';
import { LOOKS, playerLook, lookFrom } from './yacht.js';
const flagCode = (src) => { const m = typeof src === 'string' && /\/flags\/([a-z]{2}(?:-[a-z]+)?)\.svg$/.exec(src); return m ? m[1] : null; }; // '/flags/gb.svg' → 'gb'
import { VENUE, venueById, laidLength, lengthOffered } from './venues.js';
import { classById } from './classes.js';
import { arriveLoaded, goBack, outOfRace } from './trail.js';
import { createMusic, direct, MUSIC_CHOICES, PLAYLIST } from './music.js';
import { createSfx, openAudio, AUDIO_TICK } from './sfx.js';

const $ = (s) => document.querySelector(s);
// a file of the game's (a voice, the calls, the gulls) at the address the page's import map gives it, with its hash
// (scripts/stamp-game.mjs), so a returning player's browser keeps it; new URL() alone would drop the ?v=
const fileAt = (f) => (import.meta.resolve ? import.meta.resolve(`./${f}`) : new URL(f, import.meta.url).href);
// Carlito bold, the face the sail and bow numbers are painted in (yacht.js, boats3d.js); play/index.html asks for it
// before the game's code is in. Whether it's here when the boats are dressed decides if the start dresses them again.
const carlitoIn = () => !document.fonts || document.fonts.check('700 32px Carlito', '0123456789');
const TG = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData ? window.Telegram.WebApp : null;
// The game is a site of its own (this repo, the Vercel project ryc-regatta, at upandown.rycrentals.com); the app,
// its rule articles, its fonts and the race scores (api/game.mjs in the iyt-test repo) stay on iyt.rycrentals.com, which lets this site
// read them across origins. SITE is in stats.js too.
const SITE = 'https://iyt.rycrentals.com';
// The menus are Next.js pages on this site now: the race hub, the free-race set-up and the race's result page.
const HUB = '/race';
// Leaving the race goes back to the page you came from (trail.js, the same as the site's back arrows), the hub if none
arriveLoaded();
addEventListener('pageshow', (e) => { if (e.persisted) arriveLoaded({ pop: true }); });
const leave = () => goBack(HUB, null, { extra: !TG && history.state && history.state.race ? 1 : 0, single: true });
// Out of the race to a page of the race's own making (its result, the free race's set-up, the hub after a match): that
// page takes the race's place in the history, so the browser's back from it goes where the race was started from. A
// link would leave the race behind it, and back would load the whole game again and start a new race on the way (and
// a second back, from the race's own entry, another). The race's own entry (the pause menu's, below) is gone back
// over first, and the page put in place of the one the race was loaded on.
let replacing = null;
function replaceRace(to) {
  if (replacing != null) return; // (once: the way out is under way)
  replacing = to; outOfRace(to);
  const go = () => { if (replacing === to) { replacing = ''; location.replace(to); } };
  if (!TG && history.state && history.state.race) { history.back(); setTimeout(go, 400); } else go(); // (popstate, below, goes on arrival)
}
// A 1-on-1 race against a friend (/play?match=<code>, from /match/new and the race's link): the waiting room, the race
// and the card after it are match-ui.js's, loaded only then (with the Realtime client it brings). mx: the race on
// screen while one is sailed ({ race, step(dt), isGuest }); matchUi: the module, once it's in.
const MATCH = (() => { const c = (new URLSearchParams(location.search).get('match') || '').toUpperCase(); return /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(c) ? c : null; })();
let mx = null, matchUi = null;
// leaving a 1-on-1 race leaves it on both screens (match-ui.js tells the other), and goes to the hub: back would be the
// set-up or the link's page, which opens the race again
const quit = () => (MATCH && matchUi ? matchUi.leaveMatch() : leave());
// In a match, back (the browser's, Telegram's) never ends a race at once: on the water it opens the menu, then the race's
// question, and goes back from that question to the menu; with no race on the water (the waiting room, a card, just
// after a finish) it leaves. Out of a match, back is as it always was
function matchBack() {
  if (running && !race.over) { if (!paused) pause(); else if (confirmEl.hidden) ask('leave'); else { confirmEl.hidden = true; pauseEl.hidden = false; } }
  else quit();
}
// From Telegram the app passes its launch data in the hash, as Telegram does (miniapp/app.js in iyt-test); telegram-web-app.js has
// read and kept it by now, so it comes off the address bar and out of any link the player copies.
if (TG && /tgWebAppData=/.test(location.hash)) try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}

// ---------- words ----------
const ord = (n) => `${n}${['st', 'nd', 'rd'][n - 1] || 'th'}`;
const T = {
  en: {
    pausedK: 'Paused', legOf: (a, b) => `Leg ${a} of ${b}`, nextK: (m) => `Next: ${m}`, placeK: 'Place', ofN: (n) => `of ${n}`, timeK: 'Race time', penK: 'Penalties', penNone: 'clean so far', penS: 'spinning turns',
    changeRace: 'Change the race', leaveHub: 'Leave to the race hub', quickK: 'Quick switches', camK: 'Camera', sAuto: 'Auto', guidesSw: 'Guides on the water', avK: 'Audio & graphics', startsOver: 'starts over', loadingK: 'Rigging the boat', escResumes: 'Esc resumes',
    leaveK: 'Leave this race?', leaveTxt: (pl, leg) => `You are ${pl} on leg ${leg}.`, keepRacing: 'Keep racing', doRestart: 'Restart', doChange: 'Change it', doLeave: 'Leave',
    inSeq: 'You are in the start sequence.', notKept: 'This race’s time and place are not kept.',
    leaveHost: 'The race is abandoned on both screens.', leaveGuest: (w) => (w ? `You drop out, and the race goes to ${w}.` : 'You drop out, and the race ends with no winner.'), leaveHome: 'Your place stands for the other sailor, but if you leave now you won’t get the full result.',
    askK: { restart: 'Restart', change: 'Change the race', leave: 'Leave' }, askH: { restart: 'Restart this race?', change: 'Change the race?', leave: 'Leave this race?' },
    askT: { restart: 'It starts over from the start sequence, the same course in the same wind.', change: 'Next you pick the place, the wind and the course, and the race starts over with them.', leave: 'You go back to the race hub.' },
    sailUp: 'Beating to', sailDown: (k) => (k ? 'Running to' : 'Running, kite down, to'), sailReach: 'Reaching to', aheadOf: (n, s) => `${n} is ${s} ahead.`, leadBy: (s) => `You lead by ${s}.`, leadAlone: 'You lead.',
    // the pause's next target, with how far and how to round it; the leave dialog's headline; the course map's words
    nextAt: (m, d) => `Next: ${m} · ${d} m`, howPort: 'Leave it to port, on your left as you round it.', howGate: 'Sail between the two buoys and round either one.',
    howFinish: 'Cross the finish line between its ends.', howStart: 'Cross the line after the gun, between the committee boat and the pin.',
    whereH: (pl, d, to) => `You’re ${pl}, ${d} m from ${to}`,
    toK: { lineStart: 'the line', mark: 'the windward mark', mark1: 'mark 1', wing: 'the wing mark', mark2: 'mark 2', offset: 'the offset mark', gate: 'the gate', finish: 'the finish' },
    mapYou: 'You', mapStart: 'Start',
    timeFree: 'custom race', timeDaily: 'today’s race', inStart: 'In the start sequence.', notOver: 'Still to cross the start line.', notOverYou: 'You haven’t crossed the start line yet.',
    kick: 'Game', title: 'Up and down', fun: 'Just for fun — take a break and relax between tests.', sub: 'A race round the marks against the computer boats, under the racing rules. Steer, trim, tack, read the wind.',
    modeK: 'Race', daily: 'Today’s race', free: 'Custom race', howK: 'How to play',
    dailyNote: (w, at, sh, y) => `The same place, yacht, course and wind for everyone today — ${at}, the ${y}, ${sh}, ${w} — so times compare fairly. A new yacht every day. The fastest are on the Home page.`,
    shapeWl: 'Up and down', shapeTri: 'Triangle', shapeTrap: 'Trapezoid', shapeWlu: 'Up and down, upwind finish',
    dbK: 'Your race', dGun: (d, v) => `At the gun: ${d} m from the line at ${v} kn`, dGunOver: 'At the gun: over the line — you had to go back',
    dStartLate: (s) => `You crossed the line ${s} s after the gun`, tipStart: 'Aim to be a boat length behind the line, at full speed, as the gun goes.',
    dSpeed: (p) => `Speed: ${p}% of target on average`, tipSpeed: 'Keep the sheet in the green band and steer smoothly: every turn of the rudder brakes.',
    dTacks: (h, l) => `Tacks on the beat: ${h} in a header, ${l} in a lift`, tipTacks: 'Tack when the wind heads you (the orange chip), not when it lifts you (the blue one).',
    dDirty: (s) => `${s} s in another boat’s dirty air`, tipDirty: 'Behind and downwind of another boat the wind is weaker: tack away or sail clear of it.',
    dPen: (s) => `${s} s spinning penalty turns`, dClean: 'No fouls and no penalties — a clean race', dHails: (n) => `Hailed ${n}× by boats you had to keep clear of`,
    dRule: (r) => `Rule ${r}`, read: 'Read the rule', r10: 'Port keeps clear of starboard', r11: 'Windward keeps clear of leeward', r12: 'Clear astern keeps clear',
    r13: 'While tacking, keep clear', r18: 'Mark-room', r31: 'Touching a mark', r44: 'A boat taking a penalty keeps clear', rOcs: 'Over the line at the start',
    x10: 'On opposite tacks, the boat with the wind on her port side keeps clear.', x11: 'Overlapped on the same tack, the windward boat keeps clear.',
    x12: 'On the same tack and not overlapped, the boat behind keeps clear.', x13: 'From head to wind until close-hauled, a tacking boat keeps clear of everyone.',
    x18: 'At the gate and the wing mark, in the zone, the inside boat, or the one clear ahead, gets room to round. Not at the windward mark: there nobody gets mark-room, and port keeps clear of starboard.', x31: 'Touching a mark costs one penalty turn.', x44: 'A boat spinning her penalty turns keeps clear of the others.',
    r15: 'Just got right of way — give room first', r16: 'Right of way, but no sudden turns', r17: 'In to leeward from astern — no higher than your proper course',
    x15: 'A boat that gets right of way by her own action (a tack, or sailing up from astern) must at first give the other room to keep clear.',
    x16: 'A boat with right of way that changes course must leave the other boat room to keep clear.',
    x17: 'Overlapped to leeward from clear astern within two hull lengths, a boat must not sail above her proper course.',
    hail15: 'Give me room to keep clear!', hail16: 'Don’t turn into me!', hail17: 'Proper course!',
    split: 'Main + jib', mainCap: 'Main', jibCap: 'Jib', jibIn: 'Jib: pull in', jibOut: 'Jib: ease out',
    kiteHoist: 'Hoisting the kite…', kiteUp: 'Kite’s drawing', kiteDrop: 'Dropping the kite…',
    r20: 'Room to tack at an obstruction', x20: 'Close-hauled and blocked by an obstruction ahead, a boat may hail for room to tack; the boat hailed must tack or give her room.',
    hail20: 'Room to tack!', exonerated: 'Pushed into it by another boat’s foul — no penalty (rule 43)',
    barging: 'Barging: there’s no room at the committee boat at the start — the windward boat keeps clear',
    reef: 'Reef', reefStart: 'Tying in a reef…', reefDone: 'Reefed — she stands up better', shakeStart: 'Shaking out the reef…', shakeDone: 'Full main again',
    jibBtn: 'J3', jibBig: 'J1', jibStart: 'Changing jibs…', jibDone: 'New jib up', zero: 'Code 0',
    kiteHoistZ: 'Unfurling the code zero…', kiteUpZ: 'Code zero drawing', kiteDropZ: 'Furling the code zero…',
    hailBtn: 'Hail', youHail: (h) => `You: “${h}”`, hailNone: 'Nothing to hail for',
    prepU: 'U flag today: in the triangle by the line in the last minute, you’re out (UFD)', prepB: 'Black flag today: over in the last minute and you’re out, even if the start is recalled (BFD)',
    ufd: 'Over in the last minute under the U flag — disqualified (UFD)', bfd: 'Over in the last minute under the black flag — disqualified (BFD)',
    genRecall: (f) => `General recall — too many over. The start is repeated${f === 'U' ? ', now under the U flag' : f === 'B' ? ', now under the black flag' : ''}`,
    finishedStartDsq: 'Finished — but disqualified at the start', flagU: 'U flag', flagB: 'Black', flagSub: 'Recall',
    dStartDsq: (f) => (f === 'U' ? 'Disqualified at the start (U flag)' : 'Disqualified at the start (black flag)'), tipStartDsq: 'Under U or the black flag, stay below the line for the whole last minute.',
    'r18.3': 'Tacking in the zone', 'r18.4': 'Gybing at the mark', r19: 'Room at an obstruction', rU: 'The U flag', rB: 'The black flag',
    'x18.3': 'A boat that tacks onto starboard in the zone mustn’t make a boat that has been on starboard since entering it sail above close-hauled, and gives her room if she gets inside.',
    'x18.4': 'An inside boat with right of way that has to gybe at the mark sails no farther from it than her proper course needs.',
    x19: 'Passing an obstruction overlapped (the committee boat, away from the start and finish), the outside boat gives the inside one room.',
    'hail18.3': 'You tacked in the zone — keep clear!', 'hail18.4': 'Gybe — no wider than you need!', hail19: 'Room at the committee boat!',
    pb: (s) => `Your best on this course: ${s}`, pbNew: 'A new personal best!', pbToday: (s) => `Your best today: ${s}`, todayTop: 'Today’s fastest', guest: 'No name',
    cSteer: 'Steer: ← → on a keyboard, or your left thumb along the arc', cSheet: 'Trim: ↑ ↓, or your right thumb up the slider to pull the sails in, down to ease them',
    cLine: 'Head for the line and cross it just after the gun', cHeader: 'The wind has headed you — tap Tack', cMark: 'Round the mark leaving it on your left (to port)',
    cKite: 'Bear away and tap Kite to fly the gennaker', cGate: 'Sail between the two buoys of the gate', cFinish: 'Now cross the line to finish',
    cFinishUp: 'The finish line is up the course, just right of the windward mark — beat up and cross it',
    cFinishR: 'The finish line is off to the right of the gate — reach across and cross it', cFinishL: 'The finish line is off to the left of the gate — reach across and cross it',
    wind: 'Wind', light: 'Light · 7 kn', medium: 'Medium · 12 kn', strong: 'Strong · 19 kn', laps: 'Laps', sails: 'Sails',
    manual: 'I trim', auto: 'Auto-trim', sound: 'Sound', voiceK: 'Voice', on: 'On', off: 'Off', startK: 'Start', m1: '1 min', m3: '3 min', m5: '5 min',
    fleetK: 'Boats', lengthK: 'Course', lShort: 'Short', lMedium: 'Medium', lLong: 'Long',
    currentK: 'Current', guidesK: 'Guides', gAuto: 'Auto', gHigh: 'High', gMedium: 'Medium', gLow: 'Low', start: 'Start race', resume: 'Resume', restart: 'Restart',
    how1: '<b>Left thumb</b> steers on the arc. <b>Right thumb</b> works the sheet: up pulls the sails in, down lets them out. Keep the telltales green.',
    how2: '<b>Tack</b> turns you through the wind (<b>Gybe</b> downwind). <b>Kite</b> sets the gennaker on a run — the hoist and the drop take the crew a few seconds, so get it down in good time before the gate. In a gust, ease the sheet before she heels too far; in a blow, <b>Reef</b> makes the main smaller. Before the start, head up and let the sheet right out to stop — or even go astern.',
    how3: 'Start after the gun — the class flag comes down. Over early and you must go back. Round the windward mark <b>leaving it to port</b>, finish through the line.',
    how5: 'Round your boat: the <b>arrow</b> shows where the wind blows from; <b>red</b> — too close to the wind to sail; <b>green</b> marks — the best angle upwind; <b>blue</b> — the best angle downwind. The wind swings ten degrees and more either way every minute or so: in a <b>lift</b> you can point higher, in a <b>header</b> tack.',
    how4: 'Racing rules: port tack keeps clear of starboard, windward of leeward, the boat astern of the boat ahead; at the windward mark nobody gets room, port keeps clear of starboard; at the gate, the <b>zone</b> (dashed ring, three hull lengths): if two boats are overlapped when the first reaches it, the inside one gets room, if not — the one clear ahead. Hit someone you should have avoided, or touch a mark — one penalty turn: a tack and a gybe. A boat that has just got right of way must first give the other room, and a boat with right of way mustn’t turn suddenly into one keeping clear.',
    rotate: 'Turn your phone sideways for the best view.', back: '← Back to Sailing Certification Test',
    flagCls: 'Class', flagP: 'Prep', flagX: 'Recall', kn: 'kn', drone: 'Drone', helm: 'Helm', top: 'Top', tack: 'Tack', gybe: 'Gybe', kite: 'Kite', in: 'In', out: 'Out',
    ok: 'Trim OK', pullIn: 'Pull in', easeOut: 'Ease out', irons: 'In irons',
    startIn: 'Start', lineStart: 'Start line', mark: 'Windward mark', wing: 'Wing mark', gate: 'Leeward gate', finish: 'Finish',
    mark1: 'Mark 1', mark2: 'Mark 2', offset: 'Offset mark',
    roundedTri: 'Mark rounded — bear away onto the reach to the wing mark', roundedWing: 'Wing mark rounded — gybe onto the broad reach',
    roundedTrap: 'Mark 1 rounded — bear away onto the broad reach to mark 2', roundedMark2: 'Mark 2 rounded — bear away onto the run to the gate',
    roundedWlu: 'Mark rounded — bear away to the offset mark', roundedOffset: 'Offset mark rounded — bear away, kite up', gateFinish: 'Through the gate — now for the finish',
    seaBreeze: 'Sea breeze today — it will build and swing right as you race', seaBreezeSouth: 'Sea breeze today — it will build and swing left as you race', thermalBreeze: 'Thermal breeze today — it will build and swing right as you race', kiteWrap: 'The kite wrapped in the gybe — it has to come down', kiteGybed: 'Kite gybed', takeoff: 'Foiling!', splashdown: 'Off the foils — build speed to take off again',
    crashGybe: 'Crash gybe! Too far by the lee — the boom slammed across', deathRoll: 'Death roll! By the lee with the kite up — she rolled and rounded up',
    byLee: (d) => `By the lee ${d}° — gybe or head up`, foot: 'Slow — foot a few degrees to build speed', waveTip: 'Waves: luff up the face, bear away down the back', ocsS: 'OCS — return below the line',
    target: 'target', vmg: 'VMG', line: 'line', toLine: 'to line', favPin: 'pin end favoured', favBoat: 'boat end favoured', square: 'line square',
    sigWarn: (n) => `Warning signal — class flag up, ${n} min`, sigPrep: (n, f = 'P') => `Preparatory — ${{ P: 'P flag', U: 'U flag', B: 'black flag' }[f]} up, ${n} min`, sig1: (n, f = 'P') => `One minute — ${{ P: 'P flag', U: 'U flag', B: 'black flag' }[f]} down`, gun: 'Start! Class flag down',
    ocs: 'Over early! X flag — go back below the line', cleared: 'Clear — now start', started: 'Good start!', rounded: 'Mark rounded — bear away, kite up',
    missedLine: 'Outside the line — cross between the committee boat and the pin', missedGate: 'Outside the gate — go back and sail between the two buoys', wrongSide: 'Leave the mark to port — go back round it',
    gateMsg: 'Through the gate — back upwind', bump: 'Contact!', aground: 'Aground! Steer back out to sea', broach: 'Broach! Ease the sheet', kitedown: 'Too close to the wind — the kite comes down in a hurry',
    heelMsg: 'Too much heel — ease the sheet', ironsMsg: 'In irons — steer away from the wind', gust: 'Gust!', autoOff: 'Auto-trim off — you trim now',
    hail10: 'Starboard!', hail11: 'Windward boat, keep clear!', hail12: 'Keep clear astern!', hail13: 'You’re tacking — keep clear!', hail18: 'Room at the mark!', hail44: 'Penalty boat — keep clear!',
    fouled: (w, r) => `Foul on ${w} (rule ${r}) — penalty turn: tack and gybe`, theyFouled: (w, r) => `${w} broke rule ${r} and takes a penalty`,
    touched: 'You touched the mark — penalty turn: tack and gybe', penaltyDone: 'Penalty done', pen: (tk, gy) => `Penalty: ${tk ? '✓' : '○'} tack ${gy ? '✓' : '○'} gybe`,
    dirty: 'Dirty air', surf: 'Surfing!', lift: (d) => `Lift ${d}°`, header: (d) => `Header ${d}° — tack?`,
    zIn: (n) => `Zone · overlapped with ${n}, you're inside — you get room`, zOut: (n) => `Zone · overlapped with ${n}, you're outside — give room`,
    zAhead: (n) => `Zone · clear ahead of ${n} — you get room`, zAstern: (n) => `Zone · clear astern of ${n} — keep clear`, tackCall: 'Ready about… Lee-oh!', gybeCall: 'Stand by to gybe… Gybe-oh!',
    results: 'Results', again: 'Race again', menu: 'Menu', racing: 'racing…', you: 'You', dsq: 'DSQ',
    gfxDown: (q) => `Graphics set to ${q} to keep it smooth`, place: ord, finished: (n) => `Finished ${ord(n)}!`, finishedDsq: 'Finished without taking your penalty — DSQ',
    contactDsq: (a) => ({ rudder: `DSQ, rule ${a.rule}: you had to keep clear of ${a.who}, and your rudder was only ${a.deg}° of ${a.max}° over`, late: `DSQ, rule ${a.rule}: you had to keep clear of ${a.who}. Rudder hard over, but too late`, room: `DSQ, rule 14: you had room to avoid ${a.who} and held your course`, turned: `DSQ, rule 16: you turned onto ${a.who}, who was keeping clear`, above: `DSQ, rule 17: above your proper course, into ${a.who}` })[a.why],
    theyDsq: (a) => `${a.who} disqualified, rule ${a.rule}`,
    // a 1-on-1 race: the result, and the link between the two screens
    raceWon: 'You win the race!', raceLost: (w) => `${w} wins the race`,
    waitingHost: (n) => `Waiting for ${n}…`, guestGone: (n) => `${n} isn’t answering — her boat holds her course; after 30 s of silence she drops out`,
    abandoned: 'Race abandoned — not scored', full: 'This 1-on-1 race is full', matchFail: 'Couldn’t connect to the 1-on-1 race', tryAgain: 'Try again',
    noGl: 'The browser won’t start the 3D graphics just now. Close other tabs and apps, or restart the browser, and try again.',
    glLostK: 'The picture was lost', glLostTxt: 'The device took the graphics back, most often when it runs short of memory. Reload to sail on, on lighter graphics.', doReload: 'Reload',
    timeOne: '1-on-1 race',
    'r16.1': 'Right of way, but give room to keep clear', 'x16.1': 'A boat with right of way that changes course must give the other boat room to keep clear.',
  },
  ru: {
    pausedK: 'Пауза', legOf: (a, b) => `Отрезок ${a} из ${b}`, nextK: (m) => `Дальше: ${m}`, placeK: 'Место', ofN: (n) => `из ${n}`, timeK: 'Время', penK: 'Штрафы', penNone: 'пока чисто', penS: 'штрафные обороты',
    changeRace: 'Изменить гонку', leaveHub: 'Выйти в меню гонок', quickK: 'Быстрые переключатели', camK: 'Камера', sAuto: 'Авто', guidesSw: 'Подсказки на воде', avK: 'Звук и графика', startsOver: 'новый старт', loadingK: 'Готовим лодку', escResumes: 'Esc — продолжить',
    leaveK: 'Выйти из гонки?', leaveTxt: (pl, leg) => `Ты ${pl}-й на ${leg}-м отрезке.`, keepRacing: 'Продолжить', doRestart: 'Заново', doChange: 'Изменить', doLeave: 'Выйти',
    inSeq: 'Идёт стартовая процедура.', notKept: 'Время и место этой гонки не сохранятся.',
    leaveHost: 'Гонка прекратится на обоих экранах.', leaveGuest: (w) => (w ? `Ты сходишь, и гонка достаётся: ${w}.` : 'Ты сходишь, и гонка закончится без победителя.'), leaveHome: 'Для соперника твоё место останется, но если выйдешь сейчас, полного результата не получишь.',
    askK: { restart: 'Заново', change: 'Изменить гонку', leave: 'Выход' }, askH: { restart: 'Начать заново?', change: 'Изменить гонку?', leave: 'Выйти из гонки?' },
    askT: { restart: 'Всё начнётся со стартовой процедуры: та же дистанция, тот же ветер.', change: 'Дальше выберешь место, ветер и дистанцию — и гонка начнётся заново.', leave: 'Ты вернёшься в меню гонок.' },
    sailUp: 'Лавировка к', sailDown: (k) => (k ? 'Фордевинд под генакером к' : 'Фордевинд без генакера к'), sailReach: 'Галфвинд к', aheadOf: (n, s) => `${n} впереди на ${s}.`, leadBy: (s) => `Ты лидируешь на ${s}.`, leadAlone: 'Ты лидируешь.',
    nextAt: (m, d) => `Дальше: ${m} · ${d} м`, howPort: 'Огибай знак, оставляя его по левому борту.', howGate: 'Пройди между двумя знаками и обогни любой из них.',
    howFinish: 'Пересеки финишную линию между её концами.', howStart: 'Пересеки линию после сигнала, между судейским судном и знаком.',
    whereH: (pl, d, to) => `Ты ${pl}-й, ${d} м до ${to}`,
    toD: { lineStart: 'линии', mark: 'верхнему знаку', mark1: 'знаку 1', wing: 'боковому знаку', mark2: 'знаку 2', offset: 'отбойнику', gate: 'воротам', finish: 'финишу' },
    toK: { lineStart: 'линии', mark: 'верхнего знака', mark1: 'знака 1', wing: 'бокового знака', mark2: 'знака 2', offset: 'отбойника', gate: 'ворот', finish: 'финиша' },
    mapYou: 'Вы', mapStart: 'Старт',
    timeFree: 'своя гонка', timeDaily: 'гонка дня', inStart: 'Идёт стартовая процедура.', notOver: 'Стартовая линия ещё впереди.', notOverYou: 'Ты ещё не пересёк стартовую линию.',
    kick: 'Игра', title: 'Up and down', fun: 'Просто для удовольствия — отдохни и расслабься между тестами.', sub: 'Гонка вокруг знаков против компьютерных лодок по правилам. Рули, работай шкотом, делай повороты, читай ветер.',
    modeK: 'Гонка', daily: 'Гонка дня', free: 'Своя гонка', howK: 'Как играть',
    dailyNote: (w, at, sh, y) => `Сегодня у всех одно место, одна яхта, одна дистанция и один ветер — ${at}, ${y}, ${sh}, ${w}, — так что время честно сравнивается. Каждый день — новая яхта. Самые быстрые — на главной.`,
    shapeWl: 'Апвинд — даунвинд', shapeTri: 'Треугольник', shapeTrap: 'Трапеция', shapeWlu: 'Апвинд — даунвинд, финиш наверху',
    dbK: 'Твоя гонка', dGun: (d, v) => `На сигнале старта: ${d} м до линии, ${v} уз`, dGunOver: 'На сигнале старта: за линией — пришлось возвращаться',
    dStartLate: (s) => `Линию пересёк через ${s} с после сигнала`, tipStart: 'Цель — быть в корпусе от линии на полной скорости в момент сигнала.',
    dSpeed: (p) => `Скорость: в среднем ${p}% от целевой`, tipSpeed: 'Держи шкот в зелёной полосе и рули плавно: каждое движение руля тормозит.',
    dTacks: (h, l) => `Повороты на лавировке: ${h} — когда ветер зашёл, ${l} — когда отошёл`, tipTacks: 'Поворачивай, когда ветер заходит (оранжевая метка), а не когда отходит (синяя).',
    dDirty: (s) => `${s} с в ветровой тени другой лодки`, tipDirty: 'За другой лодкой и под ветром от неё ветер слабее: поверни или уйди в чистый ветер.',
    dPen: (s) => `${s} с на штрафных оборотах`, dClean: 'Ни нарушений, ни штрафов — чистая гонка', dHails: (n) => `${n} раз(а) окликнули лодки, которым ты должен был уступить`,
    dRule: (r) => `Правило ${r}`, read: 'Прочитать правило', r10: 'Левый галс уступает правому', r11: 'Наветренная уступает подветренной', r12: 'Чисто позади уступает',
    r13: 'В повороте — уступай', r18: 'Место у знака', r31: 'Касание знака', r44: 'Лодка на штрафе уступает', rOcs: 'Фальстарт',
    x10: 'На разных галсах уступает лодка, у которой ветер слева (левый галс).', x11: 'Связанные на одном галсе: наветренная уступает.',
    x12: 'На одном галсе без связанности уступает идущая сзади.', x13: 'От положения левентик до курса бейдевинд лодка в повороте уступает всем.',
    x18: 'У ворот и у бокового знака в зоне место для огибания получает внутренняя лодка или та, что чисто впереди. У верхнего знака места не требует никто: левый галс уступает правому.', x31: 'Касание знака — один штрафной оборот.', x44: 'Лодка на штрафных оборотах уступает остальным.',
    r15: 'Получила право дороги — сначала дай место', r16: 'Право дороги — но без резких поворотов', r17: 'Догнала сзади под ветром — не выше надлежащего курса',
    x15: 'Лодка, получившая право дороги своими действиями (поворотом или догнав сзади), сначала должна дать другой место, чтобы уступить.',
    x16: 'Лодка с правом дороги, меняя курс, должна оставлять другой лодке место, чтобы уступить.',
    x17: 'Став связанной под ветром, догнав сзади в пределах двух корпусов, лодка не должна идти выше своего надлежащего курса.',
    hail15: 'Дай место уступить!', hail16: 'Не поворачивай на меня!', hail17: 'Надлежащий курс!',
    split: 'Грот + стаксель', mainCap: 'Грот', jibCap: 'Стаксель', jibIn: 'Стаксель: выбрать', jibOut: 'Стаксель: травить',
    kiteHoist: 'Ставим генакер…', kiteUp: 'Генакер работает', kiteDrop: 'Убираем генакер…',
    r20: 'Место для поворота у препятствия', x20: 'Идя в бейдевинд и упираясь в препятствие, лодка может окликнуть и попросить место для поворота; окликнутая должна повернуть или дать место.',
    hail20: 'Место для поворота!', exonerated: 'Тебя вытолкнули чужим нарушением — без штрафа (правило 43)',
    barging: 'У судейского судна на старте места не положено — наветренная уступает',
    reef: 'Риф', reefStart: 'Берём риф…', reefDone: 'Риф взят — крен меньше', shakeStart: 'Отдаём риф…', shakeDone: 'Снова полный грот',
    jibBtn: 'J3', jibBig: 'J1', jibStart: 'Меняем стаксель…', jibDone: 'Новый стаксель поднят', zero: 'Код 0',
    kiteHoistZ: 'Раскатываем код-зеро…', kiteUpZ: 'Код-зеро работает', kiteDropZ: 'Скатываем код-зеро…',
    hailBtn: 'Оклик', youHail: (h) => `Ты: «${h}»`, hailNone: 'Окликать некого',
    prepU: 'Сегодня флаг U: в треугольнике у линии в последнюю минуту — дисквалификация (UFD)', prepB: 'Сегодня чёрный флаг: за линией в последнюю минуту — дисквалификация, даже при общем отзыве (BFD)',
    ufd: 'За линией в последнюю минуту под флагом U — дисквалификация (UFD)', bfd: 'За линией в последнюю минуту под чёрным флагом — дисквалификация (BFD)',
    genRecall: (f) => `Общий отзыв — слишком многие за линией. Старт повторяется${f === 'U' ? ', теперь под флагом U' : f === 'B' ? ', теперь под чёрным флагом' : ''}`,
    finishedStartDsq: 'Финиш — но дисквалификация на старте', flagU: 'Флаг U', flagB: 'Чёрный', flagSub: 'Отзыв',
    dStartDsq: (f) => (f === 'U' ? 'Дисквалификация на старте (флаг U)' : 'Дисквалификация на старте (чёрный флаг)'), tipStartDsq: 'Под флагом U или чёрным флагом всю последнюю минуту держись ниже линии.',
    'r18.3': 'Поворот в зоне', 'r18.4': 'Фордевинд у знака', r19: 'Место у препятствия', rU: 'Флаг U', rB: 'Чёрный флаг',
    'x18.3': 'Лодка, сделавшая поворот на правый галс в зоне, не должна заставлять лодку, идущую правым галсом с входа в зону, идти выше бейдевинда, и даёт ей место, если та окажется внутри.',
    'x18.4': 'Внутренняя лодка с правом дороги, которой нужно сделать фордевинд у знака, не уходит от него дальше, чем требует её надлежащий курс.',
    x19: 'Проходя препятствие связанными (судейское судно — не на старте и финише), внешняя лодка даёт внутренней место.',
    'hail18.3': 'Ты повернул в зоне — уходи!', 'hail18.4': 'Фордевинд — не шире, чем нужно!', hail19: 'Место у судейского судна!',
    pb: (s) => `Твой рекорд на этой дистанции: ${s}`, pbNew: 'Новый личный рекорд!', pbToday: (s) => `Твой лучший результат сегодня: ${s}`, todayTop: 'Самые быстрые сегодня', guest: 'Без имени',
    cSteer: 'Руль: ← → на клавиатуре или левым пальцем по дуге', cSheet: 'Шкот: ↑ ↓ или правым пальцем по ползунку: вверх — выбрать паруса, вниз — потравить',
    cLine: 'Иди к линии и пересеки её сразу после сигнала', cHeader: 'Ветер зашёл — жми «Поворот»', cMark: 'Огибай знак, оставляя его слева',
    cKite: 'Уваливайся и жми «Генакер»', cGate: 'Пройди между двумя знаками ворот', cFinish: 'Теперь пересеки линию — финиш',
    cFinishUp: 'Финишная линия наверху, чуть правее верхнего знака — лавируй к ней и пересеки её',
    cFinishR: 'Финишная линия справа от ворот — иди к ней галфвиндом и пересеки её', cFinishL: 'Финишная линия слева от ворот — иди к ней галфвиндом и пересеки её',
    wind: 'Ветер', light: 'Слабый · 7 уз', medium: 'Средний · 12 уз', strong: 'Сильный · 19 уз', laps: 'Круги', sails: 'Паруса',
    manual: 'Сам', auto: 'Авто', sound: 'Звук', voiceK: 'Голос', on: 'Вкл', off: 'Выкл', startK: 'Старт', m1: '1 мин', m3: '3 мин', m5: '5 мин',
    fleetK: 'Лодок', lengthK: 'Дистанция', lShort: 'Короткая', lMedium: 'Средняя', lLong: 'Длинная',
    currentK: 'Течение', guidesK: 'Подсказки', gAuto: 'Авто', gHigh: 'Высокая', gMedium: 'Средняя', gLow: 'Низкая', start: 'Начать гонку', resume: 'Продолжить', restart: 'Заново',
    how1: '<b>Левый палец</b> рулит по дуге. <b>Правый</b> работает шкотом: вверх выбрать, вниз потравить. Колдунчики должны быть зелёными.',
    how2: '<b>Поворот</b> — оверштаг через ветер (на полных курсах — <b>фордевинд</b>). <b>Генакер</b> — для попутного ветра; постановка и уборка занимают у экипажа несколько секунд, так что убирай его заранее, до ворот. В порыве трави шкот, пока крен не стал слишком большим; в сильный ветер <b>Риф</b> уменьшает грот. Перед стартом приведись и потрави шкот до конца — лодка остановится или даже пойдёт назад.',
    how3: 'Старт после сигнала — флаг класса спущен. Фальстарт — вернись за линию. Верхний знак огибают, <b>оставляя его слева</b>; финиш — через линию.',
    how5: 'Вокруг лодки: <b>стрелка</b> — откуда дует ветер; <b>красное</b> — слишком остро к ветру, идти нельзя; <b>зелёные</b> метки — лучший угол на лавировке; <b>синие</b> — на попутных курсах. Ветер гуляет на десять с лишним градусов в обе стороны каждую минуту-другую: когда он <b>отходит</b>, можно идти круче, когда <b>заходит</b> — поворачивай.',
    how4: 'Правила: левый галс уступает правому, наветренная — подветренной, чисто позади — чисто впереди; у верхнего знака места не требует никто, левый галс уступает правому; у ворот — <b>зона</b> (пунктирный круг, три корпуса): если лодки связаны, когда первая в неё входит, место получает внутренняя, если не связаны — идущая впереди. Столкнулся, когда должен был уступить, или задел знак — штрафной оборот: поворот оверштаг и фордевинд. Лодка, только что получившая право дороги, сначала даёт место, а лодка с правом дороги не может резко поворачивать на ту, что уступает.',
    rotate: 'Поверните телефон горизонтально.', back: '← Назад в Sailing Certification Test',
    flagCls: 'Класс', flagP: 'Подгот.', flagX: 'Отзыв', kn: 'уз', drone: 'Дрон', helm: 'Штурвал', top: 'Сверху', tack: 'Поворот', gybe: 'Фордевинд', kite: 'Генакер', in: 'Выбрать', out: 'Травить',
    ok: 'Паруса в норме', pullIn: 'Выбери шкот', easeOut: 'Потрави шкот', irons: 'Левентик',
    startIn: 'Старт', lineStart: 'Стартовая линия', mark: 'Верхний знак', wing: 'Боковой знак', gate: 'Нижние ворота', finish: 'Финиш',
    mark1: 'Знак 1', mark2: 'Знак 2', offset: 'Отбойник',
    roundedTri: 'Знак пройден — уваливайся на галфвинд к боковому знаку', roundedWing: 'Боковой знак пройден — поворот фордевинд на бакштаг',
    roundedTrap: 'Знак 1 пройден — уваливайся на бакштаг к знаку 2', roundedMark2: 'Знак 2 пройден — уваливайся на фордевинд к воротам',
    roundedWlu: 'Знак пройден — уваливайся к отбойнику', roundedOffset: 'Отбойник пройден — уваливайся, ставь генакер', gateFinish: 'Ворота пройдены — теперь на финиш',
    seaBreeze: 'Сегодня бриз — он будет усиливаться и смещаться вправо', seaBreezeSouth: 'Сегодня бриз — он будет усиливаться и смещаться влево', thermalBreeze: 'Сегодня термический ветер — он будет усиливаться и смещаться вправо', kiteWrap: 'Генакер закрутился на повороте — его надо убрать', kiteGybed: 'Генакер переброшен', takeoff: 'Вышли на крылья!', splashdown: 'Сели в воду — разгоняйся, чтобы снова выйти на крылья',
    crashGybe: 'Самопроизвольный фордевинд! Увалился дальше фордевинда — гик перебросило', deathRoll: 'Брочинг на ветер! С генакером на «неправильном» борту — её положило и привело',
    byLee: (d) => `Увалился дальше фордевинда на ${d}° — делай фордевинд или приводись`, foot: 'Мало скорости — уваливайся на пару градусов, разгонись', waveTip: 'Волна: приводись на склон, уваливайся с гребня', ocsS: 'Фальстарт — вернись за линию',
    target: 'цель', vmg: 'VMG', line: 'линия', toLine: 'до линии', favPin: 'выгоднее у знака', favBoat: 'выгоднее у судна', square: 'линия ровная',
    sigWarn: (n) => `Предупредительный сигнал — флаг класса, ${n} мин`, sigPrep: (n, f = 'P') => `Подготовительный — ${{ P: 'флаг P', U: 'флаг U', B: 'чёрный флаг' }[f]}, ${n} мин`, sig1: (n, f = 'P') => `Одна минута — ${{ P: 'флаг P', U: 'флаг U', B: 'чёрный флаг' }[f]} спущен`, gun: 'Старт! Флаг класса спущен',
    ocs: 'Фальстарт! Флаг X — вернись за линию', cleared: 'Теперь стартуй', started: 'Отличный старт!', rounded: 'Знак пройден — уваливайся, ставь генакер',
    missedLine: 'Мимо линии — пересеки её между судейским судном и знаком', missedGate: 'Мимо ворот — вернись и пройди между двумя знаками', wrongSide: 'Знак оставляют слева — обогни его снова',
    gateMsg: 'Ворота пройдены — снова на ветер', bump: 'Столкновение!', aground: 'На мели! Уходи от берега', broach: 'Брочинг! Трави шкот', kitedown: 'Слишком остро — генакер убирают в спешке',
    heelMsg: 'Сильный крен — потрави шкот', ironsMsg: 'Левентик — уваливайся', gust: 'Порыв!', autoOff: 'Автоподбор выключен — шкот твой',
    hail10: 'Правый галс!', hail11: 'Наветренная, уходи!', hail12: 'Сзади, уходи!', hail13: 'Ты в повороте — уходи!', hail18: 'Место у знака!', hail44: 'Штрафник, уходи!',
    fouled: (w, r) => `Нарушение против ${w} (правило ${r}) — штрафной оборот: оверштаг и фордевинд`, theyFouled: (w, r) => `${w}: нарушение правила ${r}, штрафные обороты`,
    touched: 'Касание знака — штрафной оборот: оверштаг и фордевинд', penaltyDone: 'Штраф выполнен', pen: (tk, gy) => `Штраф: ${tk ? '✓' : '○'} оверштаг ${gy ? '✓' : '○'} фордевинд`,
    dirty: 'Ветровая тень', surf: 'Сёрфинг!', lift: (d) => `Ветер отошёл ${d}°`, header: (d) => `Ветер зашёл ${d}° — поворот?`,
    zIn: (n) => `Зона · связаны с ${n}, ты внутри — тебе дают место`, zOut: (n) => `Зона · связаны с ${n}, ты снаружи — дай место`,
    zAhead: (n) => `Зона · не связаны, ты впереди ${n} — тебе дают место`, zAstern: (n) => `Зона · не связаны, ты позади ${n} — держись в стороне`, tackCall: 'К повороту оверштаг… Поворот!', gybeCall: 'К повороту фордевинд… Поворот!',
    results: 'Результаты', again: 'Ещё гонку', menu: 'Меню', racing: 'в гонке…', you: 'Вы', dsq: 'DSQ',
    gfxDown: (q) => `Графика: «${q}» — для плавности`, place: (n) => `${n}-е`, finished: (n) => `Финиш: ${n}-е место!`, finishedDsq: 'Финиш без штрафа — дисквалификация (DSQ)',
    contactDsq: (a) => ({ rudder: `DSQ, правило ${a.rule}: нужно было уступить яхте ${a.who}, а руль был повёрнут только на ${a.deg}° из ${a.max}°`, late: `DSQ, правило ${a.rule}: нужно было уступить яхте ${a.who}. Руль положен до конца, но слишком поздно`, room: `DSQ, правило 14: было место уйти от яхты ${a.who}, но курс не изменён`, turned: `DSQ, правило 16: поворот на яхту ${a.who}, которая уступала`, above: `DSQ, правило 17: выше надлежащего курса, столкновение с яхтой ${a.who}` })[a.why],
    theyDsq: (a) => `${a.who}: дисквалификация, правило ${a.rule}`,
    raceWon: 'Гонка твоя!', raceLost: (w) => `Гонку выигрывает ${w}`,
    waitingHost: (n) => `${n} не на связи — ждём…`, guestGone: (n) => `${n} не на связи — лодка идёт прежним курсом; после 30 с молчания сход`,
    abandoned: 'Гонка прекращена — не засчитывается', full: 'В этой гонке уже двое', matchFail: 'Не удалось подключиться к гонке 1 на 1', tryAgain: 'Ещё раз',
    noGl: 'Браузер сейчас не запускает 3D-графику. Закрой другие вкладки и приложения или перезапусти браузер — и попробуй ещё раз.',
    glLostK: 'Картинка пропала', glLostTxt: 'Устройство забрало графику — чаще всего, когда не хватает памяти. Перезагрузи, чтобы плыть дальше на облегчённой графике.', doReload: 'Перезагрузить',
    timeOne: 'гонка 1 на 1',
    'r16.1': 'Право дороги — но дай место уступить', 'x16.1': 'Лодка с правом дороги, меняя курс, должна дать другой лодке место, чтобы уступить.',
  },
};
const urlLang = new URLSearchParams(location.search).get('lang');
const cookieLang = (document.cookie.match(/(?:^|; )lang=(en|ru)\b/) || [])[1];
const LANG = urlLang === 'ru' || urlLang === 'en' ? urlLang : cookieLang ? cookieLang
  : /^(ru|uk|be|kk)\b/i.test((TG && TG.initDataUnsafe?.user?.language_code) || navigator.language || '') ? 'ru' : 'en';
const t = (k, ...a) => { const v = T[LANG][k] ?? T.en[k] ?? k; return typeof v === 'function' ? v(...a) : v; };
document.documentElement.lang = LANG;
for (const el of document.querySelectorAll('[data-t]')) el.innerHTML = t(el.dataset.t);
const fmt = (s) => { s = Math.max(0, s); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };

// ---------- the app's light and night themes ----------
const night = () => (TG ? TG.colorScheme === 'dark' : window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
// the course map draws in the broadcast's tokens (tokens.css, scoped to .bc), read once: a canvas can't use CSS variables
const INK = mapPalette(((cs) => (k) => cs.getPropertyValue(k))(getComputedStyle(document.querySelector('.bc') || document.documentElement)));
function applyTheme() {
  document.documentElement.classList.toggle('theme-night', night());
  try { TG && TG.setHeaderColor && TG.setHeaderColor('#070d16'); } catch (e) {} // the broadcast's ground, as every page now
}
applyTheme();
if (!TG && window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

// ---------- settings ----------
const opts = { mode: 'daily', contact: 'turn', preset: 'medium', fleet: 5, length: 'short', laps: 1, autoTrim: 1, sound: 1, voice: 1, start: 1, current: 0, course: 'wl', daytime: 'any', gfx: 'auto', saver: 0, guides: 1, music: PLAYLIST, musicVol: 'normal', sea: 'normal', played: 0 };
try { Object.assign(opts, JSON.parse(localStorage.getItem('regatta') || '{}')); } catch (e) {}
delete opts.undefined; // left by an older pause menu, whose quick switches also ran the menu's choice handler
if (opts.fleetV !== 3) { opts.fleet = 5; opts.fleetV = 3; } // the default changed (10, then 7): start everyone on 5 once
if (opts.optsV !== 4) { opts.length = 'short'; opts.mode = 'daily'; opts.optsV = 4; } // a short race, today's, is the default now
if (opts.musicV !== 2) { opts.music = PLAYLIST; opts.musicV = 2; } // the playlist is the default music now: everyone hears it once, then keeps what they pick
// a first race on Auto (Home's first four races promise it): you only steer. Whoever hasn't raced yet starts there, once
if (!opts.played && opts.trimV !== 1) { opts.autoTrim = 1; opts.trimV = 1; }
delete opts.ghost; delete opts.ghostV; // the ghost of your best is gone: its setting goes with the next save
if (opts.music !== 'off' && !MUSIC_CHOICES.includes(opts.music)) opts.music = PLAYLIST; // a style that's gone (Ambient, Film, Folk): the playlist
const saveOpts = () => { try { localStorage.setItem('regatta', JSON.stringify(opts)); } catch (e) {} };
// the race's settings: the menu's, or in today's race the day's own (the same for everyone)
const DAILY_KEYS = ['preset', 'fleet', 'length', 'laps', 'start', 'current', 'course'];
// (a free race's length the venue hasn't room for: the longest it has)
const settings = () => { if (drill) return { ...opts, ...drillSettings(), length: laidLength(VENUE, drillSettings().length), daily: null }; if (opts.mode !== 'daily') return { ...opts, length: laidLength(VENUE, opts.length), daily: null }; const d = dailyRace(); return { ...opts, ...d, daily: d.day }; };
const windName = (p) => t(p);
// the yachts' names, as lib/yachts.ts has them (another class: its id)
const YACHT_NAMES = { jpk1050: ['JPK 1050', 'JPK 1050'], bavaria46: ['Bavaria 46', 'Bavaria 46'], j70: ['J/70', 'J/70'], rs21: ['RS21', 'RS21'], laser: ['Laser (ILCA)', 'Laser (ILCA)'], optimist: ['Optimist', 'Оптимист'], dragon: ['Dragon', 'Дракон'], jclass: ['J Class', 'Класс J'], ac75: ['AC75', 'AC75'] };
const yachtName = (id) => (YACHT_NAMES[id] || [id, id])[LANG === 'ru' ? 1 : 0];
const SHAPE_KEY = { wl: 'shapeWl', tri: 'shapeTri', trap: 'shapeTrap', wlu: 'shapeWlu' };
const paintOpts = () => {
  const s = settings();
  document.querySelectorAll('.choice[data-opt]').forEach((g) => {
    g.classList.toggle('locked', opts.mode === 'daily' && DAILY_KEYS.includes(g.dataset.opt));
    g.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(s[g.dataset.opt]) === b.dataset.v));
    if (g.dataset.opt === 'length') g.querySelectorAll('button').forEach((b) => { b.hidden = !lengthOffered(VENUE, b.dataset.v); });
  });
  const n = $('#dailyNote'); if (n) { n.hidden = opts.mode !== 'daily'; n.textContent = t('dailyNote', windName(s.preset), venueById(s.venue).name[LANG === 'ru' ? 1 : 0], t(SHAPE_KEY[laidShape(s.course, s.length)]), yachtName(CLS.id)); } // the shape the race is laid in (sim.js), not only the one asked for
};
// a third way to trim: the main and the jib each on their own sheet
{ const g = document.querySelector('.choice[data-opt="autoTrim"]'); if (g && !g.querySelector('[data-v="2"]')) { const b = document.createElement('button'); b.dataset.v = '2'; b.innerHTML = t('split'); g.append(b); } }
paintOpts();
for (const g of document.querySelectorAll('.choice[data-opt]')) {
  const k = g.dataset.opt;
  g.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (opts.mode === 'daily' && DAILY_KEYS.includes(k)) { Object.assign(opts, Object.fromEntries(DAILY_KEYS.map((x) => [x, settings()[x]]))); opts.yacht = CLS.id; opts.mode = 'free'; } // changing today's settings makes it a free race, in today's yacht
    opts[k] = k === 'preset' || k === 'length' || k === 'mode' || k === 'course' ? b.dataset.v : +b.dataset.v; paintOpts(); saveOpts();
    // today's race is at the day's venue, a free race where the set-up chose: another venue's land needs the page loaded again
    // …and so does another class of yacht: today's race is sailed in the day's, a free race in the one chosen (classes.js)
    if (k === 'mode' && !new URLSearchParams(location.search).get('boat') && (opts.mode === 'daily' ? dailyRace().yacht : classById(opts.yacht).id) !== CLS.id) { location.href = '/play?race=' + (opts.mode === 'daily' ? 'today' : 'free'); return; }
    if (k === 'mode' && !new URLSearchParams(location.search).get('venue') && (opts.mode === 'daily' ? dailyRace().venue : venueById(opts.venue).id) !== VENUE.id) { location.href = '/play?race=' + (opts.mode === 'daily' ? 'today' : 'free'); return; }
    if (k === 'guides') world.showGuides = !!opts.guides;
    if (k === 'autoTrim' && race && running) applyTrimMode();
    if (k === 'preset' || k === 'laps' || k === 'start' || k === 'current' || k === 'mode' || k === 'fleet' || k === 'length' || k === 'course') { if (!running) newRace(); else menuChanged = true; }
  });
}

// ---------- Telegram ----------
if (TG) {
  TG.ready(); TG.expand();
  try { TG.disableVerticalSwipes && TG.disableVerticalSwipes(); } catch (e) {}
  try { if (TG.isVersionAtLeast && TG.isVersionAtLeast('8.0') && /android|iphone|ipad/i.test(navigator.userAgent)) TG.requestFullscreen(); } catch (e) {}
  TG.onEvent && TG.onEvent('themeChanged', () => applyTheme());
  TG.BackButton.show();
  TG.BackButton.onClick(() => { if (avClose) { avClose(); return; } if (MATCH && matchUi) matchBack(); else if (running && !paused) pause(); else quit(); });
}
const haptic = (kind) => {
  if (opts.vibration === 0) return; // Settings › Vibration
  if (!TG && navigator.userActivation && !navigator.userActivation.hasBeenActive) return; // the browser refuses before the first tap
  try { if (TG && TG.HapticFeedback) kind === 'warn' ? TG.HapticFeedback.notificationOccurred('warning') : TG.HapticFeedback.impactOccurred(kind || 'light'); else navigator.vibrate && navigator.vibrate(kind === 'heavy' ? 40 : 15); } catch (e) {}
};

// ---------- sound: wind, water, flapping sails, winch, horns, voices ----------
// (audio.wake: a tap ends on touchend or click on iOS, where a touchstart doesn't count as one)
for (const e of ['pointerup', 'touchend', 'click', 'keydown']) addEventListener(e, () => audio.wake(), { capture: true, passive: true });
// the sea and the wind, as loud as Settings › Sea says (the pause menu's too)
const SEA = { loud: 1.6, normal: 1, quiet: 0.4, off: 0 };
const seaK = () => SEA[opts.sea] ?? 1;
// and the music, as loud as Settings › Music volume says (Off is under Music)
const MUSIC_VOL = { loud: 1.6, normal: 1, quiet: 0.4 };
// and each kind of sound apart, as Settings › Sound › Details has them (lib/opts.ts SOUND_PARTS): the voices (the
// skipper, the crews, the committee, the umpire), the boats (sails, winches, hulls, yours and the others'), the
// signals (horns, the start timer, the umpire's whistle) and round about (the gulls, the banner plane)
const SND = { loud: 1.6, normal: 1, quiet: 0.4, off: 0 };
const sndK = (k) => SND[opts[k]] ?? 1;
const audio = {
  ctx: null, on: !!opts.sound,
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    try {
      this.ctx = openAudio(window.AudioContext || window.webkitAudioContext);
      this.master = this.ctx.createGain(); this.master.gain.value = this.on ? 1 : 0; this.master.connect(this.ctx.destination);
      // the wind, the water, the sails, the winch, the horn (sfx.js), made from what makes the real ones
      const bus = (k) => { const g = this.ctx.createGain(); g.gain.value = sndK(k); g.connect(this.master); return g; };
      this.boat = bus('sndBoats'); this.signals = bus('sndSignals'); this.wild = bus('sndAround');
      this.sfx = createSfx(this.ctx, this.master, { boat: this.boat, signals: this.signals }); this.buf = this.sfx.white;
      // the voices (skipper, crews, committee, umpire) on a bus of their own, measured, so the music bows out under them
      // (measured before their own level, so the music bows out under a line however loud it's set)
      this.voice = this.ctx.createGain(); this.voiceLvl = this.ctx.createGain(); this.voiceLvl.gain.value = sndK('sndVoices');
      this.voice.connect(this.voiceLvl).connect(this.master);
      this.meter = this.ctx.createAnalyser(); this.meter.fftSize = 512; this.voice.connect(this.meter); this.meterBuf = new Float32Array(512);
      // a voice on board, and the VHF's speaker in the cockpit, heard on deck in the open: no studio's boom under it
      // (a man shouting has none), and the faint first reflection off the sails and the coachroof a few ms after
      const c = this.ctx; this.deck = c.createBiquadFilter(); this.deck.type = 'highpass'; this.deck.frequency.value = 110; this.deck.Q.value = 0.6;
      const ref = c.createDelay(0.05), rl = c.createBiquadFilter(), rg = c.createGain();
      ref.delayTime.value = 0.011; rl.type = 'lowpass'; rl.frequency.value = 2600; rg.gain.value = 0.16;
      this.deck.connect(this.voice); this.deck.connect(ref).connect(rl).connect(rg).connect(this.voice);
      this.music = createMusic(this.ctx, this.master); // the soundtrack (music.js), in the style Settings › Music chose
    } catch (e) { this.ctx = null; }
  },
  // the race starts on its own once the loading screen is done, not on a tap, and a browser keeps a sound made before
  // the page's first tap silent (Safari and iOS always, Chrome as a rule): the first tap or key wakes it, and any later
  // one does again if the phone has suspended it (a call, the screen locked)
  wake() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); this.music?.wake(); },
  // how loud the voices are now, 0..1 (the peak of the last ~10 ms)
  voiceLevel() { if (!this.meter) return 0; this.meter.getFloatTimeDomainData(this.meterBuf); let m = 0; for (const x of this.meterBuf) m = Math.max(m, Math.abs(x)); return m; },
  setOn(v) { this.on = v; if (this.master) this.master.gain.value = v ? 1 : 0; if (!v) { skipper.stop(); asides.stop(); committee.stop(); } },
  // each kind of sound as loud as Audio & graphics now says
  levels() { if (!this.ctx) return; this.boat.gain.value = sndK('sndBoats'); this.signals.gain.value = sndK('sndSignals'); this.wild.gain.value = sndK('sndAround'); this.voiceLvl.gain.value = sndK('sndVoices'); },
  update(P, paused) {
    if (!this.ctx || !this.sfx) return;
    const k = paused ? 0 : 1, sea = k * seaK(), now = this.ctx.currentTime;
    const dt = clamp(now - (this.lastT ?? now), 0, 0.1); this.lastT = now;
    // the wind from where it comes, as the boat's moving makes it (the apparent wind), left or right of the camera
    const th = (P.awa || 0) + (P.h || 0), cv = world.camera.getWorldDirection(this._cv || (this._cv = world.camera.position.clone())), r = Math.hypot(cv.x, cv.z) || 1;
    this.sfx.wind.update(P.aws, (Math.sin(th) * -cv.z - Math.cos(th) * cv.x) / r, sea, dt);
    // what your boat's picture is doing (yacht.js): her sails' flogging, her pitching, her trimmer at the winch
    const v = world && race ? world.boatViews[race.boats.indexOf(P)] : null, cl = v?.cloth, s = v?.sea;
    this.sfx.water.update(P.v, P.surf > 0, s ? clamp(Math.abs(s.vp) * 3, 0, 1) : 0, sea);
    // a sail flogging cracks in time with the cloth, twice a cycle (it snaps over each way), quicker the harder it blows
    const flog = cl ? Math.max(cl.flogM, cl.flogJ) : P.trim === 'irons' ? 1 : P.luff;
    this.sfx.sails(flog || 0, P.aws, k, dt);
    if (paused) return;
    // the hull slapping down onto a sea: her bow dropping fast under way
    const drop = s ? -s.vp : 0;
    if (s && P.v > 1.5 && drop > 0.1 && now - (this.slapT ?? 0) > 0.45) { this.slapT = now; this.slap(clamp((drop - 0.1) / 0.2, 0.15, 1) * sea); }
    // the winch's pawl clicking away while the jib trimmer grinds the new sheet in after a tack
    if (v?.grinding && now - (this.grindT ?? 0) > 0.085) { this.grindT = now + Math.random() * 0.03; this.click(); }
  },
  slap(vol) { if (this.sfx) this.sfx.slap(vol); }, // the hull slapping onto a sea
  collide(hard) { if (this.sfx) this.sfx.collide(hard); }, // two hulls meeting
  click() { if (this.sfx) this.sfx.click(); }, // a winch pawl
  // the sheet eased: the rope's rasp as it runs out round the drum, not oftener than every 70 ms
  ease() { if (!this.sfx) return; const n = this.ctx.currentTime; if (n - (this.easeT ?? 0) > 0.07) { this.easeT = n; this.sfx.ease(); } },
  tone(freq, dur, type = 'sine', vol = 0.25) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), n = this.ctx.currentTime;
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, n); g.gain.linearRampToValueAtTime(vol, n + 0.02); g.gain.setValueAtTime(vol, n + dur - 0.05); g.gain.linearRampToValueAtTime(0, n + dur);
    o.connect(g).connect(this.master); o.start(n); o.stop(n + dur + 0.02);
  },
  // the committee boat's horn, from where she lies (at: the line's committee end, or the finish boat), heard late and
  // dulled by the distance; `when`: seconds from now (the second of a general recall's two)
  horn(long, at, when = 0) {
    if (!this.sfx) return;
    let d = 120, pan = 0;
    try { const c = race.course, b = at || c.committee; if (b) ({ d, pan } = crews.place(b)); } catch (e) {}
    this.sfx.horn(long, d, pan, when);
  },
  // a file of recorded lines, decoded into the audio context: resolves to its buffer, or null if it can't be had
  fetch(file) {
    return fetch(fileAt(file)).then((r) => r.arrayBuffer())
      .then((b) => new Promise((res, rej) => this.ctx.decodeAudioData(b, res, rej)));
  },
};

// ---------- the soundtrack's cues (music.js plays it): the race read four times a second, the build to the gun ----------
const score = {
  t: 0, place: 0, cand: 0, candT: 0, trend: 0, trendUntil: 0, riser: false, breath: false,
  reset() { this.t = 0; this.place = 0; this.cand = 0; this.trend = 0; this.trendUntil = 0; this.riser = this.breath = false; if (audio.music) audio.music.reset(); },
  // Settings › Music: the playlist, one of the tracks, or off (with Sound off the playlist doesn't stream what nobody hears)
  style() { const m = audio.music; if (!m) return; m.pause(paused || !running); m.setStyle(MUSIC_CHOICES.includes(opts.music) && (opts.sound || opts.music !== PLAYLIST) ? opts.music : null); m.setVolume(0.5 * (MUSIC_VOL[opts.musicVol] ?? 1)); },
  sting(k) { if (audio.music) audio.music.sting(k); },
  update(P, dt) {
    const m = audio.music; if (!m) return;
    m.pause(paused || !running); m.voices(audio.voiceLevel()); m.update();
    if (!running || paused || !m.style) return;
    const c = race.clock;
    // the last eight seconds: a sweep climbing to the gun, and a breath of silence just before it (in seconds as heard)
    if (c < -9) this.riser = this.breath = false; // again after a general recall
    if (c < 0 && c > -8 && !this.riser) { this.riser = true; m.riser(-c / timeScale - 0.1); }
    if (c < 0 && c > -0.5 * timeScale && !this.breath) { this.breath = true; m.breath(-c / timeScale); }
    if ((this.t -= dt) > 0) return;
    this.t = 0.25;
    // a place gained or lost, once it has held two seconds (not in the shuffle off the line)
    const place = race.standings().indexOf(P) + 1;
    if (c < 30 || P.done) { this.place = place; this.cand = 0; }
    else if (place === this.place) this.cand = 0;
    else if (this.cand !== place) { this.cand = place; this.candT = c; }
    else if (c - this.candT > 2) { const up = place < this.place; this.place = place; this.cand = 0; this.trend = up ? 1 : -1; this.trendUntil = c + 10; m.sting(up ? 'gain' : 'loss'); }
    if (c > this.trendUntil) this.trend = 0;
    const kind = race.course.legs[P.leg], a = Math.abs(P.twa) / D2R;
    let near = 1e9, zone = false;
    for (const b of race.boats) if (b !== P && !b.done) near = Math.min(near, Math.hypot(b.x - P.x, b.z - P.z));
    for (const st of race.zoneStates.values()) { if (st.p !== P && st.q !== P) continue; const o = st.p === P ? st.q : st.p; if (Math.hypot(o.x - P.x, o.z - P.z) < 60) zone = true; }
    m.set(direct({
      clock: c, done: P.done, place: P.place ?? place, fleet: race.boats.length, dsq: !!(P.dsq || P.ufd || P.bfd), ocs: !!P.ocs, pen: !!P.pen,
      zone, near, toMark: race.distToNext(P), markLeg: kind === 'mark' || kind === 'wing' || kind === 'gate', lastLeg: kind === 'finish',
      downwind: a > 110 || !!P.kite, trend: this.trend,
    }));
  },
};

// ---------- the lines the browser once spoke, and the race committee and the umpire ----------
// Recorded with Piper, a neural text-to-speech, and shaped for where each is heard from (scripts/voices.py), one file a
// language, calls-<lang>.mp3, loaded with the race. In Russian: the hails, by rule, and the call for a tack or a gybe,
// a man's (h…) and a woman's (g…); in English the one hail skipper-en.mp3 hasn't got. In both, the race committee on
// the VHF (c…): the signals, a clean start or a recall, over early and back, the forecast, the finish; and the umpire
// from the RIB (u…), a whistle and a word: a penalty, a mark touched, no penalty, a penalty on the other boat.
const CALLS = { ru: {
  // where each line sits in calls-ru.mp3: [start, length] in seconds
  h10: [0.5, 0.813], // Правый галс!
  h11: [1.813, 1.242], // Наветренная, уходи!
  h12: [3.555, 1.033], // Сзади, уходи!
  h13: [5.088, 1.231], // Ты в повороте! Уходи!
  h15: [6.819, 1.161], // Дай место уступить!
  h16: [8.48, 1.277], // Не поворачивай на меня!
  h17: [10.257, 1.091], // Надлежащий курс!
  h18: [11.848, 0.975], // Место у знака!
  h18_3: [13.324, 1.37], // Ты повернул в зоне! Уходи!
  h18_4: [15.194, 1.683], // Фордевинд! Не шире, чем нужно!
  h19: [17.377, 1.637], // Место у судейского судна!
  h20: [19.514, 1.138], // Место для поворота!
  h44: [21.152, 1.08], // Штрафник, уходи!
  g10: [22.732, 0.929], // Правый галс!
  g11: [24.16, 1.591], // Наветренная, уходи!
  g12: [26.251, 1.37], // Сзади, уходи!
  g13: [28.121, 1.567], // Ты в повороте! Уходи!
  g15: [30.188, 1.149], // Дай место уступить!
  g16: [31.838, 1.207], // Не поворачивай на меня!
  g17: [33.545, 1.068], // Надлежащий курс!
  g18: [35.113, 0.987], // Место у знака!
  g18_3: [36.6, 2.101], // Ты повернул в зоне! Уходи!
  g18_4: [39.201, 2.171], // Фордевинд! Не шире, чем нужно!
  g19: [41.872, 1.567], // Место у судейского судна!
  g20: [43.94, 1.207], // Место для поворота!
  g44: [45.647, 1.73], // Штрафник, уходи!
  hTack: [47.877, 2.238], // К повороту оверштаг! Поворот!
  hGybe: [50.615, 2.226], // К повороту фордевинд! Поворот!
  gTack: [53.341, 2.517], // К повороту оверштаг! Поворот!
  gGybe: [56.358, 2.25], // К повороту фордевинд! Поворот!
  cWarn5: [59.107, 5.1], // Всем лодкам, на связи судейское судно. Предупредительный сигнал. Пять минут.
  cWarn3: [64.707, 5.286], // Всем лодкам, на связи судейское судно. Предупредительный сигнал. Три минуты.
  cPrepP: [70.493, 3.012], // Подготовительный сигнал. Поднят флаг Папа.
  cPrepU: [74.005, 3.175], // Подготовительный сигнал. Поднят флаг Юниформ.
  cPrepB: [77.68, 3.105], // Подготовительный сигнал. Поднят чёрный флаг.
  cFlagU: [81.285, 2.246], // Внимание, старт под флагом Юниформ.
  cFlagB: [84.031, 2.13], // Внимание, старт под чёрным флагом.
  c1: [86.661, 1.572], // Одна минута до старта.
  cClear: [88.733, 2.461], // Старт чистый. Удачной гонки!
  cRecall: [91.694, 4.47], // Индивидуальный отзыв. Флаг Икс-рей. Лодкам за линией вернуться.
  cGenRecall: [96.664, 3.833], // Общий отзыв! Общий отзыв. Старт будет повторён.
  cBack: [100.996, 2.594], // Вы вернулись. Можно стартовать.
  cOut: [104.09, 3.262], // За линией в последнюю минуту. Вы дисквалифицированы.
  cBreeze: [107.853, 4.028], // Прогноз на сегодня: бриз. Будет усиливаться и отходить вправо.
  cFin1: [112.381, 3.108], // Финиш! Первое место. Поздравляем!
  cFin: [115.989, 2.339], // Финиш. Хорошая гонка!
  cFinDsq: [118.827, 3.688], // Финиш. Штраф не выполнен. Дисквалификация.
  cFinOut: [123.015, 2.989], // Финиш. Дисквалификация на старте.
  uPen: [126.504, 2.731], // Штраф! Оборот: оверштаг и фордевинд.
  uMark: [129.736, 2.627], // Касание знака! Штрафной оборот.
  uNone: [132.863, 0.777], // Штрафа нет!
  uThem: [134.14, 1.429], // Штраф другой лодке!
}, en: {
  // where each line sits in calls-en.mp3: [start, length] in seconds
  hGybeWide: [0.5, 1.73], // Gybe, no wider than you need!
  gGybeWide: [2.73, 1.474], // Gybe, no wider than you need!
  cWarn5: [4.704, 3.951], // Race committee, all boats. Warning signal. Five minutes.
  cWarn3: [9.155, 3.974], // Race committee, all boats. Warning signal. Three minutes.
  cPrepP: [13.629, 2.42], // Preparatory signal. P flag is up.
  cPrepU: [16.549, 2.641], // Preparatory signal. Uniform flag is up.
  cPrepB: [19.689, 3.291], // Preparatory signal. Black flag is up.
  cFlagU: [23.48, 2.466], // Be advised, this start is under the Uniform flag.
  cFlagB: [26.447, 2.606], // Be advised, this start is under the black flag.
  c1: [29.552, 1.456], // One minute to the start.
  cClear: [31.509, 2.507], // All clear. Good start, everyone.
  cRecall: [34.516, 4.551], // Individual recall. X-ray flag. Boats over, return to the line.
  cGenRecall: [39.567, 3.984], // General recall! General recall. The start will be repeated.
  cBack: [44.051, 1.874], // You're back. Clear to start.
  cOut: [46.425, 2.786], // Over in the last minute. You are disqualified.
  cBreeze: [49.711, 3.882], // Today's forecast: a sea breeze, building and veering right through the race.
  cFin1: [54.093, 2.655], // Finish! First place. Well sailed!
  cFin: [57.248, 1.886], // Finished. Well sailed.
  cFinDsq: [59.634, 3.514], // Finished. No penalty taken. Disqualified.
  cFinOut: [63.648, 2.478], // Finished. Disqualified at the start.
  uPen: [66.626, 3.145], // Penalty! Take your turn: tack and gybe.
  uMark: [70.271, 2.289], // Mark touch! Penalty turn.
  uNone: [73.06, 1.053], // No penalty!
  uThem: [74.613, 1.781], // Penalty on the other boat!
} };
const calls = {
  clips: CALLS[LANG] || {}, buf: null, loading: false,
  load() {
    if (!CALLS[LANG] || this.buf || this.loading || !audio.ctx) return;
    this.loading = true;
    audio.fetch(`calls-${LANG}.mp3`).then((b) => { this.buf = b; }, () => { this.loading = false; });
  },
};
// a woman's line, in a crew's voice of two: g and then a capital or a digit (gStarboard, g10, gTack)
const herLine = (k) => /^g[A-Z0-9]/.test(k);
// where line k is to be had, in our skipper's recordings or in calls-<lang>.mp3: { buf, at, len, own }, or null.
// `own` is a voice that isn't our skipper's: another boat shifts it half as far from its pitch (crews.say).
function lineOf(k) {
  if (skipper.buf && skipper.clips[k]) return { buf: skipper.buf, at: skipper.clips[k][0], len: skipper.clips[k][1], own: false };
  if (calls.buf && calls.clips[k]) return { buf: calls.buf, at: calls.clips[k][0], len: calls.clips[k][1], own: true };
  return null;
}

// ---------- the skipper: recorded voices on board ----------
// A crew's racing calls: in Russian a man's, recorded (the hails, protest, bear away, head up, trim and ease, the call
// for a tack or a gybe, clear at a mark, the finish); in English a man's and a woman's (the hails, protest, bear away,
// and the count down to the gun). Each language's lines are in one file, skipper-<lang>.mp3,
// loaded once the race starts. He says one line at a time, and not every time he could: half the time he lets a moment
// go, and after a line he keeps quiet for twenty seconds or more. He doesn't repeat a line within a few minutes, and of
// the lines that fit he picks at random, likelier the longer since he said it; a call that must be heard now (a hail,
// the count) cuts in.
const VOICES = { ru: {
  // where each line sits in skipper-ru.mp3: [start, length] in seconds. The man's hails in calls-ru.mp3 are Piper's;
  // these are a real voice.
  clips: {
    starboard: [0.626, 0.98], port: [2.206, 1.015], keepClear: [3.821, 0.83], // Правый галс! Левый галс! Дорогу!
    bearAway: [5.251, 0.655], leeward: [6.506, 0.85], // Увались! Подветренный!
    headUp1: [7.956, 0.815], headUp2: [9.371, 0.855], // Приводись! (twice)
    turn: [10.826, 0.625], tackGo: [12.051, 1.36], gybeGo: [14.011, 1.26], // Поворот! Поворот оверштаг! Поворот фордевинд!
    trim: [15.871, 0.75], easeIt: [17.221, 0.705], // Набивай! Потрави!
    proper: [18.526, 1.835], noBlock: [20.961, 0.895], room: [22.456, 1.24], // Увались на надлежащий курс! Не мешай! Место у знака!
    protest: [24.296, 0.745], clear: [25.641, 0.63], finish: [26.871, 0.635], // Протест! Чисто! Финиш!
  },
  // the lines for each situation
  pools: {
    pull: ['trim'], ease: ['easeIt'], heel: ['easeIt'], // the sheet left out, or in too hard; heeled over
    headUp: ['headUp1', 'headUp2'], // well by the lee
    bearAway: ['bearAway'], irons: ['bearAway'], foot: ['bearAway'], // the windward mark rounded; in irons; pinching on the beat
    protest: ['protest'], // a foul, ours or theirs
    clearAhead: ['clear'], clearAstern: ['clear'], // at the zone of a mark, not overlapped
    finish: ['finish'], // across the finishing line
    // the hails by rule: the man's recorded above where he has one that fits, else his in calls-ru.mp3 (h…); the
    // woman's (g…) in calls-ru.mp3
    ...Object.fromEntries(Object.entries({
      10: ['starboard', 'port'], 11: ['keepClear', 'leeward'], 12: ['keepClear'], 13: ['keepClear'], 15: ['keepClear'],
      16: ['noBlock'], 17: ['proper'], 18: ['room'], 18.3: ['keepClear'], 18.4: ['h18_4'], 19: ['h19'], 20: ['h20'], 44: ['keepClear'],
    }).map(([r, his]) => ['hail' + r, [...his, 'g' + r.replace('.', '_')]])),
    tackCall: ['tackGo', 'turn', 'gTack'], gybeCall: ['gybeGo', 'turn', 'gGybe'],
  },
}, en: {
  // a crew's racing calls in skipper-en.mp3, a man's and a woman's (g…), and the count to the gun: [start, length] in seconds
  clips: {
    starboard: [0.6, 0.744], // Starboard!
    keepClear: [1.944, 0.737], // Keep clear!
    port: [3.28, 2.301], // You're on port! We're on starboard!
    hold: [6.181, 1.038], // Hold your course!
    room: [7.819, 0.967], // Room at the mark!
    protest: [9.386, 0.785], // Protest!
    bearAway: [10.771, 0.852], // Bear away!
    go: [12.223, 1.107], // Go, go, go!
    n10: [13.929, 0.487], n9: [15.016, 0.565], n8: [16.182, 0.438], n7: [17.22, 0.568], n6: [18.388, 0.667], // Ten… six
    n5: [19.655, 0.506], n4: [20.76, 0.539], n3: [21.899, 0.545], n2: [23.044, 0.508], n1: [24.152, 0.506], // five… one
    start: [25.258, 2.019], // Start, start, start!
    g10: [27.877, 0.558], g9: [29.035, 0.656], g8: [30.291, 0.47], g7: [31.361, 0.686], g6: [32.647, 0.651], // her count
    g5: [33.898, 0.618], g4: [35.116, 0.599], g3: [36.315, 0.581], g2: [37.495, 0.512], g1: [38.607, 0.559],
    gStart: [39.766, 2.054], // Start, start, start!
    gStarboard: [42.42, 0.847], gKeepClear: [43.867, 0.806], gHold: [45.273, 1.005], // Starboard! Keep clear! Hold your course!
    gRoom: [46.878, 0.62], gMarkRoom: [48.098, 0.788], gRoomTack: [49.485, 0.963], // Room! Mark room! Room to tack!
    gProtest: [51.048, 0.827], gOverlap: [52.475, 0.696], gClearAhead: [53.771, 0.818], gClearAstern: [55.189, 0.932],
    gHeads: [56.721, 0.557], gTacking: [57.878, 0.775], gJibe: [59.253, 0.635], // Heads! Tacking! Jibe!
    gTrim: [60.487, 0.621], gEase: [61.708, 0.625], gBearAway: [62.933, 0.82], gHeadUp: [64.353, 0.598], // Trim! Ease! Bear away! Head up!
  },
  // the hails, by rule (18.4 is in calls-en.mp3), and the other calls
  pools: {
    'hail18.4': ['hGybeWide', 'gGybeWide'],
    hail10: ['starboard', 'port', 'gStarboard'], hail11: ['keepClear', 'gKeepClear'], hail12: ['keepClear', 'gKeepClear'],
    hail13: ['keepClear', 'gKeepClear'], hail15: ['keepClear', 'gKeepClear'], hail44: ['keepClear', 'gKeepClear'],
    'hail18.3': ['keepClear', 'gKeepClear'], hail16: ['hold', 'gHold'], hail17: ['hold', 'gHold'],
    hail18: ['room', 'gMarkRoom'], hail19: ['gRoom'], hail20: ['gRoomTack'],
    protest: ['protest', 'gProtest'], // a foul, ours or theirs
    bearAway: ['bearAway', 'gBearAway'], irons: ['bearAway', 'gBearAway'], // the windward mark rounded; in irons
    foot: ['gBearAway', 'bearAway'], // slow on the beat, pinching: foot off
    headUp: ['gHeadUp'], // well by the lee
    tackCall: ['gTacking'], gybeCall: ['gJibe', 'gHeads'], heads: ['gHeads'], // a tack, a gybe; a crash gybe
    pull: ['gTrim'], ease: ['gEase'], heel: ['gEase'], // the sheet left out, or in too hard; heeled over
    overlap: ['gOverlap'], clearAhead: ['gClearAhead'], clearAstern: ['gClearAstern'], // at the zone of a mark
    go: ['go'], // back below the line after being over early: now start
  },
} };
const skipper = {
  ...VOICES[LANG],
  buf: null, loading: false, src: null, speakTill: 0, busyTill: 0, last: {}, letGo: {},
  TALK: 0.5, // how often he says something when he could
  REST: 180, // seconds before he says a line again
  load() {
    if (!VOICES[LANG] || this.buf || this.loading || !audio.ctx) return;
    this.loading = true;
    fetch(fileAt(`skipper-${LANG}.mp3`)).then((r) => r.arrayBuffer())
      .then((b) => new Promise((res, rej) => audio.ctx.decodeAudioData(b, res, rej)))
      .then((b) => { this.buf = b; }, () => { this.loading = false; });
  },
  // a line for the situation; false when he keeps quiet (no sound, mid-line, a hail being spoken, said it lately).
  // A moment that won't come again (a signal, the start) needn't wait for his breath, only for the line he's saying.
  // Whether he speaks is rolled once for a moment: a situation he lets go (one the game asks about every frame, a sheet
  // left wrong, heeled over) isn't asked again for a while.
  shout(kind, chance = 1, now_ = false) {
    if (!this.buf || !audio.on || !opts.voice || paused || audio.ctx.state !== 'running') return false;
    const ctx = audio.ctx, now = ctx.currentTime;
    if (now < (now_ ? this.speakTill : this.busyTill) || now < (this.letGo[kind] ?? 0) || committee.busy()) return false;
    const fresh = (this.pools[kind] || []).filter((k) => !(now - this.last[k] < this.REST) && lineOf(k));
    if (!fresh.length) return false;
    if (Math.random() > chance * this.TALK) { this.letGo[kind] = now + 10 + Math.random() * 15; return false; }
    const k = this.choose(fresh, now), len = this.play(k);
    this.last[k] = now; this.speakTill = now + len + 0.4; this.busyTill = now + len + 20 + Math.random() * 20;
    return true;
  },
  // one of the lines at random, a line he's never said or not said for long likelier than one he said lately
  choose(list, now) {
    const w = list.map((k) => (this.last[k] === undefined ? 1 : Math.min(1, 0.15 + (now - this.last[k]) / 600)));
    let r = Math.random() * w.reduce((a, b) => a + b, 0), i = 0;
    while (i < list.length - 1 && (r -= w[i]) > 0) i++;
    return list[i];
  },
  // a call that has to be heard now (a hail, the count to the gun): no breath, no minute's rest, and it cuts in on a line.
  // Ours is said in the race's crew's voice where the call has his and hers. `must`: a call heard with the Voice switch
  // off too (a hail, the call for a tack or a gybe), as the browser once spoke them.
  cue(kind, from, must) {
    const all = this.pools[kind] || (this.clips[kind] || calls.clips[kind] ? [kind] : null);
    if (!all || !audio.on || !(opts.voice || must) || paused || !audio.ctx || audio.ctx.state !== 'running') return false;
    let list = all.filter((k) => lineOf(k)); if (!list.length) return false;
    if (!from) { const mine = list.filter((k) => herLine(k) === (this.crew === 'g')); if (mine.length) list = mine; }
    const now = audio.ctx.currentTime, k = from ? crews.pick(from, list) : this.choose(list, now), len = this.play(k, from);
    if (!from) this.last[k] = now;
    this.speakTill = now + len + 0.2; this.busyTill = Math.max(this.busyTill, now + len + 2);
    return true;
  },
  // the clips have silence round them in the file, and some decoders start an MP3 a few hundredths of a second late:
  // play a little either side, so a line never loses its first or last sound
  play(k, from) { // from: another boat, whose call comes from where she is, in her skipper's own voice (crews.say)
    if (from) { const r = crews.say(from, k, 0.9, true); this.stop(); this.src = r.src; return r.len; }
    const ctx = audio.ctx, { buf, at, len } = lineOf(k), s = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = 0.9;
    s.buffer = buf; s.connect(g).connect(audio.deck); s.start(ctx.currentTime, Math.max(0, at - 0.03), len + 0.09);
    this.stop(); this.src = s;
    return len;
  },
  stop() { try { this.src && this.src.stop(); } catch (e) {} this.src = null; },
  // the start signals and crossing the line, from the race's messages. His word on a signal waits for the committee's
  // on the radio (later).
  signal(key, ocs) {
    if (key === 'gun') { if (!ocs) this.cue(this.crew === 'g' ? 'gStart' : 'start'); return; }
    const k = { sigWarn: 'plan', sigPrep: 'flag', sig1: 'minute' }[key]; if (k) this.later(k);
  },
  // a line for a moment, said once the radio and he are quiet, or let go if that's not within `wait` seconds
  pend: null,
  later(kind, wait = 9) { if (audio.ctx) this.pend = { kind, until: audio.ctx.currentTime + wait }; },
  tick() {
    const p = this.pend; if (!p || !audio.ctx) return;
    const now = audio.ctx.currentTime;
    if (now > p.until) { this.pend = null; return; }
    if (now < this.speakTill || committee.busy()) return;
    this.pend = null; this.shout(p.kind, 1, true);
  },
  // the count to the gun, in one voice all the way: in English the race's crew is his or hers, picked at the start
  count(n) { return this.cue(this.crew === 'g' ? 'g' + n : 'n' + n); },
  // a mark's zone, called once as it's reached: overlapped, or clear ahead or astern
  zones: new WeakSet(),
  zone(st, mine) { if (this.zones.has(st)) return; this.zones.add(st); this.cue(st.overlapped ? 'overlap' : mine ? 'clearAhead' : 'clearAstern'); },
  started(c) { this.shout(c < 3 ? 'ready' : c > 10 ? 'late' : 'clean', 1, true); },
  // what he watches for himself, every frame: a sheet left wrong, a sheet fiddled with, a boat stopped after the gun,
  // a boat too close, the line far off as the gun nears
  w: null,
  crew: 'm',
  reset() { this.stop(); this.pend = null; this.crew = Math.random() < 0.5 ? 'm' : 'g'; this.w ={ trim: '', t: 0, sheet: 0, dir: 0, rev: [], slowT: 0, nearT: 0 }; },
  watch(P, dt) {
    this.tick();
    const w = this.w, c = race.clock;
    if (!this.buf || !w || P.done || P.pen || P.auto) return;
    // the sheet: pull in or ease out for three seconds straight
    const wrong = c > 5 && !P.autoTrim && (P.trim === 'in' || P.trim === 'out');
    w.t = wrong && P.trim === w.trim ? w.t + dt : 0; w.trim = P.trim;
    if (w.t > 3 && this.shout(P.trim === 'in' ? 'pull' : 'ease')) w.t = 0;
    // fiddling: six changes of direction on the sheet within four seconds
    const ds = P.sheet - w.sheet; w.sheet = P.sheet;
    if (!P.autoTrim && Math.abs(ds) > 0.004 && Math.sign(ds) !== w.dir) { w.dir = Math.sign(ds); w.rev.push(c); }
    while (w.rev.length && c - w.rev[0] > 4) w.rev.shift();
    if (w.rev.length >= 6 && this.shout('fiddle')) w.rev.length = 0;
    // after the gun, all but stopped for four seconds
    w.slowT = c > 3 && P.v / KN < 1.5 ? w.slowT + dt : 0;
    if (w.slowT > 4 && this.shout('slow')) w.slowT = 0;
    if (P.heel > 33) this.shout('heel');
    if (P.byLee > 8) this.shout('headUp');
    // another boat within a hull length and a half, not touching, for two seconds
    let near = 1e9; for (const b of race.boats) if (b !== P && !b.done) near = Math.min(near, Math.hypot(b.x - P.x, b.z - P.z));
    w.nearT = near < HULL * 1.4 && near > HULL * 0.5 ? w.nearT + dt : 0;
    if (w.nearT > 2 && this.shout('distance')) w.nearT = 0;
    // half a minute to the gun and still far from the line
    if (c > -30 && c < -10 && P.leg === 0 && -race.lineInfo(P).d > 80) this.shout('where');
  },
};

// ---------- the other crews: what you hear of a boat when you sail close to her ----------
// Within about seventy metres: her sails flogging and her winches in a tack or a gybe, her bow wave and wash, and her
// crew's calls in the game's language (under the Voice switch), in the voices of skipper-<lang>.mp3. Each comes from
// where she is (left or right of where the camera looks), quieter and duller the further off she is.
const crews = {
  R: 70, // metres: out of earshot beyond
  calls: {
    ru: { tacking: ['tackGo', 'turn'], gybing: ['gybeGo', 'turn'], tacked: ['trim'], broach: ['easeIt'], kitedown: ['easeIt'] },
    en: { tacking: ['gTacking'], gybing: ['gJibe', 'gHeads'], tacked: ['gTrim'], broach: ['gEase'], crashGybe: ['gHeads'], deathRoll: ['gHeads'], kiteWrap: ['gHeads'], kitedown: ['gEase'] },
  },
  last: new WeakMap(), talkTill: 0, wash: null,
  // their own voice where there is one, by language: { file, clips: { line: [start, length] in seconds } }. None now:
  // they speak in ours, each at a pitch of her own
  own: {},
  buf: null, loading: false,
  load() {
    const o = this.own[LANG]; if (!o || this.buf || this.loading || !audio.ctx) return;
    this.loading = true;
    fetch(fileAt(o.file)).then((r) => r.arrayBuffer())
      .then((b) => new Promise((res, rej) => audio.ctx.decodeAudioData(b, res, rej)))
      .then((b) => { this.buf = b; }, () => { this.loading = false; });
  },
  // where line k is to be had: { buf, at, len, own } in their own voice if it's loaded, else in ours or calls-<lang>.mp3
  line(k) {
    const c = this.buf && this.own[LANG].clips[k];
    return c ? { buf: this.buf, at: c[0], len: c[1], own: true } : lineOf(k);
  },
  // a boat as heard from ours: near 1 alongside to 0 out of earshot, pan −1 left to 1 right of the camera's view
  place(b) {
    const P = race.player, dx = b.x - P.x, dz = b.z - P.z, d = Math.hypot(dx, dz);
    const v = world.camera.getWorldDirection(this._v || (this._v = world.camera.position.clone())), r = Math.hypot(v.x, v.z) || 1;
    return { d, near: clamp(1 - d / this.R, 0, 1), pan: d < 1 ? 0 : clamp((dx * -v.z + dz * v.x) / r / d, -1, 1) };
  },
  // a way into the master: a gain, then a stereo panner where the browser has one
  out(gain, pan, to = audio.master) { // to audio.voice for a line spoken, so the music bows out under it
    const ctx = audio.ctx, g = ctx.createGain(); g.gain.value = gain;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan * 0.85; g.connect(p).connect(to); } else g.connect(to);
    return g;
  },
  // one of her events (sim.js): the sound of it, and her crew's call
  hear(b, e) {
    if (!audio.ctx || !audio.on || paused || audio.ctx.state !== 'running') return;
    const { d, near, pan } = this.place(b); if (near <= 0) return;
    const v = near * near, ctx = audio.ctx, now = ctx.currentTime;
    if (e === 'tacking' || e === 'gybing') { this.flog(v, pan, 1.6, d / 343); this.winch(v, pan, 1.5 + d / 343); }
    const list = (this.calls[LANG] || {})[e];
    if (!list || !(this.buf || skipper.buf) || !opts.voice || now < this.talkTill || now < skipper.speakTill || committee.busy() || now - (this.last.get(b) ?? -1e9) < 10) return;
    const { len } = this.say(b, this.pick(b, list), 0.8 * Math.max(v, 0.08));
    this.last.set(b, now); this.talkTill = now + len + 1.5;
  },
  // Each other boat's skipper has a voice of their own: the same recordings, played lower and slower or higher and
  // quicker (never at our own pitch), darker or brighter; in Russian the man of skipper-ru.mp3 (the woman's hails in
  // calls-ru.mp3); in English the man or the woman of skipper-en.mp3 at her helm. Her hails in calls-<lang>.mp3
  // are her crew's, his or hers, shifted half as far too.
  voices: new WeakMap(),
  RATES: [0.84, 1.12, 0.9, 1.17, 0.8, 1.07, 0.94, 1.14, 0.87, 1.1],
  voice(b) {
    let v = this.voices.get(b);
    if (!v) {
      const n = Math.max(0, race.boats.indexOf(b)), rate = this.RATES[n % this.RATES.length];
      v = { n, rate, tone: [-5, 4, -2, 6, -6, 2][n % 6], woman: n % 2 === 1 };
      this.voices.set(b, v);
    }
    return v;
  },
  // a line from the list in her voice: his or hers where the list has both (the woman's clips are the g… ones)
  pick(b, list) {
    const w = this.voice(b).woman, mine = list.filter((k) => herLine(k) === w);
    const from = mine.length ? mine : list;
    return from[Math.floor(Math.random() * from.length)];
  },
  // play line k as boat b's skipper says it, from where she is: { src, len } (len in seconds as heard)
  // Heard across the water as a voice is: late by the distance (a sixth of a second at 60 m), carried to you by a
  // wind blowing from her to you and blown away by one blowing from you to her (louder and clearer, or fainter and
  // duller), and echoed back off the land the more the further she is.
  say(b, k, gain, hail) {
    const ctx = audio.ctx, ln = this.line(k), v = this.voice(b), { d, near, pan } = this.place(b), P = race.player;
    const { at, len } = ln, rate = ln.own ? 1 + (v.rate - 1) / 2 : v.rate;
    const carry = d > 1 ? clamp(((P.x - b.x) * -Math.sin(P.wdir || 0) + (P.z - b.z) * Math.cos(P.wdir || 0)) / d, -1, 1) * Math.min(1, (P.tws || 0) / 14) : 0;
    const s = ctx.createBufferSource(), sh = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter();
    s.buffer = ln.buf; s.playbackRate.value = rate;
    sh.type = 'highshelf'; sh.frequency.value = 2200; sh.gain.value = v.tone;
    lp.type = 'lowpass'; lp.frequency.value = ((hail ? 3000 : 1500) + 6000 * near) * (1 + 0.3 * carry); // across the water a voice loses its top; a hail is shouted
    const o = this.out(gain * (1 + 0.4 * carry), pan * (hail ? 0.7 : 1), audio.voice);
    s.connect(sh).connect(lp).connect(o); audio.sfx.send(lp, gain * (0.12 + 0.3 * (1 - near)));
    const late = d / 343;
    s.start(ctx.currentTime + late, Math.max(0, at - 0.03), len + 0.09); // the duration is the file's, whatever the rate
    return { src: s, len: len / rate + late };
  },
  // sails flogging through the wind: noise in cracks, dying away
  flog(v, pan, dur, late = 0) {
    if (v < 0.01) return;
    const n = audio.ctx.currentTime + 0.15 + late, top = 0.75 * v;
    for (let t = 0; t < dur; t += 0.13 + Math.random() * 0.12) audio.sfx.crack(top * (1 - t / dur) * (0.5 + Math.random() * 0.5), pan * 0.85, audio.boat, n + t);
  },
  // the new sheet ground in on a winch: a run of pawl clicks
  winch(v, pan, delay) {
    if (v < 0.02) return;
    for (let i = 0, t = audio.ctx.currentTime + delay; i < 9; i++, t += 0.08 + Math.random() * 0.04) audio.sfx.click(v, pan * 0.85, audio.boat, t);
  },
  // every frame: the nearest boat's bow wave and wash, while she's within forty metres
  update(P, still) {
    if (!audio.ctx) return;
    if (!this.wash) {
      const ctx = audio.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      s.buffer = audio.sfx.pink; s.loop = true; f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.7; g.gain.value = 0;
      s.connect(f).connect(g); if (p) g.connect(p).connect(audio.boat); else g.connect(audio.boat); s.start(0, Math.random() * 3);
      this.wash = { g, p };
    }
    if (audio.ctx.currentTime - (this.washT ?? -1) < AUDIO_TICK) return;
    this.washT = audio.ctx.currentTime;
    let best = null, bd = 40;
    if (!still) for (const b of race.boats) if (b !== P) { const d = Math.hypot(b.x - P.x, b.z - P.z); if (d < bd) { bd = d; best = b; } }
    const ctx = audio.ctx, k = best ? (1 - bd / 40) ** 2 * Math.min(1, best.v / 5) * 0.3 : 0;
    this.wash.g.gain.setTargetAtTime(k, ctx.currentTime, 0.3);
    if (best && this.wash.p) this.wash.p.pan.setTargetAtTime(this.place(best).pan * 0.85, ctx.currentTime, 0.2);
  },
};

// ---------- the banner plane's engine ----------
// A flat-four at cruise and a two-blade prop, both near 80 Hz: a buzzing sawtooth with a throb under it and the hiss of
// the propwash, louder and brighter the nearer she is, its pitch up as she comes and down as she goes (Doppler), and
// panned to where she is in the picture. Silent while paused or behind the menu; under Sound like everything else.
const engine = {
  build() {
    const ctx = audio.ctx, o = ctx.createOscillator(), sub = ctx.createOscillator(), subG = ctx.createGain();
    const thr = ctx.createOscillator(), thrG = ctx.createGain(), am = ctx.createGain(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; sub.type = 'square'; subG.gain.value = 0.35; thr.frequency.value = 6.5; thrG.gain.value = 0.25; am.gain.value = 0.75;
    thr.connect(thrG).connect(am.gain); // the beat between the cylinders and the blades
    lp.type = 'lowpass'; lp.Q.value = 0.8; g.gain.value = 0;
    o.connect(am); sub.connect(subG).connect(am); am.connect(lp).connect(g);
    const w = ctx.createBufferSource(), wf = ctx.createBiquadFilter(), wg = ctx.createGain(); // the propwash
    w.buffer = audio.buf; w.loop = true; wf.type = 'bandpass'; wf.frequency.value = 700; wf.Q.value = 0.6; wg.gain.value = 0.5;
    w.connect(wf).connect(wg).connect(g);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) g.connect(p).connect(audio.wild); else g.connect(audio.wild);
    audio.sfx.send(g, 0.3, audio.wild); // and echoed back off the land
    for (const x of [o, sub, thr]) x.start(); w.start(0, Math.random());
    this.n = { o, sub, lp, g, p };
  },
  update(still) {
    if (!audio.ctx || !audio.buf) return;
    if (!this.n) this.build();
    const { o, sub, lp, g, p } = this.n, ctx = audio.ctx, now = ctx.currentTime, pl = world.plane;
    if (now - (this.t ?? -1) < AUDIO_TICK) return;
    this.t = now;
    if (still || !pl || !pl.on) { g.gain.setTargetAtTime(0, now, 0.15); return; }
    const cam = world.camera.position, dx = pl.p.x - cam.x, dy = pl.p.y - cam.y, dz = pl.p.z - cam.z, d = Math.max(1, Math.hypot(dx, dy, dz));
    const vr = -(pl.v.x * dx + pl.v.y * dy + pl.v.z * dz) / d, f = 78 * 343 / (343 - vr); // closing speed: positive coming
    o.frequency.setTargetAtTime(f, now, 0.1); sub.frequency.setTargetAtTime(f / 2, now, 0.1);
    lp.frequency.setTargetAtTime(300 + 2600 * Math.min(1, 140 / d), now, 0.2); // the air takes the top off at a distance
    g.gain.setTargetAtTime(0.32 * Math.min(1, 90 / d), now, 0.2);
    if (p) {
      const v = world.camera.getWorldDirection(this._v || (this._v = cam.clone())), r = Math.hypot(v.x, v.z) || 1, hd = Math.hypot(dx, dz) || 1;
      p.pan.setTargetAtTime(clamp((dx * -v.z + dz * v.x) / r / hd, -1, 1) * 0.8, now, 0.2);
    }
  },
};

// ---------- the airliner's engines ----------
// Two big fans a long way up: the broad roar of the jets, a rumble under it that carries, and the fans' whine on top
// that the air takes away first. What you hear left her seconds ago (airliners.js hear), so the roar comes after the
// shadow when she's high, its pitch falling as she goes by. A climb out at full power is louder than an approach.
const jetRoar = {
  build() {
    const ctx = audio.ctx, g = ctx.createGain(); g.gain.value = 0;
    const noise = (type, freq, q, level) => {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), l = ctx.createGain();
      s.buffer = audio.buf; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q; l.gain.value = level;
      s.connect(f).connect(l).connect(g); s.start(0, Math.random() * 2);
      return f;
    };
    const roar = noise('lowpass', 700, 0.5, 0.9); noise('lowpass', 110, 0.9, 2.6); // the roar, and the rumble
    const fans = [ctx.createOscillator(), ctx.createOscillator()], bp = ctx.createBiquadFilter(), whine = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 2.5; whine.gain.value = 0;
    for (const o of fans) { o.type = 'triangle'; o.connect(bp); o.start(); }
    bp.connect(whine).connect(g);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) g.connect(p).connect(audio.wild); else g.connect(audio.wild);
    audio.sfx.send(g, 0.4, audio.wild); // and rolling back off the land
    this.n = { g, roar, fans, whine, p };
  },
  update(still) {
    if (!audio.ctx || !audio.buf) return;
    if (!this.n) this.build();
    const { g, roar, fans, whine, p } = this.n, ctx = audio.ctx, now = ctx.currentTime, jet = world.airliner;
    if (now - (this.t ?? -1) < AUDIO_TICK) return;
    this.t = now;
    if (still || !jet?.on || !jet.sound.level) { g.gain.setTargetAtTime(0, now, 0.25); return; }
    const o = jet.sound, cam = world.camera.position, dx = o.p.x - cam.x, dy = o.p.y - cam.y, dz = o.p.z - cam.z, d = Math.max(1, Math.hypot(dx, dy, dz));
    const vr = -(o.v.x * dx + o.v.y * dy + o.v.z * dz) / d, shift = 343 / (343 - vr), near = Math.min(1, 700 / d);
    fans[0].frequency.setTargetAtTime(1480 * shift, now, 0.2); fans[1].frequency.setTargetAtTime(1553 * shift, now, 0.2);
    roar.frequency.setTargetAtTime((220 + 1500 * near) * shift, now, 0.3);
    whine.gain.setTargetAtTime(0.09 * near * near, now, 0.3);
    g.gain.setTargetAtTime((o.out ? 0.3 : 0.2) * near ** 1.2 * o.level, now, 0.3);
    if (p) {
      const v = world.camera.getWorldDirection(this._v || (this._v = cam.clone())), r = Math.hypot(v.x, v.z) || 1, hd = Math.hypot(dx, dz) || 1;
      p.pan.setTargetAtTime(clamp((dx * -v.z + dz * v.x) / r / hd, -1, 1) * 0.7, now, 0.3);
    }
  },
};

// ---------- the gulls you hear, and the crew's asides ----------
// The gulls (wildlife.js) call now and then, and cry when a boat puts one up off the water: a cry made here, from where
// the gull is, quieter and duller the further off (under Sound, like the wind and the water). In the Russian game the
// crew has two asides of their own, each a file of its own and under the Voice switch: after another boat hails us,
// «Шо он орёт, я всё равно ничего не понимаю»; and when we put a gull up, «О, смотри, чайка полетела. Главное, на кита
// не наехать». An aside waits for the skipper to finish his line, and he waits for it.
// The gulls are real: herring gulls recorded on the shore (Wikimedia Commons: avphillips, public domain; Sonothèque
// ADVL, xeno-canto XC707075, CC0), cut into calls one after another in gulls.mp3 by scripts/gulls.py: where each
// starts and how long it is (s). A mew, one long plaintive note; a kyow, one call; a pair; the long call, the seaside
// laugh; and the alarm, a flurry of calls as she's put up off the water. Each bird her own pitch, a few per cent off.
const GULLS = {
  mew: [[0.25, 1.02], [1.52, 1.12], [2.89, 1.0], [4.14, 1.04]],
  kyow: [[5.43, 0.4], [6.08, 0.41], [6.74, 0.37], [7.36, 0.61]],
  pair: [[8.22, 0.7], [9.17, 0.72], [10.14, 0.69]],
  long: [[11.08, 3.55], [14.88, 3.1]],
  alarm: [[18.23, 1.9], [20.38, 1.55]],
};
const gulls = {
  buf: null, loading: false,
  load() {
    if (this.buf || this.loading || !audio.ctx) return;
    this.loading = true;
    fetch(fileAt('gulls.mp3')).then((r) => r.arrayBuffer())
      .then((b) => new Promise((res, rej) => audio.ctx.decodeAudioData(b, res, rej)))
      .then((b) => { this.buf = b; }, () => { this.loading = false; });
  },
  // n notes (wildlife.js): one is a mew or a single call, two a pair, more the long call. Plays into dest from t;
  // returns when she's done, or null before the file is in
  play(ctx, dest, t, n, alarm, vol) {
    if (!this.buf) return null;
    const kind = alarm ? 'alarm' : n === 1 ? (Math.random() < 0.5 ? 'mew' : 'kyow') : n === 2 ? 'pair' : 'long';
    const [at, len] = GULLS[kind][Math.floor(Math.random() * GULLS[kind].length)];
    const s = ctx.createBufferSource(), g = ctx.createGain(), rate = 0.94 + Math.random() * 0.12;
    s.buffer = this.buf; s.playbackRate.value = rate; g.gain.value = vol;
    s.connect(g).connect(dest); s.start(t, at, len);
    return t + len / rate;
  },
};

const asides = {
  R: 120, // metres: a gull beyond is out of earshot
  files: { ru: { sho: 'crew-ru-sho.mp3', gull: 'crew-ru-gull.mp3' } },
  buf: {}, loading: {}, last: {}, raced: {}, pend: null, cryTill: 0,
  load() {
    gulls.load();
    const files = this.files[LANG]; if (!files || !audio.ctx) return;
    for (const [k, f] of Object.entries(files)) {
      if (this.buf[k] || this.loading[k]) continue;
      this.loading[k] = true;
      fetch(fileAt(f)).then((r) => r.arrayBuffer())
        .then((b) => new Promise((res, rej) => audio.ctx.decodeAudioData(b, res, rej)))
        .then((b) => { this.buf[k] = b; }, () => { this.loading[k] = false; });
    }
  },
  reset() { this.stop(); this.pend = null; this.raced = {}; },
  stop() { try { this.src && this.src.stop(); } catch (e) {} this.src = null; },
  live() { return audio.ctx && audio.on && !paused && audio.ctx.state === 'running'; },
  // after another boat's hail, now and then: what's he on about?
  hail() {
    if (!this.buf.sho || !opts.voice || this.pend) return;
    const now = audio.ctx.currentTime;
    if (now - (this.last.sho ?? -1e9) < 180 || Math.random() > 0.4) return;
    this.pend = { k: 'sho', at: Math.max(now, skipper.speakTill) + 0.5, until: now + 6 };
  },
  // a line now; false when it can't be heard
  say(k) {
    const b = this.buf[k]; if (!b || !this.live() || !opts.voice) return false;
    const ctx = audio.ctx, now = ctx.currentTime, s = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = 0.9;
    s.buffer = b; s.connect(g).connect(audio.deck); s.start(now); this.stop(); this.src = s;
    this.last[k] = now; skipper.speakTill = Math.max(skipper.speakTill, now + b.duration + 0.4); skipper.busyTill = Math.max(skipper.busyTill, now + b.duration + 6);
    return true;
  },
  // a gull's cry, from where she is: quieter, duller and a touch later the further off, with the sea's echo under it
  cry(p, n, alarm) {
    const ctx = audio.ctx, pl = crews.place(p), d = Math.hypot(pl.d, p.y || 0), near = clamp(1 - d / this.R, 0, 1);
    if (near <= 0) return;
    if (!sndK('sndAround')) return;
    const v = near * near, out = crews.out(1, pl.pan, audio.wild), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2200 + 8000 * near; lp.Q.value = 0.5; lp.connect(out);
    const echo = ctx.createDelay(0.5), eg = ctx.createGain(), el = ctx.createBiquadFilter(); // off the water and the hulls round about
    echo.delayTime.value = 0.05 + 0.12 * (1 - near); eg.gain.value = 0.18 + 0.2 * (1 - near); el.type = 'lowpass'; el.frequency.value = 2600;
    lp.connect(echo).connect(el).connect(eg).connect(out); audio.sfx.send(lp, 0.08 + 0.2 * (1 - near), audio.wild);
    const t0 = ctx.currentTime + 0.03 + Math.random() * 0.08 + d / 343;
    const end = gulls.play(ctx, lp, t0, n, alarm, 0.8 * Math.max(v, 0.03));
    if (end === null) { lp.disconnect(); return; }
    setTimeout(() => { try { lp.disconnect(); eg.disconnect(); } catch (e) {} }, (end - ctx.currentTime + 1) * 1000);
    this.cryTill = end + 1.5 + Math.random() * 3;
  },
  // every frame: what the gulls did, and a waiting aside
  update() {
    const ev = world.wild && world.wild.events; if (!ev) return;
    const can = this.live() && race && !race.over;
    if (can) {
      const now = audio.ctx.currentTime;
      for (const e of ev) {
        if (e.type === 'call' && (e.alarm || now >= this.cryTill)) this.cry(e.p, e.n, e.alarm);
        // we put one up: a look, once a race
        if (e.type === 'up' && e.player && this.buf.gull && opts.voice && !this.raced.gull && !this.pend && Math.random() < 0.7) {
          this.raced.gull = true; this.pend = { k: 'gull', at: now + 0.8, until: now + 5 };
        }
      }
    }
    ev.length = 0;
    const pd = this.pend; if (!pd || !can) return;
    const now = audio.ctx.currentTime;
    if (now > pd.until) { this.pend = null; return; } // the moment has passed
    if (now < pd.at || now < skipper.speakTill || committee.busy()) return;
    this.say(pd.k); this.pend = null;
  },
};

// ---------- the race committee on the VHF, and the umpire from the RIB ----------
// What the committee boat says to the fleet, under Sound (not the Voice switch: it isn't on board), from calls-<lang>.mp3:
// each signal as the flag goes up, a clean start or an individual recall, a general recall, back from over early,
// out under the U or black flag, the day's forecast, the finish. And the umpire, on a foul, a touched mark, a boat
// exonerated, a penalty to the other boat: a whistle, then his word through the loudhailer. One call at a time, each
// as soon as the crew and the skipper have had their say (the skipper's word on a signal waits for the radio), and
// let go if it can't be said while it still matters.
const committee = {
  q: [], src: null, till: 0,
  // line k, said as soon as the boat is quiet, or not at all if that's more than `wait` seconds off; the time it should
  // be over by. `first`: ahead of what's waiting (a signal goes before the forecast)
  call(k, wait = 5, first = false) {
    const c = calls.clips[k]; if (!c || !audio.ctx || !audio.on) return 0;
    const now = audio.ctx.currentTime;
    this.q[first ? 'unshift' : 'push']({ k, until: now + wait });
    return Math.max(now, this.till, skipper.speakTill) + c[1] + (k[0] === 'u' ? 0.6 : 0);
  },
  busy() { return !!this.q.length || (audio.ctx && audio.ctx.currentTime < this.till); },
  stop() { try { this.src && this.src.stop(); } catch (e) {} this.src = null; this.q.length = 0; this.till = 0; },
  update() {
    if (!this.q.length || !audio.ctx) return;
    const now = audio.ctx.currentTime;
    while (this.q.length && now > this.q[0].until) this.q.shift(); // the moment has passed
    if (!this.q.length || !calls.buf || !audio.on || paused || audio.ctx.state !== 'running' || now < this.till || now < skipper.speakTill) return;
    this.play(this.q.shift().k);
  },
  play(k) {
    const ctx = audio.ctx, [at, len] = calls.clips[k], ump = k[0] === 'u';
    let t = ctx.currentTime;
    if (ump) { this.whistle(t); t += 0.6; }
    const s = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = ump ? 0.8 : 0.7; // a handset in the cockpit
    s.buffer = calls.buf; s.connect(g).connect(ump ? crews.out(1, 0.35, audio.voice) : audio.deck); s.start(t, Math.max(0, at - 0.03), len + 0.09);
    if (ump) audio.sfx.send(g, 0.3); // the loudhailer off the water and the land
    this.src = s; this.till = t + len + 0.3;
    skipper.busyTill = Math.max(skipper.busyTill, this.till + 2);
  },
  // the umpire's whistle: a pea whistle's trill, two blasts
  whistle(t) {
    const ctx = audio.ctx, out = crews.out(1, 0.35, audio.signals);
    for (const [at, dur] of [[0, 0.16], [0.22, 0.3]]) {
      const o = ctx.createOscillator(), lfo = ctx.createOscillator(), dep = ctx.createGain(), g = ctx.createGain(), a = t + at;
      o.frequency.value = 2900 + Math.random() * 150; lfo.frequency.value = 26 + Math.random() * 6; dep.gain.value = 220; // the pea
      g.gain.setValueAtTime(0, a); g.gain.linearRampToValueAtTime(0.12, a + 0.015); g.gain.setValueAtTime(0.12, a + dur - 0.04); g.gain.linearRampToValueAtTime(0, a + dur);
      lfo.connect(dep).connect(o.frequency); o.connect(g).connect(out); audio.sfx.send(g, 0.35, audio.signals);
      o.start(a); lfo.start(a); o.stop(a + dur + 0.02); lfo.stop(a + dur + 0.02);
    }
  },
  reset() { this.stop(); },
};

// ---------- the world ----------
const canvas = $('#gl');
let world;
// No WebGL to be had: the preloader's own failure (Try again, the hub) says so. Most often it isn't the device but the
// browser holding it back for a while after the graphics were reset (a context lost, below): Chrome turns WebGL off
// for the site, Safari when short of memory, so the way out is other tabs closed or the browser restarted. (The page
// wiped for a line of black text left the page's dark blue and nothing readable on it: a blue screen.)
try { world = new World(canvas); } catch (e) {
  if (window.rycLoader?.fail) window.rycLoader.fail('webgl: ' + (e && e.message), t('noGl'));
  else document.body.innerHTML = `<p style="padding:24px;font:18px/1.5 sans-serif;color:#fff">${t('noGl')}</p>`;
  throw e;
}
const resize = () => world.resize(window.innerWidth, window.innerHeight);
window.addEventListener('resize', resize); resize();
// how the game runs, for the site's /admin (stats.js): the graphics chip's name, as WebGL tells it, and the size drawn
try {
  const gl = world.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
  perfSetup({ gpu: gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER), size: () => [canvas.width, canvas.height] });
} catch (e) {}
const applyGfx = () => world.setQuality(...gfxNow(opts)); // (gfx.js: a level, Custom's parts, or what Auto draws on this device)
world.setFigures(opts.figures !== 0); // Audio & graphics › People on board
applyGfx();
world.showGuides = !!opts.guides;
// the level for the menu and the site's /admin: on Auto, the one its mix of parts comes closest to
const levelNow = () => (opts.gfx === 'auto' || !opts.gfx ? gfxLevel(world.gfx) : world.quality);
// Auto: while racing, ease off what shows least when the frames run slow and bring it back when they hold (gfx.js
// autoTuner), remembered for this device. Word of it only when the picture comes down a whole level.
const tuneGfx = autoTuner(autoBase());
let frameBusy = 0; // how long the last frame kept the CPU (frame, below)
function watchFps(raw) {
  if ((opts.gfx || 'auto') !== 'auto' || world.preparing) return; // (new shaders compiling: those frames say nothing)
  const next = tuneGfx(raw, frameBusy, world.gfx, !!opts.saver);
  if (!next) return;
  const was = gfxLevel(world.gfx), q = gfxLevel(next);
  world.setQuality('custom', next); saveAuto(next);
  if (GFX_LEVELS.indexOf(q) > GFX_LEVELS.indexOf(was)) toast(t('gfxDown', t(q === 'medium' ? 'gMedium' : 'gLow')), 2.5);
}
// The GPU took the picture away (webglcontextlost: a phone short of memory, the graphics driver reset): three.js stops
// drawing, the canvas shows the page's dark blue under the HUD, and the race sailed on blind. Now the race is paused
// at once (a match runs on: the other boat can't wait). three.js asks for the context back and, given it
// (webglcontextrestored), builds what it draws again: the race is there under the pause menu, on Auto a level lighter.
// Not given it in 2 s (Safari short of memory, Chrome after one reset too many) a card says so, with a reload. On Auto
// the level down is remembered for this device at once, as a slow race's is (watchFps), so the reload starts lighter.
let glLost = false, glCard = null, glT = 0;
function lostCard() {
  if (glCard || !glLost) return;
  if (running && !paused && !mx) pause();
  const el = glCard = document.createElement('div');
  el.className = 'overlay bc'; el.id = 'glLost';
  el.innerHTML = '<div class="card c-card" role="alertdialog" aria-modal="true" aria-labelledby="glH"><h2 id="glH"></h2><p></p><div class="c-btns"><button class="go"></button><button class="go ghost"></button></div></div>';
  el.querySelector('h2').textContent = t('glLostK'); el.querySelector('p').textContent = t('glLostTxt');
  const [again, out] = el.querySelectorAll('button');
  again.textContent = t('doReload'); out.textContent = t('doLeave');
  again.addEventListener('click', () => location.reload());
  out.addEventListener('click', () => quit());
  document.body.append(el);
}
canvas.addEventListener('webglcontextlost', () => {
  glLost = true;
  if (running && !paused && !mx) pause();
  if ((opts.gfx || 'auto') === 'auto') saveAuto(lighterParts(world.gfx));
  clearTimeout(glT); glT = setTimeout(lostCard, 2000);
});
canvas.addEventListener('webglcontextrestored', () => {
  glLost = false; clearTimeout(glT);
  if (glCard) { glCard.remove(); glCard = null; }
  const p = gfxParts(...gfxNow(opts));
  if (GFX_PARTS.some((k) => p[k] !== world.gfx[k])) applyGfx(); else world.prepare(); // (setQuality compiles the shaders again itself)
});

let race = null, running = false, paused = false, menuChanged = false, hints = {}, lastClockInt = null, coachSeen = {};
function newRace() {
  if (MATCH) { matchView(); return; }
  const s = settings();
  race = new Race({ preset: s.preset, laps: s.laps, autoTrim: opts.autoTrim === 1, start: s.start, current: !!s.current, fleet: s.fleet, length: s.length, course: s.course, bias: s.bias, level: s.level, seed: s.daily ? s.seed : undefined, daytime: s.daily ? 'any' : s.daytime, contactDsq: !s.daily && !drill && s.contact === 'dsq' });
  race.settings = s;
  race.player.name = t('you');
  world.setRace(race);
  world.resetView();
  hints = {}; lastClockInt = null; coachSeen = {}; skipper.reset(); asides.reset(); committee.reset(); score.reset();
}
// in a 1-on-1 race, until it starts: the two boats below the line, in the race the host set up if this is the host's
// screen (the set-up page's), else the usual. The defaults are match.js cleanSettings', by hand: this module doesn't load
// match.js
function matchView() {
  let s = null; try { s = JSON.parse(localStorage.getItem('regatta-match-settings') || 'null'); } catch (e) {}
  const one = (v, list) => (list.includes(v) ? v : list[0]);
  const set = { preset: one(s?.preset, ['medium', 'light', 'strong']), length: one(s?.length, ['short', 'medium', 'long']), course: one(s?.course, ['wl', 'tri', 'trap', 'wlu']), laps: one(Number(s?.laps), [1, 2]),
    start: one(Number(s?.start), [1, 3, 5]), current: one(Number(s?.current), [0, 1]), daytime: one(s?.daytime, ['any', 'morning', 'midday', 'afternoon', 'evening', 'sunset']) };
  race = new Race({ ...set, current: !!set.current, fleet: 2, seed: 1, humans: [{ id: 'a', name: '' }, { id: 'b', name: '' }], me: 'a' });
  race.settings = { ...set, fleet: 2, daily: null };
  world.setRace(race); world.resetView();
}
// a race of the match on screen (match-ui.js): its race in place of the last, the HUD up
function onMatchRace(s) {
  mx = s; race = s.race;
  world.setRace(race); world.resetView();
  hints = {}; lastClockInt = null; coachSeen = {}; skipper.reset(); asides.reset(); committee.reset(); score.reset(); flagsKey = '';
  race.coach = false;
  menu.hidden = true; hud.hidden = false; pauseEl.hidden = true; confirmEl.hidden = true; overWater(true);
  running = true; paused = false;
  applyTrimMode(); setCam(world.mode);
  raceStarted(race, race.settings); // (stats.js posts nothing for a match)
}
// …and off it: a card between the races, or at the end
function onMatchIdle() { if (avClose) avClose(); running = false; paused = false; hud.hidden = true; pauseEl.hidden = true; confirmEl.hidden = true; overWater(false); }
// the HUD's tags on the water (hud-bc.js: the next mark's, the boats'), which live outside #hud
const overWater = (on) => { for (const id of ['#nxTag', '#bOver']) { const e = $(id); if (e) e.style.visibility = on ? '' : 'hidden'; } };
function startMatchFlow() {
  audio.init(); audio.setOn(!!opts.sound); skipper.load(); crews.load(); asides.load(); calls.load(); score.style();
  menu.hidden = true; hud.hidden = true; speedBtn.hidden = true; overWater(false);
  for (const id of ['#pChange', '#pRestart']) $(id).style.display = 'none'; // a match isn't restarted or changed: only left
  import('./match-ui.js').then((m) => {
    matchUi = m;
    return m.startMatch({ code: MATCH, t, LANG, venue: VENUE, cls: CLS, onRace: onMatchRace, onIdle: onMatchIdle, onEnd: () => replaceRace(HUB), keepOneOnOne, openResult, toast: (s) => toast(s, 3.5),
      yachtName: (id) => yachtName(id), venueName: (id) => venueById(id).name[LANG === 'ru' ? 1 : 0] });
  }).catch((e) => { console.error(e); matchFailed(); });
}
// match-ui.js itself didn't load (or threw before it could say so): the game's own question card says it, with Try
// again (a reload) and Leave
function matchFailed() {
  if (document.querySelector('#mWrap .m-retry:not([hidden])')) return; // (match-ui.js is up and already saying it)
  document.querySelector('#mWrap')?.remove(); // (or up, and stuck on "Connecting…")
  const el = document.createElement('div');
  el.className = 'overlay bc'; el.id = 'matchFail';
  el.innerHTML = '<div class="card c-card" role="alertdialog" aria-modal="true" aria-labelledby="mfH"><h2 id="mfH"></h2><div class="c-btns"><button class="go"></button><button class="go ghost"></button></div></div>';
  el.querySelector('h2').textContent = t('matchFail');
  const [again, out] = el.querySelectorAll('button');
  again.textContent = t('tryAgain'); out.textContent = t('doLeave');
  again.addEventListener('click', () => location.reload());
  out.addEventListener('click', () => replaceRace(HUB));
  document.body.append(el);
}
// the race to sail is the address's (the hub and the set-up page are Next.js pages): taken before the first race is
// built, so the one dressed and compiled under the preloader is the one you sail, and the start doesn't build it again
opts.mode = new URLSearchParams(location.search).get('race') === 'free' ? 'free' : 'daily';
let firstStart = true;
newRace();
// dressed before Carlito came in (a first visit on a slow line), the boats are dressed again at the start, as every
// start did before; with it here, the race built now is the one you sail
const dressed = carlitoIn();

// ---------- controls ----------
const input = { rudderHeld: false, rudder: 0, keys: {}, lastSheet: 0 };
const rz = $('#rudderZone');
let rudderPtr = null, rudderX0 = 0;
rz.addEventListener('pointerdown', (e) => {
  rudderPtr = e.pointerId; rudderX0 = e.clientX - input.rudder * 80; input.rudderHeld = true;
  rz.setPointerCapture(e.pointerId); race.player.auto = null; e.preventDefault();
});
rz.addEventListener('pointermove', (e) => { if (e.pointerId === rudderPtr) input.rudder = clamp((e.clientX - rudderX0) / 80, -1, 1); });
const rudderUp = (e) => { if (e.pointerId === rudderPtr) { rudderPtr = null; input.rudderHeld = false; } };
rz.addEventListener('pointerup', rudderUp); rz.addEventListener('pointercancel', rudderUp);

const sz = $('#sheetZone'), sheetEl = $('#sheet');
let sheetPtr = null, sheetWhich = 'main';
// Main + jib: the jib gets its own slider, to the left of the main's (built here, styled like it, white knob)
const jibEl = sheetEl.cloneNode(true); jibEl.id = 'jibSheet'; sheetEl.before(jibEl);
const jibKnob = jibEl.querySelector('.knob'), jibBand = jibEl.querySelector('.band');
document.head.append(Object.assign(document.createElement('style'), { textContent: `
  #jibSheet { position: relative; width: 24px; height: calc(100% - 22px); border-radius: 54px; background: var(--glass); border: 2px solid var(--tag-line); margin-right: 30px; display: none; }
  #jibSheet .band { position: absolute; left: 2px; right: 2px; background: color-mix(in srgb, var(--accent) 35%, transparent); border-radius: 54px; }
  #jibSheet .knob { position: absolute; left: -10px; width: 40px; height: 20px; border-radius: 54px; background: #fff; border: 2px solid var(--accent); box-shadow: 0 2px 6px rgba(0,0,0,.3); transform: translateY(-50%); }
  #jibSheet .cap { position: absolute; left: 50%; transform: translateX(-50%); font-family: var(--sans); font-size: 11px; font-weight: 700; white-space: nowrap; text-transform: uppercase; letter-spacing: .02em; }
  #jibSheet .cap.t { top: -19px; } #jibSheet .cap.b { bottom: -19px; }
  #sheetZone.split, #hud #sheetZone.split { width: 124px; } #sheetZone.split #jibSheet { display: block; }
  #hud.split-trim #tackBtn, #hud.split-trim #kiteBtn { right: calc(136px + var(--sr)); } /* moved over for the second slider */
  #hud #jibSheet { width: 18px; border-width: 1.5px; margin-right: 26px; } #hud #jibSheet .knob { left: -8px; width: 30px; height: 16px; border-width: 1.5px; box-shadow: none; } #hud #jibSheet .cap { font-size: 10px; }` }));
// the Sails setting on the player's boat: 0 one sheet, 1 auto-trim, 2 main and jib apart (a class with no jib, the
// Laser or the Optimist, has the one sheet: classes.js jib)
function applyTrimMode() {
  const P = race && race.player; if (!P) return;
  P.autoTrim = opts.autoTrim === 1; P.split = opts.autoTrim === 2 && CLS.jib !== false;
  if (P.split) P.jibSheet = P.sheet;
  sz.classList.toggle('split', P.split); hud.classList.toggle('split-trim', P.split);
  sheetEl.querySelector('.cap.t').innerHTML = t(P.split ? 'mainCap' : 'in');
  jibEl.querySelector('.cap.t').innerHTML = t('jibCap');
}
// in Main + jib, a thumb works whichever slider it lands nearer
const pickSheet = (x) => {
  if (!race.player.split) return 'main';
  const a = jibEl.getBoundingClientRect(), b = sheetEl.getBoundingClientRect();
  return Math.abs(x - (a.left + a.width / 2)) < Math.abs(x - (b.left + b.width / 2)) ? 'jib' : 'main';
};
const autoOff = () => {
  if (!race.player.autoTrim) return;
  race.player.autoTrim = false; opts.autoTrim = 0; saveOpts(); paintOpts(); toast(t('autoOff'));
};
const setSheet = (v) => {
  const P = race.player; v = clamp(v, 0, 1);
  if (v < input.lastSheet - 0.012) { audio.click(); input.lastSheet = v; } // trimming in: the winch clicks
  else if (v > input.lastSheet + 0.006) { audio.ease(); input.lastSheet = v; } // easing: the sheet runs out round the drum
  if (sheetWhich === 'jib') P.jibSheet = v; else P.sheet = v;
};
const setSheetFrom = (y) => { const r = (sheetWhich === 'jib' ? jibEl : sheetEl).getBoundingClientRect(); setSheet((y - r.top) / r.height); };
sz.addEventListener('pointerdown', (e) => { sheetPtr = e.pointerId; sz.setPointerCapture(e.pointerId); autoOff(); sheetWhich = pickSheet(e.clientX); input.lastSheet = sheetWhich === 'jib' ? race.player.jibSheet : race.player.sheet; setSheetFrom(e.clientY); e.preventDefault(); });
sz.addEventListener('pointermove', (e) => { if (e.pointerId === sheetPtr) setSheetFrom(e.clientY); });
const sheetUp = (e) => { if (e.pointerId === sheetPtr) sheetPtr = null; };
sz.addEventListener('pointerup', sheetUp); sz.addEventListener('pointercancel', sheetUp);

const tackBtn = $('#tackBtn'), kiteBtn = $('#kiteBtn');
const doTack = () => {
  if (!running || paused) return;
  const P = race.player, n = P.events.length;
  P.tackOrGybe(); haptic('medium');
  if (mx && P.events.length > n) P.tackN = (P.tackN || 0) + 1; // a match: the guest's tack is sent as a count (wire.js controlsOf)
};
// the kite: a tap starts the crew hoisting it (or getting it down); a tap during a hoist calls it off
const doKite = () => {
  if (!running || paused) return;
  const P = race.player, j = P.kiteJob;
  if (j) { if (j.up && P.setKite(false)) haptic('light'); return; }
  if (P.kite) { if (P.setKite(false)) haptic('light'); return; }
  const type = kiteKind(P);
  if (type && P.setKite(true, type)) haptic('light');
};
// which sail the Kite button sets now: the gennaker running, a code zero reaching in light air (below 15 knots)
const kiteKind = (P) => { const a = Math.abs(P.twa) / D2R; return a > 100 && CLS.kite ? 'gen' : a > 60 && P.tws < 15 && CLS.zero ? 'zero' : null; }; // the class's sails (classes.js)
// the reef: a button above the kite's, shown in a breeze; a tap starts the crew tying a reef in (or shaking it out)
const reefBtn = kiteBtn.cloneNode(true); reefBtn.id = 'reefBtn'; reefBtn.classList.remove('on'); reefBtn.innerHTML = t('reef'); kiteBtn.after(reefBtn);
document.head.append(Object.assign(document.createElement('style'), { textContent: `
  #reefBtn { right: calc(94px + var(--sr)); bottom: calc(166px + var(--sb)); width: 56px; height: 56px; font-size: 10px; }
  #hud #reefBtn { right: calc(76px + var(--sr)); bottom: calc(136px + var(--sb)); width: 46px; height: 46px; font-size: 9px; }
  #hud.split-trim #reefBtn { right: calc(136px + var(--sr)); }
  #reefBtn.on { background: var(--accent); color: var(--on-accent); } #reefBtn[hidden] { display: none; }` }));
const doReef = () => { if (!running || paused) return; const P = race.player; if (!P.reefJob && P.setReef(!P.reef)) haptic('light'); };
// the jib: in a breeze, a button to change to the J3 (or back to the J1); and the hail, shown when there's something
// to hail for — room to tack, or a boat that must keep clear of you and is on her way into you
const jibBtn = reefBtn.cloneNode(true); jibBtn.id = 'jibBtn'; reefBtn.after(jibBtn);
const hailBtn = reefBtn.cloneNode(true); hailBtn.id = 'hailBtn'; hailBtn.innerHTML = t('hailBtn'); jibBtn.after(hailBtn);
document.head.append(Object.assign(document.createElement('style'), { textContent: `
  #jibBtn { right: calc(94px + var(--sr)); bottom: calc(234px + var(--sb)); width: 56px; height: 56px; font-size: 10px; }
  #hailBtn { right: calc(94px + var(--sr)); bottom: calc(302px + var(--sb)); width: 56px; height: 56px; font-size: 10px; background: var(--warn); color: #1a1200; border-color: var(--warn); }
  #hud #jibBtn { right: calc(76px + var(--sr)); bottom: calc(190px + var(--sb)); width: 46px; height: 46px; font-size: 9px; }
  #hud #hailBtn { right: calc(76px + var(--sr)); bottom: calc(244px + var(--sb)); width: 46px; height: 46px; font-size: 9px; }
  #hud.split-trim #jibBtn, #hud.split-trim #hailBtn { right: calc(136px + var(--sr)); }
  #jibBtn[hidden], #hailBtn[hidden] { display: none; }
  .flag.U { background: conic-gradient(#d22 0 25%, #fff 0 50%, #d22 0 75%, #fff 0); }
  .flag.B { background: #111; }
  .flag.sub { background: #f2c230; clip-path: polygon(0 0, 100% 50%, 0 100%); box-shadow: inset 0 0 0 4px #1f4fa8; }` }));
const doJib = () => { if (!running || paused) return; const P = race.player; if (!P.jibJob && P.setJib(!P.smallJib)) haptic('light'); };
const doHail = () => {
  if (!running || paused) return;
  const h = race.youCanHail();
  if (mx && mx.isGuest) race.player.hailN = (race.player.hailN || 0) + 1; // the guest's hail is the host's to make: its word comes back from there
  else race.hail();
  haptic('medium');
  if (!h) toast(t('hailNone'), 1.4);
};
jibBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); doJib(); });
hailBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); doHail(); });
reefBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); doReef(); });
tackBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); doTack(); });
kiteBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); doKite(); });

// camera: one finger on the water orbits (drone) or looks around (helm); two fingers pinch to zoom
const ptrs = new Map();
let pinch0 = 0, lastTap = 0;
canvas.addEventListener('pointerdown', (e) => {
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); canvas.setPointerCapture(e.pointerId);
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); }
  const now = performance.now(); if (now - lastTap < 300 && ptrs.size === 1) world.resetView(); lastTap = now;
});
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  if (ptrs.size === 1) world.drag(e.clientX - p.x);
  else if (ptrs.size === 2) {
    p.x = e.clientX; p.y = e.clientY;
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch0 > 0) world.zoom(pinch0 / d); pinch0 = d;
    return;
  }
  p.x = e.clientX; p.y = e.clientY;
});
const ptrUp = (e) => { ptrs.delete(e.pointerId); pinch0 = 0; };
canvas.addEventListener('pointerup', ptrUp); canvas.addEventListener('pointercancel', ptrUp);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); world.zoom(Math.exp(e.deltaY * 0.001)); }, { passive: false });
// + / − buttons: a step per tap, repeating while held
for (const [id, f] of [['#zoomIn', 1 / 1.06], ['#zoomOut', 1.06]]) {
  const b = $(id); let timer = null;
  const stop = () => { clearInterval(timer); timer = null; };
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); world.zoom(f ** 3); stop(); timer = setInterval(() => world.zoom(f), 40); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, stop);
}

// game speed: the race runs 1×, 1.5×, 2× or 3× as fast (more fixed steps a frame, so the sailing is the same; times
// are in race seconds, so results don't change)
const SPEEDS = [1, 1.5, 2, 3], speedBtn = $('#speedBtn');
let timeScale = 1;
const cycleSpeed = () => {
  if (MATCH) return; // a match is sailed at the speed of the clock: two screens, one race
  timeScale = SPEEDS[(SPEEDS.indexOf(timeScale) + 1) % SPEEDS.length];
  speedBtn.textContent = `${timeScale}×`; speedBtn.classList.toggle('fast', timeScale > 1); haptic('light');
};
speedBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); cycleSpeed(); });

// keyboard, for a computer: ←/→ steer, ↑/↓ sheet, space tack, K kite, T game speed, X/C/V drone/top/helm view, A/Z zoom in/out, Esc pause
// (L hides and shows the fleet board: hud-bc.js)
window.addEventListener('keydown', (e) => {
  input.keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); doTack(); }
  if (e.code === 'KeyK') doKite();
  if (e.code === 'KeyT') cycleSpeed();
  if (e.code === 'KeyA') world.zoom(1 / 1.12); // held down, the key repeats: a smooth zoom
  if (e.code === 'KeyZ') world.zoom(1.12);
  const view = { KeyX: 'drone', KeyC: 'top', KeyV: 'helm' }[e.code]; // in the order of the buttons
  if (view) setCam(view);
  if (e.code === 'Escape' || e.code === 'KeyP') { if (running) paused ? resume() : pause(); }
  if (['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(e.code)) autoOff();
});
window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });

const camSeg = $('#camSeg');
function setCam(m) { world.mode = m; camSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.cam === m)); }
camSeg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setCam(b.dataset.cam); });
setCam(['drone', 'top', 'helm'].includes(opts.camera) ? opts.camera : 'drone'); // Settings › First camera
// the HUD, as a sailing broadcast lays it out (hud-bc.js)
// what the player has set, read as each race ends (stats.js raceEnded, for the site's /admin)
statsContext(() => ({ cam: world.mode, trim: opts.autoTrim, sound: opts.sound ? 1 : 0, voice: opts.voice ? 1 : 0, music: opts.music, sea: opts.sea,
  saver: opts.saver ? 1 : 0, gfx: opts.gfx, q: levelNow(), guides: opts.guides ? 1 : 0, speed: timeScale }));
const bcHud = createHud({ t, LANG, fmt, world, getRace: () => race, setCam, flagOf: (b, me) => (me ? playerLook().flag : b.human ? lookFrom(b.look).flag : LOOKS[b.name] && LOOKS[b.name].flag) || null, // (the other sailor in a match: her own)
  sailOf: () => { const l = playerLook(); return `${l.nat} ${l.num}`.trim(); } }); // your flag and sail number, as the boat page sets them

// ---------- menus ----------
const menu = $('#menu'), hud = $('#hud');
initExtras({ LANG, getRace: () => race, isRunning: () => running, stop: () => { running = false; hud.hidden = true; } });
if (!opts.played) $('#howD').open = true; // how to play: open until the first race
function startRace() {
  audio.init(); audio.setOn(!!opts.sound); skipper.load(); crews.load(); asides.load(); calls.load(); score.style();
  const day = dailyRace();
  // a new day: a new daily race, and at another venue its land needs the page loaded again, in another yacht her model
  const q = new URLSearchParams(location.search);
  if (race.settings.daily && race.settings.daily !== day.day && ((day.venue !== VENUE.id && !q.get('venue')) || (day.yacht !== CLS.id && !q.get('boat')))) { location.href = '/play?race=today'; return; }
  if (running || menuChanged || race.over || (race.settings.daily && race.settings.daily !== day.day) || (firstStart && !dressed)) newRace();
  else if (firstStart) world.resetView(); // the race built at load: the drone has circled her under the preloader
  menuChanged = false; firstStart = false;
  opts.played = (opts.played || 0) + 1; saveOpts();
  race.coach = opts.played <= 3; // the first three races: tips as you go
  menu.hidden = true; hud.hidden = false;
  running = true; paused = false;
  applyTrimMode();
  setCam(world.mode);
  if (!drill) raceStarted(race, race.settings); // counted for the admins' Overview and the leaderboards (stats.js); a drill isn't a race
  onStart(race); // a drill's set-up, the analytics (extras.js)
}
// ---------- pause: the race stays in view; resume, change the race, restart or leave (each of the last three asks first) ----------
const pauseEl = $('#pauseCard'), confirmEl = $('#confirmCard');
// the voice on board (the skipper in Russian, the crew's calls in English) has a switch of its own, under Sound;
// off, the hails and the call for a tack or a gybe are still heard, and the count to the gun beeps (Audio & graphics ›
// Voice on board). The race committee and the umpire are under Sound alone.
const ordL = (n) => (LANG === 'ru' ? `${n}-е` : ord(n));
function paintPause() {
  const P = race.player, legs = race.course.legs, n = legs.length - 1, leg = Math.min(n, Math.max(1, P.leg));
  const place = race.standings().indexOf(P) + 1, L = race.log;
  $('#pLeg').textContent = t('legOf', leg, n);
  $('#pLegs').innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i + 1 < leg ? 'done' : i + 1 === leg ? 'now' : ''}"></i>`).join('');
  const nx = legs[P.leg];
  // the next target, how far (to the line, before you've crossed it; else to the mark, or the middle of the gate or the
  // finish) and how to round it
  $('#pNext').textContent = P.leg < legs.length ? t('nextAt', t(legKey(race.course, nx)), Math.round(P.leg < 1 ? Math.max(0, -race.lineInfo(P).d) : race.distToNext(P))) : '';
  $('#pHow').textContent = P.leg < legs.length ? t(howKey(race.course, nx)) : '';
  $('#pLine').textContent = pauseLine(P, place, nx);
  $('#pTimeD').textContent = race.multi ? t('timeOne') : race.settings.daily ? t('timeDaily') : t('timeFree');
  $('#pNext').classList.toggle('mark', !!race.course.marks[nx] || nx === 'gate'); // as its tag on the water
  $('#pPen').parentNode.className = L.penT > 1 ? 'pen' : 'clean';
  $('.p-esc').innerHTML = `<kbd>Esc</kbd>${t('escResumes').replace(/^Esc\s*(—\s*)?/, '')}`;
  $('#pPlace').textContent = ordL(place); $('#pOf').textContent = t('ofN', race.boats.length);
  $('#pTime').textContent = fmt(Math.max(0, race.clock));
  $('#pPen').textContent = L.penT > 1 ? `${Math.round(L.penT)} s` : '0'; $('#pPenD').textContent = L.penT > 1 ? t('penS') : t('penNone');
  // the ticker: paused, the venue, the race's clock (the count to the gun before it)
  const tick = $('#pTick'); tick.textContent = '';
  tick.append(`${t('pausedK')} · `, Object.assign(document.createElement('b'), { textContent: VENUE.name[LANG === 'ru' ? 1 : 0] }), ` · ${race.clock < 0 ? `${t('startIn')} ${fmt(-race.clock + 0.999)}` : fmt(race.clock)}`);
  // the guides: a switch; the sails three ways; the camera
  for (const b of pauseEl.querySelectorAll('[data-q]')) { const on = !!opts[b.dataset.q]; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }
  for (const b of pauseEl.querySelectorAll('[data-trim]')) b.setAttribute('aria-checked', String(Number(b.dataset.trim) === (opts.autoTrim | 0)));
  for (const b of pauseEl.querySelectorAll('[data-pc]')) b.setAttribute('aria-checked', String(b.dataset.pc === world.mode));
  $('#pAvM').textContent = avSummary(opts, LANG); // what Audio & graphics has chosen
}
// how a leg's target is rounded or crossed: every mark is left to port; the gate either way; the lines between their ends
const howKey = (c, k) => (c.marks[k] ? 'howPort' : k === 'gate' ? 'howGate' : k === 'finish' ? 'howFinish' : 'howStart');
const legKind = (c, i) => (isBeat(c, i) ? 'up' : ['wing', 'mark2', 'offset'].includes(c.legs[i]) ? 'reach' : 'down');
// a sentence on the race as it stands: the leg you're on, and the boat ahead (or your lead), as a commentator would
function pauseLine(P, place, nx) {
  if (race.clock < 0) return t('inStart');
  if (P.leg < 1) return t('notOver');
  const mark = nx ? (T[LANG].toD || t('toK'))[legKey(race.course, nx)] || '' : ''; // "к верхнему знаку", "to the windward mark"
  const how = isBeat(race.course, P.leg) ? t('sailUp') : legKind(race.course, P.leg) === 'reach' ? t('sailReach') : t('sailDown', !!P.kite);
  const st = race.standings(), ahead = st[place - 2], behind = st[place], rem = (b) => bcHud.remaining(race, b);
  // the gap in time, at the pace of the boat behind (as the board gives it): "0:12"
  const span = (b, m) => { const s = bcHud.gapTime(race, b, m); return s == null ? `${Math.max(1, Math.round(m))} ${LANG === 'ru' ? 'м' : 'm'}` : fmt(Math.max(1, s)); };
  const gap = ahead ? t('aheadOf', ahead.name, span(P, rem(P) - rem(ahead))) : behind ? t('leadBy', span(behind, rem(behind) - rem(P))) : t('leadAlone');
  return `${how} ${mark}. ${gap}`;
}
if (!TG) {
  const guard = () => { try { if (!history.state || !history.state.race) history.pushState({ race: 1 }, ''); } catch (e) {} };
  addEventListener('popstate', () => {
    if (replacing != null) { if (replacing) { const to = replacing; replacing = ''; location.replace(to); } return; } // on the way out (replaceRace)
    if (avClose) { avClose(); guard(); return; } // back from Audio & graphics is to the pause menu
    if (MATCH && matchUi) { matchBack(); guard(); return; }
    if (!running || race.over) { quit(); return; }
    if (!confirmEl.hidden) { quit(); return; }
    if (paused) ask('leave'); else pause();
    guard();
  });
  addEventListener('pointerdown', guard, { once: true }); // a browser keeps an entry only after the page is used
}
// (in a match the menu opens, but the race runs on under it: two screens, one race)
function pause() { if (!running || race.over) return; paused = true; paintPause(); pauseEl.hidden = false; confirmEl.hidden = true; }
function resume() { paused = false; pauseEl.hidden = true; confirmEl.hidden = true; }
let confirmDo = null;
function ask(action) {
  const P = race.player, place = race.standings().indexOf(P) + 1, c = race.course;
  if (action === 'leave' && race.multi) { // a race shared by two: what leaving does to it, on the host's tab or the guest's (a boat out herself wins nothing)
    const o = race.humans.find((b) => b !== P);
    $('#cKick').textContent = t('askK')[action]; $('#cHead').textContent = t('askH')[action];
    $('#cTxt').textContent = !mx?.isGuest ? t('leaveHost') : P.done ? t('leaveHome') : t('leaveGuest', o.ufd || o.bfd || o.dsq ? null : o.name);
  } else if (race.clock >= 0 && P.leg >= 1 && !P.done) { // racing: the question in the bar, where you are as the headline
    $('#cKick').textContent = t('askH')[action];
    $('#cHead').textContent = t('whereH', LANG === 'ru' ? place : ord(place), Math.round(race.distToNext(P)), t('toK')[legKey(c, c.legs[P.leg])]);
    $('#cTxt').textContent = `${t('askT')[action]} ${t('notKept')}`;
  } else { // in the start sequence, still to cross the line (or finished): the question as the headline
    const where = race.clock < 0 ? t('inSeq') : P.leg < 1 ? t('notOverYou') : t('leaveTxt', LANG === 'ru' ? place : ord(place), P.leg);
    $('#cKick').textContent = t('askK')[action]; $('#cHead').textContent = t('askH')[action];
    $('#cTxt').textContent = `${where} ${t('askT')[action]} ${t('notKept')}`;
  }
  $('#cGo').textContent = t({ restart: 'doRestart', change: 'doChange', leave: 'doLeave' }[action]);
  confirmDo = action; pauseEl.hidden = true; confirmEl.hidden = false;
}
$('#pResume').addEventListener('click', resume);
$('#pChange').addEventListener('click', () => ask('change'));
$('#pRestart').addEventListener('click', () => ask('restart'));
$('#pLeave').addEventListener('click', () => ask('leave'));
// Audio & graphics, over the pause menu: each change is heard and seen as it's made
let avClose = null;
function applyAv(p) {
  if ('gfx' in p || 'gfxD' in p) { applyGfx(); perf.settle = 2; }
  if ('saver' in p) Object.assign(perf, { settle: 2, t: 0, d: [] }); // (the frame rate Auto watches changes with it)
  if ('figures' in p) world.setFigures(p.figures !== 0);
  if ('music' in p || 'musicVol' in p || 'sound' in p) score.style();
  if ('sound' in p) audio.setOn(!!opts.sound);
  if (p.voice === 0) { skipper.stop(); asides.stop(); asides.pend = null; }
  audio.levels();
}
$('#pAv').addEventListener('click', () => {
  avClose = openAvMenu({ lang: LANG, read: () => opts, write: (p) => { Object.assign(opts, p); saveOpts(); applyAv(p); }, now: levelNow, zIndex: 15,
    onClose: () => { avClose = null; if (running && race) paintPause(); } });
});
$('#cKeep').addEventListener('click', () => { confirmEl.hidden = true; pauseEl.hidden = false; });
$('#cGo').addEventListener('click', () => {
  raceEnded(race, confirmDo === 'restart' ? 'restart' : confirmDo === 'change' ? 'change' : 'menu'); // (stats.js: how the race ended)
  if (confirmDo === 'restart') { confirmEl.hidden = true; paused = false; running = false; newRace(); startRace(); return; }
  if (confirmDo === 'change') replaceRace(`/race/free?from=${race.settings.daily ? 'today' : 'race'}`); else quit();
});
pauseEl.addEventListener('click', (e) => {
  const tr = e.target.closest('[data-trim]');
  if (tr) { opts.autoTrim = Number(tr.dataset.trim); applyTrimMode(); saveOpts(); paintOpts(); paintPause(); return; } // Settings › Sails: I trim, Auto, Main + jib
  const pc = e.target.closest('[data-pc]');
  if (pc) { setCam(pc.dataset.pc); opts.camera = pc.dataset.pc; saveOpts(); paintPause(); return; } // the camera now, and Settings › First camera
  const b = e.target.closest('[data-q]'); if (!b) return;
  const k = b.dataset.q;
  opts[k] = opts[k] ? 0 : 1;
  if (k === 'guides') world.showGuides = !!opts.guides;
  saveOpts(); paintPause();
});
$('#goBtn').addEventListener('click', startRace);
$('#resumeBtn').addEventListener('click', resume);
$('#pauseBtn').addEventListener('click', pause);
for (const a of [$('#backLink'), $('#lBack')]) { // the menu's back and the loading screen's: where you came from, as the site's arrows
  a.href = HUB;
  a.addEventListener('click', (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; e.preventDefault(); leave(); });
}

// ---------- the race to sail: from the address (the hub and the set-up page are Next.js pages) ----------
{
  paintOpts(); // the menu as this race has it (the note on today's race, its place and wind; opts.mode is the address's, above)
  // the loading screen names the race now it's known: the venue in its title, the wind, the course and the fleet under it
  const s = MATCH ? race.settings : settings(), tr = (en, ru) => (LANG === 'ru' ? ru : en), boats = s.fleet - 1;
  if (MATCH) window.rycLoader?.race?.(VENUE.name[LANG === 'ru' ? 1 : 0], [
    [tr('Race', 'Гонка'), 1, tr('race', 'гонка'), tr('One race, one winner', 'Одна гонка, один победитель')],
    [tr('Course', 'Дистанция'), s.laps, tr(s.laps > 1 ? 'laps' : 'lap', s.laps > 1 ? 'круга' : 'круг'), t(SHAPE_KEY[laidShape(s.course, s.length)])],
    [tr('Boats', 'Лодки'), 2, '', tr('You and a friend', 'Ты и друг')],
  ], tr(`${s.start}-minute start sequence`, `стартовая процедура ${s.start} мин`));
  else window.rycLoader?.race?.(VENUE.name[LANG === 'ru' ? 1 : 0], [
    [tr('Wind', 'Ветер'), { light: 7, medium: 12, strong: 19 }[s.preset], tr('kn', 'уз'), { light: tr('Light breeze', 'Слабый ветер'), medium: tr('Medium breeze', 'Средний ветер'), strong: tr('Strong breeze', 'Сильный ветер') }[s.preset]],
    [tr('Course', 'Дистанция'), s.laps, tr(s.laps > 1 ? 'laps' : 'lap', s.laps > 1 ? 'круга' : 'круг'), t(SHAPE_KEY[laidShape(s.course, s.length)])],
    [tr('Fleet', 'Флот'), s.fleet, '', tr(`You and ${boats} boats`, `Ты и ${boats} ${boats === 1 ? 'лодка' : boats < 5 ? 'лодки' : 'лодок'}`)],
  ], tr(`${s.start}-minute start sequence`, `стартовая процедура ${s.start} мин`)); // what's coming up, in the ticker
  menu.hidden = true;
  // the preloader in play/index.html has counted the files in; the scene is built, so it fills its bar and fades into the race
  // …once the shaders are compiled too (world.prepare), so the first frame of the race doesn't stall
  world.ready().then(() => {
    visitSend('loaded'); // (stats.js: the page got as far as the race, for the site's /admin)
    const go = MATCH ? startMatchFlow : startRace;
    if (window.rycLoader) window.rycLoader.done(go);
    else { $('#loading').hidden = true; go(); }
  });
}


// ---------- instruments ----------
const el = { spd: $('#spd'), perf: $('#perf'), status: $('#status'), trim: $('#trim'), trimTxt: $('#trimTxt'), knob: $('#rudderKnob'), band: $('#sheet .band'), sknob: $('#sheet .knob'),
  toast: $('#toast'), count: $('#count'), flags: $('#flags'), chips: $('#chips') };
let toastT = 0;
const txt = (e, s) => { if (e._t !== s) { e._t = s; e.textContent = s; } }; // write the DOM only when the text changes
function toast(msg, secs = 2.4) { txt(el.toast, msg); el.toast.classList.add('show'); toastT = secs; }
function hint(key, msg, every = 12) { const n = race.clock; if (hints[key] && n - hints[key] < every) return; hints[key] = n; toast(msg); }

const legName = { start: 'lineStart', mark: 'mark', wing: 'wing', mark2: 'mark2', offset: 'offset', gate: 'gate', finish: 'finish' };
// a leg's name, by its mark: on a trapezoid the windward mark is mark 1
const legKey = (c, k) => (k === 'mark' && c.type === 'trap' ? 'mark1' : legName[k]);
let flagsKey = '';
function updateHud(dt) {
  const P = race.player, a = Math.abs(P.twa) / D2R, awa = Math.abs(P.awa) / D2R, c = race.course;
  const kn = P.v / KN;
  txt(el.spd, kn.toFixed(1));
  el.trim.dataset.s = P.trim;
  el.trim.hidden = P.trim === 'ok'; // the chip only when there's something to do
  txt(el.trimTxt, t(P.trimSail === 'jib' && (P.trim === 'in' || P.trim === 'out') ? (P.trim === 'in' ? 'jibIn' : 'jibOut') : { ok: 'ok', in: 'pullIn', out: 'easeOut', irons: 'irons' }[P.trim]));
  const ang = P.rudder * 70 * D2R; el.knob.setAttribute('cx', (105 + Math.sin(ang) * 84).toFixed(1)); el.knob.setAttribute('cy', (104 - Math.cos(ang) * 84).toFixed(1));
  const tol = 7 / 77, lo = clamp(sheetFor(idealSail(awa)) - tol, 0, 1), hi = clamp(sheetFor(idealSail(awa) + P.depower) + tol, 0, 1);
  el.band.style.top = `${lo * 100}%`; el.band.style.height = `${(hi - lo) * 100}%`;
  el.band.style.display = a < 28 ? 'none' : '';
  el.sknob.style.top = `${P.sheet * 100}%`;
  if (P.split) { jibKnob.style.top = `${P.jibSheet * 100}%`; jibBand.style.top = el.band.style.top; jibBand.style.height = el.band.style.height; jibBand.style.display = el.band.style.display; }
  sz.classList.toggle('auto', P.autoTrim);
  txt(tackBtn, t(a > 95 ? 'gybe' : 'tack'));
  tackBtn.classList.toggle('down', !!P.auto);
  const kk = P.kite || P.kiteJob ? P.kiteType : kiteKind(P);
  kiteBtn.hidden = !(kk || P.kite || P.kiteJob) || race.clock < 0;
  if (kiteBtn.dataset.k !== kk) { kiteBtn.dataset.k = kk; txt(kiteBtn, t(kk === 'zero' ? 'zero' : 'kite')); }
  kiteBtn.classList.toggle('on', P.kiteJob ? P.kiteJob.up : P.kite);
  kiteBtn.style.opacity = P.kiteJob ? (0.55 + 0.45 * Math.abs(Math.sin(performance.now() / 180))).toFixed(2) : ''; // the crew at work: it pulses
  reefBtn.hidden = !((race.wind.p.tws >= 15 && CLS.reef) || P.reef || P.reefJob);
  reefBtn.classList.toggle('on', P.reefJob ? P.reefJob.on : P.reef);
  reefBtn.style.opacity = P.reefJob ? (0.55 + 0.45 * Math.abs(Math.sin(performance.now() / 180))).toFixed(2) : '';
  jibBtn.hidden = !((race.wind.p.tws >= 15 && CLS.j3) || P.smallJib || P.jibJob);
  const jl = t((P.jibJob ? P.jibJob.small : P.smallJib) ? 'jibBig' : 'jibBtn'); if (jibBtn.textContent !== jl) txt(jibBtn, jl); // what a tap changes to
  jibBtn.style.opacity = P.jibJob ? (0.55 + 0.45 * Math.abs(Math.sin(performance.now() / 180))).toFixed(2) : '';
  hailBtn.hidden = !race.youCanHail();

  // status and the line below it
  const leg = c.legs[P.leg];
  el.status.classList.toggle('bad', P.ocs);
  el.status.style.display = race.clock < 0 && !P.ocs ? 'none' : ''; // before the start the big countdown says it
  let perf = '';
  if (P.ocs) txt(el.status, t('ocsS'));
  else if (race.clock < 0) {
    txt(el.status, `${t('startIn')} ${fmt(-race.clock + 0.999)}`);
    // distance to the line, time to get there at this speed, and the favoured end
    const li = race.lineInfo(P), close = (Math.sin(P.h) * c.normal.x - Math.cos(P.h) * c.normal.z) * P.v;
    const ux = Math.sin(race.wind.dir()), uz = -Math.cos(race.wind.dir());
    const fav = (c.pin.x - c.committee.x) * ux + (c.pin.z - c.committee.z) * uz;
    perf = `${t('line')} ${Math.max(0, -li.d).toFixed(0)} m` + (close > 0.3 && li.d < 0 ? ` · ${fmt(-li.d / close)} ${t('toLine')}` : '') + ` · ${Math.abs(fav) < 4 ? t('square') : fav > 0 ? t('favPin') : t('favBoat')}`;
  } else if (P.done) txt(el.status, P.dsq ? `${t('dsq')} · ${fmt(P.finish)}` : `${t('place', P.place)} · ${fmt(P.finish)}`);
  else {
    const place = race.standings().indexOf(P) + 1, d = race.distToNext(P);
    txt(el.status, `${fmt(race.clock)} · ${t(legKey(c, leg))} ${Math.round(d)} m · ${t('place', place)}`);
  }
  if (race.clock >= 0 && !P.done) {
    const m = race.nextMark(P), brg = Math.atan2(m.x - P.x, -(m.z - P.z));
    const vmg = kn * Math.cos(wrap(brg - P.h)), pct = P.polar > 0.5 ? Math.round((kn / P.polar) * 100) : 0;
    perf = `${t('target')} ${P.polar.toFixed(1)} · ${pct}% · ${t('vmg')} ${vmg.toFixed(1)}`;
  }
  txt(el.perf, perf);

  // the committee boat's flags
  const fk = `${race.flags.cls}${race.flags.P}${race.flags.X}${race.flags.sub}${race.prepFlag}`;
  if (fk !== flagsKey) {
    flagsKey = fk;
    const fig = (cls, inner, cap) => `<figure><i class="flag ${cls}">${inner}</i><figcaption>${t(cap)}</figcaption></figure>`;
    const pf = race.prepFlag || 'P'; // the preparatory flag: P, U or black
    el.flags.innerHTML = (race.flags.sub ? fig('sub', '', 'flagSub') : '') + (race.flags.cls ? fig('cls', 'R', 'flagCls') : '') + (race.flags.P ? fig(pf, '', { P: 'flagP', U: 'flagU', B: 'flagB' }[pf]) : '') + (race.flags.X ? fig('X', '', 'flagX') : '');
  }
  // chips: penalty, dirty air, surfing
  const chips = [];
  if (P.pen) chips.push(['bad', t('pen', P.pen.tack, P.pen.gybe), 'pen']);
  if (P.shadow > 0.08) chips.push(['warn', `${t('dirty')} −${Math.round(P.shadow * 100)}%`, 'dirty']);
  if (P.surf > 0) chips.push(['ok', t('surf'), 'surf']);
  if (P.byLee > 3) chips.push([P.byLee > 8 ? 'bad' : 'warn', t('byLee', Math.round(P.byLee)), 'byLee']);
  // on the beat, the wind's swing against its middle: a lift (she can point higher) or a header (time to tack)
  if (race.clock >= 0 && !P.done && !P.auto && a < 70) {
    const s = Math.round(((P.twa < 0 ? -1 : 1) * wrap(P.wdir - race.wind.mean())) / D2R);
    if (s >= 4) chips.push(['ok', t('lift', s), 'shift']); else if (s <= -4) chips.push(['warn', t('header', -s), 'shift']);
  }
  // mark-room: who gets it was settled when the first of you reached the zone
  let zs = null, zd = 1e9;
  for (const st of race.zoneStates.values()) {
    if (st.p !== P && st.q !== P) continue;
    const o = st.p === P ? st.q : st.p, d = Math.hypot(o.x - P.x, o.z - P.z);
    if (d < zd) { zd = d; zs = { st, o }; }
  }
  if (zs && zd < 60) {
    const mine = zs.st.entitled === P, n = zs.o.name;
    chips.push([mine ? 'ok' : 'warn', zs.st.overlapped ? t(mine ? 'zIn' : 'zOut', n) : t(mine ? 'zAhead' : 'zAstern', n), 'zone']);
    skipper.zone(zs.st, mine);
  }
  chips.splice(0, chips.length, ...chips.filter((x) => x[2] !== 'shift').slice(0, 2)); // the two that matter most (the wind's swing is in the wind box)
  bcHud.chips(chips); // it updates them in place, in and out smoothly

  const left = -race.clock;
  // the countdown to the start, large all the way, and huge for the last ten seconds
  txt(el.count, race.clock < 0 ? (left <= 10 ? String(Math.ceil(left)) : fmt(left + 0.999)) : '');
  el.count.classList.toggle('final', race.clock < 0 && left <= 10);
  const ci = Math.ceil(-race.clock);
  if (race.clock < 0 && ci !== lastClockInt) {
    if (lastClockInt !== null && ci <= 10 && ci > 0) { if (!skipper.count(ci) && audio.sfx) audio.sfx.beep(ci <= 3); if (ci <= 3) haptic('light'); } // the count: a voice, or beeps
    lastClockInt = ci;
  }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) el.toast.classList.remove('show'); }
  audio.update(P, paused); crews.update(P, paused); asides.update(); committee.update(); engine.update(false); jetRoar.update(false); score.update(P, dt);
  if (race.coach) coach(P, a, leg);
  skipper.watch(P, dt);
  bcHud.update(P, dt);
}
// the first races: a tip when it's needed, each once a race
function coach(P, a, leg) {
  const once = (k, cond) => { if (!cond || coachSeen[k] || toastT > 0.6) return; coachSeen[k] = 1; toast(t(k), 4.5); };
  const c = race.clock, s0 = race.seq[0].t, d = race.distToNext(P), cs = race.course, beat = isBeat(cs, P.leg);
  once('cSteer', c > s0 + 3);
  once('cSheet', coachSeen.cSteer && c > s0 + 10 && !P.autoTrim);
  once('cLine', c > -32 && c < -5);
  const shift = (P.twa < 0 ? -1 : 1) * wrap(P.wdir - race.wind.mean()) / D2R;
  once('cHeader', c > 20 && beat && a < 70 && shift <= -5 && !P.auto);
  once('cMark', leg === 'mark' && d < 90);
  once('cKite', CLS.kite && c > 0 && !beat && leg !== 'start' && a > 110 && !P.kite); // only a class that has one
  once('cGate', leg === 'gate' && d < 90);
  const fi = cs.legs.length - 1;
  if (!cs.finish) once('cFinish', leg === 'finish' && d < 90);
  else if (leg === 'finish') { // a line of its own: which way it is, as the leg begins
    const f = legAim(cs, fi), g = legAim(cs, fi - 1);
    once(isBeat(cs, fi) ? 'cFinishUp' : f.x > g.x ? 'cFinishR' : 'cFinishL', true);
  }
}

// messages from the race and the boat
function handleMessages() {
  const P = race.player;
  for (const m of race.messages) {
    if (m.to && m.to !== race.player) continue; // another boat's news
    raceIncident(race, m.key); // (stats.js: what may make a player give up, for the site's /admin)
    const a = m.arg || {};
    if (m.key === 'signal') {
      audio.horn(a.sound === 'long'); haptic(a.key === 'gun' ? 'heavy' : 'medium'); skipper.signal(a.key, P.ocs);
      score.sting(a.key !== 'gun' ? 'swell' : race.messages.some((n) => n.key === 'genRecall') ? 'hit' : P.ocs ? 'loss' : 'gun'); // the music: a swell at each signal, the gun's hit
      // and on the radio: the signal, or at the gun a clean start or the boats over recalled (not a start being
      // recalled, nor one under U or black, where the boats over are out)
      if (a.key === 'gun') { if (!race.messages.some((n) => n.key === 'genRecall') && !race.boats.some((b) => b.ufd || b.bfd)) committee.call(race.flags.X ? 'cRecall' : 'cClear'); }
      else committee.call({ sigWarn: 'cWarn' + Math.round(-a.t / 60), sigPrep: 'cPrep' + race.prepFlag, sig1: 'c1' }[a.key], 6, true);
      if (a.key === 'gun' && P.ocs) continue;
      toast(t(a.key, Math.round(-a.t / 60), race.prepFlag), 3);
    } else if (m.key === 'contactDsq') { // out of the race for a contact (sim.js verdict): the reason, and time to read it before the result
      raceFinished(race); toast(t('contactDsq', a), 5); score.sting('loss'); haptic('heavy'); setTimeout(finishToPage, 5000);
    } else if (m.key === 'finished' || m.key === 'finishedDsq' || m.key === 'finishedStartDsq') {
      race._fin = finishScene(race); if (!race.multi) raceFinished(race); toast(t(m.key, m.arg), 3); audio.horn(false, race.course.finishBoat); haptic('heavy');
      score.sting(m.key !== 'finished' ? 'lose' : m.arg === 1 ? 'win' : m.arg <= Math.max(2, Math.ceil(race.boats.length / 3)) ? 'gain' : 'lose');
      // the crew's word as she crosses (in Russian), and the committee's after it, heard out before the result
      if (m.key === 'finished') skipper.cue('finish');
      const end = committee.call(m.key === 'finishedDsq' ? 'cFinDsq' : m.key === 'finishedStartDsq' ? 'cFinOut' : m.arg === 1 ? 'cFin1' : 'cFin', 1.5);
      if (!race.multi) setTimeout(finishToPage, end ? Math.max(2500, (end - audio.ctx.currentTime) * 1000 + 600) : 2500);
    }
    else if (m.key === 'gate') toast(t('gateMsg'));
    else if (m.key === 'bump') { audio.collide(m.arg); score.sting('hit'); hint('bump', t('bump'), 3); haptic('heavy'); skipper.shout(race.clock < 0 ? 'push' : 'contact'); }
    else if (m.key === 'theyDsq') { toast(t('theyDsq', a), 3.5); score.sting('gain'); }
    else if (m.key === 'aground') { score.sting('hit'); hint('aground', t('aground'), 3); haptic('heavy'); skipper.shout('aground'); }
    else if (m.key === 'hail') { const h = t('hail' + a.rule), who = race.boats.find((b) => b.name === a.who); toast(`${a.who}: “${h}”`, 2.2); skipper.cue('hail' + a.rule, who, true); asides.hail(); haptic('warn'); }
    else if (m.key === 'youHail') { if (a.rule) { const h = t('hail' + a.rule); toast(t('youHail', h), 2); skipper.cue('hail' + a.rule, null, true); } }
    else if (m.key === 'seaBreeze' || m.key === 'seaBreezeSouth' || m.key === 'thermalBreeze') { toast(t(m.key), 5); if (m.key === 'seaBreeze') committee.call('cBreeze', 20); } // (the committee's recording says a sea breeze, veering right)
    else if (m.key === 'genRecall') { score.sting('hit'); toast(t('genRecall', m.arg), 4); audio.horn(); audio.horn(false, null, 1.25); haptic('warn'); committee.stop(); committee.call('cGenRecall'); skipper.shout('lost'); }
    else if (m.key === 'prepU' || m.key === 'prepB' || m.key === 'ufd' || m.key === 'bfd') {
      toast(t(m.key), 4);
      if (m.key === 'prepU' || m.key === 'prepB') { if (race.seq.length <= 2) committee.call(m.key === 'prepU' ? 'cFlagU' : 'cFlagB', 8); skipper.later('flag'); } // a one-minute start has no preparatory signal to say it
      if (m.key === 'ufd' || m.key === 'bfd') { score.sting('loss'); haptic('warn'); committee.call('cOut'); skipper.shout('lost'); }
    }
    else if (m.key === 'fouled' || m.key === 'theyFouled') { score.sting(m.key === 'fouled' ? 'loss' : 'hit'); bcHud.umpire(m.key, a); skipper.cue('protest') || skipper.shout(m.key === 'fouled' ? 'foul' : 'contact'); committee.call(m.key === 'fouled' ? 'uPen' : 'uThem', 4); } // the umpire's card (hud-bc.js)
    else if (m.key === 'touched') { bcHud.umpire(m.key, a); skipper.shout('foul'); score.sting('loss'); committee.call('uMark', 4); }
    else {
      toast(t(m.key), 2.6); if (m.key === 'ocs') { haptic('warn'); skipper.shout('early', 1, true); } if (m.key === 'rounded' || m.key === 'roundedTrap' || m.key === 'roundedWlu') haptic('medium');
      if (m.key === 'touched' || m.key === 'wrongSide' || m.key === 'missedGate') { skipper.shout('foul'); score.sting('loss'); }
      if (m.key === 'ocs') score.sting('loss');
      if (m.key === 'cleared' || m.key === 'exonerated') score.sting('gain');
      if (m.key === 'rounded' || m.key === 'roundedTri' || m.key === 'roundedTrap' || m.key === 'roundedWlu') score.sting('round');
      if (m.key === 'touched') committee.call('uMark', 4);
      if (m.key === 'exonerated') committee.call('uNone', 4);
      if (m.key === 'missedLine') skipper.shout('where', 1, true);
      if (m.key === 'started') skipper.started(race.clock);
      if (m.key === 'cleared') { skipper.cue('go'); committee.call('cBack'); }
      if (['rounded', 'roundedTri', 'roundedTrap', 'roundedWlu'].includes(m.key) && !skipper.cue('bearAway') && P.leg === 2 && !race.log.fouls.length) skipper.shout('clean'); // the windward mark, and nobody touched yet
    }
  }
  race.messages.length = 0;
  for (const e of P.events) {
    if (e === 'broach') { score.sting('hit'); toast(t('broach')); haptic('heavy'); skipper.shout('chaos'); }
    if (e === 'kitedown') { score.sting('hit'); toast(t('kitedown')); haptic('warn'); skipper.shout('chaos'); }
    if (e === 'kiteHoist' || e === 'kiteDrop' || e === 'kiteUp') toast(t(e + (P.kiteType === 'zero' ? 'Z' : '')), 1.8);
    if (e === 'reefStart' || e === 'reefDone' || e === 'shakeStart' || e === 'shakeDone' || e === 'jibStart' || e === 'jibDone') toast(t(e), 1.8);
    if (e === 'penaltyDone') toast(t('penaltyDone'));
    if (e === 'kiteWrap' || e === 'crashGybe' || e === 'deathRoll') { toast(t(e), 3); haptic(e === 'kiteWrap' ? 'warn' : 'heavy'); if (!(e === 'crashGybe' && skipper.cue('heads'))) skipper.shout('chaos'); }
    if (e === 'kiteGybed') toast(t('kiteGybed'), 1.4);
    if (e === 'takeoff' || e === 'splashdown') { toast(t(e), e === 'takeoff' ? 1.6 : 2.6); if (e === 'splashdown' && race.clock > 0) haptic('warn'); }
    // the call for a tack or a gybe: now and then the Russian skipper's own way, else the crew's (with Voice off too)
    if ((e === 'tacking' || e === 'gybing') && !(!P.pen && skipper.shout('tack', 0.35))) skipper.cue(e === 'tacking' ? 'tackCall' : 'gybeCall', null, true);
  }
  P.events.length = 0;
  for (const b of race.boats) if (b !== P) { for (const e of b.events) crews.hear(b, e); b.events.length = 0; } // heard when close
  if (P.heel > 33) hint('heel', t('heelMsg'), 10);
  if (P.trim === 'irons' && P.v < 0.6 && !P.auto && !P.pen && race.clock > race.seq[0].t + 8) { hint('irons', t('ironsMsg'), 10); skipper.shout('irons'); }
  if (P.gust > 0.55) hint('gust', t('gust'), 15);
  // slow on the beat and pointing as if at full speed: foot to build it; in a seaway, steer the waves
  if (race.clock > 0 && !P.auto && !P.pen && P.trim !== 'irons' && P.stall > 2.5 && Math.abs(P.twa) / D2R < beatAngle(P.tws) + 3) { hint('foot', t('foot'), 30); skipper.shout('foot'); }
  if (race.clock > 20 && race.wind.p.waves >= 0.45 && Math.abs(P.twa) / D2R < 60 && P.waveRhythm < -0.15) hint('waves', t('waveTip'), 90);
}

// ---------- minimap ----------
const mini = $('#mini'), mctx = mini.getContext('2d');
mini.width = mini.height = 360; mctx.setTransform(1.5, 0, 0, 1.5, 0, 0); // drawn at 240, sharp at the bigger size
mini.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); mini.classList.toggle('big'); });
// its width on the screen: a phone's small map (under 160 px) has no labels or caption, too small there to read
let mapW = 240;
if (window.ResizeObserver) new ResizeObserver((es) => { for (const e of es) mapW = e.contentRect.width; }).observe(mini);
// the shore of Göcek bay (and the marinas' pontoons) where it comes into the map, faint, and the broadcast's grid over
// the map, every 25 px; made once for each race and map size
let shore = { key: '' };
function shoreLayer(ox, oz, s, size) {
  const key = [race.at.x, race.at.z, ox, oz, s, size].join();
  if (shore.key === key) return shore.cv;
  const n = size * 2, cv = document.createElement('canvas'); cv.width = cv.height = n;
  const x = cv.getContext('2d'), img = x.createImageData(n, n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const r = race.roomAt((i / 2 - ox) / s, (j / 2 - oz) / s);
    img.data[(j * n + i) * 4 + 3] = r < 0 ? 255 : 0;
  }
  x.putImageData(img, 0, 0);
  x.globalCompositeOperation = 'source-in'; x.fillStyle = INK.w10; x.fillRect(0, 0, n, n);
  x.globalCompositeOperation = 'source-over'; x.strokeStyle = INK.w06; x.lineWidth = 2; x.beginPath();
  for (let g = 50; g < n; g += 50) { x.moveTo(g, 0); x.lineTo(g, n); x.moveTo(0, g); x.lineTo(n, g); }
  x.stroke();
  shore = { key, cv };
  return cv;
}
// a label's width, measured once (once the web font is in)
const labelW = new Map();
function measure(ctx, s) {
  const k = ctx.font + s; let w = labelW.get(k);
  if (w === undefined) { w = ctx.measureText(s).width; if (!document.fonts || document.fonts.status === 'loaded') labelW.set(k, w); }
  return w;
}
function drawMap(ctx, size, full) {
  const c = race.course, P = race.player, W = race.wind.dir();
  // its bounds: across, every mark, the gate and a finish line of its own (a triangle's wing mark, a trapezoid's gate
  // and finish, out to the left), with the start line in view however tall the course; up and down, from the top mark
  const fin = c.finish ? [c.finish.a, c.finish.b, c.finishBoat] : [], far = [...Object.values(c.marks), { x: (c.gate[0].x + c.gate[1].x) / 2, z: c.gate[0].z }, ...fin];
  const lo = Math.min(0, ...far.map((m) => m.x)), hi = Math.max(0, ...far.map((m) => m.x)), cx = (lo + hi) / 2;
  const z0 = Math.min(...far.map((m) => m.z)) - 45, z1 = Math.max(140, ...far.map((m) => m.z + 45));
  const hw = Math.max(150, c.len / 2 + 40, (hi - lo) / 2 + 60, Math.max(c.pin.x, c.committee.x) + 20 - cx, cx - Math.min(c.pin.x, c.committee.x) + 20);
  const x0 = cx - hw, x1 = cx + hw;
  const s = Math.min(size / (x1 - x0), size / (z1 - z0)), ox = size / 2 - ((x0 + x1) / 2) * s, oz = size / 2 - ((z0 + z1) / 2) * s;
  const X = (x) => ox + x * s, Z = (z) => oz + z * s;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(shoreLayer(ox, oz, s, size), 0, 0, size, size);
  if (!full) for (const g of race.wind.gusts) {
    ctx.globalAlpha = 0.16 * g.s / race.wind.p.gustStr * (g.k ?? Math.min(1, g.life / 6)); ctx.fillStyle = INK.ink;
    ctx.beginPath(); ctx.ellipse(X(g.x), Z(g.z), g.r * s, g.r * 1.35 * s, W, 0, 7); ctx.fill(); // longer down the wind than across
  }
  ctx.globalAlpha = 1;
  // the course's lines as on the water (world.js): every one in the same dash, each kind in its colour, the start and
  // finish lines gold, the laylines yellow, the distance lines and the zones white (components/course-map.tsx alike)
  // laylines to the beat's mark, for the wind and current now (off a beat, the last beat's, as the ladder below)
  const onBeat = isBeat(c, P.leg), aim = legAim(c, beatOf(c, P.leg));
  ctx.setLineDash(LINE_DASH);
  if (onBeat || full) {
    ctx.strokeStyle = INK.lay; ctx.lineWidth = 1.5;
    const up = beatAngle(race.wind.p.tws) * D2R;
    for (const sd of [-1, 1]) {
      const hd = W + sd * up, L = 600;
      ctx.beginPath(); ctx.moveTo(X(aim.x), Z(aim.z)); ctx.lineTo(X(aim.x - Math.sin(hd) * L), Z(aim.z + Math.cos(hd) * L)); ctx.stroke();
    }
  }
  ctx.strokeStyle = INK.gold; ctx.lineWidth = 2; // the start line, and a finish line of its own, in the broadcast's gold
  for (const [a, b] of [[c.pin, c.committee], ...(c.finish ? [[c.finish.a, c.finish.b]] : [])]) { ctx.beginPath(); ctx.moveTo(X(a.x), Z(a.z)); ctx.lineTo(X(b.x), Z(b.z)); ctx.stroke(); }
  if (opts.guides) { // the distance lines across the beat, as on the water
    const j = beatOf(c, P.leg), m = legAim(c, j), beat = beatFrom(c, j).z - m.z, st = ladderStep(beat);
    ctx.strokeStyle = INK.w25; ctx.lineWidth = 1;
    for (let d = st; d < beat - 15; d += st) { const z = m.z + d, hw = Math.min(260, 30 + d * 0.95); ctx.beginPath(); ctx.moveTo(X(m.x - hw), Z(z)); ctx.lineTo(X(m.x + hw), Z(z)); ctx.stroke(); }
  }
  const next = legTargets(c, P.leg), inZone = hasZone(c, P.leg) ? next : [];
  ctx.lineWidth = 1;
  for (const m of zoneMarks(c)) { // the three-length zone (none at a mark reached on a beat: no mark-room there)
    ctx.strokeStyle = inZone.includes(m) ? INK.w78 : INK.w25;
    ctx.beginPath(); ctx.arc(X(m.x), Z(m.z), (race.zone ?? ZONE) * s, 0, 7); ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const m of [...Object.values(c.marks), ...c.gate, c.pin, c.committee, ...(c.finish ? [c.finish.a, c.finish.b] : [])]) {
    const hot = next.includes(m) && !full;
    ctx.fillStyle = INK.buoy; ctx.beginPath(); ctx.arc(X(m.x), Z(m.z), hot ? 4.5 : 3.5, 0, 7); ctx.fill();
    if (hot) { ctx.strokeStyle = INK.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X(m.x), Z(m.z), 7.5, 0, 7); ctx.stroke(); } // where you're going
  }
  const tr = P.track; if (tr.length > 1) {
    ctx.strokeStyle = INK.you; ctx.globalAlpha = full ? 1 : 0.5; ctx.lineWidth = full ? 2 : 1.5;
    ctx.beginPath(); tr.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z)))); ctx.lineTo(X(P.x), Z(P.z)); ctx.stroke(); ctx.globalAlpha = 1;
  }
  // the boats: you in your blue on top, the others white, brighter those ahead of you; a penalty ringed in red
  const rank = race.standings(), me = rank.indexOf(P), tone = (b) => (rank.indexOf(b) < me ? INK.w90 : INK.w62);
  const hull = (b) => {
    const you = b === P, k = you ? 1.3 : 1;
    ctx.save(); ctx.translate(X(b.x), Z(b.z)); ctx.rotate(b.h);
    ctx.beginPath(); ctx.moveTo(0, -6 * k); ctx.lineTo(3.5 * k, 5 * k); ctx.lineTo(-3.5 * k, 5 * k); ctx.closePath();
    ctx.fillStyle = you ? INK.you : tone(b);
    if (you) { ctx.strokeStyle = INK.inkOn; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke(); }
    ctx.fill();
    if (b.pen) { ctx.strokeStyle = INK.live; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.stroke(); }
    ctx.restore();
  };
  for (const b of race.boats) if (b !== P) hull(b);
  hull(P);
  // wind arrow, and the current if there is one
  const arrow = (x, y, ang, col, len) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, -len); ctx.lineTo(5, -len + 9); ctx.lineTo(1.5, -len + 9); ctx.lineTo(1.5, len); ctx.lineTo(-1.5, len); ctx.lineTo(-1.5, -len + 9); ctx.lineTo(-5, -len + 9); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  arrow(size - 16, 18, W + Math.PI, INK.you, 10);
  const cu = race.currentAt(P.x, P.z); // the stream where you are now
  if (cu.x || cu.z) arrow(16, size - 18, Math.atan2(cu.x, -cu.z), INK.w50, 9);
  if (full || mapW < 160) return;
  // the caption: where the leg goes (before the start, the line and then the first mark), in the broadcast's capitals
  const caps = (x) => x.toLocaleUpperCase(LANG), cy = size - 10;
  const cap = caps(P.leg < 1 ? `${t('mapStart')} · ${t(legKey(c, c.legs[1]))}` : t(legKey(c, c.legs[Math.min(P.leg, c.legs.length - 1)])));
  ctx.font = `600 12px ${INK.cond}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const spaced = 'letterSpacing' in ctx; if (spaced) ctx.letterSpacing = '1.5px';
  const cw = measure(ctx, cap);
  ctx.strokeStyle = INK.panel; ctx.lineWidth = 3; ctx.strokeText(cap, size / 2, cy); ctx.fillStyle = INK.w62; ctx.fillText(cap, size / 2, cy);
  if (spaced) ctx.letterSpacing = '0px';
  // short labels by the boats: you, the boat ahead of you, the one behind and the leader, each named as the fleet board
  // names her; one that would cover another label, a boat, an arrow or the caption is left out
  const bold = `700 12px ${INK.cond}`, semi = `600 12px ${INK.cond}`;
  const items = [];
  for (const b of [P, rank[me - 1], rank[me + 1], rank[0]]) if (b && !items.some((it) => it.b === b)) {
    const s = caps(b === P ? t('mapYou') : b.name);
    ctx.font = b === P ? bold : semi;
    items.push({ b, s, x: X(b.x), y: Z(b.z), w: measure(ctx, s), h: 12 });
  }
  const at = placeLabels(items, { size, dots: race.boats.map((b) => ({ x: X(b.x), y: Z(b.z) })),
    blocked: [{ x: size - 30, y: 0, w: 30, h: 34 }, { x: 0, y: size - 34, w: 30, h: 34 }, { x: (size - cw) / 2 - 4, y: cy - 8, w: cw + 8, h: 16 }] });
  ctx.textAlign = 'left'; ctx.strokeStyle = INK.panel; ctx.lineWidth = 3;
  items.forEach(({ b, s, y }, i) => {
    if (!at[i]) return;
    ctx.font = b === P ? bold : semi; ctx.strokeText(s, at[i].x, y);
    ctx.fillStyle = b === P ? INK.you : b.pen ? INK.live : tone(b); ctx.fillText(s, at[i].x, y);
  });
}


// ---------- the finish: the computer boats sail on to the line (fast, unseen), the race is kept, the result page opens ----------
// the fleet as it lay the moment you crossed the line: where each boat was, her heading and how she was sailing, for
// the result page to show the finish as it was (the scene behind it, /boat-view?finish=1)
function finishScene(race) {
  const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
  return new Map(race.boats.map((b) => [b, { x: r1(b.x), z: r1(b.z), h: r2(b.h), twa: r2(b.twa || 0), awa: r2(b.awa || 0), heel: Math.round(b.heel || 0),
    sail: Math.round(b.sail || 0), kite: b.kite ? 1 : 0, kiteFill: r2(b.kiteFill || 0), boom: b.boom || 1, v: r1(b.v || 0), done: b.done ? 1 : 0 }]));
}
function finishToPage() {
  if (!race.over) return;
  for (let n = 0; !race.boats.every((b) => b.done) && n < 60 * 900; n++) race.step(STEP);
  const P = race.player, s = race.settings;
  let pb = null;
  if (P.done && !P.dsq) pb = personalBest(s.daily ? `daily|${s.daily}` : pbKey(s, race), Math.round(P.finish * 10) / 10);
  const res = resultRecord(race, pb);
  keepResult(res);
  raceResult(race, res); // and on the server, so the result's link opens on any device (stats.js)
  replaceRace('/race/result/' + encodeURIComponent(res.id));
}
// The result of a race as the result page reads it: the record kept on this device and posted. pb is the personal best's
// answer (null: none), L the log of the sailor it is for
function resultRecord(race, pb = null, L = race.log) {
  const id = race._rid || (race._rid = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())));
  const c = race.course, P = race.player, s = race.settings;
  const xz = (m) => [Math.round(m.x), Math.round(m.z)];
  const stepOf = (tr) => Math.max(1, Math.ceil(tr.length / 160)); // (saved with the track: the result page times its points by it)
  const ended = (b) => (b.done ? b.finish : race.trackAt); // the clock a track ends at
  const thin = (tr) => { const k = stepOf(tr); return tr.filter((_, i) => i % k === 0 || i === tr.length - 1).map(([x, z]) => [Math.round(x), Math.round(z)]); };
  const head = L.tacks.filter((x) => x <= -3).length, lift = L.tacks.filter((x) => x >= 3).length;
  const res = {
    v: 1, id, at: Date.now(), daily: s.daily || null, preset: s.preset, length: s.length, laps: s.laps, start: s.start, current: !!s.current,
    venue: VENUE.id, ...(CLS.id !== 'jpk1050' && { yacht: CLS.id }), origin: [Math.round(race.at.x), Math.round(race.at.z)], seed: s.seed ?? null,
    course: { windward: xz(c.windward), gate: c.gate.map(xz), pin: xz(c.pin), committee: xz(c.committee), legs: c.legs, ...(c.wing && { wing: xz(c.wing) }), type: c.type,
      marks: Object.fromEntries(Object.entries(c.marks).map(([k, m]) => [k, xz(m)])), ...(c.finish && { finish: [xz(c.finish.a), xz(c.finish.b)] }) },
    boats: race.standings().map((b) => ({ name: b === P ? null : b.name, me: b === P, color: typeof b.color === 'number' ? '#' + b.color.toString(16).padStart(6, '0') : null, flag: flagCode(b === P ? playerLook().flag : LOOKS[b.name] && LOOKS[b.name].flag),
      done: !!b.done, dsq: !!b.dsq, secs: b.done && !b.out ? Math.round(b.finish * 10) / 10 : null, ...(!(b.done && !b.out) && ended(b) != null && { trackEnd: Math.round(ended(b) * 1000) / 1000 }), track: thin(b.track || []), trackStep: stepOf(b.track || []), ...(race._fin?.get(b) && { at: race._fin.get(b) }),
      legT: (b.legT || []).map((x) => Math.round(x * 10) / 10), pens: b.pens || 0, ...(b !== P && b.level && { level: b.level }) })), // the clock as she finished each leg, her penalties, and a computer skipper's level
    log: { gunD: L.gunD, gunV: L.gunV, ocs: !!L.ocs, startDsq: L.startDsq || null, startT: L.startT, sailing: L.sailing, pct: L.sailing > 20 && L.polar ? Math.round((L.v / L.polar) * 100) : null,
      head, lift, tacks: L.tacks.length, gybes: L.gybes, dirty: Math.round(L.dirty), penT: Math.round(L.penT), hails: L.hails, legs: L.legs, legPlaces: L.legPlaces || [],
      startAt: L.startAt, top: Math.round(L.top * 10) / 10, topLeg: L.topLeg, topKite: !!L.topKite,
      fouls: L.fouls.map((f) => ({ rule: String(f.rule), who: f.who || null, t: f.t ?? null, x: f.x == null ? null : Math.round(f.x), z: f.z == null ? null : Math.round(f.z) })) },
    pb: pb && { best: pb.best, isNew: pb.isNew, ...(pb.prev != null && { prev: pb.prev }) },
  };
  return res;
}
function keepResult(res) {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('regatta-result-')).sort((a, b) => (JSON.parse(localStorage.getItem(a) || '{}').at || 0) - (JSON.parse(localStorage.getItem(b) || '{}').at || 0));
    while (keys.length >= 20) localStorage.removeItem(keys.shift()); // the last twenty races stay on this device
    localStorage.setItem('regatta-result-' + res.id, JSON.stringify(res));
  } catch (e) {}
}
// A race between two people, kept on this device when it ends and posted nowhere: her record is the one a race has,
// its boats' finish, track, leg times and penalties the ones the two screens agreed on (results, wire.js resultsOf), her own log
// the sailor's. No best, no daily, no computer skipper's level. Returns the record's id
function keepOneOnOne(race, results) {
  const mine = results.boats.find((r) => r.id === race.player.id);
  const res = resultRecord(race, null, mine?.log || race.log), seen = race.standings();
  res.oneOnOne = true;
  res.daily = null;
  // in the results' order, the same on both screens (the result page's places are this order)
  res.boats = results.boats.map((r) => {
    const i = seen.findIndex((b) => b.id === r.id), b = seen[i], o = { ...res.boats[i] };
    delete o.level; delete o.trackEnd; // (this screen's: the results say where the track they carry ends)
    const dnf = !!r.dnf, done = !!r.done && !dnf;
    return { ...o, ...(b !== race.player && { flag: flagCode(lookFrom(b.look).flag) }), done, dsq: !!r.dsq, dnf, secs: done && r.finish != null ? Math.round(r.finish * 10) / 10 : null,
      ...(r.id === results.winner && { won: true }), ...(!done && r.trackEnd != null && { trackEnd: r.trackEnd }), // (the winner may never have crossed the line; a boat not home has no finish to time her track by)
      track: r.track.map(([x, z]) => [Math.round(x), Math.round(z)]), trackStep: r.trackStep, legT: (r.legT || []).map((x) => Math.round(x * 10) / 10), pens: r.pens || 0 };
  });
  keepResult(res);
  return res.id;
}
const openResult = (id) => replaceRace('/race/result/' + encodeURIComponent(id));


// personal bests, kept on this device: per course on a free race, per day on today's race. A new best's result keeps the
// one it beat (pb.prev), for the result page's "Before this race"; regatta-pb itself stays { key: seconds }
const PB_KEY = 'regatta-pb';
const pbKey = (s, r) => `${s.preset}|${s.laps}|${s.length}|${s.fleet}${r.course.type !== 'wl' ? '|' + r.course.type : ''}${CLS.id !== 'jpk1050' ? '|' + CLS.id : ''}`; // each shape but up and down is a course of its own: the one sailed
function personalBest(key, secs) {
  let all = {}; try { all = JSON.parse(localStorage.getItem(PB_KEY) || '{}'); } catch (e) {}
  const old = all[key], isNew = secs != null && (old == null || secs < old);
  if (isNew) { all[key] = secs; for (const k of Object.keys(all)) if (/^daily\|/.test(k) && k < `daily|${dailyRace(new Date(Date.now() - 7 * 864e5)).day}`) delete all[k]; try { localStorage.setItem(PB_KEY, JSON.stringify(all)); } catch (e) {} }
  return { best: isNew ? secs : old, isNew: isNew && old != null, prev: isNew ? old ?? null : null }; // prev: the best this one beat
}

// ---------- the loop ----------
let last = performance.now(), acc = 0;
const STEP = 1 / 60;
let frameN = 0;
// In a match a frame that throws costs that frame, not the race: the next one is asked for first, and the frame's
// news is dropped (a message that threw would throw again). A dead loop sends no inputs, so the guest would be
// forfeited after 30 s, and a host's guest frozen and her race abandoned after 60. Today's race and a free race keep
// the plain loop.
// The battery saver (Audio & graphics; gfx.js SAVER_MS): a frame drawn every 1/30 s, whatever the screen's rate (60, 90,
// 120 Hz), the ones between let go. The race still moves in its 1/60 s steps, two to a frame, so it sails the same; the
// phone does half the work or less, runs cooler and so doesn't slow itself down when it heats up.
let drawnAt = 0;
function loop(now) {
  if (opts.saver && now - drawnAt < SAVER_MS) { requestAnimationFrame(loop); return; }
  drawnAt = now;
  requestAnimationFrame(loop); // first: a frame that throws must not be the last one
  try { frame(now); } catch (e) {
    if (race) { race.messages.length = 0; for (const b of race.boats) b.events.length = 0; } // what it was part-way through isn't gone over again
    if (MATCH) console.error(e); else throw e; // (alone, on to the page's own handlers: the loader's failure, the visit's log)
  }
}
function frame(now) {
  const began = performance.now();
  const raw = (now - last) / 1000, dt = Math.min(0.05, raw); last = now;
  if (window.__slow) { const t0 = performance.now(); while (performance.now() - t0 < window.__slow); } // debug: pretend to be a slow phone
  const P = race.player;
  if (glLost && running && !paused && !mx) pause(); // a race begun with the picture gone (webglcontextlost, above) waits for it
  if (running && (!paused || mx)) { // (a match runs on under the pause menu)
    const kl = input.keys.ArrowLeft, kr = input.keys.ArrowRight;
    if (kl || kr) { input.rudderHeld = true; input._key = true; input.rudder = clamp(input.rudder + (kr ? 1 : -1) * dt * 2.5, -1, 1); P.auto = null; }
    else if (input._key) { input._key = false; input.rudderHeld = rudderPtr !== null; }
    if (input.keys.ArrowUp || input.keys.KeyW) setSheet(P.sheet - dt * 0.6);
    if (input.keys.ArrowDown || input.keys.KeyS) setSheet(P.sheet + dt * 0.6);
    if (!input.rudderHeld) input.rudder *= Math.exp(-dt * 5);
    if (!P.auto) P.rudder = input.rudder; else input.rudder = 0;
    if (mx) mx.step(dt); // a match: the host's game runs the race, the guest's follows it (match-ui.js)
    else {
      acc += dt * timeScale;
      while (acc >= STEP) { keepPrev(); race.step(STEP); acc -= STEP; }
      onFrame(race); // a drill's end (extras.js)
    }
    handleMessages();
    updateHud(dt);
    if (world.gfx.res === 'high' || frameN++ % 3 === 0) drawMap(mctx, 240, false);
    watchFps(raw);
    perfFrame(race, raw, levelNow(), opts.gfx, !!opts.saver); // (stats.js: a race's frames, for the site's /admin)
  } else {
    if (!running) world.orbit += dt * 0.12; // behind the menu the drone circles
    race.idle(dt);
    if (paused) { audio.update(P, true); crews.update(P, true); }
    score.update(P, dt); // paused or between races: the music fades out
    engine.update(true); jetRoar.update(true);
  }
  // The race moves in steps of 1/60 s, the screen at 60, 120 or whatever the display runs at: drawn as the last step
  // left them, the boats would move on one frame and stand still on the next (at 120 Hz, every other frame), and the
  // helm view, bolted to the hull, would judder with her. So the picture is drawn where they are between their last
  // two steps, as far on as the time left over says (a step behind at most), and the race is put back as it was.
  const lerped = running && !paused && !mx && between(acc / STEP);
  world.frame(running && (!paused || mx) ? dt * timeScale : 0, lerped ? race.t - STEP + acc : race.t, dt); // foam and wakes keep pace with the race; the cameras on the frame's clock
  if (lerped) putBack();
  frameBusy = (performance.now() - began) / 1000;
}
// what the picture takes from each boat between two steps: where she is, her heading, her heel, how high she flies
const LERP = ['x', 'z', 'h', 'heel', 'ride'];
function keepPrev() { for (const b of race.boats) { const p = b._prev || (b._prev = {}); for (const k of LERP) p[k] = b[k]; p.t = race.t; } }
function between(a) {
  if (!(a >= 0 && a < 1)) return false; // (at 0 the picture is the step before: drawing the last one would jump a step)
  let any = false;
  for (const b of race.boats) {
    const p = b._prev;
    if (!p || Math.abs(p.t + STEP - race.t) > 1e-6) { b._now = null; continue; } // no step behind her yet (a new race)
    const n = b._now || (b._now = {});
    for (const k of LERP) n[k] = b[k];
    for (const k of LERP) if (typeof p[k] === 'number' && typeof n[k] === 'number') b[k] = k === 'h' ? p.h + wrap(n.h - p.h) * a : p[k] + (n[k] - p[k]) * a;
    any = true;
  }
  return any;
}
function putBack() { for (const b of race.boats) if (b._now) { for (const k of LERP) b[k] = b._now[k]; b._now = null; } }
requestAnimationFrame(loop);
if (/[?&]debug\b/.test(location.search)) window.__rg = { get race() { return race; }, get mx() { return mx; }, get running() { return running; }, get paused() { return paused; }, world, audio, skipper, crews, asides, engine, jetRoar };
document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused && !window.__rg && !MATCH) pause(); }); // not in debug: test screenshots hide the tab; nor in a match, which runs on
