// The sea's chop: the spectrum it is raised from is a real sea's, each layer keeps its own band of it, the field is the
// conjugate-symmetric one a real surface needs, and every frame runs its passes in the right order, on the right targets,
// without ever reading the texture it is writing to.
import test from 'node:test';
import assert from 'node:assert/strict';
import './load.mjs';
import { fakeRenderer, watchDispose } from './fake-page.mjs';

const THREE = await import('three');
const { seaSpectrum, Ocean, oceanUniforms, blankOcean, OCEAN_GLSL, SWELL_GLSL } = await import('../public/game/ocean.js');

const close = (a, b, e = 1e-6, what = '') => assert.ok(Math.abs(a - b) <= e, `${what} ${a} is not ${b}`);
const U = 8, F = 8000; // a fresh breeze over a bay

// the sea's variance of height: the spectrum added up over every wavenumber, in polar steps
function variance(u, f, kMax = 80) {
  let sum = 0;
  const NK = 900, NA = 96;
  for (let i = 0; i < NK; i++) {
    const k = 1e-3 * (kMax / 1e-3) ** ((i + 0.5) / NK), dk = k * Math.log(kMax / 1e-3) / NK;
    for (let j = 0; j < NA; j++) { const a = -Math.PI + ((j + 0.5) * 2 * Math.PI) / NA; sum += seaSpectrum(k * Math.sin(a), k * Math.cos(a), u, f) * k * dk * (2 * Math.PI / NA); }
  }
  return sum;
}

// ---------- the spectrum ----------
test('the spectrum is finite and never negative, from the longest swell to the shortest ripple', () => {
  for (const u of [2.5, 5, 10, 20]) for (const f of [1000, 8000, 40000]) {
    for (let e = -5; e <= 4; e += 0.25) for (let a = 0; a < 16; a++) {
      const k = 10 ** e, v = seaSpectrum(k * Math.sin(a * Math.PI / 8), k * Math.cos(a * Math.PI / 8), u, f);
      assert.ok(Number.isFinite(v) && v >= 0, `S(k=${k}, a=${a}, U=${u}, F=${f}) = ${v}`);
    }
  }
});

test('there is no energy at a wavenumber of zero', () => {
  assert.equal(seaSpectrum(0, 0, U, F), 0);
  assert.equal(seaSpectrum(1e-7, 0, U, F), 0);
});

test('the waves run downwind: more energy along the wind than across it, and almost none against it', () => {
  const k = 1.5, along = seaSpectrum(0, k, U, F), across = seaSpectrum(k, 0, U, F), up = seaSpectrum(0, -k, U, F);
  assert.ok(along > across, `${along} along, ${across} across`);
  assert.ok(up < along * 1e-6, `${up} against the wind`);
});

test('the sea is the same on either side of the wind', () => {
  for (const [kx, kz] of [[0.3, 0.9], [2, 1], [5, -3]]) close(seaSpectrum(kx, kz, U, F), seaSpectrum(-kx, kz, U, F), 1e-12);
});

test('its peak lies at the wavelength a wind of that strength raises over that fetch', () => {
  const G = 9.81, wp = 22 * Math.cbrt((G * G) / (U * F)), kp = (wp * wp) / G;
  let best = 0, at = 0;
  for (let k = kp * 0.3; k < kp * 3; k *= 1.01) { const s = seaSpectrum(0, k, U, F) * k * k; if (s > best) { best = s; at = k; } } // per dk, along the wind
  assert.ok(at > kp * 0.6 && at < kp * 1.5, `the peak at k = ${at}, against ${kp}`);
});

test('a stronger wind raises a bigger sea, and so does a longer fetch', () => {
  assert.ok(variance(12, F) > variance(6, F) * 1.5);
  assert.ok(variance(U, 30000) > variance(U, 4000) * 1.5);
});

test('the waves it adds up to are the height a real sea has', () => {
  // the fetch-limited growth law: Hs ≈ 1.6e-3 · U · √(F / g)
  for (const [u, f] of [[6, 8000], [10, 8000], [14, 20000]]) {
    const Hs = 4 * Math.sqrt(variance(u, f)), want = 1.6e-3 * u * Math.sqrt(f / 9.81);
    assert.ok(Hs > want * 0.6 && Hs < want * 1.6, `U ${u}, F ${f}: Hs ${Hs.toFixed(2)} m against ${want.toFixed(2)} m`);
  }
});

