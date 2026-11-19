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
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [base = 'http://localhost:5193', ...only] = process.argv.slice(2);
const OUT = new URL('../public/images/', import.meta.url);

const LIGHT = 'hour=15.5&sky=clear';

// the yacht in every picture, as the boat page would save her (lib/boat.ts): MARIE, GEO 13
const BOAT = { hull: '#1c1f24', cloth: '#2a2c30', laminate: true, ink: '#ffffff', kite: '#1c1f24', bottom: '#1c1f24', deck: 'nonskid', name: 'MARIE', crew: '#1c1f24', pants: '#1c1f24', logo: 'none', nat: 'GEO', num: '13', flag: 'ge' };

// each picture: the window (CSS pixels) and its scale, a touch screen or not, and (for a close-up) the HUD's parts to
// keep: the rest of the HUD (and the yachts' tags) is hidden, the scene stays (keep: [] is the scene alone). cam: the camera, set on the game's
// world (world.js: mode drone, top or helm; dist, orbit in radians round her, droneEl in degrees down, helmFov, look).
// out: the picture scaled to that size after it is taken (the share card, kept small for WhatsApp). q: the race page's
// own options instead of the minute before the gun (a drill: its computer skipper sails her to the moment, then she's
// yours), prep run on her (P) once the race is up, and until, on her too, the moment to take it.
// clean: the scene without the guides drawn on the water round her (the pictures that show the game, not how to read it).
const SHOTS = [
  { name: 'hud-desk-v9', w: 1200, h: 750, dpr: 2.7, touch: false, call: true, rects: true },
  { name: 'hud-port-v9', w: 390, h: 844, dpr: 3, touch: true, call: true, rects: true },
  { name: 'h-start-v9', w: 1100, h: 825, dpr: 1920 / 1100, touch: false, keep: ['.b-top', '#nxTag'] },
  { name: 'h-steer-v9', w: 640, h: 480, dpr: 3, touch: true, keep: ['#rudderZone'] },
  { name: 'h-trim-v9', w: 640, h: 480, dpr: 3, touch: true, keep: ['#sheetZone'] },
  { name: 'h-tack-v9', w: 640, h: 480, dpr: 3, touch: true, keep: ['#sheetZone', '.b-acts'] },
  { name: 'drone-desk-v9', w: 1600, h: 1000, dpr: 2.7, touch: false, keep: [], clean: true, frame: { company: true }, cam: { mode: 'drone', dist: 36, orbit: 'lee', droneEl: 16 } },
  { name: 'drone-port-v9', w: 390, h: 844, dpr: 3, touch: true, keep: [], clean: true, frame: {}, cam: { mode: 'drone', dist: 36, orbit: 'lee', droneEl: 18, orbitMax: 0.35 } },
  { name: 'top-v9', w: 1266, h: 585, dpr: 3, touch: false, keep: [], clean: true, cam: { mode: 'top', dist: 70 } },
  { name: 'og-v9', w: 1200, h: 630, dpr: 2, touch: false, keep: [], clean: true, frame: { company: true }, cam: { mode: 'drone', dist: 38, orbit: 'lee', droneEl: 16 }, out: [1200, 630] },
  { name: 'h-wind-v9', w: 640, h: 480, dpr: 3, touch: false, keep: [], cam: { mode: 'top', dist: 9 } },
  { name: 'h-view-drone-v9', w: 640, h: 480, dpr: 3, touch: false, keep: [], frame: {}, cam: { mode: 'drone', dist: 30, orbit: 'lee', droneEl: 22 } },
  { name: 'h-view-top-v9', w: 640, h: 480, dpr: 3, touch: false, keep: [], cam: { mode: 'top', dist: 40 } },
  { name: 'h-run-v9', w: 1100, h: 825, dpr: 1920 / 1100, touch: false, keep: [], clean: true, frame: { company: true }, q: 'drill=run', prep: 'P.setKite(true)', until: 'P.kite && P.kiteFill > 0.95 && !P.kiteJob', cam: { mode: 'drone', dist: 40, orbit: 'kite', droneEl: 20, orbitMax: 1.1 } },
  { name: 'h-view-helm-v9', w: 640, h: 480, dpr: 3, touch: false, keep: [], cam: { mode: 'helm', helmFov: 68, look: 0 } },
  // the sponsorship page's: rig, a camera of the script's own (RIG below). Its marks are the logo's and the banner's place
  { name: 'sp-banner-v2', w: 1600, h: 1000, dpr: 1.5, touch: false, keep: [], clean: true, rig: { pass: true, back: 85, left: 14.5, y: 3, fov: 24, pitch: 3 } },
  // the sails' ads as they are now (the admin's /admin/sails): the jib's banner over the whole sail along its luff, the
  // logo on the main, the gennaker's logo on its colour. sail: the sail whose outline is printed for the page's mark.
  // Taken with the site's /sponsor answering a set's sails (a stub, as the race films are: see the notes in its header)
  { name: 'sp-jib-v3', w: 1600, h: 1000, dpr: 1.5, touch: false, keep: [], clean: true, sail: 'jib', rig: { dist: 19, y: 3.4, camAhead: 5, ahead: 4.2, aimY: 6.2, fov: 40, wait: 55 } },
  { name: 'sp-main-v3', w: 1600, h: 1000, dpr: 1.5, touch: false, keep: [], clean: true, sail: 'main', rig: { dist: 19, y: 4, camAhead: -3, ahead: -0.5, aimY: 7.4, fov: 40, wait: 55 } },
  // the fleet: seven J Class yachts set by the script on a broad reach with their spinnakers up, coming at the camera in
  // an echelon seen off their windward bows, so every mainsail's face (its logo) shows beside her spinnaker (STAGE below)
  { name: 'sp-fleet-v3', w: 1600, h: 1000, dpr: 2, touch: false, keep: [], clean: true, opts: { fleet: 7, fleetV: 3, yacht: 'jclass' }, stage: { twa: 2.25, awa: 1.75, a: 0.95, d: 400, up: 9, lat: 34, rec: 68, fov: 30, look: -75, aim: 18, ahead: 120, sail: 12, jib: 25 } },
  // a flock: seven J Class yachts at Fethiye running at the camera under their spinnakers, filling the picture (FLOCK
  // below), seen from off their bows on the mainsails' side (their logos clear of the spinnakers), on either gybe, and
  // from dead ahead (the spinnakers only); pictures to keep rather than
  // the site's, saved in renders/ as PNG and JPEG at the window's size (1600×1000) and large (-hd, 3200×2000)
  ...[['left-front', { a: -1.3 }], ['front', { a: 0 }], ['right-front', { a: 1.5, course: -2.75, twa: -2.75, awa: -2.55, boom: -1 }]].flatMap(([pov, view]) => [1, 2].map((dpr) => ({ name: `fethiye-flock-${pov}${dpr > 1 ? '-hd' : ''}`, w: 1600, h: 1000, dpr, touch: false, keep: [], clean: true,
    q: 'venue=fethiye&boat=jclass', opts: { fleet: 7, fleetV: 3, yacht: 'jclass' }, dir: 'renders/', png: true,
    flock: { course: 2.75, twa: 2.75, awa: 2.55, boom: 1, ...view, d: 150, up: 6, fov: 34, aim: 21, ahead: -400, sail: 75, jib: 40, at: [[0, 0], [-46, 38], [48, 50], [-95, 95], [-22, 115], [30, 150], [95, 105]] } }))),
].filter((s) => !only.length || only.includes(s.name));

