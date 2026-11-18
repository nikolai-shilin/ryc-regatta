'use client';
import { useEffect, useState } from 'react';

// When the 3D scene behind a page may start. The scene is the whole game, 3 MB and seconds of a phone's time, and it
// shares the page's thread, so it waits until the page has loaded and gone idle. Where it is only the backdrop it isn't
// started at all for a reader who has asked to save data, is on a slow connection, or holds a phone short of memory:
// the sea's colours stay behind the words.
type Net = { saveData?: boolean; effectiveType?: string };
export function sceneOff() {
  const n = navigator as Navigator & { connection?: Net; deviceMemory?: number };
  const slow = n.connection?.saveData || /(^|-)(2g|3g)$/.test(n.connection?.effectiveType || '');
  const small = (n.deviceMemory ?? 8) <= 4 && matchMedia('(pointer: coarse)').matches;
  return !!slow || small || (n.hardwareConcurrency || 8) <= 2;
}

// go: start it now; off: it won't start (only when `optional`: a scene the page can't do without always does)
export function useSceneStart(optional = true) {
  const [state, setState] = useState({ go: false, off: false });
  useEffect(() => {
    if (optional && sceneOff()) { setState({ go: false, off: true }); return; }
    let idle = 0, timer = 0;
    const start = () => setState({ go: true, off: false });
    const go = () => {
      if (window.requestIdleCallback) idle = window.requestIdleCallback(start, { timeout: 2000 });
      else timer = window.setTimeout(start, 200);
    };
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
    return () => { window.removeEventListener('load', go); if (idle) window.cancelIdleCallback(idle); clearTimeout(timer); };
  }, [optional]);
  return state;
}
