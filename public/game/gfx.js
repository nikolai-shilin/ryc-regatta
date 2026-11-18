// The graphics choice, as every 3D scene reads it: the race (main.js) and the views behind the site's pages
// (public/boat-view, fleet-view, hero-view, venue-view, venues-view), and the Audio & graphics menu that sets it
// (av-menu.js). Nothing here draws, so the site's pages can import it without three.js.
//
// A level is nine parts, each high, medium or low (off, for the ones that can be): High, Medium and Low set them all
// alike, and Custom any mix of them (world.js setGraphics).
export const GFX_PARTS = ['res', 'shadows', 'sea', 'refl', 'post', 'wakes', 'under', 'land', 'life'];
export const GFX_LEVELS = ['high', 'medium', 'low'];

// a level's parts: High, Medium or Low all alike; Custom, the ones given (any part not given or not known: High)
export function gfxParts(q, custom) {
  const lv = (v) => (GFX_LEVELS.includes(v) ? v : 'high');
  return Object.fromEntries(GFX_PARTS.map((k) => [k, q === 'custom' ? lv(custom && custom[k]) : lv(q)]));
}

const phone = () => typeof navigator !== 'undefined' && /android|iphone|ipad/i.test(navigator.userAgent);
export const defaultQuality = () => (phone() ? 'medium' : 'high');

// What Auto gives up, one part one step at a time, in this order: first what you won't notice, and among those what
// frees the most. [part, the level it goes to, ms it saves, ms of that on the CPU, how much it shows: 1 hardly, 2 if you
// look for it, 3 a clear loss of detail, 4 a different picture, 5 the look of the game]. The times are each step's own,
// measured against the frame without it (2026-11-18, M3 Max, 2240 × 1400, the drone over a race: a High frame is 13.3 ms,
// 5.4 of them on the CPU); a phone's are larger, in much the same proportions.
export const GFX_LADDER = [
  ['land', 'medium', 0.5, 0.15, 1],
  ['post', 'medium', 0.4, 0.05, 1],
  ['refl', 'medium', 0.2, 0.1, 1],
  ['under', 'medium', 0.15, 0.15, 1],
  ['life', 'medium', 0.1, 0.05, 1],
  ['shadows', 'medium', 0.05, 0, 1],
  ['res', 'medium', 1.7, 0.15, 2],
  ['sea', 'medium', 0.75, 0.05, 2],
  ['under', 'low', 0.6, 0.1, 2],
  ['land', 'low', 0.2, 0, 2],
  ['wakes', 'medium', 0.05, 0.05, 2],
  ['refl', 'low', 0.3, 0.1, 3],
  ['life', 'low', 0.1, 0, 3],
  ['post', 'low', 0.8, 0, 4],
  ['res', 'low', 0.7, 0.05, 4],
  ['shadows', 'low', 0.4, 0.35, 4],
  ['sea', 'low', 1, 0.1, 5],
  ['wakes', 'low', 0.05, 0, 5],
];
const FRAME_MS = 13.3, FRAME_CPU = 5.4;
const RANK = { high: 0, medium: 1, low: 2 };

// The steps that free `need` of the frame (0.2: a fifth of it). A frame held up by the CPU gives up only what eases the
// CPU: a lower resolution wouldn't bring it a single frame back. Gives back the new parts, or null: nothing left to give.
export function shedParts(parts, need, cpuBound) {
  const cost = (r) => r[cpuBound ? 3 : 2], left = GFX_LADDER.reduce((s, r) => s - (RANK[parts[r[0]]] >= RANK[r[1]] ? cost(r) : 0), cpuBound ? FRAME_CPU : FRAME_MS);
  const out = { ...parts };
  let saved = 0, any = false;
  for (const r of GFX_LADDER) {
    if (RANK[out[r[0]]] >= RANK[r[1]] || (cpuBound && cost(r) < 0.1)) continue; // (a step that wouldn't help is passed over, on the way to one that will)
    out[r[0]] = r[1]; saved += cost(r); any = true;
    if (saved >= need * left) break;
  }
  return any ? out : null;
}
// the last step given up, back again (never past `base`, where this device starts); null: all of them are back
export function raiseParts(parts, base) {
  for (let i = GFX_LADDER.length - 1; i >= 0; i--) {
    const [k, to] = GFX_LADDER[i];
    if (parts[k] === to && RANK[to] > RANK[base[k]]) return { ...parts, [k]: GFX_LEVELS[RANK[to] - 1] };
  }
  return null;
}
// every part a level lighter, after the GPU ran out of memory (main.js webglcontextlost)
export const lighterParts = (parts) => Object.fromEntries(GFX_PARTS.map((k) => [k, GFX_LEVELS[Math.min(RANK[parts[k]] + 1, 2)]]));
// the level these parts come closest to
export const gfxLevel = (parts) => GFX_LEVELS[Math.round(GFX_PARTS.reduce((s, k) => s + RANK[parts[k]], 0) / GFX_PARTS.length)];

