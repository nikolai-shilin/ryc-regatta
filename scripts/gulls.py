"""Regatta: the gulls' calls, cut from real recordings into one file, public/game/gulls.mp3.

The recordings (Wikimedia Commons), downloaded into one folder, given as the argument:
  Gull_1.mp3, Gull_2.mp3  "Gull 1.ogg" and "Gull 2.ogg" by avphillips, public domain (Commons' mp3 of each:
                          upload.wikimedia.org/wikipedia/commons/transcoded/4/43/Gull_1.ogg/Gull_1.ogg.mp3, .../c/c6/Gull_2.ogg/...)
  XC707075_-_European_Herring_Gull_-_Larus_argentatus.mp3  Sonotheque ADVL (xeno-canto XC707075), CC0
Each is cleaned (a spectral gate under the calls, nothing below 550 Hz: wind, water, traffic), cut into calls, faded
and levelled, and laid one after another with silence between. It prints where each call starts and how long it is,
for GULLS in main.js. Needs numpy and soundfile (libsndfile 1.1 or later, for mp3).

  python scripts/gulls.py <folder>
"""
import json
import os
import sys

import numpy as np
import soundfile as sf

SR = 44100
N, H = 1024, 256

# kind, recording, from, to (s). mew: one long plaintive note; kyow: one call; pair: two; long: the long call, the
# seaside laugh; alarm: a flurry of calls, put up off the water
CALLS = [
    ('mew', 'g1', 6.30, 7.32), ('mew', 'g1', 7.86, 8.98), ('mew', 'g1', 10.68, 11.68), ('mew', 'g1', 12.36, 13.40),
    ('kyow', 'xc', 1.74, 2.14), ('kyow', 'xc', 3.07, 3.48), ('kyow', 'xc', 3.73, 4.10), ('kyow', 'xc', 5.34, 5.95),
    ('pair', 'g1', 0.10, 0.80), ('pair', 'g1', 1.52, 2.24), ('pair', 'xc', 6.16, 6.85),
    ('long', 'g2', 0.30, 3.85), ('long', 'g1', 0.10, 3.20),
    ('alarm', 'xc', 7.0, 8.9), ('alarm', 'xc', 9.0, 10.55),
]
FILES = {'g1': 'Gull_1.mp3', 'g2': 'Gull_2.mp3', 'xc': 'XC707075_-_European_Herring_Gull_-_Larus_argentatus.mp3'}


def load(f):
    x, sr = sf.read(f, always_2d=True)
    assert sr == SR, f
    return x.mean(1)


def clean(x):
    w = np.hanning(N)
    X = np.array([np.fft.rfft(x[i:i + N] * w) for i in range(0, len(x) - N, H)])
    M = np.abs(X)
    e = M.sum(1)
    noise = np.median(M[e <= np.percentile(e, 20)], 0) * 2.2  # the quietest fifth of the recording is the noise
    g = np.clip(1 - (noise / (M + 1e-9)) ** 2, 0.03, 1)
    g = np.apply_along_axis(lambda c: np.convolve(c, np.ones(5) / 5, 'same'), 0, g)  # no warble
    g[:, np.fft.rfftfreq(N, 1 / SR) < 550] *= 0.05
    y, ws = np.zeros(len(x)), np.zeros(len(x))
    for k, F in enumerate(X * g):
        i = k * H
        y[i:i + N] += np.fft.irfft(F, N) * w
        ws[i:i + N] += w * w
    return y / np.maximum(ws, 1e-6)


def main():
    src = {k: clean(load(os.path.join(sys.argv[1], f))) for k, f in FILES.items()}
    gap = np.zeros(int(0.25 * SR))
    out, pos, meta = [gap], len(gap), {}
    for kind, s, a, b in CALLS:
        y = src[s][int(a * SR):int(b * SR)].copy()
        fi, fo = int(0.012 * SR), int(0.08 * SR)
        y[:fi] *= np.linspace(0, 1, fi)
        y[-fo:] *= np.linspace(1, 0, fo) ** 2
        y *= 0.7 / np.abs(y).max()
        meta.setdefault(kind, []).append([round(pos / SR, 3), round(len(y) / SR, 3)])
        out += [y, gap]
        pos += len(y) + len(gap)
    path = os.path.join(os.path.dirname(__file__), '..', 'public', 'game', 'gulls.mp3')
    sf.write(path, np.concatenate(out), SR, format='MP3')
    print(json.dumps(meta))


if __name__ == '__main__':
    main()
