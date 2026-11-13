import type { Faq } from '@/lib/faq';

// A list of questions that open one at a time in place (details/summary, no script). Each has an id, so
// /faq#<id> links straight to it.
export function FaqList({ items, openFirst = false }: { items: Faq[]; openFirst?: boolean }) {
  return (
    <div className="hm-faq-list">
      {items.map((f, i) => (
        <details className="hm-faq-item" key={f.id} id={f.id} open={openFirst && i === 0}>
          <summary>{f.q}<svg className="hm-faq-ico" viewBox="0 0 20 20" width={18} height={18} aria-hidden="true"><path d="M10 3.5v13M3.5 10h13" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" /></svg></summary>
          <p className="hm-text">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
