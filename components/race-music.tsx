'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { readOpts, OPTS_EVENT, TRACKS, type Music } from '@/lib/opts';

// The race hub and the free race's set-up are the race's pause screen, so they sound like it: the pre-start of the
// track picked in Settings › Music (public/game/music.js, its calm piece: the light verse the start clock runs down
// over), looped and muffled, as if heard from behind the glass card. Over Start the muffle lifts, and the race takes
// it from there. Mounted once for /race and /race/free (app/[lang]/race/layout.tsx), so going from one to the other
// it plays on; on the other /race pages it fades out. It follows Settings as the home page's song does
// (components/soundtrack.tsx): Sound or Music off is silence, Music volume its level, a change heard at once; a
// browser that won't play before a tap starts it on the first one.
//
// It plays the same file the game will, at the address the game's import map gives it (its content's hash after a
// deploy, scripts/stamp-game.mjs), so by the time Start is pressed the browser has it.

// each track's pre-start in its file: where it starts and how long its bars are together (s); music.js TRACKS[id].calm,
// which npm test keeps this in step with
export const CALM: Record<Exclude<Music, 'off'>, [number, number]> = {
  racing: [0.9, 29.064],
  groove: [0.9, 16.4454],
  riff: [0.9, 24.2799],
  openwater: [0.9, 14.3199],
};
const VOL = { loud: 1.6, normal: 1, quiet: 0.4 } as const; // MUSIC_VOL in main.js
const MUFFLED = 900, OPEN = 20000; // Hz, the lowpass behind the card and over Start
const LIFT = 1.25; // the muffled loop a little louder, for what the lowpass takes away
const X = 0.015; // s, the crossfade where the loop comes round, as music.js plays its bars
const START = '.bt-go'; // the hub's Start today's race and the free race's Start
const HERE = /^\/(?:(?:en|ru)\/)?race(?:\/free)?\/?$/;

type Track = keyof typeof CALM;
const track = (): Track | null => {
  const o = readOpts();
  return !o.sound || o.music === 'off' || !TRACKS.includes(o.music) ? null : (o.music as Track);
};
const level = () => 0.5 * (VOL[readOpts().musicVol] ?? 1);

// where the game's page fetches a file of /game/ from: its import map, stamped at the deploy; the plain address without one
let addresses: Promise<Record<string, string>> | null = null;
const addressOf = async (f: string) => {
  addresses ??= fetch('/play').then((r) => r.text()).then((html) => {
    const m = /<script type="importmap">(.*?)<\/script>/s.exec(html);
    return (m ? JSON.parse(m[1]).imports : {}) as Record<string, string>;
  }).catch(() => ({}));
  return (await addresses)[f] ?? f;
};