// A camera the game doesn't have, held on her from the frame's own loop. Beside her, on her windward side, where the crew
// sit and the jib shows past the mast, until she is sailing with no yacht in the way; or (pass) far back with a long lens,
// the plane sent over and stopped with its banner in the middle of the picture. window.__rigReady: the moment has come.
const RIG = (spec) => `(() => {
  const W = window.__rg.world, R = window.__rg.race, P = R.player, C = W.camera, s = ${JSON.stringify(spec)};
  W.mode = 'look'; C.fov = s.fov; C.updateProjectionMatrix();
  // nothing to take the eye off the ad: no gulls, and not the game's big yellow pointer over the next mark (wait: seconds, so she has left the start line behind)
  for (const g of W.wild.gulls) Object.defineProperty(g.g, 'visible', { get: () => false, set() {} });
  W.scene.traverse((o) => { if (o.isMesh && o.geometry.type === 'ConeGeometry' && o.material.color?.getHexString() === 'ffd400') o.material.visible = false; });
  const t0 = performance.now();
  const side = -Math.sign(P.twa || 1), a0 = P.h + side * Math.PI / 2 + Math.PI + side * 0.3, u = [Math.sin(a0), -Math.cos(a0)], v = [Math.cos(a0), Math.sin(a0)];
  let n = 0, frozen = false;
  const tick = () => {
    const f = [Math.sin(P.h), -Math.cos(P.h)], r = [Math.cos(P.h), Math.sin(P.h)], w = -Math.sign(P.twa || 1);
    if (s.pass) {
      const x = P.x - u[0] * s.back + v[0] * s.left, z = P.z - u[1] * s.back + v[1] * s.left;
      C.position.set(x, s.y, z); C.lookAt(x + u[0] * 100, s.y + Math.tan(s.pitch * Math.PI / 180) * 100, z + u[1] * 100);
      if (++n === 8) { W.plane.on = false; W.plane.show(false); W.plane.timer = 0; }
      const b = W.plane.banner.geometry.boundingSphere;
      if (!frozen && n > 8 && W.plane.on && b) {
        const c = b.center.clone().project(C);
        if (c.z < 1 && Math.abs(c.x - 0.02) < 0.07) { frozen = true; W.plane.update = () => {}; window.__rigReady = true; }
      }
    } else {
      C.position.set(P.x + r[0] * w * s.dist + f[0] * s.camAhead, s.y, P.z + r[1] * w * s.dist + f[1] * s.camAhead);
      C.lookAt(P.x + f[0] * s.ahead, s.aimY, P.z + f[1] * s.ahead);
      const far = (b) => Math.hypot(b.x - C.position.x, b.z - C.position.z), clear = R.boats.every((b) => b === P || far(b) > far(P) + 10 || Math.abs(C.position.clone().set(b.x, 4, b.z).project(C).x) > 1.2);
      window.__rigReady = performance.now() - t0 > (s.wait || 0) * 1000 && clear && Math.abs(P.twa) > 0.55 && Math.abs(P.twa) < 1.15 && P.v > 1.5;
    }
    requestAnimationFrame(tick);
  };
  tick(); return true;
})()`;

