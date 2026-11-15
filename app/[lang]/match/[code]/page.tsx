import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getT, type LangParams } from '@/lib/i18n';
import { pageMeta } from '@/lib/seo';
import { CODE_RE } from '@/lib/code';
import { BackLink } from '@/components/back-link';
import { SceneBrand } from '@/components/scene-brand';
import { IconPlay } from '@/components/ui';

// The page a match's link opens: /match/K7M2QZ?v=cowes&b=jpk1050. A tap on Join (the tap lets the game start its sound)
// opens the game at the match, in the host's venue and on the boat he picked. Never indexed.
const codeOf = (c: string) => decodeURIComponent(c).toUpperCase();

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const { lang, t } = await getT(params);
  return pageMeta(lang, { title: t('Race me: a match race', 'Сыграем матч: матчевая гонка'), description: t('Race me: a match race', 'Сыграем матч: матчевая гонка'), index: false });
}

export default async function MatchPage({ params, searchParams }: LangParams & { params: Promise<{ lang: string; code: string }>; searchParams: Promise<{ v?: string | string[]; b?: string | string[] }> }) {
  const [{ lang, t }, { code: raw }, sp] = await Promise.all([getT(params), params, searchParams]);
  const code = codeOf(raw);
  if (!CODE_RE.test(code)) notFound();
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
          <span className="bt-kick bt-kick-w">{t('Match race', 'Матчевая гонка')}</span>
          <h1 className="bt-h" id="match-title">{t('Race me', 'Сыграем матч')}</h1>
          <p className="bt-p">{t('You and a friend, one on one.', 'Вы и друг, один на один.')}</p>
          <div className="bt-stats">
            <div><span className="bt-sk">{t('Code', 'Код')}</span><b>{code}</b></div>
          </div>
          <a className="bt-go" href={href}><IconPlay /><span>{t('Join the match', 'Войти в матч')}</span></a>
        </div>
      </div>
    </div>
  );
}
