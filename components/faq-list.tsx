import type { Faq } from '@/lib/faq';

// A list of questions. Folded (the home page's short list): each opens in place (details/summary, no script). Open
// (the questions page): every answer shows, under its question as a heading, so the page reads and searches as a
// whole. Each has an id either way, so /faq#<id> links straight to it.
export function FaqList({ items, openFirst = false, open = false }: { items: Faq[]; openFirst?: boolean; open?: boolean }) {
  if (open) return (
    <div className="hm-faq-list hm-faq-open">
      {items.map((f) => (
        <div className="hm-faq-item" key={f.id} id={f.id}>
          <h3 className="hm-faq-q">{f.q}</h3>
          <p className="hm-text">{f.a}</p>
        </div>
      ))}
    </div>
  );
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
