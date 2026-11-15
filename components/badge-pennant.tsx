import type { CSSProperties } from 'react';
import { famOf, type BadgeFam, type BadgeId } from '@/lib/badges';

// A badge as the race's HUD draws its blocks (public/game/hud-bc.js): a dark plate with its corner cut, its family's
// colour (gold a result, blue a skill, green the season) as the bar down its left, the picture in ink on a chip of
// that colour, and under it a bar, full once earned. Not yet earned, the same plate grey with its picture faint. Flat,
// as the HUD is. No hooks and no stylesheet: the share card (app/og/passport) draws it too, where only the SVG's own
// attributes count.
export const FAM_COLOUR: Record<BadgeFam, string> = { result: '#f5c400', skill: '#3db8ff', season: '#2ee6a0' };
const PLATE = '#111c2b', CHIP_OFF = '#1a2535', INK_ON = '#04121e';

// Each picture as an icon of the set the other RYC apps draw (IYT Test's, Ocean Way's): a 24 × 24 grid, the content
// inside 2..22, one 2 px line with round caps and joins, at most one solid shape (f), and what is cut out of it in the
// chip's colour (h a line, hf a shape). Drawn at 2.6×, centred on the chip (62, 55).
const ring = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const ART: Record<BadgeId, { l?: string; f?: string; h?: string; hf?: string }> = {
  // a chequered flag: the pole, the flag, its squares cut out
  first: { l: 'M6 21V3.5', f: 'M6 4h13v9H6z', hf: 'M10.33 4h4.34v4.5h-4.34zM6 8.5h4.33V13H6zM14.67 8.5H19V13h-4.33z' },
  // a shield, a tick cut out of it: no fouls, no penalties
  clean: { f: 'M12 3l7 2.8V11c0 4.6-2.9 8.3-7 10-4.1-1.7-7-5.4-7-10V5.8z', h: 'M8.6 12.2l2.4 2.4 4.6-4.8' },
  // a stopwatch, its first seconds after the gun filled
  gun: { l: `${ring(12, 13.5, 7.5)}M10 2.5h4M12 2.5V6M18.5 6.5L20 5`, f: 'M12 13.5V6A7.5 7.5 0 0 1 15.75 7z' },
  // the beat in tacks, headed up the last, and the wind's lines
  shifts: { l: 'M4 20l5-6 4 3 5-8M15.5 16.5h5M17.5 20.5h3', f: 'M19.3 6.9L19.6 10.6 15.8 8.2z' },
  // the sail full, its telltales streaming, the boat's speed behind it
  speed: { l: 'M12 2.5v17.5M5 20h16M3 9h5M4 12.5h5M6 16h3', f: 'M12 4c5 3.5 7.5 8.5 7.5 14H12z', h: 'M14 10h3M14 14h4' },
  // the podium, a star over its top step
  podium: { l: 'M12.00 2.40L12.95 4.69 15.42 4.89 13.54 6.50 14.12 8.91 12.00 7.62 9.88 8.91 10.46 6.50 8.58 4.89 11.05 4.69z', f: 'M3 21v-5h6v-4h6v6h6v3z' },
  // a trophy
  win: { l: 'M8 21h8M12 14v7M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3', f: 'M7 4h10v5a5 5 0 0 1-10 0z' },
  // the way turned back up and ahead
  comeback: { l: 'M6 21v-6a6 6 0 0 1 6-6h4', f: 'M15.5 5l5 4-5 4z' },
  // a week's calendar, a 7 on it
  streak7: { l: 'M4 6h16v15H4zM8 3v4M16 3v4M9.5 13h5l-3 5.5', f: 'M4 6h16v4H4z' },
  // a compass, its needle
  venues7: { l: `${ring(12, 12, 9)}M12 3v2M12 19v2M3 12h2M19 12h2`, f: 'M15.5 8.5l-2 5-5 2 2-5z' },
  // a globe, the way round it
  venues28: { l: `${ring(12, 12, 9)}M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18`, f: 'M15.5 9.8L19 12l-3.5 2.2z' },
  // three stars, a drill's best: the middle one solid
  drills: { l: 'M5.60 13.40L6.50 15.56 8.83 15.75 7.06 17.27 7.60 19.55 5.60 18.33 3.60 19.55 4.14 17.27 2.37 15.75 4.70 15.56zM18.40 13.40L19.30 15.56 21.63 15.75 19.86 17.27 20.40 19.55 18.40 18.33 16.40 19.55 16.94 17.27 15.17 15.75 17.50 15.56z', f: 'M12.00 3.20L13.27 6.25 16.57 6.52 14.05 8.67 14.82 11.88 12.00 10.16 9.18 11.88 9.95 8.67 7.43 6.52 10.73 6.25z' },
};

type Props = { id: BadgeId; on: boolean; fam?: BadgeFam; width?: number; height?: number; className?: string; style?: CSSProperties };
export function BadgePennant({ id, on, fam = famOf(id), width, height, className, style }: Props) {
  const c = on ? FAM_COLOUR[fam] : '#2a3546', chip = on ? FAM_COLOUR[fam] : CHIP_OFF, ink = on ? INK_ON : '#ffffff', art = ART[id];
  return (
    <svg viewBox="0 0 120 132" width={width} height={height} className={className} style={style} aria-hidden="true">
      <path d="M2 2h116v112l-16 16H2z" fill={PLATE} stroke="#ffffff" strokeOpacity={0.1} strokeWidth={1.5} />
      <path d="M2 2h7v128H2z" fill={c} />
      <path d="M22 16h80v78H22z" fill={chip} stroke={on ? 'none' : '#ffffff'} strokeOpacity={0.12} strokeWidth={1.5} />
      <g opacity={on ? 1 : 0.38} transform="translate(30.8 23.8) scale(2.6)" fill="none" stroke={ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {art.f ? <path d={art.f} fill={ink} /> : null}
        {art.l ? <path d={art.l} /> : null}
        {art.h ? <path d={art.h} stroke={chip} /> : null}
        {art.hf ? <path d={art.hf} fill={chip} stroke="none" /> : null}
      </g>
      <path d="M22 106h80v6H22z" fill="#ffffff" fillOpacity={0.12} />
      {on ? <path d="M22 106h80v6H22z" fill={c} /> : null}
    </svg>
  );
}
