import type { CSSProperties, ReactNode } from 'react';
import { famOf, type BadgeFam, type BadgeId } from '@/lib/badges';

// A badge as a pennant: its family's colour (gold a result, blue a skill, green the season) in a gradient, the right
// half shaded, a keyline inset, and its picture in ink. Not yet earned, the same pennant dark with its picture faint.
// No hooks and no stylesheet: the share card (app/og/passport) draws it too, where only the SVG's own attributes count.
export const FAM_COLOUR: Record<BadgeFam, string> = { result: '#f5c400', skill: '#3db8ff', season: '#2ee6a0' };
const TONES: Record<BadgeFam | 'off', [string, string, string]> = {
  result: ['#ffe476', '#f5c400', '#c99400'],
  skill: ['#9adcff', '#3db8ff', '#1785cf'],
  season: ['#8ff5cc', '#2ee6a0', '#14b57a'],
  off: ['#1c2738', '#16202f', '#111a27'],
};

// each picture on the 120 × 132 pennant, its field centred at 60,58; c the ink, h the pennant's own colour (a hole)
const ART: Record<BadgeId, (c: string, h: string) => ReactNode> = {
  // a chequered flag
  first: (c) => <><path d="M39 30v58" stroke={c} strokeWidth={6} /><path d="M42 30h40v30H42z" fill="none" stroke={c} strokeWidth={4} /><path d="M42 30h10v10H42zM62 30h10v10H62zM52 40h10v10H52zM72 40h10v10H72zM42 50h10v10H42zM62 50h10v10H62z" fill={c} /></>,
  // a tick in a ring
  clean: (c) => <><circle cx={60} cy={58} r={29} fill="none" stroke={c} strokeWidth={5} /><path d="M45 58l10 10 20-21" fill="none" stroke={c} strokeWidth={9} /></>,
  // a stopwatch
  gun: (c) => <><circle cx={60} cy={62} r={25} fill="none" stroke={c} strokeWidth={6} /><path d="M53 27h14v8H53zM79 35l6 6-4 4-6-6z" fill={c} /><path d="M60 62V46" stroke={c} strokeWidth={5} /><circle cx={60} cy={62} r={4.5} fill={c} /><path d="M60 41v4M81 62h-4M60 83v-4M39 62h4" stroke={c} strokeWidth={3} /></>,
  // a zigzag up the beat, tacking on the shifts
  shifts: (c) => <><path d="M34 84l16-24 14 10 14-24" fill="none" stroke={c} strokeWidth={7} /><path d="M70 40l17-9-1 19z" fill={c} /><path d="M80 66h10M80 76h14M80 86h8" stroke={c} strokeWidth={3} strokeOpacity={0.7} /></>,
  // a speed gauge
  speed: (c) => <><path d="M31 70a29 29 0 0 1 58 0" fill="none" stroke={c} strokeWidth={6} /><path d="M36 54l5 3M50 43l2 5M70 43l-2 5M84 54l-5 3" stroke={c} strokeWidth={3} /><path d="M60 70l18-20" stroke={c} strokeWidth={5} /><circle cx={60} cy={70} r={6} fill={c} /><path d="M38 82h44" stroke={c} strokeWidth={4} /></>,
  // a podium with a star
  podium: (c) => <path d="M50 50h20v36H50zM31 62h18v24H31zM71 70h18v16H71zM60 26l3.5 7 7.5 1-5.5 5 1.5 7.5L60 43l-7 3.5L54.5 39 49 34l7.5-1z" fill={c} />,
  // a trophy
  win: (c) => <><path d="M43 30h34v16c0 11-7.5 19-17 19s-17-8-17-19z" fill={c} /><path d="M43 36h-8c0 10 4 15 10 15M77 36h8c0 10-4 15-10 15" fill="none" stroke={c} strokeWidth={4} /><path d="M56 64h8v11h-8zM45 75h30v8H45z" fill={c} /></>,
  // two chevrons up, the lower fainter
  comeback: (c) => <><path d="M38 82l22-20 22 20" fill="none" stroke={c} strokeWidth={8} strokeOpacity={0.55} /><path d="M38 62l22-20 22 20" fill="none" stroke={c} strokeWidth={8} /></>,
  // a 7 over a wave
  streak7: (c) => <><path d="M42 30h36v9L62 78H50l16-37H42z" fill={c} /><path d="M32 88c7-6 11-6 14 0s7 6 14 0 11-6 14 0 7 6 14 0" fill="none" stroke={c} strokeWidth={4} /></>,
  // a compass rose
  venues7: (c, h) => <><circle cx={60} cy={58} r={27} fill="none" stroke={c} strokeWidth={4} /><path d="M60 26l7 25 25 7-25 7-7 25-7-25-25-7 25-7z" fill={c} /><circle cx={60} cy={58} r={4} fill={h} /></>,
  // a globe
  venues28: (c) => <><circle cx={60} cy={58} r={28} fill="none" stroke={c} strokeWidth={5} /><ellipse cx={60} cy={58} rx={12} ry={28} fill="none" stroke={c} strokeWidth={4} /><path d="M32 58h56M36 44h48M36 72h48" stroke={c} strokeWidth={3.5} /></>,
  // three stars, a drill's best
  drills: (c) => <path d="M60 26l5.5 11.5 12.5 1.7-9.1 8.8 2.2 12.5L60 54.5l-11.1 6 2.2-12.5-9.1-8.8 12.5-1.7zM36 58l4 8.4 9.2 1.3-6.6 6.4 1.6 9.1L36 78.8l-8.2 4.4 1.6-9.1-6.6-6.4 9.2-1.3zM84 58l4 8.4 9.2 1.3-6.6 6.4 1.6 9.1L84 78.8l-8.2 4.4 1.6-9.1-6.6-6.4 9.2-1.3z" fill={c} />,
};

type Props = { id: BadgeId; on: boolean; fam?: BadgeFam; width?: number; height?: number; className?: string; style?: CSSProperties };
export function BadgePennant({ id, on, fam = famOf(id), width, height, className, style }: Props) {
  const [a, b, c] = TONES[on ? fam : 'off'], g = `bp-${id}-${on ? fam : 'off'}`;
  return (
    <svg viewBox="0 0 120 132" width={width} height={height} className={className} style={style} aria-hidden="true">
      <defs><linearGradient id={g} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={a} /><stop offset="0.55" stopColor={b} /><stop offset="1" stopColor={c} /></linearGradient></defs>
      <path d="M8 4h104v88l-52 36L8 92z" fill={`url(#${g})`} />
      <path d="M60 4h52v88l-52 36z" fill="#000000" fillOpacity={on ? 0.12 : 0.18} />
      <path d="M8 4h104v6H8z" fill="#ffffff" fillOpacity={on ? 0.35 : 0.05} />
      <path d="M18 16h84v70l-42 29-42-29z" fill="none" stroke={on ? '#04121e' : '#ffffff'} strokeOpacity={on ? 0.28 : 0.09} strokeWidth={2} />
      <g opacity={on ? 1 : 0.26}>{ART[id](on ? '#04121e' : '#ffffff', b)}</g>
    </svg>
  );
}
