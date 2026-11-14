"""The calls once spoken by the browser, and the race committee and the umpire, recorded with Piper (a local neural
text-to-speech, https://github.com/OHF-Voice/piper1-gpl) into one file per language: public/game/calls-<lang>.mp3.

  python scripts/voices.py --models <dir of Piper .onnx voices> --espeak <espeak-ng-data dir> [--out public/game]
    [--takes 5] [--wav <dir> [--redo <line> ...]]

Voices (from huggingface.co/rhasspy/piper-voices): ru_RU-ruslan-medium and ru_RU-irina-medium (the hails),
ru_RU-dmitri-medium (the committee), ru_RU-ruslan-medium again (the umpire, a little lower), en_US-ryan-high, en_GB-cori-high, en_GB-northern_english_male-medium, en_GB-alan-medium.
Needs numpy, scipy, lameenc and piper-tts (and faster-whisper for --takes). Bundled espeak-ng can't read a long path: pass --espeak as a short
relative one. Prints each file's clip table, [start, length] in seconds, for main.js.

Each line is shaped for where it's heard from: a hail is shouted across the water (brighter, squeezed, a little
driven), the committee comes over a VHF handset (300–3000 Hz, clipped, hiss, the squelch at the end), and the umpire
through a loudhailer from the RIB (a horn's honk, driven hard)."""
import argparse, json, os, sys
import numpy as np
from scipy import signal
import lameenc
from piper import PiperVoice, SynthesisConfig

SR = 22050

