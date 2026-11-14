// ---------- the soundtrack: music made in the browser as the race goes ----------
// Four styles (Settings › Music): ambient electronic, film drama and sea folk, synthesized, and Racing, a recorded
// track. Each plays from two dials, intensity (how many layers, how fast) and tension, and a mood that picks its chords:
// calm, tense, up, dark, win, lose. direct() turns the race into the dials and the mood; main.js adds the accents at the
// big moments (sting) and the build to the gun (riser, breath). The three synthesized ones load nothing; Racing loads
// its track the first time it's chosen.

export const MUSIC_STYLES = ['ambient', 'film', 'folk', 'racing'];

// Racing: one track (E minor, speeding up from 131 to 137 bpm), cut on its bar lines by scripts/racing-music.py into
// music-racing.mp3: loops for the moods, the build that lands its drop on the gun, its ending for a win, and accents
// made of its crash. Each piece: where it starts in the file (s), and its bars' lengths (s), or how long it is.
const RACING = {
  calm: [0.9, [1.8293, 1.8267, 1.816, 1.8213, 1.8213, 1.808, 1.8213, 1.8187, 1.8133, 1.8107, 1.8187, 1.8, 1.8213, 1.816, 1.8107, 1.8107]],
  drive: [30.964, [1.8027, 1.7973, 1.8027, 1.7973, 1.8, 1.7947, 1.8, 1.7947, 1.7947, 1.792, 1.7947, 1.7867, 1.7973, 1.7867, 1.792, 1.792]],
  dark: [60.6893, [1.7813, 1.7813, 1.76, 1.7813, 1.7733, 1.768, 1.7627, 1.7733]],
  race: [75.8707, [1.7653, 1.7627, 1.76, 1.76, 1.7627, 1.76, 1.7573, 1.76, 1.76, 1.76, 1.7573, 1.7573, 1.7573, 1.7547, 1.76, 1.7573]],
  peak: [105.0227, [1.7467, 1.7493, 1.7467, 1.7467, 1.7467, 1.7467, 1.7467, 1.744]],
  build: [119.996, [1.768, 1.776, 1.76, 1.7653, 1.7733, 1.7627, 1.7653, 1.7653, 1.7653, 1.7627, 1.76, 1.76]],
  finale: [142.18, [1.7467, 1.7467, 1.7467, 1.7467, 1.744, 1.744, 1.744, 1.744, 1.7547]],
  crash: [159.8962, 2.4],
  swell: [162.6962, 2.42],
  hit: [165.5262, 0.9],
};
const ONE_SHOT = { build: { then: 'race', at: 4 }, finale: { then: 'calm', at: 0 } }; // and where they lead on to
// which loop plays: by the mood, and in it by the intensity
export function racingPiece(mood, int) {
  if (mood === 'dark' || mood === 'lose') return 'dark';
  if (mood === 'win') return 'calm';
  if (mood === 'calm') return int < 0.3 ? 'calm' : 'drive';
  if (mood === 'tense') return int < 0.7 ? 'drive' : 'peak';
  return int < 0.7 ? 'race' : 'peak';
}

// what the music should do now. s: { clock, done, place, fleet, dsq, ocs, pen, zone, near (m to the nearest boat),
// toMark (m), markLeg (the next mark is one to round), lastLeg, downwind, trend (+1 a place gained lately, −1 lost) }
export function direct(s) {
  if (s.done) {
    if (s.dsq || !s.place) return { int: 0.12, ten: 0.1, mood: 'lose' };
    if (s.place === 1) return { int: 0.55, ten: 0, mood: 'win' };
    if (s.place <= Math.max(2, Math.ceil(s.fleet / 3))) return { int: 0.45, ten: 0.1, mood: 'up' };
    return { int: 0.12, ten: 0.1, mood: 'lose' };
  }
  if (s.clock < 0) {
    const left = -s.clock;
    if (left > 60) return { int: 0.2, ten: 0.25, mood: 'calm' };
    if (left > 10) { const k = 1 - (left - 10) / 50; return { int: 0.45 + 0.2 * k, ten: 0.6 + 0.25 * k, mood: 'tense' }; }
    return { int: 0.8, ten: 1, mood: 'tense' };
  }
  if (s.ocs) return { int: 0.45, ten: 0.8, mood: 'dark' };
  if (s.pen) return { int: 0.3, ten: 0.6, mood: 'dark' };
  let int = s.downwind ? 0.55 : 0.38, ten = 0.3, mood = s.downwind ? 'up' : 'calm';
  if (s.near < 25) { int += 0.25; ten += 0.4; } else if (s.near < 60) { int += 0.12; ten += 0.2; }
  if (s.markLeg && s.toMark < 90) { int += 0.15; ten += 0.15; }
  if (s.lastLeg) { int += 0.15; ten += 0.2; if (s.place === 1 && s.near > 60) mood = 'up'; }
  if (s.trend > 0) mood = 'up'; else if (s.trend < 0) mood = 'dark';
  if (s.zone) { int = Math.max(int, 0.85); ten = Math.max(ten, 0.9); mood = 'tense'; }
  else if (ten >= 0.7 && mood !== 'dark') mood = 'tense';
  return { int: Math.min(1, int), ten: Math.min(1, ten), mood };
}

