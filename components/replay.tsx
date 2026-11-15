'use client';
import { useEffect, useRef, useState } from 'react';
import { tx, type Lang } from '@/lib/lang';
import { posesAt, replaySpan, type FinishResult } from '@/lib/finish';
import { toScene } from './game-scene';
import { IconPlay } from './ui';
import { track } from '@/lib/track';

// The race played back in the scene behind the result page (public/boat-view, { type: 'replay' }): every boat where
// her track had her, the drone behind you. A button, then a bar: play or pause, a slider to drag through the race, the
// clock and the leg you were on, and how fast it plays. Closed, the finish is put back as it was.
const SPEEDS = [4, 8, 16];
const clockOf = (s: number) => { const a = Math.abs(s), m = Math.floor(a / 60), r = a - m * 60; return `${s < 0 ? '−' : ''}${m}:${r.toFixed(1).padStart(4, '0')}`; };

export function Replay({ res, myLegs = [], lang }: { res: FinishResult; myLegs?: number[]; lang: Lang }) {
  const t = tx(lang);
  const span = replaySpan(res);
  const [on, setOn] = useState(false), [playing, setPlaying] = useState(false), [T, setT] = useState(span.from), [sp, setSp] = useState(1);
  const tRef = useRef(T); tRef.current = T;
  const send = (x: number) => toScene({ type: 'replay', boats: posesAt(res, x) });
  // playing: the clock runs at the speed chosen, the scene told each frame, held at the end
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const x = Math.min(span.to, tRef.current + dt * SPEEDS[sp]);
      setT(x); send(x);
      if (x >= span.to) { setPlaying(false); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, sp]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (on) toScene({ type: 'replay', off: true }); }, [on]);

  const legs = res.course.legs.length - 1;
  // legT: the clock as you crossed the start line, then as you rounded each mark
  const leg = T < 0 ? 0 : Math.min(legs, myLegs.filter((x) => x <= T).length);
  const where = T < 0 ? t('Before the gun', 'До старта') : leg ? t(`Leg ${leg} of ${legs}`, `Отрезок ${leg} из ${legs}`) : t('The start', 'Старт');

  if (!on) {
    return (
      <button type="button" className="bt-show rs-ghost rs-replay-go" title={t('Watch the race again', 'Посмотреть гонку заново')} aria-label={t('Watch the race again', 'Посмотреть гонку заново')} onClick={() => { setOn(true); setT(span.from); send(span.from); setPlaying(true); track('Replay'); }}>
        <IconPlay s={16} /><span>{t('Replay', 'Повтор')}</span>
      </button>
    );
  }
  const close = () => { setPlaying(false); setOn(false); toScene({ type: 'replay', off: true }); };
  const atEnd = T >= span.to;
  return (
    <div className="rs-replay" role="group" aria-label={t('Replay', 'Повтор')}>
      <button type="button" className="rs-rp-b" onClick={() => { if (atEnd) { setT(span.from); send(span.from); } setPlaying((p) => !p); }} aria-label={playing ? t('Pause', 'Пауза') : t('Play', 'Играть')}>
        {playing ? <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor" /></svg> : <IconPlay s={16} />}
      </button>
      <input className="rs-rp-r" type="range" min={span.from} max={span.to} step={0.1} value={T} aria-label={t('Race time', 'Время гонки')} aria-valuetext={clockOf(T)}
        style={{ ['--p' as string]: `${((T - span.from) / (span.to - span.from || 1)) * 100}%` }}
        onChange={(e) => { const x = +e.target.value; setPlaying(false); setT(x); send(x); }} />
      <span className="rs-rp-t"><b>{clockOf(T)}</b><small>{where}</small></span>
      <button type="button" className="rs-rp-s" onClick={() => setSp((k) => (k + 1) % SPEEDS.length)} aria-label={t('Playback speed', 'Скорость повтора')}>{SPEEDS[sp]}×</button>
      <button type="button" className="rs-rp-x" onClick={close} aria-label={t('Close the replay', 'Закрыть повтор')}>×</button>
    </div>
  );
}
