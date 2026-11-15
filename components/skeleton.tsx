import type { CSSProperties } from 'react';

// Placeholders while something loads, in the broadcast look: grey blocks with a sheen running over them (.sk), and a
// thin blue bar running along the top of the screen while a 3D scene comes up (.bc-load). A skeleton waits a moment
// before it shows (.sk-wait), so a page that loads at once never flashes one.
export const Sk = ({ w, h, style, className = '' }: { w?: number | string; h?: number | string; style?: CSSProperties; className?: string }) => (
  <i className={`sk ${className}`} aria-hidden="true" style={{ width: w, height: h, ...style }} />
);

export const LoadBar = ({ label, on = true }: { label: string; on?: boolean }) => (
  <div className={`bc-load ${on ? 'on' : ''}`} role="status" aria-live="polite">
    <span className="vh">{on ? label : ''}</span>
  </div>
);

// The result page while its race is fetched: its own layout, the heading, the four numbers, the results card
export function ResultSkeleton({ label }: { label: string }) {
  return (
    <div className="bt sk-wait" aria-busy="true">
      <div className="bt-info">
        <div className="bt-top"><Sk w={44} h={44} /><Sk w={260} h={24} /></div>
        <Sk className="sk-h" w="min(560px, 70%)" />
        <Sk w="min(520px, 82%)" h={18} />
        <div className="bt-stats">{[0, 1, 2, 3].map((i) => <div key={i}><Sk w={48} h={10} /><Sk w={72} h={28} /><Sk w={60} h={12} /></div>)}</div>
      </div>
      <section className="bt-card" aria-label={label}>
        <div className="bt-g">
          <Sk w={120} h={12} />
          {[0, 1, 2, 3, 4].map((i) => <Sk key={i} w="100%" h={44} style={{ opacity: 1 - i * 0.14 }} />)}
        </div>
      </section>
      <LoadBar label={label} />
    </div>
  );
}
