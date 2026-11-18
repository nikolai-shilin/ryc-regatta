// ---------- the soundtrack: a recorded track that follows the race ----------
// Four tracks to pick from (Settings › Music): Racing, Groove, Riff and Open water. Each plays from two dials, intensity
// and tension, and a mood that picks the piece of its track: calm, tense, up, dark, win, lose. direct() turns the race
// into the dials and the mood; main.js adds the accents at the big moments (sting) and the build to the gun (riser,
// breath). A track loads the first time it's chosen.

// a file next to this module, by the address the page's import map gives it: its content's hash after a deploy
// (scripts/stamp-game.mjs), so it is cached for good; the plain address where there is none (npm run dev)
const fileAt = (f) => (import.meta.resolve ? import.meta.resolve(`./${f}`) : new URL(f, import.meta.url).href);
export const MUSIC_STYLES = ['racing', 'groove', 'riff', 'openwater'];

// Each track is cut on its bar lines by scripts/music.py into music-<id>.mp3: loops for the moods, the build that lands
// its drop on the gun, its ending for a win, and accents made of its crash. Each piece: where it starts in the file (s),
// and its bars' lengths (s), or how long it is.
const TRACKS = {
  racing: { // E minor, speeding up from 131 to 137 bpm
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
  },
  groove: { // D major, 117 slowing to 115 bpm
    calm: [0.9, [2.0587, 2.056, 2.0533, 2.0667, 2.048, 2.0587, 2.0507, 2.0533]],
    drive: [18.3453, [2.0507, 2.0507, 2.0533, 2.0533, 2.0453, 2.0533, 2.0533, 2.0533, 2.0453, 2.0453, 2.048, 2.0587, 2.056, 2.0533, 2.0533, 2.0507]],
    dark: [52.1693, [2.0907, 2.08, 2.088, 2.0907, 2.0933, 2.0933, 2.104, 2.1307]],
    race: [69.94, [2.0747, 2.0587, 2.064, 2.0613, 2.064, 2.072, 2.072, 2.056, 2.0667, 2.0773, 2.0773, 2.0747, 2.08, 2.0853, 2.08, 2.08]],
    peak: [104.084, [2.072, 2.056, 2.0667, 2.0773, 2.0773, 2.0747, 2.08, 2.0853]],
    build: [121.673, [2.064, 2.0613, 2.0667, 2.064, 2.0587, 2.0613, 2.0667, 2.0747, 2.0747, 2.0587, 2.064, 2.0613]],
    finale: [147.449, [2.1307, 2.128, 2.168, 2.2107, 2.1227, 2.088, 2.096, 2.0613, 2.0747]],
    crash: [169.091, 2.4],
    swell: [171.891, 2.42],
    hit: [174.721, 0.9],
  },
  riff: { // D major, 120 bpm
    calm: [0.9, [2.0293, 2.0267, 2.024, 2.0187, 2.032, 2.0213, 2.0293, 2.024, 2.0293, 2.0133, 2.032, 2]],
    drive: [26.18, [2.0133, 2.0107, 2.0107, 2.0133, 2.0107, 2.0107, 2.008, 2.0133, 2.0107, 2.008, 2.008, 2.0027, 2.0107, 2.0053, 2.0053, 2.0053]],
    dark: [59.3267, [1.9973, 2.0053, 2, 1.9947]],
    race: [68.324, [1.9947, 2, 2, 1.9973, 2.0027, 2, 1.9973, 2, 1.9973, 2, 2, 2, 2, 2, 1.9973, 1.9947]],
    peak: [101.305, [1.9973, 2, 2, 2, 2, 2, 1.9973, 1.9947]],
    build: [118.295, [2, 1.9947, 1.9973, 2.0053, 1.9973, 2, 2.0027, 2, 1.9947, 2, 2, 1.9973]],
    finale: [143.284, [2.0267, 2.032, 2.04, 2.2293, 1.9653, 2.0107, 1.96, 1.9573, 1.9173, 2.0267]],
    crash: [165.707, 2.4],
    swell: [168.507, 2.42],
    hit: [171.337, 0.9],
  },
  openwater: { // E minor, 130 speeding up to 134 bpm
    calm: [0.9, [1.7893, 1.7893, 1.792, 1.7893, 1.792, 1.784, 1.7973, 1.7867]],
    drive: [16.22, [1.808, 1.8133, 1.8, 1.8133, 1.8053, 1.808, 1.8053, 1.808, 1.8053, 1.8053, 1.808, 1.8027, 1.8053, 1.8053, 1.8053, 1.8027]],
    dark: [46.1213, [1.7947, 1.7973, 1.7947, 1.7947, 1.792, 1.7947, 1.7947, 1.7893]],
    race: [61.4733, [1.792, 1.792, 1.7893, 1.7893, 1.792, 1.7893, 1.792, 1.792, 1.7893, 1.792, 1.7893, 1.7893, 1.792, 1.7893, 1.792, 1.7893]],
    peak: [91.124, [1.792, 1.7893, 1.7893, 1.7893, 1.7893, 1.792, 1.7893, 1.7893]],
    build: [106.444, [1.7947, 1.792, 1.7893, 1.7947, 1.7893, 1.7893, 1.7893, 1.792, 1.792, 1.792, 1.7893, 1.7893]],
    finale: [128.937, [1.7893, 1.792, 1.7867, 1.8, 1.7867, 1.7813, 1.7787]],
    crash: [143.424, 2.4],
    swell: [146.224, 2.42],
    hit: [149.054, 0.9],
  },
};
const ONE_SHOT = { build: { then: 'race', at: 4 }, finale: { then: 'calm', at: 0, quiet: { racing: 0.45, groove: 0.6, openwater: 1.1 } } }; // and where they lead on to (quiet: the seconds of a track's ending that are only its last ring, which the next piece comes in over)
// which loop plays: by the mood, and in it by the intensity
export function piece(mood, int) {
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

// the player: ctx an AudioContext, out the node it plays into (the game's master, so Sound off silences it too)
export function createMusic(ctx, out) {
  // the track → its level → the duck (under voices, and the breath before the gun) → a gentle compressor → out
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.connect(out);
  const duck = ctx.createGain(); duck.connect(comp);
  const level = ctx.createGain(); level.gain.value = 0; level.connect(duck);

  const S = { int: 0.2, ten: 0.2, tInt: 0.2, tTen: 0.2, mood: 'calm', pend: null, cand: null, candT: 0 };
  let style = null, cur = null, paused = false, lastSting = -1e9, breathUntil = 0, voiceT = -1e9, ducked = null;
  const M = { volume: 0.5 };

  const newBus = () => { const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(level); return bus; };
  const retire = (bus, tc = 0.4) => {
    if (!bus) return; const n = ctx.currentTime;
    bus.gain.cancelScheduledValues(n); bus.gain.setTargetAtTime(0, n, tc);
    setTimeout(() => { try { bus.disconnect(); } catch (e) {} }, tc * 8000 + 3000);
  };

  const now = () => ctx.currentTime;
  const setLevel = (v, tc = 0.6) => level.gain.setTargetAtTime(v, now(), tc);
  // a mood takes over at the next phrase, once it has held for a moment (a boat crossing 60 m won't flip it to and fro)
  function want(mood) {
    if (mood === S.mood && !S.pend) { S.cand = null; return; }
    if (mood === S.pend) return;
    if (S.cand !== mood) { S.cand = mood; S.candT = now(); return; }
    if (now() - S.candT > 1.5) { S.pend = mood; S.cand = null; }
  }

  // ---------- the track, played bar by bar ----------
  // Each bar is its own source, faded in and out over X either side of its bar lines, so the next bar (or another
  // piece's) takes over on the line. A loop changes on its four-bar phrases; a moment that can't wait cuts in at once.
  // A track's sound runs through its own lowpass and out to its bus, so a change of track crossfades.
  const X = 0.015, R = { T: null, starts: null, lp: null, out: null, name: 'calm', k: 0, nextT: 0, cue: null, live: [], built: false, line: 0, lineName: null };
  const bufs = {}, shifts = {}, loading = {}, starts = {};
  for (const [id, T] of Object.entries(TRACKS)) { // each bar's start in its file
    starts[id] = {};
    for (const [n, [at, lens]] of Object.entries(T)) if (Array.isArray(lens)) { let t = at; starts[id][n] = lens.map((l) => { const s = t; t += l; return s; }); }
  }
  const buf = () => style && bufs[style];
  function load(id) {
    if (bufs[id] || loading[id]) return; loading[id] = true;
    fetch(fileAt(`music-${id}.mp3`)).then((r) => r.arrayBuffer())
      .then((b) => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)))
      .then((b) => {
        // the blip at 0.2 s: where this browser's decoder put the file's start
        const d = b.getChannelData(0); let i = 0; while (i < d.length && Math.abs(d[i]) < 0.1) i++;
        shifts[id] = i < ctx.sampleRate ? i / b.sampleRate - 0.2 : 0; loading[id] = false;
        if (style !== id) return; // the player chose another while it came in: not kept (see setStyle)
        bufs[id] = b; R.nextT = now() + 0.05; setLevel(paused ? 0 : M.volume, 0.5);
      }, () => { loading[id] = false; });
  }
  // a stretch of the file (at, len) into the bus from t, faded in at its start and out at its end; returns its handle
  function clip(at, len, t, gain = 1, dest = R.lp, fadeIn = X, fadeOut = X) {
    const s = ctx.createBufferSource(), g = ctx.createGain(), c = ctx.createGain(), n = now(), skip = Math.max(0, n - (t - fadeIn));
    s.buffer = bufs[style]; s.connect(g).connect(c).connect(dest);
    g.gain.setValueAtTime(0, t - fadeIn); g.gain.linearRampToValueAtTime(gain, t + fadeIn); g.gain.setValueAtTime(gain, t + len - fadeOut); g.gain.linearRampToValueAtTime(0, t + len + fadeOut);
    // (a stretch already over, scheduled from a cue that fell due while the page had no frames: a moment, silent, not a throw)
    s.start(t - fadeIn + skip, Math.max(0, at + shifts[style] - fadeIn + skip), Math.max(0.001, len + fadeIn + fadeOut - skip + 0.01));
    const live = R.live, v = { s, c, t, end: t + len }; live.push(v); s.onended = () => { const i = live.indexOf(v); if (i >= 0) live.splice(i, 1); };
    return v;
  }
  const halt = (v, t) => { try { v.s.stop(t); } catch (e) {} };
  // everything playing or queued fades out over X either side of t, and stops there
  function cutAt(t) {
    for (const v of R.live) if (v.end > t - X) { const from = Math.max(now(), t - X); v.c.gain.cancelScheduledValues(0); v.c.gain.setValueAtTime(1, from); v.c.gain.linearRampToValueAtTime(0, from + 2 * X); halt(v, from + 2 * X + 0.01); }
  }
  // a piece from bar k, at t (now, if not given): what's playing gives way
  function cue(name, k = 0, t = now() + 0.03) { cutAt(t); R.cue = { name, k, at: t }; R.line = 0; if (R.nextT > t) R.nextT = t; }
  // the tape stops: what's playing slows to a growl and dies away, and halfway down the next piece comes in under it
  function tapeStop(then, dur = 0.6) {
    const n = now(), at = n + dur / 2;
    for (const v of R.live) {
      if (v.t <= n) { v.s.playbackRate.setValueAtTime(1, n); v.s.playbackRate.exponentialRampToValueAtTime(0.25, n + dur); v.c.gain.setValueAtTime(1, n); v.c.gain.linearRampToValueAtTime(0, n + dur); halt(v, n + dur + 0.02); }
      else { v.c.gain.setValueAtTime(0, n); halt(v, n); }
    }
    R.cue = { name: then, k: 0, at }; R.nextT = at; R.line = 0;
  }
  // ---------- the clock: bars are queued further ahead than the page is ever likely to stall, from the game's frames ----------
  // (the audio thread plays what's queued whatever the page is doing: a frame held up by shaders compiling or a slow
  // phone's garbage collection is not heard. Anything that changes the music cuts the queue at the moment it changes.)
  const AHEAD = 2.5;
  function schedule() {
    if (!buf()) return;
    const until = now() + AHEAD, T = R.T;
    if (R.nextT < now() - 0.5) R.nextT = now() + 0.05; // after a stall (a hidden tab): pick up from now
    // a mood that turned after the next phrase line was queued still takes that line
    if (S.pend && !R.cue && R.line > now() + 0.1) {
      S.mood = S.pend; S.pend = null;
      const next = piece(S.mood, S.tInt); if (next !== R.lineName) cue(next, 0, R.line);
    }
    while (R.nextT < until) {
      if (R.cue && R.nextT >= R.cue.at - 0.002) { R.name = R.cue.name; R.k = R.cue.k; R.nextT = R.cue.at; R.cue = null; }
      else if (R.k % 4 === 0 && !ONE_SHOT[R.name]) { // a phrase line: the mood that's waiting, and the loop for it
        if (S.pend) { S.mood = S.pend; S.pend = null; }
        const want = piece(S.mood, S.tInt); if (want !== R.name) { R.name = want; R.k = 0; }
        R.line = R.nextT; R.lineName = R.name;
      }
      const len = T[R.name][1][R.k], v = clip(R.starts[R.name][R.k], len, R.nextT);
      if (R.cue && R.cue.at < v.end - X) { cutAt(R.cue.at); R.nextT = R.cue.at; continue; }
      R.nextT = v.end; R.k++;
      if (R.k >= T[R.name][1].length) { const o = ONE_SHOT[R.name]; if (o) { R.nextT -= o.quiet?.[style] ?? 0; R.name = o.then; R.k = o.at; } else R.k = 0; }
    }
    S.int = S.tInt; S.ten = S.tTen;
  }
  // an accent made of the track: the crash, the same reversed (rising to its end), the drop's downbeat
  function accent(name, t, gain, from = 0) { const [at, len] = R.T[name]; clip(at + from, len - from, t, gain, R.out, 0.003, 0.003); }
  // the lowpass: closed for a moment, or for a mood, and open again
  function filter(hz, t = 0.3) { if (R.lp) R.lp.frequency.setTargetAtTime(hz, now(), t); }

  // the moments, in the track's own sounds
  function trackSting(kind, t) {
    if (!buf()) return;
    if (kind === 'gun') { S.mood = 'up'; S.pend = null; S.tInt = 0.65; if (!R.built) cue('race'); R.built = false; filter(20000, 0.05); } // the drop: the build brought it, or now
    else if (kind === 'swell') accent('swell', t, 0.5, 1.2); // the last 1.2 s, rising into the signal
    else if (kind === 'round') accent('crash', t, 0.6);
    else if (kind === 'gain') { accent('swell', t, 0.5, R.T.swell[1] - 0.6); accent('crash', t + 0.6, 0.7); }
    else if (kind === 'hit') { accent('hit', t, 0.8); R.lp.frequency.cancelScheduledValues(t); R.lp.frequency.setValueAtTime(350, t + 0.05); R.lp.frequency.setTargetAtTime(20000, t + 0.4, 0.5); }
    else if (kind === 'loss') { S.mood = 'dark'; S.pend = null; tapeStop('dark'); }
    else if (kind === 'win') { S.mood = 'win'; S.pend = null; filter(20000, 0.05); cue('finale'); }
    else if (kind === 'lose') { S.mood = 'lose'; S.pend = null; tapeStop('dark', 1.2); filter(700, 1.5); }
  }

  Object.defineProperties(M, Object.getOwnPropertyDescriptors({ // (descriptors, so the getter stays a getter)
    get style() { return style; },
    get state() { return { int: S.int, ten: S.ten, mood: S.mood, pend: S.pend, paused, duck: duck.gain.value, piece: style ? `${R.name} ${R.k}` : null }; }, // for ?debug
    // one of MUSIC_STYLES, or null for none; a change crossfades
    setStyle(id) {
      id = MUSIC_STYLES.includes(id) ? id : null;
      if (id === style) return;
      if (cur) retire(cur.bus);
      // the old track let go: decoded, a track is some 65 MB (three minutes of stereo floats), and on a phone that
      // counts against the same memory as the scene. Its bars still fading out hold their own reference till they end;
      // choosing it again fetches it again (from the cache).
      if (style) delete bufs[style];
      style = id; cur = null; R.live = [];
      if (!id) return;
      cur = { bus: newBus() };
      R.T = TRACKS[id]; R.starts = starts[id];
      R.lp = ctx.createBiquadFilter(); R.lp.type = 'lowpass'; R.lp.frequency.value = 20000; R.lp.Q.value = 0.5;
      R.out = ctx.createGain(); R.out.gain.value = 1.1; R.lp.connect(R.out); R.out.connect(cur.bus);
      R.name = piece(S.mood, S.tInt); R.k = 0; R.cue = null; R.built = false; R.line = 0; R.nextT = now() + 0.08;
      load(id); if (buf()) setLevel(paused ? 0 : M.volume, 0.5);
    },
    // what direct() said: the dials ease there, the mood waits for the phrase line
    set({ int, ten, mood }) { S.tInt = int; S.tTen = ten; want(mood); },
    // a fresh race: back to the quiet of the pre-start
    reset() {
      S.int = S.tInt = 0.2; S.ten = S.tTen = 0.25; S.cand = null; S.mood = 'calm'; S.pend = null;
      if (style) { R.built = false; filter(20000, 0.05); if (buf()) cue('calm'); }
    },
    // paused, the music fades out; back, it fades in
    pause(v) { if (v === paused) return; paused = v; setLevel(v ? 0 : M.volume, v ? 0.25 : 0.8); },
    // how loud the music is (Settings › Music volume): its level, eased there
    setVolume(v) { if (v === M.volume) return; M.volume = v; if (buf() && !paused) setLevel(v, 0.3); },
    // the voices: v 0..1, how loud a voice is now (main.js measures them); the music bows out under them, and stays
    // down through the gaps between the words
    voices(v) {
      const n = now(); if (n < breathUntil) return;
      if (v > 0.02) voiceT = n;
      const down = n - voiceT < 0.4; if (down === ducked) return;
      ducked = down; duck.gain.setTargetAtTime(down ? 0.35 : 1, n, down ? 0.06 : 0.5);
    },
    // the build's last bars, dur seconds of them, so its drop lands on the gun
    riser(dur) {
      if (!buf() || dur < 1) return;
      const L = R.T.build[1], drop = L.length - 4; let j = drop, s = 0;
      while (j > 0 && s + L[j - 1] <= dur - 0.05) s += L[--j];
      if (j < drop) { cue('build', j, now() + dur - s); R.built = true; }
    },
    // half a second of near silence before the gun, so the gun lands
    breath(dur = 0.5) { breathUntil = now() + dur + 0.6; ducked = null; duck.gain.cancelScheduledValues(now()); duck.gain.setTargetAtTime(0.08, now(), 0.05); duck.gain.setTargetAtTime(1, now() + dur + 0.5, 0.05); },
    // an accent: 'gun', 'hit', 'swell', 'gain', 'loss', 'round', 'win', 'lose'. The small ones keep 3 s apart
    sting(kind) {
      if (!cur || paused) return;
      const t = now() + 0.02, big = kind === 'gun' || kind === 'win' || kind === 'lose';
      if (big || t < breathUntil) { breathUntil = 0; ducked = null; duck.gain.cancelScheduledValues(t); duck.gain.setTargetAtTime(1, t, 0.02); } // the breath ends on the gun, whatever it brings
      if (!big && t - lastSting < 3) return;
      lastSting = t;
      trackSting(kind, t);
    },
    // every frame
    update() { if (cur && !paused) schedule(); },
  }));
  return M;
}
