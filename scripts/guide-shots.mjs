// The banners of the Learn to race guides (lib/guides.ts, lib/guides-more.ts), taken by the game: each a wide picture of
// the moment its guide is about. The computer sails MARIE through a real race on a clock of this script's own, the race
// runs forward to the moment, and a camera made for that picture takes it, the scene drawn at twice the picture's pixels.
// Wide (12:5) with her right of the middle, as the banner's words sit on the left and a phone or a card crops the sides.
//
//   node scripts/guide-shots.mjs [base] [slug…]     base: the site, running (npm run dev); default http://localhost:5193
//
// Chrome is driven over its DevTools protocol, as in scripts/shots.mjs. A picture changed is a new file name (VERSION).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [base = 'http://localhost:5193', ...only] = process.argv.slice(2);
const OUT = new URL('../public/images/', import.meta.url);
const VERSION = 'v2', W = 1920, H = 800, DPR = 2, SUPER = 2, TRIES = 6;
const BOAT = { hull: '#1c1f24', cloth: '#2a2c30', laminate: true, ink: '#ffffff', kite: '#1c1f24', bottom: '#1c1f24', deck: 'nonskid', name: 'MARIE', crew: '#1c1f24', pants: '#1c1f24', logo: 'none', nat: 'GEO', num: '13', flag: 'ge' };

// hit: on the race (R), her (P), the windward mark (M), how long since she last tacked (calm), the moment to stop at.
// cam, in metres and degrees. az: round her from the bow (0) by her leeward side (90) to the stern (180); el: up from
// level; aimY: how high on her it looks; sx, sy: where she lands in the picture, -1 to 1 from its middle.
const UPWIND = 'P.leg === 1 && calm > 12 && Math.abs(P.twa) > 0.6 && Math.abs(P.twa) < 0.95 && P.v > 2.5';
const SHOTS = {
  sail: { hit: `R.clock > 30 && ${UPWIND}`, cam: { az: 58, dist: 46, el: 5, aimY: 8, fov: 32, sx: 0.3, sy: 0 } },
  tack: { hit: 'R.clock > 25 && Math.abs(P.twa) < 0.18 && P.v > 1', freeze: true, cam: { az: 62, dist: 46, el: 5, aimY: 8, fov: 32, sx: 0.3, sy: 0 } },
  rules: { hit: `R.clock > 25 && ${UPWIND} && (window.__other = R.boats.find((b) => b !== P && Math.sign(b.twa) !== Math.sign(P.twa) && Math.abs(b.twa) > 0.55 && Math.abs(b.twa) < 1 && b.v > 2.2 && Math.hypot(b.x - P.x, b.z - P.z) > 16 && Math.hypot(b.x - P.x, b.z - P.z) < 42))`,
    freeze: true, cam: { pair: true, dist: 54, el: 8, aimY: 8, fov: 32, sx: 0.3, sy: 0, block: 0.5, anyEdge: true } },
  start: { hit: 'R.clock >= -3', cam: { line: true, dist: 60, side: 16, y: 5, aimY: 8, fov: 26, sx: 0.26, sy: 0, block: 1.05 } },
  shifts: { hit: `R.clock > 60 && ${UPWIND} && R.boats.some((b) => { const d = Math.hypot(b.x - P.x, b.z - P.z); return b !== P && d > 25 && d < 90 && (b.x - P.x) * Math.sin(P.h) - (b.z - P.z) * Math.cos(P.h) > 0; })`,
    cam: { az: 104, dist: 56, el: 15, aimY: 6, fov: 36, sx: 0.3, sy: 0, anyEdge: true } },
  marks: { hit: 'P.leg === 1 && Math.hypot(P.x - M.x, P.z - M.z) < 20', freeze: true, cam: { mark: true, dist: 34, side: 14, y: 4, aimY: 8, fov: 34, sx: 0.26, sy: 0, block: 0.45 } },
  downwind: { hit: 'P.leg >= 2 && P.kite && P.kiteFill > 0.95 && !P.kiteJob && Math.abs(P.twa) > 2.2 && calm > 8', cam: { az: 52, dist: 52, el: 6, aimY: 9, fov: 34, sx: 0.3, sy: 0 } },
  trim: { hit: `R.clock > 80 && ${UPWIND}`, cam: { az: 128, dist: 46, el: 7, aimY: 8, fov: 32, sx: 0.3, sy: 0 } },
};
const NAMES = Object.keys(SHOTS).filter((k) => !only.length || only.includes(k));

