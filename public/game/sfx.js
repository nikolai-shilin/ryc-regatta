// The sounds the game makes as it goes, not recorded: the wind, the water along the hull, the sails flogging, the
// winch's pawls, the committee boat's horn, the start timer's beep; and the open air a sound crosses to reach you,
// the land's long echo off the water. main.js plays them (audio, crews, committee) into the master gain it gives.
//
// Each is built from what makes the real one. The wind is a roar of brown noise and a hiss of pink, in stereo, its
// gusts swelling and dying on a slow random walk, and from about 13 knots the rigging's moan, two narrow tones that
// climb with the wind. The water is a rush of pink noise that brightens with speed. A sail flogging cracks: a thump of cloth and a snap, every time it fills the
// other way, with a flutter in the leech between. A winch's pawl is a struck bit of steel ringing in a few modes.
// The horn is an air horn's reed, brassy and a little driven, sliding up to pitch as it starts and sagging as it
// stops, heard from where the committee boat is: late by the distance (sound takes a second for 343 m), duller and
// quieter the further off, and echoed back off the land.

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const gauss = () => { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * Math.random()); };

// a buffer's channels to an RMS of `rms`
function level(buf, rms = 0.25) {
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c); let s = 0;
    for (let i = 0; i < d.length; i++) s += d[i] * d[i];
    const k = rms / Math.sqrt(s / d.length || 1);
    for (let i = 0; i < d.length; i++) d[i] *= k;
  }
  return buf;
}

// looping noise, a channel each side so it's wide: white, pink (−3 dB an octave: air, rushing water) or brown (−6 dB:
// the wind's roar). The loop's last 50 ms are faded into its first, so it never clicks round.
export function noiseBuf(ctx, color, secs = 4, ch = 2) {
  const sr = ctx.sampleRate, n = Math.floor(sr * secs), F = Math.floor(sr * 0.05), buf = ctx.createBuffer(ch, n, sr);
  for (let c = 0; c < ch; c++) {
    const d = new Float32Array(n + F);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, br = 0;
    for (let i = 0; i < n + F; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'pink') { // Paul Kellet's filter
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
      } else if (color === 'brown') { br = (br + 0.02 * w) / 1.02; d[i] = br; }
      else d[i] = w;
    }
    for (let i = 0; i < F; i++) { const a = i / F; d[i] = d[i] * a + d[n + i] * (1 - a); }
    buf.getChannelData(c).set(d.subarray(0, n));
  }
  return level(buf);
}

// a winch pawl's tick: a strike of noise and the steel ringing in five modes, each a few per cent off so no two
// sound quite alike
function clickBuf(ctx) {
  const sr = ctx.sampleRate, n = Math.floor(sr * 0.07), buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
  for (const [f, tau, a] of [[1180, 0.016, 0.45], [2480, 0.010, 1], [3970, 0.007, 0.8], [6150, 0.0045, 0.6], [8800, 0.003, 0.35]]) {
    const ff = f * rnd(0.95, 1.05), dec = Math.exp(-1 / (tau * sr)), ph = Math.random() * TAU;
    for (let i = 0, e = a * rnd(0.7, 1.2); i < n; i++, e *= dec) d[i] += e * Math.sin(ph + TAU * ff * i / sr);
  }
  for (let i = 0, m = Math.floor(sr * 0.003); i < m; i++) d[i] += (Math.random() * 2 - 1) * 1.1 * Math.exp(-i / (sr * 0.0006));
  let p = 0; for (const x of d) p = Math.max(p, Math.abs(x));
  for (let i = 0; i < n; i++) d[i] /= p;
  return buf;
}

// the land's echo across the water: nothing for the first 60 ms, a few distinct returns off the shore and the
// boats round about, then a long faint wash whose highs die first (the air takes them)
function airIR(ctx, secs = 2.6, rt = 1.9) {
  const sr = ctx.sampleRate, n = Math.floor(sr * secs), buf = ctx.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let y = 0;
    for (let i = Math.floor(sr * 0.06); i < n; i++) {
      const t = i / sr, a = 0.55 * Math.exp(-t * 2.2) + 0.04; // the air dulls the tail as it goes
      y += a * ((Math.random() * 2 - 1) - y);
      d[i] = y * Math.exp(-t * 6.9 / rt) * Math.min(1, (t - 0.06) / 0.25);
    }
    for (let k = 0; k < 5; k++) { // the returns, each a short smeared tap
      const at = Math.floor(sr * rnd(0.09, 0.7)), g = rnd(0.25, 0.6) * Math.exp(-at / sr * 2);
      for (let i = 0; i < 60 && at + i < n; i++) d[at + i] += g * (Math.random() * 2 - 1) * Math.exp(-i / 14);
    }
  }
  return buf;
}