// A moment the race doesn't come to by itself: the race paused (the game still draws it, from the boats as they stand),
// every yacht put on one broad reach with her gennaker up, in an echelon across the camera's view and away from it (lat,
// rec: metres across and away a boat), ahead metres up the course from the start, and the camera off their windward bows
// (a: radians from ahead, d metres off, up metres high), looking along them (look: metres across from the middle, aim: high). Each is turned a little so the camera sees her from the same
// angle as the one in the middle, her boom on the gennaker's side and her main sheeted in (sail, jib: degrees), its face to
// the camera beside the gennaker rather than behind it
const STAGE = (spec) => `(() => {
  const W = window.__rg.world, R = window.__rg.race, B = R.boats, C = W.camera, s = ${JSON.stringify(spec)};
  document.getElementById('pauseBtn').click();
  for (const g of W.wild.gulls) Object.defineProperty(g.g, 'visible', { get: () => false, set() {} });
  W.scene.traverse((o) => { if (o.isMesh && o.geometry.type === 'ConeGeometry' && o.material.color?.getHexString() === 'ffd400') o.material.visible = false; });
  W.showGuides = false; W.mode = 'look'; C.fov = s.fov; C.updateProjectionMatrix();
  const h = B[0].wdir - 2.44, f = [Math.sin(h), -Math.cos(h)], r = [Math.cos(h), Math.sin(h)];
  const mx = B.reduce((t, b) => t + b.x, 0) / B.length, mz = B.reduce((t, b) => t + b.z, 0) / B.length; // the fleet on the line, before the gun
  const M = [mx + f[0] * s.ahead, mz + f[1] * s.ahead], c = [f[0] * Math.cos(s.a) + r[0] * Math.sin(s.a), f[1] * Math.cos(s.a) + r[1] * Math.sin(s.a)], p = [-c[1], c[0]];
  B.forEach((b, i) => {
    const k = i - (B.length - 1) / 2;
    Object.assign(b, { x: M[0] + p[0] * k * s.lat - c[0] * k * s.rec, z: M[1] + p[1] * k * s.lat - c[1] * k * s.rec, h, twa: s.twa, awa: s.awa, aws: 10, tws: 12, v: 7.5, heel: 6, luff: 0,
      kite: true, kiteFill: 1, kiteJob: null, kiteCollapse: 0, boom: 1, sail: s.sail, jibSail: s.jib });
  });
  C.position.set(M[0] + c[0] * s.d, s.up, M[1] + c[1] * s.d); C.lookAt(M[0] + p[0] * s.look, s.aim, M[1] + p[1] * s.look);
  const bearing = (x, z) => Math.atan2(C.position.x - x, z - C.position.z);
  for (const b of B) b.h = h + bearing(b.x, b.z) - bearing(M[0], M[1]);
  return true;
})()`;

