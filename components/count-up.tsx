'use client';
import { useEffect, useRef } from 'react';

// A number that counts up to itself the first time it comes into view, as a broadcast's numbers do: every number in
// the text (a time as m:ss or m:ss.d, a whole or decimal number) runs from nothing to its value, keeping its form. The
// page renders the final value, so it reads the same without JavaScript or under reduced motion.
const TOKEN = /(\d+):(\d{2})(?:([.,])(\d))?|(\d+)(?:([.,])(\d+))?/g;

function at(v: string, k: number) {
  return v.replace(TOKEN, (_, m, s, tsep, td, n, nsep, nd) => {
    if (m != null) {
      const total = (+m * 60 + +s + (td ? +td / 10 : 0)) * k, mm = Math.floor(total / 60), ss = total - mm * 60;
      return td ? `${mm}:${ss.toFixed(1).padStart(4, '0').replace('.', tsep)}` : `${mm}:${String(Math.floor(ss)).padStart(2, '0')}`;
    }
    const d = nd ? nd.length : 0, x = (+(nd ? `${n}.${nd}` : n) * k).toFixed(d);
    return nsep ? x.replace('.', nsep) : x;
  });
}

export function CountUp({ v, ms = 900 }: { v: string; ms?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !TOKEN.test(v) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    TOKEN.lastIndex = 0;
    let raf = 0;
    el.textContent = at(v, 0);
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / ms);
        el.textContent = k < 1 ? at(v, 1 - (1 - k) ** 3) : v;
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); el.textContent = v; };
  }, [v, ms]);
  return <span ref={ref}>{v}</span>;
}
