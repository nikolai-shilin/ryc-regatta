import type { Metadata } from 'next';
import { getT, type LangParams } from '@/lib/i18n';
import { pageMeta } from '@/lib/seo';
import { parseCode } from '@/lib/code';
import { BackLink } from '@/components/back-link';
import { SceneBrand } from '@/components/scene-brand';
import { IconPlay } from '@/components/ui';
import { venueOf } from '@/lib/venues';
import { yachtOf } from '@/lib/yachts';

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
  // a link whose code was cut short or mistyped: what's wrong with it and the ways on, rather than the bare 404
  if (!code) return (
    <div className="scr bt-scr bc" lang={lang}>
      <div className="bt">
        <div className="bt-info">
          <div className="bt-top">
            <BackLink href="/race" label={t('Back to the race hub', 'Назад в меню гонок')} />
            <SceneBrand lang={lang} />
          </div>
          <span className="bt-kick bt-kick-w">{t('1-on-1 race', 'Гонка 1 на 1')}</span>
          <h1 className="bt-h">{t('This invite link doesn’t work', 'Эта ссылка-приглашение не работает')}</h1>
          <p className="bt-p">{t('Its race code is missing or mistyped: a code is six letters and numbers. Ask your friend to send the link again, or set up a race of your own.',
            'В ней нет кода гонки или он с опечаткой: код — это шесть букв и цифр. Попроси друга прислать ссылку ещё раз или создай свою гонку.')}</p>
          <a className="bt-go" href="/match/new"><IconPlay /><span>{t('Set up a 1-on-1 race', 'Настроить гонку 1 на 1')}</span></a>
          <a className="bt-show" href="/race">{t('Sail today’s race', 'Пройти гонку дня')}</a>
        </div>
      </div>
    </div>
  );
  // the host's venue and boat, as ids in the address (the game's own reload settles a mismatch)
  const one = (x?: string | string[]) => { const s = Array.isArray(x) ? x[0] : x; return s && /^[a-z0-9_-]{1,32}$/i.test(s) ? s : ''; };
  const v = one(sp.v), b = one(sp.b);
  // where and in what the host sails, named when the address has a venue and a yacht the game knows
  const venue = v && venueOf(v).id === v ? venueOf(v) : null, yacht = b && yachtOf(b).id === b ? yachtOf(b) : null;
  const href = `/play?match=${code}${v ? `&venue=${v}` : ''}${b ? `&boat=${b}` : ''}`;
  return (
    <div className="scr bt-scr bc" lang={lang}>
      <div className="bt">
        <div className="bt-info">
          <div className="bt-top">
            <BackLink href="/race" label={t('Back to the race hub', 'Назад в меню гонок')} />
            <SceneBrand lang={lang} />
          </div>
          <span className="bt-kick bt-kick-w">{t('1-on-1 race', 'Гонка 1 на 1')}</span>
          <h1 className="bt-h" id="match-title">{t('Race me', 'Сыграем')}</h1>
          <p className="bt-p">{t('You and a friend, one on one.', 'Вы и друг, один на один.')}</p>
          <div className="bt-stats">
            <div><span className="bt-sk">{t('Code', 'Код')}</span><b>{code}</b></div>
            {venue && <div><span className="bt-sk">{t('Venue', 'Акватория')}</span><b>{t(...venue.name)}</b></div>}
            {yacht && <div><span className="bt-sk">{t('Yacht', 'Яхта')}</span><b>{t(...yacht.name)}</b></div>}
          </div>
          <a className="bt-go" href={href}><IconPlay /><span>{t('Join the race', 'Войти в гонку')}</span></a>
        </div>
      </div>
    </div>
  );
}
