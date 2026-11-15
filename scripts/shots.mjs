// The game's own pictures of its HUD, for How to play (and the guides that show a control): a race in headless Chrome
// at each size, caught in the minute before the gun, saved to public/images, and where each HUD block sits printed as
// a share of the picture (for the numbered marks in app/[lang]/help/page.tsx).
//
//   node scripts/shots.mjs [base] [name…]     base: the site, running (npm run dev); default http://localhost:5193
//
// Chrome is driven over its DevTools protocol (Node's own WebSocket, no packages). A fresh profile each time, so the
// race is the first one: the game's first-race tips show as the call over your numbers.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [base = 'http://localhost:5193', ...only] = process.argv.slice(2);
const OUT = new URL('../public/images/', import.meta.url);

// each picture: the window (CSS pixels) and its scale, a touch screen or not, and (for a close-up) the HUD's parts to
// keep: the rest of the HUD is hidden, the scene stays
const SHOTS = [
  { name: 'hud-desk-v4', w: 1200, h: 750, dpr: 2.7, touch: false, call: true, rects: true },
  { name: 'hud-port-v4', w: 390, h: 844, dpr: 3, touch: true, call: true, rects: true },
  { name: 'h-start-v4', w: 1100, h: 825, dpr: 1920 / 1100, touch: false, keep: ['.b-top', '#nxTag'] },
  { name: 'h-steer-v4', w: 640, h: 480, dpr: 3, touch: true, keep: ['#rudderZone'] },
  { name: 'h-trim-v4', w: 640, h: 480, dpr: 3, touch: true, keep: ['#sheetZone'] },
  { name: 'h-tack-v4', w: 640, h: 480, dpr: 3, touch: true, keep: ['#sheetZone', '.b-acts'] },
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
  await S('Page.navigate', { url: `${base}/play?race=free&lang=en` });

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
    if (!st.up) continue;
    const m = /^(\d+):(\d\d)$/.exec(st.clock); left = m ? +m[1] * 60 + +m[2] : 999;
    call = st.call;
    if (s.call ? (call && left <= 62) || left <= 14 : left <= 44) break; // a call comes when it comes in the sequence
  }
  await metrics(s.dpr);
  await sleep(1500); // a few frames at the picture's scale, and the call's own entrance, settled
  if (s.keep) { // under #hud, so they outrank its hiding
    await js(`document.head.append(Object.assign(document.createElement('style'), { textContent:
      '#hud, #hud *, #nxTag, #nxTag * { visibility: hidden !important; } ' + ${JSON.stringify(s.keep.map((k) => (k.startsWith('#nxTag') ? k : `#hud ${k}`)).flatMap((k) => [k, `${k} *`]).join(', '))} + ' { visibility: visible !important; }' }))`);
    await sleep(300);
  }
  const shot = await S('Page.captureScreenshot', { format: 'jpeg', quality: 88, captureBeyondViewport: false });
  writeFileSync(new URL(`${s.name}.jpg`, OUT), Buffer.from(shot.data, 'base64'));
  let rects = '';
  if (s.rects) {
    rects = await js(`JSON.stringify(Object.fromEntries(Object.entries(${JSON.stringify(PARTS)}).map(([k, sel]) => {
      const e = document.querySelector(sel), r = e && e.getBoundingClientRect();
      if (!r || !r.width || getComputedStyle(e).visibility === 'hidden' || getComputedStyle(e).display === 'none') return [k, null];
      const p = (v, d) => +(100 * v / d).toFixed(1);
      return [k, [p(r.left, innerWidth), p(r.top, innerHeight), p(r.right, innerWidth), p(r.bottom, innerHeight)]];
    })))`);
  }
  console.log(`${s.name}: ${Math.round(s.w * s.dpr)}×${Math.round(s.h * s.dpr)} at ${left}s to the gun${s.call ? `, call ${call ? 'on' : 'off'}` : ''}${rects ? `\n  ${rects}` : ''}`);
  await send('Target.closeTarget', { targetId });
}

main().catch((e) => { console.error(e); process.exit(1); });
