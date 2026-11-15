import Link from 'next/link';
import type { Metadata } from 'next';
import { getT } from '@/lib/i18n';
import { ruPlural } from '@/lib/lang';
import { pageMeta } from '@/lib/seo';
import { VENUES } from '@/lib/venues';
import { readPassport } from '@/lib/passport-share';
import { BADGES } from '@/lib/badges';
import { BadgePennant } from '@/components/badge-pennant';
import { SiteHead, SiteFoot } from '@/components/site-chrome';

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

// /passport?s=5&v=12&b=4&vs=…&n=Anna — a player's passport as they shared it (lib/passport-share.ts): its card for the
// chat apps (app/og/passport), and for whoever opens it, the venues lit and the way to today's race. Not indexed.
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ lang, t }, sp] = await Promise.all([getT(params), searchParams]);
  const p = readPassport(sp);
  const title = p.n ? t(`${p.n}’s passport`, `Паспорт: ${p.n}`) : t('A sailor’s passport', 'Паспорт гонщика');
  const meta = pageMeta(lang, { title, description: t(`${p.v} of ${VENUES.length} venues raced${p.s >= 2 ? `, ${p.s} days in a row` : ''}. A free 3D sailing race in your browser, a new venue every day.`, `Пройдено ${p.v} из ${VENUES.length} акваторий${p.s >= 2 ? `, ${p.s} дней подряд` : ''}. Бесплатная 3D-парусная гонка в браузере, каждый день новая акватория.`), index: false });
  const qs = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === 'string' && ['s', 'v', 'b', 'vs', 'bb', 'n'].includes(k) ? [[k, v]] : [])));
  if (lang === 'ru') qs.set('lang', 'ru');
  const card = { url: `/og/passport?${qs}`, width: 1200, height: 630, alt: title };
  return { ...meta, openGraph: { ...meta.openGraph, images: [card] }, twitter: { ...meta.twitter, images: [card] } };
}

export default async function Passport({ params, searchParams }: Props) {
  const [{ lang, t }, sp] = await Promise.all([getT(params), searchParams]);
  const p = readPassport(sp), L = lang === 'ru' ? 1 : 0;
  return (
    <div className="scr help hp bc rt-scr" lang={lang}>
      <SiteHead lang={lang} t={t} page="home" />
      <header className="hm-page hm-ph rt-head">
        <span className="kicker">{p.n ? t(`${p.n}’s passport`, `Паспорт: ${p.n}`) : t('A sailor’s passport', 'Паспорт гонщика')}</span>
        <h1 className="hm-ph-h">{p.s >= 2 ? t(`${p.s} days in a row`, `${p.s} ${ruPlural(p.s, ['день', 'дня', 'дней'])} подряд`) : t(`${p.v} of ${VENUES.length} venues`, `${p.v} из ${VENUES.length} акваторий`)}</h1>
        <p className="hm-text">{t(`Every day the race moves to another of ${VENUES.length} famous regatta venues, the same race for everyone. ${p.v} raced so far${p.b ? `, ${p.b} ${p.b === 1 ? 'badge' : 'badges'} earned` : ''}. Can you get further?`, `Каждый день гонка переезжает на другую из ${VENUES.length} знаменитых регатных акваторий, и она у всех одна. Пройдено ${p.v}${p.b ? `, значков: ${p.b}` : ''}. Сможешь дальше?`)}</p>
        <div className="ho-acts"><a className="ho-go" href="/play?race=today">{t('Sail today’s race', 'Пройди гонку дня')}</a><Link className="lb-more" href="/">{t('What the game is', 'Что это за игра')}</Link></div>
      </header>
      <main className="hm-page rt">
        <ul className="ho-venues pg-pass">
          {VENUES.map((v, i) => <li key={v.id} className={p.raced[i] ? 'raced' : undefined}>{v.name[L]}</li>)}
        </ul>
        {p.got.some(Boolean) ? (
          <ul className="pg-pass-b" aria-label={t('Badges earned', 'Полученные значки')}>
            {BADGES.map((b, i) => <li key={b.id} title={t(...b.name)}><BadgePennant id={b.id} on={p.got[i]} /><span>{t(...b.name)}{p.got[i] ? '' : t(' (not yet)', ' (ещё нет)')}</span></li>)}
          </ul>
        ) : null}
      </main>
      <SiteFoot lang={lang} t={t} back="/" />
    </div>
  );
}
