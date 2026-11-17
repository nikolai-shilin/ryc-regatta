import { ImageResponse } from 'next/og';
import type { ReactNode } from 'react';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CourseGeo, XZ } from './race';
import { WORDMARK } from './og-wordmark';

// The drawn share cards (app/og/…): 1200 × 630, made as the game's logo is made (public/images/brand-icon.svg): the
// flat dark ground, the blue bar down the whole left edge and UP / AND / DOWN stacked beside it, the race (or the page)
// and its day set by the wordmark; then the one big figure in the logo's bold capitals, the numbers as the HUD's lower
// third (public/game/hud-bc.js), the blue call, and on the right a square plate with what the card is about. All of it
// square-cut, as the logo is. Drawn rather than a photo, so the PNG stays small enough for WhatsApp (under 300 KB).
export const W = 1200, H = 630;
export const C = {
  ground: '#060d16', plate: '#0b1420', plate2: '#111c2b', you: '#3db8ff', gold: '#f5c400', up: '#2ee6a0', live: '#ff3b30', buoy: '#ff7a1a',
  inkOn: '#04121e', ink2: 'rgba(255,255,255,0.78)', ink3: 'rgba(255,255,255,0.62)', rule: 'rgba(255,255,255,0.14)', grid: 'rgba(255,255,255,0.06)',
};
const FACE = 'Sofia Sans Condensed';
const M = 48; // the margin round the card
const BAR = 30; // the logo's blue bar down the left edge: 38 of its 512
export const PANEL = { w: 440, h: H - 2 * M, head: 56, foot: 48 };
const LEFT = W - BAR - 2 * M - PANEL.w - 40; // the left column's width
export const URL_LABEL = 'sailupdown.com';

// Sofia Sans Condensed, the HUD's face, in the two weights the cards use, read from lib/og-fonts (next.config.ts ships
// them with the /og functions). From disk rather than Google Fonts: the renderer lays out nothing without a font, so a
// slow font server used to cost the card itself. Read once per instance.
let faces: Promise<{ name: string; data: Buffer; weight: 700 | 800; style: 'normal' }[]> | null = null;
const loadFaces = () => (faces ??= Promise.all(([700, 800] as const).map(async (weight) => (
  { name: FACE, data: await readFile(join(process.cwd(), 'lib/og-fonts', `SofiaSansCondensed-${weight}.ttf`)), weight, style: 'normal' as const }
))));