test('ripples under a centimetre are damped away', () => {
  assert.ok(seaSpectrum(0, 2000, U, F) < seaSpectrum(0, 200, U, F) * 1e-9);
});

// ---------- what the shaders share ----------
test('every sea starts blank: the same black texel, in uniforms of its own', () => {
  const a = oceanUniforms(), b = oceanUniforms();
  assert.equal(blankOcean(), blankOcean());
  assert.equal(a.uFftD.value, blankOcean());
  assert.deepEqual([...blankOcean().image.data], [0, 0, 0, 255]);
  assert.notEqual(a.uFftD, b.uFftD);
  assert.notEqual(a.uFftL.value, b.uFftL.value);
  assert.equal(a.uFftOn.value, 0);
});

test('the shader chunks declare what the water and the marks call', () => {
  for (const f of ['fftDisp', 'fftSlope', 'fftFine', 'fftCaustic']) assert.match(OCEAN_GLSL, new RegExp(`\\b${f}\\(vec2`));
  assert.match(SWELL_GLSL, /float swellG\(int i, vec2 xz\)/);
  for (const s of [OCEAN_GLSL, SWELL_GLSL]) assert.equal(s.split('{').length, s.split('}').length, 'its braces balance');
});

// ---------- the Ocean ----------
test('it needs WebGL 2 and float targets', () => {
  assert.equal(Ocean.supported(fakeRenderer()), true);
  assert.equal(Ocean.supported(fakeRenderer({ webgl2: false })), false);
  assert.equal(Ocean.supported(fakeRenderer({ floatTargets: false })), false);
});

test('each layer has its height field and targets, and only the first keeps foam from frame to frame', () => {
  const o = new Ocean(fakeRenderer(), 64, [40, 9, 2]);
  assert.deepEqual(o.layers.map((l) => l.L), [40, 9, 2]);
  assert.deepEqual(o.layers.map((l) => l.slopes.length), [2, 1, 1]);
  for (const l of o.layers) { assert.equal(l.h0.image.data.length, 64 * 64 * 4); assert.equal(l.disp.width, 64); }
  assert.equal(o.disp, o.layers[0].disp);
  assert.equal(o.slope(0), o.layers[0].slopes[0].texture);
  assert.equal(o.slope(1), o.layers[1].slopes[0].texture);
  assert.equal(o.slope(3), null, 'a layer it does not have');
});

test('a wind gives the same sea every time', () => {
  const a = new Ocean(fakeRenderer(), 32, [40]), b = new Ocean(fakeRenderer(), 32, [40]);
  a.setWind(12); b.setWind(12);
  assert.deepEqual(a.layers[0].h0.image.data, b.layers[0].h0.image.data);
  b.setWind(13);
  assert.notDeepEqual(a.layers[0].h0.image.data, b.layers[0].h0.image.data);
});

test('setWind tells the GPU the field changed', () => {
  const o = new Ocean(fakeRenderer(), 16, [40]), v = o.layers[0].h0.version;
  o.setWind(10);
  assert.ok(o.layers[0].h0.version > v);
});

test('the height field is conjugate symmetric, so the surface it makes is real', () => {
  const N = 32, o = new Ocean(fakeRenderer(), N, [40, 9]);
  o.setWind(14);
  for (const l of o.layers) {
    const d = l.h0.image.data;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = (j * N + i) * 4, b = (((N - j) % N) * N + ((N - i) % N)) * 4;
      assert.equal(d[a + 2], d[b], `re at ${i}, ${j}`);
      assert.equal(d[a + 3], -d[b + 1], `im at ${i}, ${j}`);
    }
  }
});

test('the Nyquist rows carry nothing, having no partner', () => {
  const N = 32, o = new Ocean(fakeRenderer(), N, [40]);
  o.setWind(14);
  const d = o.layers[0].h0.image.data;
  for (let k = 0; k < N; k++) for (const [i, j] of [[N / 2, k], [k, N / 2]]) assert.equal(d[(j * N + i) * 4], 0);
});