export function RaceMusic() {
  const here = HERE.test(usePathname() ?? '');

  useEffect(() => {
    if (!here) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    let ctx: AudioContext | null = null, master: GainNode | null = null, lp: BiquadFilterNode | null = null;
    let on = false, open = false, playing: Track | null = null, nextT = 0, timer = 0, gone = false;
    const bufs: Partial<Record<Track, Promise<{ b: AudioBuffer; shift: number } | null>>> = {};
    const live: AudioBufferSourceNode[] = [];

    const graph = () => {
      if (ctx) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0;
      lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = MUFFLED; lp.Q.value = 0.7;
      lp.connect(master).connect(ctx.destination);
    };
    const load = (id: Track) => bufs[id] ??= addressOf(`/game/music-${id}.mp3`)
      .then((u) => fetch(u)).then((r) => r.arrayBuffer())
      .then((a) => new Promise<AudioBuffer>((res, rej) => ctx!.decodeAudioData(a, res, rej)))
      .then((b) => {
        // the blip at 0.2 s: where this browser's decoder put the file's start (music.js does the same)
        const d = b.getChannelData(0); let i = 0; while (i < d.length && Math.abs(d[i]) < 0.1) i++;
        return { b, shift: i < b.sampleRate ? i / b.sampleRate - 0.2 : 0 };
      })
      .catch(() => { delete bufs[id]; return null; });

    const gainTo = (v: number, s: number) => {
      if (!ctx || !master) return;
      const n = ctx.currentTime;
      master.gain.cancelScheduledValues(n); master.gain.setValueAtTime(master.gain.value, n); master.gain.linearRampToValueAtTime(v, n + s);
    };
    const loud = () => level() * (open ? 1 : LIFT);

    // the loop, one whole pass at a time, each faded in and out over X either side of its ends, scheduled ahead
    const pass = (b: AudioBuffer, shift: number, [at, len]: [number, number], t: number) => {
      const s = ctx!.createBufferSource(), g = ctx!.createGain();
      s.buffer = b; s.connect(g).connect(lp!);
      g.gain.setValueAtTime(0, t - X); g.gain.linearRampToValueAtTime(1, t + X);
      g.gain.setValueAtTime(1, t + len - X); g.gain.linearRampToValueAtTime(0, t + len + X);
      s.start(t - X, Math.max(0, at + shift - X), len + 2 * X + 0.01);
      live.push(s); s.onended = () => { const i = live.indexOf(s); if (i >= 0) live.splice(i, 1); };
    };
    const silence = () => { for (const s of live.splice(0)) try { s.stop(); } catch { /* not started */ } clearInterval(timer); timer = 0; playing = null; };

    const play = async (id: Track) => {
      const got = await load(id);
      if (!got || !on || gone || track() !== id || playing === id) return;
      silence(); playing = id;
      nextT = ctx!.currentTime + 0.05;
      const tick = () => { while (nextT < ctx!.currentTime + 1.5) { pass(got.b, got.shift, CALM[id], nextT); nextT += CALM[id][1]; } };
      tick(); timer = window.setInterval(tick, 500);
      gainTo(loud(), 2.5);
    };
    const start = async () => {
      const id = track();
      if (on || gone || document.hidden || !id) return;
      graph();
      try { await ctx!.resume(); } catch { return; }
      if (on || gone || ctx!.state !== 'running') return; // not before a tap: the first one starts it
      on = true; unbind(); play(id);
    };
    const stop = (s = 0.4) => {
      if (!on) return; on = false; gainTo(0, s);
      setTimeout(() => { if (!on) { silence(); ctx?.suspend().catch(() => {}); } }, s * 1000 + 50);
    };
    const onSettings = () => {
      const id = track();
      if (!id) stop();
      else if (!on) start();
      else if (id !== playing) { gainTo(0, 0.4); setTimeout(() => { if (on && track() === id) { playing = null; play(id); } }, 450); }
      else gainTo(loud(), 0.3);
    };
    const onVisible = () => { if (document.hidden) stop(); else start(); };

    // over Start the muffle lifts, and comes down again off it
    const lift = (v: boolean) => {
      if (v === open || !ctx || !lp) return; open = v;
      const n = ctx.currentTime;
      lp.frequency.cancelScheduledValues(n); lp.frequency.setValueAtTime(lp.frequency.value, n);
      lp.frequency.exponentialRampToValueAtTime(v ? OPEN : MUFFLED, n + (v ? 1 : 0.6));
      if (on) gainTo(loud(), v ? 1 : 0.6);
    };
    const onStart = (e: Event) => (e.target as Element | null)?.closest?.(START);
    const over = (e: Event) => { if (onStart(e)) lift(true); };
    const out = (e: Event) => {
      const to = (e as PointerEvent | FocusEvent).relatedTarget as Element | null;
      if (onStart(e) && !to?.closest?.(START)) lift(false);
    };

    const tap = () => { start(); };
    const bind = () => { for (const k of ['pointerdown', 'keydown', 'touchend'] as const) window.addEventListener(k, tap, { passive: true }); };
    const unbind = () => { for (const k of ['pointerdown', 'keydown', 'touchend'] as const) window.removeEventListener(k, tap); };

    bind();
    document.addEventListener('pointerover', over); document.addEventListener('focusin', over);
    document.addEventListener('pointerout', out); document.addEventListener('focusout', out);
    window.addEventListener(OPTS_EVENT, onSettings);
    document.addEventListener('visibilitychange', onVisible);
    start();
    return () => {
      gone = true; unbind();
      document.removeEventListener('pointerover', over); document.removeEventListener('focusin', over);
      document.removeEventListener('pointerout', out); document.removeEventListener('focusout', out);
      window.removeEventListener(OPTS_EVENT, onSettings);
      document.removeEventListener('visibilitychange', onVisible);
      // off to another page: it fades rather than stops
      gainTo(0, 0.6);
      const c = ctx; setTimeout(() => { silence(); c?.close().catch(() => {}); }, 700);
    };
  }, [here]);
  return null;
}
