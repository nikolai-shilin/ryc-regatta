// Every picture of the game on the site, taken by the game: the race screen and its close-ups for How to play (and the
// guides that show a control), and the scene with no HUD — the home's hero, the fleet from above, the three views, the
// wind ring and the share card. A race in headless Chrome at each size, caught in the minute before the gun, saved to
// public/images, and where each HUD block sits printed as a share of the picture (for the numbered marks in
// app/[lang]/help/page.tsx).
//
//   node scripts/shots.mjs [base] [name…]     base: the site, running (npm run dev); default http://localhost:5193
//
// Chrome is driven over its DevTools protocol (Node's own WebSocket, no packages). A fresh profile each time, so the
// race is the first one: the game's first-race tips show as the call over your numbers. Every picture is in the same
// light (LIGHT: Göcek, the free race's own venue, an afternoon under a clear sky), at High graphics.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [base = 'http://localhost:5193', ...only] = process.argv.slice(2);
const OUT = new URL('../public/images/', import.meta.url);

const LIGHT = 'hour=15.5&sky=clear';

// each picture: the window (CSS pixels) and its scale, a touch screen or not, and (for a close-up) the HUD's parts to
// keep: the rest of the HUD (and the yachts' tags) is hidden, the scene stays (keep: [] is the scene alone). cam: the camera, set on the game's
// world (world.js: mode drone, top or helm; dist, orbit in radians round her, droneEl in degrees down, helmFov, look).
// out: the picture scaled to that size after it is taken (the share card, kept small for WhatsApp). q: the race page's
// own options instead of the minute before the gun (a drill: its computer skipper sails her to the moment, then she's
// yours), prep run on her (P) once the race is up, and until, on her too, the moment to take it.
const SHOTS = [
  { name: 'hud-desk-v8', w: 1200, h: 750, dpr: 2.7, touch: false, call: true, rects: true },
  { name: 'hud-port-v8', w: 390, h: 844, dpr: 3, touch: true, call: true, rects: true },
  { name: 'h-start-v8', w: 1100, h: 825, dpr: 1920 / 1100, touch: false, keep: ['.b-top', '#nxTag'] },
  { name: 'h-steer-v8', w: 640, h: 480, dpr: 3, touch: true, keep: ['#rudderZone'] },
  { name: 'h-trim-v8', w: 640, h: 480, dpr: 3, touch: true, keep: ['#sheetZone'] },
  { name: 'h-tack-v8', w: 640, h: 480, dpr: 3, touch: true, keep: ['#sheetZone', '.b-acts'] },
  { name: 'drone-desk-v8', w: 1600, h: 1000, dpr: 2.7, touch: false, keep: [], cam: { mode: 'drone', dist: 30, orbit: 'lee', droneEl: 16 } },
  { name: 'drone-port-v8', w: 390, h: 844, dpr: 3, touch: true, keep: [], cam: { mode: 'drone', dist: 26, orbit: 'lee', droneEl: 18, orbitMax: 0.35 } },
  { name: 'top-v8', w: 1266, h: 585, dpr: 3, touch: false, keep: [], cam: { mode: 'top', dist: 70 } },
  { name: 'og-v8', w: 1200, h: 630, dpr: 2, touch: false, keep: [], cam: { mode: 'drone', dist: 30, orbit: 'lee', droneEl: 16 }, out: [1200, 630] },
  { name: 'h-wind-v8', w: 640, h: 480, dpr: 3, touch: false, keep: [], cam: { mode: 'top', dist: 9 } },
  { name: 'h-view-drone-v8', w: 640, h: 480, dpr: 3, touch: false, keep: [], cam: { mode: 'drone', dist: 30, orbit: 'lee', droneEl: 22 } },
  { name: 'h-view-top-v8', w: 640, h: 480, dpr: 3, touch: false, keep: [], cam: { mode: 'top', dist: 40 } },
  { name: 'h-run-v8', w: 1100, h: 825, dpr: 1920 / 1100, touch: false, keep: [], q: 'drill=run', prep: 'P.setKite(true)', until: 'P.kite && P.kiteFill > 0.95 && !P.kiteJob', cam: { mode: 'drone', dist: 40, orbit: 'kite', droneEl: 20, orbitMax: 1.1 } },
  { name: 'h-view-helm-v8', w: 640, h: 480, dpr: 3, touch: false, keep: [], cam: { mode: 'helm', helmFov: 68, look: 0 } },
].filter((s) => !only.length || only.includes(s.name));

