import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getT } from '@/lib/i18n';
import { pageMeta } from '@/lib/seo';
import { describe, getResult } from '@/lib/result';
import ResultView from '@/components/result-view';
import { SiteHead, SiteFoot } from '@/components/site-chrome';

// A shared result link says the place and the time in its title and shows them on its card (app/og/result/[id]),
// so the link sells the race in a chat. Still kept out of search: one race of one player.
export async function generateMetadata({ params }: { params: Promise<{ lang: string; id: string }> }): Promise<Metadata> {
  const [{ id }, { lang, t }] = await Promise.all([params, getT(params)]);
  const res = await getResult(id);
  const d = res && describe(res, lang);
  const meta = pageMeta(lang, {
    title: d ? `${d.headline} · ${d.kind}` : t('Race result', 'Результат гонки', 'Resultado de la regata', 'Regattaergebnis'),
    description: d ? `${d.detail}. ${d.call}: ${t('a free 3D sailing race in your browser.', 'бесплатная 3D-парусная гонка в браузере.', 'una regata 3D gratuita en tu navegador.', 'eine kostenlose 3D-Segelregatta in deinem Browser.')}` : undefined,
    index: false,
  });
  const card = { url: `/og/result/${encodeURIComponent(id)}${lang === 'en' ? '' : `?lang=${lang}`}`, width: 1200, height: 630, alt: d ? `${d.headline} · ${d.detail}` : t('A race in the game', 'Гонка в игре', 'Una regata en el juego', 'Eine Regatta im Spiel') };
  return { ...meta, openGraph: { ...meta.openGraph, url: `/race/result/${id}${lang === 'en' ? '' : `?lang=${lang}`}`, images: [card] }, twitter: { ...meta.twitter, images: [card] } };
}

// R1 · The result and debrief, as the broadcast lays it out: the finish as it was behind the result and the full table
// (the game's own scene at the race's venue, every boat where she was as you crossed the line), then, as the page
// scrolls on, the debrief, the track and the legs, today's ranking and your best. The game keeps the race on this
// device and opens this page at the finish. The site's header and footer are only for a race that can't be found.
export default async function ResultPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  // rendered on each visit, not cached as a page: a race not online yet must not keep the plain title once it is (its
  // record, once found, is cached: lib/result.ts). Who is signed in is the browser's to say (ResultView, useWho).
  await connection();
  const [{ id }, { lang, t }] = await Promise.all([params, getT(params)]);
  return (
    <ResultView id={id} lang={lang}
      head={<SiteHead lang={lang} t={t} page="result" />}
      foot={<SiteFoot lang={lang} t={t} back={`/race/result/${id}`} />} />
  );
}