# key: (voice, style, [(text, pause after in seconds), ...]). A woman's line in a crew's voice starts g + capital or
# digit, as in skipper-en.mp3, so main.js can give each boat her own.
LINES = {
  'ru': {
    # the hails, by rule, said by a man (h…) and a woman (g…) on the boat
    **{f'{p}{k}': (v, 'hail', [(t, 0)]) for p, v in (('h', 'ru_RU-ruslan-medium'), ('g', 'ru_RU-irina-medium')) for k, t in {
      '10': 'Правый галс!', '11': 'Наветренная, уходи!', '12': 'Сзади, уходи!', '13': 'Ты в повороте! Уходи!',
      '15': 'Дай место уступить!', '16': 'Не поворачивай на меня!', '17': 'Надлежащий курс!', '18': 'Место у знака!',
      '18_3': 'Ты повернул в зоне! Уходи!', '18_4': 'Фордевинд! Не шире, чем нужно!', '19': 'Место у судейского судна!',
      '20': 'Место для поворота!', '44': 'Штрафник, уходи!',
    }.items()},
    # the call for a tack and a gybe
    **{f'{p}{k}': (v, 'hail', segs) for p, v in (('h', 'ru_RU-ruslan-medium'), ('g', 'ru_RU-irina-medium')) for k, segs in {
      'Tack': [('К повороту оверштаг!', 0.45), ('Поворот!', 0)],
      'Gybe': [('К повороту фордевинд!', 0.45), ('Поворот!', 0)],
    }.items()},
    # the race committee on the VHF
    'cWarn5': ('ru_RU-dmitri-medium', 'radio', [('Всем лодкам, на связи судейское судно.', 0.3), ('Предупредительный сигнал. Пять минут.', 0)]),
    'cWarn3': ('ru_RU-dmitri-medium', 'radio', [('Всем лодкам, на связи судейское судно.', 0.3), ('Предупредительный сигнал. Три минуты.', 0)]),
    'cPrepP': ('ru_RU-dmitri-medium', 'radio', [('Подготовительный сигнал. Поднят флаг Папа.', 0)]),
    'cPrepU': ('ru_RU-dmitri-medium', 'radio', [('Подготовительный сигнал. Поднят флаг Юниформ.', 0)]),
    'cPrepB': ('ru_RU-dmitri-medium', 'radio', [('Подготовительный сигнал. Поднят чёрный флаг.', 0)]),
    'cFlagU': ('ru_RU-dmitri-medium', 'radio', [('Внимание, старт под флагом Юниформ.', 0)]),
    'cFlagB': ('ru_RU-dmitri-medium', 'radio', [('Внимание, старт под чёрным флагом.', 0)]),
    'c1': ('ru_RU-dmitri-medium', 'radio', [('Одна минута до старта.', 0)]),
    'cClear': ('ru_RU-dmitri-medium', 'radio', [('Старт чистый.', 0.25), ('Удачной гонки!', 0)]),
    'cRecall': ('ru_RU-dmitri-medium', 'radio', [('Индивидуальный отзыв. Флаг Икс-рей.', 0.25), ('Лодкам за линией вернуться.', 0)]),
    'cGenRecall': ('ru_RU-dmitri-medium', 'radio', [('Общий отзыв!', 0.3), ('Общий отзыв.', 0.3), ('Старт будет повторён.', 0)]),
    'cBack': ('ru_RU-dmitri-medium', 'radio', [('Вы вернулись. Можно стартовать.', 0)]),
    'cOut': ('ru_RU-dmitri-medium', 'radio', [('За линией в последнюю минуту.', 0.25), ('Вы дисквалифицированы.', 0)]),
    'cBreeze': ('ru_RU-dmitri-medium', 'radio', [('Прогноз на сегодня: бриз.', 0.25), ('Будет усиливаться и отходить вправо.', 0)]),
    'cFin1': ('ru_RU-dmitri-medium', 'radio', [('Финиш! Первое место.', 0.2), ('Поздравляем!', 0)]),
    'cFin': ('ru_RU-dmitri-medium', 'radio', [('Финиш. Хорошая гонка!', 0)]),
    'cFinDsq': ('ru_RU-dmitri-medium', 'radio', [('Финиш. Штраф не выполнен.', 0.2), ('Дисквалификация.', 0)]),
    'cFinOut': ('ru_RU-dmitri-medium', 'radio', [('Финиш. Дисквалификация на старте.', 0)]),
    # the umpire, from the RIB
    'uPen': ('ru_RU-ruslan-medium', 'hailer', [('Штраф!', 0.3), ('Оборот: оверштаг и фордевинд.', 0)]),
    'uMark': ('ru_RU-ruslan-medium', 'hailer', [('Касание знака!', 0.25), ('Штрафной оборот.', 0)]),
    'uNone': ('ru_RU-ruslan-medium', 'hailer', [('Штрафа нет!', 0)]),
    'uThem': ('ru_RU-ruslan-medium', 'hailer', [('Штраф другой лодке!', 0)]),
  },
  'en': {
    # the one hail with no recording in skipper-en.mp3
    'hGybeWide': ('en_US-ryan-high', 'hail', [('Gybe, no wider than you need!', 0)]),  # a lone 'Gybe!' comes out garbled
    'gGybeWide': ('en_GB-cori-high', 'hail', [('Gybe, no wider than you need!', 0)]),
    # the race committee on the VHF
    'cWarn5': ('en_GB-northern_english_male-medium', 'radio', [('Race committee, all boats.', 0.3), ('Warning signal. Five minutes.', 0)]),
    'cWarn3': ('en_GB-northern_english_male-medium', 'radio', [('Race committee, all boats.', 0.3), ('Warning signal. Three minutes.', 0)]),
    'cPrepP': ('en_GB-northern_english_male-medium', 'radio', [('Preparatory signal. P flag is up.', 0)]),  # 'Papa' comes out mumbled
    'cPrepU': ('en_GB-northern_english_male-medium', 'radio', [('Preparatory signal. Uniform flag is up.', 0)]),
    'cPrepB': ('en_GB-northern_english_male-medium', 'radio', [('Preparatory signal. Black flag is up.', 0)]),
    'cFlagU': ('en_GB-northern_english_male-medium', 'radio', [('Be advised, this start is under the Uniform flag.', 0)]),
    'cFlagB': ('en_GB-northern_english_male-medium', 'radio', [('Be advised, this start is under the black flag.', 0)]),
    'c1': ('en_GB-northern_english_male-medium', 'radio', [('One minute to the start.', 0)]),
    'cClear': ('en_GB-northern_english_male-medium', 'radio', [('All clear.', 0.25), ('Good start, everyone.', 0)]),
    'cRecall': ('en_GB-northern_english_male-medium', 'radio', [('Individual recall. X-ray flag.', 0.25), ('Boats over, return to the line.', 0)]),
    'cGenRecall': ('en_GB-northern_english_male-medium', 'radio', [('General recall!', 0.3), ('General recall.', 0.3), ('The start will be repeated.', 0)]),
    'cBack': ('en_GB-northern_english_male-medium', 'radio', [("You're back. Clear to start.", 0)]),
    'cOut': ('en_GB-northern_english_male-medium', 'radio', [('Over in the last minute.', 0.25), ('You are disqualified.', 0)]),
    'cBreeze': ('en_GB-northern_english_male-medium', 'radio', [("Today's forecast: a sea breeze,", 0.15), ('building and veering right through the race.', 0)]),
    'cFin1': ('en_GB-northern_english_male-medium', 'radio', [('Finish! First place.', 0.2), ('Well sailed!', 0)]),
    'cFin': ('en_GB-northern_english_male-medium', 'radio', [('Finished. Well sailed.', 0)]),
    'cFinDsq': ('en_GB-northern_english_male-medium', 'radio', [('Finished. No penalty taken.', 0.2), ('Disqualified.', 0)]),
    'cFinOut': ('en_GB-northern_english_male-medium', 'radio', [('Finished. Disqualified at the start.', 0)]),
    # the umpire, from the RIB
    'uPen': ('en_GB-alan-medium', 'hailer', [('Penalty!', 0.3), ('Take your turn: tack and gybe.', 0)]),
    'uMark': ('en_GB-alan-medium', 'hailer', [('Mark touch!', 0.25), ('Penalty turn.', 0)]),
    'uNone': ('en_GB-alan-medium', 'hailer', [('No penalty!', 0)]),
    'uThem': ('en_GB-alan-medium', 'hailer', [('Penalty on the other boat!', 0)]),
  },
}

