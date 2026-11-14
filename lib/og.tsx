import { ImageResponse } from 'next/og';
import type { ReactNode } from 'react';
import type { CourseGeo, XZ } from './race';

// The drawn share cards (app/og/…): 1200 × 630 on the deep blue of the site's sea, the words on the left, the course
// from above on the right. Drawn rather than a photo, so the PNG stays small enough for WhatsApp (under 300 KB).
export const W = 1200, H = 630;
const ME = '#3db8ff', MARK = '#ff8a1e', SEA = '#0b2c48', ACCENT = '#0290d7';
const PANEL = { w: 400, h: 502 };

// Merriweather Light and Carlito Bold, the site's own, cut to the letters on the card (Google Fonts serves TrueType to
// a client that isn't a browser, which is what the renderer reads). Without them it falls back to its own font.
async function font(family: string, weight: 300 | 700, text: string) {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    return url ? { name: family, data: await (await fetch(url)).arrayBuffer(), weight, style: 'normal' as const } : null;
  } catch { return null; }
}

// The course to scale, the windward mark up: the start line dashed (and a finish line of its own, when the course has
// one), the marks in orange; with `tracks` each boat's
// track (yours brighter), with `route` (the beat angle, in degrees) the way round as a faint line, the beat in two
// tacks as the game's set-up draws it, and with `wind` the wind coming down from the top.
export function CourseSvg({ course: c, tracks, route, wind }: { course: CourseGeo; tracks?: { pts: XZ[]; me: boolean }[]; route?: number; wind?: boolean }) {
  const { w, h } = PANEL;
  // the rounding marks by the leg that goes to each (a result saved before the shapes has only the windward and wing marks)
  const round: Partial<Record<string, XZ>> = { mark: c.windward, ...(c.wing && { wing: c.wing }), ...c.marks };
  const marks: XZ[] = [...Object.values(round).filter((m): m is XZ => !!m), ...c.gate];
  const pts: XZ[] = [...marks, ...(c.finish || []), c.pin, c.committee, ...(tracks || []).flatMap((t) => t.pts)];
  const mid = (a: XZ, b: XZ): XZ => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const M = mid(c.pin, c.committee), beat = Math.hypot(c.windward[0] - M[0], c.windward[1] - M[1]);
  const corner: XZ = [M[0] - (beat / 2) * Math.tan(((route || 40) * Math.PI) / 180), (M[1] + c.windward[1]) / 2];
  if (route) pts.push(corner);
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs), pad = wind ? 64 : 28;
  const s = Math.min((w - 2 * 28) / (x1 - x0 || 1), (h - pad - 28) / (z1 - z0 || 1));
  const ox = (w - (x1 - x0) * s) / 2, oz = pad + (h - pad - 28 - (z1 - z0) * s) / 2;
  const X = (x: number) => ox + (x - x0) * s, Z = (z: number) => oz + (z - z0) * s;
  const path = (tr: XZ[]) => tr.map(([x, z], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)} ${Z(z).toFixed(1)}`).join(' ');
  // one lap: up to the windward mark, round the marks off the wind to the gate, then home to the finish
  const off = [round.wing, round.mark2, round.offset].filter((m): m is XZ => !!m);
  const way: XZ[] = [M, corner, c.windward, ...off, mid(c.gate[0], c.gate[1]), c.finish ? mid(c.finish[0], c.finish[1]) : M];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {wind && <path d={`M${w / 2} 18 L${w / 2} 44 M${w / 2 - 7} 36 L${w / 2} 46 L${w / 2 + 7} 36`} stroke="rgba(255,255,255,0.7)" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      <line x1={X(c.pin[0])} y1={Z(c.pin[1])} x2={X(c.committee[0])} y2={Z(c.committee[1])} stroke="rgba(255,255,255,0.55)" strokeWidth={2} strokeDasharray="6 6" />
      {c.finish && <line x1={X(c.finish[0][0])} y1={Z(c.finish[0][1])} x2={X(c.finish[1][0])} y2={Z(c.finish[1][1])} stroke="rgba(255,255,255,0.55)" strokeWidth={2} strokeDasharray="6 6" />}
      {route && <path d={path(way)} fill="none" stroke="rgba(143,211,255,0.45)" strokeWidth={3} strokeDasharray="2 9" strokeLinecap="round" />}
      {(tracks || []).filter((t) => !t.me && t.pts.length > 1).map((t, i) => <path key={i} d={path(t.pts)} fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth={2.5} strokeLinejoin="round" />)}
      {(tracks || []).filter((t) => t.me && t.pts.length > 1).map((t, i) => <path key={`me${i}`} d={path(t.pts)} fill="none" stroke={ME} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />)}
      {marks.map((m, i) => <circle key={i} cx={X(m[0])} cy={Z(m[1])} r={7} fill={MARK} />)}
    </svg>
  );
}

type Card = { kind: string; headline: string; detail: string; call: string; panel: ReactNode; windLabel?: string };

// The card: UP AND DOWN, the kind of race, the headline in Merriweather, the detail, the button and the address.
export async function card({ kind, headline, detail, call, panel, windLabel }: Card) {
  const text = `UP AND DOWN ${headline}${kind}${detail}${call}${windLabel || ''} → regatta.rycrentals.com`;
  const fonts = (await Promise.all([font('Merriweather', 300, text), font('Carlito', 700, text)])).filter((f) => f !== null);
  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', position: 'relative', fontFamily: 'Carlito', color: '#fff', background: 'linear-gradient(135deg, #0b3550 0%, #041626 100%)' }}>
        <div style={{ position: 'absolute', left: 64, top: 64, bottom: 64, width: 640, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', fontSize: 24, letterSpacing: 3, opacity: 0.8 }}>UP AND DOWN</div>
            <div style={{ display: 'flex', fontSize: 32, color: ME }}>{kind}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ display: 'flex', fontFamily: 'Merriweather', fontWeight: 300, fontSize: Math.min(104, Math.floor(640 / (headline.length * 0.55))), lineHeight: 1.05 }}>{headline}</div>
            <div style={{ display: 'flex', fontSize: 30, opacity: 0.88, lineHeight: 1.3 }}>{detail}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ display: 'flex', background: ACCENT, borderRadius: 999, padding: '14px 30px', fontSize: 30 }}>{call} →</div>
            <div style={{ display: 'flex', fontSize: 26, opacity: 0.8 }}>regatta.rycrentals.com</div>
          </div>
        </div>
        <div style={{ position: 'absolute', right: 64, top: 64, width: PANEL.w, height: PANEL.h, display: 'flex', background: SEA, borderRadius: 28, border: '2px solid rgba(143, 211, 255, 0.25)' }}>
          {panel}
          {windLabel && <div style={{ position: 'absolute', top: 18, left: PANEL.w / 2 + 16, display: 'flex', fontSize: 22, opacity: 0.75 }}>{windLabel}</div>}
        </div>
      </div>
    ),
    { width: W, height: H, fonts },
  );
}
