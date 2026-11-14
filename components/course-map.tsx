import { useId } from 'react';
import type { Lang } from '@/lib/lang';
import { BEAT_ANGLE, gateMid, lineMid, shapeOf, type CourseGeo, type Wind, type XZ, KN } from '@/lib/race';

// The course from above, to scale, as the game's top camera sees it: dark water, the marks where they lie, a finish line
// of its own when the course has one, the distance lines the game floats across the beat (every 50 m, 100 m on a long
// beat), the three-length zones, and the lengths of the beat, the start line and the gate. With `route` it shows one lap
// as a guide (the set-up): the beats in two tacks, the reaches and the runs; with `tracks` the boats' tracks (the debrief).
type Track = { pts: XZ[]; me: boolean };
type Props = {
  lang: Lang; geo: CourseGeo; preset: Wind; W: number; H: number; className?: string;
  route?: boolean; fleet?: number; tracks?: Track[]; fouls?: XZ[];
};

const HULL = 12.2, ZONE = 3 * HULL;
const SEA = '#0b2c48', TXT = 'rgba(255,255,255,0.82)', DIM = '#8fd3ff', ME = '#3db8ff', MARK = '#ff8a1e';
const font = { fontFamily: 'var(--f-carlito), Arial, sans-serif', fontWeight: 700 } as const;