// ---------- harmony: per style, four bars for each mood. A chord is [bass, ...the voicing], in MIDI notes ----------
const PROG = {
  ambient: { // D dorian
    calm:  [[38, 50, 57, 60, 64, 65], [34, 50, 53, 57, 58, 62], [41, 53, 57, 60, 64, 67], [36, 55, 60, 62, 64, 67]],
    tense: [[38, 50, 53, 57, 62, 65], [36, 48, 53, 57, 62, 65], [34, 50, 53, 58, 62, 65], [33, 52, 57, 62, 64, 69]],
    up:    [[41, 53, 57, 60, 64, 69], [36, 52, 55, 60, 62, 67], [38, 50, 57, 60, 65, 69], [34, 50, 53, 58, 62, 69]],
    dark:  [[38, 50, 53, 57, 62], [39, 51, 55, 58, 62], [43, 50, 55, 58, 62], [33, 49, 52, 57, 61]],
    win:   [[34, 50, 53, 58, 62, 65], [36, 52, 55, 60, 64, 67], [38, 50, 54, 57, 62, 66, 69], [38, 50, 54, 57, 62, 66, 69]],
    lose:  [[38, 50, 53, 57, 62], [34, 50, 53, 57, 58], [31, 50, 52, 55, 58], [38, 50, 53, 57, 62]],
  },
  film: { // C minor
    calm:  [[36, 48, 55, 60, 63, 67], [32, 51, 56, 60, 63, 68], [39, 51, 55, 58, 63, 67], [34, 50, 53, 58, 62, 65]],
    tense: [[36, 48, 55, 60, 63, 67], [32, 48, 56, 60, 63, 68], [41, 53, 56, 60, 65, 68], [31, 50, 55, 59, 62, 67]],
    up:    [[39, 51, 55, 58, 63, 67], [34, 50, 53, 58, 62, 65], [36, 48, 55, 60, 63, 67], [32, 51, 56, 60, 63, 68]],
    dark:  [[36, 48, 55, 60, 63], [37, 49, 53, 56, 61, 65], [36, 48, 55, 60, 63], [31, 50, 55, 59, 62]],
    win:   [[32, 51, 56, 60, 63, 68], [34, 50, 53, 58, 62, 65], [36, 48, 52, 55, 60, 64, 67], [36, 48, 52, 55, 60, 64, 67]],
    lose:  [[36, 48, 55, 60, 63], [32, 48, 51, 56, 60], [41, 48, 53, 56, 60], [36, 48, 55, 60, 63]],
  },
  folk: { // G major, E minor
    calm:  [[43, 55, 59, 62, 67], [40, 52, 55, 59, 64], [36, 55, 60, 64, 67], [38, 54, 57, 62, 66]],
    tense: [[40, 52, 55, 59, 64], [38, 54, 57, 62, 66], [36, 55, 60, 64, 67], [35, 51, 54, 57, 63]],
    up:    [[43, 55, 59, 62, 67], [38, 54, 57, 62, 66], [40, 52, 55, 59, 64], [36, 55, 60, 64, 67]],
    dark:  [[40, 52, 55, 59, 64], [45, 52, 57, 60, 64], [40, 52, 55, 59, 64], [35, 51, 54, 57, 63]],
    win:   [[36, 55, 60, 64, 67], [38, 54, 57, 62, 66], [43, 55, 59, 62, 67, 71], [43, 55, 59, 62, 67, 71]],
    lose:  [[40, 52, 55, 59, 64], [36, 52, 55, 60, 64], [45, 52, 57, 60, 64], [40, 52, 55, 59, 64]],
  },
};
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// the player: ctx an AudioContext, out the node it plays into (the game's master, so Sound off silences it too)
export function createMusic(ctx, out) {
  // music → its level → the duck (under voices, and the breath before the gun) → a gentle compressor → out
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.connect(out);
  const duck = ctx.createGain(); duck.connect(comp);
  const level = ctx.createGain(); level.gain.value = 0; level.connect(duck);
  const len = ctx.sampleRate * 2, noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate), nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;
  // a hall: decaying stereo noise
  const rl = Math.floor(ctx.sampleRate * 2.4), ir = ctx.createBuffer(2, rl, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const x = ir.getChannelData(c); for (let i = 0; i < rl; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 3.2); }
  const reverb = ctx.createConvolver(); reverb.buffer = ir; reverb.connect(level);

  const S = { int: 0.2, ten: 0.2, tInt: 0.2, tTen: 0.2, mood: 'calm', pend: null, cand: null, candT: 0 };
  let style = null, cur = null, bar = 0, chordI = 0, step = 0, nextT = 0, paused = false, lastSting = -1e9, breathUntil = 0;
  const M = { lite: false, volume: 0.5 };

  const newBus = () => { const bus = ctx.createGain(), rev = ctx.createGain(); bus.gain.value = 1; bus.connect(level); rev.connect(reverb); bus._rev = rev; return bus; };
  const retire = (bus, tc = 0.4) => {
    if (!bus) return; const n = ctx.currentTime;
    bus.gain.cancelScheduledValues(n); bus.gain.setTargetAtTime(0, n, tc); bus._rev.gain.setTargetAtTime(0, n, tc);
    setTimeout(() => { try { bus.disconnect(); bus._rev.disconnect(); } catch (e) {} }, tc * 8000 + 3000);
  };

  // ---------- instruments ----------
  // one voice: oscillators (detuned in unison), a lowpass with an optional sweep, an envelope, a pan, a send to the hall
  function voice(o) {
    const bus = o.bus || cur.bus, t = o.t, dur = o.dur, a = o.a ?? 0.01, r = o.r ?? 0.2, peak = o.gain ?? 0.2, hold = t + Math.max(a, dur);
    const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = o.ftype || 'lowpass'; f.Q.value = o.q ?? 0.7;
    f.frequency.setValueAtTime(o.lp0 ?? o.lp ?? 4000, t); if (o.lp0 != null) f.frequency.exponentialRampToValueAtTime(o.lp ?? 4000, t + (o.lpT ?? a + 0.05));
    if (o.lpEnd != null) f.frequency.setTargetAtTime(o.lpEnd, t + (o.lpT ?? a), dur / 3);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setTargetAtTime(0.0001, hold + 0.001, r / 3);
    const end = hold + r * 1.5 + 0.05, dets = M.lite ? [0] : o.det || [0];
    for (const dc of dets) {
      const osc = ctx.createOscillator(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, t); osc.detune.value = dc;
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + (o.slideT ?? dur));
      if (o.vib && !M.lite) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vibRate ?? 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(o.vib, t + 0.35); l.connect(lg).connect(osc.detune); l.start(t); l.stop(end); }
      const og = ctx.createGain(); og.gain.value = 1 / Math.sqrt(dets.length);
      osc.connect(og).connect(f); osc.start(t); osc.stop(end);
    }
    let node = f.connect(g);
    if (o.trem) { const tg = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain(); tg.gain.value = 1 - o.trem / 2; l.frequency.value = o.tremRate ?? 5.5; lg.gain.value = o.trem / 2; l.connect(lg).connect(tg.gain); l.start(t); l.stop(end); node = node.connect(tg); }
    if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; node = node.connect(p); }
    node.connect(bus); if (o.rev) { const s = ctx.createGain(); s.gain.value = o.rev; node.connect(s).connect(bus._rev); }
  }
  function noise(o) {
    const bus = o.bus || cur.bus, t = o.t, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = o.ftype || 'bandpass'; f.frequency.setValueAtTime(o.freq || 1000, t); f.Q.value = o.q ?? 1;
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + o.dur);
    const peak = o.gain ?? 0.2, a = o.a ?? 0.002;
    g.gain.setValueAtTime(0.0001, t);
    if (o.rise) { g.gain.exponentialRampToValueAtTime(peak, t + o.dur); g.gain.setTargetAtTime(0.0001, t + o.dur, 0.02); }
    else { g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setTargetAtTime(0.0001, t + a, o.decay ?? o.dur / 4); }
    let n = s.connect(f).connect(g);
    if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; n = n.connect(p); }
    n.connect(bus); if (o.rev) { const r = ctx.createGain(); r.gain.value = o.rev; n.connect(r).connect(bus._rev); }
    s.start(t, Math.random() * 1.5); s.stop(t + o.dur + (o.rise ? 0.2 : (o.decay ?? o.dur / 4) * 6) + 0.1);
  }
  const kick = (t, g = 0.5) => voice({ t, f: 150, slide: 42, slideT: 0.13, dur: 0.02, r: 0.35, gain: g });
  const taiko = (t, g = 0.5, rev = 0.25) => { voice({ t, f: 95, slide: 52, slideT: 0.2, dur: 0.05, r: 0.9, gain: g, rev }); noise({ t, freq: 380, ftype: 'lowpass', dur: 0.1, gain: g * 0.5, decay: 0.05, rev }); };
  const hat = (t, g = 0.06, open) => noise({ t, freq: 8500, ftype: 'highpass', dur: 0.05, gain: g, decay: open ? 0.07 : 0.018 });
  const clap = (t, g = 0.18) => { for (let i = 0; i < 3; i++) noise({ t: t + i * 0.011, freq: 1600, q: 1.2, dur: 0.02, gain: g, decay: i === 2 ? 0.08 : 0.008, rev: 0.15 }); };
  const crash = (t, g = 0.18) => noise({ t, freq: 6000, ftype: 'highpass', dur: 2.6, gain: g, decay: 0.7, rev: 0.3 });
  const gong = (t, g = 0.25) => { for (const [m, k] of [[1, 1], [2.76, 0.5], [5.4, 0.25]]) voice({ t, f: 55 * m, dur: 0.05, r: 5, gain: g * k, rev: 0.5 }); };

  const chord = () => PROG[style][S.mood][chordI];
  const tones = () => chord().slice(1);
  const barLen = () => cur.steps * cur.stepDur();
  const seeded = (n) => { const x = Math.sin(n * 127.1 + bar * 311.7) * 43758.5453; return x - Math.floor(x); };

  // ---------- the three styles: what each plays at a bar line and at each step ----------
  const STYLES = {
    // pads, a sub, an arpeggio that doubles its speed with the race, then a kick, hats, a bass pulse and claps
    ambient: {
      steps: 16,
      stepDur: () => 60 / (90 + S.int * 30) / 4,
      bar(t) {
        const c = chord(), L = barLen() * 1.04;
        for (const [i, m] of c.slice(1).entries()) voice({ t, f: mtof(m), dur: L, a: 0.7, r: 1.4, gain: 0.05 + S.int * 0.015, type: 'sawtooth', det: [-9, 0, 8], lp: 700 + S.int * 1600 + S.ten * 600, q: 0.6, pan: (i % 2 ? -0.35 : 0.35), rev: 0.55 });
        voice({ t, f: mtof(c[0]), dur: L, a: 0.3, r: 0.8, gain: 0.2 });
        if (S.mood === 'up' || S.mood === 'win') { // a sparse lead, high, echoing in the hall
          const top = c.slice(-3).map((m) => m + 12), mot = [top[2], top[1], top[0], top[1]];
          mot.forEach((m, k) => voice({ t: t + k * barLen() / 4 + barLen() / 8, f: mtof(m), dur: 0.25, a: 0.02, r: 0.9, gain: 0.07, type: 'triangle', rev: 0.7, pan: (k % 2 ? 0.4 : -0.4) }));
        }
      },
      step(i, t) {
        const c = tones(), d = this.stepDur(), every = S.int < 0.35 ? 4 : S.int < 0.65 ? 2 : 1;
        if (S.int > 0.12 && i % every === 0) { const arp = [...c, ...c.map((m) => m + 12)], m = arp[((i / every) % arp.length) | 0]; voice({ t, f: mtof(m + 12), dur: d * 0.6, a: 0.005, r: 0.25, gain: 0.045 + S.int * 0.02, type: 'square', lp: 1200 + S.int * 3500, q: 3, pan: Math.sin(i) * 0.5, rev: 0.35 }); }
        if (S.int > 0.3 && (i % 8 === 0 || (S.int > 0.6 && i % 4 === 0))) kick(t, 0.45 + S.int * 0.2);
        if (S.int > 0.45 && i % 4 === 2) hat(t, 0.05 + S.int * 0.03, true);
        if (S.int > 0.75 && i % 2 === 1) hat(t, 0.025);
        if (S.int > 0.6 && i % 4 === 2) voice({ t, f: mtof(chord()[0] + 12), dur: d * 1.4, r: 0.08, gain: 0.16, type: 'sawtooth', lp: 400, lp0: 1400, lpT: 0.09, q: 4 });
        if (S.int > 0.7 && (i === 4 || i === 12)) clap(t, 0.14);
        if (S.ten > 0.55 && i % 2 === 0) voice({ t, f: mtof(chord()[0] + 36), dur: 0.03, r: 0.2, gain: 0.02 + S.ten * 0.025, rev: 0.4 });
      },
    },
    // strings, then cellos, a string ostinato, taiko; low brass swells when it's tense, a horn theme when it goes well
    film: {
      steps: 16,
      stepDur: () => 60 / (78 + S.int * 32) / 4,
      bar(t) {
        const c = chord(), L = barLen() * 1.05, low = S.int < 0.3 && S.mood !== 'win';
        for (const [i, m] of c.slice(1).entries()) voice({ t, f: mtof(m - (low && i > 2 ? 12 : 0)), dur: L, a: 0.9, r: 1.6, gain: 0.045 + S.int * 0.02, type: 'sawtooth', det: [-14, -5, 4, 13], lp: 900 + S.int * 2200, q: 0.5, vib: 9, vibRate: 5 + i * 0.2, pan: (i - 2.5) * 0.18, rev: 0.6 });
        if (S.int > 0.25) voice({ t, f: mtof(c[0]), dur: L, a: 0.4, r: 1, gain: 0.12, type: 'sawtooth', det: [-6, 6], lp: 500, rev: 0.3 });
        if (S.ten > 0.6 && S.mood === 'tense' && bar % 2 === 0) for (const m of [c[0], c[0] + 7, c[0] + 12]) voice({ t, f: mtof(m), dur: L * 1.6, a: 0.08, r: 1.2, gain: 0.11, type: 'sawtooth', det: [-10, 0, 10], lp0: 180, lp: 1700, lpT: 0.6, lpEnd: 500, q: 2, rev: 0.5 });
        if (S.mood === 'up' || S.mood === 'win' || (S.mood === 'calm' && bar % 4 === 0)) {
          const sc = c.slice(1).filter((m) => m >= 55).map((m) => m + (S.mood === 'calm' ? 0 : 12)).sort((x, y) => x - y);
          const notes = S.mood === 'calm' ? [[sc[0], 0, 2], [sc[1], 0.5, 2]] : [[sc[0], 0, 1], [sc[1], 0.25, 0.5], [sc[2], 0.375, 0.5], [sc[sc.length - 1], 0.5, 2]];
          notes.forEach(([m, at, n]) => voice({ t: t + at * barLen(), f: mtof(m), dur: n * barLen() / 4, a: 0.08, r: 0.5, gain: S.mood === 'calm' ? 0.06 : 0.11, type: 'sawtooth', det: [-6, 6], lp0: 500, lp: 2200, lpT: 0.25, lpEnd: 1300, vib: 7, rev: 0.55 }));
        }
      },
      step(i, t) {
        const c = chord(), d = this.stepDur(), r = c[0] + 12, pat = [0, 0, 12, 0, 0, 7, 0, 12, 0, 0, 12, 0, 3, 0, 7, 12];
        if (S.int > 0.4 && (S.int > 0.62 || i % 2 === 0)) voice({ t, f: mtof(r + pat[i]), dur: d * 0.5, a: 0.004, r: 0.07, gain: 0.07 + S.int * 0.04, type: 'sawtooth', det: [-8, 8], lp: 1300 + S.int * 1400, q: 1.2, pan: -0.2, rev: 0.2 });
        if (S.int > 0.5 && (i === 0 || i === 6 || i === 10 || (S.int > 0.75 && (i === 3 || i === 8 || i === 12 || i === 14)))) taiko(t, (i === 0 ? 0.6 : 0.38) + S.int * 0.1);
        if (S.int > 0.8 && i % 2 === 1) noise({ t, freq: 2200, q: 0.8, dur: 0.03, gain: 0.05 + (i === 15 ? 0.06 : 0), decay: 0.03 });
      },
    },
    // a jig in 6/8: guitar, then the frame drum, accordion and fiddle, stomp and clap; a whistle when it goes well
    folk: {
      steps: 6,
      stepDur: () => 60 / (60 + S.int * 40) / 3,
      bar(t) {
        const c = chord(), L = barLen() * 1.02;
        if (S.int > 0.25 || S.mood === 'win') for (const m of [c[1], c[2], c[3]]) voice({ t, f: mtof(m), dur: L, a: 0.12, r: 0.3, gain: 0.045, type: 'square', det: [-7, 7], lp: 1800, trem: 0.35, tremRate: 6, pan: 0.3, rev: 0.2 });
        if (S.mood === 'win' || S.mood === 'up') {
          const top = c.slice(1).map((m) => m + 24).filter((m) => m <= 91), mot = [top[top.length - 1], top[top.length - 2], top[top.length - 1], top[1] ?? top[0]];
          mot.forEach((m, k) => voice({ t: t + k * barLen() / 4, f: mtof(m), dur: barLen() / 4.4, a: 0.03, r: 0.12, gain: 0.045, type: 'triangle', vib: 18, vibRate: 6, rev: 0.45, pan: -0.2 }));
        }
      },
      step(i, t) {
        const c = chord(), d = this.stepDur(), up = i % 3 !== 0;
        if (i % 3 === 0 || (S.int > 0.5 && i % 3 === 2) || S.int > 0.8) { // the guitar, down and up
          const ns = up ? c.slice(2).reverse() : c;
          ns.forEach((m, k) => voice({ t: t + k * 0.012, f: mtof(m), dur: 0.02, r: up ? 0.25 : 0.7, gain: up ? 0.035 : 0.06, type: 'sawtooth', lp: 2600, lp0: 4200, lpT: 0.05, lpEnd: 900, pan: 0.15 * (k - 2) }));
        }
        if (S.int > 0.22 && (i % 3 === 0 || (S.int > 0.55 && i % 3 === 2) || S.int > 0.82)) taiko(t, i % 3 === 0 ? 0.32 : 0.14, 0.1);
        if (S.int > 0.7 && i === 3) clap(t, 0.12);
        if (S.int > 0.7 && i === 0) kick(t, 0.4);
        const fid = S.int > 0.42 ? 1 : S.mood === 'lose' ? (i % 3 === 0 ? 3 : 0) : 0; // the fiddle: a jig line, or long sad notes
        if (fid) {
          const sc = [...c.slice(1), c[1] + 12, c[2] + 12].map((m) => m + 12), m = sc[Math.floor(seeded(i + 1) * sc.length)];
          voice({ t, f: mtof(S.mood === 'lose' ? m - 12 : m), dur: fid === 3 ? d * 2.8 : d * 0.9, a: fid === 3 ? 0.15 : 0.02, r: fid === 3 ? 0.5 : 0.08, gain: fid === 3 ? 0.06 : 0.05, type: 'sawtooth', det: [-4, 4], lp: 2800, q: 1, vib: fid === 3 ? 22 : 12, vibRate: 5.8, pan: -0.25, rev: 0.3 });
        }
      },
    },
  };

  // ---------- the clock: notes are scheduled a quarter second ahead, from the game's frames ----------
  function schedule() {
    const until = ctx.currentTime + 0.25;
    if (nextT < ctx.currentTime - 0.5) nextT = ctx.currentTime + 0.05; // after a stall (a hidden tab): pick up from now
    while (nextT < until) {
      if (step === 0) {
        if (S.pend) { S.mood = S.pend; S.pend = null; chordI = 0; } else if (bar > 0) chordI = (chordI + 1) % 4;
        cur.bar(nextT); bar++;
      }
      cur.step(step, nextT);
      S.int += (S.tInt - S.int) * 0.12; S.ten += (S.tTen - S.ten) * 0.12;
      nextT += cur.stepDur(); step = (step + 1) % cur.steps;
    }
  }
  const now = () => ctx.currentTime;
  const setLevel = (v, tc = 0.6) => level.gain.setTargetAtTime(v, now(), tc);
  // a mood takes over at the next bar line, once it has held for a moment (a boat crossing 60 m won't flip it to and fro)
  function want(mood) {
    if (mood === S.mood && !S.pend) { S.cand = null; return; }
    if (mood === S.pend) return;
    if (S.cand !== mood) { S.cand = mood; S.candT = now(); return; }
    if (now() - S.candT > 1.5) { S.pend = mood; S.cand = null; }
  }
  // at once: a new mood from the next step, for the moments that can't wait for the bar line
  function jump(mood, int, ten) {
    S.mood = mood; S.pend = null; S.cand = null; chordI = 0; bar = 0;
    if (int != null) { S.int = S.tInt = int; S.ten = S.tTen = ten; }
    step = 0; nextT = Math.max(nextT - 0.2, now() + 0.03); // the steps queued ahead still sound; the new bar starts right after
  }

  // ---------- Racing: the recorded track, played bar by bar ----------
  // Each bar is its own source, faded in and out over X either side of its bar lines, so the next bar (or another
  // piece's) takes over on the line. A loop changes on its four-bar phrases; a moment that can't wait cuts in at once.
  const X = 0.015, R = { buf: null, loading: false, shift: 0, name: 'calm', k: 0, nextT: 0, cue: null, live: [] };
  R.lp = ctx.createBiquadFilter(); R.lp.type = 'lowpass'; R.lp.frequency.value = 20000; R.lp.Q.value = 0.5;
  R.out = ctx.createGain(); R.out.gain.value = 1.1; // as loud as the synthesized styles R.lp.connect(R.out);
  const starts = {}; // each bar's start in the file
  for (const [n, [at, lens]] of Object.entries(RACING)) if (Array.isArray(lens)) { let t = at; starts[n] = lens.map((l) => { const s = t; t += l; return s; }); }
  function loadRacing() {
    if (R.buf || R.loading) return; R.loading = true;
    fetch(new URL('music-racing.mp3', import.meta.url)).then((r) => r.arrayBuffer())
      .then((b) => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)))
      .then((b) => {
        // the blip at 0.2 s: where this browser's decoder put the file's start
        const d = b.getChannelData(0); let i = 0; while (i < d.length && Math.abs(d[i]) < 0.1) i++;
        R.shift = i < ctx.sampleRate ? i / b.sampleRate - 0.2 : 0; R.buf = b;
        if (style === 'racing') { R.nextT = now() + 0.05; setLevel(paused ? 0 : M.volume, 0.5); }
      }, () => { R.loading = false; });
  }
  // a stretch of the file (at, len) into the bus from t, faded in at its start and out at its end; returns its handle
  function clip(at, len, t, gain = 1, dest = R.lp, fadeIn = X, fadeOut = X) {
    const s = ctx.createBufferSource(), g = ctx.createGain(), c = ctx.createGain(), n = now(), skip = Math.max(0, n - (t - fadeIn));
    s.buffer = R.buf; s.connect(g).connect(c).connect(dest);
    g.gain.setValueAtTime(0, t - fadeIn); g.gain.linearRampToValueAtTime(gain, t + fadeIn); g.gain.setValueAtTime(gain, t + len - fadeOut); g.gain.linearRampToValueAtTime(0, t + len + fadeOut);
    s.start(t - fadeIn + skip, Math.max(0, at + R.shift - fadeIn + skip), len + fadeIn + fadeOut - skip + 0.01);
    const v = { s, c, t, end: t + len }; R.live.push(v); s.onended = () => { const i = R.live.indexOf(v); if (i >= 0) R.live.splice(i, 1); };
    return v;
  }
  // everything playing or queued fades out over X either side of t
  function cutAt(t) {
    for (const v of R.live) if (v.end > t - X) { v.c.gain.cancelScheduledValues(0); v.c.gain.setValueAtTime(1, Math.max(now(), t - X)); v.c.gain.linearRampToValueAtTime(0, Math.max(now(), t - X) + 2 * X); }
  }
  // a piece from bar k, at t (now, if not given): what's playing gives way
  function cue(name, k = 0, t = now() + 0.03) { cutAt(t); R.cue = { name, k, at: t }; if (R.nextT > t) R.nextT = t; }
  // the tape stops: what's playing slows to a growl and dies away, then the next piece
  function tapeStop(then, dur = 0.6) {
    const n = now();
    for (const v of R.live) {
      if (v.t <= n) { v.s.playbackRate.setValueAtTime(1, n); v.s.playbackRate.exponentialRampToValueAtTime(0.25, n + dur); v.c.gain.setValueAtTime(1, n); v.c.gain.linearRampToValueAtTime(0, n + dur); }
      else v.c.gain.setValueAtTime(0, n);
    }
    R.cue = { name: then, k: 0, at: n + dur }; R.nextT = n + dur;
  }
  function scheduleRacing() {
    if (!R.buf) return;
    const until = now() + 0.25;
    if (R.nextT < now() - 0.5) R.nextT = now() + 0.05;
    while (R.nextT < until) {
      if (R.cue && R.nextT >= R.cue.at - 0.002) { R.name = R.cue.name; R.k = R.cue.k; R.nextT = R.cue.at; R.cue = null; }
      else if (R.k % 4 === 0 && !ONE_SHOT[R.name]) { // a phrase line: the mood that's waiting, and the loop for it
        if (S.pend) { S.mood = S.pend; S.pend = null; }
        const want = racingPiece(S.mood, S.tInt); if (want !== R.name) { R.name = want; R.k = 0; }
      }
      const len = RACING[R.name][1][R.k], v = clip(starts[R.name][R.k], len, R.nextT);
      if (R.cue && R.cue.at < v.end - X) { cutAt(R.cue.at); R.nextT = R.cue.at; continue; }
      R.nextT = v.end; R.k++;
      if (R.k >= RACING[R.name][1].length) { const o = ONE_SHOT[R.name]; if (o) { R.name = o.then; R.k = o.at; } else R.k = 0; }
    }
    S.int = S.tInt; S.ten = S.tTen;
  }
  // an accent made of the track: the crash, the same reversed (rising to its end), the drop's downbeat
  function accent(name, t, gain, from = 0) { const [at, len] = RACING[name]; clip(at + from, len - from, t, gain, R.out, 0.003, 0.003); }
  // the lowpass: closed for a moment, or for a mood, and open again
  function filter(hz, t = 0.3) { R.lp.frequency.setTargetAtTime(hz, now(), t); }

  // the moments, in the track's own sounds
  function racingSting(kind, t) {
    if (!R.buf) return;
    if (kind === 'gun') { S.mood = 'up'; S.pend = null; S.tInt = 0.65; if (!R.built) cue('race'); R.built = false; filter(20000, 0.05); } // the drop: the build brought it, or now
    else if (kind === 'swell') accent('swell', t, 0.5, 1.2); // the last 1.2 s, rising into the signal
    else if (kind === 'round') accent('crash', t, 0.6);
    else if (kind === 'gain') { accent('swell', t, 0.5, RACING.swell[1] - 0.6); accent('crash', t + 0.6, 0.7); }
    else if (kind === 'hit') { accent('hit', t, 0.8); R.lp.frequency.cancelScheduledValues(t); R.lp.frequency.setValueAtTime(350, t + 0.05); R.lp.frequency.setTargetAtTime(20000, t + 0.4, 0.5); }
    else if (kind === 'loss') { S.mood = 'dark'; S.pend = null; tapeStop('dark'); }
    else if (kind === 'win') { S.mood = 'win'; S.pend = null; filter(20000, 0.05); cue('finale'); }
    else if (kind === 'lose') { S.mood = 'lose'; S.pend = null; tapeStop('dark', 1.2); filter(700, 1.5); }
  }

  Object.defineProperties(M, Object.getOwnPropertyDescriptors({ // (descriptors, so the getter stays a getter)
    get style() { return style; },
    get state() { return { int: S.int, ten: S.ten, mood: S.mood, pend: S.pend, paused, duck: duck.gain.value, piece: style === 'racing' ? `${R.name} ${R.k}` : null }; }, // for ?debug
    // 'ambient' | 'film' | 'folk', or null for none; a change crossfades
    setStyle(id) {
      id = MUSIC_STYLES.includes(id) ? id : null;
      if (id === style) return;
      if (cur) retire(cur.bus);
      style = id; cur = null;
      if (!id) return;
      if (id === 'racing') { // its own player: the bus is the track's
        cur = { bus: newBus() }; R.lp.disconnect(); R.out.disconnect(); R.out.connect(cur.bus); R.live.length = 0;
        R.name = racingPiece(S.mood, S.tInt); R.k = 0; R.cue = null; R.nextT = now() + 0.08; filter(20000, 0.01);
        loadRacing(); R.lp.connect(R.out); if (R.buf) setLevel(paused ? 0 : M.volume, 0.5);
        return;
      }
      cur = Object.create(STYLES[id]); cur.bus = newBus();
      bar = 0; step = 0; chordI = 0; nextT = now() + 0.08;
      setLevel(paused ? 0 : M.volume, 0.5);
    },
    // what direct() said: the dials ease there, the mood waits for the bar line
    set({ int, ten, mood }) { S.tInt = int; S.tTen = ten; want(mood); },
    // a fresh race: back to the quiet of the pre-start
    reset() {
      S.int = S.tInt = 0.2; S.ten = S.tTen = 0.25; S.cand = null;
      if (style === 'racing') { S.mood = 'calm'; S.pend = null; R.built = false; filter(20000, 0.05); if (R.buf) cue('calm'); }
      else if (cur) jump('calm'); else { S.mood = 'calm'; S.pend = null; }
    },
    // paused, the music fades out; back, it fades in
    pause(v) { if (v === paused) return; paused = v; setLevel(v ? 0 : M.volume, v ? 0.25 : 0.8); },
    // how loud the music is (Settings › Music volume): its level, eased there
    setVolume(v) { if (v === M.volume) return; M.volume = v; if (cur && !paused && (style !== 'racing' || R.buf)) setLevel(v, 0.3); },
    // the voices: v 0..1, how loud a voice is now (main.js measures them); the music bows out under them
    voices(v) {
      if (now() < breathUntil) return;
      duck.gain.setTargetAtTime(v > 0.02 ? 0.35 : 1, now(), v > 0.02 ? 0.06 : 0.5);
    },
    // a sweep that climbs for dur seconds, to the gun
    riser(dur) {
      if (!cur || dur < 1) return; const t = now() + 0.02;
      if (style === 'racing') { // the build's last bars, so its drop lands on the gun
        if (!R.buf) return;
        const L = RACING.build[1]; let j = 8, s = 0; while (j > 0 && s + L[j - 1] <= dur - 0.05) s += L[--j];
        if (j < 8) { cue('build', j, now() + dur - s); R.built = true; }
        return;
      }
      noise({ t, freq: 300, sweep: 7000, q: 2.5, dur, gain: 0.14, rise: 1, rev: 0.2 });
      voice({ t, f: 110, slide: 440, slideT: dur, dur, a: dur * 0.9, r: 0.05, gain: 0.05, type: 'sawtooth', det: [-12, 12], lp: 3000, rev: 0.2 });
    },
    // half a second of near silence before the gun, so the gun lands
    breath(dur = 0.5) { breathUntil = now() + dur + 0.6; duck.gain.cancelScheduledValues(now()); duck.gain.setTargetAtTime(0.08, now(), 0.05); duck.gain.setTargetAtTime(1, now() + dur + 0.5, 0.05); },
    // an accent: 'gun', 'hit', 'swell', 'gain', 'loss', 'round', 'win', 'lose'. The small ones keep 3 s apart
    sting(kind) {
      if (!cur || paused) return;
      const t = now() + 0.02, big = kind === 'gun' || kind === 'win' || kind === 'lose';
      if (big || t < breathUntil) { breathUntil = 0; duck.gain.cancelScheduledValues(t); duck.gain.setTargetAtTime(1, t, 0.02); } // the breath ends on the gun, whatever it brings
      if (!big && t - lastSting < 3) return;
      lastSting = t;
      if (style === 'racing') { racingSting(kind, t); return; }
      if (kind === 'gun') jump('up', 0.65, 0.3);
      if (kind === 'win') jump('win', 0.55, 0);
      if (kind === 'lose') jump('lose', 0.12, 0.1);
      if (kind === 'loss') jump('dark', 0.32, 0.6);
      const c = chord(), b = c[0];
      if (kind === 'gun') {
        kick(t, 0.9); taiko(t, 0.8, 0.5); crash(t, 0.22);
        for (const m of [b, b + 7, b + 12]) voice({ t, f: mtof(m), dur: 0.6, a: 0.005, r: 1.8, gain: 0.12, type: 'sawtooth', det: [-10, 10], lp0: 2500, lp: 500, lpT: 0.6, rev: 0.6 });
      } else if (kind === 'hit') {
        taiko(t, 0.7, 0.5); kick(t, 0.6);
        for (const m of [b, b + 1, b + 12]) voice({ t, f: mtof(m), dur: 0.4, a: 0.01, r: 1.2, gain: 0.09, type: 'sawtooth', lp0: 1800, lp: 400, lpT: 0.5, rev: 0.5 });
      } else if (kind === 'swell') {
        noise({ t, freq: 6000, ftype: 'highpass', dur: 1.6, gain: 0.1, rise: 1, rev: 0.3 });
      } else if (kind === 'gain' || kind === 'round') {
        const ns = [...c.slice(1).slice(-4).map((m) => m + 12), c[c.length - 1] + 24].slice(kind === 'round' ? 2 : 0);
        ns.forEach((m, k) => voice({ t: t + k * 0.07, f: mtof(m), dur: 0.05, r: 1.1, gain: kind === 'round' ? 0.05 : 0.07, type: 'triangle', rev: 0.6, pan: -0.6 + k * 0.3 }));
        if (kind === 'gain') noise({ t, freq: 3000, sweep: 9000, q: 1, dur: 0.5, gain: 0.05, rise: 1 });
      } else if (kind === 'loss') {
        voice({ t, f: mtof(b + 24), slide: mtof(b + 12), slideT: 0.9, dur: 0.9, a: 0.01, r: 0.6, gain: 0.07, type: 'sawtooth', det: [-20, 20], lp: 1400, rev: 0.5 });
        for (const m of [b, b + 1]) voice({ t, f: mtof(m), dur: 1.2, a: 0.02, r: 1.5, gain: 0.1, type: 'sawtooth', lp: 380, rev: 0.4 });
        taiko(t, 0.5, 0.5);
      } else if (kind === 'win') {
        kick(t, 0.8); crash(t, 0.25); taiko(t + 0.25, 0.5, 0.5);
        const k = style === 'film' ? -2 : style === 'folk' ? -7 : 0; // the tonic major chord of each style's key
        for (const m of [62, 66, 69, 74, 78]) voice({ t, f: mtof(m + k), dur: 2.5, a: 0.02, r: 2.5, gain: 0.07, type: 'sawtooth', det: [-8, 8], lp0: 4000, lp: 1500, lpT: 1.5, rev: 0.7 });
      } else if (kind === 'lose') {
        gong(t, 0.2);
      }
    },
    // every frame
    update() { if (cur && !paused) (style === 'racing' ? scheduleRacing() : schedule()); },
  }));
  return M;
}
