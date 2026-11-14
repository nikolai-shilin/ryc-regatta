"""Regatta: the Racing soundtrack (Settings > Music), cut from one recorded track into public/game/music-racing.mp3.

The track speeds up as it goes (about 131 to 137.5 bpm), so its beats are tracked (dynamic programming over the
onsets, after Ellis 2007, against the local tempo), the bars found where the chords change, and every piece cut on bar
lines: loops for the moods, the build that lands the drop on the gun, the ending for a win, and the accents (a crash,
the same crash reversed, the drop's downbeat). Each piece keeps a little of the audio either side of it, for the
crossfades music.js plays it with, and the file starts with a short blip that music.js finds, so it knows where the
decoder put time zero. It prints RACING for music.js: each piece's start (s) and its bars' lengths.

  python scripts/racing-music.py <track.mp3>      (needs numpy and soundfile, libsndfile 1.1 or later for mp3)
"""
import json
import os
import sys

import numpy as np
import soundfile as sf

ROLL = 0.3  # s of audio kept either side of a piece
# bar numbers in the track: [from, to)
LOOPS = {
    'calm': (8, 24),    # the verse, light drums: the pre-start
    'drive': (34, 50),  # the full groove
    'dark': (66, 74),   # the breakdown
    'race': (82, 98),   # the drop and the chorus
    'peak': (130, 138), # the loudest of it
}
BUILD = (74, 86)  # the build into the drop, then the drop's first four bars: the race loop goes on from its fifth
FINALE = 142      # to the end


def onsets(m, sr, hop):
    n = 1024
    w = np.hanning(n)
    spec = np.log1p(np.abs(np.array([np.fft.rfft(m[i:i + n] * w) for i in range(0, len(m) - n, hop)])) * 10)
    flux = np.r_[0, np.maximum(np.diff(spec, axis=0), 0).sum(1)]
    fr = sr / hop
    o = np.maximum(flux - np.convolve(flux, np.ones(int(fr)) / int(fr), 'same'), 0)
    o = np.convolve(o, np.hanning(7) / np.hanning(7).sum(), 'same')
    return o / o.std(), fr


def beats(o, fr):
    n = len(o)
    mt, mb = [], []
    for w0 in np.arange(0, n / fr - 16, 2.0):  # the local tempo, from 16 s windows
        seg = o[int(w0 * fr):int((w0 + 16) * fr)]
        seg = seg - seg.mean()
        ac = np.correlate(seg, seg, 'full')[len(seg) - 1:]
        lo, hi = int(4 * 60 / 145 * fr), int(4 * 60 / 125 * fr)
        L = lo + np.argmax(ac[lo:hi])
        y0, y1, y2 = ac[L - 1], ac[L], ac[L + 1]
        mt.append(w0 + 8)
        mb.append(60 * 4 / ((L + 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2)) / fr))
    mb = np.array([np.median(mb[max(0, i - 3):i + 4]) for i in range(len(mb))])
    tau = 60 / np.interp(np.arange(n) / fr, mt, mb) * fr
    score, back = o.copy(), np.full(n, -1)
    for i in range(n):
        lo, hi = max(int(i - 2 * tau[i]), 0), int(i - tau[i] / 2)
        if hi <= lo:
            continue
        p = np.arange(lo, hi)
        c = score[lo:hi] - 400 * np.log((i - p) / tau[i]) ** 2
        k = np.argmax(c)
        score[i], back[i] = o[i] + c[k], lo + k
    tail = int(tau[-1] * 2)
    i = int(np.argmax(score[-tail:])) + n - tail
    out = []
    while i >= 0:
        out.append(i)
        i = back[i]
    return np.array(out[::-1]) / fr


def downbeat(m, sr, b):
    # the chords change on the bar line: the beat (of four) where the pitch classes change most
    n = 8192
    fq = np.fft.rfftfreq(n, 1 / sr)
    ok = (fq > 80) & (fq < 2000)
    pc = (np.round(12 * np.log2(fq[ok] / 440)) % 12).astype(int)

    def chroma(a, z):
        seg = np.pad(m[int(a * sr):int(z * sr)], (0, n))
        c = np.zeros(12)
        np.add.at(c, pc, (np.abs(np.fft.rfft(seg[:n] * np.hanning(n)))[ok]) ** 2)
        return c / (np.linalg.norm(c) + 1e-9)

    cs = np.array([chroma(b[i], b[i + 1]) for i in range(len(b) - 1)])
    nov = np.r_[0, 1 - (cs[1:] * cs[:-1]).sum(1)]
    return int(np.argmax([nov[j::4].mean() for j in range(4)]))


def highpass(x, sr, f):
    X = np.fft.rfft(x, axis=0)
    fq = np.fft.rfftfreq(len(x), 1 / sr)
    X *= np.clip((fq / f) ** 4, 0, 1)[:, None]
    return np.fft.irfft(X, len(x), axis=0)


def main():
    x, sr = sf.read(sys.argv[1], always_2d=True)
    m = x.mean(1)
    o, fr = onsets(m, sr, 128)
    b = beats(o, fr)
    bars = b[downbeat(m, sr, b)::4]
    end = len(x) / sr
    cut = lambda a, z: x[int(a * sr):int(z * sr)]  # noqa: E731
    fade = lambda y, fi, fo: y * np.r_[np.linspace(0, 1, int(fi * sr)), np.ones(len(y) - int(fi * sr) - int(fo * sr)), np.linspace(1, 0, int(fo * sr))][:, None]  # noqa: E731

    blip = np.zeros((int(0.6 * sr), 2))  # the marker: 5 ms of 1 kHz at 0.2 s
    t = np.arange(int(0.005 * sr)) / sr
    blip[int(0.2 * sr):int(0.2 * sr) + len(t)] = 0.5 * np.sin(2 * np.pi * 1000 * t)[:, None]
    out, pos, meta = [blip], len(blip) / sr, {'blip': 0.2}

    def put(name, y, at, lens=None):
        nonlocal pos
        meta[name] = [round(pos + at, 4)] + ([[round(v, 4) for v in lens]] if lens is not None else [round(len(y) / sr - at, 4)])
        out.append(y)
        out.append(np.zeros((int(0.4 * sr), 2)))
        pos += len(y) / sr + 0.4

    for name, (a, z) in {**LOOPS, 'build': BUILD}.items():
        put(name, cut(bars[a] - ROLL, bars[z] + ROLL), ROLL, np.diff(bars[a:z + 1]))
    put('finale', fade(cut(bars[FINALE] - ROLL, end), 0.01, 0.05), ROLL, np.diff(bars[FINALE:]))
    crash = highpass(cut(bars[82] - 0.02, bars[82] + 2.4), sr, 4500)  # the drop's crash, the rest filtered out
    crash = fade(crash, 0.005, 1.6)
    put('crash', crash, 0.02)
    put('swell', fade(crash[::-1].copy(), 0.4, 0.01), 0)  # reversed: it rises to its end
    put('hit', fade(cut(bars[82] - 0.01, bars[82] + 0.9), 0.003, 0.6), 0.01)

    y = np.concatenate(out)
    y *= 0.95 / max(1e-9, np.abs(y).max())
    path = os.path.join(os.path.dirname(__file__), '..', 'public', 'game', 'music-racing.mp3')
    sf.write(path, y, sr, format='MP3')
    print('bpm', round(60 / np.diff(b[:16]).mean(), 1), '..', round(60 / np.diff(b[-16:]).mean(), 1), file=sys.stderr)
    print(json.dumps(meta))


if __name__ == '__main__':
    main()