test('every layer keeps its own band, so the sea is drawn only once', () => {
  const N = 64, Ls = [40, 9, 2], o = new Ocean(fakeRenderer(), N, Ls);
  o.setWind(14);
  const cut = [0, (2 * Math.PI / 9) * 4, (2 * Math.PI / 2) * 4, Infinity];
  o.layers.forEach((l, c) => {
    const dk = (2 * Math.PI) / l.L, d = l.h0.image.data;
    let inside = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const mi = i < N / 2 ? i : i - N, mj = j < N / 2 ? j : j - N, k = Math.hypot(mi, mj) * dk, o4 = (j * N + i) * 4;
      if (k < cut[c] || k >= cut[c + 1]) assert.equal(Math.abs(d[o4]), 0, `layer ${c} has energy at k = ${k}`);
      else if (d[o4]) inside++;
    }
    assert.ok(inside > 0, `layer ${c} has some of the sea`);
  });
});

test('the height it reports is the height in its field', () => {
  const N = 128, o = new Ocean(fakeRenderer(), N, [40]);
  o.setWind(16);
  const d = o.layers[0].h0.image.data;
  let sum = 0;
  for (let i = 0; i < N * N; i++) sum += d[i * 4] ** 2 + d[i * 4 + 1] ** 2;
  // E|h0|² is half of what the band holds; the gaussians are drawn at random, so only roughly
  const rms = Math.sqrt(sum * 2);
  assert.ok(rms > o.rms * 0.6 && rms < o.rms * 1.5, `${rms} in the field, ${o.rms} reported`);
});

test('a breeze makes a bigger sea than a calm, and the lightest air still has one', () => {
  const o = new Ocean(fakeRenderer(), 32, [40]), rms = {};
  for (const k of [0, 3, 10, 25]) { o.setWind(k); rms[k] = o.rms; assert.ok(o.rms > 0 && Number.isFinite(o.rms)); }
  assert.ok(rms[25] > rms[10] && rms[10] > rms[3]);
});

test('the crests sharpen as it blows up, within limits', () => {
  const o = new Ocean(fakeRenderer(), 16, [40]), chop = (k) => { o.setWind(k); return o.chop; };
  close(chop(5), -0.75); close(chop(7), -0.75); close(chop(19), -1.3); close(chop(40), -1.3);
  assert.ok(chop(13) < -0.75 && chop(13) > -1.3);
});

test('there are no whitecaps in a light breeze', () => {
  const o = new Ocean(fakeRenderer(), 16, [40]);
  o.setWind(9);
  assert.equal(o.white, 0); assert.equal(o.foamGen, 0); assert.equal(o.calibrate, false);
});

test('from about force 4 crests break, and the foam lingers longer the harder it blows', () => {
  const o = new Ocean(fakeRenderer(), 16, [40]);
  o.setWind(12);
  const tau = o.foamTau;
  assert.ok(o.white > 0 && o.foamGen >= 0.6); assert.equal(o.calibrate, true);
  o.setWind(30);
  assert.equal(o.white, 1); close(o.foamGen, 1); close(o.foamTau, 3);
  assert.ok(o.foamTau > tau);
});

test('the surface water drifts faster in more wind, and never stands still', () => {
  const o = new Ocean(fakeRenderer(), 16, [40]);
  o.setWind(0); close(o.drift, 0.03 * 2.5);
  o.setWind(20); close(o.drift, 0.03 * 20 * 0.514);
});

test('a new sea wipes the old foam from both of the first layer\'s targets and hands the renderer back', () => {
  const r = fakeRenderer(), o = new Ocean(r, 16, [40, 9]), rt = new THREE.WebGLRenderTarget(2, 2);
  r.setRenderTarget(rt); r.setClearColor(0x204060, 0.7); r.clears.length = 0;
  o.setWind(14);
  assert.deepEqual(r.clears.map((c) => c.target), o.layers[0].slopes);
  for (const c of r.clears) { assert.deepEqual([c.color, c.depth, c.stencil], [true, false, false]); assert.equal(c.alpha, 0); }
  assert.equal(r.getRenderTarget(), rt);
  close(r.getClearAlpha(), 0.7);
  close(r.getClearColor(new THREE.Color()).g, 0x40 / 255);
});

