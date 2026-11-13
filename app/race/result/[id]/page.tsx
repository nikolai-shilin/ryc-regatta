import type { Metadata } from 'next';
import { getT } from '@/lib/i18n';
import { pageMeta } from '@/lib/seo';
import { describe, getResult } from '@/lib/result';
import { getAccount } from '@/lib/supabase/server';
import ResultView from '@/components/result-view';
import { SiteHead, SiteFoot } from '@/components/site-chrome';

// A shared result link says the place and the time in its title and shows them on its card (app/og/result/[id]),
// so the link sells the race in a chat. Still kept out of search: one race of one player.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const [{ id }, { lang, t }] = await Promise.all([params, getT()]);
  const res = await getResult(id);
  const d = res && describe(res, lang);
  const meta = pageMeta(lang, {
    title: d ? `${d.headline} · ${d.kind}` : t('Race result', 'Результат гонки'),
    description: d ? `${d.detail}. ${d.call}: ${t('a free 3D sailing race in your browser.', 'бесплатная 3D-парусная гонка в браузере.')}` : undefined,
    index: false,
  });
  const card = { url: `/og/result/${encodeURIComponent(id)}${lang === 'ru' ? '?lang=ru' : ''}`, width: 1200, height: 630, alt: d ? `${d.headline} · ${d.detail}` : t('A race in the game', 'Гонка в игре') };
  return { ...meta, openGraph: { ...meta.openGraph, url: `/race/result/${id}${lang === 'ru' ? '?lang=ru' : ''}`, images: [card] }, twitter: { ...meta.twitter, images: [card] } };
}

// R1 · The result and debrief. The game keeps the race on this device and opens this page at the finish.
export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { lang, t }, account] = await Promise.all([params, getT(), getAccount()]);
  return (
    <ResultView id={id} lang={lang} signedName={account ? account.name || account.email : null}
      head={<SiteHead lang={lang} t={t} account={account} page="result" />}
      foot={<SiteFoot lang={lang} t={t} account={account} back={`/race/result/${id}`} />} />
  );
}