// the page's clock, in this script's hands once __manual is set: a frame is drawn when __tick says so
const CLOCK = `(() => {
  let vt = 1000; const q = [], raf = requestAnimationFrame.bind(window);
  performance.now = () => vt; window.__manual = false; window.__raf = raf;
  window.requestAnimationFrame = (f) => { if (!window.__manual) return raf(() => f(vt)); q.push(f); return q.length; };
  window.__tick = (ms) => { vt += ms; for (const f of q.splice(0)) f(vt); };
  setInterval(() => { if (!window.__manual) vt += 16; }, 16);
  try { localStorage.setItem('regatta', JSON.stringify({ gfx: 'high', played: 4, sound: 0, music: 0, voice: 0 })); localStorage.setItem('regatta-boat', ${JSON.stringify(JSON.stringify(BOAT))}); } catch (e) {}
})()`;

// the camera, set again before every frame; __blocked: another yacht is under the lens
const PLACE = (s) => `(() => {
  const G = window.__rg.world, R = window.__rg.race, P = R.player, C = G.camera, s = ${JSON.stringify(s)}, D = Math.PI / 180, M = R.course.windward;
  G.mode = 'look'; G.showGuides = false; C.fov = s.fov; C.aspect = innerWidth / innerHeight; C.updateProjectionMatrix();
  for (const g of G.wild.gulls) if (!g.__off) { g.__off = 1; Object.defineProperty(g.g, 'visible', { get: () => false, set() {} }); }
  G.plane.show(false); G.plane.update = () => {};
  G.scene.traverse((o) => { if (o.isMesh && o.geometry.type === 'ConeGeometry' && o.material.color?.getHexString() === 'ffd400') o.material.visible = false; });
  window.__place = () => {
    const f = [Math.sin(P.h), -Math.cos(P.h)], r = [Math.cos(P.h), Math.sin(P.h)], L = -Math.sign(P.twa || 1);
    let A = [P.x, s.aimY, P.z], c;
    if (s.pair) {
      const B = window.__other, u = Math.hypot(B.x - P.x, B.z - P.z), n = [-(B.z - P.z) / u, (B.x - P.x) / u], k = n[0] * r[0] * L + n[1] * r[1] * L >= 0 ? 1 : -1, d = Math.max(s.dist, u * 1.7);
      A = [(P.x + B.x) / 2, s.aimY, (P.z + B.z) / 2]; c = [A[0] + n[0] * k * d * Math.cos(s.el * D), A[1] + d * Math.sin(s.el * D), A[2] + n[1] * k * d * Math.cos(s.el * D)];
    } else if (s.line) {
      const a = R.course.committee, b = R.course.pin, u = Math.hypot(b.x - a.x, b.z - a.z); let e = [(b.x - a.x) / u, (b.z - a.z) / u];
      const ahead = R.boats.reduce((n, q) => n + Math.sign((q.x - P.x) * e[0] + (q.z - P.z) * e[1]), 0); if (ahead < 0) e = [-e[0], -e[1]];
      c = [P.x - e[0] * s.dist + e[1] * s.side, s.y, P.z - e[1] * s.dist - e[0] * s.side];
    } else if (s.mark) {
      const u = Math.max(1, Math.hypot(P.x - M.x, P.z - M.z)), e = [(P.x - M.x) / u, (P.z - M.z) / u];
      A = [(P.x + M.x) / 2, s.aimY, (P.z + M.z) / 2]; c = [M.x - e[0] * s.dist + e[1] * s.side, s.y, M.z - e[1] * s.dist - e[0] * s.side];
    } else {
      const az = s.az * D, h = s.dist * Math.cos(s.el * D), o = [f[0] * Math.cos(az) + r[0] * L * Math.sin(az), f[1] * Math.cos(az) + r[1] * L * Math.sin(az)];
      c = [P.x + o[0] * h, s.aimY + s.dist * Math.sin(s.el * D), P.z + o[1] * h];
    }
    c[1] = Math.max(c[1], 1.8);
    const dh = Math.hypot(A[0] - c[0], A[2] - c[2]), fw = [(A[0] - c[0]) / dh, (A[2] - c[2]) / dh], right = [-fw[1], fw[0]], tv = Math.tan(s.fov * D / 2), th = tv * C.aspect;
    C.position.set(c[0], c[1], c[2]);
    C.lookAt(A[0] - right[0] * s.sx * dh * th, A[1] - s.sy * dh * tv, A[2] - right[1] * s.sx * dh * th);
    C.updateMatrixWorld(true);
  };
  window.__place();
  const far = (b) => Math.hypot(b.x - C.position.x, b.z - C.position.z), me = far(P);
  return R.boats.some((b) => { // close under the lens, or cut by the picture's edge
    if (b === P || b === window.__other) return false;
    const q = C.position.clone().set(b.x, 6, b.z).project(C), x = Math.abs(q.x);
    return (far(b) < me * (s.block || 0.75) && x < 1.15) || (!s.anyEdge && q.z < 1 && far(b) < 170 && x > 0.86 && x < 1.22);
  });
})()`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const wait = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data), p = m.id && wait.get(m.id); if (p) { wait.delete(m.id); m.error ? p.no(new Error(m.error.message)) : p.ok(m.result); } };
  return { send: (method, params = {}, sessionId) => new Promise((ok, no) => { const i = ++id; wait.set(i, { ok, no }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); }), close: () => ws.close() };
}

