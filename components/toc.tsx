'use client';
import { useEffect, useState } from 'react';

// A reading page's contents as a card beside the text on a wide screen (styles/broadcast.css: hidden on a narrower
// one, where the head's chips do the job), staying in view as the page scrolls and marking the section being read: the
// first one crossing the top part of the screen, under the header.
export function Toc({ items, label, numbered = false }: { items: [id: string, label: string][]; label: string; numbered?: boolean }) {
  const [on, setOn] = useState(items[0]?.[0]);
  const ids = items.map(([id]) => id).join(' ');
  useEffect(() => {
    const order = ids.split(' '), seen = new Set<string>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) { if (e.isIntersecting) seen.add(e.target.id); else seen.delete(e.target.id); }
      const first = order.find((id) => seen.has(id));
      if (first) setOn(first);
    }, { rootMargin: '-96px 0px -55% 0px' });
    for (const id of order) { const el = document.getElementById(id); if (el) io.observe(el); }
    return () => io.disconnect();
  }, [ids]);
  return (
    <nav className="rd-toc" aria-label={label}>
      <span className="lbl">{label}</span>
      {items.map(([id, l], i) => (
        <a key={id} href={`#${id}`} aria-current={on === id ? 'location' : undefined}>{numbered && <b>{i + 1}</b>}{l}</a>
      ))}
    </nav>
  );
}
