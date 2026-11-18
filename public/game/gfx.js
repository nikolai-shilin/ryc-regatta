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

// Auto remembers a step down as 'medium|<when>' for three days, then tries the device's own level again: one slow
// race (another tab busy, a hot phone) shouldn't keep the picture down for good. A bare level from before is retried now.
export const GFX_KEY = 'regatta-gfx';
export const GFX_DAYS = 3;
// where a scene starts: the level chosen, Custom (its parts: o.gfxD), or on Auto this device's
export function startQuality(o) {
  const g = (o && o.gfx) || 'auto';
  if (g !== 'auto') return g;
  try {
    const [q, at] = (localStorage.getItem(GFX_KEY) || '').split('|');
    if (GFX_LEVELS.includes(q) && Date.now() - at < GFX_DAYS * 864e5) return q;
    localStorage.removeItem(GFX_KEY);
  } catch (e) {}
  return defaultQuality();
}
// the nine parts a choice draws now
export const gfxDetail = (o) => gfxParts(startQuality(o), o && o.gfxD);

// The battery saver: a frame drawn every 1/30 s, whatever the screen's rate, the ones between let go. (4 ms short of
// 1/30 s: the screen's ticks wander, and at 60 Hz the second one after a frame must count, not the third.)
export const SAVER_MS = 1000 / 30 - 4;

// A view behind a page draws as the player chose, and follows a change made on the page around it at once (the page's
// frame hears of it through the storage event). Gives back the test for the view's frame loop: true, let this frame go.
export function followSettings(world) {
  const read = () => { try { return JSON.parse(localStorage.getItem('regatta') || '{}') || {}; } catch (e) { return {}; } };
  let o = read(), drawnAt = 0;
  const apply = () => world.setQuality(startQuality(o), o.gfxD);
  apply();
  addEventListener('storage', (e) => { if (e.key === 'regatta' || e.key === GFX_KEY || e.key === null) { o = read(); apply(); } });
  return (now) => {
    if (o.saver && now - drawnAt < SAVER_MS) return true;
    drawnAt = now;
    return false;
  };
}