test('one frame of a layer is the spectrum, two FFTs, the displacement and the slopes', () => {
  const r = fakeRenderer(), o = new Ocean(r, 16, [40]);
  o.setWind(8); r.log.length = 0;
  o.update(1);
  const m = r.log.map((e) => e.material);
  assert.deepEqual(m, [o.mSpec, ...Array(4).fill(o.mH), ...Array(4).fill(o.mV), o.mDisp, o.mDeriv]);
  assert.equal(r.log[0].target, o.ping);
  assert.equal(r.log.at(-2).target, o.layers[0].disp);
  assert.equal(r.log.at(-1).target, o.layers[0].slopes[o.layers[0].cur]);
});

test('each FFT doubles its stage from 2 up to the whole field', () => {
  const r = fakeRenderer(), o = new Ocean(r, 32, [40]), stages = [], real = r.render;
  r.render = (s, c) => { const m = s.children[0].material; if (m === o.mH || m === o.mV) stages.push(m.uniforms.uS.value); real(s, c); };
  o.setWind(8); o.update(1);
  assert.deepEqual(stages, [2, 4, 8, 16, 32, 2, 4, 8, 16, 32]);
});

test('no pass ever reads the texture it is drawing to', () => {
  const r = fakeRenderer(), o = new Ocean(r, 16, [40, 9, 2]), real = r.render;
  r.render = (s, c) => {
    const m = s.children[0].material, tex = r.getRenderTarget().texture;
    for (const k of ['uIn', 'uPrev', 'uH0']) if (m.uniforms[k]) assert.notEqual(m.uniforms[k].value, tex, `${k} is the target being drawn`);
    real(s, c);
  };
  o.setWind(14);
  for (let i = 0; i < 8; i++) o.update(i * 0.016);
});

test('the fine layers take turns, so a frame is never all three nor only one', () => {
  const r = fakeRenderer(), o = new Ocean(r, 16, [40, 9, 2]), PER = 1 + 8 + 2;
  o.setWind(8); r.log.length = 0;
  const counts = [];
  for (let i = 0; i < 7; i++) { o.update(i * 0.016); counts.push(r.log.length); r.log.length = 0; }
  assert.equal(counts[0], 3 * PER, 'all of them the first frame');
  assert.deepEqual(counts.slice(1), Array(6).fill(2 * PER));
});

test('the 40 m layer is drawn every frame and each fine layer every other', () => {
  const r = fakeRenderer(), o = new Ocean(r, 16, [40, 9, 2]), drawn = [0, 0, 0], real = r.render;
  r.render = (s, c) => { if (s.children[0].material === o.mSpec) drawn[o.layers.findIndex((l) => l.h0 === o.mSpec.uniforms.uH0.value)]++; real(s, c); };
  o.setWind(8);
  o.update(0); drawn.fill(0);
  for (let i = 1; i <= 10; i++) o.update(i * 0.016);
  assert.deepEqual(drawn, [10, 5, 5]);
});

test('the foam targets are written in turn, the last frame\'s read as this one is drawn', () => {
  const r = fakeRenderer(), o = new Ocean(r, 16, [40]), l = o.layers[0];
  o.setWind(8);
  for (let i = 0; i < 4; i++) {
    const prev = l.cur;
    o.update(i);
    assert.equal(l.cur, 1 - prev);
    assert.equal(o.mDeriv.uniforms.uPrev.value, l.slopes[prev].texture);
    assert.equal(o.slope(0), l.slopes[l.cur].texture);
  }
});

test('the fine layers make no foam of their own', () => {
  const r = fakeRenderer(), o = new Ocean(r, 16, [40, 9]), foam = [], real = r.render;
  r.render = (s, c) => { if (s.children[0].material === o.mDeriv) foam.push(o.mDeriv.uniforms.uFoam.value); real(s, c); };
  o.setWind(8); o.update(0);
  assert.deepEqual(foam, [1, 0]);
});