// one try at a picture: true when it was kept
async function shoot({ send }, slug) {
  const s = SHOTS[slug], { targetId } = await send('Target.createTarget', { url: 'about:blank' }), { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => send(m, p, sessionId);
  const js = async (expression) => { const r = await S('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  try {
    await S('Page.enable'); await S('Runtime.enable');
    await S('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    await S('Page.addScriptToEvaluateOnNewDocument', { source: CLOCK });
    await S('Page.navigate', { url: `${base}/play?race=free&lang=en&debug&hour=15.5&sky=clear` });
    let up = false;
    for (let i = 0; i < 360 && !up; i++) {
      await sleep(500);
      up = await js(`(() => { const g = document.getElementById('goBtn'), p = document.getElementById('pauseCard'), l = document.getElementById('loading');
        if (g && g.offsetParent) g.click(); if (p && !p.hidden) document.getElementById('pResume')?.click();
        return !!(window.__rg && window.__rg.running && window.__rg.race?.player && (!l || l.hidden)); })()`);
    }
    if (!up) throw new Error('the race did not start');
    await sleep(2500);
    const got = await js(`(() => {
      const R = window.__rg.race, P = R.player, M = R.course.windward; P.autoTrim = true; P.crew = 0.2;
      P.ai = { skill: 0.95, lineT: 0.5, lastTack: -999, go: false, mean: R.wind.dir(), dirtyT: 0, hailT: -99, wp: 0, loiter: 1, port: false, dare: 0, lay: 0.3, groove: 0 };
      window.__manual = true;
      let n = 0, tacked = -99, calm = 0, hit = false;
      while (!P.done && n++ < 150000) {
        R.step(1 / 60); calm = R.clock - tacked;
        if (${s.hit}) { hit = true; break; }
        if (P.events.includes('tacking') || P.events.includes('gybing')) tacked = R.clock;
        for (const b of R.boats) b.events.length = 0; R.messages.length = 0;
      }
      return { hit, clock: +R.clock.toFixed(1), leg: P.leg, twa: +(P.twa * 57.3).toFixed(0), v: +P.v.toFixed(1) };
    })()`);
    if (!got.hit) { console.log(`${slug}: the moment never came`, JSON.stringify(got)); return false; }
    if (s.freeze) await js('window.__rg.race.step = () => {}'); // the race held at the moment, while the picture catches up
    for (let i = 0; i < 40; i++) await js('window.__tick(33.333)'); // the screen catches up with the jump
    if (await js(PLACE(s.cam))) { console.log(`${slug}: a yacht under the lens, again`); return false; }
    await js(`document.head.append(Object.assign(document.createElement('style'), { textContent: 'body > :not(#gl), body > :not(#gl) * { visibility: hidden !important; }' }))`);
    await S('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: false });
    await sleep(500);
    const drawn = await js(`(() => { const r = window.__rg.world.renderer; r.setPixelRatio(${DPR * SUPER}); r.setSize(innerWidth, innerHeight, false); return r.domElement.width + '×' + r.domElement.height; })()`);
    for (let i = 0; i < 4; i++) await js('window.__place(); window.__tick(16.667); new Promise((ok) => window.__raf(() => window.__raf(ok)))');
    if (await js('window.__rg.world.renderer.getContext().isContextLost()')) throw new Error(`the GPU gave up at ${drawn}`);
    const shot = await S('Page.captureScreenshot', { format: 'jpeg', quality: 92, captureBeyondViewport: false });
    writeFileSync(new URL(`gd-${slug}-${VERSION}.jpg`, OUT), Buffer.from(shot.data, 'base64'));
    console.log(`gd-${slug}-${VERSION}: ${W * DPR}×${H * DPR}, drawn at ${drawn}`, JSON.stringify(got));
    return true;
  } finally { await send('Target.closeTarget', { targetId }).catch(() => {}); }
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), 'guide-shots-'));
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9334', `--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check',
    '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
  try {
    let ver;
    for (let i = 0; i < 50 && !ver; i++) { await sleep(200); ver = await fetch('http://127.0.0.1:9334/json/version').then((r) => r.json()).catch(() => null); }
    if (!ver) throw new Error('Chrome did not start');
    const cdp = await connect(ver.webSocketDebuggerUrl);
    for (const slug of NAMES) {
      let kept = false;
      for (let t = 0; t < TRIES && !kept; t++) kept = await shoot(cdp, slug).catch((e) => { console.log(`${slug}: ${e.message}`); return false; });
      if (!kept) console.log(`${slug}: NOT TAKEN`);
    }
    cdp.close();
  } finally { chrome.kill(); await sleep(500); rmSync(dir, { recursive: true, force: true }); }
}

main().catch((e) => { console.error(e); process.exit(1); });
