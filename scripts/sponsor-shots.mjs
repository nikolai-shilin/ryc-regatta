// The sponsorship page's pictures of the race itself: JPK 1050s racing at Göcek in a real race, dressed in the sails
// the site's /sponsor answers for Göcek (the Turkey set: the red gennaker with the crescent and star, the jib's banner,
// the logo on the main). The computer sails MARIE among a fleet of seven on a clock of this script's own, the race runs
// forward to the moment, is held there, and a camera made for that picture takes it, the scene drawn at twice the
// picture's pixels. 16:10, as the page shows them.
//
//   node scripts/sponsor-shots.mjs [base] [name…]     base: the site, running (npm run dev); default http://localhost:5193
//
// Chrome is driven over its DevTools protocol, as in scripts/shots.mjs and scripts/guide-shots.mjs (whose clock and
// camera this follows). A picture changed is a new file name. Every race comes out its own way, so the pictures are
// chosen: DRAFT=<dir> keeps every try there (KEEP of them, each from the cameras in ANGLES), and the one chosen is copied
// to public/images; without it, the first that comes is saved there.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [base = 'http://localhost:5193', ...only] = process.argv.slice(2);
const OUT = new URL('../public/images/', import.meta.url);
const W = 1600, H = 1000, DPR = 1.5, SUPER = 2, TRIES = +process.env.TRIES || 8, PORT = +process.env.CDP_PORT || 9335;
const BOAT = { hull: '#1c1f24', cloth: '#2a2c30', laminate: true, ink: '#ffffff', kite: '#1c1f24', bottom: '#1c1f24', deck: 'nonskid', name: 'MARIE', crew: '#1c1f24', pants: '#1c1f24', logo: 'none', nat: 'GEO', num: '13', flag: 'ge' };

// hit: on the race (R), her (P), the windward mark (M), how long since she last tacked (calm), the moment to hold.
// cam: round a point (on: 'me', her; 'mark', the yachts near the windward mark; 'pack', the yachts near her), in metres
// and degrees. az: from her bow (0) by her leeward side (90) to her stern (180); or, for a group, wind: from dead
// downwind of it (0) round to the right; el: up from level (or y: the camera's height); aimY: how high it looks;
// sx, sy: where the point lands in the picture, -1 to 1 from its middle. mark: the sail whose outline is printed for the
// page's mark (V[mark] of her own boat's view). CAM='{"dist":90}' in the environment: to try a camera.
const near = (r, x, z) => `R.boats.filter((b) => Math.hypot(b.x - ${x}, b.z - ${z}) < ${r})`;
const kited = 'b.kite && b.kiteFill > 0.8 && !b.kiteJob';
const SHOTS = {
  // the hero: the pack at the windward mark, MARIE bearing away under her gennaker among the yachts still beating up to
  // it, heeled and hiking, seen low off her leeward bow with the pack behind her
  'sp-pack-v1': { hit: `R.clock > 40 && P.leg >= 2 && P.kite && P.kiteFill > 0.9 && Math.hypot(P.x - M.x, P.z - M.z) < 70 && ((n) => n.length >= 5 && n.filter((b) => b.leg === 1).length >= 2)(${near(70, 'M.x', 'M.z')})`,
    cam: { on: 'me', az: 25, dist: 34, el: 3, aimY: 8, fov: 38, sx: 0.35, sy: 0 } },
  // the gennaker: MARIE on the run under hers, with company under theirs, seen off her leeward bow
  'sp-kite-v1': { hit: `P.leg >= 2 && P.kite && P.kiteFill > 0.95 && !P.kiteJob && Math.abs(P.twa) > 2.2 && calm > 8 && R.boats.filter((b) => b !== P && ${kited} && Math.hypot(b.x - P.x, b.z - P.z) < 80).length >= 2`,
    mark: 'kite', cam: { on: 'me', az: 45, dist: 38, el: 6, aimY: 9, fov: 34, sx: 0.28, sy: 0 } },
  // the fleet down the run, every sail at once: jibs, mains and gennakers, from off their bows and a little above
  'sp-run-v1': { hit: `P.leg >= 2 && P.kite && P.kiteFill > 0.95 && calm > 8 && R.boats.filter((b) => ${kited} && Math.hypot(b.x - P.x, b.z - P.z) < 90).length >= 4`,
    cam: { on: 'pack', r: 90, wind: 120, dist: 100, el: 5, aimY: 6, fov: 30, sx: 0, sy: -0.05 } },
};
const NAMES = Object.keys(SHOTS).filter((k) => !only.length || only.includes(k));