// A flock coming at the camera: the race paused, every yacht running on one course (course: radians off the wind) with
// her spinnaker up, at her place in the flock (at: metres across and back from the leader, as the camera sees it), each
// turned a little to come straight at the camera, which is d metres ahead of the leader, up metres high, a radians off
// her bow. The flock goes ahead metres up the course from the start, or to the nearest open water there if that is
// ashore: the flock and the camera all with deep water under them. No marks, and no wakes from where they stood before.
const FLOCK = (spec) => `(async () => {
  const W = window.__rg.world, R = window.__rg.race, B = R.boats, C = W.camera, s = ${JSON.stringify(spec)};
  const { groundAt } = await import('/game/skopea.js'), wet = (x, z) => groundAt(x + R.at.x, z + R.at.z) < -3;
  document.getElementById('pauseBtn').click();
  for (const g of W.wild.gulls) Object.defineProperty(g.g, 'visible', { get: () => false, set() {} });
  W.scene.traverse((o) => { if (o.isMesh && o.geometry.type === 'ConeGeometry' && o.material.color?.getHexString() === 'ffd400') o.material.visible = false; });
  if (W.marks) W.marks.visible = false;
  for (const { obj } of W.buoys) obj.visible = false;
  W.showGuides = false; W.mode = 'look'; C.fov = s.fov; C.updateProjectionMatrix();
  const h = B[0].wdir - s.course, f = [Math.sin(h), -Math.cos(h)], r = [Math.cos(h), Math.sin(h)];
  const mx = B.reduce((t, b) => t + b.x, 0) / B.length, mz = B.reduce((t, b) => t + b.z, 0) / B.length;
  const open = (M) => { for (let y = -260; y <= s.d + 80; y += 20) for (let x = -140; x <= 140; x += 35) if (!wet(M[0] + f[0] * y + r[0] * x, M[1] + f[1] * y + r[1] * x)) return false; return true; };
  let M = null;
  for (let k = 0; k <= 12 && !M; k++) for (const [da, ds] of k ? [[k, 0], [-k, 0], [0, k], [0, -k], [k, k], [-k, k], [k, -k], [-k, -k]] : [[0, 0]]) {
    const at = [mx + f[0] * (s.ahead + da * 100) + r[0] * ds * 100, mz + f[1] * (s.ahead + da * 100) + r[1] * ds * 100];
    if (open(at)) { M = at; break; }
  }
  if (!M) throw new Error('no open water for the flock');
  const c = [f[0] * Math.cos(s.a) + r[0] * Math.sin(s.a), f[1] * Math.cos(s.a) + r[1] * Math.sin(s.a)], p = [-c[1], c[0]];
  B.forEach((b, i) => { const [x, y] = s.at[i % s.at.length];
    Object.assign(b, { x: M[0] + p[0] * x - c[0] * y, z: M[1] + p[1] * x - c[1] * y, h, twa: s.twa, awa: s.awa, aws: 10, tws: 12, v: 9, heel: 3, luff: 0,
      kite: true, kiteFill: 1, kiteJob: null, kiteCollapse: 0, boom: s.boom, sail: s.sail, jibSail: s.jib });
  });
  C.position.set(M[0] + c[0] * s.d, s.up, M[1] + c[1] * s.d); C.lookAt(M[0], s.aim, M[1]);
  const bearing = (x, z) => Math.atan2(C.position.x - x, z - C.position.z);
  for (const b of B) b.h = h + bearing(b.x, b.z) - bearing(M[0], M[1]);
  for (const w of W.wakes) w.trail = [];
  return true;
})()`;