// the HUD's blocks, for the marks
const PARTS = { bug: '.b-bug', gun: '.b-top', btns: '.b-btns', wind: '.b-wind', board: '.b-board', map: '.b-map', call: '#toast', you: '.b-you',
  acts: '.b-acts', sheet: '#sheet', rudder: '#rudder', tag: '#nxTag .in', flags: '.b-flagbox' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const dir = mkdtempSync(join(tmpdir(), 'shots-'));
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9333', `--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check',
    '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
  try {
    let ver;
    for (let i = 0; i < 50 && !ver; i++) { await sleep(200); ver = await fetch('http://127.0.0.1:9333/json/version').then((r) => r.json()).catch(() => null); }
    if (!ver) throw new Error('Chrome did not start');
    const cdp = await connect(ver.webSocketDebuggerUrl);
    for (const s of SHOTS) await shoot(cdp, s);
    cdp.close();
  } finally {
    chrome.kill();
    await sleep(500);
    rmSync(dir, { recursive: true, force: true });
  }
}

// the protocol: requests by id, one session a page (flattened)
async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const wait = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    const p = m.id && wait.get(m.id);
    if (p) { wait.delete(m.id); m.error ? p.no(new Error(`${m.error.message}`)) : p.ok(m.result); }
  };
  const send = (method, params = {}, sessionId) => new Promise((ok, no) => { const i = ++id; wait.set(i, { ok, no }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  return { send, close: () => ws.close() };
}

async function shoot({ send }, s) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => send(m, p, sessionId);
  const js = async (expression) => (await S('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
  await S('Page.enable'); await S('Runtime.enable');
  // the race runs at the screen's own scale until the picture (at three times it the frames are slow, and the game's
  // clock slows with them), then the picture's scale for its last few frames
  const metrics = (dpr) => S('Emulation.setDeviceMetricsOverride', { width: s.w, height: s.h, deviceScaleFactor: dpr, mobile: s.touch });
  await metrics(1);
  if (s.touch) await S('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  // High graphics, so the picture's scale doesn't make the game step down to Medium on its slow frames
  await S('Page.navigate', { url: `${base}/robots.txt` }); await sleep(1000);
  await js(`localStorage.setItem('regatta', JSON.stringify({ gfx: 'high' }))`);
  await S('Page.navigate', { url: `${base}/play?race=free&lang=en&debug&${LIGHT}${s.q ? `&${s.q}` : ''}` });

  // the race under way, not paused, then the right moment: the minute before the gun, and where the picture shows the
  // call, something in it (a tip, the committee's signal; not a warning about the day's flag)
  const t0 = Date.now();
  let left = 999, call = false;
  while (Date.now() - t0 < 240000) {
    await sleep(500);
    const st = await js(`(() => {
      const p = document.getElementById('pauseCard'); if (p && !p.hidden) document.getElementById('pResume')?.click();
      const g = document.querySelector('#hud.bc .b-gunn'), l = document.getElementById('loading');
      return { up: !!g && (!l || l.hidden), clock: g ? g.textContent : '', call: !!document.querySelector('#toast.show') && !/disqualif|UFD|BFD|you’re out/i.test(document.getElementById('toast').textContent) };
    })()`);
    if (s.q) { // a moment of the race's own, not the gun's
      const ok = await js(`(() => { const l = document.getElementById('loading'), R = window.__rg && window.__rg.race, P = R && R.player;
        if (!P || (l && !l.hidden)) return false; if (!window.__prep) { window.__prep = 1; ${s.prep || ''}; } return !!(${s.until || 'true'}); })()`);
      if (ok) break; continue;
    }
    if (!st.up) continue;
    const m = /^(\d+):(\d\d)$/.exec(st.clock); left = m ? +m[1] * 60 + +m[2] : 999;
    call = st.call;
    if (s.call ? (call && left <= 62) || left <= 14 : left <= 44) break; // a call comes when it comes in the sequence
  }
  // the camera glides there over the next frames. orbit 'lee': the drone off her leeward quarter, looking up to windward
  // past the sails' faces (not along their edges from dead astern), and swung towards the nearest yacht ahead, so she
  // has company in the picture. orbit 'kite': off the other quarter, on a run the gennaker's side, where the main doesn't
  // hide it (orbitMax: how far it may swing; a tall frame, narrow across, keeps her nearer its middle)
  if (s.cam) await js(`(() => {
    const W = window.__rg.world, R = window.__rg.race, P = R.player, cam = ${JSON.stringify(s.cam)}, max = cam.orbitMax || 0.7;
    delete cam.orbitMax;
    if (cam.orbit === 'lee' || cam.orbit === 'kite') {
      const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)), up = -Math.sign(P.twa || 1) * (cam.orbit === 'kite' ? -1 : 1);
      let o = Math.min(0.45, max) * up, best = 160;
      for (const b of R.boats) {
        if (b === P) continue;
        const d = Math.hypot(b.x - P.x, b.z - P.z), rel = wrap(Math.atan2(b.x - P.x, -(b.z - P.z)) - P.h);
        if (d < best && Math.abs(rel) < 1.1) { best = d; o = Math.max(-max, Math.min(max, 0.55 * rel + 0.2 * up)); }
      }
      cam.orbit = o;
    }
    Object.assign(W, cam); return true;
  })()`);
  await metrics(s.dpr);
  await sleep(s.cam ? 2500 : 1500); // a few frames at the picture's scale, and the call's own entrance (or the camera), settled
  if (s.keep) { // under #hud, so they outrank its hiding; with nothing kept, everything over the scene goes
    await js(`document.head.append(Object.assign(document.createElement('style'), { textContent: ${JSON.stringify(s.keep.length
      ? `#hud, #hud *, #nxTag, #nxTag *, #bOver, #bOver * { visibility: hidden !important; } ${s.keep.map((k) => (k.startsWith('#nxTag') ? k : `#hud ${k}`)).flatMap((k) => [k, `${k} *`]).join(', ')} { visibility: visible !important; }`
      : 'body > :not(#gl), body > :not(#gl) * { visibility: hidden !important; }')} }))`);
    await sleep(300);
  }
  const shot = await S('Page.captureScreenshot', { format: 'jpeg', quality: 88, captureBeyondViewport: false });
  const file = new URL(`${s.name}.jpg`, OUT);
  writeFileSync(file, Buffer.from(shot.data, 'base64'));
  if (s.out) execFileSync('sips', ['-z', String(s.out[1]), String(s.out[0]), '-s', 'formatOptions', '82', file.pathname, '--out', file.pathname], { stdio: 'ignore' }); // macOS's own
  let rects = '';
  if (s.rects) {
    rects = await js(`JSON.stringify(Object.fromEntries(Object.entries(${JSON.stringify(PARTS)}).map(([k, sel]) => {
      const e = document.querySelector(sel), r = e && e.getBoundingClientRect();
      if (!r || !r.width || getComputedStyle(e).visibility === 'hidden' || getComputedStyle(e).display === 'none') return [k, null];
      const p = (v, d) => +(100 * v / d).toFixed(1);
      return [k, [p(r.left, innerWidth), p(r.top, innerHeight), p(r.right, innerWidth), p(r.bottom, innerHeight)]];
    })))`);
  }
  console.log(`${s.name}: ${s.out ? s.out.join('×') : `${Math.round(s.w * s.dpr)}×${Math.round(s.h * s.dpr)}`} at ${left}s to the gun${s.call ? `, call ${call ? 'on' : 'off'}` : ''}${rects ? `\n  ${rects}` : ''}`);
  await send('Target.closeTarget', { targetId });
}

main().catch((e) => { console.error(e); process.exit(1); });
