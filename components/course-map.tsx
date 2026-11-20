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

const HULL = 10.45, ZONE = 3 * HULL; // the JPK 1050's length: the zone is three of them
// drawn as the race's own course map draws (public/game/course-map.js, main.js drawMap): the broadcast's tokens, with the
// values they have there for where a page doesn't give them
const GROUND = '#070d16', BUOY = '#ff7a1a', YOU = '#3db8ff', GOLD = '#f5c400', LAY = 'rgba(255,212,0,0.6)', LIVE = '#ff3b30', INK_ON = '#04121e';
// every line of the course in one dash, as on the water and the race's map (LINE_DASH): the start and finish lines gold,
// the laylines yellow, the distance lines and the zones white
const DASH = '4 4';
const w = (a: number) => `rgba(255,255,255,${a})`;
const font = { fontFamily: "var(--cond, 'Sofia Sans Condensed'), 'Arial Narrow', sans-serif", fontWeight: 600, letterSpacing: '1.2px' } as const;

export function CourseMap({ lang, geo, preset, W, H, className, route, fleet, tracks, fouls }: Props) {
  const ru = lang === 'ru', es = lang === 'es', de = lang === 'de', tr = lang === 'tr', fr = lang === 'fr', id = useId().replace(/[^a-zA-Z0-9]/g, '');
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
  const halo = { stroke: GROUND, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' } as const;
  // a boat as the race's map draws her: a small arrowhead, pointing where she heads (here up the beat)
  const boat = (k: number) => `M0 ${-6 * k} L${3.5 * k} ${5 * k} L${-3.5 * k} ${5 * k}Z`;
  const boatL = 11, n = fleet || 0;
  const chip = (x: number, y: number, text: string) => {
    const cw = text.length * 6 + 12;
    return (
      <g>
        <rect x={x - cw / 2} y={y - 9} width={cw} height={18} fill={GROUND} stroke={w(0.25)} />
        <text x={x} y={y + 3.8} textAnchor="middle" fontSize={11} fill={w(0.9)} style={{ ...font, fontWeight: 700 }}>{text}</text>
      </g>
    );
  };
  // the laylines to the windward mark, for the course's wind: yellow, down to the start line
  const lay = (M[1] - Wm[1]) / Math.cos(a);
  const label = ru
    ? `Дистанция сверху, в масштабе: лавировка ${m(beat)}, стартовая линия ${m(lineLen)}, ворота ${m(gateW)}`
    : es ? `El recorrido visto desde arriba, a escala: una ceñida de ${m(beat)}, una línea de salida de ${m(lineLen)} y una puerta de ${m(gateW)}`
    : de ? `Die Bahn von oben, maßstabsgetreu: eine Kreuz von ${m(beat)}, eine Startlinie von ${m(lineLen)}, ein Tor von ${m(gateW)}`
    : tr ? `Parkur yukarıdan, ölçekli: ${m(beat)} orsa ayağı, ${m(lineLen)} start hattı, ${m(gateW)} kapı`
    : fr ? `Le parcours vu de haut, à l’échelle : un bord de près de ${m(beat)}, une ligne de départ de ${m(lineLen)} et une porte de ${m(gateW)}`
    : `The course from above, to scale: a ${m(beat)} beat, a ${m(lineLen)} start line, a ${m(gateW)} gate`;

  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <defs>
        {/* the broadcast's grid over the map, every 25 px */}
        <pattern id={`gr${id}`} width={25} height={25} patternUnits="userSpaceOnUse">
          <path d="M25 0 V25 M0 25 H25" fill="none" stroke={w(0.06)} strokeWidth={1} />
        </pattern>
        <clipPath id={`cl${id}`}><rect width={W} height={H} /></clipPath>
      </defs>
      <g clipPath={`url(#cl${id})`}>
        <rect width={W} height={H} fill={GROUND} />
        <rect width={W} height={H} fill={`url(#gr${id})`} />

        <g stroke={LAY} strokeWidth={1.5} strokeDasharray={DASH}>
          {[-1, 1].map((sd) => <path key={sd} d={`M${X(Wm[0])} ${Z(Wm[1])} L${X(Wm[0] + sd * lay * Math.sin(a))} ${Z(Wm[1] + lay * Math.cos(a))}`} />)}
        </g>
        {ladder.map((d) => {
          const z = Wm[1] + d, hw = Math.min(260, 30 + d * 0.95);
          return <path key={d} d={`M${X(Wm[0] - hw)} ${Z(z)} H${X(Wm[0] + hw)}`} stroke={w(0.25)} strokeWidth={1} strokeDasharray={DASH} />;
        })}
        {/* the zones where mark-room counts (rule 18): the gate and the marks reached off the wind, none at the
            windward mark (a beat) or a finish line */}
        {[...geo.gate, ...[Wg, M2, Off].filter((p): p is XZ => !!p)].map((p, i) => <circle key={i} cx={X(p[0])} cy={Z(p[1])} r={ZONE * s} fill="none" stroke={w(0.25)} strokeDasharray={DASH} />)}

        {route && (
          <g fill="none" stroke={YOU} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round">
            <path d={`M${X(M[0])} ${Z(M[1])} L${X(corner[0])} ${Z(corner[1])} L${X(Wm[0])} ${Z(Wm[1])}`} />
            {shape === 'trap' && M2 && Fm
              ? <path d={`M${X(Wm[0]) - 6} ${Z(Wm[1]) + 3} L${X(M2[0]) + 5} ${Z(M2[1]) - 2} L${X(G[0]) + 4} ${Z(G[1]) - 5} L${X(Fm[0]) - 4} ${Z(Fm[1])}`} strokeOpacity={0.6} strokeDasharray="4 5" />
              : shape === 'wlu' && Off && corner2 && Fm
                ? <>
                  <path d={`M${X(Wm[0]) - 6} ${Z(Wm[1]) + 2} L${X(Off[0]) + 5} ${Z(Off[1])} L${X(G[0]) - 3} ${Z(G[1]) - 6}`} strokeOpacity={0.6} strokeDasharray="4 5" />
                  <path d={`M${X(G[0]) + 3} ${Z(G[1]) - 6} L${X(corner2[0])} ${Z(corner2[1])} L${X(Fm[0])} ${Z(Fm[1]) + 3}`} />
                </>
                : Wg
                  ? <path d={`M${X(Wm[0]) - 6} ${Z(Wm[1]) + 3} L${X(Wg[0]) + 6} ${Z(Wg[1]) - 3} L${X(M[0]) - 4} ${Z(M[1]) - 6}`} strokeOpacity={0.6} strokeDasharray="4 5" />
                  : <path d={`M${X(Wm[0]) + 4} ${Z(Wm[1]) + 8} L${X(M[0]) + 4} ${Z(M[1]) - 6}`} strokeOpacity={0.6} strokeDasharray="4 5" />}
          </g>
        )}
        {(tracks || []).filter((t) => !t.me).map((t, i) => <path key={i} d={path(t.pts)} fill="none" stroke={w(0.25)} strokeWidth={1.2} strokeLinejoin="round" />)}
        {(tracks || []).filter((t) => t.me).map((t, i) => <path key={i} d={path(t.pts)} fill="none" stroke={YOU} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}

        {/* the start line, and a finish line of its own, in the broadcast's gold */}
        <g stroke={GOLD} strokeWidth={2} strokeDasharray={DASH}>
          <path d={`M${X(geo.pin[0])} ${Z(geo.pin[1])} L${X(geo.committee[0])} ${Z(geo.committee[1])}`} />
          {F && <path d={`M${X(F[0][0])} ${Z(F[0][1])} L${X(F[1][0])} ${Z(F[1][1])}`} />}
        </g>
        {[...Object.values(marks), ...geo.gate, geo.pin, geo.committee, ...(F || [])].map((p, i) => <circle key={i} cx={X(p[0])} cy={Z(p[1])} r={4} fill={BUOY} />)}
        {Array.from({ length: n }, (_, i) => {
          const f = n > 1 ? 0.18 + (0.64 * i) / (n - 1) : 0.5, x = X(geo.pin[0] + (geo.committee[0] - geo.pin[0]) * f), y = Z(M[1]) + 4 + boatL / 2;
          const you = i === Math.floor(n / 2);
          return <path key={i} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} d={boat(you ? 1.3 : 1)} fill={you ? YOU : w(0.62)} {...(you && { stroke: INK_ON, strokeWidth: 2, strokeLinejoin: 'round' as const, paintOrder: 'stroke' })} />;
        })}
        {(fouls || []).map((f, i) => <circle key={i} cx={X(f[0])} cy={Z(f[1])} r={7} fill="none" stroke={LIVE} strokeWidth={2} />)}

        {/* the beat's length */}
        <g stroke={w(0.35)} strokeWidth={1}>
          <path d={`M${X(Wm[0]) + 9} ${dy2} H${dx + 5}`} strokeDasharray="2 3" />
          <path d={`M${X(geo.committee[0]) + 9} ${dy1} H${dx + 5}`} strokeDasharray="2 3" />
          <path d={`M${dx} ${dy1} V${dy2} M${dx - 4} ${dy1} H${dx + 4} M${dx - 4} ${dy2} H${dx + 4}`} stroke={w(0.62)} />
        </g>
        {chip(dx, (dy1 + dy2) / 2, m(beat).toUpperCase())}

        <g fontSize={10.5} fill={w(0.78)} style={font}>
          {/* with an upwind finish the offset mark is where the windward mark's name would go: the name goes above */}
          {Off
            ? <text x={X(Wm[0])} y={Z(Wm[1]) - 10} textAnchor="middle" {...halo}>{ru ? 'ВЕРХНИЙ ЗНАК' : es ? 'BALIZA DE BARLOVENTO' : de ? 'LUVTONNE' : tr ? 'RÜZGÂRÜSTÜ ŞAMANDIRASI' : fr ? 'BOUÉE AU VENT' : 'WINDWARD MARK'}</text>
            : <text x={X(Wm[0]) - 10} y={Z(Wm[1]) + 3.5} textAnchor="end" {...halo}>{shape === 'trap' ? (ru ? 'ЗНАК 1' : es ? 'BALIZA 1' : de ? 'TONNE 1' : tr ? 'ŞAMANDIRA 1' : fr ? 'BOUÉE 1' : 'MARK 1') : ru ? 'ВЕРХНИЙ ЗНАК' : es ? 'BALIZA DE BARLOVENTO' : de ? 'LUVTONNE' : tr ? 'RÜZGÂRÜSTÜ ŞAMANDIRASI' : fr ? 'BOUÉE AU VENT' : 'WINDWARD MARK'}</text>}
          {Wg && <text x={X(Wg[0])} y={Z(Wg[1]) - 10} textAnchor="middle" {...halo}>{ru ? 'БОКОВОЙ ЗНАК' : es ? 'BALIZA DE TRAVÉS' : de ? 'RAUMTONNE' : tr ? 'KANAT ŞAMANDIRASI' : fr ? 'BOUÉE DE LARGUE' : 'WING MARK'}</text>}
          {M2 && <text x={X(M2[0]) - 9} y={Z(M2[1]) + 3.5} textAnchor="end" {...halo}>{ru ? 'ЗНАК 2' : es ? 'BALIZA 2' : de ? 'TONNE 2' : tr ? 'ŞAMANDIRA 2' : fr ? 'BOUÉE 2' : 'MARK 2'}</text>}
          {Off && <text x={X(Off[0]) - 9} y={Z(Off[1]) + 3.5} textAnchor="end" {...halo}>{ru ? 'ОТБОЙНИК' : es ? 'BALIZA DE DESMARQUE' : de ? 'ABLAUFTONNE' : tr ? 'OFSET ŞAMANDIRASI' : fr ? 'DÉGAGEMENT' : 'OFFSET MARK'}</text>}
          {/* the trapezoid's gate is out at the left edge: its name goes under it */}
          {shape === 'trap'
            ? <text x={X(G[0])} y={Z(G[1]) + 16} textAnchor="middle" {...halo}>{ru ? `ВОРОТА ${m(gateW).toUpperCase()}` : es ? `PUERTA ${m(gateW).toUpperCase()}` : de ? `TOR ${m(gateW).toUpperCase()}` : tr ? `KAPI ${m(gateW).toUpperCase()}` : fr ? `PORTE ${m(gateW).toUpperCase()}` : `GATE ${m(gateW).toUpperCase()}`}</text>
            : <text x={X(geo.gate[0][0]) - 9} y={Z(geo.gate[0][1]) - 6} textAnchor="end" {...halo}>{ru ? `ВОРОТА ${m(gateW).toUpperCase()}` : es ? `PUERTA ${m(gateW).toUpperCase()}` : de ? `TOR ${m(gateW).toUpperCase()}` : tr ? `KAPI ${m(gateW).toUpperCase()}` : fr ? `PORTE ${m(gateW).toUpperCase()}` : `GATE ${m(gateW).toUpperCase()}`}</text>}
          {F && (shape === 'trap'
            ? <text x={X(Math.min(F[0][0], F[1][0])) + 1} y={Math.min(Z(F[0][1]), Z(F[1][1])) - 7} textAnchor="start" {...halo}>{ru ? 'ФИНИШ' : es ? 'LLEGADA' : de ? 'ZIEL' : tr ? 'BİTİŞ' : fr ? 'ARRIVÉE' : 'FINISH'}</text>
            : <text x={X(Math.max(F[0][0], F[1][0])) + 8} y={Z(Fm![1]) + 3.5} textAnchor="start" {...halo}>{ru ? 'ФИНИШ' : es ? 'LLEGADA' : de ? 'ZIEL' : tr ? 'BİTİŞ' : fr ? 'ARRIVÉE' : 'FINISH'}</text>)}
          <text x={X(M[0])} y={Z(M[1]) + (route ? 18 + boatL : 17)} textAnchor="middle" fill={GOLD} {...halo}>{F
            ? ru ? `СТАРТ ${m(lineLen).toUpperCase()}` : es ? `SALIDA ${m(lineLen).toUpperCase()}` : de ? `START ${m(lineLen).toUpperCase()}` : tr ? `START ${m(lineLen).toUpperCase()}` : fr ? `DÉPART ${m(lineLen).toUpperCase()}` : `START ${m(lineLen).toUpperCase()}`
            : ru ? `СТАРТ · ФИНИШ ${m(lineLen).toUpperCase()}` : es ? `SALIDA · LLEGADA ${m(lineLen).toUpperCase()}` : de ? `START · ZIEL ${m(lineLen).toUpperCase()}` : tr ? `START · BİTİŞ ${m(lineLen).toUpperCase()}` : fr ? `DÉPART · ARRIVÉE ${m(lineLen).toUpperCase()}` : `START · FINISH ${m(lineLen).toUpperCase()}`}</text>
        </g>
        <g fontSize={10.5} fill={w(0.62)} style={font}>
          {/* the wind, top left, in your blue as the race's map has it: blowing down the map */}
          <path d="M16 30 L21 21 H17.5 V10 H14.5 V21 H11 Z" fill={YOU} />
          <text x={28} y={23}>{ru ? `ВЕТЕР ${KN[preset]} УЗ` : es ? `VIENTO ${KN[preset]} KN` : de ? `WIND ${KN[preset]} KN` : tr ? `RÜZGÂR ${KN[preset]} KN` : fr ? `VENT ${KN[preset]} NŒUDS` : `WIND ${KN[preset]} KN`}</text>
          {/* the scale, top right */}
          <path d={`M${W - 14 - bar * s} 13 v5 H${W - 14} v-5`} fill="none" stroke={w(0.62)} strokeWidth={1.4} />
          <text x={W - 20 - bar * s} y={21} textAnchor="end">{m(bar).toUpperCase()}</text>
        </g>
      </g>
    </svg>
  );
}