// an air horn's reed: a brassy spectrum, every harmonic to the 24th, the odd ones stronger
let reedWave = null;
function reed(ctx) {
  if (reedWave) return reedWave;
  const N = 25, re = new Float32Array(N), im = new Float32Array(N);
  for (let h = 1; h < N; h++) im[h] = (h % 2 ? 1 : 0.6) / Math.pow(h, 0.75);
  return (reedWave = ctx.createPeriodicWave(re, im));
}

let driveCurve = null;
function drive() {
  if (driveCurve) return driveCurve;
  const n = 1024, c = new Float32Array(n), k = 2.4;
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
  return (driveCurve = c);
}

// bus: where each kind goes, so Settings › Sound can set each apart (main.js audio.init): boat (your sails, the winch,
// the hull) and signals (the committee's horn, the start timer's beep); either missing: straight to the master
export function createSfx(ctx, master, bus = {}) {
  const boat = bus.boat || master, sig = bus.signals || master;
  const white = noiseBuf(ctx, 'white', 2, 1), pink = noiseBuf(ctx, 'pink'), brown = noiseBuf(ctx, 'brown');
  // the slow-to-make ones a moment later, so the first tap that wakes the sound doesn't stutter
  let clicks = [];
  setTimeout(() => { clicks = [clickBuf(ctx), clickBuf(ctx), clickBuf(ctx), clickBuf(ctx)]; }, 60);

  const node = {
    src(buf, loop = true) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = loop; return s; },
    filter(type, f, q, gain) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q !== undefined) b.Q.value = q; if (gain !== undefined) b.gain.value = gain; return b; },
    gain(v = 0) { const g = ctx.createGain(); g.gain.value = v; return g; },
    pan(p = 0, to = master) {
      if (!ctx.createStereoPanner) return to;
      const n = ctx.createStereoPanner(); n.pan.value = clamp(p, -1, 1); n.connect(to); return n;
    },
  };

  // the land's echo: a send into it from anything heard across the water
  const air = ctx.createConvolver(); air.buffer = airIR(ctx);
  const airOut = node.gain(0.5); air.connect(airOut).connect(master);
  // (via: the bus the sound itself goes to: its echo is as loud as it is, and none if it's off)
  const send = (from, amount, via) => { const g = node.gain(amount * (via ? via.gain.value : 1)); from.connect(g).connect(air); return g; };

  // ---- the wind ----
  const wind = (() => {
    const out = node.pan(0), body = node.gain(), hiss = node.gain(), moan = node.gain();
    const lp = node.filter('lowpass', 400, 0.5), bp = node.filter('bandpass', 1800, 0.5);
    const m1 = node.filter('bandpass', 400, 28), m2 = node.filter('bandpass', 600, 34);
    const a = node.src(brown), b = node.src(pink), c = node.src(pink);
    a.connect(lp).connect(body).connect(out); b.connect(bp).connect(hiss).connect(out);
    c.connect(m1).connect(moan); c.connect(m2).connect(moan); moan.connect(out);
    a.start(0, rnd(0, 3)); b.start(0, rnd(0, 3)); c.start(0, rnd(0, 3));
    let slow = 0, fast = 0;
    return {
      // aws in knots; pan, where the apparent wind comes from (−1 left, 1 right); k the Sea setting (0 paused)
      update(aws, pan, k, dt) {
        const now = ctx.currentTime, s = Math.min(aws || 0, 35);
        // a gust's swell, over a couple of seconds; and the eddies round your head, quicker
        slow += -slow / 2.2 * dt + Math.sqrt(dt) * 0.5 * gauss(); slow = clamp(slow, -1.4, 1.4);
        fast += -fast / 0.22 * dt + Math.sqrt(dt) * 0.55 * gauss(); fast = clamp(fast, -1, 1);
        const sw = Math.min(1, s / 10), m = Math.max(0.2, 1 + 0.38 * slow * sw + 0.12 * fast * sw);
        body.gain.setTargetAtTime(k * Math.min(0.26, 0.016 + s / 125) * m, now, 0.08);
        lp.frequency.setTargetAtTime((170 + s * 24) * (1 + 0.35 * slow * sw), now, 0.1);
        hiss.gain.setTargetAtTime(k * 0.12 * clamp((s - 5) / 22, 0, 1) ** 1.5 * m * m, now, 0.06);
        bp.frequency.setTargetAtTime(1300 + 45 * s * m, now, 0.1);
        // the rigging's moan, from 13 knots, its pitch with the wind's speed at the shrouds, loudest in the gusts
        const f = (210 + 15 * s) * (1 + 0.05 * slow);
        m1.frequency.setTargetAtTime(f, now, 0.25); m2.frequency.setTargetAtTime(f * 1.49, now, 0.25);
        moan.gain.setTargetAtTime(k * 1.1 * clamp((s - 13) / 14, 0, 1) * Math.max(0, m - 0.75), now, 0.15);
        if (out.pan) out.pan.setTargetAtTime(clamp(pan, -1, 1) * 0.45, now, 0.3);
      },
    };
  })();

  // ---- the water along the hull ----
  const water = (() => {
    const out = node.gain(1), rush = node.gain();
    const bp = node.filter('bandpass', 700, 0.6);
    const a = node.src(pink); a.connect(bp).connect(rush).connect(out); a.start(0, rnd(0, 3));
    out.connect(master);
    return {
      // v in m/s, surfing or not, lap 0..1 (the hull working in the sea; unused now), k the Sea setting (0 paused)
      update(v, surf, lap, k) {
        const now = ctx.currentTime;
        rush.gain.setTargetAtTime(k * Math.min(0.22, v / 34 + (surf ? 0.07 : 0)), now, 0.25);
        bp.frequency.setTargetAtTime(420 + 120 * Math.min(v, 14), now, 0.3);
      },
    };
  })();

  // a short burst of a looping buffer, through a filter, with an envelope: the parts of every one-shot here
  function burst(buf, filt, peak, att, dur, to, t) {
    const s = node.src(buf, true), g = node.gain(0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(0.0005, t + att + dur);
    s.connect(filt).connect(g).connect(to); s.start(t, rnd(0, buf.duration - 0.6), att + dur + 0.05);
    return g;
  }

  // ---- the sails ----
  // a crack as she fills the other way: the thump of the cloth and its snap
  function crack(vol, pan = 0, to = boat, t = ctx.currentTime) {
    if (vol < 0.004) return;
    const o = node.pan(pan, to);
    burst(brown, node.filter('lowpass', rnd(160, 260), 0.9), vol * 0.95, 0.004, rnd(0.07, 0.13), o, t);
    burst(pink, node.filter('bandpass', rnd(800, 1700), 0.9), vol * 0.55, 0.0015, rnd(0.025, 0.05), o, t + 0.003);
  }
  // the leech fluttering in a sail just luffing: a fast burr
  const flutter = (() => {
    const s = node.src(pink), bp = node.filter('bandpass', 650, 1.4), am = node.gain(0.5), depth = node.gain(0.5), g = node.gain(0), lfo = ctx.createOscillator();
    lfo.frequency.value = 17; lfo.connect(depth).connect(am.gain);
    s.connect(bp).connect(am).connect(g).connect(boat); s.start(0, rnd(0, 3)); lfo.start();
    return { g, lfo };
  })();
  let flogPh = 0;
  // every frame, your own sails: flog 0..1 (how hard they're flogging), aws knots, k (0 paused)
  function sails(flog, aws, k, dt) {
    const now = ctx.currentTime;
    flutter.g.gain.setTargetAtTime(k * 0.11 * Math.min(1, flog * 2.2) * (1 - 0.6 * clamp((flog - 0.5) * 2, 0, 1)), now, 0.08);
    flutter.lfo.frequency.setTargetAtTime(13 + 0.4 * Math.min(aws, 30), now, 0.3);
    const before = Math.floor(flogPh / Math.PI);
    flogPh += dt * TAU * (1.4 + 0.07 * Math.min(aws || 0, 30)) * rnd(0.85, 1.15);
    if (k && flog > 0.15 && Math.floor(flogPh / Math.PI) !== before) crack(k * 0.65 * flog * rnd(0.55, 1), rnd(-0.15, 0.15), boat, now + rnd(0, 0.02));
  }

  // ---- one-shots ----
  // the hull slamming onto a sea: a thud in her, her hull's boom, and the splash a moment after
  function slap(vol) {
    const t = ctx.currentTime;
    burst(brown, node.filter('lowpass', 150, 0.8), vol * 0.7, 0.006, 0.2, boat, t);
    burst(pink, node.filter('bandpass', 420, 1.2), vol * 0.22, 0.004, 0.12, boat, t);
    burst(pink, node.filter('highpass', 1600, 0.6), vol * 0.16, 0.025, 0.45, boat, t + 0.03);
  }
  // a pawl clicking: vol, pan, where to, when
  function click(vol = 1, pan = 0, to = boat, t = ctx.currentTime) {
    if (!clicks.length) return;
    const s = node.src(clicks[Math.floor(Math.random() * clicks.length)], false), g = node.gain(0.32 * vol * rnd(0.8, 1.1));
    s.playbackRate.value = rnd(0.95, 1.05); s.connect(g).connect(node.pan(pan, to)); s.start(t);
  }
  // the sheet running out round the drum as it's eased: a rope's rasp
  function ease(vol = 1) {
    const t = ctx.currentTime;
    burst(pink, node.filter('bandpass', rnd(1800, 2800), 1.6), 0.28 * vol, 0.012, 0.12, boat, t);
  }
  // the committee boat's horn: long or short; d metres off, pan where she is, `when` seconds from now (a second horn)
  function horn(long, d = 120, pan = 0, when = 0) {
    if (bus.signals && bus.signals.gain.value <= 0) return; // (horns off: not even its echo)
    const dur = long ? 2.3 : 0.95, t = ctx.currentTime + 0.02 + when + Math.min(d, 220) / 343; // heard late, as it's far
    const f0 = 392 * rnd(0.994, 1.006), wave = reed(ctx), g = node.gain(0), pre = node.gain(0.45), sh = ctx.createWaveShaper();
    sh.curve = drive(); sh.oversample = '2x';
    const f1 = node.filter('peaking', 1250, 1.1, 6), f2 = node.filter('peaking', 2700, 1.6, 4), hp = node.filter('highpass', 230, 0.7);
    const lp = node.filter('lowpass', clamp(17000 * Math.exp(-d / 450), 2200, 17000), 0.6);
    const vib = ctx.createOscillator(), vd = node.gain(f0 * 0.0025); vib.frequency.value = rnd(4.5, 6);
    const end = t + dur;
    for (const det of [1, 1.0045]) {
      const o = ctx.createOscillator(); o.setPeriodicWave(wave);
      const f = o.frequency; f.setValueAtTime(f0 * det * 0.88, t); f.exponentialRampToValueAtTime(f0 * det, t + 0.08);
      f.setValueAtTime(f0 * det, end - 0.06); f.exponentialRampToValueAtTime(f0 * det * 0.93, end + 0.12);
      vib.connect(vd).connect(f); o.connect(pre); o.start(t); o.stop(end + 0.2);
    }
    vib.start(t); vib.stop(end + 0.2);
    const peak = 0.11 * clamp(110 / Math.max(d, 20), 0.35, 1.4);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.035); g.gain.setValueAtTime(peak, end - 0.04);
    g.gain.exponentialRampToValueAtTime(0.0005, end + 0.16);
    pre.connect(sh).connect(hp).connect(f1).connect(f2).connect(lp).connect(g).connect(node.pan(pan * 0.8, sig));
    send(g, 0.55 + 0.25 * clamp(d / 300, 0, 1), bus.signals);
  }
  // the start timer's piezo beep, a short one each second and a long one in the last three
  function beep(last) {
    const t = ctx.currentTime, dur = last ? 0.22 : 0.08, o = ctx.createOscillator(), g = node.gain(0), bp = node.filter('bandpass', 3150, 5);
    o.type = 'square'; o.frequency.value = 3150;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.004); g.gain.setValueAtTime(0.16, t + dur - 0.01); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(bp).connect(g).connect(sig); o.start(t); o.stop(t + dur + 0.02);
  }

  return { white, pink, brown, node, send, wind, water, sails, crack, slap, click, ease, horn, beep };
}