# how each kind of line is spoken: slower or quicker, flatter or livelier
SPEAK = {
  'hail': SynthesisConfig(length_scale=0.95, noise_scale=0.55, noise_w_scale=0.5),  # livelier than this and words slur
  'radio': SynthesisConfig(length_scale=1.0, noise_scale=0.55, noise_w_scale=0.5),
  'hailer': SynthesisConfig(length_scale=0.93, noise_scale=0.55, noise_w_scale=0.5),
}

LEVEL = -4  # dB: squeezed as they are, the lines sit with skipper-<lang>.mp3 this much down
rng = np.random.default_rng(7)
db = lambda d: 10 ** (d / 20)


def trim(x, floor=-42):
  """the voice without the silence round it"""
  w = 256; n = len(x) // w
  rms = np.sqrt(np.mean(x[: n * w].reshape(n, w) ** 2, axis=1) + 1e-12)
  on = np.nonzero(20 * np.log10(rms / rms.max()) > floor)[0]
  return x[max(0, on[0] - 1) * w: min(len(x), (on[-1] + 2) * w)] if len(on) else x


def compress(x, thr_db, ratio, att=0.004, rel=0.08):
  """a feed-forward compressor on the peak envelope"""
  a, r = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
  env = np.empty_like(x); e = 0.0
  for i, v in enumerate(np.abs(x)):
    e = a * e + (1 - a) * v if v > e else r * e + (1 - r) * v
    env[i] = e
  thr = db(thr_db)
  g = np.where(env > thr, (np.maximum(env, 1e-9) / thr) ** (1 / ratio - 1), 1.0)
  return x * g


def drive(x, k):
  return np.tanh(k * x) / np.tanh(k)


def norm(x, peak_db=-1.0):
  return x / (np.abs(x).max() + 1e-9) * db(peak_db)


def band(x, lo, hi, order=4):
  return signal.sosfilt(signal.butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)


def noise(n, lo, hi):
  return band(rng.standard_normal(n), lo, hi)


def shout(x):
  """across the water: brighter, squeezed, a little driven"""
  x = norm(x)
  x = x + 0.9 * signal.sosfilt(signal.butter(2, 1800, 'highpass', fs=SR, output='sos'), x)  # the edge of a shout
  x = signal.sosfilt(signal.butter(2, 120, 'highpass', fs=SR, output='sos'), x)
  x = compress(norm(x), -18, 4)
  return norm(drive(norm(x), 1.6), -1.0)