// Auto, frame by frame: give it each frame's time since the last, the time the frame kept the CPU busy (s), the parts
// drawn and the battery saver; it gives back the parts to draw, when they should change.
// It goes by the middle frame of each 3 s, not their average: one stall (the tab away in a match, which runs on unpaused;
// a notification; a frame that waited on the disk) would pull a steady 60 fps under 45 by itself. A frame over 0.25 s is
// such a stall, and isn't counted at all. Under 45 fps (with the battery saver, whose frames come at 30 a second by
// choice, under 27) it gives up as much as the frame is short of. Steady at full rate for 40 s it tries one step back;
// if that step brings the frames down again within 20 s it waits three times as long before the next try, up to 15 minutes.
// Two rounds of giving up that buy no frames at all mean the picture isn't what holds them back (a phone in low power
// mode draws 30 a second whatever it's given): the picture comes back as it was, and stays unless the frames get worse.
export function autoTuner(base) {
  let settle = 3, t = 0, d = [], b = [], calm = 0, wait = 40, clock = 0, raisedAt = -Infinity, tried = null, capped = 0;
  const mid = (a) => a.sort((x, y) => x - y)[a.length >> 1];
  return (raw, busy, parts, saver) => {
    if (raw > 0.25) return null;
    clock += raw;
    if (settle > 0) { settle -= raw; return null; }
    t += raw; d.push(raw); b.push(busy);
    if (t < 3) return null;
    const frame = mid(d), work = mid(b), span = t, target = 1 / (saver ? 27 : 45);
    t = 0; d = []; b = [];
    if (frame > target) {
      calm = 0;
      if (clock - raisedAt < 20) { wait = Math.min(wait * 3, 900); raisedAt = -Infinity; }
      if (capped && frame <= capped * 1.15) return null;
      if (tried && frame < tried.frame * 0.95) tried = null; // that helped
      if (tried && tried.rounds >= 2) { const back = tried.parts; capped = frame; tried = null; settle = 2; return back; }
      const next = shedParts(parts, 1 - target / frame, work > target * 0.75);
      if (next) { settle = 2; if (tried) tried.rounds++; else tried = { parts, frame, rounds: 1 }; }
      return next;
    }
    tried = null;
    if (frame < capped * 0.85) capped = 0;
    calm = frame <= 1 / (saver ? 28 : 55) ? calm + span : 0;
    if (calm < wait) return null;
    calm = 0;
    const next = raiseParts(parts, base);
    if (next) { raisedAt = clock; settle = 2; }
    return next;
  };
}

// Auto remembers what it gave up as 'mhmmhhhmh|<when>' (each part's first letter, in GFX_PARTS order) for three days,
// then tries the device's own level again: one slow race (another tab busy, a hot phone) shouldn't keep the picture down
// for good. A bare level ('medium|<when>') is what it remembered before it went part by part.
export const GFX_KEY = 'regatta-gfx';
export const GFX_DAYS = 3;
export const autoBase = () => gfxParts(defaultQuality());
const unpack = (s) => {
  if (GFX_LEVELS.includes(s)) return gfxParts(s);
  if (s.length !== GFX_PARTS.length || !/^[hml]+$/.test(s)) return null;
  return Object.fromEntries(GFX_PARTS.map((k, i) => [k, GFX_LEVELS.find((l) => l[0] === s[i])]));
};
export function autoParts() {
  try {
    const [s, at] = (localStorage.getItem(GFX_KEY) || '').split('|'), p = unpack(s);
    if (p && Date.now() - at < GFX_DAYS * 864e5) return p;
    localStorage.removeItem(GFX_KEY);
  } catch (e) {}
  return autoBase();
}
export function saveAuto(parts) {
  const base = autoBase();
  try {
    if (GFX_PARTS.every((k) => parts[k] === base[k])) localStorage.removeItem(GFX_KEY);
    else localStorage.setItem(GFX_KEY, `${GFX_PARTS.map((k) => parts[k][0]).join('')}|${Date.now()}`);
  } catch (e) {}
}
// the parts Auto has eased off on this device, for the menu to name
export const autoEased = (parts) => { const base = autoBase(); return GFX_PARTS.filter((k) => RANK[parts[k]] > RANK[base[k]]); };

// what a choice draws, as world.setQuality takes it: a level, or Custom and its parts (Auto's, once they're a mix)
export function gfxNow(o) {
  const g = (o && o.gfx) || 'auto';
  if (g !== 'auto') return [g, o && o.gfxD];
  const p = autoParts(), q = gfxLevel(p);
  return GFX_PARTS.every((k) => p[k] === q) ? [q] : ['custom', p];
}
// the choice in a word: the level chosen, Custom, or on Auto the level it's closest to now
export function startQuality(o) {
  const g = (o && o.gfx) || 'auto';
  return g === 'auto' ? gfxLevel(autoParts()) : g;
}
// the nine parts a choice draws now
export const gfxDetail = (o) => gfxParts(...gfxNow(o));

// The battery saver: a frame drawn every 1/30 s, whatever the screen's rate, the ones between let go. (4 ms short of
// 1/30 s: the screen's ticks wander, and at 60 Hz the second one after a frame must count, not the third.)
export const SAVER_MS = 1000 / 30 - 4;

// A view behind a page draws as the player chose, and follows a change made on the page around it at once (the page's
// frame hears of it through the storage event). Gives back the test for the view's frame loop: true, let this frame go.
export function followSettings(world) {
  const read = () => { try { return JSON.parse(localStorage.getItem('regatta') || '{}') || {}; } catch (e) { return {}; } };
  let o = read(), drawnAt = 0;
  const apply = () => world.setQuality(...gfxNow(o));
  apply();
  addEventListener('storage', (e) => { if (e.key === 'regatta' || e.key === GFX_KEY || e.key === null) { o = read(); apply(); } });
  return (now) => {
    if (o.saver && now - drawnAt < SAVER_MS) return true;
    drawnAt = now;
    return false;
  };
}
