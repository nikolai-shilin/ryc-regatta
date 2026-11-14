import type { Metadata } from 'next';
import { getT } from '@/lib/i18n';
import { pageMeta } from '@/lib/seo';
import { describe, getResult } from '@/lib/result';
import { getAccount, initials } from '@/lib/supabase/server';
import ResultView from '@/components/result-view';
import { SiteHead, SiteFoot } from '@/components/site-chrome';

// A shared result link says the place and the time in its title and shows them on its card (app/og/result/[id]),
// so the link sells the race in a chat. Still kept out of search: one race of one player.
export async function generateMetadata({ params }: { params: Promise<{ lang: string; id: string }> }): Promise<Metadata> {
  const [{ id }, { lang, t }] = await Promise.all([params, getT(params)]);
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

// R1 · The result and debrief, as the race's pause screen: the finish as it was behind it all (the game's own scene at
// the race's venue, every boat where she was as you crossed the line), the result over it, and the debrief in the pause
// menu's glass card. The game keeps the race on this device and opens this page at the finish. The site's header and
// footer are only for a race that can't be found.
export default async function ResultPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const [{ id }, { lang, t }, account] = await Promise.all([params, getT(params), getAccount()]);
  const who = account ? { name: account.name, email: account.email, initials: initials(account.name, account.email), via: account.provider === 'google' ? 'Google' : account.provider === 'telegram' ? 'Telegram' : t('email code', 'код по почте') } : null;
  return (
    <ResultView id={id} lang={lang} signedName={account ? account.name || account.email : null} who={who}
      head={<SiteHead lang={lang} t={t} page="result" />}
      foot={<SiteFoot lang={lang} t={t} back={`/race/result/${id}`} />} />
  );
}