export function CourseMap({ lang, geo, preset, W, H, className, route, fleet, tracks, fouls }: Props) {
  const ru = lang === 'ru', id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const m = (v: number) => `${Math.round(v)} ${ru ? 'м' : 'm'}`;
  const M = lineMid(geo), Wm = geo.windward, beat = Math.hypot(Wm[0] - M[0], Wm[1] - M[1]);
  const lineLen = Math.hypot(geo.committee[0] - geo.pin[0], geo.committee[1] - geo.pin[1]);
  const gateW = Math.hypot(geo.gate[1][0] - geo.gate[0][0], geo.gate[1][1] - geo.gate[0][1]);
  const shape = shapeOf(geo), G = gateMid(geo), F = geo.finish, Fm: XZ | null = F ? [(F[0][0] + F[1][0]) / 2, (F[0][1] + F[1][1]) / 2] : null;
  // the rounding marks by the leg that goes to each (a result saved before the shapes has only the windward and wing marks)
  const marks: Record<string, XZ> = { mark: Wm, ...(geo.wing && { wing: geo.wing }), ...geo.marks };
  const Wg = marks.wing, M2 = marks.mark2, Off = marks.offset;
  // the guide's beat from p up to q: starboard tack out to the left, a tack on the layline, port tack up to the mark
  const a = (BEAT_ANGLE[preset] * Math.PI) / 180;
  const tack = (p: XZ, q: XZ): XZ => {
    const t1 = Math.max(0, ((p[1] - q[1]) / Math.cos(a) - (q[0] - p[0]) / Math.sin(a)) / 2);
    return [p[0] - t1 * Math.sin(a), p[1] - t1 * Math.cos(a)];
  };
  const corner = tack(M, Wm), corner2 = shape === 'wlu' && Fm ? tack(G, Fm) : null;

  // fit: everything on the water, with room for the labels round it
  const pts: XZ[] = [...Object.values(marks), ...geo.gate, ...(F || []), geo.pin, geo.committee, ...(route ? [corner, ...(corner2 ? [corner2] : [])] : []), ...(tracks || []).flatMap((t) => t.pts)];
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  const x0 = Math.min(...xs) - 12, x1 = Math.max(...xs) + 12, z0 = Math.min(...zs) - 12, z1 = Math.max(...zs) + 12;
  const pad = { t: 40, b: route ? 44 : 30, l: 16, r: 56 };
  const s = Math.min((W - pad.l - pad.r) / (x1 - x0), (H - pad.t - pad.b) / (z1 - z0));
  const ox = pad.l + (W - pad.l - pad.r - (x1 - x0) * s) / 2, oz = pad.t + (H - pad.t - pad.b - (z1 - z0) * s) / 2;
  const X = (x: number) => ox + (x - x0) * s, Z = (z: number) => oz + (z - z0) * s;
  const path = (tr: XZ[]) => tr.map(([x, z], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)} ${Z(z).toFixed(1)}`).join(' ');

  // the distance lines across the beat, as the game draws them on the water
  const step = beat > 600 ? 100 : 50, ladder: number[] = [];
  for (let d = step; d < beat - 15; d += step) ladder.push(d);
  // a scale bar of a round length, 30–70 px long
  const bar = [10, 20, 25, 50, 100, 200, 250, 500, 1000].filter((v) => v * s <= 70).pop() || 10;
  // the beat's length, right of the course
  const dx = Math.min(W - 30, Math.max(X(geo.committee[0]), X(Wm[0])) + 34), dy1 = Z(M[1]), dy2 = Z(Wm[1]);
  const halo = { stroke: SEA, strokeWidth: 3.5, paintOrder: 'stroke', strokeLinejoin: 'round' } as const;
  const hull = (L: number) => `M0 ${-L / 2} C${L * 0.2} ${-L * 0.25} ${L * 0.17} ${L * 0.3} ${L * 0.12} ${L / 2} H${-L * 0.12} C${-L * 0.17} ${L * 0.3} ${-L * 0.2} ${-L * 0.25} 0 ${-L / 2}Z`;
  const boatL = Math.max(8, HULL * s), n = fleet || 0;
  const pill = (x: number, y: number, text: string) => {
    const w = text.length * 5.6 + 12;
    return (
      <g>
        <rect x={x - w / 2} y={y - 8} width={w} height={16} rx={8} fill={SEA} stroke={DIM} strokeOpacity={0.5} />
        <text x={x} y={y + 3.6} textAnchor="middle" fontSize={10} fill={DIM} style={font}>{text}</text>
      </g>
    );
  };
  const label = ru
    ? `Дистанция сверху, в масштабе: лавировка ${m(beat)}, стартовая линия ${m(lineLen)}, ворота ${m(gateW)}`
    : `The course from above, to scale: a ${m(beat)} beat, a ${m(lineLen)} start line, a ${m(gateW)} gate`;

  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <defs>
        <linearGradient id={`sea${id}`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#0f3c5f" /><stop offset="1" stopColor="#09243b" />
        </linearGradient>
        <filter id={`wv${id}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.011 0.026" numOctaves="3" seed="7" />
          <feColorMatrix values="0 0 0 0 0.12  0 0 0 0 0.5  0 0 0 0 0.6  1.1 0 0 0 -0.45" />
        </filter>
        <clipPath id={`cl${id}`}><rect width={W} height={H} rx={18} /></clipPath>
      </defs>
      <g clipPath={`url(#cl${id})`}>
        <rect width={W} height={H} fill={`url(#sea${id})`} />
        <rect width={W} height={H} filter={`url(#wv${id})`} opacity={0.55} />

        {ladder.map((d) => {
          const z = Wm[1] + d, hw = Math.min(260, 30 + d * 0.95);
          return <path key={d} d={`M${X(Wm[0] - hw)} ${Z(z)} H${X(Wm[0] + hw)}`} stroke="#fff" strokeOpacity={0.13} strokeWidth={1} strokeDasharray="6 5" />;
        })}
        {/* the zones where mark-room counts (rule 18): the gate and the marks reached off the wind, none at the
            windward mark (a beat) or a finish line */}
        {[...geo.gate, ...[Wg, M2, Off].filter((p): p is XZ => !!p)].map((p, i) => <circle key={i} cx={X(p[0])} cy={Z(p[1])} r={ZONE * s} fill="none" stroke="#fff" strokeOpacity={0.28} strokeDasharray="2 3" />)}

        {route && (
          <g fill="none" stroke={ME} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round">
            <path d={`M${X(M[0])} ${Z(M[1])} L${X(corner[0])} ${Z(corner[1])} L${X(Wm[0])} ${Z(Wm[1])}`} strokeOpacity={0.85} />
            {shape === 'trap' && M2 && Fm
              ? <path d={`M${X(Wm[0]) - 6} ${Z(Wm[1]) + 3} L${X(M2[0]) + 5} ${Z(M2[1]) - 2} L${X(G[0]) + 4} ${Z(G[1]) - 5} L${X(Fm[0]) - 4} ${Z(Fm[1])}`} strokeOpacity={0.6} strokeDasharray="4 5" />
              : shape === 'wlu' && Off && corner2 && Fm
                ? <>
                  <path d={`M${X(Wm[0]) - 6} ${Z(Wm[1]) + 2} L${X(Off[0]) + 5} ${Z(Off[1])} L${X(G[0]) - 3} ${Z(G[1]) - 6}`} strokeOpacity={0.6} strokeDasharray="4 5" />
                  <path d={`M${X(G[0]) + 3} ${Z(G[1]) - 6} L${X(corner2[0])} ${Z(corner2[1])} L${X(Fm[0])} ${Z(Fm[1]) + 3}`} strokeOpacity={0.85} />
                </>
                : Wg
                  ? <path d={`M${X(Wm[0]) - 6} ${Z(Wm[1]) + 3} L${X(Wg[0]) + 6} ${Z(Wg[1]) - 3} L${X(M[0]) - 4} ${Z(M[1]) - 6}`} strokeOpacity={0.6} strokeDasharray="4 5" />
                  : <path d={`M${X(Wm[0]) + 4} ${Z(Wm[1]) + 8} L${X(M[0]) + 4} ${Z(M[1]) - 6}`} strokeOpacity={0.6} strokeDasharray="4 5" />}
          </g>
        )}
        {(tracks || []).filter((t) => !t.me).map((t, i) => <path key={i} d={path(t.pts)} fill="none" stroke="#fff" strokeOpacity={0.32} strokeWidth={1.3} strokeLinejoin="round" />)}
        {(tracks || []).filter((t) => t.me).map((t, i) => <path key={i} d={path(t.pts)} fill="none" stroke={ME} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />)}

        <path d={`M${X(geo.pin[0])} ${Z(geo.pin[1])} L${X(geo.committee[0])} ${Z(geo.committee[1])}`} stroke="#fff" strokeOpacity={0.85} strokeWidth={1.4} strokeDasharray="3 4" />
        {F && (
          <g>
            <path d={`M${X(F[0][0])} ${Z(F[0][1])} L${X(F[1][0])} ${Z(F[1][1])}`} stroke="#fff" strokeOpacity={0.85} strokeWidth={1.4} strokeDasharray="3 4" />
            {F.map((e, i) => <circle key={i} cx={X(e[0])} cy={Z(e[1])} r={3} fill="#f4f6f7" stroke={SEA} strokeWidth={1} />)}
          </g>
        )}
        {Object.values(marks).map((p, i) => <circle key={i} cx={X(p[0])} cy={Z(p[1])} r={5.5} fill={MARK} stroke={SEA} strokeWidth={1.5} />)}
        {geo.gate.map((p, i) => <circle key={`g${i}`} cx={X(p[0])} cy={Z(p[1])} r={4.5} fill={MARK} stroke={SEA} strokeWidth={1.5} />)}
        <path d={`M${X(geo.pin[0]) - 6} ${Z(geo.pin[1]) + 5} l6 -11 6 11 z`} fill="#f2c230" />
        <g transform={`translate(${X(geo.committee[0])} ${Z(geo.committee[1])}) rotate(90)`}><path d={hull(Math.max(14, HULL * 1.4 * s))} fill="#f4f6f7" /></g>
        {Array.from({ length: n }, (_, i) => {
          const f = n > 1 ? 0.18 + (0.64 * i) / (n - 1) : 0.5, x = X(geo.pin[0] + (geo.committee[0] - geo.pin[0]) * f), y = Z(M[1]) + 4 + boatL / 2;
          return <g key={i} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}><path d={hull(boatL)} fill={i === Math.floor(n / 2) ? ME : '#e9eef0'} /></g>;
        })}
        {(fouls || []).map((f, i) => <circle key={i} cx={X(f[0])} cy={Z(f[1])} r={6} fill="none" stroke="#ffa800" strokeWidth={2.5} />)}

        {/* the beat's length */}
        <g stroke={DIM} strokeWidth={1.2}>
          <path d={`M${X(Wm[0]) + 9} ${dy2} H${dx + 5}`} strokeOpacity={0.35} strokeDasharray="2 3" />
          <path d={`M${X(geo.committee[0]) + 12} ${dy1} H${dx + 5}`} strokeOpacity={0.35} strokeDasharray="2 3" />
          <path d={`M${dx} ${dy1} V${dy2} M${dx - 4} ${dy1} H${dx + 4} M${dx - 4} ${dy2} H${dx + 4}`} />
        </g>
        {pill(dx, (dy1 + dy2) / 2, m(beat))}

        <g fontSize={10} fill={TXT} style={font}>
          {/* with an upwind finish the offset mark is where the windward mark's name would go: the name goes above */}
          {Off
            ? <text x={X(Wm[0])} y={Z(Wm[1]) - 10} textAnchor="middle" {...halo}>{ru ? 'ВЕРХНИЙ ЗНАК' : 'WINDWARD MARK'}</text>
            : <text x={X(Wm[0]) - 11} y={Z(Wm[1]) + 3.5} textAnchor="end" {...halo}>{shape === 'trap' ? (ru ? 'ЗНАК 1' : 'MARK 1') : ru ? 'ВЕРХНИЙ ЗНАК' : 'WINDWARD MARK'}</text>}
          {Wg && <text x={X(Wg[0])} y={Z(Wg[1]) - 10} textAnchor="middle" {...halo}>{ru ? 'БОКОВОЙ ЗНАК' : 'WING MARK'}</text>}
          {M2 && <text x={X(M2[0]) - 9} y={Z(M2[1]) + 3.5} textAnchor="end" {...halo}>{ru ? 'ЗНАК 2' : 'MARK 2'}</text>}
          {Off && <text x={X(Off[0]) - 9} y={Z(Off[1]) + 3.5} textAnchor="end" {...halo}>{ru ? 'ЗНАК СМЕЩЕНИЯ' : 'OFFSET MARK'}</text>}
          {/* the trapezoid's gate is out at the left edge: its name goes under it */}
          {shape === 'trap'
            ? <text x={X(G[0])} y={Z(G[1]) + 16} textAnchor="middle" {...halo}>{ru ? `ВОРОТА ${m(gateW).toUpperCase()}` : `GATE ${m(gateW).toUpperCase()}`}</text>
            : <text x={X(geo.gate[0][0]) - 9} y={Z(geo.gate[0][1]) - 6} textAnchor="end" {...halo}>{ru ? `ВОРОТА ${m(gateW).toUpperCase()}` : `GATE ${m(gateW).toUpperCase()}`}</text>}
          {F && (shape === 'trap'
            ? <text x={X(Math.min(F[0][0], F[1][0])) + 1} y={Math.min(Z(F[0][1]), Z(F[1][1])) - 7} textAnchor="start" {...halo}>{ru ? 'ФИНИШ' : 'FINISH'}</text>
            : <text x={X(Math.max(F[0][0], F[1][0])) + 8} y={Z(Fm![1]) + 3.5} textAnchor="start" {...halo}>{ru ? 'ФИНИШ' : 'FINISH'}</text>)}
          <text x={X(M[0])} y={Z(M[1]) + (route ? 18 + boatL : 17)} textAnchor="middle" {...halo}>{F
            ? ru ? `СТАРТ ${m(lineLen).toUpperCase()}` : `START ${m(lineLen).toUpperCase()}`
            : ru ? `СТАРТ · ФИНИШ ${m(lineLen).toUpperCase()}` : `START · FINISH ${m(lineLen).toUpperCase()}`}</text>
          {/* the wind, top left */}
          <path d="M18 9 V27 M12 21 l6 7 6 -7" fill="none" stroke={TXT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <text x={30} y={22}>{ru ? `ВЕТЕР ${KN[preset]} УЗ` : `WIND ${KN[preset]} KN`}</text>
          {/* the scale, top right */}
          <path d={`M${W - 14 - bar * s} 13 v5 H${W - 14} v-5`} fill="none" stroke={TXT} strokeWidth={1.4} />
          <text x={W - 20 - bar * s} y={21} textAnchor="end">{m(bar).toUpperCase()}</text>
        </g>
      </g>
    </svg>
  );
}