def radio(x):
  """a VHF handset: a click as he keys up, hiss under him, band-limited and clipped, and the squelch as he lets go"""
  x = band(norm(x), 320, 2900)
  x = compress(norm(x), -24, 6, rel=0.05)
  x = drive(norm(x), 3.2)
  lead, tail = int(0.11 * SR), int(0.2 * SR)
  y = np.concatenate([np.zeros(lead), norm(x, -2.5), np.zeros(tail // 3)])
  y = y + noise(len(y), 400, 3800) * db(-38) * np.abs(y).max() / (np.abs(noise(1000, 400, 3800)).max() + 1e-9)
  y[:int(0.006 * SR)] += rng.standard_normal(int(0.006 * SR)) * db(-10) * np.linspace(1, 0, int(0.006 * SR))  # the key
  sq = noise(tail, 600, 5000); sq = sq / np.abs(sq).max() * db(-12) * np.exp(-np.linspace(0, 6, tail))
  return norm(np.concatenate([y, sq]), -1.5)


def hailer(x):
  """a loudhailer: the horn's honk round 1.6 kHz, no lows or highs, driven hard; and the voice a little lower, an
  older man's, so the umpire isn't the crew who hails in the same voice"""
  x = signal.resample_poly(x, 27, 25)  # 8% longer: as low as that
  x = band(norm(x), 450, 4200)
  b, a = signal.iirpeak(1600, 1.4, fs=SR); x = x + 1.2 * signal.lfilter(b, a, x)
  x = compress(norm(x), -20, 5)
  return norm(drive(norm(x), 4.0), -1.5)


SHAPE = {'hail': shout, 'radio': radio, 'hailer': hailer}


def take(v, style, segs):
  """one reading of a line, shaped"""
  parts = []
  for text, pause in segs:
    a = np.concatenate([c.audio_float_array for c in v.synthesize(text, syn_config=SPEAK[style])])
    if v.config.sample_rate != SR: a = signal.resample_poly(a, SR, v.config.sample_rate)
    parts += [norm(trim(a)), np.zeros(int(pause * SR))]
  return SHAPE[style](np.concatenate(parts))


def plain(t):
  return ''.join(c for c in t.lower().replace('ё', 'е') if c.isalnum() or c == ' ').split()


def main():
  ap = argparse.ArgumentParser()
  ap.add_argument('--models', required=True); ap.add_argument('--espeak', required=True)
  ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'public', 'game'))
  ap.add_argument('--lang', nargs='*', default=list(LINES)); ap.add_argument('--wav', help='also write each clip here, as wav')
  # Piper reads a line a little differently each time: with faster-whisper, read it up to N times and keep the reading
  # heard back closest to the text
  ap.add_argument('--takes', type=int, default=1); ap.add_argument('--whisper', default='medium')
  # with --wav from an earlier run: keep those clips, and read again only the lines named here
  ap.add_argument('--redo', nargs='*')
  o = ap.parse_args()
  if o.takes > 1:
    from difflib import SequenceMatcher
    from faster_whisper import WhisperModel
    ear = WhisperModel(o.whisper, device='cpu', compute_type='int8')
    def heard(clip, lang):
      a = signal.resample_poly(clip, 320, 441).astype(np.float32)  # 22050 → 16000
      return ' '.join(s.text.strip() for s in ear.transcribe(a, language=lang, beam_size=5)[0])
  voices = {}
  for lang in o.lang:
    gap = np.zeros(int(0.5 * SR)); out = [gap]; at = len(gap); clips = {}
    for k, (vname, style, segs) in LINES[lang].items():
      kept = o.wav and os.path.join(o.wav, f'{lang}-{k}.wav')
      if o.redo is not None and k not in o.redo and os.path.exists(kept):
        import wave
        with wave.open(kept) as w: clip = np.frombuffer(w.readframes(w.getnframes()), '<i2') / 32767
        clips[k] = [round(at / SR, 3), round(len(clip) / SR, 3)]; out += [clip, gap]; at += len(clip) + len(gap)
        continue
      v = voices.get(vname) or voices.setdefault(vname, PiperVoice.load(os.path.join(o.models, vname + '.onnx'), espeak_data_dir=o.espeak))
      clip = take(v, style, segs)
      if o.takes > 1:
        want = plain(' '.join(t for t, _ in segs)); best = (-1, clip, '')
        for i in range(o.takes):
          if i: clip = take(v, style, segs)
          h = heard(clip, lang); r = SequenceMatcher(None, want, plain(h)).ratio()
          if r > best[0]: best = (r, clip, h)
          if r >= 0.99: break
        clip = best[1]; print(f'{lang} {k:11s} {best[0]:.2f} {best[2]}', file=sys.stderr)
      if o.wav:
        import wave
        os.makedirs(o.wav, exist_ok=True)
        with wave.open(os.path.join(o.wav, f'{lang}-{k}.wav'), 'wb') as w:
          w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((clip * 32767).astype('<i2').tobytes())
      clips[k] = [round(at / SR, 3), round(len(clip) / SR, 3)]
      out += [clip, gap]; at += len(clip) + len(gap)
    pcm = (np.clip(np.concatenate(out) * db(LEVEL), -1, 1) * 32767).astype('<i2')
    enc = lameenc.Encoder(); enc.set_bit_rate(48); enc.set_in_sample_rate(SR); enc.set_channels(1); enc.set_quality(2)
    path = os.path.join(o.out, f'calls-{lang}.mp3')
    with open(path, 'wb') as f: f.write(enc.encode(pcm.tobytes()) + enc.flush())
    print(f'{path}: {len(pcm) / SR:.1f} s, {os.path.getsize(path) // 1024} KB', file=sys.stderr)
    print(lang, json.dumps(clips))


if __name__ == '__main__':
  main()
