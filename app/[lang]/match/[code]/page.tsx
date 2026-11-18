import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getT, type LangParams } from '@/lib/i18n';
import { pageMeta } from '@/lib/seo';
import { parseCode } from '@/lib/code';
import { BackLink } from '@/components/back-link';
import { SceneBrand } from '@/components/scene-brand';
import { IconPlay } from '@/components/ui';

// The page a 1-on-1 race's link opens: /match/K7M2QZ?v=cowes&b=jpk1050. A tap on Join (the tap lets the game start its sound)
// opens the game at the race, in the host's venue and on the boat he picked. Never indexed.

// the share card names the race's code, venue and boat, and lays the course she'll sail (app/og/page/[key], match)
export async function generateMetadata({ params, searchParams }: LangParams & { params: Promise<{ lang: string; code: string }>; searchParams: Promise<{ v?: string | string[]; b?: string | string[] }> }): Promise<Metadata> {
  const [{ lang, t }, { code: raw }, sp] = await Promise.all([getT(params), params, searchParams]);
  const one = (x?: string | string[]) => { const s = Array.isArray(x) ? x[0] : x; return s && /^[a-z0-9_-]{1,32}$/i.test(s) ? s : ''; };
  const code = parseCode(raw), v = one(sp.v), b = one(sp.b);
  const card = `/og/page/match?${new URLSearchParams({ ...(code && { c: code }), ...(v && { v }), ...(b && { b }) })}`;
  return pageMeta(lang, { title: t('Race me: a 1-on-1 race', 'Сыграем: гонка 1 на 1'), description: t('You and a friend, one on one: join the race.', 'Вы и друг, один на один: войдите в гонку.'), index: false, card });
}

export default async function MatchPage({ params, searchParams }: LangParams & { params: Promise<{ lang: string; code: string }>; searchParams: Promise<{ v?: string | string[]; b?: string | string[] }> }) {
  const [{ lang, t }, { code: raw }, sp] = await Promise.all([getT(params), params, searchParams]);
  const code = parseCode(raw);
  if (!code) notFound();
  // the host's venue and boat, as ids in the address (the game's own reload settles a mismatch)
  const one = (x?: string | string[]) => { const s = Array.isArray(x) ? x[0] : x; return s && /^[a-z0-9_-]{1,32}$/i.test(s) ? s : ''; };
  const v = one(sp.v), b = one(sp.b);
  const href = `/play?match=${code}${v ? `&venue=${v}` : ''}${b ? `&boat=${b}` : ''}`;
  return (
    <div className="scr bt-scr bc" lang={lang}>
      <div className="bt">
        <div className="bt-info">
          <div className="bt-top">
            <BackLink href="/race" label={t('Back to the race hub', 'Назад в меню гонок')} />
            <SceneBrand />
          </div>
          <span className="bt-kick bt-kick-w">{t('1-on-1 race', 'Гонка 1 на 1')}</span>
          <h1 className="bt-h" id="match-title">{t('Race me', 'Сыграем')}</h1>
          <p className="bt-p">{t('You and a friend, one on one.', 'Вы и друг, один на один.')}</p>
          <div className="bt-stats">
            <div><span className="bt-sk">{t('Code', 'Код')}</span><b>{code}</b></div>
          </div>
          <a className="bt-go" href={href}><IconPlay /><span>{t('Join the race', 'Войти в гонку')}</span></a>
        </div>
      </div>
    </div>
  );
}
