"""Regatta: the soundtracks (Settings > Music), each cut from one recorded track into public/game/music-<id>.mp3.

A track's beats are tracked (dynamic programming over the onsets, after Ellis 2007, against the local tempo, so a track
that speeds up keeps its grid), the bars found where the chords change, and every piece cut on bar lines: loops for the
moods, the build that lands the drop on the gun, the ending for a win, and the accents (a crash, the same crash
reversed, the drop's downbeat). Each piece keeps a little of the audio either side of it, for the crossfades music.js
plays it with, and the file starts with a short blip that music.js finds, so it knows where the decoder put time zero.
It prints the track's pieces for TRACKS in music.js: each piece's start (s) and its bars' lengths.

The loops were picked where the track wraps well: the bar after a loop's end sounds like the loop's first bar, so
playing it again from the top doesn't jump.

  python scripts/music.py <id> <track.mp3>      (needs numpy and soundfile, libsndfile 1.1 or later for mp3)
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf

ROLL = 0.3  # s of audio kept either side of a piece
# per track: the tempo it's tracked in (bpm), its loops by bar number [from, to), the bar its drop lands on (the race
# loop starts there; the build is the eight bars before it and the drop's first four, and the race loop goes on from
# its fifth; the accents are made of it), and the bar the ending starts at (it runs to the end)
TRACKS = {
    'racing': {  # E minor, speeding up from 131 to 137 bpm
        'bpm': (125, 145),
        'loops': {
            'calm': (8, 24),    # the verse, light drums: the pre-start
            'drive': (34, 50),  # the full groove
            'dark': (66, 74),   # the breakdown
            'race': (82, 98),   # the drop and the chorus
            'peak': (130, 138), # the loudest of it
        },
        'drop': 82, 'finale': 142,
    },
    'groove': {  # D major, 117 slowing to 115 bpm
        'bpm': (105, 130),
        'loops': {
            'calm': (1, 9),       # the opening, before it fills out
            'drive': (39, 55),    # the groove
            'dark': (113, 121),   # the stripped-down part, muffled: it has no breakdown of its own
            'race': (95, 111),    # the drop after the short break
            'peak': (101, 109),   # the loudest of it
        },
        'dark_lp': 900, 'drop': 95, 'finale': 120,
    },
    'riff': {  # D major, 120 bpm
        'bpm': (108, 132),
        'loops': {
            'calm': (4, 16),    # the intro, before the bass comes in
            'drive': (28, 44),  # the riff
            'dark': (82, 86),   # the breakdown
            'race': (92, 108),  # back in after it
            'peak': (100, 108), # the loudest of it
        },
        'drop': 92, 'finale': 120,
    },
    'openwater': {  # E minor, 130 speeding up to 134 bpm
        'bpm': (122, 146),
        'loops': {
            'calm': (107, 115),  # the lighter verse after the breakdown
            'drive': (30, 46),   # the groove
            'dark': (65, 73),    # the low, thin part
            'race': (82, 98),    # the drop
            'peak': (134, 142),  # the loudest of it
        },
        'drop': 82, 'finale': 142,
    },
}


def onsets(m, sr, hop):
    n = 1024
    w = np.hanning(n)
    spec = np.log1p(np.abs(np.array([np.fft.rfft(m[i:i + n] * w) for i in range(0, len(m) - n, hop)])) * 10)
    flux = np.r_[0, np.maximum(np.diff(spec, axis=0), 0).sum(1)]
    fr = sr / hop
    o = np.maximum(flux - np.convolve(flux, np.ones(int(fr)) / int(fr), 'same'), 0)
    o = np.convolve(o, np.hanning(7) / np.hanning(7).sum(), 'same')
    return o / o.std(), fr


def beats(o, fr, bpm):
    n = len(o)
    mt, mb = [], []
    for w0 in np.arange(0, n / fr - 16, 2.0):  # the local tempo, from 16 s windows
        seg = o[int(w0 * fr):int((w0 + 16) * fr)]
        seg = seg - seg.mean()
        ac = np.correlate(seg, seg, 'full')[len(seg) - 1:]
        lo, hi = int(4 * 60 / bpm[1] * fr), int(4 * 60 / bpm[0] * fr)
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


def lowpass(x, sr, f):
    X = np.fft.rfft(x, axis=0)
    fq = np.fft.rfftfreq(len(x), 1 / sr)
    X *= (1 / (1 + (fq / f) ** 4))[:, None]
    return np.fft.irfft(X, len(x), axis=0)


def main():
    tid, src = sys.argv[1], sys.argv[2]
    T = TRACKS[tid]
    x, sr = sf.read(src, always_2d=True)
    m = x.mean(1)
    o, fr = onsets(m, sr, 128)
    b = beats(o, fr, T['bpm'])
    bars = b[downbeat(m, sr, b)::4]
    end = len(x) / sr
    drop = T['drop']
    assert T['loops']['race'][0] == drop, 'the race loop starts on the drop'
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

    for name, (a, z) in {**T['loops'], 'build': (drop - 8, drop + 4)}.items():
        y = cut(bars[a] - ROLL, bars[z] + ROLL)
        if name == 'dark' and T.get('dark_lp'):
            y = lowpass(y, sr, T['dark_lp'])
        put(name, y, ROLL, np.diff(bars[a:z + 1]))
    fin = T['finale']
    put('finale', fade(cut(bars[fin] - ROLL, end), 0.01, 0.05), ROLL, np.diff(bars[fin:]))
    crash = highpass(cut(bars[drop] - 0.02, bars[drop] + 2.4), sr, 4500)  # the drop's crash, the rest filtered out
    crash = fade(crash, 0.005, 1.6)
    put('crash', crash, 0.02)
    put('swell', fade(crash[::-1].copy(), 0.4, 0.01), 0)  # reversed: it rises to its end
    put('hit', fade(cut(bars[drop] - 0.01, bars[drop] + 0.9), 0.003, 0.6), 0.01)

    y = np.concatenate(out)
    y *= 0.95 / max(1e-9, np.abs(y).max())
    path = os.path.join(os.path.dirname(__file__), '..', 'public', 'game', f'music-{tid}.mp3')
    # 96 kbps joint stereo (LAME picks 32 kHz for it): some 2 MB a track, which every new player downloads; libsndfile's
    # own MP3 when lame isn't installed (about half as big again)
    if shutil.which('lame'):
        with tempfile.NamedTemporaryFile(suffix='.wav') as tmp:
            sf.write(tmp.name, y, sr, subtype='PCM_16')
            subprocess.run(['lame', '--quiet', '--abr', '96', '-m', 'j', tmp.name, path], check=True)
    else:
        sf.write(path, y, sr, format='MP3')
    print('bpm', round(60 / np.diff(b[:16]).mean(), 1), '..', round(60 / np.diff(b[-16:]).mean(), 1), file=sys.stderr)
    print(json.dumps(meta))


if __name__ == '__main__':
    main()
