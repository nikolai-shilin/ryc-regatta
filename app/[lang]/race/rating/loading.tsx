import { Sk, LoadBar } from '@/components/skeleton';

// The rating while its day is fetched: the page's own shape in grey, after a moment (a cached day shows at once)
export default function Loading() {
  return (
    <div className="scr help hp bc rt-scr" aria-busy="true">
      <LoadBar label="…" />
      <div className="sk-wait">
        <header className="hm-page hm-ph rt-head">
          <Sk w={140} h={24} />
          <Sk className="sk-h" w="min(620px, 80%)" />
          <Sk w="min(420px, 70%)" h={18} />
          <div className="rt-strip">{Array.from({ length: 10 }, (_, i) => <Sk key={i} w={52} h={56} />)}</div>
        </header>
        <main className="hm-page rt">
          <div className="rt-grid">
            {[8, 6].map((n, c) => (
              <section key={c} className="rt-card">
                <Sk w={160} h={12} />
                {Array.from({ length: n }, (_, i) => <Sk key={i} w="100%" h={48} style={{ opacity: 1 - i * 0.1 }} />)}
              </section>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