// The course to scale, the windward mark up, as the HUD's course map draws it: a hairline grid, the start line gold
// between its two ends (and a finish line of its own, dashed, when the course has one), the marks in the buoys' orange;
// with `tracks` each boat's track (yours in your blue), with `route` (the beat angle, in degrees) the way round as a
// dotted line, the beat in two tacks as the game's set-up draws it, and with `wind` the wind's arrow coming down.
export function CourseSvg({ course: c, tracks, route, wind, w = PANEL.w, h = PANEL.h - PANEL.head - PANEL.foot }: { course: CourseGeo; tracks?: { pts: XZ[]; me: boolean }[]; route?: number; wind?: boolean; w?: number; h?: number }) {
  // the rounding marks by the leg that goes to each (a result saved before the shapes has only the windward and wing marks)
  const round: Partial<Record<string, XZ>> = { mark: c.windward, ...(c.wing && { wing: c.wing }), ...c.marks };
  const marks: XZ[] = [...Object.values(round).filter((m): m is XZ => !!m), ...c.gate];
  const pts: XZ[] = [...marks, ...(c.finish || []), c.pin, c.committee, ...(tracks || []).flatMap((t) => t.pts)];
  const mid = (a: XZ, b: XZ): XZ => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const Mid = mid(c.pin, c.committee), beat = Math.hypot(c.windward[0] - Mid[0], c.windward[1] - Mid[1]);
  const corner: XZ = [Mid[0] - (beat / 2) * Math.tan(((route || 40) * Math.PI) / 180), (Mid[1] + c.windward[1]) / 2];
  if (route) pts.push(corner);
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs), pad = 36;
  const s = Math.min((w - 2 * pad) / (x1 - x0 || 1), (h - 2 * pad) / (z1 - z0 || 1));
  const ox = (w - (x1 - x0) * s) / 2, oz = (h - (z1 - z0) * s) / 2;
  const X = (x: number) => ox + (x - x0) * s, Z = (z: number) => oz + (z - z0) * s;
  const path = (tr: XZ[]) => tr.map(([x, z], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)} ${Z(z).toFixed(1)}`).join(' ');
  // one lap: up to the windward mark, round the marks off the wind to the gate, then home to the finish
  const off = [round.wing, round.mark2, round.offset].filter((m): m is XZ => !!m);
  const way: XZ[] = [Mid, corner, c.windward, ...off, mid(c.gate[0], c.gate[1]), c.finish ? mid(c.finish[0], c.finish[1]) : Mid];
  const step = 44, grid = [...Array(Math.ceil(w / step) + 1).keys()].map((i) => `M${i * step} 0V${h}`).join('') + [...Array(Math.ceil(h / step) + 1).keys()].map((i) => `M0 ${i * step}H${w}`).join('');
  const end = (p: XZ, k: string) => <circle key={k} cx={X(p[0])} cy={Z(p[1])} r={6} fill="#ffffff" stroke={C.buoy} strokeWidth={3} />;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={grid} stroke={C.grid} strokeWidth={1} fill="none" />
      {wind && <path d={`M${w - 30} 18 L${w - 30} 50 M${w - 39} 40 L${w - 30} 52 L${w - 21} 40`} stroke={C.you} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      {route && <path d={path(way)} fill="none" stroke="rgba(61,184,255,0.55)" strokeWidth={3} strokeDasharray="2 9" strokeLinecap="round" />}
      {c.finish && <line x1={X(c.finish[0][0])} y1={Z(c.finish[0][1])} x2={X(c.finish[1][0])} y2={Z(c.finish[1][1])} stroke="rgba(255,255,255,0.7)" strokeWidth={2.5} strokeDasharray="6 6" />}
      {(tracks || []).filter((t) => !t.me && t.pts.length > 1).map((t, i) => <path key={i} d={path(t.pts)} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={2.5} strokeLinejoin="round" />)}
      {(tracks || []).filter((t) => t.me && t.pts.length > 1).map((t, i) => <path key={`me${i}`} d={path(t.pts)} fill="none" stroke={C.you} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />)}
      <line x1={X(c.pin[0])} y1={Z(c.pin[1])} x2={X(c.committee[0])} y2={Z(c.committee[1])} stroke={C.gold} strokeWidth={3.5} />
      {end(c.pin, 'pin')}{end(c.committee, 'cb')}
      {marks.map((m, i) => <circle key={i} cx={X(m[0])} cy={Z(m[1])} r={8} fill={C.buoy} />)}
    </svg>
  );
}

// The plate's body as the HUD's leaderboard: a row each on hairline rules, a plate before it (the place, a guide's
// number) and its figure at the right; a line in grey under the words where it says more, a bar where the rows compare (a yacht's length, a count), and a
// row with only a head is a heading over the rows after it. Sized to share the plate's height.
export type Row = { lead?: string; leadBg?: string; text: string; sub?: string; value?: string | number; valueColor?: string; bar?: number; head?: boolean };
export function Rows({ rows, keys = false, size }: { rows: Row[]; keys?: boolean; size?: number }) {
  const h = (PANEL.h - PANEL.head - (keys ? PANEL.foot : 0) - 20) / rows.length;
  const fs = size || Math.max(17, Math.min(28, Math.round(h * 0.5)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: PANEL.w, padding: '10px 0' }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', height: h, padding: '0 24px', gap: 14, borderTop: i && !r.head ? `1px solid ${C.rule}` : 'none' }}>
          {r.head ? <div style={{ display: 'flex', fontSize: Math.round(fs * 0.62), fontWeight: 800, letterSpacing: 2.4, textTransform: 'uppercase', color: C.you, alignSelf: 'flex-end', paddingBottom: 6 }}>{r.text}</div> : null}
          {!r.head && r.lead !== undefined ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: Math.round(fs * 1.5), height: Math.round(fs * 1.4), padding: '0 6px', background: r.leadBg || C.plate2, color: r.leadBg ? C.inkOn : '#fff', fontSize: Math.round(fs * 0.86), fontWeight: 800 }}>{r.lead}</div>
          ) : null}
          {!r.head ? (
            <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, gap: 6, overflow: 'hidden' }}>
              <div style={{ display: 'flex', fontSize: fs, fontWeight: 700, lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.text}</div>
              {r.sub ? <div style={{ display: 'flex', fontSize: Math.round(fs * 0.68), fontWeight: 700, color: C.ink3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sub}</div> : null}
              {r.bar !== undefined ? <div style={{ display: 'flex', width: `${Math.max(2, Math.round(r.bar * 100))}%`, height: 5, background: C.you }} /> : null}
            </div>
          ) : null}
          {!r.head && r.value !== undefined ? <div style={{ display: 'flex', fontSize: fs, fontWeight: 800, color: r.valueColor || '#fff', whiteSpace: 'nowrap' }}>{String(r.value)}</div> : null}
        </div>
      ))}
    </div>
  );
}

// The map's key, as the HUD's map labels its foot: a swatch (a line, a dot or the wind's arrow) and a word each
export type Key = { kind: 'line' | 'dot' | 'arrow'; color: string; label: string };
const Swatch = ({ kind, color }: Key) =>
  kind === 'line' ? <div style={{ display: 'flex', width: 22, height: 4, background: color }} />
  : kind === 'dot' ? <div style={{ display: 'flex', width: 12, height: 12, borderRadius: 6, background: color }} />
  : <svg width={14} height={18} viewBox="0 0 14 18"><path d="M7 1V16M1.5 10.5L7 16.5L12.5 10.5" stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;

export type Cell = { label: string; value: string | number; unit?: string; color?: string };
// the big figure: its label over it, and before it, when there is one, a plate (the place, as the leaderboard's)
// wrap: a page's name rather than a figure, sized to take up to two lines
export type Hero = { label: string; value: string; color?: string; plate?: { text: string; bg: string }; wrap?: boolean };
type Card = {
  kind: string; // the race (or the page), set beside the wordmark
  tag?: { text: string; live?: boolean }; // under it: the day, with the red dot while it's on
  hero: Hero; cells: Cell[];
  strip?: ReactNode; // a row under the cells, in the same plate
  call: string;
  panel: { title: string; aside?: string; asideColor?: string; body: ReactNode; keys?: Key[] };
};

export async function card({ kind, tag, hero, cells, strip, call, panel }: Card) {
  const fonts = await loadFaces();
  const plateW = hero.plate ? 40 + hero.plate.text.length * 64 : 0;
  // a figure on one line; a name on two at most, the biggest size its words still break into two lines at (a capital
  // takes about 0.56 of the size, a Cyrillic one a little more than a Latin)
  const fits = (sz: number) => {
    const per = (LEFT - plateW) / (sz * 0.56);
    let lines = 1, line = 0;
    for (const w of hero.value.split(' ')) {
      if (w.length > per) return false;
      if (line && line + 1 + w.length > per) { lines++; line = w.length; } else line += (line ? 1 : 0) + w.length;
    }
    return lines <= 2;
  };
  let size = Math.min(150, Math.floor((LEFT - plateW) / (Math.max(hero.value.length, 3) * 0.5)));
  if (hero.wrap) { size = 104; while (size > 48 && !fits(size)) size -= 4; }
  const mark = 92, markW = Math.round((mark * WORDMARK.w) / WORDMARK.h); // the wordmark's height on the card
  const label = { fontSize: 16, fontWeight: 700, letterSpacing: 2.6, textTransform: 'uppercase' as const, color: C.ink3 };
  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', position: 'relative', fontFamily: FACE, color: '#fff', backgroundColor: C.ground }}>
        {/* the logo's blue bar, the card's whole height */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: BAR, display: 'flex', background: C.you }} />
        <div style={{ position: 'absolute', left: BAR + M, top: M, bottom: M, width: LEFT, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          {/* the wordmark, UP / AND / DOWN as the logo stacks it, and beside it what this card is and its day */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 26 }}>
            <svg width={markW} height={mark} viewBox={`${WORDMARK.x} ${WORDMARK.y} ${WORDMARK.w} ${WORDMARK.h}`}><path d={WORDMARK.d} fill="#ffffff" /></svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 24, borderLeft: `1px solid ${C.rule}`, paddingBottom: 2 }}>
              {tag ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 22, fontWeight: 700, letterSpacing: 2.6, textTransform: 'uppercase', lineHeight: 1 }}>
                  {tag.live ? <div style={{ display: 'flex', width: 11, height: 11, borderRadius: 6, background: C.live }} /> : null}
                  {tag.text}
                </div>
              ) : null}
              <div style={{ display: 'flex', ...label, fontSize: 16, lineHeight: 1.25, maxWidth: LEFT - markW - 60 }}>{kind}</div>
            </div>
          </div>

          {/* the one big figure, as the start clock */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', ...label, fontSize: 20, letterSpacing: 3 }}>{hero.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginTop: 14 }}>
              {hero.plate ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: Math.round(size * 0.8), padding: '0 20px', background: hero.plate.bg, color: C.inkOn, fontSize: Math.round(size * 0.52), fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>{hero.plate.text}</div>
              ) : null}
              <div style={{ display: 'flex', fontSize: size, fontWeight: 700, lineHeight: hero.wrap ? 0.92 : 0.86, letterSpacing: 1, textTransform: 'uppercase', color: hero.color || '#fff' }}>{hero.value}</div>
            </div>
          </div>

          {/* the numbers, as the lower third: cells on hairline rules */}
          <div style={{ display: 'flex', flexDirection: 'column', background: C.plate }}>
            <div style={{ display: 'flex' }}>
              {cells.map((c, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexBasis: 'auto', padding: '16px 20px 18px', borderLeft: i ? `1px solid ${C.rule}` : 'none', gap: 10 }}>
                  <div style={{ display: 'flex', ...label, fontSize: 14, letterSpacing: 2.4, lineHeight: 1, whiteSpace: 'nowrap' }}>{c.label}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', lineHeight: 1, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, textTransform: 'uppercase', color: c.color || '#fff' }}>{String(c.value)}</div>
                    {c.unit ? <div style={{ display: 'flex', marginLeft: 6, fontSize: 16, fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase', color: C.ink3 }}>{c.unit}</div> : null}
                  </div>
                </div>
              ))}
            </div>
            {strip ? <div style={{ display: 'flex', borderTop: `1px solid ${C.rule}`, padding: '14px 20px' }}>{strip}</div> : null}
          </div>

          {/* the one action, a blue block, and where it goes */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', height: 62, padding: '0 28px', background: C.you, color: C.inkOn, fontSize: 26, fontWeight: 800, letterSpacing: 2.2, textTransform: 'uppercase' }}>{`${call} →`}</div>
            <div style={{ display: 'flex', ...label, fontSize: 20, letterSpacing: 2 }}>{URL_LABEL}</div>
          </div>
        </div>

        {/* the plate on the right, square as the logo: its name and what it shows, the picture, its key */}
        <div style={{ position: 'absolute', right: M, top: M, width: PANEL.w, height: PANEL.h, display: 'flex', flexDirection: 'column', background: C.plate }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: PANEL.head, padding: '0 24px', borderBottom: `1px solid ${C.rule}` }}>
            <div style={{ display: 'flex', fontSize: 18, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase' }}>{panel.title}</div>
            {panel.aside ? <div style={{ display: 'flex', fontSize: panel.asideColor ? 28 : 16, fontWeight: panel.asideColor ? 800 : 700, letterSpacing: panel.asideColor ? 0 : 2.4, textTransform: 'uppercase', color: panel.asideColor || C.ink3 }}>{panel.aside}</div> : null}
          </div>
          <div style={{ display: 'flex', flexGrow: 1, position: 'relative' }}>{panel.body}</div>
          {panel.keys ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 26, height: PANEL.foot, borderTop: `1px solid ${C.rule}` }}>
              {panel.keys.map((k, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <Swatch {...k} />
                  <div style={{ display: 'flex', ...label, fontSize: 14, letterSpacing: 2.2 }}>{k.label}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    ),
    { width: W, height: H, fonts },
  );
}