// The game caps how finely it draws (world.js PART.res), so a picture taken at the window's scale alone is an enlargement.
// For its last frames the scene is drawn at SUPER times the picture's own pixels, up to MAX_SIDE, and the browser scales
// it down: every pixel of the picture is drawn, and the rigging's thin lines come out smooth.
const SUPER = 2, MAX_SIDE = 8192;

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
  await js(`localStorage.setItem('regatta', JSON.stringify(${JSON.stringify({ gfx: 'high', ...s.opts })})); localStorage.setItem('regatta-boat', ${JSON.stringify(JSON.stringify(BOAT))})`);
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
  const aim = () => js(`(() => {
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
    Object.assign(W, cam); ${s.clean ? 'W.showGuides = false;' : ''} return true;
  })()`);
  if (s.cam) await aim();
  if (s.rig) {
    await js(`window.__rg.world.showGuides = false; ${RIG(s.rig)}`);
    let up = false;
    for (let i = 0; i < 180 && !up; i++) { await sleep(500); up = await js(`!!window.__rigReady`); }
    if (!up) console.log(`${s.name}: the moment never came, taken as it stands`);
  }
  if (s.stage) { await js(STAGE(s.stage)); await sleep(1500); }
  // (FLOCK='{"a":-1}' in the environment: to try a view)
  if (s.flock) { await js(FLOCK({ ...s.flock, ...JSON.parse(process.env.FLOCK || '{}') })); await sleep(1500); await js(`for (const w of window.__rg.world.wakes) w.trail = []`); }
  await sleep(s.cam ? 2500 : 1500); // the call's own entrance (or the camera) settled, while the frames are still quick
  // frame: wait for a picture worth keeping, the drone swinging after the fleet as it sails: her masthead inside the
  // frame, no yacht close under the lens or cut by its edge, and (company) another one in the open beside her
  let framed = !s.frame;
  for (let i = 0; s.frame && i < 45 && !framed; i++) {
    framed = await js(`(() => {
      const W = window.__rg.world, R = window.__rg.race, P = R.player, C = W.camera, MAST = 16;
      const at = (b, y) => C.position.clone().set(b.x, y, b.z).project(C), far = (b) => Math.hypot(b.x - C.position.x, b.z - C.position.z);
      const me = at(P, 0), heel = Math.abs(P.heel || 0) * Math.PI / 180, lean = Math.sin(heel) * MAST, up = Math.cos(heel) * MAST; // (her mast leans with her, whichever side that falls)
      const tops = [1, -1].map((k) => at({ x: P.x + k * Math.cos(P.h) * lean, z: P.z + k * Math.sin(P.h) * lean }, up));
      if (Math.abs(me.x) > 0.7 || tops.some((t) => t.y > 0.88 || Math.abs(t.x) > 0.86)) return false;
      let company = false;
      for (const b of R.boats) {
        if (b === P) continue;
        const d = far(b), a = at(b, 0), t = at(b, MAST), ahead = a.z < 1;
        if (d < far(P) * 0.85) return false;
        if (ahead && d < 220 && Math.abs(a.x) > 0.8 && Math.abs(a.x) < 1.25) return false;
        if (ahead && d < 220 && Math.abs(a.x) < 0.78 && Math.abs(a.x - me.x) > 0.24 && t.y < 0.9 && a.y > -0.85) company = true;
      }
      return company || !${!!s.frame?.company};
    })()`);
    if (!framed) { await sleep(1000); await aim(); await sleep(600); }
  }
  if (!framed) console.log(`${s.name}: no clean framing came, taken as it stands`);
  if (!s.dir) await metrics(s.dpr); // (a picture for renders/ is read off the game's own canvas, below, at the window's scale)
  await sleep(400); // (the game's own resize first, which sets the size it knows)
  const frames = (n) => js(`new Promise((ok) => { let n = ${n}; const f = () => (--n > 0 ? requestAnimationFrame(f) : ok(true)); requestAnimationFrame(f); })`);
  const drawn = await js(`(() => {
    const W = window.__rg.world, r = Math.min(${s.dpr * SUPER}, ${MAX_SIDE} / Math.max(innerWidth, innerHeight));
    W.renderer.setPixelRatio(r); W.renderer.setSize(innerWidth, innerHeight, false);
    return W.renderer.domElement.width + '×' + W.renderer.domElement.height;
  })()`);
  await frames(4);
  if (s.keep) { // under #hud, so they outrank its hiding; with nothing kept, everything over the scene goes
    await js(`document.head.append(Object.assign(document.createElement('style'), { textContent: ${JSON.stringify(s.keep.length
      ? `#hud, #hud *, #nxTag, #nxTag *, #bOver, #bOver * { visibility: hidden !important; } ${s.keep.map((k) => (k.startsWith('#nxTag') ? k : `#hud ${k}`)).flatMap((k) => [k, `${k} *`]).join(', ')} { visibility: visible !important; }`
      : 'body > :not(#gl), body > :not(#gl) * { visibility: hidden !important; }')} }))`);
    await sleep(300);
  }
  await frames(2);
  const lost = await js(`window.__rg.world.renderer.getContext().isContextLost()`);
  if (lost) throw new Error(`${s.name}: the GPU gave up at ${drawn}`);
  const dir = s.dir ? new URL(`../${s.dir}`, import.meta.url) : OUT; // (dir: from the repository's root)
  if (s.dir) mkdirSync(dir, { recursive: true });
  // A picture for renders/ is large, and one message that size never comes back over the connection (Chrome's own
  // screenshot neither), so it is read off the game's canvas instead (only the scene, all such a picture keeps), in the
  // frame after one the game has drawn, scaled down to its own pixels, and fetched a megabyte at a time
  const grab = async (type, q) => {
    const n = await js(`new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => {
      const g = window.__rg.world.renderer.domElement, c = Object.assign(document.createElement('canvas'), { width: ${s.w * s.dpr}, height: ${s.h * s.dpr} }), x = c.getContext('2d');
      x.imageSmoothingQuality = 'high'; x.drawImage(g, 0, 0, c.width, c.height);
      c.toBlob((b) => { const r = new FileReader(); r.onload = () => { window.__shot = r.result.split(',')[1]; ok(window.__shot.length); }; r.readAsDataURL(b); }, '${type}', ${q});
    })))`);
    let out = '';
    for (let i = 0; i < n; i += 1 << 20) out += await js(`window.__shot.slice(${i}, ${i + (1 << 20)})`);
    return out;
  };
  if (s.png) writeFileSync(new URL(`${s.name}.png`, dir), Buffer.from(await grab('image/png', 1), 'base64'));
  const shot = s.dir ? { data: await grab('image/jpeg', 0.95) } : await S('Page.captureScreenshot', { format: 'jpeg', quality: 92, captureBeyondViewport: false });
  const file = new URL(`${s.name}.jpg`, dir);
  writeFileSync(file, Buffer.from(shot.data, 'base64'));
  if (s.out) execFileSync('sips', ['-z', String(s.out[1]), String(s.out[0]), '-s', 'formatOptions', '82', file.pathname, '--out', file.pathname], { stdio: 'ignore' }); // macOS's own
  let rects = '';
  if (s.rig?.pass) { // where the banner came out, for the page's mark: left, top, width and height in % of the picture
    rects = await js(`(() => {
      const W = window.__rg.world, C = W.camera, A = W.plane.banner.geometry.attributes.position, p = C.position.clone(); let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      for (let i = 0; i < A.count; i++) { p.fromBufferAttribute(A, i).project(C); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
      const d = (v) => +v.toFixed(1); return 'mark ' + JSON.stringify([d((x0 + 1) * 50), d((1 - y1) * 50), d((x1 - x0) * 50), d((y1 - y0) * 50)]);
    })()`);
  }
  if (s.sail && !s.stage) { // where the sail came out, for the page's mark: the outline of its front face, in % of the picture
    rects = await js(`(() => {
      const W = window.__rg.world, R = window.__rg.race, C = W.camera, V = W.boatViews[R.boats.indexOf(R.player)], m = V[${JSON.stringify(s.sail)}].children[0];
      m.updateMatrixWorld(true); const A = m.geometry.attributes.position, p = C.position.clone(); let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      for (let i = 0; i < A.count; i++) { p.fromBufferAttribute(A, i).applyMatrix4(m.matrixWorld).project(C); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
      const c = (v) => Math.max(0, Math.min(100, v)), d = (v) => +v.toFixed(1), l = c((x0 + 1) * 50), t = c((1 - y1) * 50);
      return 'sail ' + JSON.stringify([d(l), d(t), d(c((x1 + 1) * 50) - l), d(c((1 - y0) * 50) - t)]);
    })()`);
  }
  if (s.rects) {
    rects = await js(`JSON.stringify(Object.fromEntries(Object.entries(${JSON.stringify(PARTS)}).map(([k, sel]) => {
      const e = document.querySelector(sel), r = e && e.getBoundingClientRect();
      if (!r || !r.width || getComputedStyle(e).visibility === 'hidden' || getComputedStyle(e).display === 'none') return [k, null];
      const p = (v, d) => +(100 * v / d).toFixed(1);
      return [k, [p(r.left, innerWidth), p(r.top, innerHeight), p(r.right, innerWidth), p(r.bottom, innerHeight)]];
    })))`);
  }
  console.log(`${s.name}: ${s.out ? s.out.join('×') : `${Math.round(s.w * s.dpr)}×${Math.round(s.h * s.dpr)}`}, drawn at ${drawn}, at ${left}s to the gun${s.call ? `, call ${call ? 'on' : 'off'}` : ''}${rects ? `\n  ${rects}` : ''}`);
  await send('Target.closeTarget', { targetId });
}

main().catch((e) => { console.error(e); process.exit(1); });