// the page's clock, in this script's hands once __manual is set: a frame is drawn when __tick says so
const CLOCK = `(() => {
  let vt = 1000; const q = [], raf = requestAnimationFrame.bind(window);
  performance.now = () => vt; window.__manual = false; window.__raf = raf;
  window.requestAnimationFrame = (f) => { if (!window.__manual) return raf(() => f(vt)); q.push(f); return q.length; };
  window.__tick = (ms) => { vt += ms; for (const f of q.splice(0)) f(vt); };
  setInterval(() => { if (!window.__manual) vt += 16; }, 16);
  try { localStorage.setItem('regatta', JSON.stringify({ mode: 'free', fleet: 7, fleetV: 3, length: 'short', laps: 1, course: 'wl', preset: 'medium', gfx: 'high', played: 4, sound: 0, music: 0, voice: 0 })); localStorage.setItem('regatta-boat', ${JSON.stringify(JSON.stringify(BOAT))}); } catch (e) {}
})()`;

// the camera, set again before every frame; true: a yacht is under the lens, or cut by the picture's edge close by
const PLACE = (s) => `(() => {
  const G = window.__rg.world, R = window.__rg.race, P = R.player, C = G.camera, s = ${JSON.stringify(s)}, D = Math.PI / 180, M = R.course.windward;
  G.mode = 'look'; G.showGuides = false; C.fov = s.fov; C.aspect = innerWidth / innerHeight; C.updateProjectionMatrix();
  for (const g of G.wild.gulls) if (!g.__off) { g.__off = 1; Object.defineProperty(g.g, 'visible', { get: () => false, set() {} }); }
  G.plane.show(false); G.plane.update = () => {};
  G.scene.traverse((o) => { if (o.isMesh && o.geometry.type === 'ConeGeometry' && o.material.color?.getHexString() === 'ffd400') o.material.visible = false; });
  const group = s.on === 'me' ? [P] : R.boats.filter((b) => Math.hypot(b.x - (s.on === 'mark' ? M.x : P.x), b.z - (s.on === 'mark' ? M.z : P.z)) < s.r);
  window.__group = group;
  window.__place = () => {
    const A = [group.reduce((t, b) => t + b.x, 0) / group.length, s.aimY, group.reduce((t, b) => t + b.z, 0) / group.length];
    let o;
    if (s.on === 'me') {
      const f = [Math.sin(P.h), -Math.cos(P.h)], r = [Math.cos(P.h), Math.sin(P.h)], L = -Math.sign(P.twa || 1), az = s.az * D;
      o = [f[0] * Math.cos(az) + r[0] * L * Math.sin(az), f[1] * Math.cos(az) + r[1] * L * Math.sin(az)];
    } else {
      const d = R.wind.dir() + s.wind * D; o = [-Math.sin(d), Math.cos(d)]; // (wind.dir() + 0: dead downwind of the point)
    }
    const h = s.y != null ? s.dist : s.dist * Math.cos(s.el * D), c = [A[0] + o[0] * h, s.y != null ? s.y : s.aimY + s.dist * Math.sin(s.el * D), A[2] + o[1] * h];
    c[1] = Math.max(c[1], 1.8);
    const dh = Math.hypot(A[0] - c[0], A[2] - c[2]), fw = [(A[0] - c[0]) / dh, (A[2] - c[2]) / dh], right = [-fw[1], fw[0]], tv = Math.tan(s.fov * D / 2), th = tv * C.aspect;
    C.position.set(c[0], c[1], c[2]);
    C.lookAt(A[0] - right[0] * s.sx * dh * th, A[1] - s.sy * dh * tv, A[2] - right[1] * s.sx * dh * th);
    C.updateMatrixWorld(true);
  };
  window.__place();
  const far = (b) => Math.hypot(b.x - C.position.x, b.z - C.position.z), me = Math.min(...group.map(far));
  return R.boats.some((b) => {
    if (group.includes(b)) return false;
    const q = C.position.clone().set(b.x, 6, b.z).project(C), x = Math.abs(q.x);
    return (q.z < 1 && far(b) < me * 0.8 && x < 1.15) || (q.z < 1 && far(b) < me + 60 && x > 0.86 && x < 1.22);
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
async function shoot({ send }, name, t) {
  const s = SHOTS[name], { targetId } = await send('Target.createTarget', { url: 'about:blank' }), { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => send(m, p, sessionId);
  const js = async (expression) => { const r = await S('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  try {
    await S('Page.enable'); await S('Runtime.enable');
    await S('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    await S('Page.addScriptToEvaluateOnNewDocument', { source: CLOCK });
    await S('Page.navigate', { url: `${base}/play?race=free&lang=en&debug&venue=gocek&boat=jpk1050&hour=15.5&sky=clear` });
    let up = false;
    for (let i = 0; i < 360 && !up; i++) {
      await sleep(500);
      up = await js(`(() => { const g = document.getElementById('goBtn'), p = document.getElementById('pauseCard'), l = document.getElementById('loading');
        if (g && g.offsetParent) g.click(); if (p && !p.hidden) document.getElementById('pResume')?.click();
        return !!(window.__rg && window.__rg.running && window.__rg.race?.player && (!l || l.hidden)); })()`);
    }
    if (!up) throw new Error('the race did not start');
    await sleep(2500);
    // MARIE sailed by a club-to-racer skipper, so she is among the fleet rather than clear ahead of it
    const got = await js(`(() => {
      const R = window.__rg.race, P = R.player, M = R.course.windward; P.autoTrim = true; P.crew = 0.2;
      P.ai = { skill: ${t % 2 ? 0.55 : 0.7}, lineT: 0.5, lastTack: -999, go: false, mean: R.wind.dir(), dirtyT: 0, hailT: -99, wp: 0, loiter: 1, port: false, dare: 0, lay: 0.3, groove: 0 };
      window.__manual = true;
      let n = 0, tacked = -99, calm = 0, hit = false;
      while (!P.done && n++ < 150000) {
        R.step(1 / 60); calm = R.clock - tacked;
        if (${s.hit}) { hit = true; break; }
        if (P.events.includes('tacking') || P.events.includes('gybing')) tacked = R.clock;
        for (const b of R.boats) b.events.length = 0; R.messages.length = 0;
      }
      return { hit, clock: +R.clock.toFixed(1), leg: P.leg, twa: +(P.twa * 57.3).toFixed(0), v: +P.v.toFixed(1), fleet: R.boats.length, cls: R.player.cls?.id };
    })()`);
    if (!got.hit) { console.log(`${name}: the moment never came`, JSON.stringify(got)); return false; }
    await js('window.__rg.race.step = () => {}'); // the race held at the moment, while the picture catches up
    for (let i = 0; i < 40; i++) await js('window.__tick(33.333)'); // the screen catches up with the jump
    // ANGLES='[{"wind":10},{"wind":40}]' in the environment, with DRAFT: the same moment from each of those cameras
    const angles = process.env.DRAFT ? JSON.parse(process.env.ANGLES || '[{}]') : [{}];
    for (const [k, a] of angles.entries()) {
      const blocked = await js(PLACE({ ...s.cam, ...JSON.parse(process.env.CAM || '{}'), ...a }));
      if (blocked) { if (!process.env.DRAFT) { console.log(`${name}: a yacht under the lens, again`); return false; } }
      if (!k) {
        await js(`document.head.append(Object.assign(document.createElement('style'), { textContent: 'body > :not(#gl), body > :not(#gl) * { visibility: hidden !important; }' }))`);
        await S('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: false });
        await sleep(500);
      }
      const drawn = await js(`(() => { const r = window.__rg.world.renderer; r.setPixelRatio(${DPR * SUPER}); r.setSize(innerWidth, innerHeight, false); return r.domElement.width + '×' + r.domElement.height; })()`);
      for (let i = 0; i < 4; i++) await js('window.__place(); window.__tick(16.667); new Promise((ok) => window.__raf(() => window.__raf(ok)))');
      if (await js('window.__rg.world.renderer.getContext().isContextLost()')) throw new Error(`the GPU gave up at ${drawn}`);
      const shot = await S('Page.captureScreenshot', { format: 'jpeg', quality: 90, captureBeyondViewport: false });
      const file = process.env.DRAFT ? new URL(`file://${process.env.DRAFT}/${name}-${t}${angles.length > 1 ? `-${k}` : ''}.jpg`) : new URL(`${name}.jpg`, OUT);
      writeFileSync(file, Buffer.from(shot.data, 'base64'));
      let mark = '';
      if (s.mark) { // where her sail came out, for the page's mark: left, top, width and height in % of the picture
        mark = await js(`(() => {
          const W = window.__rg.world, R = window.__rg.race, C = W.camera, V = W.boatViews[R.boats.indexOf(R.player)], o = V[${JSON.stringify(s.mark)}], p = C.position.clone(); let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
          o.updateMatrixWorld(true);
          o.traverse((m) => { if (!m.isMesh || !m.visible) return; const A = m.geometry.attributes.position; for (let i = 0; i < A.count; i++) { p.fromBufferAttribute(A, i).applyMatrix4(m.matrixWorld).project(C); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); } });
          const c = (v) => Math.max(0, Math.min(100, v)), d = (v) => +v.toFixed(1), l = c((x0 + 1) * 50), t = c((1 - y1) * 50);
          return 'mark ' + JSON.stringify([d(l), d(t), d(c((x1 + 1) * 50) - l), d(c((1 - y0) * 50) - t)]);
        })()`);
      }
      console.log(`${file.pathname.split('/').pop()}: ${W * DPR}×${H * DPR}, drawn at ${drawn}, ${(await js('window.__group.length'))} in the group${blocked ? ' (blocked)' : ''}`, JSON.stringify(got), mark);
    }
    return true;
  } finally { await send('Target.closeTarget', { targetId }).catch(() => {}); }
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), 'sponsor-shots-'));
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check',
    '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
  try {
    let ver;
    for (let i = 0; i < 50 && !ver; i++) { await sleep(200); ver = await fetch(`http://127.0.0.1:${PORT}/json/version`).then((r) => r.json()).catch(() => null); }
    if (!ver) throw new Error('Chrome did not start');
    const cdp = await connect(ver.webSocketDebuggerUrl);
    // DRAFT=<dir>: every try kept there, to choose from (KEEP tries each); else the first that comes, in public/images
    const keep = process.env.DRAFT ? +process.env.KEEP || 3 : 1;
    for (const name of NAMES) {
      let kept = 0;
      for (let t = 0; t < TRIES && kept < keep; t++) kept += (await shoot(cdp, name, t).catch((e) => { console.log(`${name}: ${e.message}`); return false; })) ? 1 : 0;
      if (!kept) console.log(`${name}: NOT TAKEN`);
    }
    cdp.close();
  } finally { chrome.kill(); await sleep(500); rmSync(dir, { recursive: true, force: true }); }
}

main().catch((e) => { console.error(e); process.exit(1); });
