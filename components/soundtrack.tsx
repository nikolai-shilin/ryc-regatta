'use client';
import { useEffect } from 'react';
import { readOpts, OPTS_EVENT } from '@/lib/opts';
import type { Lang } from '@/lib/lang';

// The site's soundtrack, "Hold the Line, Chase the Wind" (sung in Russian on the Russian pages), on the home page and
// under the result of your own race: it fades in, loops, and follows Settings as the race's music does (public/game/main.js, score.style): Sound or Music off
// is silence, Music volume its level, and a change in the settings is heard at once. A browser that won't play before
// a tap starts it on the first one. It runs through a gain node, as iOS ignores an audio element's own volume.
const SRC: Record<Lang, string> = { en: '/game/music-finish.m4a', ru: '/game/music-finish-ru.m4a' };
const VOL = { loud: 1.6, normal: 1, quiet: 0.4 } as const; // MUSIC_VOL in main.js
const FADE = 2.5; // s

const level = () => {
  const o = readOpts();
  return !o.sound || o.music === 'off' ? 0 : 0.5 * (VOL[o.musicVol] ?? 1);
};

export function Soundtrack({ lang }: { lang: Lang }) {
  useEffect(() => {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const el = new Audio(SRC[lang] ?? SRC.en);
    el.loop = true; el.preload = 'auto';
    let ctx: AudioContext | null = null, gain: GainNode | null = null, on = false;

    const graph = () => {
      if (ctx) return;
      ctx = new AC();
      gain = ctx.createGain(); gain.gain.value = 0;
      ctx.createMediaElementSource(el).connect(gain).connect(ctx.destination);
    };
    const to = (v: number, s = 0.6) => {
      if (!ctx || !gain) return;
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(v, now + s);
    };
    const start = async () => {
      if (on || document.hidden || !level()) return;
      graph();
      try {
        await ctx!.resume();
        await el.play();
        on = true; to(level(), FADE); unbind();
      } catch { /* not before a tap: the first one starts it */ }
    };
    const stop = () => { if (!on) return; on = false; to(0, 0.4); setTimeout(() => { if (!on) el.pause(); }, 450); };
    const onSettings = () => { if (!level()) stop(); else if (on) to(level()); else start(); };
    const onVisible = () => { if (document.hidden) stop(); else start(); };

    const tap = () => { start(); };
    const bind = () => { for (const k of ['pointerdown', 'keydown', 'touchend'] as const) window.addEventListener(k, tap, { passive: true }); };
    const unbind = () => { for (const k of ['pointerdown', 'keydown', 'touchend'] as const) window.removeEventListener(k, tap); };

    bind();
    window.addEventListener(OPTS_EVENT, onSettings);
    document.addEventListener('visibilitychange', onVisible);
    start();
    return () => {
      unbind();
      window.removeEventListener(OPTS_EVENT, onSettings);
      document.removeEventListener('visibilitychange', onVisible);
      el.pause(); el.removeAttribute('src'); el.load();
      ctx?.close().catch(() => {});
    };
  }, [lang]);
  return null;
}