test('the foam fades by the time passed and none is born on the first frame', () => {
  const r = fakeRenderer(), o = new Ocean(r, 16, [40]), D = o.mDeriv.uniforms;
  o.setWind(20);
  o.update(5);
  assert.equal(D.uDecay.value, 1); assert.equal(D.uGen.value, 0);
  o.update(5.05);
  close(D.uDecay.value, Math.exp(-0.05 / o.foamTau), 1e-9);
  assert.equal(D.uGen.value, o.foamGen);
  close(D.uDrift.value.y, (o.drift * 0.05) / 40, 1e-9);
  assert.equal(D.uDrift.value.x, 0);
});

test('a long stall or a clock run back does not wipe the foam out in one step', () => {
  const r = fakeRenderer(), o = new Ocean(r, 16, [40]), D = o.mDeriv.uniforms;
  o.setWind(20);
  o.update(1); o.update(30);
  close(D.uDecay.value, Math.exp(-0.1 / o.foamTau), 1e-9, 'a stall counts as a tenth of a second');
  o.update(2);
  assert.equal(D.uDecay.value, 1, 'time run back counts as none');
  assert.equal(D.uGen.value, 0);
});

test('the frame hands the renderer back as it found it, its XR switched off while it draws', () => {
  const r = fakeRenderer(), o = new Ocean(r, 16, [40]), rt = new THREE.WebGLRenderTarget(2, 2), real = r.render;
  let xr = null;
  r.render = (s, c) => { xr = r.xr.enabled; real(s, c); };
  o.setWind(8); r.setRenderTarget(rt);
  o.update(1);
  assert.equal(xr, false);
  assert.equal(r.xr.enabled, true);
  assert.equal(r.getRenderTarget(), rt);
});

test('the chop is the wind\'s, or the default until a wind has been set', () => {
  const o = new Ocean(fakeRenderer(), 16, [40]);
  o.update(0);
  assert.equal(o.mDisp.uniforms.uChop.value, -1);
  o.setWind(25); o.update(1);
  close(o.mDisp.uniforms.uChop.value, -1.3);
});

// the Jacobians the GPU would hand back: half floats, the J in the blue channel
const sea = (fn) => (rt, x, y, w, h, buf) => { for (let i = 0; i < w * h; i++) buf[i * 4 + 2] = THREE.DataUtils.toHalfFloat(fn(i, w * h)); };

test('whitecaps start at the folds of this very sea: the share of it that should be breaking', () => {
  const N = 16, r = fakeRenderer({ pixels: sea((i, n) => 0.2 + (1.4 * i) / n) }), o = new Ocean(r, N, [40]);
  o.setWind(19.5); // white = 1: 0.45 % of the sea
  o.update(0);
  const k = Math.floor(N * N * (0.0008 + 0.0037)), want = THREE.DataUtils.fromHalfFloat(THREE.DataUtils.toHalfFloat(0.2 + (1.4 * k) / (N * N))) + 0.035;
  close(o.foamJ0, want, 1e-3);
});

test('the sea\'s folds are read once, on its first frame', () => {
  const r = fakeRenderer({ pixels: sea(() => 0.5) }), o = new Ocean(r, 16, [40]);
  o.setWind(15);
  for (let i = 0; i < 5; i++) o.update(i);
  assert.equal(r.reads, 1);
  o.setWind(16); o.update(9);
  assert.equal(r.reads, 2, 'and once more for a new sea');
});

test('a calm sea never reads the GPU back', () => {
  const r = fakeRenderer(), o = new Ocean(r, 16, [40]);
  o.setWind(5); o.update(0);
  assert.equal(r.reads, 0);
});

test('a read the GPU refuses leaves the sea running without whitecaps', () => {
  const r = fakeRenderer(), o = new Ocean(r, 16, [40]);
  r.readRenderTargetPixels = () => { throw new Error('not readable'); };
  o.setWind(18);
  assert.doesNotThrow(() => o.update(0));
  assert.equal(o.calibrate, false); assert.equal(o.foamJ0, 0);
});

test('dispose lets go of every target, field and shader', () => {
  const o = new Ocean(fakeRenderer(), 16, [40, 9]);
  const things = [o.ping, o.pong, ...o.layers.flatMap((l) => [l.h0, l.disp, ...l.slopes]), o.mSpec, o.mH, o.mV, o.mDisp, o.mDeriv];
  const seen = things.map(watchDispose);
  o.dispose();
  assert.deepEqual(seen.map((s) => s.count), things.map(() => 1));
});
